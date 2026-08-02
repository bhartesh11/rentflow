import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Layout from '../components/Layout';
import ProtectedRoute from '../components/ProtectedRoute';
import api from '../lib/api';

const emptyForm = { name: '', address: '', city: '', state: '', pincode: '', description: '', numberOfRooms: '' };

const PropertiesContent = () => {
  const [properties, setProperties] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    try {
      const { data } = await api.get('/properties');
      setProperties(data.properties);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await api.post('/properties', form);
      setForm(emptyForm);
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this property? It must have no rooms.')) return;
    try {
      await api.delete(`/properties/${id}`);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Properties</h1>
          <p className="text-gray-600 mt-2">Manage the properties you own</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
        >
          {showForm ? 'Cancel' : '+ Add Property'}
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-3">
          {error}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 mb-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          <input name="name" placeholder="Property name" value={form.name} onChange={handleChange} required
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <input name="address" placeholder="Address" value={form.address} onChange={handleChange} required
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <input name="city" placeholder="City" value={form.city} onChange={handleChange} required
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <input name="state" placeholder="State" value={form.state} onChange={handleChange} required
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <input name="pincode" placeholder="Pincode" value={form.pincode} onChange={handleChange} required
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <input name="description" placeholder="Description (optional)" value={form.description} onChange={handleChange}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <div className="md:col-span-2">
            <input name="numberOfRooms" type="number" min="0" max="500" placeholder="Number of rooms (optional)"
              value={form.numberOfRooms} onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <p className="text-xs text-gray-500 mt-1">
              If set, we'll auto-create that many rooms (numbered 101, 102, ...) so you can just edit rent/capacity afterwards instead of adding each one by hand.
            </p>
          </div>
          <button type="submit" disabled={submitting}
            className="md:col-span-2 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50">
            {submitting ? 'Saving...' : 'Save Property'}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-gray-500">Loading properties...</p>
      ) : properties.length === 0 ? (
        <p className="text-gray-500">No properties yet. Add your first one above.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {properties.map((p) => (
            <div key={p.id} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-start justify-between">
                <h3 className="text-lg font-semibold text-gray-900">{p.name}</h3>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                  {p.status}
                </span>
              </div>
              <p className="text-gray-600 text-sm mt-1">{p.address}, {p.city}, {p.state} {p.pincode}</p>
              <p className="text-gray-500 text-sm mt-2">{p.rooms?.length || 0} room(s)</p>
              <div className="flex items-center gap-4 mt-4">
                <Link href={`/rooms?propertyId=${p.id}`} className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                  View Rooms
                </Link>
                <button onClick={() => handleDelete(p.id)} className="text-red-600 hover:text-red-800 text-sm font-medium">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
};

const PropertiesPage = () => (
  <ProtectedRoute role="OWNER">
    <Layout title="Properties - Rental Management System">
      <PropertiesContent />
    </Layout>
  </ProtectedRoute>
);

export default PropertiesPage;
