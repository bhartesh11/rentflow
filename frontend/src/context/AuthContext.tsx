import React, { createContext, useContext, useState, useCallback } from 'react'
import api from '../api/client'
import type { AuthUser } from '../api/types'

interface AuthContextValue {
  user: AuthUser | null
  login: (email: string, password: string) => Promise<AuthUser>
  register: (data: { name: string; email: string; password: string; phone: string; invite_code: string }) => Promise<AuthUser>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const raw = localStorage.getItem('rentflow_user')
    return raw ? JSON.parse(raw) : null
  })

  const persist = (token: string, authUser: AuthUser) => {
    localStorage.setItem('rentflow_token', token)
    localStorage.setItem('rentflow_user', JSON.stringify(authUser))
    setUser(authUser)
  }

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post('/api/auth/login', { email, password })
    const authUser: AuthUser = {
      user_id: res.data.user_id,
      name: res.data.name,
      role: res.data.role,
      tenant_id: res.data.tenant_id,
    }
    persist(res.data.access_token, authUser)
    return authUser
  }, [])

  const register = useCallback(async (data: { name: string; email: string; password: string; phone: string; invite_code: string }) => {
    const res = await api.post('/api/auth/register', data)
    const authUser: AuthUser = {
      user_id: res.data.user_id,
      name: res.data.name,
      role: res.data.role,
      tenant_id: res.data.tenant_id,
    }
    persist(res.data.access_token, authUser)
    return authUser
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('rentflow_token')
    localStorage.removeItem('rentflow_user')
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
