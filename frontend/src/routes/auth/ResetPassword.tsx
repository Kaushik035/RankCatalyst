import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { resetPassword } from '@/features/auth/api'

export default function ResetPassword() {
    const { register, handleSubmit, formState: { isSubmitting } } = useForm<{ newPassword: string }>()
    const [token, setToken] = useState<string | null>(null)
    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        setToken(params.get('token'))
    }, [])

    const onSubmit = async (data: { newPassword: string }) => {
        if (!token) return alert('Missing token')
        await resetPassword(token, data.newPassword)
        alert('Password reset successful')
    }

    return (
        <main className="max-w-md mx-auto px-4 py-10">
            <h1 className="text-2xl font-semibold">Reset password</h1>
            <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
                <div>
                    <label className="block text-sm mb-1">New password</label>
                    <input type="password" className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2" {...register('newPassword')} />
                </div>
                <button disabled={isSubmitting} className="w-full px-4 py-2 rounded bg-brand-600 hover:bg-brand-700 disabled:opacity-50">Reset password</button>
            </form>
        </main>
    )
}
