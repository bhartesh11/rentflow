import { useEffect, useState } from 'react'
import api, { apiErrorMessage } from '../../api/client'
import type { MaintenanceRequest } from '../../api/types'
import { Spinner, ErrorBanner, EmptyState, StatusBadge, Modal } from '../../components/Common'

export default function TenantRequests() {
  const [requests, setRequests] = useState<MaintenanceRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', category: 'general' })
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    api.get('/api/requests').then((res) => setRequests(res.data)).catch((e) => setError(apiErrorMessage(e))).finally(() => setLoading(false))
  }
  useEffect(load, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await api.post('/api/requests', form)
      setForm({ title: '', description: '', category: 'general' })
      setModalOpen(false)
      load()
    } catch (err) {
      setError(apiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Requests</h1>
        <button className="btn-primary" onClick={() => setModalOpen(true)}>+ New Request</button>
      </div>

      <ErrorBanner message={error} />

      {loading ? (
        <Spinner />
      ) : requests.length === 0 ? (
        <EmptyState title="No requests yet" subtitle="Raise a request if something needs attention" />
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <div key={r.id} className="card">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{r.title}</h3>
                  <p className="text-xs text-gray-400">{r.category} · {new Date(r.created_at).toLocaleDateString()}</p>
                </div>
                <StatusBadge status={r.status} />
              </div>
              <p className="text-sm text-gray-600 mt-2">{r.description}</p>
              {r.owner_note && (
                <div className="mt-2 text-sm bg-gray-50 rounded-lg px-3 py-2 text-gray-600">
                  <span className="font-medium text-gray-700">Owner note: </span>{r.owner_note}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Raise a Request">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Title</label>
            <input className="input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Leaking tap" />
          </div>
          <div>
            <label className="label">Category</label>
            <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              <option value="general">General</option>
              <option value="plumbing">Plumbing</option>
              <option value="electrical">Electrical</option>
              <option value="cleaning">Cleaning</option>
              <option value="internet">Internet</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input" rows={4} required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <button className="btn-primary w-full" disabled={saving}>{saving ? 'Submitting…' : 'Submit Request'}</button>
        </form>
      </Modal>
    </div>
  )
}
