from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime
from bson import ObjectId

from app.models import TenantCreate, TenantUpdate
from app.database import tenants_col, rooms_col, users_col
from app.auth import require_owner, require_tenant, hash_password
from app.utils.helpers import serialize, serialize_list, to_object_id

router = APIRouter(prefix="/api/tenants", tags=["tenants"])


async def _attach_room_names(tenants: list) -> list:
    room_ids = {t["room_id"] for t in tenants if t.get("room_id")}
    rooms = {}
    if room_ids:
        async for r in rooms_col.find({"_id": {"$in": list(room_ids)}}):
            rooms[r["_id"]] = r["name"]
    for t in tenants:
        t["room_name"] = rooms.get(t.get("room_id"))
    return tenants


@router.get("")
async def list_tenants(owner: dict = Depends(require_owner)):
    tenants = await tenants_col.find().sort("created_at", -1).to_list(1000)
    tenants = await _attach_room_names(tenants)
    return serialize_list(tenants)


@router.post("")
async def create_tenant(payload: TenantCreate, owner: dict = Depends(require_owner)):
    existing = await tenants_col.find_one({"email": payload.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="A tenant with this email already exists")

    doc = payload.model_dump(exclude={"set_password"})
    doc["email"] = doc["email"].lower()
    doc["status"] = "active"
    doc["created_at"] = datetime.utcnow()
    if doc.get("room_id"):
        try:
            doc["room_id"] = ObjectId(doc["room_id"])
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid room id")

    result = await tenants_col.insert_one(doc)

    if doc.get("room_id"):
        await rooms_col.update_one({"_id": doc["room_id"]}, {"$set": {"status": "occupied"}})

    if payload.set_password:
        existing_user = await users_col.find_one({"email": doc["email"]})
        if not existing_user:
            await users_col.insert_one({
                "name": payload.name,
                "email": doc["email"],
                "password_hash": hash_password(payload.set_password),
                "role": "tenant",
                "tenant_id": result.inserted_id,
                "created_at": datetime.utcnow(),
            })

    tenant = await tenants_col.find_one({"_id": result.inserted_id})
    return serialize(tenant)


@router.put("/{tenant_id}")
async def update_tenant(tenant_id: str, payload: TenantUpdate, owner: dict = Depends(require_owner)):
    oid = to_object_id(tenant_id)
    tenant = await tenants_col.find_one({"_id": oid})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    old_room_id = tenant.get("room_id")
    new_room_id = None
    if "room_id" in updates:
        try:
            new_room_id = ObjectId(updates["room_id"])
            updates["room_id"] = new_room_id
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid room id")

    if updates:
        await tenants_col.update_one({"_id": oid}, {"$set": updates})

    # Keep room occupancy status in sync
    if new_room_id and new_room_id != old_room_id:
        await rooms_col.update_one({"_id": new_room_id}, {"$set": {"status": "occupied"}})
        if old_room_id:
            remaining = await tenants_col.count_documents({"room_id": old_room_id, "status": "active"})
            if remaining == 0:
                await rooms_col.update_one({"_id": old_room_id}, {"$set": {"status": "vacant"}})

    if updates.get("status") == "vacated" and old_room_id:
        remaining = await tenants_col.count_documents({"room_id": old_room_id, "status": "active"})
        if remaining == 0:
            await rooms_col.update_one({"_id": old_room_id}, {"$set": {"status": "vacant"}})

    tenant = await tenants_col.find_one({"_id": oid})
    return serialize(tenant)


@router.delete("/{tenant_id}")
async def delete_tenant(tenant_id: str, owner: dict = Depends(require_owner)):
    oid = to_object_id(tenant_id)
    tenant = await tenants_col.find_one({"_id": oid})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    await tenants_col.delete_one({"_id": oid})
    await users_col.delete_many({"tenant_id": oid})
    if tenant.get("room_id"):
        remaining = await tenants_col.count_documents({"room_id": tenant["room_id"], "status": "active"})
        if remaining == 0:
            await rooms_col.update_one({"_id": tenant["room_id"]}, {"$set": {"status": "vacant"}})
    return {"deleted": True}


@router.get("/me")
async def my_profile(user: dict = Depends(require_tenant)):
    tenant = await tenants_col.find_one({"_id": ObjectId(user["tenant_id"])})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant profile not found")
    tenants = await _attach_room_names([tenant])
    return serialize(tenants[0])
