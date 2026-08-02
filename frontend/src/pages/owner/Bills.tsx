import { useEffect, useState } from 'react'
import api, { apiErrorMessage } from '../../api/client'
import type { Bill, Tenant } from '../../api/types'
import { Spinner, ErrorBanner, EmptyState, StatusBadge, Modal } from '../../components/Common'

const thisMonth = new Date().toISOString().slice(0, 7)

export default function Bills() {
  const [bills, setBills] = useState<Bill[]>([])
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [monthFilter, setMonthFilter] = useState(thisMonth)
  const [statusFilter, setStatusFilter] = useState('')

  const [genOpen, setGenOpen] = useState(false)
  const [genMonth, setGenMonth] = useState(thisMonth)
  const [genDueDate, setGenDueDate] = useState('')
  const [genUtilities, setGenUtilities] = useState<{ label: string; amount: string }[]>([])
  const [generating, setGenerating] = useState(false)
  const [genResult, setGenResult] = useState('')

  const [payOpen, setPayOpen] = useState(false)
  const [payBill, setPayBill] = useState<Bill | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState('cash')
  const [payNote, setPayNote] = useState('')
  const [paying, setPaying] = useState(false)

  const [manualOpen, setManualOpen] = useState(false)
  const [manualForm, setManualForm] = useState({ tenant_id: '', month: thisMonth, rent_amount: '', due_date: '' })
  const [manualSaving, setManualSaving] = useState(false)

  const load = () => {
    setLoading(true)
    const params: any = {}
    if (monthFilter) params.month = monthFilter
    if (statusFilter) params.status_filter = statusFilter
    Promise.all([api.get('/api/bills', { params }), api.get('/api/tenants')])
      .then(([b, t]) => { setBills(b.data); setTenants(t.data.filter((x: Tenant) => x.status === 'active')) })
      .catch((e) => setError(apiErrorMessage(e)))
      .finally(() => setLoading(false))
  }

  useEffect(load, [monthFilter, statusFilter])

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    setGenerating(true)
    setGenResult('')
    setError('')
    try {
      const utilities = genUtilities.filter((u) => u.label && u.amount).map((u) => ({ label: u.label, amount: parseFloat(u.amount) }))
      const res = await api.post('/api/bills/generate', { month: genMonth, due_date: genDueDate, include_utilities: utilities })
      setGenResult(`Generated ${res.data.created} bill(s).${res.data.skipped.length ? ` Skipped (already exists): ${res.data.skipped.join(', ')}` : ''}`)
      load()
    } catch (err) {
      setError(apiErrorMessage(err))
    } finally {
      setGenerating(false)
    }
  }

  const openPay = (bill: Bill) => {
    setPayBill(bill)
    setPayAmount(String((bill.total_amount - bill.amount_paid).toFixed(2)))
    setPayMethod('cash')
    setPayNote('')
    setPayOpen(true)
  }

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!payBill) return
    setPaying(true)
    setError('')
    try {
      await api.post('/api/payments', {
        bill_id: payBill.id, amount: parseFloat(payAmount), method: payMethod,
        note: payNote || undefined,
      })
      setPayOpen(false)
      load()
    } catch (err) {
      setError(apiErrorMessage(err))
    } finally {
      setPaying(false)
    }
  }

  const handleManualCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setManualSaving(true)
    setError('')
    try {
      await api.post('/api/bills', {
        tenant_id: manualForm.tenant_id, month: manualForm.month,
        rent_amount: parseFloat(manualForm.rent_amount), due_date: manualForm.due_date, line_items: [],
      })
      setManualOpen(false)
      load()
    } catch (err) {
      setError(apiErrorMessage(err))
    } finally {
      setManualSaving(false)
    }
  }

  const downloadInvoice = async (bill: Bill) => {
    const res = await api.get(`/api/bills/${bill.id}/invoice.pdf`, { responseType: 'blob' })
    const url = window.URL.createObjectURL(new Blob([res.data]))
    const a = document.createElement('a')
    a.href = url
    a.download = `${bill.bill_number}.pdf`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const handleDelete = async (bill: Bill) => {
    if (!confirm(`Delete bill ${bill.bill_number}?`)) return
    try {
      await api.delete(`/api/bills/${bill.id}`)
      load()
    } catch (err) {
      alert(apiErrorMessage(err))
    }
  }

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bills</h1>
          <p className="text-gray-500 text-sm">Generate and track monthly rent bills</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => setManualOpen(true)}>+ Single Bill</button>
          <button className="btn-primary" onClick={() => setGenOpen(true)}>Generate Monthly Bills</button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="label">Month</label>
          <input className="input" type="month" value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} />
        </div>
        <div>
          <label className="label">Status</label>
          <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All</option>
            <option value="unpaid">Unpaid</option>
            <option value="partial">Partial</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
            <option value="partial_overdue">Partial (Overdue)</option>
          </select>
        </div>
      </div>

      <ErrorBanner message={error} />

      {loading ? (
        <Spinner />
      ) : bills.length === 0 ? (
        <EmptyState title="No bills found" subtitle="Generate bills for this month to get started" />
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-200">
                <th className="px-4 py-3">Invoice #</th>
                <th className="px-4 py-3">Tenant</th>
                <th className="px-4 py-3">Month</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Paid</th>
                <th className="px-4 py-3">Balance</th>
                <th className="px-4 py-3">Due</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {bills.map((b) => (
                <tr key={b.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3 font-mono text-xs">{b.bill_number}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{b.tenant_name}</td>
                  <td className="px-4 py-3">{b.month}</td>
                  <td className="px-4 py-3">{fmt(b.total_amount)}</td>
                  <td className="px-4 py-3 text-green-600">{fmt(b.amount_paid)}</td>
                  <td className="px-4 py-3 font-medium">{fmt(b.balance)}</td>
                  <td className="px-4 py-3 text-gray-500">{b.due_date}</td>
                  <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end">
                      {b.balance > 0 && <button className="btn-secondary text-xs" onClick={() => openPay(b)}>Record Payment</button>}
                      <button className="btn-secondary text-xs" onClick={() => downloadInvoice(b)}>PDF</button>
                      <button className="btn-danger text-xs" onClick={() => handleDelete(b)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={genOpen} onClose={() => setGenOpen(false)} title="Generate Monthly Bills">
        <form onSubmit={handleGenerate} className="space-y-4">
          <p className="text-sm text-gray-500">Creates a bill for every active tenant based on their room's rent. Skips tenants who already have a bill for the selected month.</p>
          {genResult && <div className="rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-2">{genResult}</div>}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Month</label>
              <input className="input" type="month" required value={genMonth} onChange={(e) => setGenMonth(e.target.value)} />
            </div>
            <div>
              <label className="label">Due Date</label>
              <input className="input" type="date" required value={genDueDate} onChange={(e) => setGenDueDate(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">Utility / Custom Line Items (applied to every bill)</label>
            {genUtilities.map((u, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <input className="input" placeholder="e.g. Electricity" value={u.label} onChange={(e) => {
                  const arr = [...genUtilities]; arr[i].label = e.target.value; setGenUtilities(arr)
                }} />
                <input className="input w-28" placeholder="Amount" type="number" value={u.amount} onChange={(e) => {
                  const arr = [...genUtilities]; arr[i].amount = e.target.value; setGenUtilities(arr)
                }} />
                <button type="button" className="btn-secondary" onClick={() => setGenUtilities(genUtilities.filter((_, idx) => idx !== i))}>×</button>
              </div>
            ))}
            <button type="button" className="btn-secondary text-xs" onClick={() => setGenUtilities([...genUtilities, { label: '', amount: '' }])}>+ Add line item</button>
          </div>
          <button className="btn-primary w-full" disabled={generating}>{generating ? 'Generating…' : 'Generate Bills'}</button>
        </form>
      </Modal>

      <Modal open={manualOpen} onClose={() => setManualOpen(false)} title="Create Single Bill">
        <form onSubmit={handleManualCreate} className="space-y-4">
          <div>
            <label className="label">Tenant</label>
            <select className="input" required value={manualForm.tenant_id} onChange={(e) => setManualForm({ ...manualForm, tenant_id: e.target.value })}>
              <option value="">Select tenant</option>
              {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Month</label>
              <input className="input" type="month" required value={manualForm.month} onChange={(e) => setManualForm({ ...manualForm, month: e.target.value })} />
            </div>
            <div>
              <label className="label">Due Date</label>
              <input className="input" type="date" required value={manualForm.due_date} onChange={(e) => setManualForm({ ...manualForm, due_date: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Rent Amount (₹)</label>
            <input className="input" type="number" min={0} required value={manualForm.rent_amount} onChange={(e) => setManualForm({ ...manualForm, rent_amount: e.target.value })} />
          </div>
          <p className="text-xs text-gray-400">You can add utility line items after creating the bill from the bills list (edit not yet wired — use monthly generation for line items).</p>
          <button className="btn-primary w-full" disabled={manualSaving}>{manualSaving ? 'Creating…' : 'Create Bill'}</button>
        </form>
      </Modal>

      <Modal open={payOpen} onClose={() => setPayOpen(false)} title={`Record Payment — ${payBill?.bill_number || ''}`}>
        <form onSubmit={handlePay} className="space-y-4">
          {payBill && <p className="text-sm text-gray-500">Outstanding balance: <span className="font-semibold text-gray-900">{fmt(payBill.total_amount - payBill.amount_paid)}</span></p>}
          <div>
            <label className="label">Amount (₹)</label>
            <input className="input" type="number" step="0.01" min={0.01} required value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
          </div>
          <div>
            <label className="label">Method</label>
            <select className="input" value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
              <option value="cash">Cash</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="upi">UPI</option>
              <option value="cheque">Cheque</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="label">Note (optional)</label>
            <input className="input" value={payNote} onChange={(e) => setPayNote(e.target.value)} />
          </div>
          <button className="btn-primary w-full" disabled={paying}>{paying ? 'Recording…' : 'Record Payment'}</button>
        </form>
      </Modal>
    </div>
  )
}
