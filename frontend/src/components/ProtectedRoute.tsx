import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import type { Role } from '../api/types'

export default function ProtectedRoute({
  children,
  role,
}: {
  children: React.ReactNode
  role?: Role
}) {
  const { user } = useAuth()

  if (!user) {
    return <Navigate to="/login" replace />
  }
  if (role && user.role !== role) {
    return <Navigate to={user.role === 'owner' ? '/owner' : '/tenant'} replace />
  }
  return <>{children}</>
}
