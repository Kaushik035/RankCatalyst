import { useEffect, useState } from 'react'
import { verifyEmail } from '@/features/auth/api'
import { useNavigate } from 'react-router-dom'

export default function VerifyEmail() {
    const [status, setStatus] = useState<'pending' | 'ok' | 'error'>('pending')
    const navigate = useNavigate()
    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        const token = params.get('token')
        if (!token) { setStatus('error'); return }
        verifyEmail(token).then(() => {
            setStatus('ok')
            setTimeout(() => navigate('/login'), 800)
        }).catch(() => setStatus('error'))
    }, [navigate])

    return (
        <main className="max-w-md mx-auto px-4 py-10">
            <h1 className="text-2xl font-semibold">Verify email</h1>
            {status === 'pending' && <p className="mt-4 text-neutral-300">Verifying...</p>}
            {status === 'ok' && <p className="mt-4 text-green-400">Email verified. Redirecting to login…</p>}
            {status === 'error' && <p className="mt-4 text-red-400">Invalid or expired token.</p>}
        </main>
    )
}
