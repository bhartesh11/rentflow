from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from datetime import datetime, date
from bson import ObjectId

from app.models import PaymentCreate
from app.database import payments_col, bills_col, tenants_col, next_sequence
from app.auth import require_owner, get_current_user
from app.utils.helpers import serialize, serialize_list, to_object_id
from app.utils.pdf import generate_receipt_pdf
from app.config import settings
from app.routers.bills import _compute_status

router = APIRouter(prefix="/api/payments", tags=["payments"])


@router.post("")
async def record_payment(payload: PaymentCreate, owner: dict = Depends(require_owner)):
    bill = await bills_col.find_one({"_id": to_object_id(payload.bill_id)})
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")

    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Payment amount must be greater than zero")

    remaining = bill["total_amount"] - bill["amount_paid"]
    if payload.amount > remaining + 0.01:
        raise HTTPException(status_code=400, detail=f"Payment exceeds outstanding balance of {remaining:.2f}")

    seq = await next_sequence("payment")
    paid_on = payload.paid_on or date.today().isoformat()

    payment_doc = {
        "receipt_number": f"RCPT-{datetime.utcnow().year}-{seq:05d}",
        "bill_id": bill["_id"],
        "tenant_id": bill["tenant_id"],
        "amount": payload.amount,
        "method": payload.method,
        "paid_on": paid_on,
        "note": payload.note,
        "created_at": datetime.utcnow(),
    }
    result = await payments_col.insert_one(payment_doc)

    new_paid = bill["amount_paid"] + payload.amount
    new_balance = bill["total_amount"] - new_paid
    new_status = _compute_status(bill["total_amount"], new_paid, bill["due_date"])
    await bills_col.update_one(
        {"_id": bill["_id"]},
        {"$set": {"amount_paid": new_paid, "balance": new_balance, "status": new_status}},
    )

    payment = await payments_col.find_one({"_id": result.inserted_id})
    return serialize(payment)


@router.get("")
async def list_payments(user: dict = Depends(get_current_user), bill_id: str = None, tenant_id: str = None):
    query = {}
    if user["role"] == "tenant":
        query["tenant_id"] = ObjectId(user["tenant_id"])
    elif tenant_id:
        query["tenant_id"] = to_object_id(tenant_id)
    if bill_id:
        query["bill_id"] = to_object_id(bill_id)

    payments = await payments_col.find(query).sort("created_at", -1).to_list(1000)

    tenant_ids = {p["tenant_id"] for p in payments}
    tenants = {}
    if tenant_ids:
        async for t in tenants_col.find({"_id": {"$in": list(tenant_ids)}}):
            tenants[t["_id"]] = t["name"]
    for p in payments:
        p["tenant_name"] = tenants.get(p["tenant_id"])

    return serialize_list(payments)


@router.get("/{payment_id}/receipt.pdf")
async def download_receipt(payment_id: str, user: dict = Depends(get_current_user)):
    payment = await payments_col.find_one({"_id": to_object_id(payment_id)})
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    if user["role"] == "tenant" and str(payment["tenant_id"]) != user["tenant_id"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    bill = await bills_col.find_one({"_id": payment["bill_id"]})
    tenant = await tenants_col.find_one({"_id": payment["tenant_id"]})
    pdf_bytes = generate_receipt_pdf(payment, bill, tenant, owner_name=settings.owner_name)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{payment.get("receipt_number", "receipt")}.pdf"'},
    )
