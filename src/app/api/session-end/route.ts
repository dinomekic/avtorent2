import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { id, minutes } = await req.json()
    await supabase.from('agent_sessions').update({
      logged_out_at: new Date().toISOString(),
      duration_minutes: minutes,
    }).eq('id', id)
    return new Response('ok')
  } catch {
    return new Response('error', { status: 500 })
  }
}
