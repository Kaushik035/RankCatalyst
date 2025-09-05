import { Navigate } from 'react-router-dom'
import { useAuthStore } from './store'
import { ReactNode } from 'react'

export function ProtectedRoute({ children }: { children: ReactNode }) {
    const access = useAuthStore((s) => s.accessToken)
    if (!access) return <Navigate to="/login" replace />
    return <>{children}</>
}

export function GuestRoute({ children }: { children: ReactNode }) {
    const access = useAuthStore((s) => s.accessToken)
    if (access) return <Navigate to="/dashboard" replace />
    return <>{children}</>
}
