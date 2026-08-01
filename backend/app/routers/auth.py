from fastapi import APIRouter, HTTPException, Depends
from bson import ObjectId
from datetime import datetime, date

from app.models import LoginRequest, TenantRegisterRequest, TokenResponse
from app.database import users_col, tenants_col, rooms_col
from app.auth import hash_password, verify_password, create_access_token, get_current_user
from app.utils.helpers import serialize

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest):
    user = await users_col.find_one({"email": payload.email.lower()})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token_data = {"sub": str(user["_id"]), "role": user["role"]}
    if user.get("tenant_id"):
        token_data["tenant_id"] = str(user["tenant_id"])

    token = create_access_token(token_data)
    return TokenResponse(
        access_token=token,
        role=user["role"],
        name=user["name"],
        user_id=str(user["_id"]),
        tenant_id=str(user["tenant_id"]) if user.get("tenant_id") else None,
    )


@router.post("/register", response_model=TokenResponse)
async def tenant_self_register(payload: TenantRegisterRequest):
    """Tenant 'Join' flow. invite_code = the room's id, shared by the owner so
    tenants land in the correct room. A tenant profile is created if one
    doesn't already exist for this email (e.g. owner pre-added them)."""

    existing_user = await users_col.find_one({"email": payload.email.lower()})
    if existing_user:
        raise HTTPException(status_code=400, detail="An account with this email already exists")

    room = None
    if payload.invite_code:
        try:
            room = await rooms_col.find_one({"_id": ObjectId(payload.invite_code)})
        except Exception:
            room = None
        if not room:
            raise HTTPException(status_code=400, detail="Invalid invite code / room code")

    # If owner already pre-created a tenant record with this email, attach to it
    tenant = await tenants_col.find_one({"email": payload.email.lower()})
    if tenant:
        tenant_id = tenant["_id"]
        update = {"name": payload.name, "phone": payload.phone}
        if room:
            update["room_id"] = room["_id"]
        await tenants_col.update_one({"_id": tenant_id}, {"$set": update})
    else:
        tenant_doc = {
            "name": payload.name,
            "email": payload.email.lower(),
            "phone": payload.phone,
            "room_id": room["_id"] if room else None,
            "move_in_date": date.today().isoformat(),
            "status": "active",
            "security_deposit": 0,
            "created_at": datetime.utcnow(),
        }
        result = await tenants_col.insert_one(tenant_doc)
        tenant_id = result.inserted_id

    if room:
        await rooms_col.update_one({"_id": room["_id"]}, {"$set": {"status": "occupied"}})

    user_doc = {
        "name": payload.name,
        "email": payload.email.lower(),
        "password_hash": hash_password(payload.password),
        "role": "tenant",
        "tenant_id": tenant_id,
        "created_at": datetime.utcnow(),
    }
    result = await users_col.insert_one(user_doc)

    token = create_access_token({
        "sub": str(result.inserted_id), "role": "tenant", "tenant_id": str(tenant_id)
    })
    return TokenResponse(
        access_token=token, role="tenant", name=payload.name,
        user_id=str(result.inserted_id), tenant_id=str(tenant_id),
    )


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return serialize(user)
