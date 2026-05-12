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
  show_on_site: boolean | null
}

type VehicleGroup = {
  key: string; marka: string; model: string; year: number | null
  transmission: string | null; fuel_type: string | null
  image_url: string | null; vehicle_class: string | null
  seats: number | null; features: string[] | null
  price_per_day: number; show_on_site: boolean
  vehicles: FleetVehicle[]
  total: number; slobodna: number; zauzeta: number
}

const VEHICLE_CLASSES = ['Hatchback', 'Medium', 'Sedan', 'SUV', 'Station Wagon', 'Luxury', 'Van', 'Convertible']

export default function AdminVozilaPage() {
  const [groups, setGroups] = useState<VehicleGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQ, setSearchQ] = useState('')
  const [filterClass, setFilterClass] = useState('SVE')
  const [filterLok, setFilterLok] = useState('SVE')

  // Edit modal
  const [editGroup, setEditGroup] = useState<VehicleGroup | null>(null)
  const [bulkPrice, setBulkPrice] = useState('')
  const [bulkClass, setBulkClass] = useState('')
  const [bulkImage, setBulkImage] = useState('')
  const [bulkFeatures, setBulkFeatures] = useState('')
  const [bulkSeats, setBulkSeats] = useState('')
  const [bulkShowOnSite, setBulkShowOnSite] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  // Expand
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const today = new Date().toISOString().split('T')[0]

  const loadData = useCallback(async () => {
    setLoading(true)
    const [{ data: vozila }, { data: rezervacije }] = await Promise.all([
      supabase.from('vozila_fleet').select('*').order('marka'),
      supabase.from('rezervacije')
        .select('br_tablica')
        .neq('daily_status', 'Nije izdato')
        .lte('od_datuma', today)
        .gt('do_datuma', today),
    ])
    if (!vozila) { setLoading(false); return }

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
          vehicles: [], total: 0, slobodna: 0, zauzeta: 0,
        })
      }
      const g = groupMap.get(key)!
      g.vehicles.push(v)
      g.total++
      if (v.fleet_status === 'available') {
        if (zauzeteTablice.has(v.license_plate)) g.zauzeta++
        else g.slobodna++
      }
      if (!g.image_url && v.image_url) g.image_url = v.image_url
      if (!g.vehicle_class && v.vehicle_class) g.vehicle_class = v.vehicle_class
      if ((!g.features || !g.features.length) && v.features?.length) g.features = v.features
      if (!g.seats && v.seats) g.seats = v.seats
      if (v.show_on_site === false) g.show_on_site = false
    }

    setGroups(Array.from(groupMap.values()).sort((a, b) =>
      a.marka.localeCompare(b.marka) || a.model.localeCompare(b.model)
    ))
    setLoading(false)
  }, [today])

  useEffect(() => { loadData() }, [loadData])

  const lokacije = ['SVE', ...Array.from(new Set(groups.flatMap(g => g.vehicles.map(v => v.lokacija)).filter(Boolean)))]

  const filtered = groups.filter(g => {
    const q = searchQ.toLowerCase()
    const matchQ = !q || g.marka.toLowerCase().includes(q) || g.model.toLowerCase().includes(q)
    const matchClass = filterClass === 'SVE' || g.vehicle_class === filterClass
    const matchLok = filterLok === 'SVE' || g.vehicles.some(v => v.lokacija === filterLok)
    return matchQ && matchClass && matchLok
  })

  function openEdit(g: VehicleGroup) {
    setEditGroup(g)
    setBulkPrice(String(g.price_per_day || ''))
    setBulkClass(g.vehicle_class || '')
    setBulkImage(g.image_url || '')
    setBulkFeatures((g.features || []).join(', '))
    setBulkSeats(String(g.seats || ''))
    setBulkShowOnSite(g.show_on_site !== false)
  }

  async function uploadImage(file: File): Promise<string | null> {
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `fleet/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('vehicle-images').upload(path, file, { upsert: true })
    if (error) { setUploading(false); return null }
    const { data } = supabase.storage.from('vehicle-images').getPublicUrl(path)
    setUploading(false)
    return data.publicUrl
  }

  async function saveBulk() {
    if (!editGroup) return
    setSaving(true)
    const ids = editGroup.vehicles.map(v => v.id)
    const updates: any = { show_on_site: bulkShowOnSite }
    if (bulkPrice) updates.price_per_day = parseFloat(bulkPrice)
    if (bulkClass) updates.vehicle_class = bulkClass
    if (bulkImage !== editGroup.image_url) updates.image_url = bulkImage || null
    if (bulkSeats) updates.seats = parseInt(bulkSeats)
    updates.features = bulkFeatures.split(',').map((s: string) => s.trim()).filter(Boolean)
    await supabase.from('vozila_fleet').update(updates).in('id', ids)
    setSaving(false)
    setEditGroup(null)
    loadData()
  }

  // Quick toggle show_on_site
  async function toggleShowOnSite(g: VehicleGroup) {
    const ids = g.vehicles.map(v => v.id)
    const newVal = !g.show_on_site
    await supabase.from('vozila_fleet').update({ show_on_site: newVal }).in('id', ids)
    setGroups(prev => prev.map(x => x.key === g.key ? { ...x, show_on_site: newVal } : x))
  }

  const totalVozila = groups.reduce((s, g) => s + g.total, 0)
  const totalSlobodna = groups.reduce((s, g) => s + g.slobodna, 0)
  const totalZauzeta = groups.reduce((s, g) => s + g.zauzeta, 0)

  const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', color: '#111', boxSizing: 'border-box' }
  const lbl: React.CSSProperties = { fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4, fontWeight: 500 }

  return (
    <div>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#111', margin: 0 }}>Vozila</h1>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4, margin: 0 }}>
            {totalVozila} vozila · <span style={{ color: '#1D9E75', fontWeight: 600 }}>{totalSlobodna} slobodna</span> · <span style={{ color: '#dc2626', fontWeight: 600 }}>{totalZauzeta} zauzeta</span> danas
          </p>
        </div>
      </div>

      {/* STATS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Ukupno vozila', value: totalVozila, color: '#374151', bg: '#f9fafb', border: '#e5e7eb' },
          { label: 'Slobodna danas', value: totalSlobodna, color: '#1D9E75', bg: '#E1F5EE', border: '#5DCAA5' },
          { label: 'Zauzeta danas', value: totalZauzeta, color: '#dc2626', bg: '#FCEBEB', border: '#fecaca' },
        ].map(s => (
          <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 10, padding: '14px 18px' }}>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* FILTERI */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 16px', marginBottom: 20, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Pretraži marku, model..."
          style={{ ...inp, width: 220, marginBottom: 0 }} />
        <select value={filterClass} onChange={e => setFilterClass(e.target.value)} style={{ ...inp, width: 160, marginBottom: 0 }}>
          <option value="SVE">Sve klase</option>
          {VEHICLE_CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filterLok} onChange={e => setFilterLok(e.target.value)} style={{ ...inp, width: 150, marginBottom: 0 }}>
          {lokacije.map(l => <option key={l} value={l}>{l === 'SVE' ? 'Sve lokacije' : l}</option>)}
        </select>
        {(searchQ || filterClass !== 'SVE' || filterLok !== 'SVE') && (
          <button onClick={() => { setSearchQ(''); setFilterClass('SVE'); setFilterLok('SVE') }}
            style={{ padding: '7px 12px', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: 'pointer', color: '#6b7280' }}>
            Poništi
          </button>
        )}
        <span style={{ fontSize: 12, color: '#9ca3af', marginLeft: 'auto' }}>{filtered.length} modela</span>
      </div>

      {/* GRID */}
      {loading ? (
        <div style={{ padding: 60, textAlign: 'center', color: '#9ca3af' }}>Učitavanje...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {filtered.map(g => {
            const slobodnoPercent = g.total > 0 ? (g.slobodna / g.total) * 100 : 0
            const barColor = slobodnoPercent === 0 ? '#dc2626' : slobodnoPercent < 40 ? '#f97316' : '#1D9E75'
            const isExpanded = expanded.has(g.key)
            const isOnSite = g.show_on_site !== false

            return (
              <div key={g.key} style={{
                border: '1px solid #e5e7eb', borderRadius: 12, background: '#fff',
                overflow: 'hidden', display: 'flex', flexDirection: 'column',
                boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                opacity: isOnSite ? 1 : 0.65,
                transition: 'opacity 0.2s',
              }}>
                {/* SLIKA */}
                <div style={{ position: 'relative', height: 160, background: '#f3f4f6', overflow: 'hidden' }}>
                  {g.image_url ? (
                    <img src={g.image_url} alt={`${g.marka} ${g.model}`}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      <div style={{ fontSize: 42, color: '#d1d5db' }}>🚗</div>
                      <button onClick={() => openEdit(g)}
                        style={{ fontSize: 11, padding: '4px 12px', border: '1px dashed #d1d5db', borderRadius: 20, background: 'rgba(255,255,255,0.9)', cursor: 'pointer', color: '#6b7280' }}>
                        + Dodaj sliku
                      </button>
                    </div>
                  )}

                  {/* Badge slobodnih */}
                  <div style={{ position: 'absolute', bottom: 8, left: 8 }}>
                    <span style={{
                      fontSize: 11, padding: '3px 8px', borderRadius: 20, fontWeight: 700,
                      background: slobodnoPercent === 0 ? '#dc2626' : slobodnoPercent < 40 ? '#f97316' : '#1D9E75',
                      color: '#fff',
                    }}>
                      {g.slobodna}/{g.total} slobodnih
                    </span>
                  </div>

                  {/* Toggle sajt */}
                  <div style={{ position: 'absolute', top: 8, right: 8 }}>
                    <button onClick={() => toggleShowOnSite(g)}
                      title={isOnSite ? 'Prikazuje se na sajtu — klikni da sakriješ' : 'Skriveno sa sajta — klikni da prikazuješ'}
                      style={{
                        fontSize: 11, padding: '3px 8px', borderRadius: 20, fontWeight: 700, border: 'none',
                        cursor: 'pointer', background: isOnSite ? 'rgba(29,158,117,0.9)' : 'rgba(107,114,128,0.85)',
                        color: '#fff',
                      }}>
                      {isOnSite ? '🌐 Na sajtu' : '👁️ Skriveno'}
                    </button>
                  </div>

                  {/* Klasa badge */}
                  {g.vehicle_class && (
                    <div style={{ position: 'absolute', top: 8, left: 8 }}>
                      <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, fontWeight: 600, background: 'rgba(14,63,156,0.85)', color: '#fff' }}>
                        {g.vehicle_class}
                      </span>
                    </div>
                  )}
                </div>

                {/* INFO */}
                <div style={{ padding: '12px 14px', flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {/* Naziv */}
                  <div style={{ fontWeight: 700, fontSize: 15, color: '#111' }}>
                    {g.marka} {g.model} {g.year}
                  </div>

                  {/* Meta */}
                  <div style={{ fontSize: 11, color: '#9ca3af', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {g.transmission && <span>⚙️ {g.transmission === 'automatic' ? 'Automat' : 'Manual'}</span>}
                    {g.fuel_type && <span>⛽ {g.fuel_type === 'diesel' ? 'Dizel' : g.fuel_type === 'petrol' ? 'Benzin' : g.fuel_type}</span>}
                    {g.seats && <span>👥 {g.seats}</span>}
                  </div>

                  {/* Features */}
                  {g.features && g.features.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {g.features.slice(0, 3).map(f => (
                        <span key={f} style={{ fontSize: 10, background: '#f3f4f6', color: '#6b7280', padding: '2px 6px', borderRadius: 10 }}>{f}</span>
                      ))}
                      {g.features.length > 3 && <span style={{ fontSize: 10, color: '#9ca3af' }}>+{g.features.length - 3}</span>}
                    </div>
                  )}

                  {/* Progress bar */}
                  <div style={{ height: 4, background: '#f3f4f6', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${slobodnoPercent}%`, background: barColor, borderRadius: 2, transition: 'width 0.3s' }} />
                  </div>

                  {/* Cijena + akcije */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                    <div>
                      <span style={{ fontSize: 20, fontWeight: 700, color: '#1D9E75' }}>{g.price_per_day}€</span>
                      <span style={{ fontSize: 11, color: '#9ca3af' }}>/dan</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => toggleExpand(g.key)}
                        style={{ padding: '5px 10px', fontSize: 11, border: '1px solid #e5e7eb', borderRadius: 8, background: '#f9fafb', cursor: 'pointer', color: '#6b7280' }}>
                        {isExpanded ? '▲' : '▼'} {g.total}
                      </button>
                      <button onClick={() => openEdit(g)}
                        style={{ padding: '5px 14px', fontSize: 12, border: '1px solid #1D9E75', borderRadius: 8, background: '#E1F5EE', cursor: 'pointer', color: '#085041', fontWeight: 600 }}>
                        ✏️ Uredi
                      </button>
                    </div>
                  </div>
                </div>

                {/* EXPAND — lista vozila */}
                {isExpanded && (
                  <div style={{ borderTop: '1px solid #f3f4f6', padding: '8px 14px 12px', background: '#fafafa' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                      Tablice
                    </div>
                    {g.vehicles.map(v => (
                      <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', fontSize: 12, borderBottom: '1px solid #f3f4f6' }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#374151' }}>{v.license_plate || '—'}</span>
                          <span style={{ fontSize: 10, color: '#9ca3af' }}>📍 {v.lokacija}</span>
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 600, color: v.fleet_status === 'available' ? '#1D9E75' : '#9ca3af' }}>
                          {v.fleet_status === 'available' ? '✓ Slobodno' : v.fleet_status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          {filtered.length === 0 && (
            <div style={{ gridColumn: '1 / -1', padding: 60, textAlign: 'center', color: '#9ca3af', border: '1px dashed #e5e7eb', borderRadius: 12 }}>
              Nema vozila za odabrane filtere.
            </div>
          )}
        </div>
      )}

      {/* EDIT MODAL */}
      {editGroup && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 500, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            {/* Modal header */}
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#111' }}>{editGroup.marka} {editGroup.model} {editGroup.year}</div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Bulk izmjena · {editGroup.total} vozila</div>
              </div>
              <button onClick={() => setEditGroup(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: '#9ca3af', lineHeight: 1 }}>✕</button>
            </div>

            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Prikaz na sajtu toggle */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: bulkShowOnSite ? '#E1F5EE' : '#f3f4f6', borderRadius: 10, border: `1px solid ${bulkShowOnSite ? '#5DCAA5' : '#e5e7eb'}` }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>🌐 Prikaži na sajtu</div>
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                    {bulkShowOnSite ? 'Vozilo je vidljivo posjetiocima' : 'Vozilo je skriveno sa sajta'}
                  </div>
                </div>
                <div onClick={() => setBulkShowOnSite(v => !v)}
                  style={{ width: 44, height: 24, borderRadius: 12, background: bulkShowOnSite ? '#1D9E75' : '#d1d5db', cursor: 'pointer', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: bulkShowOnSite ? 22 : 2, transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                </div>
              </div>

              {/* Slika */}
              <div>
                <label style={lbl}>🖼️ Slika vozila</label>
                {bulkImage && (
                  <div style={{ marginBottom: 8, borderRadius: 8, overflow: 'hidden', height: 130, position: 'relative' }}>
                    <img src={bulkImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button onClick={() => setBulkImage('')}
                      style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: 20, padding: '3px 8px', fontSize: 11, cursor: 'pointer' }}>
                      Ukloni
                    </button>
                  </div>
                )}
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px', border: '1px dashed #d1d5db', borderRadius: 8, cursor: uploading ? 'not-allowed' : 'pointer', fontSize: 13, color: '#6b7280', background: '#f9fafb', marginBottom: 6 }}>
                  {uploading ? '⏳ Uploaduje se...' : '📁 Odaberi sliku'}
                  <input type="file" accept="image/*" style={{ display: 'none' }} disabled={uploading}
                    onChange={async e => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      const url = await uploadImage(file)
                      if (url) setBulkImage(url)
                    }} />
                </label>
                <input value={bulkImage} onChange={e => setBulkImage(e.target.value)}
                  placeholder="ili unesi URL slike direktno..."
                  style={{ ...inp, fontSize: 12, color: '#6b7280' }} />
              </div>

              {/* Cijena */}
              <div>
                <label style={lbl}>💰 Cijena po danu (€)</label>
                <input type="number" step="1" value={bulkPrice} onChange={e => setBulkPrice(e.target.value)}
                  placeholder={`Trenutno: ${editGroup.price_per_day}€`}
                  style={{ ...inp, fontSize: 16, fontWeight: 700, color: '#1D9E75', border: '1px solid #1D9E75' }} />
              </div>

              {/* Klasa */}
              <div>
                <label style={lbl}>🏷️ Klasa vozila</label>
                <select value={bulkClass} onChange={e => setBulkClass(e.target.value)} style={inp}>
                  <option value="">-- Odaberi klasu --</option>
                  {VEHICLE_CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {/* Mjesta + features */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>
                <div>
                  <label style={lbl}>👥 Mjesta</label>
                  <input type="number" value={bulkSeats} onChange={e => setBulkSeats(e.target.value)} placeholder="5" style={inp} />
                </div>
                <div>
                  <label style={lbl}>🔧 Oprema (zarezom)</label>
                  <input value={bulkFeatures} onChange={e => setBulkFeatures(e.target.value)}
                    placeholder="Klima, GPS, Bluetooth" style={inp} />
                </div>
              </div>

              {/* Info */}
              <div style={{ background: '#f0fdf8', border: '1px solid #5DCAA5', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#085041' }}>
                Primjenjuje se na <strong>sva {editGroup.total} vozila</strong> modela {editGroup.marka} {editGroup.model} {editGroup.year}
              </div>

              {/* Akcije */}
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setEditGroup(null)}
                  style={{ flex: 1, padding: '11px', border: '1px solid #d1d5db', borderRadius: 8, background: 'transparent', fontSize: 13, cursor: 'pointer', color: '#374151' }}>
                  Odustani
                </button>
                <button onClick={saveBulk} disabled={saving}
                  style={{ flex: 2, padding: '11px', background: saving ? '#5DCAA5' : '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
                  {saving ? '⏳ Snimanje...' : `💾 Sačuvaj za ${editGroup.total} vozila`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  function toggleExpand(key: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }
}
