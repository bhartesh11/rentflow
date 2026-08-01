import { useEffect, useState } from 'react'
import api, { apiErrorMessage } from '../../api/client'
import type { Bill } from '../../api/types'
import { Spinner, ErrorBanner, EmptyState, StatusBadge } from '../../components/Common'

export default function TenantBills() {
  const [bills, setBills] = useState<Bill[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/api/bills').then((res) => setBills(res.data)).catch((e) => setError(apiErrorMessage(e))).finally(() => setLoading(false))
  }, [])

  const downloadInvoice = async (bill: Bill) => {
    const res = await api.get(`/api/bills/${bill.id}/invoice.pdf`, { responseType: 'blob' })
    const url = window.URL.createObjectURL(new Blob([res.data]))
    const a = document.createElement('a')
    a.href = url
    a.download = `${bill.bill_number}.pdf`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
  const totalDue = bills.reduce((s, b) => s + b.balance, 0)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Bills</h1>
        <p className="text-gray-500 text-sm">
          Total outstanding: <span className={`font-semibold ${totalDue > 0 ? 'text-red-600' : 'text-green-600'}`}>{fmt(totalDue)}</span>
        </p>
      </div>

      <ErrorBanner message={error} />

      {loading ? (
        <Spinner />
      ) : bills.length === 0 ? (
        <EmptyState title="No bills yet" subtitle="Your owner hasn't generated any bills for you" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {bills.map((b) => (
            <div key={b.id} className="card">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{b.month}</h3>
                  <p className="text-xs text-gray-400 font-mono">{b.bill_number}</p>
                </div>
                <StatusBadge status={b.status} />
              </div>
              <div className="mt-3 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Rent</span><span>{fmt(b.rent_amount)}</span></div>
                {b.line_items.map((li, i) => (
                  <div key={i} className="flex justify-between"><span className="text-gray-500">{li.label}</span><span>{fmt(li.amount)}</span></div>
                ))}
                <div className="flex justify-between font-semibold border-t border-gray-100 pt-1 mt-1"><span>Total</span><span>{fmt(b.total_amount)}</span></div>
                <div className="flex justify-between text-green-600"><span>Paid</span><span>{fmt(b.amount_paid)}</span></div>
                <div className="flex justify-between font-semibold"><span>Balance</span><span>{fmt(b.balance)}</span></div>
              </div>
              <p className="text-xs text-gray-400 mt-2">Due {b.due_date}</p>
              <button className="btn-secondary w-full mt-3 text-xs" onClick={() => downloadInvoice(b)}>Download Invoice PDF</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
