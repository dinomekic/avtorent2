'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ─── TIPOVI ───────────────────────────────────────────────
type FleetVehicle = {
  id: number
  name: string
  license_plate: string | null
  vin: string | null
  category: string
  transmission: string
  fuel_type: string
  color: string | null
  year: number | null
  seats: number | null
  engine_cc: number | null
  power_kw: number | null
  weight_kg: number | null
  price_per_day: number
  is_available: boolean
  image_url: string | null
  marka: string | null
  model: string | null
  istek_reg: string | null
  vlasnik: string | null
  mjesto_reg: string | null
  vrsta_vozila: string | null
  stare_tablice: string | null
  fleet_status: string
  lokacija: string
  purchase_from: string | null
  purchase_price: number | null
  purchase_date: string | null
  current_mileage: number | null
  fleet_notes: string | null
  dana_do_isteka: number | null
  agregirani_2: string | null
}

// ─── KONSTANTE ────────────────────────────────────────────
const LOKACIJE = ['CRNA GORA', 'BiH', 'SRBIJA', 'ALBANIJA']

const FLEET_STATUS_OPTS = [
  { value: 'available',      label: 'Za izdavanje',    color: '#1D9E75', bg: '#E1F5EE' },
  { value: 'rented',         label: 'Iznajmljeno',     color: '#185FA5', bg: '#E6F1FB' },
  { value: 'service_planet', label: 'Servis Planet',   color: '#BA7517', bg: '#FAEEDA' },
  { value: 'service_other',  label: 'Servis drugi',    color: '#7C3AED', bg: '#EDE9FE' },
  { value: 'damaged',        label: 'Havarisan',       color: '#DC2626', bg: '#FEE2E2' },
  { value: 'sold',           label: 'Prodat',          color: '#6B7280', bg: '#F3F4F6' },
  { value: 'partner',        label: 'Partnerski',      color: '#0891B2', bg: '#E0F2FE' },
  { value: 'unknown',        label: 'Nepoznat',        color: '#9CA3AF', bg: '#F9FAFB' },
]

const CAT_OPTS = [
  { value: 'mini', label: 'Mini' }, { value: 'economy', label: 'Economy' },
  { value: 'compact', label: 'Compact' }, { value: 'standard', label: 'Standard' },
  { value: 'suv', label: 'SUV' }, { value: 'van', label: 'Van' },
  { value: 'premium', label: 'Premium' }, { value: 'convertible', label: 'Convertible' },
  { value: 'offroad', label: '4x4 / Off-road' },
]

const EMPTY_FORM: Partial<FleetVehicle> = {
  fleet_status: 'available', lokacija: 'CRNA GORA',
  transmission: 'manual', fuel_type: 'diesel',
  category: 'economy', is_available: true,
  price_per_day: 0, seats: 5,
}

function getStatusInfo(status: string) {
  return FLEET_STATUS_OPTS.find(s => s.value === status) || FLEET_STATUS_OPTS[FLEET_STATUS_OPTS.length - 1]
}

// ─── GLAVNI KOMPONENT ─────────────────────────────────────
export default function AdminFleetPage() {
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Filteri
  const [searchQ, setSearchQ] = useState('')
  const [filterLok, setFilterLok] = useState('SVE')
  const [filterStatus, setFilterStatus] = useState('SVE')
  const [filterMarka, setFilterMarka] = useState('SVE')

  // Forme
  const [showForm, setShowForm] = useState(false)
  const [editVehicle, setEditVehicle] = useState<FleetVehicle | null>(null)
  const [form, setForm] = useState<Partial<FleetVehicle>>(EMPTY_FORM)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('vozila_fleet')
      .select('*')
      .order('marka', { ascending: true })
    if (data) setVehicles(data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // ─── FILTRIRANJE ─────────────────────────────────────────
  const filtered = vehicles.filter(v => {
    const q = searchQ.toLowerCase()
    const matchQ = !q ||
      (v.license_plate || '').toLowerCase().includes(q) ||
      (v.agregirani_2 || '').toLowerCase().includes(q) ||
      (v.marka || '').toLowerCase().includes(q) ||
      (v.model || '').toLowerCase().includes(q) ||
      (v.vlasnik || '').toLowerCase().includes(q)
    const matchLok = filterLok === 'SVE' || v.lokacija === filterLok
    const matchSt = filterStatus === 'SVE' || v.fleet_status === filterStatus
    const matchMarka = filterMarka === 'SVE' || v.marka === filterMarka
    return matchQ && matchLok && matchSt && matchMarka
  })

  // ─── MARKE za filter ─────────────────────────────────────
  const marke = ['SVE', ...Array.from(new Set(vehicles.map(v => v.marka).filter(Boolean))).sort()] as string[]

  // ─── STATS ───────────────────────────────────────────────
  const stats = {
    ukupno: vehicles.length,
    available: vehicles.filter(v => v.fleet_status === 'available').length,
    service: vehicles.filter(v => v.fleet_status.startsWith('service')).length,
    damaged: vehicles.filter(v => v.fleet_status === 'damaged').length,
  }
  const statsByLok = LOKACIJE.map(l => ({
    lok: l,
    count: vehicles.filter(v => v.lokacija === l && v.fleet_status === 'available').length,
    total: vehicles.filter(v => v.lokacija === l).length,
  }))

  // ─── SAVE ────────────────────────────────────────────────
  async function saveVehicle() {
    if (!form.marka || !form.model) { alert('Unesite Marku i Model!'); return }
    setSaving(true)
    const agr2 = `${form.marka} ${form.model} ${form.license_plate || ''} ${form.year || ''} ${form.transmission || ''}`.trim()
    const payload = { ...form, agregirani_2: agr2, name: agr2 }
    if (editVehicle) {
      await supabase.from('vozila_fleet').update(payload).eq('id', editVehicle.id)
    } else {
      await supabase.from('vozila_fleet').insert([payload])
    }
    setSaving(false)
    setShowForm(false)
    setEditVehicle(null)
    setForm(EMPTY_FORM)
    fetchData()
  }

  async function deleteVehicle(id: number, plate: string) {
    if (!confirm(`Obrisati vozilo ${plate}? Ova akcija se ne može poništiti.`)) return
    await supabase.from('vozila_fleet').delete().eq('id', id)
    fetchData()
  }

  async function quickStatusUpdate(id: number, status: string) {
    await supabase.from('vozila_fleet').update({
      fleet_status: status,
      is_available: status === 'available'
    }).eq('id', id)
    fetchData()
  }

  async function quickLokUpdate(id: number, lok: string) {
    await supabase.from('vozila_fleet').update({ lokacija: lok }).eq('id', id)
    fetchData()
  }

  function openEdit(v: FleetVehicle) {
    setEditVehicle(v)
    setForm({ ...v })
    setShowForm(true)
  }

  function openNew() {
    setEditVehicle(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '8px 10px', fontSize: 13,
    border: '1px solid #d1d5db', borderRadius: 8,
    background: '#fff', color: '#111', boxSizing: 'border-box',
  }
  const lbl: React.CSSProperties = {
    fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 3, fontWeight: 500
  }

  return (
    <div>
      {/* ─── HEADER ─── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#111', margin: 0 }}>Vozni park (Fleet)</h1>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
            {stats.ukupno} vozila ukupno · {stats.available} dostupno · {stats.service} u servisu · {stats.damaged} havarisan
          </p>
        </div>
        <button onClick={openNew}
          style={{ padding: '9px 18px', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          + Dodaj vozilo
        </button>
      </div>

      {/* ─── STATS PO LOKACIJI ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
        {statsByLok.map(s => (
          <div key={s.lok} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 16px', cursor: 'pointer', outline: filterLok === s.lok ? '2px solid #1D9E75' : 'none' }}
            onClick={() => setFilterLok(filterLok === s.lok ? 'SVE' : s.lok)}>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{s.lok}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#1D9E75' }}>{s.count}</div>
            <div style={{ fontSize: 11, color: '#9ca3af' }}>dostupno / {s.total} ukupno</div>
          </div>
        ))}
      </div>

      {/* ─── FILTERI ─── */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 16px', marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          value={searchQ} onChange={e => setSearchQ(e.target.value)}
          placeholder="Pretraži tablice, naziv, vlasnika..."
          style={{ ...inp, width: 260, marginBottom: 0 }}
        />
        <select value={filterLok} onChange={e => setFilterLok(e.target.value)} style={{ ...inp, width: 140, marginBottom: 0 }}>
          <option value="SVE">Sve lokacije</option>
          {LOKACIJE.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...inp, width: 160, marginBottom: 0 }}>
          <option value="SVE">Svi statusi</option>
          {FLEET_STATUS_OPTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select value={filterMarka} onChange={e => setFilterMarka(e.target.value)} style={{ ...inp, width: 140, marginBottom: 0 }}>
          {marke.map(m => <option key={m} value={m}>{m === 'SVE' ? 'Sve marke' : m}</option>)}
        </select>
        {(searchQ || filterLok !== 'SVE' || filterStatus !== 'SVE' || filterMarka !== 'SVE') && (
          <button onClick={() => { setSearchQ(''); setFilterLok('SVE'); setFilterStatus('SVE'); setFilterMarka('SVE') }}
            style={{ padding: '7px 14px', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: 'pointer', color: '#6b7280' }}>
            Poništi filtere
          </button>
        )}
        <span style={{ fontSize: 12, color: '#9ca3af', marginLeft: 'auto' }}>{filtered.length} vozila</span>
      </div>

      {/* ─── LAYOUT: Forma + Lista ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: showForm ? '1fr 380px' : '1fr', gap: 16, alignItems: 'start' }}>

        {/* ─── LISTA VOZILA ─── */}
        <div>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Učitavanje...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 13, border: '1px dashed #e5e7eb', borderRadius: 12 }}>
              Nema vozila za odabrane filtere.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Grupišemo po marki */}
              {Array.from(new Set(filtered.map(v => v.marka || 'Ostalo'))).sort().map(marka => {
                const vozilaMarke = filtered.filter(v => (v.marka || 'Ostalo') === marka)
                return (
                  <div key={marka}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1, padding: '8px 4px 4px', borderBottom: '1px solid #f3f4f6', marginBottom: 6 }}>
                      {marka} ({vozilaMarke.length})
                    </div>
                    {vozilaMarke.map(v => {
                      const st = getStatusInfo(v.fleet_status)
                      const isticeSkoro = v.dana_do_isteka !== null && v.dana_do_isteka <= 30 && v.dana_do_isteka > 0
                      const istekla = v.dana_do_isteka !== null && v.dana_do_isteka <= 0

                      return (
                        <div key={v.id} style={{
                          border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 16px',
                          background: '#fff', marginBottom: 6,
                          borderLeft: `3px solid ${st.color}`,
                          opacity: v.fleet_status === 'sold' ? 0.6 : 1,
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>

                            {/* Info */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                                <span style={{ fontWeight: 600, fontSize: 14, color: '#111' }}>
                                  {v.agregirani_2 || `${v.marka} ${v.model}`}
                                </span>
                                {v.license_plate && (
                                  <span style={{ fontFamily: 'monospace', fontSize: 12, background: '#f3f4f6', color: '#374151', padding: '2px 7px', borderRadius: 5, fontWeight: 600 }}>
                                    {v.license_plate}
                                  </span>
                                )}
                                <span style={{ fontSize: 11, background: st.bg, color: st.color, padding: '2px 8px', borderRadius: 20, fontWeight: 600, whiteSpace: 'nowrap' }}>
                                  {st.label}
                                </span>
                                {isticeSkoro && (
                                  <span style={{ fontSize: 10, background: '#FAEEDA', color: '#BA7517', padding: '2px 7px', borderRadius: 20, fontWeight: 600 }}>
                                    ⚠️ Reg. ističe za {Math.round(v.dana_do_isteka!)} dana
                                  </span>
                                )}
                                {istekla && (
                                  <span style={{ fontSize: 10, background: '#FEE2E2', color: '#DC2626', padding: '2px 7px', borderRadius: 20, fontWeight: 600 }}>
                                    🚫 Reg. istekla ({v.istek_reg})
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: 12, color: '#6b7280', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                {v.year && <span>📅 {v.year}</span>}
                                {v.transmission && <span>⚙️ {v.transmission === 'manual' ? 'Manual' : 'Automat'}</span>}
                                {v.fuel_type && <span>⛽ {v.fuel_type === 'diesel' ? 'Dizel' : v.fuel_type === 'petrol' ? 'Benzin' : v.fuel_type}</span>}
                                {v.color && <span>🎨 {v.color}</span>}
                                {v.power_kw && <span>💪 {v.power_kw}kW</span>}
                                {v.vlasnik && <span>👤 {v.vlasnik}</span>}
                                <span style={{ background: '#f3f4f6', padding: '1px 6px', borderRadius: 10, color: '#374151', fontWeight: 500 }}>
                                  📍 {v.lokacija}
                                </span>
                                {v.price_per_day > 0 && (
                                  <span style={{ color: '#1D9E75', fontWeight: 700 }}>{v.price_per_day}€/dan</span>
                                )}
                              </div>
                            </div>

                            {/* Akcije */}
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                              {/* Quick status */}
                              <select
                                value={v.fleet_status}
                                onChange={e => quickStatusUpdate(v.id, e.target.value)}
                                style={{ padding: '5px 8px', fontSize: 11, border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', color: '#374151', cursor: 'pointer' }}
                              >
                                {FLEET_STATUS_OPTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                              </select>

                              {/* Quick lokacija */}
                              <select
                                value={v.lokacija}
                                onChange={e => quickLokUpdate(v.id, e.target.value)}
                                style={{ padding: '5px 8px', fontSize: 11, border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', color: '#374151', cursor: 'pointer' }}
                              >
                                {LOKACIJE.map(l => <option key={l} value={l}>{l}</option>)}
                              </select>

                              <button onClick={() => openEdit(v)}
                                style={{ padding: '6px 12px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', cursor: 'pointer', color: '#374151', whiteSpace: 'nowrap' }}>
                                ✏️ Uredi
                              </button>
                              <button onClick={() => deleteVehicle(v.id, v.license_plate || String(v.id))}
                                style={{ padding: '6px 10px', fontSize: 12, border: '1px solid #fecaca', borderRadius: 8, background: '#fff', cursor: 'pointer', color: '#dc2626' }}>
                                ✕
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ─── FORMA ZA DODAVANJE/EDITOVANJE ─── */}
        {showForm && (
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, background: '#fff', position: 'sticky', top: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#111' }}>
                {editVehicle ? 'Uredi vozilo' : 'Novo vozilo'}
              </div>
              <button onClick={() => { setShowForm(false); setEditVehicle(null); setForm(EMPTY_FORM) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#9ca3af' }}>✕</button>
            </div>

            <div style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', paddingRight: 4 }}>

              {/* Osnovno */}
              <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid #f3f4f6' }}>
                Osnovno
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={lbl}>Registarske tablice</label>
                  <input style={inp} value={form.license_plate || ''} onChange={e => setForm(f => ({ ...f, license_plate: e.target.value }))} placeholder="PG-AA111" />
                </div>
                <div>
                  <label style={lbl}>Marka *</label>
                  <input style={inp} value={form.marka || ''} onChange={e => setForm(f => ({ ...f, marka: e.target.value }))} placeholder="Volkswagen" />
                </div>
                <div>
                  <label style={lbl}>Model *</label>
                  <input style={inp} value={form.model || ''} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} placeholder="Golf 1.6 TDI" />
                </div>
                <div>
                  <label style={lbl}>Godište</label>
                  <input style={inp} type="number" value={form.year || ''} onChange={e => setForm(f => ({ ...f, year: parseInt(e.target.value) || undefined }))} placeholder="2019" />
                </div>
                <div>
                  <label style={lbl}>Boja</label>
                  <input style={inp} value={form.color || ''} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} placeholder="SIVA" />
                </div>
                <div>
                  <label style={lbl}>Transmisija</label>
                  <select style={inp} value={form.transmission || 'manual'} onChange={e => setForm(f => ({ ...f, transmission: e.target.value }))}>
                    <option value="manual">Manual</option>
                    <option value="automatic">Automatik</option>
                  </select>
                </div>
                <div>
                  <label style={lbl}>Gorivo</label>
                  <select style={inp} value={form.fuel_type || 'diesel'} onChange={e => setForm(f => ({ ...f, fuel_type: e.target.value }))}>
                    <option value="diesel">Dizel</option>
                    <option value="petrol">Benzin</option>
                    <option value="electric">Električno</option>
                    <option value="hybrid">Hibrid</option>
                  </select>
                </div>
              </div>

              {/* Tehnički podaci */}
              <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid #f3f4f6' }}>
                Tehnički podaci
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                <div>
                  <label style={lbl}>Kubikaza (cc)</label>
                  <input style={inp} type="number" value={form.engine_cc || ''} onChange={e => setForm(f => ({ ...f, engine_cc: parseInt(e.target.value) || undefined }))} placeholder="1968" />
                </div>
                <div>
                  <label style={lbl}>Snaga (kW)</label>
                  <input style={inp} type="number" value={form.power_kw || ''} onChange={e => setForm(f => ({ ...f, power_kw: parseFloat(e.target.value) || undefined }))} placeholder="110" />
                </div>
                <div>
                  <label style={lbl}>Masa (kg)</label>
                  <input style={inp} type="number" value={form.weight_kg || ''} onChange={e => setForm(f => ({ ...f, weight_kg: parseFloat(e.target.value) || undefined }))} placeholder="1400" />
                </div>
                <div>
                  <label style={lbl}>Mjesta</label>
                  <input style={inp} type="number" value={form.seats || ''} onChange={e => setForm(f => ({ ...f, seats: parseInt(e.target.value) || undefined }))} placeholder="5" />
                </div>
                <div>
                  <label style={lbl}>VIN / Šasija</label>
                  <input style={inp} value={form.vin || ''} onChange={e => setForm(f => ({ ...f, vin: e.target.value }))} placeholder="WVW..." />
                </div>
                <div>
                  <label style={lbl}>Vrsta vozila</label>
                  <input style={inp} value={form.vrsta_vozila || ''} onChange={e => setForm(f => ({ ...f, vrsta_vozila: e.target.value }))} placeholder="PUTNICKO" />
                </div>
              </div>

              {/* Registracija */}
              <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid #f3f4f6' }}>
                Registracija & Vlasnik
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                <div>
                  <label style={lbl}>Istek registracije</label>
                  <input style={inp} value={form.istek_reg || ''} onChange={e => setForm(f => ({ ...f, istek_reg: e.target.value }))} placeholder="15.06.2026." />
                </div>
                <div>
                  <label style={lbl}>Mjesto registracije</label>
                  <input style={inp} value={form.mjesto_reg || ''} onChange={e => setForm(f => ({ ...f, mjesto_reg: e.target.value }))} placeholder="PODGORICA" />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={lbl}>Vlasnik</label>
                  <input style={inp} value={form.vlasnik || ''} onChange={e => setForm(f => ({ ...f, vlasnik: e.target.value }))} placeholder="MERIEM DOO" />
                </div>
                <div>
                  <label style={lbl}>Stare tablice</label>
                  <input style={inp} value={form.stare_tablice || ''} onChange={e => setForm(f => ({ ...f, stare_tablice: e.target.value }))} placeholder="PG-XX000" />
                </div>
                <div>
                  <label style={lbl}>Nabavljeno od</label>
                  <input style={inp} value={form.purchase_from || ''} onChange={e => setForm(f => ({ ...f, purchase_from: e.target.value }))} placeholder="Dealer / privatno" />
                </div>
                <div>
                  <label style={lbl}>Cijena nabavke (€)</label>
                  <input style={inp} type="number" value={form.purchase_price || ''} onChange={e => setForm(f => ({ ...f, purchase_price: parseFloat(e.target.value) || undefined }))} placeholder="15000" />
                </div>
                <div>
                  <label style={lbl}>Trenutna km</label>
                  <input style={inp} type="number" value={form.current_mileage || ''} onChange={e => setForm(f => ({ ...f, current_mileage: parseInt(e.target.value) || undefined }))} placeholder="45000" />
                </div>
              </div>

              {/* Status & Lokacija */}
              <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid #f3f4f6' }}>
                Status & Lokacija
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                <div>
                  <label style={lbl}>Status flote</label>
                  <select style={inp} value={form.fleet_status || 'available'} onChange={e => setForm(f => ({ ...f, fleet_status: e.target.value, is_available: e.target.value === 'available' }))}>
                    {FLEET_STATUS_OPTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Lokacija</label>
                  <select style={inp} value={form.lokacija || 'CRNA GORA'} onChange={e => setForm(f => ({ ...f, lokacija: e.target.value }))}>
                    {LOKACIJE.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Kategorija (za sajt)</label>
                  <select style={inp} value={form.category || 'economy'} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                    {CAT_OPTS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Cijena/dan (€)</label>
                  <input style={inp} type="number" value={form.price_per_day || 0} onChange={e => setForm(f => ({ ...f, price_per_day: parseFloat(e.target.value) || 0 }))} placeholder="0" />
                </div>
              </div>

              {/* Napomena */}
              <div style={{ marginBottom: 18 }}>
                <label style={lbl}>Napomena</label>
                <textarea
                  value={form.fleet_notes || ''}
                  onChange={e => setForm(f => ({ ...f, fleet_notes: e.target.value }))}
                  placeholder="Opciona napomena o vozilu..."
                  style={{ ...inp, minHeight: 60, resize: 'vertical' }}
                />
              </div>

              <button
                onClick={saveVehicle}
                disabled={saving}
                style={{ width: '100%', padding: 11, background: saving ? '#5DCAA5' : '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Snimanje...' : editVehicle ? '💾 Sačuvaj izmjene' : '+ Dodaj vozilo'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
