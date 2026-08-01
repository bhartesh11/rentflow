import { useEffect, useState } from 'react'
import api, { apiErrorMessage } from '../../api/client'
import type { MaintenanceRequest } from '../../api/types'
import { Spinner, ErrorBanner, EmptyState, StatusBadge } from '../../components/Common'

export default function Requests() {
  const [requests, setRequests] = useState<MaintenanceRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = () => {
    setLoading(true)
    api.get('/api/requests').then((res) => setRequests(res.data)).catch((e) => setError(apiErrorMessage(e))).finally(() => setLoading(false))
  }
  useEffect(load, [])

  const updateStatus = async (r: MaintenanceRequest, status: string) => {
    try {
      await api.put(`/api/requests/${r.id}`, { status })
      load()
    } catch (err) {
      alert(apiErrorMessage(err))
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Maintenance Requests</h1>
        <p className="text-gray-500 text-sm">Requests raised by tenants</p>
      </div>

      <ErrorBanner message={error} />

      {loading ? (
        <Spinner />
      ) : requests.length === 0 ? (
        <EmptyState title="No requests yet" />
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <div key={r.id} className="card">
              <div className="flex items-start justify-between flex-wrap gap-2">
                <div>
                  <h3 className="font-semibold text-gray-900">{r.title}</h3>
                  <p className="text-xs text-gray-400">{r.tenant_name} · {r.category} · {new Date(r.created_at).toLocaleDateString()}</p>
                </div>
                <StatusBadge status={r.status} />
              </div>
              <p className="text-sm text-gray-600 mt-2">{r.description}</p>
              {r.status !== 'resolved' && (
                <div className="flex gap-2 mt-3">
                  {r.status === 'open' && (
                    <button className="btn-secondary text-xs" onClick={() => updateStatus(r, 'in_progress')}>Mark In Progress</button>
                  )}
                  <button className="btn-primary text-xs" onClick={() => updateStatus(r, 'resolved')}>Mark Resolved</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
