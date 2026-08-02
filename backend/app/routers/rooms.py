from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime
from bson import ObjectId

from app.models import RoomCreate, RoomUpdate
from app.database import rooms_col, tenants_col
from app.auth import require_owner
from app.utils.helpers import serialize, serialize_list, to_object_id

router = APIRouter(prefix="/api/rooms", tags=["rooms"])


@router.get("")
async def list_rooms(owner: dict = Depends(require_owner)):
    rooms = await rooms_col.find().sort("name", 1).to_list(1000)
    return serialize_list(rooms)


@router.post("")
async def create_room(payload: RoomCreate, owner: dict = Depends(require_owner)):
    doc = payload.model_dump()
    doc["status"] = "vacant"
    doc["created_at"] = datetime.utcnow()
    result = await rooms_col.insert_one(doc)
    room = await rooms_col.find_one({"_id": result.inserted_id})
    return serialize(room)


@router.put("/{room_id}")
async def update_room(room_id: str, payload: RoomUpdate, owner: dict = Depends(require_owner)):
    try:
        oid = to_object_id(room_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid room id")
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = await rooms_col.update_one({"_id": oid}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Room not found")
    room = await rooms_col.find_one({"_id": oid})
    return serialize(room)


@router.delete("/{room_id}")
async def delete_room(room_id: str, owner: dict = Depends(require_owner)):
    oid = to_object_id(room_id)
    linked = await tenants_col.count_documents({"room_id": oid, "status": "active"})
    if linked > 0:
        raise HTTPException(status_code=400, detail="Cannot delete a room with an active tenant assigned")
    result = await rooms_col.delete_one({"_id": oid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Room not found")
    return {"deleted": True}
