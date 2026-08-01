from fastapi import APIRouter, Depends
from datetime import date, datetime, timedelta

from app.database import rooms_col, tenants_col, bills_col, payments_col
from app.auth import require_owner
from app.utils.helpers import serialize_list

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/stats")
async def stats(owner: dict = Depends(require_owner)):
    total_rooms = await rooms_col.count_documents({})
    occupied_rooms = await rooms_col.count_documents({"status": "occupied"})
    active_tenants = await tenants_col.count_documents({"status": "active"})

    this_month = date.today().strftime("%Y-%m")
    bills_this_month = await bills_col.find({"month": this_month}).to_list(1000)
    total_billed = sum(b["total_amount"] for b in bills_this_month)
    total_collected_this_month = sum(b["amount_paid"] for b in bills_this_month)

    all_unpaid = await bills_col.find({"$expr": {"$lt": ["$amount_paid", "$total_amount"]}}).to_list(2000)
    total_dues = sum(b["total_amount"] - b["amount_paid"] for b in all_unpaid)
    overdue_count = sum(
        1 for b in all_unpaid if b.get("due_date") and date.fromisoformat(b["due_date"]) < date.today()
    )

    all_payments = await payments_col.find().to_list(5000)
    total_collected_all_time = sum(p["amount"] for p in all_payments)

    # last 6 months collection trend
    months = []
    cursor = date.today().replace(day=1)
    for i in range(5, -1, -1):
        year = cursor.year
        month = cursor.month - i
        while month <= 0:
            month += 12
            year -= 1
        months.append(f"{year}-{month:02d}")
    trend = []
    for m in months:
        month_bills = [b for b in bills_this_month] if m == this_month else await bills_col.find({"month": m}).to_list(1000)
        trend.append({
            "month": m,
            "billed": sum(b["total_amount"] for b in month_bills),
            "collected": sum(b["amount_paid"] for b in month_bills),
        })

    recent_payments = await payments_col.find().sort("created_at", -1).limit(5).to_list(5)
    tenants_map = {}
    async for t in tenants_col.find({}, {"name": 1}):
        tenants_map[t["_id"]] = t["name"]
    for p in recent_payments:
        p["tenant_name"] = tenants_map.get(p["tenant_id"])

    return {
        "total_rooms": total_rooms,
        "occupied_rooms": occupied_rooms,
        "vacant_rooms": total_rooms - occupied_rooms,
        "occupancy_rate": round((occupied_rooms / total_rooms * 100), 1) if total_rooms else 0,
        "active_tenants": active_tenants,
        "total_billed_this_month": total_billed,
        "total_collected_this_month": total_collected_this_month,
        "total_dues": total_dues,
        "overdue_bills": overdue_count,
        "total_collected_all_time": total_collected_all_time,
        "monthly_trend": trend,
        "recent_payments": serialize_list(recent_payments),
    }
