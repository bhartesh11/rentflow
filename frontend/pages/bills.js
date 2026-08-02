import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import ProtectedRoute from '../components/ProtectedRoute';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';

const statusStyles = {
  PAID: 'bg-green-100 text-green-800',
  PARTIAL: 'bg-blue-100 text-blue-800',
  PENDING: 'bg-yellow-100 text-yellow-800',
  OVERDUE: 'bg-red-100 text-red-800',
};

const emptyBillForm = {
  tenantId: '',
  roomId: '',
  billingMonth: '',
  rent: '',
  electricityCharges: '',
  waterCharges: '',
  maintenance: '',
  otherCharges: '',
  discounts: '',
  previousDue: '',
  dueDate: '',
  meterReadingId: '',
};

const OwnerBills = () => {
  const [bills, setBills] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [form, setForm] = useState(emptyBillForm);
  const [showForm, setShowForm] = useState(false);
  const [payingBillId, setPayingBillId] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [unbilledReadings, setUnbilledReadings] = useState([]);

  const load = async () => {
    try {
      const [billsRes, tenantsRes] = await Promise.all([
        api.get('/bills'),
        api.get('/tenants', { params: { status: 'ACTIVE' } }),
      ]);
      setBills(billsRes.data.bills);
      setTenants(tenantsRes.data.tenants.filter((t) => t.assignedRoomId));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleTenantSelect = async (e) => {
    const tenantId = e.target.value;
    const tenant = tenants.find((t) => t.id === tenantId);
    const roomId = tenant?.assignedRoomId || '';
    setForm((prev) => ({
      ...prev,
      tenantId,
      roomId,
      rent: tenant?.assignedRoom?.rentAmount ?? prev.rent,
      meterReadingId: '',
    }));
    setUnbilledReadings([]);
    if (roomId) {
      try {
        const { data } = await api.get(`/rooms/${roomId}/meter-readings`, { params: { billed: 'false' } });
        setUnbilledReadings(data.meterReadings);
      } catch (err) {
        // Non-fatal - owner can still enter electricity charges manually
      }
    }
  };

  const handleMeterReadingSelect = (e) => {
    const meterReadingId = e.target.value;
    const reading = unbilledReadings.find((r) => r.id === meterReadingId);
    setForm((prev) => ({
      ...prev,
      meterReadingId,
      electricityCharges: reading ? reading.amount : prev.electricityCharges,
    }));
  };

  const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await api.post('/bills', form);
      setForm(emptyBillForm);
      setUnbilledReadings([]);
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecordPayment = async (billId) => {
    if (!paymentAmount) return;
    try {
      const bill = bills.find((b) => b.id === billId);
      await api.post('/payments', {
        tenantId: bill.tenantId,
        billId,
        amount: Number(paymentAmount),
        paymentMethod,
      });
      setPayingBillId(null);
      setPaymentAmount('');
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this bill?')) return;
    try {
      await api.delete(`/bills/${id}`);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDownloadPdf = async (bill) => {
    try {
      const { data } = await api.get(`/bills/${bill.id}/pdf`, { responseType: 'blob' });
      const blob = new Blob([data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${bill.invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || 'Could not download PDF');
    }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Bills</h1>
          <p className="text-gray-600 mt-2">Generate bills and record payments</p>
        </div>
        <button onClick={() => setShowForm((v) => !v)} className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700">
          {showForm ? 'Cancel' : '+ Generate Bill'}
        </button>
      </div>

      {error && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-3">{error}</div>}

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 mb-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <select value={form.tenantId} onChange={handleTenantSelect} required
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Select tenant</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>{t.fullName} - {t.assignedRoom?.roomNumber}</option>
            ))}
          </select>
          <input type="month" name="billingMonth" value={form.billingMonth} onChange={handleChange} required
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Billing month" />
          <input type="date" name="dueDate" value={form.dueDate} onChange={handleChange} required
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Due date" />
          <input type="number" name="rent" placeholder="Rent (₹)" value={form.rent} onChange={handleChange} required
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          {unbilledReadings.length > 0 && (
            <select value={form.meterReadingId} onChange={handleMeterReadingSelect}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Enter electricity manually</option>
              {unbilledReadings.map((r) => (
                <option key={r.id} value={r.id}>
                  {new Date(r.readingMonth).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })} - {r.unitsConsumed} units = ₹{r.amount}
                </option>
              ))}
            </select>
          )}
          <input type="number" name="electricityCharges" placeholder="Electricity (₹)" value={form.electricityCharges} onChange={handleChange}
            readOnly={!!form.meterReadingId}
            className={`px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${form.meterReadingId ? 'bg-gray-100' : ''}`} />
          <input type="number" name="waterCharges" placeholder="Water (₹)" value={form.waterCharges} onChange={handleChange}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <input type="number" name="maintenance" placeholder="Maintenance (₹)" value={form.maintenance} onChange={handleChange}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <input type="number" name="otherCharges" placeholder="Other charges (₹)" value={form.otherCharges} onChange={handleChange}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <input type="number" name="discounts" placeholder="Discounts (₹)" value={form.discounts} onChange={handleChange}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <input type="number" name="previousDue" placeholder="Previous due (₹)" value={form.previousDue} onChange={handleChange}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <button type="submit" disabled={submitting}
            className="md:col-span-3 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50">
            {submitting ? 'Generating...' : 'Generate Bill'}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-gray-500">Loading bills...</p>
      ) : bills.length === 0 ? (
        <p className="text-gray-500">No bills yet. Generate one above.</p>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tenant</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Room</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {bills.map((b) => (
                <tr key={b.id}>
                  <td className="px-6 py-4 whitespace-nowrap">{b.invoiceNumber}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{b.tenant?.fullName}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{b.room?.roomNumber}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    ₹{b.totalAmount.toLocaleString('en-IN')}
                    {b.meterReading && (
                      <div className="text-xs text-gray-500">
                        ⚡ {b.meterReading.unitsConsumed} units @ ₹{b.meterReading.ratePerUnit}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">{new Date(b.dueDate).toLocaleDateString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusStyles[b.paymentStatus]}`}>
                      {b.paymentStatus}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm space-x-3">
                    {b.paymentStatus !== 'PAID' && (
                      payingBillId === b.id ? (
                        <span className="inline-flex items-center gap-2">
                          <input type="number" placeholder="Amount" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)}
                            className="w-20 border border-gray-300 rounded-md px-2 py-1 text-sm" />
                          <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}
                            className="border border-gray-300 rounded-md px-2 py-1 text-sm">
                            <option value="CASH">Cash</option>
                            <option value="UPI">UPI</option>
                            <option value="BANK_TRANSFER">Bank Transfer</option>
                            <option value="CARD">Card</option>
                          </select>
                          <button onClick={() => handleRecordPayment(b.id)} className="text-green-600 hover:text-green-800">Save</button>
                          <button onClick={() => setPayingBillId(null)} className="text-gray-500 hover:text-gray-700">Cancel</button>
                        </span>
                      ) : (
                        <button onClick={() => setPayingBillId(b.id)} className="text-green-600 hover:text-green-800">Record Payment</button>
                      )
                    )}
                    <button onClick={() => handleDownloadPdf(b)} className="text-blue-600 hover:text-blue-800">PDF</button>
                    <button onClick={() => handleDelete(b.id)} className="text-red-600 hover:text-red-800">Delete</button>
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

const TenantBills = () => {
  const [bills, setBills] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/bills');
        setBills(data.bills);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleDownloadPdf = async (bill) => {
    try {
      const { data } = await api.get(`/bills/${bill.id}/pdf`, { responseType: 'blob' });
      const blob = new Blob([data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${bill.invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || 'Could not download PDF');
    }
  };

  if (loading) return <p className="text-gray-500">Loading your bills...</p>;
  if (error) return <p className="text-red-600">{error}</p>;

  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">My Bills</h1>
        <p className="text-gray-600 mt-2">Your billing history and payment status</p>
      </div>
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Month</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {bills.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-gray-500">No bills yet.</td>
              </tr>
            )}
            {bills.map((b) => (
              <tr key={b.id}>
                <td className="px-6 py-4 whitespace-nowrap">{b.invoiceNumber}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {new Date(b.billingMonth).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  ₹{b.totalAmount.toLocaleString('en-IN')}
                  {b.meterReading && (
                    <div className="text-xs text-gray-500">
                      ⚡ {b.meterReading.unitsConsumed} units @ ₹{b.meterReading.ratePerUnit} (meter: {b.meterReading.previousReading} → {b.meterReading.currentReading})
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">{new Date(b.dueDate).toLocaleDateString()}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusStyles[b.paymentStatus]}`}>
                    {b.paymentStatus}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <button onClick={() => handleDownloadPdf(b)} className="text-blue-600 hover:text-blue-800">PDF</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};

const BillsPage = () => {
  const { user } = useAuth();
  return (
    <ProtectedRoute>
      <Layout title="Bills - Rental Management System">
        {user?.role === 'OWNER' ? <OwnerBills /> : <TenantBills />}
      </Layout>
    </ProtectedRoute>
  );
};

export default BillsPage;
