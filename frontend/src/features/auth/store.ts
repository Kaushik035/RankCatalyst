import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import * as api from './api'
import { User } from './api'

interface AuthState {
    accessToken?: string
    refreshToken?: string
    user?: User
    setTokens: (tokens: { accessToken?: string; refreshToken?: string }) => void
    setUser: (user?: User) => void
    login: (email: string, password: string) => Promise<void>
    register: (email: string, password: string, displayName?: string) => Promise<void>
    fetchMe: () => Promise<void>
    logout: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            accessToken: undefined,
            refreshToken: undefined,
            user: undefined,
            setTokens: ({ accessToken, refreshToken }) => set((s) => ({ ...s, accessToken, refreshToken })),
            setUser: (user) => set((s) => ({ ...s, user })),
            async login(email, password) {
                const data = await api.login({ email, password })
                set({ accessToken: data.access, refreshToken: data.refresh, user: data.user })
            },
            async register(email, password, displayName) {
                await api.register({ email, password, displayName })
            },
            async fetchMe() {
                const user = await api.me()
                set({ user })
            },
            async logout() {
                const { refreshToken } = get()
                try { await api.logout(refreshToken) } catch { }
                set({ accessToken: undefined, refreshToken: undefined, user: undefined })
                localStorage.removeItem('auth')
            },
        }),
        { name: 'auth' }
    )
)
