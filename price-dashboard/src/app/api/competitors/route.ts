import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabase'
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category')
  const days = parseInt(searchParams.get('days') || '7')

  // Dohvati najnovije cijene konkurenata
  let query = supabaseAdmin
    .from('latest_competitor_prices')
    .select('*')
    .neq('competitor_id', 'planet')
    .gte('scraped_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
    .order('category_id')
    .order('price_per_day')

  if (category) {
    query = query.eq('category_id', category)
  }

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  // Manuelni unos cijena konkurencije
  const body = await request.json()
  const {
    competitor_id,
    category_id,
    vehicle_model,
    price_per_day,
    pickup_date,
    return_date,
    notes
  } = body

  if (!competitor_id || !category_id || !price_per_day) {
    return NextResponse.json({ error: 'Nedostaju obavezna polja' }, { status: 400 })
  }

  const rental_days = pickup_date && return_date
    ? Math.round((new Date(return_date).getTime() - new Date(pickup_date).getTime()) / (1000 * 60 * 60 * 24))
    : 7

  const { data, error } = await supabaseAdmin
    .from('competitor_prices')
    .insert({
      competitor_id,
      category_id,
      vehicle_model: vehicle_model || 'Nepoznato',
      price_per_day,
      pickup_date: pickup_date || new Date().toISOString().split('T')[0],
      return_date: return_date || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      rental_days,
      is_manual: true,
      notes
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Automatski generiši preporuku
  await generateRecommendation(category_id)

  return NextResponse.json(data)
}

async function generateRecommendation(categoryId: string) {
  // Dohvati moje cijene i prosijek konkurencije
  const [myPrices, comparison] = await Promise.all([
    supabaseAdmin.from('my_prices').select('*').eq('category_id', categoryId).eq('is_active', true),
    supabaseAdmin.from('price_comparison').select('*').eq('category_id', categoryId)
  ])

  if (!comparison.data?.length) return

  for (const comp of comparison.data) {
    if (!comp.avg_competitor || comp.num_competitors < 2) continue

    const diff = comp.price_diff_pct
    let type: 'increase' | 'decrease' | 'ok' = 'ok'
    let reason = ''
    let recommended = comp.my_price

    if (diff < -10) {
      // Ja sam skuplje od prosjeka za >10%
      type = 'decrease'
      reason = `Tvoja cijena je ${Math.abs(diff)}% viša od prosjeka konkurencije (${comp.avg_competitor}€). Razmotri spuštanje.`
      recommended = Math.round(comp.avg_competitor * 1.03) // 3% iznad prosjeka
    } else if (diff > 15) {
      // Ja sam jeftinije od prosjeka za >15% — možeš podići
      type = 'increase'
      reason = `Tvoja cijena je ${diff}% niža od prosjeka (${comp.avg_competitor}€). Možeš podići bez gubitka konkurentnosti.`
      recommended = Math.round(comp.avg_competitor * 0.97) // 3% ispod prosjeka
    } else {
      reason = `Cijena je konkurentna. Prosjek: ${comp.avg_competitor}€, tvoja: ${comp.my_price}€.`
    }

    await supabaseAdmin.from('price_recommendations').insert({
      category_id: categoryId,
      vehicle_model: comp.vehicle_model,
      current_price: comp.my_price,
      recommended_price: recommended,
      avg_competitor_price: comp.avg_competitor,
      min_competitor_price: comp.min_competitor,
      max_competitor_price: comp.max_competitor,
      recommendation_type: type,
      reason,
      is_applied: false
    })
  }
}
