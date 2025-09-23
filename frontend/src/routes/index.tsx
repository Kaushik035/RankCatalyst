import { Route, Routes, Navigate } from 'react-router-dom'
import Login from './auth/Login'
import Register from './auth/Register'
import VerifyEmail from './auth/VerifyEmail'
import ForgotPassword from './auth/ForgotPassword'
import ResetPassword from './auth/ResetPassword'
import { GuestRoute, ProtectedRoute } from '@/features/auth/guards'
import { GazeSession } from '@/features/gaze/session'
import { SessionList } from '@/features/dashboard/SessionList'
import { SessionDetail } from '@/features/dashboard/SessionDetail'

function Landing() {
    return (
        <main className="max-w-6xl mx-auto px-4 py-16">
            <div className="rounded-xl p-10 bg-neutral-900 border border-neutral-800">
                <h1 className="text-3xl font-semibold">RankCatalyst</h1>
                <p className="text-neutral-300 mt-2">JEE Chemistry, accelerated – Attention-Aware ITS.</p>
                <div className="mt-6">
                    <a href="/register" className="inline-block px-4 py-2 rounded bg-brand-600 hover:bg-brand-700">Get started</a>
                </div>
            </div>
        </main>
    )
}

function Dashboard() {
    return (
        <main className="max-w-6xl mx-auto px-4 py-10">
            <h2 className="text-2xl font-semibold">Welcome</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                <div className="p-4 rounded border border-neutral-800 bg-neutral-900">Chemistry Modules</div>
                <div className="p-4 rounded border border-neutral-800 bg-neutral-900">Practice</div>
                <div className="p-4 rounded border border-neutral-800 bg-neutral-900">
                    <a href="/attention/session" className="text-brand-400 hover:text-brand-300">
                        Start Gaze Session
                    </a>
                </div>
            </div>
        </main>
    )
}

export default function RoutesIndex() {
    return (
        <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
            <Route path="/register" element={<GuestRoute><Register /></GuestRoute>} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/forgot-password" element={<GuestRoute><ForgotPassword /></GuestRoute>} />
            <Route path="/reset-password" element={<GuestRoute><ResetPassword /></GuestRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            
            {/* Attention tracking routes */}
            <Route path="/attention/session" element={<ProtectedRoute><GazeSession lessonId={undefined} deviceInfo={{}} onSessionEnd={() => {}} onError={() => {}} /></ProtectedRoute>} />
            <Route path="/attention/sessions" element={<ProtectedRoute><SessionList /></ProtectedRoute>} />
            <Route path="/attention/sessions/:sessionId" element={<ProtectedRoute><SessionDetail /></ProtectedRoute>} />
            
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    )
}
