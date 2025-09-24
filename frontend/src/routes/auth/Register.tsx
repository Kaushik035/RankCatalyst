import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuthStore } from '@/features/auth/store'
import { useNavigate } from 'react-router-dom'

const schema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    displayName: z.string().optional()
})

type FormData = z.infer<typeof schema>

export default function Register() {
    const { register: reg, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<FormData>({ resolver: zodResolver(schema) })
    const doRegister = useAuthStore((s) => s.register)
    const navigate = useNavigate()
    
    const onSubmit = async (data: FormData) => {
        try {
            await doRegister(data.email, data.password, data.displayName)
            reset()
            alert('Registered. Check your email to verify.')
            navigate('/login')
        } catch (error) {
            console.error('Registration failed:', error)
            alert('Registration failed. Please try again.')
        }
    }
    return (
        <main className="max-w-md mx-auto px-4 py-10">
            <h1 className="text-2xl font-semibold">Create account</h1>
            <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
                <div>
                    <label className="block text-sm mb-1">Email</label>
                    <input type="email" className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2" {...reg('email')} />
                    {errors.email && <p className="text-sm text-red-400 mt-1">{errors.email.message}</p>}
                </div>
                <div>
                    <label className="block text-sm mb-1">Password</label>
                    <input type="password" className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2" {...reg('password')} />
                    {errors.password && <p className="text-sm text-red-400 mt-1">{errors.password.message}</p>}
                </div>
                <div>
                    <label className="block text-sm mb-1">Display name</label>
                    <input type="text" className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2" {...reg('displayName')} />
                </div>
                <button disabled={isSubmitting} className="w-full px-4 py-2 rounded bg-brand-600 hover:bg-brand-700 disabled:opacity-50">Sign up</button>
            </form>
        </main>
    )
}
