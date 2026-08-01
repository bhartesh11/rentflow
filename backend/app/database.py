from motor.motor_asyncio import AsyncIOMotorClient
from app.config import settings

client = AsyncIOMotorClient(settings.mongo_uri)
db = client[settings.mongo_db_name]

# Collections
users_col = db["users"]          # owner + tenant login accounts
rooms_col = db["rooms"]
tenants_col = db["tenants"]
bills_col = db["bills"]
payments_col = db["payments"]
requests_col = db["maintenance_requests"]
counters_col = db["counters"]


async def next_sequence(name: str) -> int:
    """Simple auto-increment counter used for human-friendly invoice/receipt numbers."""
    doc = await counters_col.find_one_and_update(
        {"_id": name},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True,
    )
    return doc["seq"]


async def ensure_indexes():
    await users_col.create_index("email", unique=True)
    await rooms_col.create_index("name")
    await tenants_col.create_index("email", unique=True, sparse=True)
    await bills_col.create_index("tenant_id")
    await payments_col.create_index("bill_id")
