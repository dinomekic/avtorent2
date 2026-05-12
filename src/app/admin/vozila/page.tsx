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
}

type VehicleGroup = {
  key: string
  marka: string
  model: string
  year: number | null
  transmission: string | null
  fuel_type: string | null
  image_url: string | null
  vehicle_class: string | null
  seats: number | null
  features: string[] | null
  price_per_day: number
  vehicles: FleetVehicle[]
  total: number
  slobodna: number
  zauzeta: number
}

const VEHICLE_CLASSES = ['Hatchback', 'Medium', 'Sedan', 'SUV', 'Station Wagon', 'Luxury', 'Van', 'Convertible']
const CLASS_ICONS: Record<string, string> = {
  'Hatchback': '🚗', 'Medium': '🚗', 'Sedan': '🚗', 'SUV': '🚙',
  'Station Wagon': '🚗', 'Luxury': '🏎️', 'Van': '🚐', 'Convertible': '🚘',
}

function getIcon(cls: string | null) { return CLASS_ICONS[cls || ''] || '🚗' }

export default function AdminVozilaPage() {
  const [groups, setGroups] = useState<VehicleGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQ, setSearchQ] = useState('')
  const [filterClass, setFilterClass] = useState('SVE')
  const [filterLok, setFilterLok] = useState('SVE')

  // Edit state
  const [editGroup, setEditGroup] = useState<VehicleGroup | null>(null)
  const [showEdit, setShowEdit] = useState(false)
  const [bulkPrice, setBulkPrice] = useState('')
  const [bulkClass, setBulkClass] = useState('')
  const [bulkImage, setBulkImage] = useState('')
  const [bulkFeatures, setBulkFeatures] = useState('')
  const [bulkSeats, setBulkSeats] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  // Expand grupe
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const today = new Date().toISOString().split('T')[0]

  const loadData = useCallback(async () => {
    setLoading(true)
    const [{ data: vozila }, { data: rezervacije }] = await Promise.all([
      supabase.from('vozila_fleet').select('*').order('marka'),
      supabase.from('rezervacije')
        .select('br_tablica, od_datuma, do_datuma, daily_status')
        .neq('daily_status', 'Nije izdato')
        .lte('od_datuma', today)
        .gt('do_datuma', today),
    ])

    if (!vozila) { setLoading(false); return }

    // Zauzete tablice danas
    const zauzeteTablice = new Set((rezervacije || []).map(r => r.br_tablica))

    // Grupiši po marka+model+year
    const groupMap = new Map<string, VehicleGroup>()

    for (const v of vozila) {
      const key = `${v.marka}__${v.model}__${v.year}`
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          key,
          marka: v.marka || '',
          model: v.model || '',
          year: v.year,
          transmission: v.transmission,
          fuel_type: v.fuel_type,
          image_url: v.image_url,
          vehicle_class: v.vehicle_class,
          seats: v.seats,
          features: v.features,
          price_per_day: v.price_per_day || 0,
          vehicles: [],
          total: 0,
          slobodna: 0,
          zauzeta: 0,
        })
      }
      const g = groupMap.get(key)!
      g.vehicles.push(v)
      g.total++
      if (v.fleet_status === 'available') {
        if (zauzeteTablice.has(v.license_plate)) g.zauzeta++
        else g.slobodna++
      }
      // Uzmi sliku od prvog koji ima
      if (!g.image_url && v.image_url) g.image_url = v.image_url
      // Uzmi klasu od prvog koji ima
      if (!g.vehicle_class && v.vehicle_class) g.vehicle_class = v.vehicle_class
      // Uzmi features od prvog koji ima
      if ((!g.features || g.features.length === 0) && v.features && v.features.length > 0) g.features = v.features
    }

    setGroups(Array.from(groupMap.values()).sort((a, b) => a.marka.localeCompare(b.marka) || a.model.localeCompare(b.model)))
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
    setShowEdit(true)
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
    const updates: any = {}
    if (bulkPrice) updates.price_per_day = parseFloat(bulkPrice)
    if (bulkClass) updates.vehicle_class = bulkClass
    if (bulkImage) updates.image_url = bulkImage
    if (bulkSeats) updates.seats = parseInt(bulkSeats)
    if (bulkFeatures !== undefined) updates.features = bulkFeatures.split(',').map(s => s.trim()).filter(Boolean)

    if (Object.keys(updates).length > 0) {
      await supabase.from('vozila_fleet').update(updates).in('id', ids)
    }

    setSaving(false)
    setShowEdit(false)
    setEditGroup(null)
    loadData()
  }

  function toggleExpand(key: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  // Stats
  const totalVozila = groups.reduce((s, g) => s + g.total, 0)
  const totalSlobodna = groups.reduce((s, g) => s + g.slobodna, 0)
  const totalZauzeta = groups.reduce((s, g) => s + g.zauzeta, 0)

  const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', color: '#111', boxSizing: 'border-box' }
  const lbl: React.CSSProperties = { fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 3, fontWeight: 500 }

  return (
    <div>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#111', margin: 0 }}>Vozila</h1>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
            {totalVozila} vozila ukupno · <span style={{ color: '#1D9E75', fontWeight: 600 }}>{totalSlobodna} slobodna</span> · <span style={{ color: '#dc2626', fontWeight: 600 }}>{totalZauzeta} zauzeta</span> danas
          </p>
        </div>
      </div>

      {/* STATS KARTICE */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Ukupno vozila', value: totalVozila, color: '#374151', bg: '#f9fafb' },
          { label: 'Slobodna danas', value: totalSlobodna, color: '#1D9E75', bg: '#E1F5EE' },
          { label: 'Zauzeta danas', value: totalZauzeta, color: '#dc2626', bg: '#FCEBEB' },
        ].map(s => (
          <div key={s.label} style={{ background: s.bg, border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 18px' }}>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* FILTERI */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
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

      {/* LISTA GRUPA */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Učitavanje...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(g => {
            const isExpanded = expanded.has(g.key)
            const slobodnoPercent = g.total > 0 ? (g.slobodna / g.total) * 100 : 0
            const barColor = slobodnoPercent === 0 ? '#dc2626' : slobodnoPercent < 40 ? '#f97316' : '#1D9E75'

            return (
              <div key={g.key} style={{ border: '1px solid #e5e7eb', borderRadius: 10, background: '#fff', overflow: 'hidden' }}>
                {/* HEADER GRUPE */}
                <div style={{ display: 'flex', gap: 0 }}>
                  {/* Slika */}
                  <div style={{ width: 100, height: 72, background: '#f3f4f6', flexShrink: 0, overflow: 'hidden', cursor: 'pointer' }} onClick={() => openEdit(g)}>
                    {g.image_url ? (
                      <img src={g.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, color: '#d1d5db' }}>
                        {getIcon(g.vehicle_class)}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, padding: '10px 14px', minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, fontSize: 14, color: '#111' }}>
                            {g.marka} {g.model} {g.year}
                          </span>
                          {g.vehicle_class && (
                            <span style={{ fontSize: 10, background: '#E6F1FB', color: '#0C447C', padding: '1px 7px', borderRadius: 20, fontWeight: 600 }}>
                              {g.vehicle_class}
                            </span>
                          )}
                          {g.transmission && (
                            <span style={{ fontSize: 10, background: '#f3f4f6', color: '#6b7280', padding: '1px 6px', borderRadius: 20 }}>
                              {g.transmission === 'automatic' ? 'Automat' : g.transmission === 'manual' ? 'Manual' : g.transmission}
                            </span>
                          )}
                        </div>

                        {/* Progress bar slobodnih */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <div style={{ flex: 1, maxWidth: 120, height: 5, background: '#f3f4f6', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${slobodnoPercent}%`, background: barColor, borderRadius: 3, transition: 'width 0.3s' }} />
                          </div>
                          <span style={{ fontSize: 11, color: barColor, fontWeight: 700 }}>
                            {g.slobodna}/{g.total} slobodnih
                          </span>
                          {g.zauzeta > 0 && (
                            <span style={{ fontSize: 11, color: '#dc2626' }}>· {g.zauzeta} zauzeto</span>
                          )}
                        </div>

                        <div style={{ fontSize: 11, color: '#9ca3af', display: 'flex', gap: 8 }}>
                          {g.seats && <span>👥 {g.seats} mjesta</span>}
                          {g.fuel_type && <span>⛽ {g.fuel_type === 'diesel' ? 'Dizel' : g.fuel_type === 'petrol' ? 'Benzin' : g.fuel_type}</span>}
                          {g.features && g.features.length > 0 && (
                            <span>{g.features.slice(0, 2).join(', ')}{g.features.length > 2 ? '...' : ''}</span>
                          )}
                        </div>
                      </div>

                      {/* Cijena + akcije */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: 10 }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 18, fontWeight: 700, color: '#1D9E75' }}>{g.price_per_day}€</div>
                          <div style={{ fontSize: 10, color: '#9ca3af' }}>po danu</div>
                        </div>
                        <button onClick={() => openEdit(g)}
                          style={{ padding: '5px 12px', fontSize: 11, border: '1px solid #1D9E75', borderRadius: 8, background: '#E1F5EE', cursor: 'pointer', color: '#085041', fontWeight: 600 }}>
                          ✏️ Uredi
                        </button>
                        <button onClick={() => toggleExpand(g.key)}
                          style={{ padding: '5px 10px', fontSize: 11, border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: 'pointer', color: '#6b7280' }}>
                          {isExpanded ? '▲' : '▼'} {g.total}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* EXPAND — lista vozila */}
                {isExpanded && (
                  <div style={{ borderTop: '1px solid #f3f4f6', padding: '8px 14px 10px' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                      Pojedinačna vozila
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {g.vehicles.map(v => {
                        const statusColor = v.fleet_status === 'available' ? '#1D9E75' : '#9ca3af'
                        const statusLabel = v.fleet_status === 'available' ? 'Slobodno' : v.fleet_status === 'rented' ? 'Iznajmljeno' : v.fleet_status
                        return (
                          <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 8px', background: '#f9fafb', borderRadius: 6, fontSize: 12 }}>
                            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                              <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#374151' }}>{v.license_plate || '—'}</span>
                              <span style={{ color: '#9ca3af' }}>📍 {v.lokacija}</span>
                              {v.color && <span style={{ color: '#9ca3af' }}>🎨 {v.color}</span>}
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 600, color: statusColor }}>{statusLabel}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {filtered.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', border: '1px dashed #e5e7eb', borderRadius: 12 }}>
              Nema vozila za odabrane filtere.
            </div>
          )}
        </div>
      )}

      {/* EDIT MODAL */}
      {showEdit && editGroup && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, maxWidth: 480, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#111' }}>{editGroup.marka} {editGroup.model} {editGroup.year}</div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Bulk izmjena — {editGroup.total} vozila</div>
              </div>
              <button onClick={() => setShowEdit(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#9ca3af' }}>✕</button>
            </div>

            {/* Preview slike */}
            {bulkImage && (
              <div style={{ marginBottom: 14, borderRadius: 8, overflow: 'hidden', height: 120 }}>
                <img src={bulkImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Cijena */}
              <div>
                <label style={lbl}>💰 Cijena po danu (€) — primjenjuje se na sva vozila grupe</label>
                <input type="number" step="1" value={bulkPrice} onChange={e => setBulkPrice(e.target.value)}
                  placeholder={`Trenutno: ${editGroup.price_per_day}€`}
                  style={{ ...inp, fontSize: 18, fontWeight: 700, color: '#1D9E75', borderColor: '#1D9E75' }} />
              </div>

              {/* Klasa */}
              <div>
                <label style={lbl}>🏷️ Klasa vozila (za sajt filter)</label>
                <select value={bulkClass} onChange={e => setBulkClass(e.target.value)} style={inp}>
                  <option value="">-- Odaberi klasu --</option>
                  {VEHICLE_CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {/* Slika */}
              <div>
                <label style={lbl}>🖼️ Slika vozila</label>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px', border: '1px dashed #d1d5db', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: '#6b7280', background: '#f9fafb', marginBottom: 6 }}>
                  {uploading ? 'Uploaduje se...' : '+ Odaberi sliku'}
                  <input type="file" accept="image/*" style={{ display: 'none' }} disabled={uploading}
                    onChange={async e => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      const url = await uploadImage(file)
                      if (url) setBulkImage(url)
                    }} />
                </label>
                {bulkImage && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input value={bulkImage} onChange={e => setBulkImage(e.target.value)} placeholder="ili unesi URL slike" style={{ ...inp, fontSize: 11 }} />
                    <button onClick={() => setBulkImage('')} style={{ padding: '6px 8px', fontSize: 11, border: '1px solid #fecaca', borderRadius: 6, background: 'transparent', cursor: 'pointer', color: '#dc2626', whiteSpace: 'nowrap' as const }}>Ukloni</button>
                  </div>
                )}
                {!bulkImage && (
                  <input value={bulkImage} onChange={e => setBulkImage(e.target.value)} placeholder="ili unesi URL slike direktno" style={{ ...inp, fontSize: 12 }} />
                )}
              </div>

              {/* Mjesta */}
              <div>
                <label style={lbl}>👥 Broj mjesta</label>
                <input type="number" value={bulkSeats} onChange={e => setBulkSeats(e.target.value)} placeholder="5" style={inp} />
              </div>

              {/* Oprema */}
              <div>
                <label style={lbl}>🔧 Oprema (zarezom odvojeno)</label>
                <input value={bulkFeatures} onChange={e => setBulkFeatures(e.target.value)}
                  placeholder="Klima, GPS, Bluetooth, Parking senzori"
                  style={inp} />
              </div>

              {/* Info */}
              <div style={{ background: '#f0fdf8', border: '1px solid #5DCAA5', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#085041' }}>
                ℹ️ Izmjene će biti primjenjene na <strong>sva {editGroup.total} vozila</strong> u grupi {editGroup.marka} {editGroup.model} {editGroup.year}.
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button onClick={() => setShowEdit(false)}
                  style={{ flex: 1, padding: 10, border: '1px solid #d1d5db', borderRadius: 8, background: 'transparent', fontSize: 13, cursor: 'pointer', color: '#374151' }}>
                  Odustani
                </button>
                <button onClick={saveBulk} disabled={saving}
                  style={{ flex: 2, padding: 10, background: saving ? '#5DCAA5' : '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  {saving ? 'Snimanje...' : `💾 Primijeni na ${editGroup.total} vozila`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
