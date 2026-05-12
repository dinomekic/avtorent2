'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function getCookie(name: string): string {
  if (typeof document === 'undefined') return ''
  const match = document.cookie.match(new RegExp(`${name}=([^;]+)`))
  return match ? decodeURIComponent(match[1]) : ''
}

type Vozilo = {
  id: number; license_plate: string; agregirani_2: string; marka: string
  model: string; fleet_status: string; current_mileage: number
  istek_reg: string; lokacija: string; dana_do_isteka: number
}

type Servis = {
  id: string; vehicle_id: string; service_type: string; service_date: string
  mileage_at_service: number; description: string; cost: number
  performed_by: string; external_shop: string; next_service_date: string
  next_service_mileage: number; status: string; notes: string; created_at: string
}

const SERVICE_TYPES = [
  { key: 'mali_servis', label: 'Mali servis', icon: '🔧' },
  { key: 'veliki_servis', label: 'Veliki servis', icon: '⚙️' },
  { key: 'kocnice', label: 'Kočnice', icon: '🛑' },
  { key: 'gume', label: 'Gume', icon: '🛞' },
  { key: 'ulje', label: 'Ulje', icon: '🛢️' },
  { key: 'klima', label: 'Klima', icon: '❄️' },
  { key: 'registracija', label: 'Registracija', icon: '📋' },
  { key: 'elektrika', label: 'Elektrika', icon: '⚡' },
  { key: 'karoserija', label: 'Karoserija', icon: '🚗' },
  { key: 'ostalo', label: 'Ostalo', icon: '📝' },
]

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  'na_cekanju':  { label: 'Na čekanju', bg: '#FAEEDA', color: '#633806' },
  'u_toku':      { label: 'U toku',     bg: '#E6F1FB', color: '#0C447C' },
  'zavrseno':    { label: 'Završeno',   bg: '#E1F5EE', color: '#085041' },
  'otkazano':    { label: 'Otkazano',   bg: '#f3f4f6', color: '#6b7280' },
}

const FLEET_STATUS: Record<string, { label: string; color: string }> = {
  'available':       { label: 'Dostupno',   color: '#085041' },
  'rented':          { label: 'Izdato',     color: '#0C447C' },
  'service':         { label: 'Servis',     color: '#633806' },
  'service_planet':  { label: 'S. Planet',  color: '#7c3aed' },
  'damaged':         { label: 'Oštećeno',   color: '#dc2626' },
  'inactive':        { label: 'Neaktivno',  color: '#9ca3af' },
}

const inp: React.CSSProperties = { width: '100%', padding: '9px 12px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, color: '#111', background: '#fff', boxSizing: 'border-box' }
const lbl: React.CSSProperties = { fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4, fontWeight: 500 }

export default function ServisPage() {
  const [vozila, setVozila] = useState<Vozilo[]>([])
  const [servisi, setServisi] = useState<Servis[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedVozilo, setSelectedVozilo] = useState<Vozilo | null>(null)
  const [voziloServisi, setVoziloServisi] = useState<Servis[]>([])
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [filterLok, setFilterLok] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  const agentName = getCookie('avtorent-agent-name')

  const emptyForm = {
    service_type: 'mali_servis', service_date: new Date().toISOString().split('T')[0],
    mileage_at_service: '', description: '', cost: '',
    performed_by: '', external_shop: '', next_service_date: '',
    next_service_mileage: '', status: 'zavrseno', notes: '',
  }
  const [form, setForm] = useState<any>(emptyForm)

  const lokacije = Array.from(new Set(vozila.map(v => v.lokacija).filter(Boolean)))

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [{ data: v }, { data: s }] = await Promise.all([
      supabase.from('vozila_fleet').select('*').order('agregirani_2'),
      supabase.from('vehicle_services').select('*').order('service_date', { ascending: false }),
    ])
    setVozila(v || [])
    setServisi(s || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    if (selectedVozilo) {
      setVoziloServisi(servisi.filter(s => String(s.vehicle_id) === String(selectedVozilo.id)))
    }
  }, [selectedVozilo, servisi])

  function selectVozilo(v: Vozilo) {
    setSelectedVozilo(v)
    setShowForm(false)
    setForm({ ...emptyForm, mileage_at_service: v.current_mileage || '' })
  }

  async function saveServis() {
    if (!selectedVozilo) return
    setSaving(true)
    const { error } = await supabase.from('vehicle_services').insert([{
      vehicle_id: String(selectedVozilo.id),
      service_type: form.service_type,
      service_date: form.service_date,
      mileage_at_service: form.mileage_at_service ? parseInt(form.mileage_at_service) : null,
      description: form.description || null,
      cost: form.cost ? parseFloat(form.cost) : null,
      performed_by: form.performed_by || agentName || null,
      external_shop: form.external_shop || null,
      next_service_date: form.next_service_date || null,
      next_service_mileage: form.next_service_mileage ? parseInt(form.next_service_mileage) : null,
      status: form.status,
      notes: form.notes || null,
    }])
    if (error) { alert('Greška: ' + error.message); setSaving(false); return }

    // Ažuriraj trenutnu kilometražu vozila
    if (form.mileage_at_service && parseInt(form.mileage_at_service) > (selectedVozilo.current_mileage || 0)) {
      await supabase.from('vozila_fleet').update({
        current_mileage: parseInt(form.mileage_at_service),
        fleet_status: form.status === 'u_toku' ? 'service' : selectedVozilo.fleet_status,
      }).eq('id', selectedVozilo.id)
    }

    setSaving(false)
    setShowForm(false)
    setForm({ ...emptyForm, mileage_at_service: form.mileage_at_service })
    fetchData()
    alert('✅ Servis upisан!')
  }

  async function updateStatus(servisId: string, newStatus: string) {
    await supabase.from('vehicle_services').update({ status: newStatus }).eq('id', servisId)
    if (newStatus === 'zavrseno' && selectedVozilo) {
      await supabase.from('vozila_fleet').update({ fleet_status: 'available' }).eq('id', selectedVozilo.id)
    }
    fetchData()
  }

  const filteredVozila = vozila.filter(v => {
    const q = search.toLowerCase()
    const matchSearch = !search ||
      (v.agregirani_2 || '').toLowerCase().includes(q) ||
      (v.license_plate || '').toLowerCase().includes(q) ||
      (v.marka || '').toLowerCase().includes(q)
    const matchLok = !filterLok || v.lokacija === filterLok
    const matchStatus = !filterStatus || v.fleet_status === filterStatus
    return matchSearch && matchLok && matchStatus
  })

  // Statistike
  const ukupnoServisa = servisi.length
  const ovogMjeseca = servisi.filter(s => {
    const d = new Date(s.service_date)
    const n = new Date()
    return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear()
  }).length
  const uTokuServisa = vozila.filter(v => v.fleet_status === 'service' || v.fleet_status === 'service_planet').length
  const ukupnoTroskova = servisi.reduce((sum, s) => sum + (parseFloat(s.cost as any) || 0), 0)

  return (
    <div>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#111', margin: 0 }}>Servis vozila</h1>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4, margin: 0 }}>Istorija servisa po vozilu</p>
        </div>
      </div>

      {/* STATISTIKE */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Ukupno servisa', value: ukupnoServisa, bg: '#E6F1FB', color: '#0C447C' },
          { label: 'Ovog mjeseca', value: ovogMjeseca, bg: '#E1F5EE', color: '#085041' },
          { label: 'Na servisu', value: uTokuServisa, bg: '#FAEEDA', color: '#633806' },
          { label: 'Ukupni troškovi', value: `${ukupnoTroskova.toFixed(0)}€`, bg: '#FCEBEB', color: '#791F1F' },
        ].map(s => (
          <div key={s.label} style={{ background: s.bg, borderRadius: 10, padding: '14px 18px' }}>
            <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedVozilo ? '340px 1fr' : '1fr', gap: 20 }}>

        {/* LISTA VOZILA */}
        <div>
          {/* Filteri */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Pretraži vozilo..." style={{ ...inp, width: 200 }} />
            <select value={filterLok} onChange={e => setFilterLok(e.target.value)}
              style={{ padding: '8px 12px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', color: '#111' }}>
              <option value="">Sve lokacije</option>
              {lokacije.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              style={{ padding: '8px 12px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', color: '#111' }}>
              <option value="">Svi statusi</option>
              {Object.entries(FLEET_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Učitavanje...</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' }}>
              {filteredVozila.map(v => {
                const st = FLEET_STATUS[v.fleet_status] || { label: v.fleet_status, color: '#9ca3af' }
                const brServisa = servisi.filter(s => String(s.vehicle_id) === String(v.id)).length
                const zadnji = servisi.filter(s => String(s.vehicle_id) === String(v.id))[0]
                const isSelected = selectedVozilo?.id === v.id
                const regIstice = v.dana_do_isteka !== null && v.dana_do_isteka < 30

                return (
                  <div key={v.id} onClick={() => selectVozilo(v)}
                    style={{ background: '#fff', border: `2px solid ${isSelected ? '#1D9E75' : regIstice ? '#fecaca' : '#e5e7eb'}`, borderRadius: 10, padding: '12px 14px', cursor: 'pointer', transition: 'border-color 0.15s' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: '#111' }}>{v.agregirani_2 || v.license_plate}</div>
                        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>{v.lokacija} {v.current_mileage ? `· ${v.current_mileage.toLocaleString()} km` : ''}</div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                        <span style={{ fontSize: 11, color: st.color, fontWeight: 600 }}>{st.label}</span>
                        {brServisa > 0 && <span style={{ fontSize: 10, background: '#E6F1FB', color: '#0C447C', padding: '1px 6px', borderRadius: 20, fontWeight: 600 }}>{brServisa} servisa</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {regIstice && (
                        <span style={{ fontSize: 10, background: '#FCEBEB', color: '#791F1F', padding: '2px 6px', borderRadius: 20, fontWeight: 600 }}>
                          ⚠️ Reg: {v.istek_reg}
                        </span>
                      )}
                      {zadnji && (
                        <span style={{ fontSize: 10, color: '#9ca3af' }}>
                          Zadnji: {zadnji.service_date} · {SERVICE_TYPES.find(t => t.key === zadnji.service_type)?.label || zadnji.service_type}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
              {filteredVozila.length === 0 && (
                <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af', border: '1px dashed #e5e7eb', borderRadius: 10 }}>Nema vozila</div>
              )}
            </div>
          )}
        </div>

        {/* DESNA STRANA — istorija servisa odabranog vozila */}
        {selectedVozilo && (
          <div>
            {/* Vozilo info header */}
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, color: '#111' }}>{selectedVozilo.agregirani_2}</div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {selectedVozilo.current_mileage && <span>📏 {selectedVozilo.current_mileage.toLocaleString()} km</span>}
                  {selectedVozilo.istek_reg && <span>📋 Reg: {selectedVozilo.istek_reg}</span>}
                  {selectedVozilo.lokacija && <span>📍 {selectedVozilo.lokacija}</span>}
                  {selectedVozilo.fleet_status && (
                    <span style={{ color: FLEET_STATUS[selectedVozilo.fleet_status]?.color || '#9ca3af', fontWeight: 600 }}>
                      {FLEET_STATUS[selectedVozilo.fleet_status]?.label || selectedVozilo.fleet_status}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { setShowForm(s => !s); setForm({ ...emptyForm, mileage_at_service: selectedVozilo.current_mileage || '' }) }}
                  style={{ padding: '7px 14px', background: showForm ? '#f3f4f6' : '#1D9E75', color: showForm ? '#374151' : '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  {showForm ? 'Zatvori' : '+ Novi servis'}
                </button>
                <button onClick={() => setSelectedVozilo(null)}
                  style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9ca3af' }}>✕</button>
              </div>
            </div>

            {/* FORMA ZA NOVI SERVIS */}
            {showForm && (
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, marginBottom: 16 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#111', marginBottom: 16 }}>Novi servis — {selectedVozilo.license_plate}</div>

                {/* Tip servisa */}
                <div style={{ marginBottom: 14 }}>
                  <label style={lbl}>Tip servisa *</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
                    {SERVICE_TYPES.map(t => (
                      <button key={t.key} onClick={() => setForm((f: any) => ({ ...f, service_type: t.key }))}
                        style={{ padding: '8px 4px', fontSize: 11, border: `1px solid ${form.service_type === t.key ? '#1D9E75' : '#e5e7eb'}`, borderRadius: 8, background: form.service_type === t.key ? '#E1F5EE' : '#fff', color: form.service_type === t.key ? '#085041' : '#6b7280', cursor: 'pointer', textAlign: 'center' as const }}>
                        {t.icon}<br /><span style={{ fontSize: 10 }}>{t.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
                  <div>
                    <label style={lbl}>Datum *</label>
                    <input type="date" value={form.service_date} onChange={e => setForm((f: any) => ({ ...f, service_date: e.target.value }))} style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>KM pri servisu</label>
                    <input type="number" value={form.mileage_at_service} onChange={e => setForm((f: any) => ({ ...f, mileage_at_service: e.target.value }))} placeholder={String(selectedVozilo.current_mileage || '')} style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>Cijena (€)</label>
                    <input type="number" step="0.01" value={form.cost} onChange={e => setForm((f: any) => ({ ...f, cost: e.target.value }))} placeholder="0.00" style={inp} />
                  </div>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={lbl}>Opis radova *</label>
                  <textarea value={form.description} onChange={e => setForm((f: any) => ({ ...f, description: e.target.value }))}
                    placeholder="Šta je urađeno..." style={{ ...inp, minHeight: 80, resize: 'vertical' as const }} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                  <div>
                    <label style={lbl}>Ko je servisirao</label>
                    <input value={form.performed_by} onChange={e => setForm((f: any) => ({ ...f, performed_by: e.target.value }))} placeholder={agentName || 'Ime servisera...'} style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>Radionica (vanjska)</label>
                    <input value={form.external_shop} onChange={e => setForm((f: any) => ({ ...f, external_shop: e.target.value }))} placeholder="Naziv radionice..." style={inp} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                  <div>
                    <label style={lbl}>Sljedeći servis (datum)</label>
                    <input type="date" value={form.next_service_date} onChange={e => setForm((f: any) => ({ ...f, next_service_date: e.target.value }))} style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>Sljedeći servis (km)</label>
                    <input type="number" value={form.next_service_mileage} onChange={e => setForm((f: any) => ({ ...f, next_service_mileage: e.target.value }))} placeholder="npr. 50000" style={inp} />
                  </div>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={lbl}>Status</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                      <button key={k} onClick={() => setForm((f: any) => ({ ...f, status: k }))}
                        style={{ flex: 1, padding: '8px', fontSize: 11, border: `1px solid ${form.status === k ? '#1D9E75' : '#e5e7eb'}`, borderRadius: 8, background: form.status === k ? '#E1F5EE' : '#fff', color: form.status === k ? '#085041' : '#6b7280', cursor: 'pointer', fontWeight: form.status === k ? 600 : 400 }}>
                        {v.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={lbl}>Napomena</label>
                  <textarea value={form.notes} onChange={e => setForm((f: any) => ({ ...f, notes: e.target.value }))}
                    placeholder="Dodatne napomene..." style={{ ...inp, minHeight: 60, resize: 'vertical' as const }} />
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={saveServis} disabled={saving || !form.description}
                    style={{ flex: 2, padding: '11px', background: saving ? '#5DCAA5' : '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                    {saving ? '⏳ Snimam...' : '💾 Snimi servis'}
                  </button>
                  <button onClick={() => setShowForm(false)}
                    style={{ flex: 1, padding: '11px', border: '1px solid #d1d5db', borderRadius: 8, background: 'transparent', fontSize: 13, cursor: 'pointer', color: '#374151' }}>
                    Odustani
                  </button>
                </div>
              </div>
            )}

            {/* ISTORIJA SERVISA */}
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#111', marginBottom: 12 }}>
                Istorija servisa ({voziloServisi.length})
              </div>
              {voziloServisi.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af', border: '1px dashed #e5e7eb', borderRadius: 10, fontSize: 13 }}>
                  Nema upisanih servisa za ovo vozilo
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {voziloServisi.map(s => {
                    const st = STATUS_CONFIG[s.status] || STATUS_CONFIG['zavrseno']
                    const tip = SERVICE_TYPES.find(t => t.key === s.service_type)
                    return (
                      <div key={s.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                            <span style={{ fontSize: 22 }}>{tip?.icon || '🔧'}</span>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 14, color: '#111' }}>{tip?.label || s.service_type}</div>
                              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>
                                📅 {s.service_date}
                                {s.mileage_at_service && ` · 📏 ${s.mileage_at_service.toLocaleString()} km`}
                              </div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', flex: 'column', alignItems: 'flex-end', gap: 4 }}>
                            <span style={{ fontSize: 11, background: st.bg, color: st.color, padding: '2px 8px', borderRadius: 20, fontWeight: 500 }}>{st.label}</span>
                            {s.cost > 0 && <div style={{ fontSize: 13, fontWeight: 700, color: '#1D9E75', marginTop: 4 }}>{parseFloat(s.cost as any).toFixed(2)}€</div>}
                          </div>
                        </div>

                        {s.description && (
                          <div style={{ fontSize: 13, color: '#374151', marginBottom: 8, background: '#f9fafb', borderRadius: 6, padding: '8px 10px' }}>
                            {s.description}
                          </div>
                        )}

                        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 11, color: '#6b7280' }}>
                          {s.performed_by && <span>👤 {s.performed_by}</span>}
                          {s.external_shop && <span>🏪 {s.external_shop}</span>}
                          {s.next_service_date && <span style={{ color: '#d97706', fontWeight: 600 }}>⏭️ Sljedeći: {s.next_service_date}</span>}
                          {s.next_service_mileage && <span style={{ color: '#d97706' }}>⏭️ {s.next_service_mileage.toLocaleString()} km</span>}
                          {s.notes && <span>📝 {s.notes}</span>}
                        </div>

                        {/* Akcije za promjenu statusa */}
                        {s.status === 'u_toku' && (
                          <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                            <button onClick={() => updateStatus(s.id, 'zavrseno')}
                              style={{ padding: '6px 14px', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                              ✓ Označi završeno
                            </button>
                          </div>
                        )}
                        {s.status === 'na_cekanju' && (
                          <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                            <button onClick={() => updateStatus(s.id, 'u_toku')}
                              style={{ padding: '6px 14px', background: '#185FA5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                              ▶ Počni servis
                            </button>
                            <button onClick={() => updateStatus(s.id, 'zavrseno')}
                              style={{ padding: '6px 14px', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                              ✓ Završeno
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Ako nema odabranog vozila — info */}
        {!selectedVozilo && !loading && (
          <div style={{ display: 'none' }} />
        )}
      </div>
    </div>
  )
}
