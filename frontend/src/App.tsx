import { Routes, Route, Link } from 'react-router-dom'
import { Suspense } from 'react'
import RoutesIndex from './routes'

export default function App() {
    return (
        <div className="min-h-screen">
            <header className="border-b border-neutral-800">
                <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
                    <Link to="/" className="font-semibold text-lg">RankCatalyst</Link>
                    <nav className="flex items-center gap-4 text-sm">
                        <Link to="/login" className="text-neutral-300 hover:text-white">Login</Link>
                        <Link to="/register" className="px-3 py-1 rounded bg-brand-600 hover:bg-brand-700">Sign up</Link>
                    </nav>
                </div>
            </header>
            <Suspense fallback={<div className="p-8">Loading...</div>}>
                <RoutesIndex />
            </Suspense>
        </div>
    )
}
