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

  // Učitaj sva aktivna vozila iz vozila_fleet
  let query = supabase
    .from('vozila_fleet')
    .select('*')
    .eq('fleet_status', 'available')
    .eq('is_available', true)
    .order('marka')

  // Filter po klasi vozila
  if (vehicleClass && vehicleClass !== 'all') {
    query = query.eq('vehicle_class', vehicleClass)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: 'Greška' }, { status: 500 })

  let vehicles = data || []

  // Filtriraj zauzeta vozila koristeći rezervacije tabelu (stara baza)
  if (pickupDate && returnDate && vehicles.length > 0) {
    const { data: zauzete } = await supabase
      .from('rezervacije')
      .select('br_tablica')
      .neq('daily_status', 'Nije izdato')
      .lte('od_datuma', returnDate)
      .gt('do_datuma', pickupDate)

    const zauzeteTablice = new Set((zauzete || []).map((r: any) => r.br_tablica))
    vehicles = vehicles.filter((v: any) => !zauzeteTablice.has(v.license_plate))
  }

  // Mapuj vozila_fleet strukturu na format koji sajt očekuje
  const mapped = vehicles.map((v: any) => ({
    id: String(v.id),
    name: v.agregirani_2 || `${v.marka} ${v.model}`,
    category: v.vehicle_class || 'Hatchback',
    price_per_day: v.price_per_day || 0,
    seats: v.seats || 5,
    transmission: v.transmission === 'automatic' ? 'automatic' : 'manual',
    fuel_type: v.fuel_type || 'diesel',
    features: v.features || [],
    year: v.year || null,
    image_url: v.image_url || null,
    license_plate: v.license_plate || null,
    color: v.color || null,
    lokacija: v.lokacija || 'CRNA GORA',
    marka: v.marka || null,
    model: v.model || null,
    power_kw: v.power_kw || null,
    engine_cc: v.engine_cc || null,
    is_available: true,
    // Kompatibilnost sa starim vehicle_locations sistemom
    vehicle_locations: [],
  }))

  // Primijeni sezonsko i dinamičko određivanje cijena
  const targetDate = pickupDate || new Date().toISOString().split('T')[0]
  const priced = await applyPricing(supabase, mapped, targetDate)

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
      .from('vozila_fleet')
      .select('id')
      .eq('fleet_status', 'available')
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
