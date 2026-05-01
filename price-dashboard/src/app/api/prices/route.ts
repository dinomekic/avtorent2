import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabase'
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('my_prices')
    .select(`
      *,
      vehicle_categories(name_sr, name_en)
    `)
    .eq('is_active', true)
    .order('category_id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PUT(request: Request) {
  const body = await request.json()
  const { id, base_price, peak_price, peak_start, peak_end } = body

  if (!id || !base_price) {
    return NextResponse.json({ error: 'Nedostaju obavezna polja' }, { status: 400 })
  }

  // Dohvati staru cijenu za historiju
  const { data: old } = await supabaseAdmin
    .from('my_prices')
    .select('base_price')
    .eq('id', id)
    .single()

  const { data, error } = await supabaseAdmin
    .from('my_prices')
    .update({
      base_price,
      peak_price: peak_price || null,
      peak_start: peak_start || null,
      peak_end: peak_end || null,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Sačuvaj u historiju
  if (old && old.base_price !== base_price) {
    await supabaseAdmin.from('price_history').insert({
      my_price_id: id,
      old_price: old.base_price,
      new_price: base_price,
      change_reason: body.reason || 'Manuelna korekcija'
    })
  }

  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const body = await request.json()
  const { category_id, vehicle_model, base_price, peak_price, peak_start, peak_end } = body

  const { data, error } = await supabaseAdmin
    .from('my_prices')
    .insert({ category_id, vehicle_model, base_price, peak_price, peak_start, peak_end })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
