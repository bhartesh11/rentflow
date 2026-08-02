import { NavLink, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

const ownerLinks = [
  { to: '/owner', label: 'Dashboard', end: true },
  { to: '/owner/rooms', label: 'Rooms' },
  { to: '/owner/tenants', label: 'Tenants' },
  { to: '/owner/bills', label: 'Bills' },
  { to: '/owner/payments', label: 'Payments' },
  { to: '/owner/requests', label: 'Requests' },
]

const tenantLinks = [
  { to: '/tenant', label: 'My Bills', end: true },
  { to: '/tenant/payments', label: 'Payment History' },
  { to: '/tenant/requests', label: 'Requests' },
]

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  if (!user) return null
  const links = user.role === 'owner' ? ownerLinks : tenantLinks

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-2 rounded-lg text-sm font-medium ${
      isActive ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-gray-100'
    }`

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-20">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <span className="text-xl font-bold text-brand-600">RentFlow</span>
            <div className="hidden md:flex gap-1">
              {links.map((l) => (
                <NavLink key={l.to} to={l.to} end={l.end} className={linkClass}>
                  {l.label}
                </NavLink>
              ))}
            </div>
          </div>
          <div className="hidden md:flex items-center gap-3">
            <span className="text-sm text-gray-500">{user.name} ({user.role})</span>
            <button onClick={handleLogout} className="btn-secondary">Logout</button>
          </div>
          <button className="md:hidden btn-secondary" onClick={() => setOpen(!open)}>
            Menu
          </button>
        </div>
        {open && (
          <div className="md:hidden pb-4 flex flex-col gap-1">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className={linkClass} onClick={() => setOpen(false)}>
                {l.label}
              </NavLink>
            ))}
            <button onClick={handleLogout} className="btn-secondary mt-2">Logout</button>
          </div>
        )}
      </div>
    </nav>
  )
}
