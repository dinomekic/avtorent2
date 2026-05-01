import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
)

export async function POST() {
  try {
    // Dohvati moje cijene
    const { data: myPrices, error: mpErr } = await supabaseAdmin
      .from('my_prices')
      .select('*')
      .eq('is_active', true)

    if (mpErr) return NextResponse.json({ error: mpErr.message }, { status: 500 })

    // Dohvati cijene konkurencije (zadnjih 14 dana)
    const { data: compPrices, error: cpErr } = await supabaseAdmin
      .from('competitor_prices')
      .select('*')
      .neq('competitor_id', 'planet')
      .gte('scraped_at', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString())

    if (cpErr) return NextResponse.json({ error: cpErr.message }, { status: 500 })

    if (!compPrices?.length) {
      return NextResponse.json({ message: 'Nema podataka o konkurenciji', generated: 0 })
    }

    // Obriši stare neaplikovane preporuke
    await supabaseAdmin
      .from('price_recommendations')
      .delete()
      .eq('is_applied', false)

    const recommendations = []

    for (const mp of (myPrices || [])) {
      // Cijene konkurencije za ovu kategoriju
      const catPrices = compPrices.filter(p => p.category_id === mp.category_id)
      if (catPrices.length < 1) continue

      const prices = catPrices.map(p => Number(p.price_per_day))
      const avg = Math.round(prices.reduce((s, p) => s + p, 0) / prices.length)
      const min = Math.min(...prices)
      const max = Math.max(...prices)
      const myPrice = Number(mp.base_price)

      // Razlika u %: pozitivno = ja sam jeftiniji, negativno = ja sam skuplji
      const diffPct = Math.round((avg - myPrice) / avg * 100)

      let type: 'increase' | 'decrease' | 'ok' = 'ok'
      let reason = ''
      let recommended = myPrice

      if (diffPct > 15) {
        // Moja cijena je >15% ispod prosjeka — mogu podići
        type = 'increase'
        recommended = Math.round(avg * 0.97) // 3% ispod prosjeka
        reason = `Tvoja cijena (${myPrice}€) je ${diffPct}% niža od prosjeka konkurencije (${avg}€). Možeš podići na ${recommended}€ i ostati konkurentan.`
      } else if (diffPct < -10) {
        // Moja cijena je >10% iznad prosjeka — razmatranje spuštanja
        type = 'decrease'
        recommended = Math.round(avg * 1.03) // 3% iznad prosjeka
        reason = `Tvoja cijena (${myPrice}€) je ${Math.abs(diffPct)}% viša od prosjeka konkurencije (${avg}€). Razmotri spuštanje na ${recommended}€.`
      } else {
        reason = `Cijena je konkurentna. Tvoja: ${myPrice}€, prosjek: ${avg}€ (razlika ${diffPct > 0 ? '+' : ''}${diffPct}%).`
      }

      recommendations.push({
        category_id: mp.category_id,
        vehicle_model: mp.vehicle_model,
        current_price: myPrice,
        recommended_price: recommended,
        avg_competitor_price: avg,
        min_competitor_price: min,
        max_competitor_price: max,
        recommendation_type: type,
        reason,
        is_applied: false
      })
    }

    if (recommendations.length > 0) {
      const { error: insErr } = await supabaseAdmin
        .from('price_recommendations')
        .insert(recommendations)

      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
    }

    return NextResponse.json({
      generated: recommendations.length,
      increase: recommendations.filter(r => r.recommendation_type === 'increase').length,
      decrease: recommendations.filter(r => r.recommendation_type === 'decrease').length,
      ok: recommendations.filter(r => r.recommendation_type === 'ok').length,
    })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
