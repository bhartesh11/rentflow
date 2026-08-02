from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from datetime import datetime, date
from bson import ObjectId

from app.models import BillCreate, BulkBillGenerate, BillUpdate
from app.database import bills_col, tenants_col, rooms_col, next_sequence
from app.auth import require_owner, require_tenant, get_current_user
from app.utils.helpers import serialize, serialize_list, to_object_id
from app.utils.pdf import generate_invoice_pdf
from app.config import settings

router = APIRouter(prefix="/api/bills", tags=["bills"])


def _compute_status(total: float, paid: float, due_date: str) -> str:
    if paid >= total and total > 0:
        return "paid"
    if paid > 0:
        overdue = due_date and date.fromisoformat(due_date) < date.today()
        return "partial_overdue" if overdue else "partial"
    overdue = due_date and date.fromisoformat(due_date) < date.today()
    return "overdue" if overdue else "unpaid"


async def _build_bill_doc(tenant: dict, month: str, rent_amount: float, line_items: list, due_date: str, notes: str = None) -> dict:
    total = rent_amount + sum(i["amount"] if isinstance(i, dict) else i.amount for i in line_items)
    seq = await next_sequence("bill")
    return {
        "bill_number": f"INV-{datetime.utcnow().year}-{seq:05d}",
        "tenant_id": tenant["_id"],
        "room_id": tenant.get("room_id"),
        "month": month,
        "rent_amount": rent_amount,
        "line_items": [i if isinstance(i, dict) else i.model_dump() for i in line_items],
        "total_amount": total,
        "amount_paid": 0,
        "balance": total,
        "due_date": due_date,
        "status": _compute_status(total, 0, due_date),
        "notes": notes,
        "created_at": datetime.utcnow(),
    }


@router.post("")
async def create_bill(payload: BillCreate, owner: dict = Depends(require_owner)):
    tenant = await tenants_col.find_one({"_id": to_object_id(payload.tenant_id)})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    existing = await bills_col.find_one({"tenant_id": tenant["_id"], "month": payload.month})
    if existing:
        raise HTTPException(status_code=400, detail="A bill for this tenant and month already exists")
    doc = await _build_bill_doc(tenant, payload.month, payload.rent_amount, payload.line_items, payload.due_date, payload.notes)
    result = await bills_col.insert_one(doc)
    bill = await bills_col.find_one({"_id": result.inserted_id})
    return serialize(bill)


@router.post("/generate")
async def bulk_generate(payload: BulkBillGenerate, owner: dict = Depends(require_owner)):
    query = {"status": "active"}
    if payload.tenant_ids:
        query["_id"] = {"$in": [to_object_id(t) for t in payload.tenant_ids]}
    tenants = await tenants_col.find(query).to_list(1000)

    created, skipped = [], []
    for tenant in tenants:
        existing = await bills_col.find_one({"tenant_id": tenant["_id"], "month": payload.month})
        if existing:
            skipped.append(tenant["name"])
            continue
        room = await rooms_col.find_one({"_id": tenant["room_id"]}) if tenant.get("room_id") else None
        rent_amount = room["monthly_rent"] if room else 0
        doc = await _build_bill_doc(tenant, payload.month, rent_amount, payload.include_utilities, payload.due_date)
        result = await bills_col.insert_one(doc)
        created.append(str(result.inserted_id))

    return {"created": len(created), "skipped": skipped, "bill_ids": created}


@router.get("")
async def list_bills(user: dict = Depends(get_current_user), month: str = None, tenant_id: str = None, status_filter: str = None):
    query = {}
    if user["role"] == "tenant":
        query["tenant_id"] = ObjectId(user["tenant_id"])
    elif tenant_id:
        query["tenant_id"] = to_object_id(tenant_id)
    if month:
        query["month"] = month

    bills = await bills_col.find(query).sort("created_at", -1).to_list(1000)

    tenant_ids = {b["tenant_id"] for b in bills}
    tenants = {}
    if tenant_ids:
        async for t in tenants_col.find({"_id": {"$in": list(tenant_ids)}}):
            tenants[t["_id"]] = t["name"]
    for b in bills:
        b["tenant_name"] = tenants.get(b["tenant_id"])
        b["status"] = _compute_status(b["total_amount"], b["amount_paid"], b["due_date"])

    if status_filter:
        bills = [b for b in bills if b["status"] == status_filter]

    return serialize_list(bills)


async def _get_bill_with_access(bill_id: str, user: dict) -> dict:
    bill = await bills_col.find_one({"_id": to_object_id(bill_id)})
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    if user["role"] == "tenant" and str(bill["tenant_id"]) != user["tenant_id"]:
        raise HTTPException(status_code=403, detail="Not authorized to view this bill")
    bill["status"] = _compute_status(bill["total_amount"], bill["amount_paid"], bill["due_date"])
    return bill


@router.get("/{bill_id}")
async def get_bill(bill_id: str, user: dict = Depends(get_current_user)):
    bill = await _get_bill_with_access(bill_id, user)
    return serialize(bill)


@router.put("/{bill_id}")
async def update_bill(bill_id: str, payload: BillUpdate, owner: dict = Depends(require_owner)):
    oid = to_object_id(bill_id)
    bill = await bills_col.find_one({"_id": oid})
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")

    updates = {}
    if payload.line_items is not None:
        items = [i.model_dump() for i in payload.line_items]
        total = bill["rent_amount"] + sum(i["amount"] for i in items)
        updates["line_items"] = items
        updates["total_amount"] = total
        updates["balance"] = total - bill["amount_paid"]
        updates["status"] = _compute_status(total, bill["amount_paid"], payload.due_date or bill["due_date"])
    if payload.due_date is not None:
        updates["due_date"] = payload.due_date
    if payload.notes is not None:
        updates["notes"] = payload.notes

    if updates:
        await bills_col.update_one({"_id": oid}, {"$set": updates})
    bill = await bills_col.find_one({"_id": oid})
    return serialize(bill)


@router.delete("/{bill_id}")
async def delete_bill(bill_id: str, owner: dict = Depends(require_owner)):
    oid = to_object_id(bill_id)
    result = await bills_col.delete_one({"_id": oid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Bill not found")
    return {"deleted": True}


@router.get("/{bill_id}/invoice.pdf")
async def download_invoice(bill_id: str, user: dict = Depends(get_current_user)):
    bill = await _get_bill_with_access(bill_id, user)
    tenant = await tenants_col.find_one({"_id": bill["tenant_id"]})
    room = await rooms_col.find_one({"_id": bill["room_id"]}) if bill.get("room_id") else None
    pdf_bytes = generate_invoice_pdf(bill, tenant, room, owner_name=settings.owner_name)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{bill.get("bill_number", "invoice")}.pdf"'},
    )
