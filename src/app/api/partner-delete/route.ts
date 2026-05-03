import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { partnerId } = await req.json()
    if (!partnerId) return NextResponse.json({ error: 'partnerId je obavezan' }, { status: 400 })

    await supabase.from('partner_qr_codes').delete().eq('partner_id', partnerId)
    await supabase.from('partner_payouts').delete().eq('partner_id', partnerId)
    const { error } = await supabase.from('partners').delete().eq('id', partnerId)

    if (error) {
      console.error('Delete error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Greška servera' }, { status: 500 })
  }
}
