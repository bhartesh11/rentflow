from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime

from app.config import settings
from app.database import users_col, ensure_indexes
from app.auth import hash_password
from app.routers import auth, rooms, tenants, bills, payments, requests as requests_router, dashboard

app = FastAPI(title="RentFlow API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(rooms.router)
app.include_router(tenants.router)
app.include_router(bills.router)
app.include_router(payments.router)
app.include_router(requests_router.router)
app.include_router(dashboard.router)


@app.on_event("startup")
async def startup():
    await ensure_indexes()
    owner = await users_col.find_one({"role": "owner"})
    if not owner:
        await users_col.insert_one({
            "name": settings.owner_name,
            "email": settings.owner_email.lower(),
            "password_hash": hash_password(settings.owner_password),
            "role": "owner",
            "created_at": datetime.utcnow(),
        })


@app.get("/api/health")
async def health():
    return {"status": "ok"}
