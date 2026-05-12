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

const SERVICE_TYPES = [
  { key: 'mali_servis', label: 'Mali servis', icon: '🔧' },
  { key: 'veliki_servis', label: 'Veliki servis', icon: '⚙️' },
  { key: 'kvarovi', label: 'Kvar', icon: '⚠️' },
  { key: 'gume', label: 'Gume', icon: '🛞' },
  { key: 'registracija', label: 'Registracija', icon: '📋' },
  { key: 'provjera', label: 'Provjera vozila', icon: '🔍' },
  { key: 'ostalo', label: 'Ostalo', icon: '📝' },
]

const CHECKLIST = [
  { key: 'check_ulje', label: '🛢️ Ulje' },
  { key: 'check_voda', label: '💧 Rashladna tečnost' },
  { key: 'check_tecnost_brisaci', label: '🪣 Tečnost za brisače' },
  { key: 'check_svetla', label: '💡 Signalizacija / Svjetla' },
  { key: 'check_klima', label: '❄️ Klima uređaj' },
  { key: 'check_brave', label: '🔒 Brave / Vrata / Gepek' },
  { key: 'check_enterijer', label: '🪑 Enterijer / Čistoća' },
  { key: 'check_brisaci', label: '🌧️ Brisači' },
  { key: 'check_prskalice', label: '💦 Prskalice' },
  { key: 'check_podizaci', label: '🪟 Podizači stakala' },
]

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  pending:   { label: 'Na čekanju', bg: '#FAEEDA', color: '#633806' },
  in_progress: { label: 'U toku', bg: '#E6F1FB', color: '#0C447C' },
  completed: { label: 'Završeno', bg: '#E1F5EE', color: '#085041' },
  cancelled: { label: 'Otkazano', bg: '#f3f4f6', color: '#6b7280' },
}

type Vozilo = {
  id: number; license_plate: string; agregirani_2: string
  marka: string; model: string; fleet_status: string; lokacija: string
  current_mileage?: number
}
type Servis = {
  id: string; vehicle_id: number; service_type: string; service_date: string
  mileage_at_service?: number; description?: string; cost?: number
  performed_by?: string; external_shop?: string
  next_service_date?: string; next_service_mileage?: number
  status: string; notes?: string; created_at: string
}
type Serviser = {
  id: string; full_name: string; phone?: string; portal_email?: string
  is_active: boolean; bonus_per_service?: number; bonus_per_repair?: number
  salary?: number; notes?: string; created_at: string
}

type Tab = 'vozila' | 'serviseri'

export default function ServisPage() {
  const [activeTab, setActiveTab] = useState<Tab>('vozila')
  const [vozila, setVozila] = useState<Vozilo[]>([])
  const [servisi, setServisi] = useState<Servis[]>([])
  const [serviseri, setServiseri] = useState<Serviser[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedVozilo, setSelectedVozilo] = useState<Vozilo | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [filterLok, setFilterLok] = useState('sve')
  const [selectedServis, setSelectedServis] = useState<Servis | null>(null)
  const [editMode, setEditMode] = useState(false)

  // Serviseri state
  const [showServiserForm, setShowServiserForm] = useState(false)
  const [serviserForm, setServiserForm] = useState<any>({
    full_name: '', phone: '', portal_email: '', is_active: true,
    bonus_per_service: '', bonus_per_repair: '', salary: '', notes: ''
  })
  const [editServiser, setEditServiser] = useState<Serviser | null>(null)
  const [serviserSaving, setServiserSaving] = useState(false)

  const agentName = getCookie('avtorent-agent-name')

  const emptyForm = {
    service_type: 'mali_servis', service_date: new Date().toISOString().split('T')[0],
    mileage_at_service: '', description: '', cost: '',
    performed_by: '', external_shop: '', next_service_date: '',
    next_service_mileage: '', status: 'completed', notes: '',
    check_ulje: true, check_voda: true, check_tecnost_brisaci: true,
    check_svetla: true, check_klima: true, check_brave: true,
    check_enterijer: true, check_brisaci: true, check_prskalice: true, check_podizaci: true,
  }
  const [form, setForm] = useState<any>(emptyForm)
  const [editForm, setEditForm] = useState<any>({})

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [{ data: v }, { data: s }, { data: t }] = await Promise.all([
      supabase.from('vozila_fleet').select('id, license_plate, agregirani_2, marka, model, fleet_status, lokacija, current_mileage').order('agregirani_2'),
      supabase.from('vehicle_services').select('*').order('service_date', { ascending: false }),
      supabase.from('technicians').select('*').order('full_name'),
    ])
    setVozila(v || [])
    setServisi(s || [])
    setServiseri(t || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const lokacije = ['sve', ...Array.from(new Set(vozila.map(v => v.lokacija).filter(Boolean)))]

  const filteredVozila = vozila.filter(v => {
    if (filterLok !== 'sve' && v.lokacija !== filterLok) return false
    if (search && !v.agregirani_2?.toLowerCase().includes(search.toLowerCase()) &&
        !v.license_plate?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  function getVoziloServisi(voziloId: number) {
    return servisi.filter(s => Number(s.vehicle_id) === voziloId)
      .sort((a, b) => new Date(b.service_date).getTime() - new Date(a.service_date).getTime())
  }

  function getZadnjiServis(voziloId: number) {
    const s = getVoziloServisi(voziloId)
    return s.length > 0 ? s[0] : null
  }

  function getAktivniServis(voziloId: number) {
    return servisi.find(s => Number(s.vehicle_id) === voziloId && (s.status === 'in_progress' || s.status === 'pending'))
  }

  async function saveServis() {
    if (!selectedVozilo) { alert('Odaberi vozilo!'); return }
    setSaving(true)
    const checklistProblems = CHECKLIST.filter(c => form[c.key] === false).map(c => `❌ ${c.label}`)
    const notesText = [form.notes, ...checklistProblems].filter(Boolean).join(' | ') || null

    const { error } = await supabase.from('vehicle_services').insert([{
      vehicle_id: selectedVozilo.id,
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
      notes: notesText,
    }])
    if (error) { alert('Greška: ' + error.message); setSaving(false); return }

    if (form.status === 'in_progress' || form.status === 'pending') {
      await supabase.from('vozila_fleet').update({ fleet_status: 'service' }).eq('id', selectedVozilo.id)
    }
    if (form.mileage_at_service) {
      await supabase.from('vozila_fleet').update({ current_mileage: parseInt(form.mileage_at_service) }).eq('id', selectedVozilo.id)
    }

    setSaving(false); setShowForm(false); setForm(emptyForm)
    alert('Servis snimljen!'); fetchAll()
  }

  async function saveEdit() {
    if (!selectedServis) return
    const { error } = await supabase.from('vehicle_services').update({
      service_type: editForm.service_type,
      service_date: editForm.service_date,
      mileage_at_service: editForm.mileage_at_service ? parseInt(editForm.mileage_at_service) : null,
      description: editForm.description || null,
      cost: editForm.cost ? parseFloat(editForm.cost) : null,
      performed_by: editForm.performed_by || null,
      external_shop: editForm.external_shop || null,
      next_service_date: editForm.next_service_date || null,
      next_service_mileage: editForm.next_service_mileage ? parseInt(editForm.next_service_mileage) : null,
      status: editForm.status,
      notes: editForm.notes || null,
    }).eq('id', selectedServis.id)
    if (error) { alert('Greška: ' + error.message); return }
    if (editForm.status === 'completed') {
      await supabase.from('vozila_fleet').update({ fleet_status: 'available' }).eq('id', selectedServis.vehicle_id)
    }
    setEditMode(false); setSelectedServis({ ...selectedServis, ...editForm }); fetchAll()
  }

  async function deleteServis(id: string) {
    if (!confirm('Obrisati ovaj servisni zapis?')) return
    await supabase.from('vehicle_services').delete().eq('id', id)
    setSelectedServis(null); fetchAll()
  }

  // ─── SERVISERI FUNKCIJE ───────────────────────────────
  async function saveServiser() {
    if (!serviserForm.full_name) { alert('Unesite ime!'); return }
    setServiserSaving(true)
    const payload = {
      full_name: serviserForm.full_name,
      phone: serviserForm.phone || null,
      portal_email: serviserForm.portal_email || null,
      is_active: serviserForm.is_active,
      bonus_per_service: serviserForm.bonus_per_service ? parseFloat(serviserForm.bonus_per_service) : null,
      bonus_per_repair: serviserForm.bonus_per_repair ? parseFloat(serviserForm.bonus_per_repair) : null,
      salary: serviserForm.salary ? parseFloat(serviserForm.salary) : null,
      notes: serviserForm.notes || null,
    }
    if (editServiser) {
      await supabase.from('technicians').update(payload).eq('id', editServiser.id)
    } else {
      await supabase.from('technicians').insert([payload])
    }
    setServiserSaving(false); setShowServiserForm(false)
    setEditServiser(null); setServiserForm({ full_name: '', phone: '', portal_email: '', is_active: true, bonus_per_service: '', bonus_per_repair: '', salary: '', notes: '' })
    fetchAll()
  }

  async function toggleServiserActive(s: Serviser) {
    await supabase.from('technicians').update({ is_active: !s.is_active }).eq('id', s.id)
    fetchAll()
  }

  async function deleteServiser(id: string) {
    if (!confirm('Obrisati servisera?')) return
    await supabase.from('technicians').delete().eq('id', id)
    fetchAll()
  }

  const inp: React.CSSProperties = { width: '100%', padding: '8px 12px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, color: '#111', background: '#fff', boxSizing: 'border-box' }
  const lbl: React.CSSProperties = { fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 3, fontWeight: 500 }

  const totalAktivnih = servisi.filter(s => s.status === 'in_progress' || s.status === 'pending').length
  const aktivniServiseri = serviseri.filter(s => s.is_active).length

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#111', margin: 0 }}>Servis vozila</h1>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
            {vozila.length} vozila · {aktivniServiseri} servisera
            {totalAktivnih > 0 && <span style={{ color: '#d97706', fontWeight: 600, marginLeft: 8 }}>· {totalAktivnih} aktivnih servisa</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {activeTab === 'vozila' && selectedVozilo && (
            <button onClick={() => { setShowForm(s => !s); setSelectedServis(null); setEditMode(false) }}
              style={{ padding: '8px 16px', background: showForm ? '#f3f4f6' : '#1D9E75', color: showForm ? '#374151' : '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {showForm ? 'Zatvori' : '+ Novi servis'}
            </button>
          )}
          {activeTab === 'serviseri' && (
            <button onClick={() => { setShowServiserForm(s => !s); setEditServiser(null); setServiserForm({ full_name: '', phone: '', portal_email: '', is_active: true, bonus_per_service: '', bonus_per_repair: '', salary: '', notes: '' }) }}
              style={{ padding: '8px 16px', background: showServiserForm ? '#f3f4f6' : '#1D9E75', color: showServiserForm ? '#374151' : '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {showServiserForm ? 'Zatvori' : '+ Novi serviser'}
            </button>
          )}
        </div>
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 20, borderBottom: '1px solid #e5e7eb' }}>
        {[
          { id: 'vozila' as Tab, label: '🚗 Vozila i istorija' },
          { id: 'serviseri' as Tab, label: `🔧 Serviseri (${aktivniServiseri})` },
        ].map(t => (
          <button key={t.id} onClick={() => { setActiveTab(t.id); setShowForm(false); setShowServiserForm(false) }}
            style={{ padding: '9px 18px', fontSize: 13, border: 'none', background: 'none', cursor: 'pointer', fontWeight: activeTab === t.id ? 600 : 400, color: activeTab === t.id ? '#1D9E75' : '#6b7280', borderBottom: activeTab === t.id ? '2px solid #1D9E75' : '2px solid transparent', marginBottom: -1 }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ─── TAB: VOZILA ─── */}
      {activeTab === 'vozila' && (
        <div style={{ display: 'grid', gridTemplateColumns: selectedVozilo ? '300px 1fr' : '1fr', gap: 20 }}>
          {/* Lista vozila */}
          <div>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pretraži vozilo..." style={{ ...inp, marginBottom: 8 }} />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              {lokacije.map(l => (
                <button key={l} onClick={() => setFilterLok(l)}
                  style={{ padding: '4px 12px', fontSize: 11, border: `1px solid ${filterLok === l ? '#1D9E75' : '#e5e7eb'}`, borderRadius: 20, background: filterLok === l ? '#E1F5EE' : '#fff', color: filterLok === l ? '#085041' : '#6b7280', cursor: 'pointer', fontWeight: filterLok === l ? 600 : 400 }}>
                  {l === 'sve' ? 'Sve lokacije' : l}
                </button>
              ))}
            </div>

            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Učitavanje...</div>
            ) : filteredVozila.map(v => {
              const zadnji = getZadnjiServis(v.id)
              const aktivan = getAktivniServis(v.id)
              const isSelected = selectedVozilo?.id === v.id
              const brServisa = getVoziloServisi(v.id).length

              return (
                <div key={v.id} onClick={() => { setSelectedVozilo(isSelected ? null : v); setShowForm(false); setSelectedServis(null); setEditMode(false) }}
                  style={{ background: '#fff', border: `2px solid ${isSelected ? '#1D9E75' : aktivan ? '#fbbf24' : '#e5e7eb'}`, borderRadius: 10, padding: 12, marginBottom: 8, cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: '#111' }}>{v.agregirani_2}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>{v.lokacija}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                      {aktivan && <span style={{ fontSize: 10, background: '#FAEEDA', color: '#633806', padding: '2px 7px', borderRadius: 20, fontWeight: 700 }}>U servisu</span>}
                      {brServisa > 0 && <span style={{ fontSize: 10, color: '#9ca3af' }}>{brServisa} servisa</span>}
                    </div>
                  </div>
                  {zadnji && (
                    <div style={{ fontSize: 11, color: '#6b7280' }}>
                      {SERVICE_TYPES.find(t => t.key === zadnji.service_type)?.icon} {SERVICE_TYPES.find(t => t.key === zadnji.service_type)?.label} · {zadnji.service_date}
                      {zadnji.cost && <span style={{ color: '#1D9E75', fontWeight: 600, marginLeft: 6 }}>{zadnji.cost}€</span>}
                    </div>
                  )}
                  {v.current_mileage && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>📏 {v.current_mileage.toLocaleString()} km</div>}
                </div>
              )
            })}
          </div>

          {/* Desna strana */}
          {selectedVozilo && (
            <div>
              {/* Vozilo header */}
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 14, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16, color: '#111' }}>{selectedVozilo.agregirani_2}</div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                      {selectedVozilo.lokacija} · {selectedVozilo.fleet_status}
                      {selectedVozilo.current_mileage && ` · 📏 ${selectedVozilo.current_mileage.toLocaleString()} km`}
                    </div>
                  </div>
                  <span style={{ fontSize: 12, color: '#9ca3af' }}>{getVoziloServisi(selectedVozilo.id).length} zapisa</span>
                </div>
              </div>

              {/* Forma za novi servis */}
              {showForm && (
                <div style={{ background: '#fff', border: '1px solid #1D9E75', borderRadius: 10, padding: 20, marginBottom: 16 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#111', marginBottom: 16 }}>Novi servisni zapis</div>

                  <div style={{ marginBottom: 12 }}>
                    <label style={lbl}>Tip servisa *</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                      {SERVICE_TYPES.map(t => (
                        <button key={t.key} onClick={() => setForm((f: any) => ({ ...f, service_type: t.key }))}
                          style={{ padding: '8px 4px', fontSize: 11, border: `1px solid ${form.service_type === t.key ? '#1D9E75' : '#e5e7eb'}`, borderRadius: 8, background: form.service_type === t.key ? '#E1F5EE' : '#fff', color: form.service_type === t.key ? '#085041' : '#6b7280', cursor: 'pointer', fontWeight: form.service_type === t.key ? 600 : 400, textAlign: 'center' as const }}>
                          {t.icon}<br /><span style={{ fontSize: 9 }}>{t.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                    <div>
                      <label style={lbl}>Datum *</label>
                      <input type="date" value={form.service_date} onChange={e => setForm((f: any) => ({ ...f, service_date: e.target.value }))} style={inp} />
                    </div>
                    <div>
                      <label style={lbl}>Kilometraža</label>
                      <input type="number" value={form.mileage_at_service} onChange={e => setForm((f: any) => ({ ...f, mileage_at_service: e.target.value }))} placeholder={selectedVozilo.current_mileage ? String(selectedVozilo.current_mileage) : 'npr. 45000'} style={inp} />
                    </div>
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <label style={lbl}>Status</label>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                        <button key={key} onClick={() => setForm((f: any) => ({ ...f, status: key }))}
                          style={{ flex: 1, padding: '7px 4px', fontSize: 11, border: `1px solid ${form.status === key ? '#1D9E75' : '#e5e7eb'}`, borderRadius: 8, background: form.status === key ? cfg.bg : '#fff', color: form.status === key ? cfg.color : '#9ca3af', cursor: 'pointer', fontWeight: form.status === key ? 600 : 400, minWidth: 80 }}>
                          {cfg.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <label style={lbl}>Opis radova</label>
                    <textarea value={form.description} onChange={e => setForm((f: any) => ({ ...f, description: e.target.value }))}
                      placeholder="Šta je rađeno..." style={{ ...inp, minHeight: 60, resize: 'vertical' as const }} />
                  </div>

                  {/* CHECKLIST */}
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ ...lbl, marginBottom: 8, fontSize: 12, fontWeight: 600, color: '#374151' }}>Checklist provjere vozila</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {CHECKLIST.map(item => (
                        <div key={item.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 10px', border: `1px solid ${form[item.key] === false ? '#fecaca' : '#e5e7eb'}`, borderRadius: 8, background: form[item.key] === false ? '#fff5f5' : '#f9fafb' }}>
                          <span style={{ fontSize: 12, color: '#374151' }}>{item.label}</span>
                          <div style={{ display: 'flex', gap: 5 }}>
                            <button onClick={() => setForm((f: any) => ({ ...f, [item.key]: true }))}
                              style={{ padding: '3px 10px', fontSize: 11, border: `1px solid ${form[item.key] !== false ? '#1D9E75' : '#e5e7eb'}`, borderRadius: 6, background: form[item.key] !== false ? '#E1F5EE' : '#fff', color: form[item.key] !== false ? '#085041' : '#9ca3af', cursor: 'pointer', fontWeight: 600 }}>✓ OK</button>
                            <button onClick={() => setForm((f: any) => ({ ...f, [item.key]: false }))}
                              style={{ padding: '3px 10px', fontSize: 11, border: `1px solid ${form[item.key] === false ? '#dc2626' : '#e5e7eb'}`, borderRadius: 6, background: form[item.key] === false ? '#FCEBEB' : '#fff', color: form[item.key] === false ? '#dc2626' : '#9ca3af', cursor: 'pointer', fontWeight: 600 }}>✗ NE</button>
                          </div>
                        </div>
                      ))}
                    </div>
                    {CHECKLIST.some(c => form[c.key] === false) && (
                      <div style={{ marginTop: 8, background: '#FCEBEB', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#dc2626', fontWeight: 600 }}>
                        ⚠️ Problemi: {CHECKLIST.filter(c => form[c.key] === false).map(c => c.label).join(', ')}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                    <div>
                      <label style={lbl}>Ko je radio</label>
                      <input list="serviseri-list" value={form.performed_by} onChange={e => setForm((f: any) => ({ ...f, performed_by: e.target.value }))} placeholder="Ime servisera..." style={inp} />
                      <datalist id="serviseri-list">{serviseri.filter(s => s.is_active).map(s => <option key={s.id} value={s.full_name} />)}</datalist>
                    </div>
                    <div>
                      <label style={lbl}>Radionica</label>
                      <input value={form.external_shop} onChange={e => setForm((f: any) => ({ ...f, external_shop: e.target.value }))} placeholder="Naziv radionice..." style={inp} />
                    </div>
                    <div>
                      <label style={lbl}>Cijena (€)</label>
                      <input type="number" step="0.01" value={form.cost} onChange={e => setForm((f: any) => ({ ...f, cost: e.target.value }))} placeholder="0.00" style={inp} />
                    </div>
                    <div>
                      <label style={lbl}>Sljedeći servis (km)</label>
                      <input type="number" value={form.next_service_mileage} onChange={e => setForm((f: any) => ({ ...f, next_service_mileage: e.target.value }))} placeholder="npr. 50000" style={inp} />
                    </div>
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <label style={lbl}>Sljedeći servis (datum)</label>
                    <input type="date" value={form.next_service_date} onChange={e => setForm((f: any) => ({ ...f, next_service_date: e.target.value }))} style={inp} />
                  </div>

                  <div style={{ marginBottom: 16 }}>
                    <label style={lbl}>Napomena</label>
                    <textarea value={form.notes} onChange={e => setForm((f: any) => ({ ...f, notes: e.target.value }))} style={{ ...inp, minHeight: 50, resize: 'vertical' as const }} />
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => { setShowForm(false); setForm(emptyForm) }}
                      style={{ flex: 1, padding: 10, border: '1px solid #d1d5db', borderRadius: 8, background: 'transparent', fontSize: 13, cursor: 'pointer', color: '#374151' }}>Odustani</button>
                    <button onClick={saveServis} disabled={saving}
                      style={{ flex: 2, padding: 10, background: saving ? '#5DCAA5' : '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                      {saving ? '⏳ Snimam...' : '💾 Snimi servis'}
                    </button>
                  </div>
                </div>
              )}

              {/* Istorija servisa */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 10 }}>
                  Istorija servisa ({getVoziloServisi(selectedVozilo.id).length})
                </div>
                {getVoziloServisi(selectedVozilo.id).length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af', border: '1px dashed #e5e7eb', borderRadius: 10, fontSize: 13 }}>
                    Nema servisnih zapisa za ovo vozilo.
                  </div>
                ) : getVoziloServisi(selectedVozilo.id).map(s => {
                  const st = STATUS_CONFIG[s.status] || STATUS_CONFIG.pending
                  const tip = SERVICE_TYPES.find(t => t.key === s.service_type)
                  const isSelected = selectedServis?.id === s.id
                  const hasProblems = s.notes?.includes('❌')

                  return (
                    <div key={s.id}
                      onClick={() => { setSelectedServis(isSelected ? null : s); setEditMode(false); setEditForm({ ...s }) }}
                      style={{ background: '#fff', border: `2px solid ${isSelected ? '#1D9E75' : hasProblems ? '#fecaca' : '#e5e7eb'}`, borderRadius: 10, padding: 14, marginBottom: 8, cursor: 'pointer' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span style={{ fontSize: 20 }}>{tip?.icon}</span>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 14, color: '#111' }}>{tip?.label}</div>
                            <div style={{ fontSize: 11, color: '#9ca3af' }}>{s.service_date}</div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          {s.cost && <span style={{ fontSize: 13, fontWeight: 700, color: '#1D9E75' }}>{s.cost}€</span>}
                          <span style={{ fontSize: 11, background: st.bg, color: st.color, padding: '2px 8px', borderRadius: 20, fontWeight: 500 }}>{st.label}</span>
                        </div>
                      </div>
                      {s.description && <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{s.description}</div>}
                      {hasProblems && (
                        <div style={{ fontSize: 11, color: '#dc2626', background: '#fff5f5', borderRadius: 6, padding: '4px 8px', marginBottom: 4 }}>
                          {s.notes?.split(' | ').filter((n: string) => n.includes('❌')).join(' ')}
                        </div>
                      )}
                      <div style={{ fontSize: 11, color: '#9ca3af', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        {s.mileage_at_service && <span>📏 {s.mileage_at_service.toLocaleString()} km</span>}
                        {s.performed_by && <span>👤 {s.performed_by}</span>}
                        {s.external_shop && <span>🔧 {s.external_shop}</span>}
                        {s.next_service_date && <span>📅 Sljedeći: {s.next_service_date}</span>}
                      </div>

                      {isSelected && (
                        <div style={{ marginTop: 12, borderTop: '1px solid #f3f4f6', paddingTop: 12 }}>
                          {!editMode ? (
                            <>
                              {s.notes && !s.notes.includes('❌') && (
                                <div style={{ background: '#f9fafb', borderRadius: 6, padding: '8px 10px', fontSize: 12, color: '#374151', marginBottom: 10 }}>📝 {s.notes}</div>
                              )}
                              <div style={{ display: 'flex', gap: 8 }}>
                                <button onClick={e => { e.stopPropagation(); setEditMode(true) }}
                                  style={{ flex: 1, padding: '7px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', cursor: 'pointer', color: '#374151' }}>✏️ Uredi</button>
                                <button onClick={e => { e.stopPropagation(); deleteServis(s.id) }}
                                  style={{ padding: '7px 12px', fontSize: 12, border: '1px solid #fecaca', borderRadius: 8, background: '#fff', cursor: 'pointer', color: '#dc2626' }}>🗑️</button>
                              </div>
                            </>
                          ) : (
                            <div onClick={e => e.stopPropagation()}>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                                <div>
                                  <label style={lbl}>Tip servisa</label>
                                  <select value={editForm.service_type} onChange={e => setEditForm((f: any) => ({ ...f, service_type: e.target.value }))} style={inp}>
                                    {SERVICE_TYPES.map(t => <option key={t.key} value={t.key}>{t.icon} {t.label}</option>)}
                                  </select>
                                </div>
                                <div>
                                  <label style={lbl}>Status</label>
                                  <select value={editForm.status} onChange={e => setEditForm((f: any) => ({ ...f, status: e.target.value }))} style={inp}>
                                    {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                                  </select>
                                </div>
                                <div>
                                  <label style={lbl}>Datum</label>
                                  <input type="date" value={editForm.service_date || ''} onChange={e => setEditForm((f: any) => ({ ...f, service_date: e.target.value }))} style={inp} />
                                </div>
                                <div>
                                  <label style={lbl}>Kilometraža</label>
                                  <input type="number" value={editForm.mileage_at_service || ''} onChange={e => setEditForm((f: any) => ({ ...f, mileage_at_service: e.target.value }))} style={inp} />
                                </div>
                                <div>
                                  <label style={lbl}>Cijena (€)</label>
                                  <input type="number" value={editForm.cost || ''} onChange={e => setEditForm((f: any) => ({ ...f, cost: e.target.value }))} style={inp} />
                                </div>
                                <div>
                                  <label style={lbl}>Ko je radio</label>
                                  <input list="serviseri-list-edit" value={editForm.performed_by || ''} onChange={e => setEditForm((f: any) => ({ ...f, performed_by: e.target.value }))} style={inp} />
                                  <datalist id="serviseri-list-edit">{serviseri.filter(s => s.is_active).map(s => <option key={s.id} value={s.full_name} />)}</datalist>
                                </div>
                                <div>
                                  <label style={lbl}>Radionica</label>
                                  <input value={editForm.external_shop || ''} onChange={e => setEditForm((f: any) => ({ ...f, external_shop: e.target.value }))} style={inp} />
                                </div>
                                <div>
                                  <label style={lbl}>Sljedeći datum</label>
                                  <input type="date" value={editForm.next_service_date || ''} onChange={e => setEditForm((f: any) => ({ ...f, next_service_date: e.target.value }))} style={inp} />
                                </div>
                              </div>
                              <div style={{ marginBottom: 10 }}>
                                <label style={lbl}>Opis</label>
                                <textarea value={editForm.description || ''} onChange={e => setEditForm((f: any) => ({ ...f, description: e.target.value }))} style={{ ...inp, minHeight: 60, resize: 'vertical' as const }} />
                              </div>
                              <div style={{ marginBottom: 10 }}>
                                <label style={lbl}>Napomena</label>
                                <textarea value={editForm.notes || ''} onChange={e => setEditForm((f: any) => ({ ...f, notes: e.target.value }))} style={{ ...inp, minHeight: 50, resize: 'vertical' as const }} />
                              </div>
                              <div style={{ display: 'flex', gap: 8 }}>
                                <button onClick={() => setEditMode(false)}
                                  style={{ flex: 1, padding: 8, border: '1px solid #d1d5db', borderRadius: 8, background: 'transparent', fontSize: 12, cursor: 'pointer', color: '#374151' }}>Odustani</button>
                                <button onClick={saveEdit}
                                  style={{ flex: 2, padding: 8, background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>💾 Sačuvaj</button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB: SERVISERI ─── */}
      {activeTab === 'serviseri' && (
        <div style={{ display: 'grid', gridTemplateColumns: showServiserForm ? '1fr 380px' : '1fr', gap: 20 }}>
          <div>
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Učitavanje...</div>
            ) : serviseri.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af', border: '1px dashed #e5e7eb', borderRadius: 10 }}>
                Nema servisera. Dodaj prvog servisera.
              </div>
            ) : serviseri.map(s => (
              <div key={s.id} style={{ background: '#fff', border: `1px solid ${s.is_active ? '#e5e7eb' : '#f3f4f6'}`, borderRadius: 10, padding: 16, marginBottom: 10, opacity: s.is_active ? 1 : 0.6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: '#111' }}>{s.full_name}</div>
                      <span style={{ fontSize: 10, background: s.is_active ? '#E1F5EE' : '#f3f4f6', color: s.is_active ? '#085041' : '#6b7280', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>
                        {s.is_active ? 'Aktivan' : 'Neaktivan'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: '#6b7280' }}>
                      {s.phone && <span>📞 {s.phone}</span>}
                      {s.portal_email && <span>✉️ {s.portal_email}</span>}
                    </div>
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: '#374151', marginTop: 6 }}>
                      {s.salary && <span style={{ background: '#f9fafb', borderRadius: 6, padding: '3px 8px' }}>💰 Plata: {s.salary}€</span>}
                      {s.bonus_per_service && <span style={{ background: '#E1F5EE', borderRadius: 6, padding: '3px 8px', color: '#085041' }}>🔧 Bonus servis: {s.bonus_per_service}€</span>}
                      {s.bonus_per_repair && <span style={{ background: '#E6F1FB', borderRadius: 6, padding: '3px 8px', color: '#0C447C' }}>⚠️ Bonus popravka: {s.bonus_per_repair}€</span>}
                    </div>
                    {s.notes && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>📝 {s.notes}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginLeft: 12 }}>
                    <button onClick={() => { setEditServiser(s); setServiserForm({ full_name: s.full_name, phone: s.phone || '', portal_email: s.portal_email || '', is_active: s.is_active, bonus_per_service: s.bonus_per_service || '', bonus_per_repair: s.bonus_per_repair || '', salary: s.salary || '', notes: s.notes || '' }); setShowServiserForm(true) }}
                      style={{ padding: '6px 12px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', cursor: 'pointer', color: '#374151' }}>✏️</button>
                    <button onClick={() => toggleServiserActive(s)}
                      style={{ padding: '6px 12px', fontSize: 12, border: `1px solid ${s.is_active ? '#fbbf24' : '#1D9E75'}`, borderRadius: 8, background: s.is_active ? '#fffbeb' : '#E1F5EE', cursor: 'pointer', color: s.is_active ? '#d97706' : '#085041' }}>
                      {s.is_active ? 'Deaktiviraj' : 'Aktiviraj'}
                    </button>
                    <button onClick={() => deleteServiser(s.id)}
                      style={{ padding: '6px 12px', fontSize: 12, border: '1px solid #fecaca', borderRadius: 8, background: '#fff', cursor: 'pointer', color: '#dc2626' }}>🗑️</button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Forma za servisera */}
          {showServiserForm && (
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 20, alignSelf: 'start' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#111', marginBottom: 16 }}>
                {editServiser ? 'Uredi servisera' : 'Novi serviser'}
              </div>

              <div style={{ marginBottom: 10 }}>
                <label style={lbl}>Ime i prezime *</label>
                <input value={serviserForm.full_name} onChange={e => setServiserForm((f: any) => ({ ...f, full_name: e.target.value }))} placeholder="Npr. Mujo Mujić" style={inp} />
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={lbl}>Telefon</label>
                <input value={serviserForm.phone} onChange={e => setServiserForm((f: any) => ({ ...f, phone: e.target.value }))} placeholder="+382..." style={inp} />
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={lbl}>Email</label>
                <input value={serviserForm.portal_email} onChange={e => setServiserForm((f: any) => ({ ...f, portal_email: e.target.value }))} placeholder="email@example.com" style={inp} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
                <div>
                  <label style={lbl}>Plata (€)</label>
                  <input type="number" value={serviserForm.salary} onChange={e => setServiserForm((f: any) => ({ ...f, salary: e.target.value }))} placeholder="0" style={inp} />
                </div>
                <div>
                  <label style={lbl}>Bonus servis (€)</label>
                  <input type="number" value={serviserForm.bonus_per_service} onChange={e => setServiserForm((f: any) => ({ ...f, bonus_per_service: e.target.value }))} placeholder="0" style={inp} />
                </div>
                <div>
                  <label style={lbl}>Bonus popravka (€)</label>
                  <input type="number" value={serviserForm.bonus_per_repair} onChange={e => setServiserForm((f: any) => ({ ...f, bonus_per_repair: e.target.value }))} placeholder="0" style={inp} />
                </div>
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={lbl}>Napomena</label>
                <textarea value={serviserForm.notes} onChange={e => setServiserForm((f: any) => ({ ...f, notes: e.target.value }))} style={{ ...inp, minHeight: 60, resize: 'vertical' as const }} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                  <input type="checkbox" checked={serviserForm.is_active} onChange={e => setServiserForm((f: any) => ({ ...f, is_active: e.target.checked }))} />
                  Serviser je aktivan
                </label>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { setShowServiserForm(false); setEditServiser(null) }}
                  style={{ flex: 1, padding: 10, border: '1px solid #d1d5db', borderRadius: 8, background: 'transparent', fontSize: 13, cursor: 'pointer', color: '#374151' }}>Odustani</button>
                <button onClick={saveServiser} disabled={serviserSaving}
                  style={{ flex: 2, padding: 10, background: serviserSaving ? '#5DCAA5' : '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  {serviserSaving ? '⏳...' : '💾 Snimi'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
