import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'Planet System Management',
  description: 'Planet Rent a Car — Sistem za upravljanje flotom i rezervacijama.',
  keywords: 'planet rent a car, fleet management, rezervacije, vozila',
  icons: {
    icon: 'https://planetrentacar.me/wp-content/uploads/2023/03/logo-1.png',
    shortcut: 'https://planetrentacar.me/wp-content/uploads/2023/03/logo-1.png',
    apple: 'https://planetrentacar.me/wp-content/uploads/2023/03/logo-1.png',
  },
  openGraph: {
    title: 'Planet System Management',
    description: 'Planet Rent a Car — Sistem za upravljanje flotom i rezervacijama.',
    siteName: 'Planet System Management',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sr" className={inter.variable}>
      <head>
        <link rel="icon" href="https://planetrentacar.me/wp-content/uploads/2023/03/logo-1.png" />
        <link rel="apple-touch-icon" href="https://planetrentacar.me/wp-content/uploads/2023/03/logo-1.png" />
      </head>
      <body style={{ margin: 0, padding: 0, fontFamily: 'var(--font-inter), system-ui, -apple-system, sans-serif' }}>
        {children}
      </body>
    </html>
  )
}
