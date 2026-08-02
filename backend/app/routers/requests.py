from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime
from bson import ObjectId

from app.models import RequestCreate, RequestUpdate
from app.database import requests_col, tenants_col
from app.auth import require_owner, require_tenant, get_current_user
from app.utils.helpers import serialize, serialize_list, to_object_id

router = APIRouter(prefix="/api/requests", tags=["requests"])


@router.post("")
async def create_request(payload: RequestCreate, user: dict = Depends(require_tenant)):
    tenant = await tenants_col.find_one({"_id": ObjectId(user["tenant_id"])})
    doc = {
        "tenant_id": ObjectId(user["tenant_id"]),
        "room_id": tenant.get("room_id") if tenant else None,
        "title": payload.title,
        "description": payload.description,
        "category": payload.category,
        "status": "open",
        "owner_note": None,
        "created_at": datetime.utcnow(),
        "resolved_at": None,
    }
    result = await requests_col.insert_one(doc)
    req = await requests_col.find_one({"_id": result.inserted_id})
    return serialize(req)


@router.get("")
async def list_requests(user: dict = Depends(get_current_user)):
    query = {}
    if user["role"] == "tenant":
        query["tenant_id"] = ObjectId(user["tenant_id"])
    reqs = await requests_col.find(query).sort("created_at", -1).to_list(1000)

    tenant_ids = {r["tenant_id"] for r in reqs}
    tenants = {}
    if tenant_ids:
        async for t in tenants_col.find({"_id": {"$in": list(tenant_ids)}}):
            tenants[t["_id"]] = t["name"]
    for r in reqs:
        r["tenant_name"] = tenants.get(r["tenant_id"])

    return serialize_list(reqs)


@router.put("/{request_id}")
async def update_request(request_id: str, payload: RequestUpdate, owner: dict = Depends(require_owner)):
    oid = to_object_id(request_id)
    updates = {"status": payload.status}
    if payload.owner_note is not None:
        updates["owner_note"] = payload.owner_note
    if payload.status == "resolved":
        updates["resolved_at"] = datetime.utcnow()
    result = await requests_col.update_one({"_id": oid}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Request not found")
    req = await requests_col.find_one({"_id": oid})
    return serialize(req)
