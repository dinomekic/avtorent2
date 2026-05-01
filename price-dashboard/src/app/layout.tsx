import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Planet Price Intelligence',
  description: 'Praćenje i optimizacija cijena rent-a-car vozila',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sr">
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  )
}
