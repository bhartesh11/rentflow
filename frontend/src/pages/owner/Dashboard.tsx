import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'
import api, { apiErrorMessage } from '../../api/client'
import type { DashboardStats } from '../../api/types'
import { Spinner, ErrorBanner } from '../../components/Common'

function StatCard({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="card">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${tone || 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/api/dashboard/stats')
      .then((res) => setStats(res.data))
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <Spinner />
  if (error) return <ErrorBanner message={error} />
  if (!stats) return null

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm">Overview of occupancy, collections and dues</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Occupancy" value={`${stats.occupancy_rate}%`} sub={`${stats.occupied_rooms}/${stats.total_rooms} rooms occupied`} />
        <StatCard label="Active Tenants" value={String(stats.active_tenants)} />
        <StatCard label="Collected this month" value={fmt(stats.total_collected_this_month)} sub={`Billed: ${fmt(stats.total_billed_this_month)}`} tone="text-green-600" />
        <StatCard label="Total Dues" value={fmt(stats.total_dues)} sub={`${stats.overdue_bills} overdue bill(s)`} tone={stats.total_dues > 0 ? 'text-red-600' : 'text-gray-900'} />
      </div>

      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-4">Collections — last 6 months</h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={stats.monthly_trend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="month" fontSize={12} />
            <YAxis fontSize={12} />
            <Tooltip formatter={(v: number) => fmt(v)} />
            <Legend />
            <Bar dataKey="billed" fill="#93c5fd" name="Billed" radius={[4, 4, 0, 0]} />
            <Bar dataKey="collected" fill="#1e3a5f" name="Collected" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-4">Recent Payments</h2>
        {stats.recent_payments.length === 0 ? (
          <p className="text-gray-400 text-sm">No payments recorded yet.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {stats.recent_payments.map((p) => (
              <div key={p.id} className="flex justify-between py-2 text-sm">
                <span className="text-gray-700">{p.tenant_name}</span>
                <span className="text-gray-400">{p.paid_on}</span>
                <span className="font-medium text-green-600">{fmt(p.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
