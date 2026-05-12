import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { searchParams } = new URL(req.url)
  const vehicleClass = searchParams.get('category') // sajt šalje 'category', mi mapiramo na vehicle_class
  const pickupDate = searchParams.get('pickupDate')
  const returnDate = searchParams.get('returnDate')
  const locationId = searchParams.get('locationId') // lokacija iz sajta (ne koristimo za vozila_fleet direktno)

  // Učitaj sva aktivna vozila iz vehicles tabele (za sajt)
  let query = supabase
    .from('vehicles')
    .select('*')
    .eq('is_available', true)
    .order('price_per_day')

  // Filter po klasi vozila
  if (vehicleClass && vehicleClass !== 'all') {
    query = query.eq('category', vehicleClass)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: 'Greška' }, { status: 500 })

  let vehicles = data || []

  // Filtriraj vozila koja nemaju slobodnih u floti (po model_group i datumu)
  if (pickupDate && returnDate && vehicles.length > 0) {
    // Pronađi zauzete tablice u periodu
    const { data: zauzete } = await supabase
      .from('rezervacije')
      .select('br_tablica')
      .neq('daily_status', 'Nije izdato')
      .lte('od_datuma', returnDate)
      .gt('do_datuma', pickupDate)

    const zauzeteTablice = new Set((zauzete || []).map((r: any) => r.br_tablica))

    // Za svaki vehicle provjeri da li ima slobodnih u floti
    const modelGroups = vehicles.map((v: any) => v.model_group).filter(Boolean)
    if (modelGroups.length > 0) {
      const { data: fleetVozila } = await supabase
        .from('vozila_fleet')
        .select('license_plate, model_group, fleet_status')
        .in('model_group', modelGroups)
        .eq('fleet_status', 'available')

      // Grupiši po model_group i izbaci zauzeta
      const slobodnaPoGrupi: Record<string, number> = {}
      for (const fv of (fleetVozila || [])) {
        if (!fv.model_group) continue
        if (zauzeteTablice.has(fv.license_plate)) continue
        slobodnaPoGrupi[fv.model_group] = (slobodnaPoGrupi[fv.model_group] || 0) + 1
      }

      // Prikaži samo vozila koja imaju slobodnih u floti
      vehicles = vehicles.filter((v: any) => {
        if (!v.model_group) return v.is_available // bez grupe — prikaži ako je is_available
        return (slobodnaPoGrupi[v.model_group] || 0) > 0
      })
    }
  }

  // Primijeni sezonsko i dinamičko određivanje cijena
  const targetDate = pickupDate || new Date().toISOString().split('T')[0]
  const priced = await applyPricing(supabase, vehicles, targetDate)

  return NextResponse.json(priced)
}

async function applyPricing(supabase: any, vehicles: any[], date: string) {
  const { data: seasons } = await supabase
    .from('seasonal_pricing')
    .select('*')
    .eq('is_active', true)
    .lte('date_from', date)
    .gte('date_to', date)

  const { data: dynamics } = await supabase
    .from('dynamic_pricing')
    .select('*')
    .eq('is_active', true)
    .order('occupancy_threshold', { ascending: false })

  let dynamicMultiplier = 1

  if (dynamics && dynamics.length > 0) {
    // Računaj zauzetost iz vozila_fleet + rezervacije
    const { data: zauzete } = await supabase
      .from('rezervacije')
      .select('br_tablica')
      .neq('daily_status', 'Nije izdato')
      .lte('od_datuma', date)
      .gt('do_datuma', date)

    const { data: totalVozila } = await supabase
      .from('vehicles')
      .select('id')
      .eq('is_available', true)

    const bookedCount = new Set((zauzete || []).map((r: any) => r.br_tablica)).size
    const totalCount = (totalVozila || []).length
    const occupancyRate = totalCount > 0 ? (bookedCount / totalCount) * 100 : 0

    const applicable = (dynamics || []).filter((d: any) => occupancyRate >= d.occupancy_threshold)
    if (applicable.length > 0) dynamicMultiplier = 1 + (applicable[0].price_increase_percent / 100)
  }

  const activeSeason = seasons && seasons.length > 0 ? seasons[0] : null
  const seasonMultiplier = activeSeason ? activeSeason.multiplier : 1

  return vehicles.map((v: any) => ({
    ...v,
    original_price: v.price_per_day,
    price_per_day: Math.round(v.price_per_day * seasonMultiplier * dynamicMultiplier),
    season_name: activeSeason?.name || null,
  }))
}
