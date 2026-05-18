import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Servisni ključ — samo server-side, nikad na klijentu
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { uid } = await req.json()
    if (!uid) return NextResponse.json({ error: 'No UID' }, { status: 400 })

    // Nađi agenta po NFC UID
    const { data: agent, error } = await supabaseAdmin
      .from('agents')
      .select('email, full_name, role')
      .eq('nfc_uid', uid.trim())
      .eq('is_active', true)
      .single()

    if (error || !agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    // Kreiraj magic link token za agenta
    const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: agent.email,
    })

    if (linkErr || !linkData?.properties?.hashed_token) {
      return NextResponse.json({ error: 'Token generation failed' }, { status: 500 })
    }

    return NextResponse.json({
      token: linkData.properties.hashed_token,
      email: agent.email,
      full_name: agent.full_name,
      role: agent.role,
    })
  } catch (e) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
