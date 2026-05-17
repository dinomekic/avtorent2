'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type FleetVehicle = {
  id: number; name: string; license_plate: string | null; vin: string | null
  category: string; transmission: string; fuel_type: string; color: string | null
  year: number | null; seats: number | null; engine_cc: number | null
  power_kw: number | null; weight_kg: number | null; price_per_day: number
  is_available: boolean; image_url: string | null; marka: string | null
  model: string | null; istek_reg: string | null; vlasnik: string | null
  mjesto_reg: string | null; vrsta_vozila: string | null; stare_tablice: string | null
  fleet_status: string; lokacija: string; purchase_from: string | null
  purchase_price: number | null; purchase_date: string | null
  current_mileage: number | null; fleet_notes: string | null
  dana_do_isteka: number | null; agregirani_2: string | null
  vehicle_class: string | null; features: string[] | null
  saobracajna_url: string | null; polisa_url: string | null; polisa_istek: string | null
}

type RegHistory = {
  id: number; vehicle_id: number; license_plate: string | null
  istek_reg: string | null; mjesto_reg: string | null
  datum_registracije: string | null; napomena: string | null
  created_at: string; created_by: string | null
}

const LOKACIJE = ['CRNA GORA', 'BiH', 'SRBIJA', 'ALBANIJA']

const FLEET_STATUS_OPTS = [
  { value: 'available',      label: 'Za izdavanje',  color: '#1D9E75', bg: '#E1F5EE' },
  { value: 'rented',         label: 'Iznajmljeno',   color: '#185FA5', bg: '#E6F1FB' },
  { value: 'service_planet', label: 'Servis Planet', color: '#BA7517', bg: '#FAEEDA' },
  { value: 'service_other',  label: 'Servis drugi',  color: '#7C3AED', bg: '#EDE9FE' },
  { value: 'damaged',        label: 'Havarisan',     color: '#DC2626', bg: '#FEE2E2' },
  { value: 'sold',           label: 'Prodat',        color: '#6B7280', bg: '#F3F4F6' },
  { value: 'partner',        label: 'Partnerski',    color: '#0891B2', bg: '#E0F2FE' },
  { value: 'unknown',        label: 'Nepoznat',      color: '#9CA3AF', bg: '#F9FAFB' },
]

const EMPTY_FORM: Partial<FleetVehicle> = {
  fleet_status: 'available', lokacija: 'CRNA GORA',
  transmission: 'manual', fuel_type: 'diesel',
  category: 'economy', is_available: true,
  price_per_day: 0, seats: 5,
  vehicle_class: '', features: [],
}

function getStatusInfo(status: string) {
  return FLEET_STATUS_OPTS.find(s => s.value === status) || FLEET_STATUS_OPTS[FLEET_STATUS_OPTS.length - 1]
}

function getCookie(name: string): string {
  if (typeof document === 'undefined') return ''
  const match = document.cookie.match(new RegExp(`${name}=([^;]+)`))
  return match ? decodeURIComponent(match[1]) : ''
}

// Konvertuj YYYY-MM-DD u DD.MM.YYYY
function todayDDMMYYYY(): string {
  const d = new Date()
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}.${mm}.${yyyy}.`
}

export default function AdminFleetPage() {
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([])
  const [dbKlase, setDbKlase] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  const [searchQ, setSearchQ] = useState('')
  const [filterLok, setFilterLok] = useState('SVE')
  const [filterStatus, setFilterStatus] = useState('SVE')
  const [filterMarka, setFilterMarka] = useState('SVE')
  const [filterClass, setFilterClass] = useState('SVE')
  const [filterReg, setFilterReg] = useState('SVE')
  const [activeTab, setActiveTab] = useState<'lista' | 'klase'>('lista')

  const [showForm, setShowForm] = useState(false)
  const [editVehicle, setEditVehicle] = useState<FleetVehicle | null>(null)
  const [form, setForm] = useState<Partial<FleetVehicle>>(EMPTY_FORM)
  const [featuresStr, setFeaturesStr] = useState('')

  const [showRegModal, setShowRegModal] = useState(false)
  const [regVehicle, setRegVehicle] = useState<FleetVehicle | null>(null)
  const [regHistory, setRegHistory] = useState<RegHistory[]>([])
  const [regHistoryLoading, setRegHistoryLoading] = useState(false)
  const [regForm, setRegForm] = useState({
    license_plate: '', istek_reg: '', mjesto_reg: '',
    datum_registracije: todayDDMMYYYY(), napomena: ''
  })
  const [regSaving, setRegSaving] = useState(false)
  const [regTab, setRegTab] = useState<'produzenje' | 'nova' | 'dokumenti' | 'istorija'>('produzenje')
  const [uploadingDoc, setUploadingDoc] = useState<'saobracajna' | 'polisa' | null>(null)
  const [docUrls, setDocUrls] = useState({ saobracajna_url: '', polisa_url: '', polisa_istek: '' })

  const agentName = getCookie('avtorent-agent-name')

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [{ data: vData }, { data: kData }] = await Promise.all([
      supabase.from('vozila_fleet').select('*').order('marka'),
      supabase.from('vehicle_classes').select('naziv').order('naziv'),
    ])
    if (vData) setVehicles(vData)
    if (kData) setDbKlase(kData.map((k: any) => k.naziv))
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  async function openRegModal(v: FleetVehicle) {
    setRegVehicle(v)
    setRegForm({
      license_plate: v.license_plate || '',
      istek_reg: v.istek_reg || '',
      mjesto_reg: v.mjesto_reg || '',
      datum_registracije: todayDDMMYYYY(),
      napomena: ''
    })
    setDocUrls({ saobracajna_url: v.saobracajna_url || '', polisa_url: v.polisa_url || '', polisa_istek: v.polisa_istek || '' })
    setRegTab('produzenje')
    setShowRegModal(true)
    setRegHistoryLoading(true)
    const { data } = await supabase.from('vehicle_reg_history').select('*').eq('vehicle_id', v.id).order('created_at', { ascending: false })
    setRegHistory(data || [])
    setRegHistoryLoading(false)
  }

  async function uploadDoc(file: File, tip: 'saobracajna' | 'polisa'): Promise<string | null> {
    setUploadingDoc(tip)
    try {
      const reader = new FileReader()
      return await new Promise((resolve) => {
        reader.readAsDataURL(file)
        reader.onload = async () => {
          const base64 = (reader.result as string).split(',')[1]
          const res = await fetch('/api/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ base64, contentType: file.type, name: `${tip}_${regVehicle?.license_plate}_${Date.now()}`, folderId: '1gFiCAgolZu9fAn5d-Ngmsx9qp3hWdIkN' }) })
          const json = await res.json()
          resolve(json.status === 'success' ? json.url : null)
        }
        reader.onerror = () => resolve(null)
      })
    } finally { setUploadingDoc(null) }
  }

  async function saveDokumenti() {
    if (!regVehicle) return
    setRegSaving(true)
    await supabase.from('vozila_fleet').update({ saobracajna_url: docUrls.saobracajna_url || null, polisa_url: docUrls.polisa_url || null, polisa_istek: docUrls.polisa_istek || null }).eq('id', regVehicle.id)
    setRegSaving(false)
    alert('✅ Dokumenti sačuvani!')
    fetchData()
  }

  async function saveRegistracija() {
    if (!regVehicle) return
    if (!regForm.istek_reg) { alert('Unesite datum isteka!'); return }

    // U "Produži" tabu tablice ostaju iste — koristi postojeće
    const noviPlate = regForm.license_plate || regVehicle.license_plate || ''

    setRegSaving(true)

    // Arhiviraj stari zapis
    await supabase.from('vehicle_reg_history').insert([{
      vehicle_id: regVehicle.id,
      license_plate: regVehicle.license_plate,
      istek_reg: regVehicle.istek_reg,
      mjesto_reg: regVehicle.mjesto_reg,
      datum_registracije: regForm.datum_registracije,
      napomena: `[Stari zapis] ${regForm.napomena || ''}`.trim(),
      created_by: agentName || 'Agent'
    }])

    // Upiši novi zapis u historiju
    await supabase.from('vehicle_reg_history').insert([{
      vehicle_id: regVehicle.id,
      license_plate: noviPlate,
      istek_reg: regForm.istek_reg,
      mjesto_reg: regForm.mjesto_reg || regVehicle.mjesto_reg,
      datum_registracije: regForm.datum_registracije,
      napomena: regForm.napomena || null,
      created_by: agentName || 'Agent'
    }])

    const noviAgregirani = `${regVehicle.marka} ${regVehicle.model} ${noviPlate} ${regVehicle.year || ''} ${regVehicle.transmission === 'automatic' ? 'AUTOMATIC' : 'MANUAL'}`.trim()

    await supabase.from('vozila_fleet').update({
      license_plate: noviPlate,
      istek_reg: regForm.istek_reg,
      mjesto_reg: regForm.mjesto_reg || regVehicle.mjesto_reg,
      stare_tablice: regVehicle.license_plate !== noviPlate ? regVehicle.license_plate : regVehicle.stare_tablice,
      agregirani_2: noviAgregirani,
      name: noviAgregirani
    }).eq('id', regVehicle.id)

    // Ažuriraj regVehicle state sa novim podacima
    setRegVehicle(prev => prev ? {
      ...prev,
      license_plate: noviPlate,
      istek_reg: regForm.istek_reg,
      mjesto_reg: regForm.mjesto_reg || prev.mjesto_reg,
    } : prev)

    setRegSaving(false)
    fetchData()

    // Ostani u modalu, pređi na Istorija tab i refreshaj historiju
    const { data: newHistory } = await supabase
      .from('vehicle_reg_history')
      .select('*')
      .eq('vehicle_id', regVehicle.id)
      .order('created_at', { ascending: false })
    setRegHistory(newHistory || [])
    setRegTab('istorija')
    alert('✅ Registracija sačuvana!')
  }

  const filtered = vehicles.filter(v => {
    const q = searchQ.toLowerCase()
    const matchQ = !q || (v.license_plate || '').toLowerCase().includes(q) || (v.agregirani_2 || '').toLowerCase().includes(q) || (v.marka || '').toLowerCase().includes(q) || (v.model || '').toLowerCase().includes(q) || (v.vlasnik || '').toLowerCase().includes(q)
    const matchLok = filterLok === 'SVE' || v.lokacija === filterLok
    const matchSt = filterStatus === 'SVE' || v.fleet_status === filterStatus
    const matchMarka = filterMarka === 'SVE' || v.marka === filterMarka
    const matchClass = filterClass === 'SVE' || v.vehicle_class === filterClass
    const d = v.dana_do_isteka
    const matchReg = filterReg === 'SVE' ? true : filterReg === 'istekla' ? (d !== null && d <= 0) : filterReg === 'skoro' ? (d !== null && d > 0 && d <= 15) : filterReg === 'ok' ? (d !== null && d > 15) : filterReg === 'nema' ? (!v.istek_reg) : true
    return matchQ && matchLok && matchSt && matchMarka && matchClass && matchReg
  })

  const marke = ['SVE', ...Array.from(new Set(vehicles.map(v => v.marka).filter(Boolean))).sort()] as string[]
  const stats = { ukupno: vehicles.length, available: vehicles.filter(v => v.fleet_status === 'available').length, service: vehicles.filter(v => v.fleet_status.startsWith('service')).length, damaged: vehicles.filter(v => v.fleet_status === 'damaged').length }

  async function uploadImage(file: File): Promise<string | null> {
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `fleet/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('vehicle-images').upload(path, file, { upsert: true })
    if (error) { setUploading(false); return null }
    const { data } = supabase.storage.from('vehicle-images').getPublicUrl(path)
    setUploading(false); return data.publicUrl
  }

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    const url = await uploadImage(file)
    if (url) setForm(f => ({ ...f, image_url: url }))
  }

  async function saveVehicle() {
    if (!form.marka || !form.model) { alert('Unesite Marku i Model!'); return }
    setSaving(true)
    const agr2 = `${form.marka} ${form.model} ${form.license_plate || ''} ${form.year || ''} ${form.transmission === 'automatic' ? 'AUTOMATIC' : 'MANUAL'}`.trim()
    const features = featuresStr ? featuresStr.split(',').map(s => s.trim()).filter(Boolean) : (form.features || [])
    const payload = { ...form, agregirani_2: agr2, name: agr2, features }
    if (editVehicle) await supabase.from('vozila_fleet').update(payload).eq('id', editVehicle.id)
    else await supabase.from('vozila_fleet').insert([payload])
    setSaving(false); setShowForm(false); setEditVehicle(null); setForm(EMPTY_FORM); setFeaturesStr(''); fetchData()
  }

  async function deleteVehicle(id: number, plate: string) {
    if (!confirm(`Obrisati vozilo ${plate}?`)) return
    await supabase.from('vozila_fleet').delete().eq('id', id); fetchData()
  }

  async function quickStatusUpdate(id: number, status: string) {
    await supabase.from('vozila_fleet').update({ fleet_status: status, is_available: status === 'available' }).eq('id', id); fetchData()
  }

  async function quickLokUpdate(id: number, lok: string) {
    await supabase.from('vozila_fleet').update({ lokacija: lok }).eq('id', id); fetchData()
  }

  async function quickClassUpdate(id: number, cls: string) {
    await supabase.from('vozila_fleet').update({ vehicle_class: cls }).eq('id', id)
    setVehicles(prev => prev.map(v => v.id === id ? { ...v, vehicle_class: cls } : v))
  }

  function openEdit(v: FleetVehicle) { setEditVehicle(v); setForm({ ...v }); setFeaturesStr((v.features || []).join(', ')); setShowForm(true) }
  function openNew() { setEditVehicle(null); setForm(EMPTY_FORM); setFeaturesStr(''); setShowForm(true) }

  const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', color: '#111', boxSizing: 'border-box' as const }
  const lbl: React.CSSProperties = { fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 3, fontWeight: 500 }
  const inpSm: React.CSSProperties = { ...inp, fontSize: 12, padding: '7px 10px' }

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '0 0 80px' }}>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, padding: '0 4px' }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#111' }}>Vozni park</div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>{stats.ukupno} vozila · {stats.available} dostupno · {stats.service} servis · {stats.damaged} havarisan</div>
        </div>
        <button onClick={openNew} style={{ padding: '8px 14px', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>+ Novo</button>
      </div>

      {/* REGISTRACIJA BANNERI */}
      {(() => {
        const istekla = vehicles.filter(v => v.dana_do_isteka !== null && v.dana_do_isteka <= 0)
        const skoro = vehicles.filter(v => v.dana_do_isteka !== null && v.dana_do_isteka > 0 && v.dana_do_isteka <= 15)
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
            {istekla.length > 0 && <div onClick={() => { setFilterReg('istekla'); setActiveTab('lista') }} style={{ background: '#FEE2E2', border: '1px solid #DC2626', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 12, color: '#DC2626', fontWeight: 600 }}>🚫 Istekla reg: {istekla.map(v => v.license_plate).join(', ')}</div>}
            {skoro.length > 0 && <div onClick={() => { setFilterReg('skoro'); setActiveTab('lista') }} style={{ background: '#FAEEDA', border: '1px solid #EF9F27', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 12, color: '#BA7517', fontWeight: 600 }}>⚠️ Ističe ≤15d: {skoro.map(v => `${v.license_plate}(${Math.round(v.dana_do_isteka!)}d)`).join(', ')}</div>}
          </div>
        )
      })()}

      {/* TABOVI */}
      <div style={{ display: 'flex', borderBottom: '2px solid #f3f4f6', marginBottom: 12 }}>
        {([['lista', '📋 Lista vozila'], ['klase', '🏷️ Klase vozila']] as const).map(([t, l]) => (
          <button key={t} onClick={() => setActiveTab(t)}
            style={{ padding: '8px 16px', fontSize: 13, border: 'none', background: 'none', cursor: 'pointer', fontWeight: activeTab === t ? 700 : 400, color: activeTab === t ? '#1D9E75' : '#9ca3af', borderBottom: activeTab === t ? '2px solid #1D9E75' : '2px solid transparent', marginBottom: -2 }}>
            {l}
          </button>
        ))}
      </div>

      {/* ═══ TAB: LISTA ═══ */}
      {activeTab === 'lista' && (<>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '10px 12px', marginBottom: 10 }}>
          <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="🔍 Pretraži tablice, naziv..." style={{ ...inp, marginBottom: 8, fontSize: 14 }} />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...inpSm, flex: 1, minWidth: 110 }}>
              <option value="SVE">Svi statusi</option>
              {FLEET_STATUS_OPTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <select value={filterLok} onChange={e => setFilterLok(e.target.value)} style={{ ...inpSm, flex: 1, minWidth: 90 }}>
              <option value="SVE">Sve lok.</option>
              {LOKACIJE.map(l => <option key={l} value={l}>{l.split(' ')[0]}</option>)}
            </select>
            <select value={filterMarka} onChange={e => setFilterMarka(e.target.value)} style={{ ...inpSm, flex: 1, minWidth: 90 }}>
              {marke.map(m => <option key={m} value={m}>{m === 'SVE' ? 'Sve marke' : m}</option>)}
            </select>
            <select value={filterClass} onChange={e => setFilterClass(e.target.value)} style={{ ...inpSm, flex: 1, minWidth: 100 }}>
              <option value="SVE">Sve klase</option>
              {dbKlase.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
            <select value={filterReg} onChange={e => setFilterReg(e.target.value)} style={{ ...inpSm, flex: 1, minWidth: 90 }}>
              <option value="SVE">Reg: sve</option>
              <option value="istekla">🚫 Istekla</option>
              <option value="skoro">⚠️ ≤15d</option>
              <option value="ok">✅ Uredna</option>
              <option value="nema">❓ Nema</option>
            </select>
            {(searchQ || filterLok !== 'SVE' || filterStatus !== 'SVE' || filterMarka !== 'SVE' || filterClass !== 'SVE' || filterReg !== 'SVE') && (
              <button onClick={() => { setSearchQ(''); setFilterLok('SVE'); setFilterStatus('SVE'); setFilterMarka('SVE'); setFilterClass('SVE'); setFilterReg('SVE') }}
                style={{ padding: '5px 10px', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: 'pointer', color: '#6b7280' }}>✕</button>
            )}
          </div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>{filtered.length} vozila</div>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Učitavanje...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', border: '1px dashed #e5e7eb', borderRadius: 12 }}>Nema vozila.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {Array.from(new Set(filtered.map(v => v.marka || 'Ostalo'))).sort().map(marka => {
              const vozilaMarke = filtered.filter(v => (v.marka || 'Ostalo') === marka)
              return (
                <div key={marka}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1, padding: '8px 4px 3px', borderBottom: '1px solid #f3f4f6', marginBottom: 2 }}>
                    {marka} ({vozilaMarke.length})
                  </div>
                  {vozilaMarke.map(v => {
                    const st = getStatusInfo(v.fleet_status)
                    const isticeSkoro = v.dana_do_isteka !== null && v.dana_do_isteka <= 30 && v.dana_do_isteka > 0
                    const istekla = v.dana_do_isteka !== null && v.dana_do_isteka <= 0
                    return (
                      <div key={v.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', marginBottom: 3, borderLeft: `3px solid ${st.color}`, opacity: v.fleet_status === 'sold' ? 0.6 : 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', flexWrap: 'wrap' as const }}>
                          <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#111', background: '#f3f4f6', padding: '1px 6px', borderRadius: 4 }}>{v.license_plate || '—'}</span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#374151', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{v.marka} {v.model} {v.year ? `'${String(v.year).slice(2)}` : ''}</span>
                          {v.vehicle_class && <span style={{ fontSize: 10, background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb', padding: '1px 7px', borderRadius: 12, fontWeight: 600 }}>{v.vehicle_class}</span>}
                          <span style={{ fontSize: 10, background: st.bg, color: st.color, padding: '1px 6px', borderRadius: 12, fontWeight: 600, whiteSpace: 'nowrap' as const }}>{st.label}</span>
                          {istekla && <span style={{ fontSize: 10, background: '#FEE2E2', color: '#DC2626', padding: '1px 5px', borderRadius: 10, fontWeight: 700 }}>🚫</span>}
                          {isticeSkoro && !istekla && <span style={{ fontSize: 10, background: '#FAEEDA', color: '#BA7517', padding: '1px 5px', borderRadius: 10, fontWeight: 700 }}>⚠️{Math.round(v.dana_do_isteka!)}d</span>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 8px 6px', flexWrap: 'wrap' as const }}>
                          <span style={{ fontSize: 10, color: '#9ca3af' }}>{v.transmission === 'manual' ? 'MAN' : 'AUT'} · {v.fuel_type === 'diesel' ? 'DSL' : v.fuel_type === 'petrol' ? 'BNZ' : 'EL'} · {v.lokacija?.split(' ')[0]}{v.istek_reg ? ` · 📋${v.istek_reg}` : ''}</span>
                          <div style={{ display: 'flex', gap: 3, marginLeft: 'auto', flexWrap: 'wrap' as const }}>
                            <button onClick={() => openRegModal(v)} style={{ padding: '2px 7px', fontSize: 10, border: `1px solid ${istekla ? '#DC2626' : isticeSkoro ? '#BA7517' : '#d1d5db'}`, borderRadius: 6, background: istekla ? '#FEE2E2' : isticeSkoro ? '#FAEEDA' : '#fff', cursor: 'pointer', color: istekla ? '#DC2626' : isticeSkoro ? '#BA7517' : '#374151', fontWeight: 600 }}>📋</button>
                            <select value={v.fleet_status} onChange={e => quickStatusUpdate(v.id, e.target.value)} style={{ padding: '2px 4px', fontSize: 10, border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', color: '#374151', cursor: 'pointer', maxWidth: 90 }}>
                              {FLEET_STATUS_OPTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                            </select>
                            <select value={v.lokacija} onChange={e => quickLokUpdate(v.id, e.target.value)} style={{ padding: '2px 4px', fontSize: 10, border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', color: '#374151', cursor: 'pointer', maxWidth: 70 }}>
                              {LOKACIJE.map(l => <option key={l} value={l}>{l.split(' ')[0]}</option>)}
                            </select>
                            <select value={v.vehicle_class || ''} onChange={e => quickClassUpdate(v.id, e.target.value)} style={{ padding: '2px 4px', fontSize: 10, border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', color: '#374151', cursor: 'pointer', maxWidth: 90 }}>
                              <option value="">— klasa</option>
                              {dbKlase.map(k => <option key={k} value={k}>{k}</option>)}
                            </select>
                            <button onClick={() => openEdit(v)} style={{ padding: '2px 7px', fontSize: 10, border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: 'pointer', color: '#374151' }}>✏️</button>
                            <button onClick={() => deleteVehicle(v.id, v.license_plate || String(v.id))} style={{ padding: '2px 6px', fontSize: 10, border: '1px solid #fecaca', borderRadius: 6, background: '#fff', cursor: 'pointer', color: '#dc2626' }}>✕</button>
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
      </>)}

      {/* ═══ TAB: KLASE ═══ */}
      {activeTab === 'klase' && (
        <KlaseTab vehicles={vehicles} onFilterClick={(naziv) => { setFilterClass(naziv); setActiveTab('lista') }} />
      )}

      {/* FORMA MODAL */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: '#fff', borderRadius: '16px 16px 0 0', width: '100%', maxWidth: 600, maxHeight: '92vh', overflowY: 'auto', padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#111' }}>{editVehicle ? 'Uredi vozilo' : 'Novo vozilo'}</div>
              <button onClick={() => { setShowForm(false); setEditVehicle(null); setForm(EMPTY_FORM); setFeaturesStr('') }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#9ca3af' }}>✕</button>
            </div>

            {/* KLASA — iz baze */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ ...lbl, fontSize: 12, fontWeight: 700, color: '#374151' }}>Klasa vozila</label>
              <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6 }}>
                {dbKlase.map(k => {
                  const isSelected = (form.vehicle_class || '') === k
                  return (
                    <button key={k} onClick={() => setForm(f => ({ ...f, vehicle_class: k }))}
                      style={{ padding: '7px 14px', border: `2px solid ${isSelected ? '#1D9E75' : '#e5e7eb'}`, borderRadius: 8, background: isSelected ? '#E1F5EE' : '#f9fafb', cursor: 'pointer', fontSize: 13, fontWeight: isSelected ? 700 : 400, color: isSelected ? '#085041' : '#6b7280', transition: 'all 0.12s' }}>
                      {k}
                    </button>
                  )
                })}
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Slika vozila</label>
              {form.image_url && <img src={form.image_url} alt="" style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 8, marginBottom: 6 }} />}
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px', border: '1px dashed #d1d5db', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: '#6b7280', background: '#f9fafb' }}>
                {uploading ? 'Uploaduje se...' : '+ Odaberi sliku'}
                <input type="file" accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} disabled={uploading} />
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
              <div style={{ gridColumn: 'span 2' }}><label style={lbl}>Tablice</label><input style={inp} value={form.license_plate || ''} onChange={e => setForm(f => ({ ...f, license_plate: e.target.value }))} /></div>
              <div><label style={lbl}>Marka *</label><input style={inp} value={form.marka || ''} onChange={e => setForm(f => ({ ...f, marka: e.target.value }))} /></div>
              <div><label style={lbl}>Model *</label><input style={inp} value={form.model || ''} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} /></div>
              <div><label style={lbl}>Godište</label><input style={inp} type="number" value={form.year || ''} onChange={e => setForm(f => ({ ...f, year: parseInt(e.target.value) || undefined }))} /></div>
              <div><label style={lbl}>Boja</label><input style={inp} value={form.color || ''} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} /></div>
              <div><label style={lbl}>Mjenjač</label>
                <select style={inp} value={form.transmission || 'manual'} onChange={e => setForm(f => ({ ...f, transmission: e.target.value }))}>
                  <option value="manual">Manual</option><option value="automatic">Automatik</option>
                </select>
              </div>
              <div><label style={lbl}>Gorivo</label>
                <select style={inp} value={form.fuel_type || 'diesel'} onChange={e => setForm(f => ({ ...f, fuel_type: e.target.value }))}>
                  <option value="diesel">Dizel</option><option value="petrol">Benzin</option><option value="electric">Električno</option><option value="hybrid">Hibrid</option>
                </select>
              </div>
              <div><label style={lbl}>Cijena/dan (€)</label><input style={inp} type="number" value={form.price_per_day || 0} onChange={e => setForm(f => ({ ...f, price_per_day: parseFloat(e.target.value) || 0 }))} /></div>
              <div><label style={lbl}>Status</label>
                <select style={inp} value={form.fleet_status || 'available'} onChange={e => setForm(f => ({ ...f, fleet_status: e.target.value, is_available: e.target.value === 'available' }))}>
                  {FLEET_STATUS_OPTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div><label style={lbl}>Lokacija</label>
                <select style={inp} value={form.lokacija || 'CRNA GORA'} onChange={e => setForm(f => ({ ...f, lokacija: e.target.value }))}>
                  {LOKACIJE.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div><label style={lbl}>Istek reg. (DD.MM.YYYY.)</label><input style={inp} value={form.istek_reg || ''} onChange={e => setForm(f => ({ ...f, istek_reg: e.target.value }))} placeholder="15.06.2026." /></div>
              <div><label style={lbl}>Mjesto reg.</label><input style={inp} value={form.mjesto_reg || ''} onChange={e => setForm(f => ({ ...f, mjesto_reg: e.target.value }))} /></div>
              <div style={{ gridColumn: 'span 2' }}><label style={lbl}>Vlasnik</label><input style={inp} value={form.vlasnik || ''} onChange={e => setForm(f => ({ ...f, vlasnik: e.target.value }))} /></div>
              <div><label style={lbl}>Kilometraža</label><input style={inp} type="number" value={form.current_mileage || ''} onChange={e => setForm(f => ({ ...f, current_mileage: parseInt(e.target.value) || undefined }))} /></div>
              <div><label style={lbl}>Mjesta</label><input style={inp} type="number" value={form.seats || ''} onChange={e => setForm(f => ({ ...f, seats: parseInt(e.target.value) || undefined }))} /></div>
              <div style={{ gridColumn: 'span 2' }}><label style={lbl}>Oprema (zarezom)</label><input style={inp} value={featuresStr} onChange={e => setFeaturesStr(e.target.value)} placeholder="Klima, GPS, Bluetooth" /></div>
              <div style={{ gridColumn: 'span 2' }}><label style={lbl}>Napomena</label><textarea style={{ ...inp, minHeight: 50, resize: 'vertical' as const }} value={form.fleet_notes || ''} onChange={e => setForm(f => ({ ...f, fleet_notes: e.target.value }))} /></div>
            </div>

            <button onClick={saveVehicle} disabled={saving || uploading}
              style={{ width: '100%', padding: 12, background: saving ? '#5DCAA5' : '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              {saving ? 'Snimanje...' : editVehicle ? '💾 Sačuvaj' : '+ Dodaj vozilo'}
            </button>
          </div>
        </div>
      )}

      {/* REGISTRACIJA MODAL */}
      {showRegModal && regVehicle && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 300 }}>
          <div style={{ background: '#fff', borderRadius: '16px 16px 0 0', width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#111' }}>📋 Registracija</div>
                <div style={{ fontSize: 11, color: '#6b7280' }}>{regVehicle.license_plate} · {regVehicle.agregirani_2}</div>
              </div>
              <button onClick={() => setShowRegModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#9ca3af' }}>✕</button>
            </div>
            <div style={{ display: 'flex', gap: 16, padding: '10px 16px', background: '#f9fafb', borderBottom: '1px solid #f3f4f6', fontSize: 12 }}>
              <div><div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 700 }}>TABLICE</div><div style={{ fontWeight: 700, fontFamily: 'monospace' }}>{regVehicle.license_plate || '—'}</div></div>
              <div><div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 700 }}>ISTEK</div><div style={{ fontWeight: 700, color: regVehicle.dana_do_isteka !== null && regVehicle.dana_do_isteka <= 0 ? '#DC2626' : '#111' }}>{regVehicle.istek_reg || '—'}</div></div>
              <div><div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 700 }}>MJESTO</div><div style={{ fontWeight: 700 }}>{regVehicle.mjesto_reg || '—'}</div></div>
            </div>
            <div style={{ display: 'flex', borderBottom: '1px solid #f3f4f6', padding: '0 16px', overflowX: 'auto' as const }}>
              {([['produzenje', '🔄 Produži'], ['nova', '🆕 Nove tablice'], ['dokumenti', '📁 Dokumenti'], ['istorija', '📜 Istorija']] as const).map(([t, l]) => (
                <button key={t} onClick={() => setRegTab(t)}
                  style={{ padding: '10px 12px', fontSize: 12, border: 'none', background: 'none', cursor: 'pointer', fontWeight: regTab === t ? 600 : 400, color: regTab === t ? '#111' : '#9ca3af', borderBottom: regTab === t ? '2px solid #111' : '2px solid transparent', marginBottom: -1, whiteSpace: 'nowrap' as const }}>
                  {l}
                </button>
              ))}
            </div>
            <div style={{ padding: 16 }}>
              {regTab === 'produzenje' && (
                <div>
                  <div style={{ background: '#E1F5EE', border: '1px solid #1D9E75', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 12, color: '#085041' }}>Produži registraciju sa istim tablicama — samo unesite novi datum isteka.</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                    <div><label style={lbl}>Novi istek reg. (DD.MM.YYYY.) *</label><input style={inpSm} value={regForm.istek_reg} onChange={e => setRegForm(f => ({ ...f, istek_reg: e.target.value }))} placeholder="15.06.2027." /></div>
                    <div><label style={lbl}>Datum registracije (DD.MM.YYYY.)</label><input style={inpSm} value={regForm.datum_registracije} onChange={e => setRegForm(f => ({ ...f, datum_registracije: e.target.value }))} placeholder="01.01.2027." /></div>
                  </div>
                  <div style={{ marginBottom: 10 }}><label style={lbl}>Mjesto reg.</label><input style={inpSm} value={regForm.mjesto_reg} onChange={e => setRegForm(f => ({ ...f, mjesto_reg: e.target.value }))} /></div>
                  <div style={{ marginBottom: 14 }}><label style={lbl}>Napomena</label><textarea style={{ ...inpSm, minHeight: 40, resize: 'vertical' as const }} value={regForm.napomena} onChange={e => setRegForm(f => ({ ...f, napomena: e.target.value }))} /></div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setShowRegModal(false)} style={{ flex: 1, padding: '10px', border: '1px solid #e5e7eb', borderRadius: 8, background: 'transparent', fontSize: 13, cursor: 'pointer', color: '#374151' }}>Odustani</button>
                    <button onClick={saveRegistracija} disabled={regSaving || !regForm.istek_reg} style={{ flex: 2, padding: '10px', background: regSaving ? '#5DCAA5' : (!regForm.istek_reg ? '#9ca3af' : '#1D9E75'), color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                      {regSaving ? '⏳...' : '🔄 Produži registraciju'}
                    </button>
                  </div>
                </div>
              )}
              {regTab === 'nova' && (
                <div>
                  <div style={{ background: '#E6F1FB', border: '1px solid #85B7EB', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 12, color: '#0C447C' }}>Nova registracija sa novim tablicama — stare tablice bit će arhivirane.</div>
                  <div style={{ marginBottom: 10 }}>
                    <label style={lbl}>Nove tablice *</label>
                    <input style={{ ...inpSm, fontFamily: 'monospace', fontWeight: 700, fontSize: 14 }} value={regForm.license_plate} onChange={e => setRegForm(f => ({ ...f, license_plate: e.target.value.toUpperCase() }))} placeholder="PG-BB222" />
                    {regVehicle?.license_plate && regForm.license_plate && regForm.license_plate !== regVehicle.license_plate && (
                      <div style={{ marginTop: 4, fontSize: 11, color: '#185FA5', background: '#E6F1FB', padding: '3px 8px', borderRadius: 6 }}>{regVehicle.license_plate} → {regForm.license_plate}</div>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                    <div><label style={lbl}>Istek reg. (DD.MM.YYYY.) *</label><input style={inpSm} value={regForm.istek_reg} onChange={e => setRegForm(f => ({ ...f, istek_reg: e.target.value }))} placeholder="15.06.2027." /></div>
                    <div><label style={lbl}>Datum registracije (DD.MM.YYYY.)</label><input style={inpSm} value={regForm.datum_registracije} onChange={e => setRegForm(f => ({ ...f, datum_registracije: e.target.value }))} placeholder="01.01.2027." /></div>
                  </div>
                  <div style={{ marginBottom: 10 }}><label style={lbl}>Mjesto reg.</label><input style={inpSm} value={regForm.mjesto_reg} onChange={e => setRegForm(f => ({ ...f, mjesto_reg: e.target.value }))} /></div>
                  <div style={{ marginBottom: 14 }}><label style={lbl}>Napomena</label><textarea style={{ ...inpSm, minHeight: 40, resize: 'vertical' as const }} value={regForm.napomena} onChange={e => setRegForm(f => ({ ...f, napomena: e.target.value }))} /></div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setShowRegModal(false)} style={{ flex: 1, padding: '10px', border: '1px solid #e5e7eb', borderRadius: 8, background: 'transparent', fontSize: 13, cursor: 'pointer', color: '#374151' }}>Odustani</button>
                    <button onClick={saveRegistracija} disabled={regSaving || !regForm.license_plate || !regForm.istek_reg} style={{ flex: 2, padding: '10px', background: regSaving ? '#5DCAA5' : (!regForm.license_plate || !regForm.istek_reg ? '#9ca3af' : '#185FA5'), color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                      {regSaving ? '⏳...' : '🆕 Snimi novu registraciju'}
                    </button>
                  </div>
                </div>
              )}
              {regTab === 'dokumenti' && (
                <div>
                  <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, marginBottom: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#111', marginBottom: 8 }}>📄 Saobraćajna dozvola</div>
                    {docUrls.saobracajna_url ? (<div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}><a href={docUrls.saobracajna_url} target="_blank" rel="noreferrer" style={{ padding: '6px 14px', background: '#E1F5EE', color: '#085041', borderRadius: 8, fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>📄 Otvori dokument</a><button onClick={() => setDocUrls(d => ({ ...d, saobracajna_url: '' }))} style={{ padding: '6px 10px', fontSize: 11, border: '1px solid #fecaca', borderRadius: 8, background: '#fff', cursor: 'pointer', color: '#dc2626' }}>✕ Ukloni</button></div>) : null}
                    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px', border: '1px dashed #1D9E75', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: '#1D9E75', background: '#f9fafb', fontWeight: 600 }}>
                      {uploadingDoc === 'saobracajna' ? '⏳ Uploaduje se...' : '📷 Slikaj / Dodaj saobraćajnu'}
                      <input type="file" accept="image/*,application/pdf" capture="environment" style={{ display: 'none' }} disabled={!!uploadingDoc} onChange={async e => { const file = e.target.files?.[0]; if (!file) return; const url = await uploadDoc(file, 'saobracajna'); if (url) setDocUrls(d => ({ ...d, saobracajna_url: url })) }} />
                    </label>
                  </div>
                  <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, marginBottom: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#111', marginBottom: 8 }}>🛡️ Polisa osiguranja</div>
                    {docUrls.polisa_url ? (<div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}><a href={docUrls.polisa_url} target="_blank" rel="noreferrer" style={{ padding: '6px 14px', background: '#E6F1FB', color: '#0C447C', borderRadius: 8, fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>🛡️ Otvori polisu</a><button onClick={() => setDocUrls(d => ({ ...d, polisa_url: '' }))} style={{ padding: '6px 10px', fontSize: 11, border: '1px solid #fecaca', borderRadius: 8, background: '#fff', cursor: 'pointer', color: '#dc2626' }}>✕ Ukloni</button></div>) : null}
                    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px', border: '1px dashed #185FA5', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: '#185FA5', background: '#f9fafb', fontWeight: 600 }}>
                      {uploadingDoc === 'polisa' ? '⏳ Uploaduje se...' : '📷 Slikaj / Dodaj polisu'}
                      <input type="file" accept="image/*,application/pdf" capture="environment" style={{ display: 'none' }} disabled={!!uploadingDoc} onChange={async e => { const file = e.target.files?.[0]; if (!file) return; const url = await uploadDoc(file, 'polisa'); if (url) setDocUrls(d => ({ ...d, polisa_url: url })) }} />
                    </label>
                    <div style={{ marginTop: 10 }}><label style={lbl}>Istek polise (DD.MM.YYYY.)</label><input style={inpSm} value={docUrls.polisa_istek} onChange={e => setDocUrls(d => ({ ...d, polisa_istek: e.target.value }))} placeholder="31.12.2026." /></div>
                  </div>
                  <button onClick={saveDokumenti} disabled={regSaving || !!uploadingDoc} style={{ width: '100%', padding: '12px', background: regSaving ? '#5DCAA5' : '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>{regSaving ? '⏳ Snimanje...' : '💾 Sačuvaj dokumente'}</button>
                </div>
              )}
              {regTab === 'istorija' && (
                <div>
                  {regHistoryLoading ? (
                    <div style={{ padding: 30, textAlign: 'center', color: '#9ca3af' }}>Učitavanje...</div>
                  ) : regHistory.length === 0 ? (
                    <div style={{ padding: 30, textAlign: 'center', color: '#9ca3af', border: '1px dashed #e5e7eb', borderRadius: 10 }}>Nema historije.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {regHistory.map((r, i) => {
                        const sljedeci = regHistory[i + 1]
                        const promjenjeneTablice = sljedeci && sljedeci.license_plate && r.license_plate && sljedeci.license_plate !== r.license_plate
                        return (
                          <div key={r.id} style={{ border: `1px solid ${i === 0 ? '#1D9E75' : '#e5e7eb'}`, borderRadius: 8, padding: '10px 12px', background: i === 0 ? '#f0fdf8' : '#fff' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                              <div>
                                {promjenjeneTablice ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#9ca3af', textDecoration: 'line-through' }}>{sljedeci.license_plate}</span>
                                    <span style={{ fontSize: 11, color: '#9ca3af' }}>→</span>
                                    <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: '#185FA5' }}>{r.license_plate}</span>
                                    <span style={{ fontSize: 10, background: '#E6F1FB', color: '#0C447C', padding: '1px 6px', borderRadius: 10, fontWeight: 600 }}>nove tablice</span>
                                  </div>
                                ) : (
                                  <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700 }}>{r.license_plate || '—'}</span>
                                )}
                              </div>
                              <span style={{ fontSize: 11, color: '#9ca3af', flexShrink: 0, marginLeft: 8 }}>{r.datum_registracije || new Date(r.created_at).toLocaleDateString('sr-RS')}</span>
                            </div>
                            <div style={{ fontSize: 12, color: '#6b7280', display: 'flex', gap: 12 }}>
                              {r.istek_reg && <span>Istek: <strong>{r.istek_reg}</strong></span>}
                              {r.mjesto_reg && <span>Mjesto: <strong>{r.mjesto_reg}</strong></span>}
                              {r.created_by && <span>Agent: <strong>{r.created_by}</strong></span>}
                            </div>
                            {r.napomena && !r.napomena.startsWith('[Stari') && (
                              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3, fontStyle: 'italic' }}>{r.napomena}</div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ═══ KLASE TAB KOMPONENTA ═══
type VehicleClass = { id: number; naziv: string; created_at: string }

function KlaseTab({ vehicles, onFilterClick }: { vehicles: FleetVehicle[]; onFilterClick: (naziv: string) => void }) {
  const [klase, setKlase] = useState<VehicleClass[]>([])
  const [loading, setLoading] = useState(true)
  const [noviNaziv, setNoviNaziv] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editNaziv, setEditNaziv] = useState('')

  const inp: React.CSSProperties = { padding: '8px 12px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', color: '#111', boxSizing: 'border-box' as const }

  useEffect(() => { fetchKlase() }, [])

  async function fetchKlase() {
    setLoading(true)
    const { data } = await supabase.from('vehicle_classes').select('*').order('naziv')
    setKlase(data || [])
    setLoading(false)
  }

  async function addKlasa() {
    const naziv = noviNaziv.trim()
    if (!naziv) return
    setSaving(true)
    await supabase.from('vehicle_classes').insert({ naziv })
    setNoviNaziv('')
    setSaving(false)
    fetchKlase()
  }

  async function saveEdit(id: number) {
    const naziv = editNaziv.trim()
    if (!naziv) return
    const stari = klase.find(k => k.id === id)?.naziv
    await supabase.from('vehicle_classes').update({ naziv }).eq('id', id)
    if (stari && stari !== naziv) {
      await supabase.from('vozila_fleet').update({ vehicle_class: naziv }).eq('vehicle_class', stari)
    }
    setEditingId(null)
    fetchKlase()
  }

  async function deleteKlasa(id: number, naziv: string) {
    const count = vehicles.filter(v => v.vehicle_class === naziv).length
    if (count > 0) {
      if (!confirm(`Klasa "${naziv}" koristi se za ${count} vozila. Svakako obrisati?`)) return
      await supabase.from('vozila_fleet').update({ vehicle_class: null }).eq('vehicle_class', naziv)
    } else {
      if (!confirm(`Obrisati klasu "${naziv}"?`)) return
    }
    await supabase.from('vehicle_classes').delete().eq('id', id)
    fetchKlase()
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Učitavanje...</div>

  return (
    <div>
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 14, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#111', marginBottom: 10 }}>Dodaj novu klasu</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input style={{ ...inp, flex: 1 }} value={noviNaziv} onChange={e => setNoviNaziv(e.target.value)} onKeyDown={e => e.key === 'Enter' && addKlasa()} placeholder="npr. Minivan, Pickup..." />
          <button onClick={addKlasa} disabled={saving || !noviNaziv.trim()}
            style={{ padding: '8px 18px', background: noviNaziv.trim() ? '#1D9E75' : '#9ca3af', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' as const }}>
            + Dodaj
          </button>
        </div>
      </div>

      <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ background: '#f9fafb', padding: '8px 14px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>
          <span>Naziv klase</span><span>Vozila</span>
        </div>
        {klase.length === 0 ? (
          <div style={{ padding: 30, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Nema klasa. Dodaj prvu klasu gore.</div>
        ) : klase.map((k, i) => {
          const count = vehicles.filter(v => v.vehicle_class === k.naziv).length
          const available = vehicles.filter(v => v.vehicle_class === k.naziv && v.fleet_status === 'available').length
          const isEditing = editingId === k.id
          return (
            <div key={k.id} style={{ borderBottom: i < klase.length - 1 ? '1px solid #f3f4f6' : 'none', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, background: isEditing ? '#f0fdf8' : '#fff' }}>
              {isEditing ? (
                <>
                  <input style={{ ...inp, flex: 1, fontSize: 13, padding: '6px 10px' }} value={editNaziv} onChange={e => setEditNaziv(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveEdit(k.id); if (e.key === 'Escape') setEditingId(null) }} autoFocus />
                  <button onClick={() => saveEdit(k.id)} style={{ padding: '6px 12px', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>✓ Snimi</button>
                  <button onClick={() => setEditingId(null)} style={{ padding: '6px 10px', background: '#f3f4f6', color: '#6b7280', border: '1px solid #e5e7eb', borderRadius: 7, fontSize: 12, cursor: 'pointer' }}>Odustani</button>
                </>
              ) : (
                <>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>{k.naziv}</div>
                    {count > 0 && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{available} dostupno · {count - available} zauzeto</div>}
                  </div>
                  <div onClick={() => count > 0 && onFilterClick(k.naziv)}
                    style={{ fontSize: 13, fontWeight: 700, color: count > 0 ? '#1D9E75' : '#d1d5db', background: count > 0 ? '#E1F5EE' : '#f9fafb', border: `1px solid ${count > 0 ? '#1D9E75' : '#e5e7eb'}`, padding: '3px 10px', borderRadius: 20, cursor: count > 0 ? 'pointer' : 'default', minWidth: 32, textAlign: 'center' as const }}>
                    {count}
                  </div>
                  <button onClick={() => { setEditingId(k.id); setEditNaziv(k.naziv) }} style={{ padding: '5px 10px', fontSize: 11, border: '1px solid #e5e7eb', borderRadius: 7, background: '#fff', cursor: 'pointer', color: '#374151' }}>✏️</button>
                  <button onClick={() => deleteKlasa(k.id, k.naziv)} style={{ padding: '5px 8px', fontSize: 11, border: '1px solid #fecaca', borderRadius: 7, background: '#fff', cursor: 'pointer', color: '#dc2626' }}>✕</button>
                </>
              )}
            </div>
          )
        })}
      </div>

      {vehicles.filter(v => !v.vehicle_class || !klase.find(k => k.naziv === v.vehicle_class)).length > 0 && (
        <div style={{ marginTop: 14, border: '1px dashed #e5e7eb', borderRadius: 10, padding: 12, background: '#f9fafb' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#9ca3af', marginBottom: 6 }}>
            Bez klase — {vehicles.filter(v => !v.vehicle_class || !klase.find(k => k.naziv === v.vehicle_class)).length} vozila
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 4 }}>
            {vehicles.filter(v => !v.vehicle_class || !klase.find(k => k.naziv === v.vehicle_class)).map(v => (
              <span key={v.id} style={{ fontSize: 11, fontFamily: 'monospace', background: '#fff', border: '1px solid #e5e7eb', color: '#374151', padding: '2px 8px', borderRadius: 6, fontWeight: 600 }}>{v.license_plate || '—'}</span>
            ))}
          </div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>Dodijeli klasu kroz listu vozila.</div>
        </div>
      )}
    </div>
  )
}
