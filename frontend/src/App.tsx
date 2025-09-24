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
        <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-black">
            {/* Animated background pattern */}
            <div className="fixed inset-0 opacity-5">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.1),transparent_50%)]"></div>
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_25%,rgba(255,255,255,0.05),transparent_50%)]"></div>
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_75%,rgba(255,255,255,0.03),transparent_50%)]"></div>
            </div>

            <header className="relative z-10 border-b border-neutral-800/50 backdrop-blur-sm bg-black/20">
                <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
                    <Link to="/" className="group flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-amber-400 rounded-lg flex items-center justify-center">
                            <span className="text-black font-bold text-sm">R</span>
                        </div>
                        <span className="font-bold text-xl bg-gradient-to-r from-white to-neutral-300 bg-clip-text text-transparent group-hover:from-orange-400 group-hover:to-amber-300 transition-all duration-300">
                            RankCatalyst
                        </span>
                    </Link>
                    <nav className="flex items-center gap-6 text-sm">
                        {isAuthenticated ? (
                            <>
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-gradient-to-br from-neutral-700 to-neutral-800 rounded-full flex items-center justify-center">
                                        <span className="text-xs font-medium text-neutral-300">
                                            {(user?.profile?.display_name || user?.email || 'U').charAt(0).toUpperCase()}
                                        </span>
                                    </div>
                                    <span className="text-neutral-300 font-medium">
                                        {user?.profile?.display_name || user?.email}
                                    </span>
                                </div>
                                <Link 
                                    to="/dashboard" 
                                    className="px-4 py-2 rounded-lg text-neutral-300 hover:text-white hover:bg-neutral-800/50 transition-all duration-200 font-medium"
                                >
                                    Dashboard
                                </Link>
                                <Link 
                                    to="/attention/sessions" 
                                    className="px-4 py-2 rounded-lg text-neutral-300 hover:text-white hover:bg-neutral-800/50 transition-all duration-200 font-medium"
                                >
                                    Sessions
                                </Link>
                                <button 
                                    onClick={handleLogout}
                                    className="px-4 py-2 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-400 hover:text-red-300 border border-red-600/30 hover:border-red-500/50 transition-all duration-200 font-medium"
                                >
                                    Logout
                                </button>
                            </>
                        ) : (
                            <>
                                <Link 
                                    to="/login" 
                                    className="px-4 py-2 rounded-lg text-neutral-300 hover:text-white hover:bg-neutral-800/50 transition-all duration-200 font-medium"
                                >
                                    Login
                                </Link>
                                <Link 
                                    to="/register" 
                                    className="px-4 py-2 rounded-lg bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 text-white font-medium transition-all duration-200 shadow-lg hover:shadow-orange-500/25"
                                >
                                    Get Started
                                </Link>
                            </>
                        )}
                    </nav>
                </div>
            </header>
            <Suspense fallback={
                <div className="flex items-center justify-center min-h-[60vh]">
                    <div className="text-center">
                        <div className="w-12 h-12 border-4 border-neutral-700 border-t-orange-500 rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-neutral-400 font-medium">Loading...</p>
                    </div>
                </div>
            }>
                <RoutesIndex />
            </Suspense>
        </div>
    )
}
