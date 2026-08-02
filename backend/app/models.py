from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Literal
from datetime import datetime


# ---------- Auth ----------
class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TenantRegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str = Field(min_length=6)
    phone: str
    invite_code: str  # room id or owner-provided code to prevent open signup abuse


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    name: str
    user_id: str
    tenant_id: Optional[str] = None


# ---------- Rooms ----------
class RoomCreate(BaseModel):
    name: str
    floor: Optional[str] = None
    monthly_rent: float
    capacity: int = 1
    notes: Optional[str] = None


class RoomUpdate(BaseModel):
    name: Optional[str] = None
    floor: Optional[str] = None
    monthly_rent: Optional[float] = None
    capacity: Optional[int] = None
    notes: Optional[str] = None


# ---------- Tenants ----------
class TenantCreate(BaseModel):
    name: str
    email: EmailStr
    phone: str
    room_id: Optional[str] = None
    move_in_date: Optional[str] = None
    id_proof_type: Optional[str] = None
    id_proof_number: Optional[str] = None
    address: Optional[str] = None
    security_deposit: Optional[float] = 0
    set_password: Optional[str] = None  # if owner wants to set login credentials directly


class TenantUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    room_id: Optional[str] = None
    status: Optional[Literal["active", "vacated"]] = None
    move_out_date: Optional[str] = None
    id_proof_type: Optional[str] = None
    id_proof_number: Optional[str] = None
    address: Optional[str] = None
    security_deposit: Optional[float] = None


# ---------- Bills ----------
class LineItem(BaseModel):
    label: str
    amount: float


class BillCreate(BaseModel):
    tenant_id: str
    month: str  # "YYYY-MM"
    rent_amount: float
    line_items: List[LineItem] = []
    due_date: str  # "YYYY-MM-DD"
    notes: Optional[str] = None


class BulkBillGenerate(BaseModel):
    month: str  # "YYYY-MM"
    due_date: str  # "YYYY-MM-DD"
    include_utilities: List[LineItem] = []  # applied to every active tenant's bill, optional
    tenant_ids: Optional[List[str]] = None  # if omitted, applies to all active tenants


class BillUpdate(BaseModel):
    line_items: Optional[List[LineItem]] = None
    due_date: Optional[str] = None
    notes: Optional[str] = None


# ---------- Payments ----------
class PaymentCreate(BaseModel):
    bill_id: str
    amount: float
    method: Literal["cash", "bank_transfer", "upi", "cheque", "other"] = "cash"
    paid_on: Optional[str] = None  # "YYYY-MM-DD", defaults to today
    note: Optional[str] = None


# ---------- Maintenance Requests ----------
class RequestCreate(BaseModel):
    title: str
    description: str
    category: Optional[str] = "general"


class RequestUpdate(BaseModel):
    status: Literal["open", "in_progress", "resolved"]
    owner_note: Optional[str] = None
