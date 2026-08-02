import { useEffect, useState } from 'react'
import api, { apiErrorMessage } from '../../api/client'
import type { Tenant, Room } from '../../api/types'
import { Spinner, ErrorBanner, EmptyState, StatusBadge, Modal } from '../../components/Common'

const emptyForm = {
  name: '', email: '', phone: '', room_id: '', move_in_date: '',
  id_proof_type: '', id_proof_number: '', address: '', security_deposit: '0', set_password: '',
}

export default function Tenants() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Tenant | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState<'all' | 'active' | 'vacated'>('active')

  const load = () => {
    setLoading(true)
    Promise.all([api.get('/api/tenants'), api.get('/api/rooms')])
      .then(([t, r]) => { setTenants(t.data); setRooms(r.data) })
      .catch((e) => setError(apiErrorMessage(e)))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  const openEdit = (t: Tenant) => {
    setEditing(t)
    setForm({
      name: t.name, email: t.email, phone: t.phone, room_id: t.room_id || '',
      move_in_date: t.move_in_date || '', id_proof_type: t.id_proof_type || '',
      id_proof_number: t.id_proof_number || '', address: t.address || '',
      security_deposit: String(t.security_deposit || 0), set_password: '',
    })
    setModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      if (editing) {
        await api.put(`/api/tenants/${editing.id}`, {
          name: form.name, phone: form.phone, room_id: form.room_id || undefined,
          id_proof_type: form.id_proof_type || undefined, id_proof_number: form.id_proof_number || undefined,
          address: form.address || undefined, security_deposit: parseFloat(form.security_deposit || '0'),
        })
      } else {
        await api.post('/api/tenants', {
          name: form.name, email: form.email, phone: form.phone,
          room_id: form.room_id || undefined, move_in_date: form.move_in_date || undefined,
          id_proof_type: form.id_proof_type || undefined, id_proof_number: form.id_proof_number || undefined,
          address: form.address || undefined, security_deposit: parseFloat(form.security_deposit || '0'),
          set_password: form.set_password || undefined,
        })
      }
      setModalOpen(false)
      load()
    } catch (err) {
      setError(apiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const markVacated = async (t: Tenant) => {
    if (!confirm(`Mark ${t.name} as vacated?`)) return
    try {
      await api.put(`/api/tenants/${t.id}`, { status: 'vacated', move_out_date: new Date().toISOString().slice(0, 10) })
      load()
    } catch (err) {
      alert(apiErrorMessage(err))
    }
  }

  const handleDelete = async (t: Tenant) => {
    if (!confirm(`Permanently delete ${t.name}? This removes their login and records.`)) return
    try {
      await api.delete(`/api/tenants/${t.id}`)
      load()
    } catch (err) {
      alert(apiErrorMessage(err))
    }
  }

  const visible = tenants.filter((t) => filter === 'all' || t.status === filter)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tenants</h1>
          <p className="text-gray-500 text-sm">Manage tenant profiles and room assignments</p>
        </div>
        <button className="btn-primary" onClick={openCreate}>+ Add Tenant</button>
      </div>

      <div className="flex gap-2">
        {(['active', 'vacated', 'all'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`btn-secondary text-xs ${filter === f ? 'bg-brand-600 text-white border-brand-600' : ''}`}>
            {f[0].toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <ErrorBanner message={error} />

      {loading ? (
        <Spinner />
      ) : visible.length === 0 ? (
        <EmptyState title="No tenants found" subtitle="Add a tenant to get started" />
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-200">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Room</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Deposit</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((t) => (
                <tr key={t.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-gray-900">{t.name}</td>
                  <td className="px-4 py-3 text-gray-500">{t.email}<br /><span className="text-xs">{t.phone}</span></td>
                  <td className="px-4 py-3">{t.room_name || <span className="text-gray-400">Unassigned</span>}</td>
                  <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                  <td className="px-4 py-3">₹{(t.security_deposit || 0).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end">
                      <button className="btn-secondary text-xs" onClick={() => openEdit(t)}>Edit</button>
                      {t.status === 'active' && (
                        <button className="btn-secondary text-xs" onClick={() => markVacated(t)}>Mark Vacated</button>
                      )}
                      <button className="btn-danger text-xs" onClick={() => handleDelete(t)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Tenant' : 'Add Tenant'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Full Name</label>
              <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" required disabled={!!editing} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Room</label>
              <select className="input" value={form.room_id} onChange={(e) => setForm({ ...form, room_id: e.target.value })}>
                <option value="">Unassigned</option>
                {rooms.map((r) => <option key={r.id} value={r.id}>{r.name} (₹{r.monthly_rent})</option>)}
              </select>
            </div>
            <div>
              <label className="label">Security Deposit (₹)</label>
              <input className="input" type="number" min={0} value={form.security_deposit} onChange={(e) => setForm({ ...form, security_deposit: e.target.value })} />
            </div>
          </div>
          {!editing && (
            <div>
              <label className="label">Move-in Date</label>
              <input className="input" type="date" value={form.move_in_date} onChange={(e) => setForm({ ...form, move_in_date: e.target.value })} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">ID Proof Type</label>
              <input className="input" placeholder="Aadhaar / Passport" value={form.id_proof_type} onChange={(e) => setForm({ ...form, id_proof_type: e.target.value })} />
            </div>
            <div>
              <label className="label">ID Proof Number</label>
              <input className="input" value={form.id_proof_number} onChange={(e) => setForm({ ...form, id_proof_number: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Address</label>
            <textarea className="input" rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          {!editing && (
            <div>
              <label className="label">Set Login Password (optional)</label>
              <input className="input" type="password" value={form.set_password} onChange={(e) => setForm({ ...form, set_password: e.target.value })} placeholder="Leave blank — tenant can self-register via Join" />
            </div>
          )}
          <button className="btn-primary w-full" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Tenant'}</button>
        </form>
      </Modal>
    </div>
  )
}
