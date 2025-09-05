import { useForm } from 'react-hook-form'
import { requestPasswordReset } from '@/features/auth/api'

export default function ForgotPassword() {
    const { register, handleSubmit, formState: { isSubmitting } } = useForm<{ email: string }>()
    const onSubmit = async (data: { email: string }) => {
        await requestPasswordReset(data.email)
        alert('If the email exists, a link was sent.')
    }
    return (
        <main className="max-w-md mx-auto px-4 py-10">
            <h1 className="text-2xl font-semibold">Forgot password</h1>
            <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
                <div>
                    <label className="block text-sm mb-1">Email</label>
                    <input type="email" className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2" {...register('email')} />
                </div>
                <button disabled={isSubmitting} className="w-full px-4 py-2 rounded bg-brand-600 hover:bg-brand-700 disabled:opacity-50">Send reset link</button>
            </form>
        </main>
    )
}
