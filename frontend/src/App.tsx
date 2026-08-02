import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Navbar from './components/Navbar'
import ProtectedRoute from './components/ProtectedRoute'

import Login from './pages/Login'
import Join from './pages/Join'

import OwnerDashboard from './pages/owner/Dashboard'
import OwnerRooms from './pages/owner/Rooms'
import OwnerTenants from './pages/owner/Tenants'
import OwnerBills from './pages/owner/Bills'
import OwnerPayments from './pages/owner/Payments'
import OwnerRequests from './pages/owner/Requests'

import TenantBills from './pages/tenant/TenantBills'
import TenantPayments from './pages/tenant/TenantPayments'
import TenantRequests from './pages/tenant/TenantRequests'

function HomeRedirect() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return <Navigate to={user.role === 'owner' ? '/owner' : '/tenant'} replace />
}

export default function App() {
  const { user } = useAuth()
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-6">
        <Routes>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/login" element={user ? <HomeRedirect /> : <Login />} />
          <Route path="/join" element={user ? <HomeRedirect /> : <Join />} />

          <Route path="/owner" element={<ProtectedRoute role="owner"><OwnerDashboard /></ProtectedRoute>} />
          <Route path="/owner/rooms" element={<ProtectedRoute role="owner"><OwnerRooms /></ProtectedRoute>} />
          <Route path="/owner/tenants" element={<ProtectedRoute role="owner"><OwnerTenants /></ProtectedRoute>} />
          <Route path="/owner/bills" element={<ProtectedRoute role="owner"><OwnerBills /></ProtectedRoute>} />
          <Route path="/owner/payments" element={<ProtectedRoute role="owner"><OwnerPayments /></ProtectedRoute>} />
          <Route path="/owner/requests" element={<ProtectedRoute role="owner"><OwnerRequests /></ProtectedRoute>} />

          <Route path="/tenant" element={<ProtectedRoute role="tenant"><TenantBills /></ProtectedRoute>} />
          <Route path="/tenant/payments" element={<ProtectedRoute role="tenant"><TenantPayments /></ProtectedRoute>} />
          <Route path="/tenant/requests" element={<ProtectedRoute role="tenant"><TenantRequests /></ProtectedRoute>} />

          <Route path="*" element={<HomeRedirect />} />
        </Routes>
      </main>
    </div>
  )
}
