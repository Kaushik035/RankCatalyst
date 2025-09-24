import { Routes, Route, Link, useNavigate } from 'react-router-dom'
import { Suspense } from 'react'
import RoutesIndex from './routes'
import { useAuthStore } from './features/auth/store'

export default function App() {
    const { accessToken, user, logout } = useAuthStore()
    const navigate = useNavigate()
    const isAuthenticated = !!accessToken

    const handleLogout = async () => {
        await logout()
        navigate('/')
    }

    return (
        <div className="min-h-screen">
            <header className="border-b border-neutral-800">
                <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
                    <Link to="/" className="font-semibold text-lg">RankCatalyst</Link>
                    <nav className="flex items-center gap-4 text-sm">
                        {isAuthenticated ? (
                            <>
                                <span className="text-neutral-300">
                                    Welcome, {user?.profile?.display_name || user?.email}
                                </span>
                                <Link to="/dashboard" className="text-neutral-300 hover:text-white">Dashboard</Link>
                                <button 
                                    onClick={handleLogout}
                                    className="px-3 py-1 rounded bg-red-600 hover:bg-red-700 text-white"
                                >
                                    Logout
                                </button>
                            </>
                        ) : (
                            <>
                                <Link to="/login" className="text-neutral-300 hover:text-white">Login</Link>
                                <Link to="/register" className="px-3 py-1 rounded bg-brand-600 hover:bg-brand-700">Sign up</Link>
                            </>
                        )}
                    </nav>
                </div>
            </header>
            <Suspense fallback={<div className="p-8">Loading...</div>}>
                <RoutesIndex />
            </Suspense>
        </div>
    )
}
