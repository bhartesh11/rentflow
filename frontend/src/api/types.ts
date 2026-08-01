export type Role = 'owner' | 'tenant'

export interface AuthUser {
  user_id: string
  name: string
  role: Role
  tenant_id?: string | null
}

export interface Room {
  id: string
  name: string
  floor?: string
  monthly_rent: number
  capacity: number
  status: 'vacant' | 'occupied'
  notes?: string
}

export interface Tenant {
  id: string
  name: string
  email: string
  phone: string
  room_id?: string | null
  room_name?: string | null
  move_in_date?: string
  move_out_date?: string
  status: 'active' | 'vacated'
  id_proof_type?: string
  id_proof_number?: string
  address?: string
  security_deposit?: number
}

export interface LineItem {
  label: string
  amount: number
}

export interface Bill {
  id: string
  bill_number: string
  tenant_id: string
  tenant_name?: string
  room_id?: string
  month: string
  rent_amount: number
  line_items: LineItem[]
  total_amount: number
  amount_paid: number
  balance: number
  due_date: string
  status: 'unpaid' | 'partial' | 'partial_overdue' | 'paid' | 'overdue'
  notes?: string
}

export interface Payment {
  id: string
  receipt_number: string
  bill_id: string
  tenant_id: string
  tenant_name?: string
  amount: number
  method: string
  paid_on: string
  note?: string
}

export interface MaintenanceRequest {
  id: string
  tenant_id: string
  tenant_name?: string
  title: string
  description: string
  category: string
  status: 'open' | 'in_progress' | 'resolved'
  owner_note?: string
  created_at: string
}

export interface DashboardStats {
  total_rooms: number
  occupied_rooms: number
  vacant_rooms: number
  occupancy_rate: number
  active_tenants: number
  total_billed_this_month: number
  total_collected_this_month: number
  total_dues: number
  overdue_bills: number
  total_collected_all_time: number
  monthly_trend: { month: string; billed: number; collected: number }[]
  recent_payments: Payment[]
}
