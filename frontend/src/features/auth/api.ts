import { api } from '@/lib/axios'

export type User = {
    id: number
    email: string
    is_email_verified: boolean
    date_joined: string
    profile?: {
        display_name?: string
        avatar_url?: string
        role: 'student' | 'admin'
        created_at: string
    }
}

export async function register(params: { email: string; password: string; displayName?: string }) {
    await api.post('/auth/register', {
        email: params.email,
        password: params.password,
        display_name: params.displayName ?? '',
    })
}

export async function login(params: { email: string; password: string }) {
    const { data } = await api.post<{ access: string; refresh: string; user: User }>('/auth/login', params)
    return data
}

export async function refresh(refreshToken: string) {
    const { data } = await api.post<{ access: string }>('/auth/refresh', { refresh: refreshToken })
    return data
}

export async function logout(refreshToken?: string) {
    await api.post('/auth/logout', refreshToken ? { refresh: refreshToken } : {})
}

export async function me() {
    const { data } = await api.get<User>('/auth/me')
    return data
}

export async function requestPasswordReset(email: string) {
    await api.post('/auth/request-password-reset', { email })
}

export async function resetPassword(token: string, newPassword: string) {
    await api.post('/auth/reset-password', { token, new_password: newPassword })
}

export async function verifyEmail(token: string) {
    const { data } = await api.get<{ detail: string }>(`/auth/verify-email?token=${encodeURIComponent(token)}`)
    return data
}
