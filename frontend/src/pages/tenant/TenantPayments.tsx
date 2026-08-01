import { useEffect, useState } from 'react'
import api, { apiErrorMessage } from '../../api/client'
import type { Payment } from '../../api/types'
import { Spinner, ErrorBanner, EmptyState } from '../../components/Common'

export default function TenantPayments() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/api/payments').then((res) => setPayments(res.data)).catch((e) => setError(apiErrorMessage(e))).finally(() => setLoading(false))
  }, [])

  const downloadReceipt = async (p: Payment) => {
    const res = await api.get(`/api/payments/${p.id}/receipt.pdf`, { responseType: 'blob' })
    const url = window.URL.createObjectURL(new Blob([res.data]))
    const a = document.createElement('a')
    a.href = url
    a.download = `${p.receipt_number}.pdf`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Payment History</h1>

      <ErrorBanner message={error} />

      {loading ? (
        <Spinner />
      ) : payments.length === 0 ? (
        <EmptyState title="No payments yet" />
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-200">
                <th className="px-4 py-3">Receipt #</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3 font-mono text-xs">{p.receipt_number}</td>
                  <td className="px-4 py-3 text-gray-500">{p.paid_on}</td>
                  <td className="px-4 py-3 capitalize">{p.method.replace('_', ' ')}</td>
                  <td className="px-4 py-3 font-medium text-green-600">{fmt(p.amount)}</td>
                  <td className="px-4 py-3">
                    <button className="btn-secondary text-xs" onClick={() => downloadReceipt(p)}>Receipt PDF</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
