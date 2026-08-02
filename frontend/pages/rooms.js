import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import ProtectedRoute from '../components/ProtectedRoute';
import api from '../lib/api';

const emptyForm = { propertyId: '', roomNumber: '', floor: '', rentAmount: '', depositAmount: '', capacity: '1', notes: '' };

const RoomsContent = () => {
  const router = useRouter();
  const { propertyId: propertyIdFromQuery } = router.query;

  const [rooms, setRooms] = useState([]);
  const [properties, setProperties] = useState([]);
  const [pendingTenants, setPendingTenants] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [assigningRoomId, setAssigningRoomId] = useState(null);
  const [selectedTenant, setSelectedTenant] = useState('');
  const [assignOccupants, setAssignOccupants] = useState('1');
  const [assignInitialReading, setAssignInitialReading] = useState('');
  const [readingRoomId, setReadingRoomId] = useState(null);
  const [readingForm, setReadingForm] = useState({ currentReading: '', ratePerUnit: '', readingMonth: '' });
  const [lastReadings, setLastReadings] = useState({}); // roomId -> most recent MeterReading

  const load = async () => {
    try {
      const [roomsRes, propsRes, tenantsRes] = await Promise.all([
        api.get('/rooms', { params: propertyIdFromQuery ? { propertyId: propertyIdFromQuery } : {} }),
        api.get('/properties'),
        api.get('/tenants', { params: { status: 'ACTIVE' } }),
      ]);
      setRooms(roomsRes.data.rooms);
      setProperties(propsRes.data.properties);
      // Tenants without a room yet
      setPendingTenants(tenantsRes.data.tenants.filter((t) => !t.assignedRoomId));

      // Pull the most recent meter reading for each occupied room, so the table
      // can show "last reading" and pre-fill the previous reading on the next entry.
      const occupied = roomsRes.data.rooms.filter((r) => r.occupancyStatus === 'OCCUPIED');
      const readingResults = await Promise.all(
        occupied.map((r) => api.get(`/rooms/${r.id}/meter-readings`).then((res) => [r.id, res.data.meterReadings[0] || null]))
      );
      setLastReadings(Object.fromEntries(readingResults));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    if (propertyIdFromQuery) setForm((f) => ({ ...f, propertyId: propertyIdFromQuery }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyIdFromQuery]);

  const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await api.post('/rooms', form);
      setForm({ ...emptyForm, propertyId: propertyIdFromQuery || '' });
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssign = async (roomId) => {
    if (!selectedTenant) return;
    try {
      await api.post(`/rooms/${roomId}/assign`, {
        tenantId: selectedTenant,
        occupantsCount: assignOccupants || 1,
        initialMeterReading: assignInitialReading || undefined,
      });
      setAssigningRoomId(null);
      setSelectedTenant('');
      setAssignOccupants('1');
      setAssignInitialReading('');
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleVacate = async (roomId) => {
    if (!confirm('Vacate this room?')) return;
    try {
      await api.post(`/rooms/${roomId}/vacate`);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (roomId) => {
    if (!confirm('Delete this room?')) return;
    try {
      await api.delete(`/rooms/${roomId}`);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleReadingChange = (e) => setReadingForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleAddReading = async (roomId) => {
    if (!readingForm.currentReading || !readingForm.ratePerUnit || !readingForm.readingMonth) {
      setError('Enter the current reading, rate per unit and month');
      return;
    }
    try {
      await api.post(`/rooms/${roomId}/meter-readings`, readingForm);
      setReadingRoomId(null);
      setReadingForm({ currentReading: '', ratePerUnit: '', readingMonth: '' });
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Rooms</h1>
          <p className="text-gray-600 mt-2">Manage rooms, rent, and occupancy</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
        >
          {showForm ? 'Cancel' : '+ Add Room'}
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-3">{error}</div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 mb-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          <select name="propertyId" value={form.propertyId} onChange={handleChange} required
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Select property</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <input name="roomNumber" placeholder="Room number" value={form.roomNumber} onChange={handleChange} required
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <input name="floor" placeholder="Floor (optional)" value={form.floor} onChange={handleChange}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <input name="capacity" type="number" min="1" placeholder="Capacity" value={form.capacity} onChange={handleChange} required
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <input name="rentAmount" type="number" min="0" placeholder="Monthly rent (₹)" value={form.rentAmount} onChange={handleChange} required
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <input name="depositAmount" type="number" min="0" placeholder="Deposit (₹, optional)" value={form.depositAmount} onChange={handleChange}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <input name="notes" placeholder="Notes (optional)" value={form.notes} onChange={handleChange}
            className="md:col-span-2 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <button type="submit" disabled={submitting}
            className="md:col-span-2 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50">
            {submitting ? 'Saving...' : 'Save Room'}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-gray-500">Loading rooms...</p>
      ) : rooms.length === 0 ? (
        <p className="text-gray-500">No rooms yet. Add one above.</p>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Room</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Property</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rent</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tenant</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Meter Reading</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {rooms.map((r) => (
                <tr key={r.id}>
                  <td className="px-6 py-4 whitespace-nowrap">{r.roomNumber}{r.floor ? ` (Floor ${r.floor})` : ''}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{r.property?.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap">₹{r.rentAmount.toLocaleString('en-IN')}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {r.tenant?.fullName || '-'}
                    {r.tenant && <span className="text-xs text-gray-500 ml-1">({r.tenant.occupantsCount || 1} people)</span>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {r.occupancyStatus !== 'OCCUPIED' ? (
                      '-'
                    ) : readingRoomId === r.id ? (
                      <div className="flex flex-col gap-1">
                        <input type="month" name="readingMonth" value={readingForm.readingMonth} onChange={handleReadingChange}
                          className="border border-gray-300 rounded-md px-2 py-1 text-sm" placeholder="Month" />
                        <input type="number" name="currentReading" placeholder={`Current (prev: ${lastReadings[r.id]?.currentReading ?? 0})`}
                          value={readingForm.currentReading} onChange={handleReadingChange}
                          className="border border-gray-300 rounded-md px-2 py-1 text-sm w-40" />
                        <input type="number" name="ratePerUnit" placeholder="Rate/unit (₹)" value={readingForm.ratePerUnit} onChange={handleReadingChange}
                          className="border border-gray-300 rounded-md px-2 py-1 text-sm w-40" />
                        <div className="flex gap-3">
                          <button onClick={() => handleAddReading(r.id)} className="text-green-600 hover:text-green-800">Save</button>
                          <button onClick={() => setReadingRoomId(null)} className="text-gray-500 hover:text-gray-700">Cancel</button>
                        </div>
                      </div>
                    ) : lastReadings[r.id] ? (
                      <div>
                        <div>{lastReadings[r.id].currentReading} units {lastReadings[r.id].billed ? '(billed)' : '(not billed yet)'}</div>
                        <button onClick={() => setReadingRoomId(r.id)} className="text-blue-600 hover:text-blue-800">Add reading</button>
                      </div>
                    ) : (
                      <button onClick={() => setReadingRoomId(r.id)} className="text-blue-600 hover:text-blue-800">Add reading</button>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${r.occupancyStatus === 'OCCUPIED' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'}`}>
                      {r.occupancyStatus}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm space-x-3">
                    {r.occupancyStatus === 'VACANT' ? (
                      assigningRoomId === r.id ? (
                        <span className="inline-flex flex-col gap-1 items-start">
                          <select value={selectedTenant} onChange={(e) => setSelectedTenant(e.target.value)}
                            className="border border-gray-300 rounded-md px-2 py-1 text-sm">
                            <option value="">Select tenant</option>
                            {pendingTenants.map((t) => (
                              <option key={t.id} value={t.id}>{t.fullName}</option>
                            ))}
                          </select>
                          <input type="number" min="1" max={r.capacity} value={assignOccupants}
                            onChange={(e) => setAssignOccupants(e.target.value)}
                            placeholder={`Occupants (max ${r.capacity})`}
                            className="border border-gray-300 rounded-md px-2 py-1 text-sm w-40" />
                          <input type="number" value={assignInitialReading}
                            onChange={(e) => setAssignInitialReading(e.target.value)}
                            placeholder="Move-in meter reading (optional)"
                            className="border border-gray-300 rounded-md px-2 py-1 text-sm w-48" />
                          <div className="flex gap-3">
                            <button onClick={() => handleAssign(r.id)} className="text-blue-600 hover:text-blue-800">Confirm</button>
                            <button onClick={() => { setAssigningRoomId(null); setAssignOccupants('1'); setAssignInitialReading(''); }} className="text-gray-500 hover:text-gray-700">Cancel</button>
                          </div>
                        </span>
                      ) : (
                        <button onClick={() => setAssigningRoomId(r.id)} className="text-blue-600 hover:text-blue-800">Assign Tenant</button>
                      )
                    ) : (
                      <button onClick={() => handleVacate(r.id)} className="text-yellow-600 hover:text-yellow-800">Vacate</button>
                    )}
                    <button onClick={() => handleDelete(r.id)} className="text-red-600 hover:text-red-800">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
};

const RoomsPage = () => (
  <ProtectedRoute role="OWNER">
    <Layout title="Rooms - Rental Management System">
      <RoomsContent />
    </Layout>
  </ProtectedRoute>
);

export default RoomsPage;
