'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type FleetVehicle = {
  id: number; license_plate: string | null; agregirani_2: string | null
  marka: string | null; model: string | null; year: number | null
  transmission: string | null; fuel_type: string | null; color: string | null
  fleet_status: string; lokacija: string; price_per_day: number
  image_url: string | null; vehicle_class: string | null; seats: number | null
  fleet_notes: string | null; features: string[] | null
  show_on_site: boolean | null; price_category_id: string | null
}

type VehicleGroup = {
  key: string; marka: string; model: string; year: number | null
  transmission: string | null; fuel_type: string | null
  image_url: string | null; vehicle_class: string | null
  seats: number | null; features: string[] | null
  price_per_day: number; show_on_site: boolean
  price_category_id: string | null
  vehicles: FleetVehicle[]
  total: number; slobodna: number; zauzeta: number
}

type PriceCategory = {
  id: string; name: string; description: string | null
  base_multiplier: number; is_active: boolean; sort_order: number
  default_price: number | null
}

type SeasonalPricing = {
  id: string; name: string; date_from: string; date_to: string
  multiplier: number; is_active: boolean
}

type DynamicPricing = {
  id: string; occupancy_threshold: number
  price_increase_percent: number; is_active: boolean
}

const VEHICLE_CLASSES = ['Hatchback', 'Medium', 'Sedan', 'SUV', 'Station Wagon', 'Luxury', 'Van', 'Convertible']

export default function AdminVozilaPage() {
  const [groups, setGroups] = useState<VehicleGroup[]>([])
  const [priceCategories, setPriceCategories] = useState<PriceCategory[]>([])
  const [seasons, setSeasons] = useState<SeasonalPricing[]>([])
  const [dynamics, setDynamics] = useState<DynamicPricing[]>([])
  const [loading, setLoading] = useState(true)

  const [searchQ, setSearchQ] = useState('')
  const [filterClass, setFilterClass] = useState('SVE')
  const [filterLok, setFilterLok] = useState('SVE')
  const [filterCat, setFilterCat] = useState('SVE')

  // Selekcija
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // Bulk akcija panel
  const [showBulk, setShowBulk] = useState(false)
  const [bulkAction, setBulkAction] = useState<'price' | 'class' | 'category' | 'site' | null>(null)
  const [bulkPrice, setBulkPrice] = useState('')
  const [bulkClass, setBulkClass] = useState('')
  const [bulkCatId, setBulkCatId] = useState('')
  const [bulkSite, setBulkSite] = useState(true)
  const [bulkSaving, setBulkSaving] = useState(false)

  // Edit modal (single group)
  const [editGroup, setEditGroup] = useState<VehicleGroup | null>(null)
  const [ePrice, setEPrice] = useState('')
  const [eClass, setEClass] = useState('')
  const [eCatId, setECatId] = useState('')
  const [eImage, setEImage] = useState('')
  const [eFeatures, setEFeatures] = useState('')
  const [eSeats, setESeats] = useState('')
  const [eSite, setESite] = useState(true)
  const [eSaving, setESaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  // Expand
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  // Kategorije CRUD
  const [showCatModal, setShowCatModal] = useState(false)
  const [editCat, setEditCat] = useState<PriceCategory | null>(null)
  const [catForm, setCatForm] = useState({ name: '', description: '', base_multiplier: '1.0', sort_order: '0', default_price: '' })
  const [catSaving, setCatSaving] = useState(false)

  const today = new Date().toISOString().split('T')[0]

  const loadData = useCallback(async () => {
    setLoading(true)
    const [{ data: vozila }, { data: rezervacije }, { data: cats }, { data: seas }, { data: dyns }] = await Promise.all([
      supabase.from('vozila_fleet').select('*').eq('fleet_status', 'available').order('marka'),
      supabase.from('rezervacije').select('br_tablica').neq('daily_status', 'Nije izdato').lte('od_datuma', today).gt('do_datuma', today),
      supabase.from('price_categories').select('*').order('sort_order'),
      supabase.from('seasonal_pricing').select('*').order('date_from'),
      supabase.from('dynamic_pricing').select('*').order('occupancy_threshold'),
    ])
    if (!vozila) { setLoading(false); return }
    setPriceCategories(cats || [])
    setSeasons(seas || [])
    setDynamics(dyns || [])

    const zauzeteTablice = new Set((rezervacije || []).map((r: any) => r.br_tablica))
    const groupMap = new Map<string, VehicleGroup>()

    for (const v of vozila) {
      const key = `${v.marka}__${v.model}__${v.year}`
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          key, marka: v.marka || '', model: v.model || '', year: v.year,
          transmission: v.transmission, fuel_type: v.fuel_type,
          image_url: v.image_url, vehicle_class: v.vehicle_class,
          seats: v.seats, features: v.features,
          price_per_day: v.price_per_day || 0,
          show_on_site: v.show_on_site !== false,
          price_category_id: v.price_category_id || null,
          vehicles: [], total: 0, slobodna: 0, zauzeta: 0,
        })
      }
      const g = groupMap.get(key)!
      g.vehicles.push(v)
      g.total++
      if (v.fleet_status === 'available') {
        zauzeteTablice.has(v.license_plate) ? g.zauzeta++ : g.slobodna++
      }
      if (!g.image_url && v.image_url) g.image_url = v.image_url
      if (!g.vehicle_class && v.vehicle_class) g.vehicle_class = v.vehicle_class
      if ((!g.features || !g.features.length) && v.features?.length) g.features = v.features
      if (!g.seats && v.seats) g.seats = v.seats
      if (!g.price_category_id && v.price_category_id) g.price_category_id = v.price_category_id
      if (v.show_on_site === false) g.show_on_site = false
    }

    setGroups(Array.from(groupMap.values()).sort((a, b) => a.marka.localeCompare(b.marka) || a.model.localeCompare(b.model)))
    setLoading(false)
  }, [today])

  useEffect(() => { loadData() }, [loadData])

  // Izračun finalne cijene
  function getActiveSeason(): SeasonalPricing | null {
    return seasons.find(s => s.is_active && today >= s.date_from && today <= s.date_to) || null
  }

  function getDynamicMultiplier(occupancy: number): number {
    const active = dynamics.filter(d => d.is_active && occupancy >= d.occupancy_threshold)
      .sort((a, b) => b.occupancy_threshold - a.occupancy_threshold)
    return active.length > 0 ? 1 + active[0].price_increase_percent / 100 : 1
  }

  function getFinalPrice(g: VehicleGroup): { base: number; final: number; breakdown: string } {
    const cat = priceCategories.find(c => c.id === g.price_category_id)
    const season = getActiveSeason()
    const catMult = cat?.base_multiplier || 1
    const seasonMult = season?.multiplier || 1
    // Zauzetost = zauzeta/total
    const occupancy = g.total > 0 ? (g.zauzeta / g.total) * 100 : 0
    const dynMult = getDynamicMultiplier(occupancy)
    const base = g.price_per_day
    const final = Math.round(base * catMult * seasonMult * dynMult)
    const parts = []
    if (catMult !== 1) parts.push(`kat ×${catMult}`)
    if (seasonMult !== 1) parts.push(`sezona ×${seasonMult}`)
    if (dynMult !== 1) parts.push(`dyn ×${dynMult.toFixed(2)}`)
    return { base, final, breakdown: parts.join(' · ') }
  }

  // Filteri
  const lokacije = ['SVE', ...Array.from(new Set(groups.flatMap(g => g.vehicles.map(v => v.lokacija)).filter(Boolean)))]
  const filtered = groups.filter(g => {
    const q = searchQ.toLowerCase()
    return (!q || g.marka.toLowerCase().includes(q) || g.model.toLowerCase().includes(q)) &&
      (filterClass === 'SVE' || g.vehicle_class === filterClass) &&
      (filterLok === 'SVE' || g.vehicles.some(v => v.lokacija === filterLok)) &&
      (filterCat === 'SVE' || g.price_category_id === filterCat)
  })

  // Selekcija
  function toggleSelect(key: string) {
    setSelected(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })
  }
  function selectAll() { setSelected(new Set(filtered.map(g => g.key))) }
  function clearSelect() { setSelected(new Set()); setShowBulk(false) }

  // Bulk snimi
  async function saveBulk() {
    if (!bulkAction || selected.size === 0) return
    setBulkSaving(true)
    const allIds = groups.filter(g => selected.has(g.key)).flatMap(g => g.vehicles.map(v => v.id))
    const updates: any = {}
    if (bulkAction === 'price' && bulkPrice) updates.price_per_day = parseFloat(bulkPrice)
    if (bulkAction === 'class' && bulkClass) updates.vehicle_class = bulkClass
    if (bulkAction === 'category') {
      updates.price_category_id = bulkCatId || null
      // Primijeni default_price iz kategorije ako postoji
      if (bulkCatId) {
        const cat = priceCategories.find(c => c.id === bulkCatId)
        if (cat?.default_price) updates.price_per_day = cat.default_price
      }
    }
    if (bulkAction === 'site') updates.show_on_site = bulkSite
    if (Object.keys(updates).length > 0) await supabase.from('vozila_fleet').update(updates).in('id', allIds)
    setBulkSaving(false); setShowBulk(false); setBulkAction(null)
    clearSelect(); loadData()
  }

  // Single edit
  function openEdit(g: VehicleGroup) {
    setEditGroup(g); setEPrice(String(g.price_per_day || '')); setEClass(g.vehicle_class || '')
    setECatId(g.price_category_id || ''); setEImage(g.image_url || '')
    setEFeatures((g.features || []).join(', ')); setESeats(String(g.seats || ''))
    setESite(g.show_on_site !== false)
  }

  async function uploadImage(file: File): Promise<string | null> {
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `fleet/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('vehicle-images').upload(path, file, { upsert: true })
    if (error) { setUploading(false); return null }
    const { data } = supabase.storage.from('vehicle-images').getPublicUrl(path)
    setUploading(false); return data.publicUrl
  }

  async function saveEdit() {
    if (!editGroup) return
    setESaving(true)
    const ids = editGroup.vehicles.map(v => v.id)
    const updates: any = {
      show_on_site: eSite,
      features: eFeatures.split(',').map((s: string) => s.trim()).filter(Boolean),
    }
    if (ePrice) updates.price_per_day = parseFloat(ePrice)
    if (eClass) updates.vehicle_class = eClass
    updates.price_category_id = eCatId || null
    if (eImage !== editGroup.image_url) updates.image_url = eImage || null
    if (eSeats) updates.seats = parseInt(eSeats)
    await supabase.from('vozila_fleet').update(updates).in('id', ids)
    setESaving(false); setEditGroup(null); loadData()
  }

  // Kategorije CRUD
  async function saveCat() {
    setCatSaving(true)
    const payload = {
      name: catForm.name, description: catForm.description || null,
      base_multiplier: parseFloat(catForm.base_multiplier),
      sort_order: parseInt(catForm.sort_order), is_active: true,
      default_price: catForm.default_price ? parseFloat(catForm.default_price) : null,
    }
    if (editCat) await supabase.from('price_categories').update(payload).eq('id', editCat.id)
    else await supabase.from('price_categories').insert(payload)
    setCatSaving(false); setEditCat(null); setShowCatModal(false)
    setCatForm({ name: '', description: '', base_multiplier: '1.0', sort_order: '0', default_price: '' }); loadData()
  }

  async function deleteCat(id: string) {
    if (!confirm('Obrisati kategoriju?')) return
    await supabase.from('price_categories').delete().eq('id', id)
    loadData()
  }

  async function toggleShowOnSite(g: VehicleGroup) {
    const ids = g.vehicles.map(v => v.id)
    const newVal = !g.show_on_site
    await supabase.from('vozila_fleet').update({ show_on_site: newVal }).in('id', ids)
    setGroups(prev => prev.map(x => x.key === g.key ? { ...x, show_on_site: newVal } : x))
  }

  const totalVozila = groups.reduce((s, g) => s + g.total, 0)
  const totalSlobodna = groups.reduce((s, g) => s + g.slobodna, 0)
  const totalZauzeta = groups.reduce((s, g) => s + g.zauzeta, 0)
  const activeSeason = getActiveSeason()

  const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', color: '#111', boxSizing: 'border-box' }
  const lbl: React.CSSProperties = { fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4, fontWeight: 500 }

  return (
    <div>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#111', margin: 0 }}>Vozila</h1>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4, margin: 0 }}>
            {totalVozila} vozila · <span style={{ color: '#1D9E75', fontWeight: 600 }}>{totalSlobodna} slobodna</span> · <span style={{ color: '#dc2626', fontWeight: 600 }}>{totalZauzeta} zauzeta</span> danas
            {activeSeason && <span style={{ marginLeft: 8, background: '#E6F1FB', color: '#0C447C', padding: '1px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>📅 {activeSeason.name} ×{activeSeason.multiplier}</span>}
          </p>
        </div>
        <button onClick={() => setShowCatModal(true)}
          style={{ padding: '8px 14px', background: '#185FA5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          🏷️ Kategorije cijena
        </button>
      </div>

      {/* STATS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Ukupno', value: totalVozila, color: '#374151', bg: '#f9fafb', border: '#e5e7eb' },
          { label: 'Slobodna danas', value: totalSlobodna, color: '#1D9E75', bg: '#E1F5EE', border: '#5DCAA5' },
          { label: 'Zauzeta danas', value: totalZauzeta, color: '#dc2626', bg: '#FCEBEB', border: '#fecaca' },
        ].map(s => (
          <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 10, padding: '12px 16px' }}>
            <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 3 }}>{s.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* FILTERI */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '10px 14px', marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Pretraži..."
          style={{ ...inp, width: 180, marginBottom: 0 }} />
        <select value={filterClass} onChange={e => setFilterClass(e.target.value)} style={{ ...inp, width: 150, marginBottom: 0 }}>
          <option value="SVE">Sve klase</option>
          {VEHICLE_CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)} style={{ ...inp, width: 160, marginBottom: 0 }}>
          <option value="SVE">Sve kategorije</option>
          {priceCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={filterLok} onChange={e => setFilterLok(e.target.value)} style={{ ...inp, width: 140, marginBottom: 0 }}>
          {lokacije.map(l => <option key={l} value={l}>{l === 'SVE' ? 'Sve lokacije' : l}</option>)}
        </select>
        {(searchQ || filterClass !== 'SVE' || filterLok !== 'SVE' || filterCat !== 'SVE') && (
          <button onClick={() => { setSearchQ(''); setFilterClass('SVE'); setFilterLok('SVE'); setFilterCat('SVE') }}
            style={{ padding: '6px 10px', fontSize: 11, border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: 'pointer', color: '#6b7280' }}>✕ Reset</button>
        )}
        <span style={{ fontSize: 12, color: '#9ca3af', marginLeft: 'auto' }}>{filtered.length} modela</span>
      </div>

      {/* BULK TOOLBAR */}
      {selected.size > 0 && (
        <div style={{ background: '#1a1f2e', borderRadius: 10, padding: '10px 16px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>✓ {selected.size} odabrano</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[
              { key: 'price', label: '💰 Cijena' },
              { key: 'class', label: '🏷️ Klasa' },
              { key: 'category', label: '📊 Kategorija' },
              { key: 'site', label: '🌐 Sajt' },
            ].map(a => (
              <button key={a.key} onClick={() => { setBulkAction(a.key as any); setShowBulk(true) }}
                style={{ padding: '5px 12px', fontSize: 12, border: `1px solid ${bulkAction === a.key ? '#1D9E75' : '#374151'}`, borderRadius: 8, background: bulkAction === a.key ? '#1D9E75' : '#2d3748', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
                {a.label}
              </button>
            ))}
          </div>
          <button onClick={clearSelect} style={{ marginLeft: 'auto', padding: '5px 10px', fontSize: 11, border: '1px solid #4a5568', borderRadius: 8, background: 'transparent', cursor: 'pointer', color: '#9ca3af' }}>
            Poništi
          </button>
        </div>
      )}

      {/* BULK PANEL */}
      {showBulk && bulkAction && (
        <div style={{ background: '#f0fdf8', border: '1px solid #5DCAA5', borderRadius: 10, padding: '14px 16px', marginBottom: 12, display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            {bulkAction === 'price' && (
              <>
                <label style={lbl}>Nova cijena (€) za {selected.size} modela</label>
                <input type="number" value={bulkPrice} onChange={e => setBulkPrice(e.target.value)} placeholder="npr. 45" style={inp} />
              </>
            )}
            {bulkAction === 'class' && (
              <>
                <label style={lbl}>Nova klasa za {selected.size} modela</label>
                <select value={bulkClass} onChange={e => setBulkClass(e.target.value)} style={inp}>
                  <option value="">-- Odaberi --</option>
                  {VEHICLE_CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </>
            )}
            {bulkAction === 'category' && (
              <>
                <label style={lbl}>Nova kategorija cijena za {selected.size} modela</label>
                <select value={bulkCatId} onChange={e => setBulkCatId(e.target.value)} style={inp}>
                  <option value="">-- Bez kategorije --</option>
                  {priceCategories.map(c => <option key={c.id} value={c.id}>{c.name} (×{c.base_multiplier})</option>)}
                </select>
              </>
            )}
            {bulkAction === 'site' && (
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setBulkSite(true)} style={{ flex: 1, padding: '9px', border: `2px solid ${bulkSite ? '#1D9E75' : '#e5e7eb'}`, borderRadius: 8, background: bulkSite ? '#E1F5EE' : '#fff', cursor: 'pointer', fontSize: 13, fontWeight: bulkSite ? 700 : 400, color: bulkSite ? '#085041' : '#374151' }}>🌐 Prikaži na sajtu</button>
                <button onClick={() => setBulkSite(false)} style={{ flex: 1, padding: '9px', border: `2px solid ${!bulkSite ? '#dc2626' : '#e5e7eb'}`, borderRadius: 8, background: !bulkSite ? '#FCEBEB' : '#fff', cursor: 'pointer', fontSize: 13, fontWeight: !bulkSite ? 700 : 400, color: !bulkSite ? '#dc2626' : '#374151' }}>👁️ Sakrij sa sajta</button>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { setShowBulk(false); setBulkAction(null) }}
              style={{ padding: '9px 16px', border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 13, color: '#374151' }}>Odustani</button>
            <button onClick={saveBulk} disabled={bulkSaving}
              style={{ padding: '9px 20px', background: bulkSaving ? '#5DCAA5' : '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              {bulkSaving ? '...' : `✓ Primijeni`}
            </button>
          </div>
        </div>
      )}

      {/* SELECT ALL row */}
      {filtered.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, fontSize: 12, color: '#6b7280' }}>
          <button onClick={selected.size === filtered.length ? clearSelect : selectAll}
            style={{ padding: '4px 12px', fontSize: 11, border: '1px solid #d1d5db', borderRadius: 20, background: '#fff', cursor: 'pointer', color: '#374151' }}>
            {selected.size === filtered.length ? 'Poništi sve' : 'Odaberi sve'}
          </button>
          {selected.size > 0 && <span>{selected.size}/{filtered.length} odabrano</span>}
        </div>
      )}

      {/* GRID */}
      {loading ? (
        <div style={{ padding: 60, textAlign: 'center', color: '#9ca3af' }}>Učitavanje...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {filtered.map(g => {
            const isSelected = selected.has(g.key)
            const isExpanded = expanded.has(g.key)
            const isOnSite = g.show_on_site !== false
            const pct = g.total > 0 ? (g.slobodna / g.total) * 100 : 0
            const barColor = pct === 0 ? '#dc2626' : pct < 40 ? '#f97316' : '#1D9E75'
            const cat = priceCategories.find(c => c.id === g.price_category_id)
            const { final, breakdown } = getFinalPrice(g)

            return (
              <div key={g.key} style={{
                border: `2px solid ${isSelected ? '#1D9E75' : '#e5e7eb'}`,
                borderRadius: 12, background: isSelected ? '#f0fdf8' : '#fff',
                overflow: 'hidden', display: 'flex', flexDirection: 'column',
                boxShadow: isSelected ? '0 0 0 3px rgba(29,158,117,0.15)' : '0 1px 4px rgba(0,0,0,0.04)',
                opacity: isOnSite ? 1 : 0.6, transition: 'all 0.15s',
              }}>
                {/* SLIKA */}
                <div style={{ position: 'relative', height: 155, background: '#f3f4f6', overflow: 'hidden', cursor: 'pointer' }}
                  onClick={() => toggleSelect(g.key)}>
                  {g.image_url ? (
                    <img src={g.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      <div style={{ fontSize: 38, color: '#d1d5db' }}>🚗</div>
                      <span style={{ fontSize: 11, color: '#9ca3af' }}>Bez slike</span>
                    </div>
                  )}

                  {/* Checkbox */}
                  <div style={{ position: 'absolute', top: 8, left: 8, width: 22, height: 22, borderRadius: 6, border: `2px solid ${isSelected ? '#1D9E75' : 'rgba(255,255,255,0.8)'}`, background: isSelected ? '#1D9E75' : 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    {isSelected && <span style={{ color: '#fff', fontSize: 13, fontWeight: 900 }}>✓</span>}
                  </div>

                  {/* Sajt toggle */}
                  <div style={{ position: 'absolute', top: 8, right: 8 }}>
                    <button onClick={e => { e.stopPropagation(); toggleShowOnSite(g) }}
                      style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, fontWeight: 700, border: 'none', cursor: 'pointer', background: isOnSite ? 'rgba(29,158,117,0.9)' : 'rgba(107,114,128,0.8)', color: '#fff' }}>
                      {isOnSite ? '🌐' : '👁️'}
                    </button>
                  </div>

                  {/* Slobodnih badge */}
                  <div style={{ position: 'absolute', bottom: 8, left: 8 }}>
                    <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 20, fontWeight: 700, background: barColor, color: '#fff' }}>
                      {g.slobodna}/{g.total}
                    </span>
                  </div>

                  {/* Klasa badge */}
                  {g.vehicle_class && (
                    <div style={{ position: 'absolute', bottom: 8, right: 8 }}>
                      <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 20, fontWeight: 600, background: 'rgba(14,63,156,0.85)', color: '#fff' }}>
                        {g.vehicle_class}
                      </span>
                    </div>
                  )}
                </div>

                {/* INFO */}
                <div style={{ padding: '10px 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#111' }}>{g.marka} {g.model} {g.year}</div>

                  <div style={{ fontSize: 11, color: '#9ca3af', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {g.transmission && <span>⚙️ {g.transmission === 'automatic' ? 'Auto' : 'Manual'}</span>}
                    {g.fuel_type && <span>⛽ {g.fuel_type === 'diesel' ? 'Dizel' : g.fuel_type === 'petrol' ? 'Benzin' : g.fuel_type}</span>}
                    {g.seats && <span>👥 {g.seats}</span>}
                  </div>

                  {/* Kategorija cijene */}
                  {cat && (
                    <div style={{ fontSize: 11, background: '#E6F1FB', color: '#0C447C', padding: '2px 8px', borderRadius: 20, display: 'inline-block', width: 'fit-content', fontWeight: 600 }}>
                      📊 {cat.name} ×{cat.base_multiplier}
                    </div>
                  )}

                  {/* Progress */}
                  <div style={{ height: 3, background: '#f3f4f6', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 2 }} />
                  </div>

                  {/* Cijena */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontSize: 18, fontWeight: 700, color: '#1D9E75' }}>{final}€</span>
                      <span style={{ fontSize: 11, color: '#9ca3af' }}>/dan</span>
                      {final !== g.price_per_day && (
                        <div style={{ fontSize: 10, color: '#9ca3af' }}>
                          osnova {g.price_per_day}€ · {breakdown}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 5 }}>
                      <button onClick={() => { const n = new Set(expanded); n.has(g.key) ? n.delete(g.key) : n.add(g.key); setExpanded(n) }}
                        style={{ padding: '4px 8px', fontSize: 11, border: '1px solid #e5e7eb', borderRadius: 6, background: '#f9fafb', cursor: 'pointer', color: '#6b7280' }}>
                        {isExpanded ? '▲' : '▼'}{g.total}
                      </button>
                      <button onClick={() => openEdit(g)}
                        style={{ padding: '4px 12px', fontSize: 11, border: '1px solid #1D9E75', borderRadius: 6, background: '#E1F5EE', cursor: 'pointer', color: '#085041', fontWeight: 600 }}>
                        ✏️
                      </button>
                    </div>
                  </div>
                </div>

                {/* EXPAND */}
                {isExpanded && (
                  <div style={{ borderTop: '1px solid #f3f4f6', padding: '6px 12px 10px', background: '#fafafa' }}>
                    {g.vehicles.map(v => (
                      <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 11, borderBottom: '1px solid #f3f4f6' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#374151' }}>{v.license_plate || '—'}</span>
                          <span style={{ color: '#9ca3af' }}>📍 {v.lokacija}</span>
                        </div>
                        <span style={{ fontWeight: 600, color: v.fleet_status === 'available' ? '#1D9E75' : '#9ca3af' }}>
                          {v.fleet_status === 'available' ? '✓' : v.fleet_status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
          {filtered.length === 0 && (
            <div style={{ gridColumn: '1/-1', padding: 60, textAlign: 'center', color: '#9ca3af', border: '1px dashed #e5e7eb', borderRadius: 12 }}>
              Nema vozila za odabrane filtere.
            </div>
          )}
        </div>
      )}

      {/* SINGLE EDIT MODAL */}
      {editGroup && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 500, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>{editGroup.marka} {editGroup.model} {editGroup.year}</div>
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>{editGroup.total} vozila</div>
              </div>
              <button onClick={() => setEditGroup(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: '#9ca3af' }}>✕</button>
            </div>

            <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Sajt toggle */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: eSite ? '#E1F5EE' : '#f3f4f6', borderRadius: 10, border: `1px solid ${eSite ? '#5DCAA5' : '#e5e7eb'}` }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>🌐 Prikaži na sajtu</div>
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>{eSite ? 'Vidljivo posjetiocima' : 'Skriveno sa sajta'}</div>
                </div>
                <div onClick={() => setESite(v => !v)}
                  style={{ width: 44, height: 24, borderRadius: 12, background: eSite ? '#1D9E75' : '#d1d5db', cursor: 'pointer', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: eSite ? 22 : 2, transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                </div>
              </div>

              {/* Slika */}
              <div>
                <label style={lbl}>🖼️ Slika</label>
                {eImage && (
                  <div style={{ marginBottom: 8, borderRadius: 8, overflow: 'hidden', height: 120, position: 'relative' }}>
                    <img src={eImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button onClick={() => setEImage('')}
                      style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: 20, padding: '2px 8px', fontSize: 11, cursor: 'pointer' }}>
                      Ukloni
                    </button>
                  </div>
                )}
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '9px', border: '1px dashed #d1d5db', borderRadius: 8, cursor: 'pointer', fontSize: 12, color: '#6b7280', background: '#f9fafb', marginBottom: 6 }}>
                  {uploading ? '⏳ Upload...' : '📁 Odaberi sliku'}
                  <input type="file" accept="image/*" style={{ display: 'none' }} disabled={uploading}
                    onChange={async e => { const f = e.target.files?.[0]; if (!f) return; const u = await uploadImage(f); if (u) setEImage(u) }} />
                </label>
                <input value={eImage} onChange={e => setEImage(e.target.value)} placeholder="ili URL slike" style={{ ...inp, fontSize: 11 }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={lbl}>💰 Cijena (€/dan)</label>
                  <input type="number" value={ePrice} onChange={e => setEPrice(e.target.value)} placeholder={String(editGroup.price_per_day)} style={{ ...inp, fontWeight: 700, color: '#1D9E75', border: '1px solid #1D9E75' }} />
                </div>
                <div>
                  <label style={lbl}>👥 Mjesta</label>
                  <input type="number" value={eSeats} onChange={e => setESeats(e.target.value)} placeholder="5" style={inp} />
                </div>
                <div>
                  <label style={lbl}>🏷️ Klasa</label>
                  <select value={eClass} onChange={e => setEClass(e.target.value)} style={inp}>
                    <option value="">-- Klasa --</option>
                    {VEHICLE_CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>📊 Kategorija cijene</label>
                  <select value={eCatId} onChange={e => setECatId(e.target.value)} style={inp}>
                    <option value="">-- Bez kategorije --</option>
                    {priceCategories.map(c => <option key={c.id} value={c.id}>{c.name} ×{c.base_multiplier}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label style={lbl}>🔧 Oprema (zarezom)</label>
                <input value={eFeatures} onChange={e => setEFeatures(e.target.value)} placeholder="Klima, GPS, Bluetooth" style={inp} />
              </div>

              {/* Pregled cijene */}
              {eCatId && (
                <div style={{ background: '#f0fdf8', border: '1px solid #5DCAA5', borderRadius: 8, padding: '10px 12px', fontSize: 12 }}>
                  {(() => {
                    const cat = priceCategories.find(c => c.id === eCatId)
                    const base = parseFloat(ePrice) || editGroup.price_per_day
                    const catMult = cat?.base_multiplier || 1
                    const season = getActiveSeason()
                    const seasonMult = season?.multiplier || 1
                    const final = Math.round(base * catMult * seasonMult)
                    return (
                      <div>
                        <span style={{ color: '#085041', fontWeight: 600 }}>Finalna cijena danas: {final}€</span>
                        <span style={{ color: '#6b7280', marginLeft: 8 }}>
                          ({base}€ × {catMult} kat{season ? ` × ${seasonMult} sezona` : ''})
                        </span>
                      </div>
                    )
                  })()}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setEditGroup(null)}
                  style={{ flex: 1, padding: '10px', border: '1px solid #d1d5db', borderRadius: 8, background: 'transparent', fontSize: 13, cursor: 'pointer', color: '#374151' }}>
                  Odustani
                </button>
                <button onClick={saveEdit} disabled={eSaving}
                  style={{ flex: 2, padding: '10px', background: eSaving ? '#5DCAA5' : '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  {eSaving ? '⏳...' : `💾 Sačuvaj (${editGroup.total} vozila)`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* KATEGORIJE MODAL */}
      {showCatModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#fff' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>📊 Kategorije cijena</div>
              <button onClick={() => { setShowCatModal(false); setEditCat(null) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: '#9ca3af' }}>✕</button>
            </div>

            <div style={{ padding: '16px 22px' }}>
              {/* Lista kategorija */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                {priceCategories.map(c => (
                  <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: 8, background: c.is_active ? '#fff' : '#f9fafb' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#111' }}>{c.name}</div>
                      {c.description && <div style={{ fontSize: 11, color: '#9ca3af' }}>{c.description}</div>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 16, fontWeight: 700, color: c.base_multiplier > 1 ? '#dc2626' : c.base_multiplier < 1 ? '#1D9E75' : '#374151' }}>
                        ×{c.base_multiplier}
                      </span>
                      {c.default_price ? (
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#1D9E75', background: '#E1F5EE', padding: '2px 8px', borderRadius: 20 }}>
                          {c.default_price}€/dan
                        </span>
                      ) : null}
                      <button onClick={() => { setEditCat(c); setCatForm({ name: c.name, description: c.description || '', base_multiplier: String(c.base_multiplier), sort_order: String(c.sort_order), default_price: String(c.default_price || '') }) }}
                        style={{ padding: '3px 10px', fontSize: 11, border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: 'pointer', color: '#374151' }}>Uredi</button>
                      <button onClick={() => deleteCat(c.id)}
                        style={{ padding: '3px 8px', fontSize: 11, border: '1px solid #fecaca', borderRadius: 6, background: '#fff', cursor: 'pointer', color: '#dc2626' }}>✕</button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Forma */}
              <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#111', marginBottom: 12 }}>
                  {editCat ? 'Uredi kategoriju' : '+ Nova kategorija'}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div>
                    <label style={lbl}>Naziv *</label>
                    <input value={catForm.name} onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))} placeholder="npr. Economy" style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>Množitelj cijene</label>
                    <input type="number" step="0.1" min="0.1" max="5" value={catForm.base_multiplier}
                      onChange={e => setCatForm(f => ({ ...f, base_multiplier: e.target.value }))}
                      style={{ ...inp, fontWeight: 700, color: parseFloat(catForm.base_multiplier) > 1 ? '#dc2626' : parseFloat(catForm.base_multiplier) < 1 ? '#1D9E75' : '#374151' }} />
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={lbl}>Opis (opciono)</label>
                    <input value={catForm.description} onChange={e => setCatForm(f => ({ ...f, description: e.target.value }))} placeholder="npr. Ekonomična vozila do 1600cc" style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>💰 Podrazumijevana cijena (€/dan)</label>
                    <input type="number" step="1" value={catForm.default_price} onChange={e => setCatForm(f => ({ ...f, default_price: e.target.value }))}
                      placeholder="npr. 40" style={{ ...inp, fontWeight: 700, color: '#1D9E75', border: '1px solid #1D9E75' }} />
                    <div style={{ fontSize: 10, color: '#6b7280', marginTop: 3 }}>Automatski se primijeni kad dodijeliš ovu kategoriju vozilima</div>
                  </div>
                </div>
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 12, padding: '8px 10px', background: '#fff', borderRadius: 6, border: '1px solid #e5e7eb' }}>
                  Primjer: ×1.0 = osnovna cijena · ×1.5 = 50% skuplje · ×0.8 = 20% jeftinije
                  {catForm.base_multiplier && <span style={{ marginLeft: 8, fontWeight: 600 }}>→ 50€ × {catForm.base_multiplier} = {Math.round(50 * parseFloat(catForm.base_multiplier) || 50)}€</span>}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {editCat && (
                    <button onClick={() => { setEditCat(null); setCatForm({ name: '', description: '', base_multiplier: '1.0', sort_order: '0', default_price: '' }) }}
                      style={{ flex: 1, padding: '8px', border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 12, color: '#6b7280' }}>
                      Otkaži
                    </button>
                  )}
                  <button onClick={saveCat} disabled={catSaving || !catForm.name}
                    style={{ flex: 2, padding: '8px', background: catSaving ? '#5DCAA5' : '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    {catSaving ? '...' : editCat ? 'Sačuvaj izmjene' : '+ Dodaj kategoriju'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
