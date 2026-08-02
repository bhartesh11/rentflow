import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import ProtectedRoute from '../components/ProtectedRoute';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';

const StatCard = ({ label, value }) => (
  <div className="bg-white rounded-lg shadow p-6">
    <h3 className="text-gray-500 text-sm font-medium">{label}</h3>
    <p className="text-3xl font-bold mt-2">{value}</p>
  </div>
);

const OwnerDashboard = () => {
  const [stats, setStats] = useState(null);
  const [recentPayments, setRecentPayments] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/dashboard/stats');
        setStats(data.stats);
        setRecentPayments(data.recentPayments);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <p className="text-gray-500">Loading dashboard...</p>;
  if (error) return <p className="text-red-600">{error}</p>;

  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-2">Welcome to your rental management dashboard</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard label="Total Properties" value={stats.totalProperties} />
        <StatCard label="Total Rooms" value={stats.totalRooms} />
        <StatCard label="Occupied Rooms" value={`${stats.occupiedRooms} / ${stats.totalRooms}`} />
        <StatCard label="Active Tenants" value={stats.totalTenants} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard label="Vacant Rooms" value={stats.vacantRooms} />
        <StatCard label="Pending Applications" value={stats.pendingTenants} />
        <StatCard label="Open Requests" value={stats.openRequests} />
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Revenue This Month</h3>
        <p className="text-3xl font-bold text-green-600">₹{stats.monthlyRevenue.toLocaleString('en-IN')}</p>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Recent Payments</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tenant</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Room</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Method</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {recentPayments.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                    No payments recorded yet.
                  </td>
                </tr>
              )}
              {recentPayments.map((p) => (
                <tr key={p.id}>
                  <td className="px-6 py-4 whitespace-nowrap">{p.tenant?.fullName}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{p.bill?.room?.roomNumber || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap">₹{p.amount.toLocaleString('en-IN')}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{new Date(p.paymentDate).toLocaleDateString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{p.paymentMethod}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};

const TenantDashboard = () => {
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

  if (loading) return <p className="text-gray-500">Loading your dashboard...</p>;
  if (error) return <p className="text-red-600">{error}</p>;

  const pending = bills.filter((b) => b.paymentStatus !== 'PAID');

  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">My Dashboard</h1>
        <p className="text-gray-600 mt-2">Your bills and payment status</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <StatCard label="Total Bills" value={bills.length} />
        <StatCard label="Pending Bills" value={pending.length} />
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Your Bills</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Month</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {bills.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                    No bills yet.
                  </td>
                </tr>
              )}
              {bills.map((b) => (
                <tr key={b.id}>
                  <td className="px-6 py-4 whitespace-nowrap">{b.invoiceNumber}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {new Date(b.billingMonth).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">₹{b.totalAmount.toLocaleString('en-IN')}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{new Date(b.dueDate).toLocaleDateString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        b.paymentStatus === 'PAID'
                          ? 'bg-green-100 text-green-800'
                          : b.paymentStatus === 'OVERDUE'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {b.paymentStatus}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};

const DashboardPage = () => {
  const { user } = useAuth();
  return (
    <ProtectedRoute>
      <Layout title="Dashboard - Rental Management System">
        {user?.role === 'OWNER' ? <OwnerDashboard /> : <TenantDashboard />}
      </Layout>
    </ProtectedRoute>
  );
};

export default DashboardPage;
