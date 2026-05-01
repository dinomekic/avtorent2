import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  return NextResponse.json({ 
    message: 'Automatski scraping se pokreće lokalno. Koristi: npm run scrape',
    info: 'Playwright ne može raditi na Vercel serverless platformi.'
  }, { status: 200 })
}

// Vercel Cron Job — samo za sync-prices (bez Playwrighta)
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json({ message: 'Cron aktivan. Scraping se pokreće lokalno.' })
}
