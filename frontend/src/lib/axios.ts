import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/features/auth/store'

const apiBaseURL = import.meta.env.VITE_API_BASE_URL as string

export const api: AxiosInstance = axios.create({
    baseURL: apiBaseURL,
    withCredentials: false,
})

let isRefreshing = false
let pendingQueue: Array<{ resolve: () => void; reject: () => void }> = []

function subscribeTokenRefresh(cb: () => void) {
    pendingQueue.push({ resolve: cb, reject: cb })
}

function onRefreshed() {
    pendingQueue.forEach(({ resolve }) => resolve())
    pendingQueue = []
}

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().accessToken
    if (token) {
        config.headers = {
            ...(config.headers || {}),
            Authorization: `Bearer ${token}`,
        }
    }
    return config
})

api.interceptors.response.use(
    (res) => res,
    async (error: AxiosError) => {
        const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean }
        const status = error.response?.status
        const { refreshToken, setTokens, logout } = useAuthStore.getState()

        if (status === 401 && refreshToken && !original._retry) {
            original._retry = true
            if (isRefreshing) {
                await new Promise<void>((resolve) => subscribeTokenRefresh(resolve))
                return api(original)
            }
            isRefreshing = true
            try {
                const resp = await axios.post(`${apiBaseURL}/auth/refresh`, { refresh: refreshToken })
                const newAccess = (resp.data as any).access as string
                setTokens({ accessToken: newAccess, refreshToken })
                onRefreshed()
                return api(original)
            } catch (e) {
                logout()
                throw e
            } finally {
                isRefreshing = false
            }
        }
        throw error
    }
)
