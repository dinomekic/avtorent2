import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category')
  const pickupDate = searchParams.get('pickupDate')
  const returnDate = searchParams.get('returnDate')
  const locationId = searchParams.get('locationId')

  // Učitaj iz vozila_fleet — samo show_on_site = true i fleet_status = available
  let query = supabase
    .from('vozila_fleet')
    .select('*')
    .eq('show_on_site', true)
    .eq('fleet_status', 'available')
    .order('price_per_day')

  const { data, error } = await query
  if (error) return NextResponse.json({ error: 'Greška' }, { status: 500 })

  let vehicles = data || []

  // Filtriraj po kategoriji (vehicle_class)
  if (category && category !== 'all') {
    const classMap: Record<string, string[]> = {
      mini: ['Hatchback'], economy: ['Hatchback'], compact: ['Hatchback', 'Medium'],
      intermediate: ['Medium', 'Sedan'], standard: ['Sedan'], fullsize: ['Sedan', 'Luxury'],
      suv: ['SUV'], minivan: ['Van'], van: ['Van'], premium: ['Luxury'],
      convertible: ['Convertible'], sport: ['Luxury'],
    }
    const classes = classMap[category]
    if (classes) vehicles = vehicles.filter((v: any) => classes.includes(v.vehicle_class))
    else vehicles = vehicles.filter((v: any) => (v.vehicle_class || '').toLowerCase() === category)
  }

  // Filtriraj po lokaciji
  if (locationId) {
    vehicles = vehicles.filter((v: any) => v.lokacija === locationId)
  }

  // Filtriraj zauzeta vozila iz rezervacije tabele
  if (pickupDate && returnDate && vehicles.length > 0) {
    const { data: booked } = await supabase
      .from('rezervacije')
      .select('br_tablica')
      .in('daily_status', ['Izdato', 'Na čekanju'])
      .lte('od_datuma', returnDate)
      .gte('do_datuma', pickupDate)
    const bookedPlates = new Set((booked || []).map((r: any) => r.br_tablica))
    vehicles = vehicles.filter((v: any) => !bookedPlates.has(v.license_plate))
  }

  const targetDate = pickupDate || new Date().toISOString().split('T')[0]
  const priced = await applyPricing(supabase, vehicles, targetDate)

  // Mapiraj na format koji sajt očekuje — id je numerički ID iz vozila_fleet
  const mapped = priced.map((v: any) => ({
    id: String(v.id),
    name: v.agregirani_2 || `${v.marka} ${v.model}`,
    category: (v.vehicle_class || 'economy').toLowerCase().replace(' ', '_'),
    price_per_day: v.price_per_day,
    original_price: v.original_price || v.price_per_day,
    seats: v.seats || 5,
    transmission: v.transmission || 'manual',
    fuel_type: v.fuel_type || 'diesel',
    features: v.features || [],
    year: v.year,
    image_url: v.image_url,
    season_name: v.season_name || null,
    license_plate: v.license_plate,
    lokacija: v.lokacija,
  }))

  return NextResponse.json(mapped)
}

async function applyPricing(supabase: any, vehicles: any[], date: string) {
  const { data: seasons } = await supabase
    .from('seasonal_pricing').select('*').eq('is_active', true)
    .lte('date_from', date).gte('date_to', date)

  const { data: dynamics } = await supabase
    .from('dynamic_pricing').select('*').eq('is_active', true)
    .order('occupancy_threshold', { ascending: false })

  let dynamicMultiplier = 1
  if (dynamics && dynamics.length > 0) {
    const { data: booked } = await supabase
      .from('rezervacije').select('br_tablica')
      .in('daily_status', ['Izdato', 'Na čekanju'])
      .lte('od_datuma', date).gte('do_datuma', date)
    const { data: total } = await supabase
      .from('vozila_fleet').select('id').eq('show_on_site', true).eq('fleet_status', 'available')
    const bookedCount = new Set((booked || []).map((r: any) => r.br_tablica)).size
    const totalCount = (total || []).length
    const occupancyRate = totalCount > 0 ? (bookedCount / totalCount) * 100 : 0
    const applicable = dynamics.filter((d: any) => occupancyRate >= d.occupancy_threshold)
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
