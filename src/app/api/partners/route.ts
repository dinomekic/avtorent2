import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { searchParams } = new URL(req.url)
  const qrCode = searchParams.get('qr')
  if (!qrCode) return NextResponse.json(null)

  // 1. Pokušaj naći direktno u partners tabeli (glavni/stari kod)
  let { data: partner } = await supabase
    .from('partners')
    .select('id, name, commission_percent, client_discount_percent, qr_code')
    .eq('qr_code', qrCode)
    .eq('is_active', true)
    .single()

  // 2. Ako nije nađen, traži u partner_qr_codes pa povuci partnera
  if (!partner) {
    const { data: qrRow } = await supabase
      .from('partner_qr_codes')
      .select('partner_id')
      .eq('qr_code', qrCode)
      .single()

    if (qrRow) {
      const { data: partnerData } = await supabase
        .from('partners')
        .select('id, name, commission_percent, client_discount_percent, qr_code')
        .eq('id', qrRow.partner_id)
        .eq('is_active', true)
        .single()

      partner = partnerData
    }
  }

  // 3. Evidentiraj skeniranje
  if (partner) {
    await supabase.from('qr_scans').insert({
      partner_id: partner.id,
      qr_code: qrCode,
      converted: false,
    })
  }

  return NextResponse.json(partner || null)
}
