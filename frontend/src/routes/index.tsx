import { Route, Routes, Navigate } from 'react-router-dom'
import { useCallback } from 'react'
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
        <main className="relative">
            {/* Hero Section */}
            <section className="relative overflow-hidden">
                <div className="max-w-7xl mx-auto px-6 py-24 lg:py-32">
                    <div className="text-center">
                        {/* Main heading */}
                        <div className="mb-8">
                            <h1 className="text-5xl lg:text-7xl font-bold mb-6">
                                <span className="bg-gradient-to-r from-white via-neutral-200 to-neutral-400 bg-clip-text text-transparent">
                                    RankCatalyst
                                </span>
                            </h1>
                            <div className="w-24 h-1 bg-gradient-to-r from-orange-500 to-amber-400 mx-auto rounded-full mb-8"></div>
                            <p className="text-xl lg:text-2xl text-neutral-300 max-w-3xl mx-auto leading-relaxed">
                                JEE Chemistry, accelerated through{' '}
                                <span className="text-orange-400 font-semibold">Attention-Aware Intelligent Tutoring</span>
                            </p>
                        </div>

                        {/* Subtitle */}
                        <p className="text-lg text-neutral-400 max-w-2xl mx-auto mb-12 leading-relaxed">
                            Experience personalized learning with real-time gaze tracking, adaptive interventions, 
                            and AI-powered chemistry tutoring designed for JEE success.
                        </p>

                        {/* CTA Buttons */}
                        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
                            <a 
                                href="/register" 
                                className="group px-8 py-4 bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 rounded-xl text-white font-semibold text-lg transition-all duration-300 shadow-2xl hover:shadow-orange-500/25 transform hover:-translate-y-1"
                            >
                                <span className="flex items-center gap-2">
                                    Start Learning Free
                                    <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                    </svg>
                                </span>
                            </a>
                            <a 
                                href="/login" 
                                className="px-8 py-4 border-2 border-neutral-600 hover:border-neutral-500 rounded-xl text-neutral-300 hover:text-white font-semibold text-lg transition-all duration-300 hover:bg-neutral-800/30"
                            >
                                Sign In
                            </a>
                        </div>

                        {/* Feature highlights */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
                            <div className="group p-6 rounded-2xl bg-neutral-900/50 border border-neutral-800/50 hover:border-neutral-700/50 transition-all duration-300 hover:bg-neutral-900/70">
                                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mb-4 mx-auto group-hover:scale-110 transition-transform duration-300">
                                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                </div>
                                <h3 className="text-lg font-semibold text-white mb-2">Eye Tracking</h3>
                                <p className="text-neutral-400 text-sm">Real-time attention monitoring for personalized learning experiences</p>
                            </div>
                            
                            <div className="group p-6 rounded-2xl bg-neutral-900/50 border border-neutral-800/50 hover:border-neutral-700/50 transition-all duration-300 hover:bg-neutral-900/70">
                                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center mb-4 mx-auto group-hover:scale-110 transition-transform duration-300">
                                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                    </svg>
                                </div>
                                <h3 className="text-lg font-semibold text-white mb-2">AI Interventions</h3>
                                <p className="text-neutral-400 text-sm">Smart adaptive learning that responds to your attention patterns</p>
                            </div>
                            
                            <div className="group p-6 rounded-2xl bg-neutral-900/50 border border-neutral-800/50 hover:border-neutral-700/50 transition-all duration-300 hover:bg-neutral-900/70">
                                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center mb-4 mx-auto group-hover:scale-110 transition-transform duration-300">
                                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                    </svg>
                                </div>
                                <h3 className="text-lg font-semibold text-white mb-2">JEE Chemistry</h3>
                                <p className="text-neutral-400 text-sm">Comprehensive chemistry curriculum tailored for JEE preparation</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Floating elements */}
                <div className="absolute top-20 left-10 w-20 h-20 bg-orange-500/10 rounded-full blur-xl animate-pulse"></div>
                <div className="absolute bottom-20 right-10 w-32 h-32 bg-amber-500/10 rounded-full blur-xl animate-pulse delay-1000"></div>
                <div className="absolute top-1/2 left-1/4 w-16 h-16 bg-blue-500/10 rounded-full blur-xl animate-pulse delay-500"></div>
            </section>

            {/* Stats Section */}
            <section className="relative py-16 border-t border-neutral-800/50">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
                        <div className="group">
                            <div className="text-3xl lg:text-4xl font-bold bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent mb-2 group-hover:scale-110 transition-transform duration-300">
                                1000+
                            </div>
                            <div className="text-neutral-400 font-medium">Students Helped</div>
                        </div>
                        <div className="group">
                            <div className="text-3xl lg:text-4xl font-bold bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent mb-2 group-hover:scale-110 transition-transform duration-300">
                                95%
                            </div>
                            <div className="text-neutral-400 font-medium">Success Rate</div>
                        </div>
                        <div className="group">
                            <div className="text-3xl lg:text-4xl font-bold bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent mb-2 group-hover:scale-110 transition-transform duration-300">
                                50+
                            </div>
                            <div className="text-neutral-400 font-medium">Chemistry Topics</div>
                        </div>
                        <div className="group">
                            <div className="text-3xl lg:text-4xl font-bold bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent mb-2 group-hover:scale-110 transition-transform duration-300">
                                24/7
                            </div>
                            <div className="text-neutral-400 font-medium">AI Support</div>
                        </div>
                </div>
            </div>
            </section>
        </main>
    )
}

function Dashboard() {
    return (
        <main className="relative">
            {/* Welcome Section */}
            <section className="relative py-12">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="text-center mb-12">
                        <h2 className="text-4xl lg:text-5xl font-bold mb-4">
                            <span className="bg-gradient-to-r from-white to-neutral-300 bg-clip-text text-transparent">
                                Welcome Back
                            </span>
                        </h2>
                        <p className="text-xl text-neutral-400 max-w-2xl mx-auto">
                            Ready to accelerate your JEE Chemistry preparation with AI-powered attention tracking?
                        </p>
                    </div>

                    {/* Quick Actions Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
                        {/* Chemistry Modules */}
                        <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-neutral-900 to-neutral-950 border border-neutral-800/50 hover:border-neutral-700/50 transition-all duration-300 hover:scale-105">
                            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                            <div className="relative p-8">
                                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                                    </svg>
                                </div>
                                <h3 className="text-xl font-bold text-white mb-3">Chemistry Modules</h3>
                                <p className="text-neutral-400 mb-6 leading-relaxed">
                                    Comprehensive JEE Chemistry curriculum with interactive lessons and practice problems.
                                </p>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-neutral-500">50+ Topics Available</span>
                                    <div className="w-8 h-8 bg-neutral-800 rounded-lg flex items-center justify-center group-hover:bg-neutral-700 transition-colors duration-300">
                                        <svg className="w-4 h-4 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Practice */}
                        <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-neutral-900 to-neutral-950 border border-neutral-800/50 hover:border-neutral-700/50 transition-all duration-300 hover:scale-105">
                            <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-emerald-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                            <div className="relative p-8">
                                <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                                    </svg>
                                </div>
                                <h3 className="text-xl font-bold text-white mb-3">Practice Tests</h3>
                                <p className="text-neutral-400 mb-6 leading-relaxed">
                                    Timed practice sessions with detailed analytics and performance tracking.
                                </p>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-neutral-500">1000+ Questions</span>
                                    <div className="w-8 h-8 bg-neutral-800 rounded-lg flex items-center justify-center group-hover:bg-neutral-700 transition-colors duration-300">
                                        <svg className="w-4 h-4 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Gaze Session */}
                        <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-neutral-900 to-neutral-950 border border-orange-600/30 hover:border-orange-500/50 transition-all duration-300 hover:scale-105">
                            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-amber-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                            <div className="relative p-8">
                                <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-amber-500 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                </div>
                                <h3 className="text-xl font-bold text-white mb-3">Gaze Tracking</h3>
                                <p className="text-neutral-400 mb-6 leading-relaxed">
                                    Start an attention-aware learning session with real-time gaze monitoring.
                                </p>
                                <a 
                                    href="/attention/session" 
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 rounded-lg text-white font-medium transition-all duration-300 group-hover:scale-105"
                                >
                                    Start Session
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                    </svg>
                    </a>
                </div>
            </div>
                    </div>

                    {/* Recent Activity */}
                    <div className="bg-neutral-900/50 border border-neutral-800/50 rounded-2xl p-8">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-2xl font-bold text-white">Recent Activity</h3>
                            <a 
                                href="/attention/sessions" 
                                className="text-orange-400 hover:text-orange-300 font-medium transition-colors duration-200"
                            >
                                View All Sessions →
                            </a>
                        </div>
                        
                        <div className="space-y-4">
                            <div className="flex items-center gap-4 p-4 rounded-xl bg-neutral-800/30 border border-neutral-700/30">
                                <div className="w-12 h-12 bg-gradient-to-br from-blue-500/20 to-blue-600/20 rounded-xl flex items-center justify-center">
                                    <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                </div>
                                <div className="flex-1">
                                    <h4 className="font-semibold text-white">Gaze Session Completed</h4>
                                    <p className="text-neutral-400 text-sm">Organic Chemistry - Hydrocarbons</p>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm text-neutral-400">2 hours ago</div>
                                    <div className="text-sm text-green-400 font-medium">85% Attention</div>
                                </div>
                            </div>

                            <div className="flex items-center gap-4 p-4 rounded-xl bg-neutral-800/30 border border-neutral-700/30">
                                <div className="w-12 h-12 bg-gradient-to-br from-green-500/20 to-green-600/20 rounded-xl flex items-center justify-center">
                                    <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                                    </svg>
                                </div>
                                <div className="flex-1">
                                    <h4 className="font-semibold text-white">Practice Test Completed</h4>
                                    <p className="text-neutral-400 text-sm">Chemical Bonding - 25 Questions</p>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm text-neutral-400">1 day ago</div>
                                    <div className="text-sm text-green-400 font-medium">92% Score</div>
                                </div>
                            </div>

                            <div className="flex items-center gap-4 p-4 rounded-xl bg-neutral-800/30 border border-neutral-700/30">
                                <div className="w-12 h-12 bg-gradient-to-br from-purple-500/20 to-purple-600/20 rounded-xl flex items-center justify-center">
                                    <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                    </svg>
                                </div>
                                <div className="flex-1">
                                    <h4 className="font-semibold text-white">Module Completed</h4>
                                    <p className="text-neutral-400 text-sm">Thermodynamics - Laws & Applications</p>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm text-neutral-400">3 days ago</div>
                                    <div className="text-sm text-blue-400 font-medium">Chapter 5/12</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </main>
    )
}

// Gaze Session component with stable callbacks
function GazeSessionWrapper() {
    const handleSessionEnd = useCallback((sessionId: string, analytics: any) => {
        console.log('Session ended:', sessionId, analytics)
    }, [])

    const handleSessionError = useCallback((error: string) => {
        console.error('Session error:', error)
    }, [])

    return (
        <GazeSession 
            lessonId={undefined} 
            deviceInfo={{}} 
            onSessionEnd={handleSessionEnd} 
            onError={handleSessionError} 
        />
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
            <Route path="/attention/session" element={<ProtectedRoute><GazeSessionWrapper /></ProtectedRoute>} />
            <Route path="/attention/sessions" element={<ProtectedRoute><SessionList /></ProtectedRoute>} />
            <Route path="/attention/sessions/:sessionId" element={<ProtectedRoute><SessionDetail /></ProtectedRoute>} />
            
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    )
}
