import type { Config } from 'tailwindcss'

export default {
    darkMode: 'class',
    content: [
        './index.html',
        './src/**/*.{ts,tsx}',
    ],
    theme: {
        extend: {
            colors: {
                brand: {
                    500: '#f97316',
                    600: '#ea580c',
                    700: '#c2410c',
                },
            },
            backgroundImage: {
                'gradient-hero': 'linear-gradient(135deg, #f97316 0%, #fb923c 40%, #fbbf24 100%)',
            },
        },
    },
    plugins: [],
} satisfies Config
