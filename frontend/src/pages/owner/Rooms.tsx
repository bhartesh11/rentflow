import { useEffect, useState } from 'react'
import api, { apiErrorMessage } from '../../api/client'
import type { Room } from '../../api/types'
import { Spinner, ErrorBanner, EmptyState, StatusBadge, Modal } from '../../components/Common'

const emptyForm = { name: '', floor: '', monthly_rent: '', capacity: '1', notes: '' }

export default function Rooms() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Room | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [copiedId, setCopiedId] = useState('')

  const load = () => {
    setLoading(true)
    api.get('/api/rooms').then((res) => setRooms(res.data)).catch((e) => setError(apiErrorMessage(e))).finally(() => setLoading(false))
  }

  useEffect(load, [])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  const openEdit = (room: Room) => {
    setEditing(room)
    setForm({
      name: room.name,
      floor: room.floor || '',
      monthly_rent: String(room.monthly_rent),
      capacity: String(room.capacity),
      notes: room.notes || '',
    })
    setModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = {
        name: form.name,
        floor: form.floor || undefined,
        monthly_rent: parseFloat(form.monthly_rent),
        capacity: parseInt(form.capacity, 10),
        notes: form.notes || undefined,
      }
      if (editing) {
        await api.put(`/api/rooms/${editing.id}`, payload)
      } else {
        await api.post('/api/rooms', payload)
      }
      setModalOpen(false)
      load()
    } catch (err) {
      setError(apiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (room: Room) => {
    if (!confirm(`Delete room "${room.name}"? This cannot be undone.`)) return
    try {
      await api.delete(`/api/rooms/${room.id}`)
      load()
    } catch (err) {
      alert(apiErrorMessage(err))
    }
  }

  const copyInvite = (id: string) => {
    navigator.clipboard?.writeText(id)
    setCopiedId(id)
    setTimeout(() => setCopiedId(''), 1500)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rooms</h1>
          <p className="text-gray-500 text-sm">Manage your property's rooms and rent amounts</p>
        </div>
        <button className="btn-primary" onClick={openCreate}>+ Add Room</button>
      </div>

      <ErrorBanner message={error} />

      {loading ? (
        <Spinner />
      ) : rooms.length === 0 ? (
        <EmptyState title="No rooms yet" subtitle="Add your first room to get started" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rooms.map((room) => (
            <div key={room.id} className="card">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{room.name}</h3>
                  {room.floor && <p className="text-xs text-gray-400">Floor {room.floor}</p>}
                </div>
                <StatusBadge status={room.status} />
              </div>
              <p className="text-xl font-bold text-brand-600 mt-3">₹{room.monthly_rent.toLocaleString('en-IN')}<span className="text-sm text-gray-400 font-normal">/mo</span></p>
              <p className="text-xs text-gray-400 mt-1">Capacity: {room.capacity}</p>
              {room.notes && <p className="text-sm text-gray-500 mt-2">{room.notes}</p>}
              <div className="flex gap-2 mt-4">
                <button className="btn-secondary flex-1 text-xs" onClick={() => openEdit(room)}>Edit</button>
                <button className="btn-secondary flex-1 text-xs" onClick={() => copyInvite(room.id)}>
                  {copiedId === room.id ? 'Copied!' : 'Copy Invite Code'}
                </button>
                <button className="btn-danger text-xs" onClick={() => handleDelete(room)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Room' : 'Add Room'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Room Name</label>
            <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Room 101" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Floor</label>
              <input className="input" value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })} />
            </div>
            <div>
              <label className="label">Capacity</label>
              <input className="input" type="number" min={1} required value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Monthly Rent (₹)</label>
            <input className="input" type="number" min={0} step="0.01" required value={form.monthly_rent} onChange={(e) => setForm({ ...form, monthly_rent: e.target.value })} />
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <button className="btn-primary w-full" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Room'}</button>
        </form>
      </Modal>
    </div>
  )
}
