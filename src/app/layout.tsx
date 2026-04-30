import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'AdriaDrive — Rent a Car Balkan',
  description: 'Iznajmite vozilo u Crnoj Gori, Albaniji, Bosni i Srbiji. Dostava na aerodrom, hotel ili apartman.',
  keywords: 'rent a car, crna gora, albanija, bosna, srbija, iznajmljivanje vozila, aerodrom',
  openGraph: {
    title: 'AdriaDrive — Rent a Car Balkan',
    description: 'Iznajmite vozilo u Crnoj Gori, Albaniji, Bosni i Srbiji.',
    siteName: 'AdriaDrive',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sr" className={inter.variable}>
      <body style={{ margin: 0, padding: 0, fontFamily: 'var(--font-inter), system-ui, -apple-system, sans-serif' }}>
        {children}
      </body>
    </html>
  )
}
