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

const ACTIVITY_TYPES = [
  { key: 'inspection', label: 'Pregled vozila', icon: '🔍' },
  { key: 'fault', label: 'Prijava kvara', icon: '⚠️' },
  { key: 'service', label: 'Servis', icon: '🔧' },
  { key: 'tyre', label: 'Gume', icon: '🛞' },
  { key: 'other', label: 'Ostalo', icon: '📋' },
]

const FAULT_TYPES = [
  { key: 'transmission', label: 'Mjenjač' },
  { key: 'engine', label: 'Motor' },
  { key: 'brakes', label: 'Kočnice' },
  { key: 'dashboard', label: 'Instrument tabla' },
  { key: 'ignition', label: 'Paljenje' },
  { key: 'lights', label: 'Svjetla' },
  { key: 'wipers', label: 'Brisači' },
  { key: 'cooling', label: 'Hlađenje / Voda' },
  { key: 'windows', label: 'Podizači stakala' },
  { key: 'other', label: 'Ostalo' },
]

const CHECKLIST = [
  { key: 'check_oil', label: 'Ulje' },
  { key: 'check_water', label: 'Voda' },
  { key: 'check_brake_fluid', label: 'Kočiona tečnost' },
  { key: 'check_wipers', label: 'Brisači' },
  { key: 'check_washer', label: 'Prskalice' },
  { key: 'check_windows', label: 'Podizači stakala' },
  { key: 'check_lights', label: 'Svjetla' },
  { key: 'check_interior', label: 'Interijer' },
  { key: 'check_radio', label: 'Radio / Multimedija' },
  { key: 'check_horn', label: 'Sirena' },
]

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  pending:          { label: 'Na čekanju', bg: '#FAEEDA', color: '#633806' },
  in_progress:      { label: 'U toku', bg: '#E6F1FB', color: '#0C447C' },
  our_service:      { label: 'Naš servis', bg: '#E6F1FB', color: '#0C447C' },
  external_service: { label: 'Vanjski servis', bg: '#E6F1FB', color: '#0C447C' },
  testing:          { label: 'Testiranje', bg: '#fef3c7', color: '#d97706' },
  ready:            { label: 'Završeno', bg: '#E1F5EE', color: '#085041' },
  cancelled:        { label: 'Otkazano', bg: '#f3f4f6', color: '#6b7280' },
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  low:    { label: 'Nizak', color: '#9ca3af' },
  normal: { label: 'Normalan', color: '#185FA5' },
  high:   { label: 'Visok', color: '#d97706' },
  urgent: { label: '🔴 HITNO', color: '#dc2626' },
}

export default function ServisPage() {
  const [activities, setActivities] = useState<any[]>([])
  const [vehicles, setVehicles] = useState<any[]>([])
  const [technicians, setTechnicians] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState<any | null>(null)
  const [editMode, setEditMode] = useState(false)

  // Filteri
  const [filterStatus, setFilterStatus] = useState('active')
  const [filterVehicle, setFilterVehicle] = useState('')
  const [filterType, setFilterType] = useState('')

  const agentName = getCookie('avtorent-agent-name')

  const emptyForm = {
    vehicle_id: '', activity_type: 'inspection', title: '',
    description: '', mileage: '', priority: 'normal',
    fault_type: '', is_drivable: true, can_be_rented: true,
    check_oil: true, check_water: true, check_brake_fluid: true,
    check_wipers: true, check_washer: true, check_windows: true,
    check_lights: true, check_interior: true, check_radio: true, check_horn: true,
    performed_by: 'internal', technician_id: '', external_shop: '',
    what_was_done: '', parts_cost: '', labour_cost: '',
    next_service_date: '', next_service_mileage: '',
  }
  const [form, setForm] = useState<any>(emptyForm)
  const [saving, setSaving] = useState(false)

  // Edit form za detalje
  const [editForm, setEditForm] = useState<any>({})
  const [editSaving, setEditSaving] = useState(false)

  // Vehicle search
  const [vehicleSearch, setVehicleSearch] = useState('')
  const [vehicleDropdownOpen, setVehicleDropdownOpen] = useState(false)
  const [selectedVehicle, setSelectedVehicle] = useState<any>(null)

  const filteredVehicleOptions = vehicles.filter(v => {
    if (!vehicleSearch) return true
    const q = vehicleSearch.toLowerCase()
    return (
      v.name?.toLowerCase().includes(q) ||
      v.license_plate?.toLowerCase().includes(q)
    )
  }).slice(0, 8)

  const fetchData = useCallback(async () => {
    const [{ data: act }, { data: v }, { data: t }] = await Promise.all([
      supabase.from('service_activities')
        .select('*, vehicles(name, license_plate), technicians(full_name)')
        .order('reported_at', { ascending: false }),
      supabase.from('vehicles').select('id, name, license_plate').order('name'),
      supabase.from('technicians').select('*').eq('is_active', true),
    ])
    setActivities(act || [])
    setVehicles(v || [])
    setTechnicians(t || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const filtered = activities.filter(a => {
    if (filterStatus === 'active' && ['ready', 'cancelled'].includes(a.status)) return false
    if (filterStatus === 'done' && !['ready', 'cancelled'].includes(a.status)) return false
    if (filterVehicle && a.vehicle_id !== filterVehicle) return false
    if (filterType && a.activity_type !== filterType) return false
    return true
  })

  const activeCount = activities.filter(a => !['ready', 'cancelled'].includes(a.status)).length

  async function handleSubmit() {
    if (!form.vehicle_id || !form.title) return
    setSaving(true)

    const payload: any = {
      vehicle_id: form.vehicle_id,
      reported_by: agentName || 'Agent',
      activity_type: form.activity_type,
      title: form.title,
      description: form.description || null,
      mileage: form.mileage ? parseInt(form.mileage) : null,
      priority: form.priority,
      status: 'pending',
      fault_type: form.activity_type === 'fault' ? form.fault_type : null,
      is_drivable: form.is_drivable,
      can_be_rented: form.can_be_rented,
      performed_by: form.performed_by || null,
      technician_id: form.technician_id || null,
      external_shop: form.external_shop || null,
      what_was_done: form.what_was_done || null,
      parts_cost: form.parts_cost ? parseFloat(form.parts_cost) : null,
      labour_cost: form.labour_cost ? parseFloat(form.labour_cost) : null,
      next_service_date: form.next_service_date || null,
      next_service_mileage: form.next_service_mileage ? parseInt(form.next_service_mileage) : null,
    }

    // Checklist za pregled
    if (form.activity_type === 'inspection') {
      CHECKLIST.forEach(c => { payload[c.key] = form[c.key] })
    }

    // Ako ne može da se izdaje
    if (!form.can_be_rented) {
      await supabase.from('vehicles').update({ fleet_status: 'service', is_available: false }).eq('id', form.vehicle_id)
    }

    await supabase.from('service_activities').insert(payload)
    setSaving(false)
    setShowForm(false)
    setForm(emptyForm)
    setSelectedVehicle(null)
    setVehicleSearch('')
    fetchData()
  }

  async function saveEdit() {
    if (!selected) return
    setEditSaving(true)
    const updates: any = {
      status: editForm.status,
      priority: editForm.priority,
      assigned_to: editForm.assigned_to || null,
      technician_id: editForm.technician_id || null,
      performed_by: editForm.performed_by || null,
      external_shop: editForm.external_shop || null,
      what_was_done: editForm.what_was_done || null,
      parts_cost: editForm.parts_cost ? parseFloat(editForm.parts_cost) : null,
      labour_cost: editForm.labour_cost ? parseFloat(editForm.labour_cost) : null,
      next_service_date: editForm.next_service_date || null,
      next_service_mileage: editForm.next_service_mileage ? parseInt(editForm.next_service_mileage) : null,
    }
    if (editForm.status === 'ready') {
      updates.completed_at = new Date().toISOString()
      updates.completed_by = agentName || 'Agent'
      await supabase.from('vehicles').update({ fleet_status: 'available', is_available: true }).eq('id', selected.vehicle_id)
    } else if (['our_service', 'external_service', 'in_progress'].includes(editForm.status)) {
      await supabase.from('vehicles').update({ fleet_status: 'service', is_available: false }).eq('id', selected.vehicle_id)
    }
    await supabase.from('service_activities').update(updates).eq('id', selected.id)
    setEditSaving(false)
    setEditMode(false)
    setSelected({ ...selected, ...updates })
    fetchData()
  }

  const inp = { width: '100%', padding: '9px 12px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, color: '#111', background: '#fff', boxSizing: 'border-box' as const }
  const lbl = { fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 } as const

  const checklistHasIssue = CHECKLIST.some(c => form[c.key] === false)

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#111' }}>Servisne aktivnosti</h1>
          {activeCount > 0 && <div style={{ fontSize: 13, color: '#d97706', marginTop: 2 }}>{activeCount} aktivnih</div>}
        </div>
        <button onClick={() => { setShowForm(s => !s); setSelected(null); setSelectedVehicle(null); setVehicleSearch('') }}
          style={{ padding: '8px 16px', background: showForm ? '#f3f4f6' : '#1D9E75', color: showForm ? '#374151' : '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          {showForm ? 'Zatvori formu' : '+ Nova aktivnost'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 380px' : showForm ? '1fr 420px' : '1fr', gap: 20 }}>

        {/* Lista */}
        <div>
          {/* Filteri */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {[['active', 'Aktivne'], ['done', 'Završene'], ['all', 'Sve']].map(([val, lbl]) => (
              <button key={val} onClick={() => setFilterStatus(val)}
                style={{ padding: '6px 14px', fontSize: 12, border: `1px solid ${filterStatus === val ? '#1D9E75' : '#e5e7eb'}`, borderRadius: 20, background: filterStatus === val ? '#E1F5EE' : '#fff', color: filterStatus === val ? '#085041' : '#6b7280', cursor: 'pointer', fontWeight: filterStatus === val ? 600 : 400 }}>
                {lbl}
              </button>
            ))}
            <select value={filterVehicle} onChange={e => setFilterVehicle(e.target.value)}
              style={{ padding: '6px 12px', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 20, background: '#fff', color: filterVehicle ? '#111' : '#9ca3af', cursor: 'pointer' }}>
              <option value="">Sva vozila</option>
              {vehicles.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
            <select value={filterType} onChange={e => setFilterType(e.target.value)}
              style={{ padding: '6px 12px', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 20, background: '#fff', color: filterType ? '#111' : '#9ca3af', cursor: 'pointer' }}>
              <option value="">Svi tipovi</option>
              {ACTIVITY_TYPES.map(t => <option key={t.key} value={t.key}>{t.icon} {t.label}</option>)}
            </select>
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Učitavanje...</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af', background: '#fff', borderRadius: 12, border: '1px dashed #e5e7eb' }}>
              Nema aktivnosti
            </div>
          ) : filtered.map(a => {
            const st = STATUS_CONFIG[a.status] || STATUS_CONFIG.pending
            const pr = PRIORITY_CONFIG[a.priority] || PRIORITY_CONFIG.normal
            const at = ACTIVITY_TYPES.find(t => t.key === a.activity_type)
            const isSelected = selected?.id === a.id
            return (
              <div key={a.id} onClick={() => { setSelected(isSelected ? null : a); setEditMode(false); setEditForm({ status: a.status, priority: a.priority, assigned_to: a.assigned_to || '', technician_id: a.technician_id || '', performed_by: a.performed_by || 'internal', external_shop: a.external_shop || '', what_was_done: a.what_was_done || '', parts_cost: a.parts_cost || '', labour_cost: a.labour_cost || '', next_service_date: a.next_service_date || '', next_service_mileage: a.next_service_mileage || '' }); setShowForm(false) }}
                style={{ background: '#fff', border: `2px solid ${isSelected ? '#1D9E75' : a.priority === 'urgent' ? '#fecaca' : '#e5e7eb'}`, borderRadius: 10, padding: '14px 16px', marginBottom: 10, cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 18 }}>{at?.icon}</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: '#111' }}>{a.title}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>
                        {a.vehicles?.name} {a.vehicles?.license_plate && `· ${a.vehicles.license_plate}`}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <span style={{ fontSize: 11, background: st.bg, color: st.color, padding: '2px 8px', borderRadius: 20, fontWeight: 500 }}>{st.label}</span>
                    {a.priority !== 'normal' && <span style={{ fontSize: 11, color: pr.color, fontWeight: 600 }}>{pr.label}</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9ca3af' }}>
                  <span>{a.reported_by} · {new Date(a.reported_at).toLocaleDateString('sr-RS')}</span>
                  <span style={{ display: 'flex', gap: 10 }}>
                    {!a.can_be_rented && <span style={{ color: '#dc2626', fontWeight: 500 }}>Ne izdaje se</span>}
                    {a.total_cost > 0 && <span style={{ color: '#1D9E75', fontWeight: 600 }}>{a.total_cost}€</span>}
                    {a.technicians?.full_name && <span>{a.technicians.full_name}</span>}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Nova aktivnost - forma */}
        {showForm && !selected && (
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, alignSelf: 'start' }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#111', marginBottom: 16 }}>Nova servisna aktivnost</div>

            <div style={{ marginBottom: 12, position: 'relative' }}>
              <label style={lbl}>Vozilo *</label>
              {selectedVehicle ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', border: '1px solid #1D9E75', borderRadius: 8, background: '#E1F5EE' }}>
                  <span style={{ fontSize: 16 }}>🚗</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#085041', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedVehicle.name}</div>
                    {selectedVehicle.license_plate && <div style={{ fontSize: 11, color: '#1D9E75' }}>{selectedVehicle.license_plate}</div>}
                  </div>
                  <button onClick={() => { setSelectedVehicle(null); setForm((f: any) => ({ ...f, vehicle_id: '' })); setVehicleSearch('') }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: 16, lineHeight: 1, padding: '0 2px', flexShrink: 0 }}>✕</button>
                </div>
              ) : (
                <div style={{ position: 'relative' }}>
                  <input
                    value={vehicleSearch}
                    onChange={e => { setVehicleSearch(e.target.value); setVehicleDropdownOpen(true) }}
                    onFocus={() => setVehicleDropdownOpen(true)}
                    onBlur={() => setTimeout(() => setVehicleDropdownOpen(false), 150)}
                    placeholder="Pretraži po nazivu ili tablicama..."
                    style={{ ...inp, paddingLeft: 36 }}
                    autoComplete="off"
                  />
                  <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', fontSize: 14, pointerEvents: 'none', color: '#9ca3af' }}>🔍</span>
                  {vehicleDropdownOpen && filteredVehicleOptions.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: '#fff', border: '1px solid #d1d5db', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', marginTop: 4, maxHeight: 220, overflowY: 'auto' }}>
                      {filteredVehicleOptions.map(v => (
                        <div key={v.id}
                          onMouseDown={() => {
                            setSelectedVehicle(v)
                            setForm((f: any) => ({ ...f, vehicle_id: v.id }))
                            setVehicleSearch('')
                            setVehicleDropdownOpen(false)
                          }}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
                          onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                        >
                          <span style={{ fontSize: 15 }}>🚗</span>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 500, color: '#111' }}>{v.name}</div>
                            {v.license_plate && <div style={{ fontSize: 11, color: '#9ca3af' }}>{v.license_plate}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {vehicleDropdownOpen && vehicleSearch.length > 0 && filteredVehicleOptions.length === 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: '#fff', border: '1px solid #d1d5db', borderRadius: 8, padding: '12px', textAlign: 'center', fontSize: 12, color: '#9ca3af', marginTop: 4, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                      Nema pronađenih vozila
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Tip aktivnosti *</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                {ACTIVITY_TYPES.map(t => (
                  <button key={t.key} onClick={() => setForm((f: any) => ({ ...f, activity_type: t.key }))}
                    style={{ padding: '8px 4px', fontSize: 11, border: `1px solid ${form.activity_type === t.key ? '#1D9E75' : '#e5e7eb'}`, borderRadius: 8, background: form.activity_type === t.key ? '#E1F5EE' : '#fff', color: form.activity_type === t.key ? '#085041' : '#6b7280', cursor: 'pointer', fontWeight: form.activity_type === t.key ? 600 : 400, textAlign: 'center' as const }}>
                    {t.icon}<br/><span style={{ fontSize: 10 }}>{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Naslov *</label>
              <input value={form.title} onChange={e => setForm((f: any) => ({ ...f, title: e.target.value }))}
                placeholder={form.activity_type === 'fault' ? 'npr. Kvar na kočnicama' : form.activity_type === 'inspection' ? 'npr. Redovna provjera - april' : 'npr. Mali servis'}
                style={inp} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div>
                <label style={lbl}>Prioritet</label>
                <select value={form.priority} onChange={e => setForm((f: any) => ({ ...f, priority: e.target.value }))} style={inp}>
                  <option value="low">Nizak</option>
                  <option value="normal">Normalan</option>
                  <option value="high">Visok</option>
                  <option value="urgent">HITNO</option>
                </select>
              </div>
              <div>
                <label style={lbl}>Kilometraža</label>
                <input type="number" value={form.mileage} onChange={e => setForm((f: any) => ({ ...f, mileage: e.target.value }))} placeholder="npr. 45000" style={inp} />
              </div>
            </div>

            {/* Fault type */}
            {form.activity_type === 'fault' && (
              <div style={{ marginBottom: 12 }}>
                <label style={lbl}>Tip kvara</label>
                <select value={form.fault_type} onChange={e => setForm((f: any) => ({ ...f, fault_type: e.target.value }))} style={inp}>
                  <option value="">-- Odaberi --</option>
                  {FAULT_TYPES.map(ft => <option key={ft.key} value={ft.key}>{ft.label}</option>)}
                </select>
              </div>
            )}

            {/* Checklist za pregled */}
            {form.activity_type === 'inspection' && (
              <div style={{ marginBottom: 12 }}>
                <label style={lbl}>Checklist provjere</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {CHECKLIST.map(item => (
                    <div key={item.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 10px', border: `1px solid ${form[item.key] === false ? '#fecaca' : '#e5e7eb'}`, borderRadius: 8, background: form[item.key] === false ? '#fff5f5' : '#fff' }}>
                      <span style={{ fontSize: 12, color: '#374151' }}>{item.label}</span>
                      <div style={{ display: 'flex', gap: 5 }}>
                        <button onClick={() => setForm((f: any) => ({ ...f, [item.key]: true }))}
                          style={{ padding: '3px 9px', fontSize: 11, border: `1px solid ${form[item.key] === true ? '#1D9E75' : '#e5e7eb'}`, borderRadius: 6, background: form[item.key] === true ? '#E1F5EE' : '#fff', color: form[item.key] === true ? '#085041' : '#9ca3af', cursor: 'pointer' }}>OK</button>
                        <button onClick={() => setForm((f: any) => ({ ...f, [item.key]: false }))}
                          style={{ padding: '3px 9px', fontSize: 11, border: `1px solid ${form[item.key] === false ? '#dc2626' : '#e5e7eb'}`, borderRadius: 6, background: form[item.key] === false ? '#FCEBEB' : '#fff', color: form[item.key] === false ? '#dc2626' : '#9ca3af', cursor: 'pointer' }}>✗</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Opis / napomena</label>
              <textarea value={form.description} onChange={e => setForm((f: any) => ({ ...f, description: e.target.value }))}
                placeholder="Detaljan opis..." style={{ ...inp, minHeight: 60, resize: 'vertical' as const }} />
            </div>

            {/* Status vozila */}
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Status vozila</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.is_drivable} onChange={e => setForm((f: any) => ({ ...f, is_drivable: e.target.checked }))} />
                  Vozilo je u voznom stanju
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.can_be_rented} onChange={e => setForm((f: any) => ({ ...f, can_be_rented: e.target.checked }))} />
                  Vozilo se može izdavati
                </label>
              </div>
              {!form.can_be_rented && (
                <div style={{ marginTop: 6, fontSize: 11, color: '#dc2626', background: '#fff5f5', borderRadius: 6, padding: '6px 10px' }}>
                  ⚠ Vozilo će biti postavljeno kao nedostupno
                </div>
              )}
            </div>

            <button onClick={handleSubmit} disabled={saving || !form.vehicle_id || !form.title}
              style={{ width: '100%', padding: '11px', background: !form.vehicle_id || !form.title ? '#9ca3af' : '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              {saving ? 'Snimanje...' : 'Kreiraj aktivnost'}
            </button>
          </div>
        )}

        {/* Detail panel */}
        {selected && (
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, alignSelf: 'start' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>
                  {ACTIVITY_TYPES.find(t => t.key === selected.activity_type)?.icon} {ACTIVITY_TYPES.find(t => t.key === selected.activity_type)?.label}
                </div>
                <div style={{ fontWeight: 700, fontSize: 16, color: '#111' }}>{selected.title}</div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{selected.vehicles?.name}</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {!editMode && (
                  <button onClick={() => setEditMode(true)}
                    style={{ padding: '5px 12px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', cursor: 'pointer', color: '#374151' }}>
                    Uredi
                  </button>
                )}
                <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9ca3af' }}>✕</button>
              </div>
            </div>

            {!editMode ? (
              <div>
                {/* Info */}
                {[
                  ['Prijavio', `${selected.reported_by} · ${new Date(selected.reported_at).toLocaleDateString('sr-RS')}`],
                  ['Status', STATUS_CONFIG[selected.status]?.label],
                  ['Prioritet', PRIORITY_CONFIG[selected.priority]?.label],
                  ['Kilometraža', selected.mileage ? `${selected.mileage.toLocaleString()} km` : null],
                  ['Opis', selected.description],
                  ['Tip kvara', selected.fault_type ? FAULT_TYPES.find(f => f.key === selected.fault_type)?.label : null],
                  ['Ko servisira', selected.performed_by === 'internal' ? 'Interni serviser' : selected.performed_by === 'external' ? 'Vanjska radionica' : null],
                  ['Serviser', selected.technicians?.full_name],
                  ['Radionica', selected.external_shop],
                  ['Šta je urađeno', selected.what_was_done],
                  ['Dijelovi', selected.parts_cost ? `${selected.parts_cost}€` : null],
                  ['Rad', selected.labour_cost ? `${selected.labour_cost}€` : null],
                  ['Ukupno', selected.total_cost > 0 ? `${selected.total_cost}€` : null],
                  ['Sljedeći servis', selected.next_service_date],
                ].filter(([, v]) => v).map(([l, v]) => (
                  <div key={l as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f3f4f6', fontSize: 13 }}>
                    <span style={{ color: '#9ca3af' }}>{l}</span>
                    <span style={{ color: l === 'Ukupno' ? '#1D9E75' : '#111', fontWeight: l === 'Ukupno' ? 600 : 400, textAlign: 'right', maxWidth: 200 }}>{v}</span>
                  </div>
                ))}

                {/* Checklist rezultat */}
                {selected.activity_type === 'inspection' && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Checklist</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                      {CHECKLIST.map(c => (
                        <div key={c.key} style={{ fontSize: 11, display: 'flex', gap: 6, alignItems: 'center' }}>
                          <span style={{ color: selected[c.key] === false ? '#dc2626' : '#1D9E75' }}>
                            {selected[c.key] === false ? '✗' : '✓'}
                          </span>
                          <span style={{ color: selected[c.key] === false ? '#dc2626' : '#6b7280' }}>{c.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selected.completed_at && (
                  <div style={{ marginTop: 12, background: '#E1F5EE', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#085041' }}>
                    ✓ Završeno: {new Date(selected.completed_at).toLocaleDateString('sr-RS')} · {selected.completed_by}
                  </div>
                )}
              </div>
            ) : (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                  <div>
                    <label style={lbl}>Status</label>
                    <select value={editForm.status} onChange={e => setEditForm((f: any) => ({ ...f, status: e.target.value }))} style={inp}>
                      <option value="pending">Na čekanju</option>
                      <option value="in_progress">U toku</option>
                      <option value="our_service">Naš servis</option>
                      <option value="external_service">Vanjski servis</option>
                      <option value="testing">Testiranje</option>
                      <option value="ready">Završeno</option>
                      <option value="cancelled">Otkazano</option>
                    </select>
                  </div>
                  <div>
                    <label style={lbl}>Prioritet</label>
                    <select value={editForm.priority} onChange={e => setEditForm((f: any) => ({ ...f, priority: e.target.value }))} style={inp}>
                      <option value="low">Nizak</option>
                      <option value="normal">Normalan</option>
                      <option value="high">Visok</option>
                      <option value="urgent">HITNO</option>
                    </select>
                  </div>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={lbl}>Ko servisira</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[['internal', 'Interni'], ['external', 'Vanjski']].map(([val, lbl2]) => (
                      <button key={val} onClick={() => setEditForm((f: any) => ({ ...f, performed_by: val }))}
                        style={{ flex: 1, padding: '8px', fontSize: 12, border: `1px solid ${editForm.performed_by === val ? '#1D9E75' : '#e5e7eb'}`, borderRadius: 8, background: editForm.performed_by === val ? '#E1F5EE' : '#fff', color: editForm.performed_by === val ? '#085041' : '#6b7280', cursor: 'pointer' }}>
                        {lbl2}
                      </button>
                    ))}
                  </div>
                </div>

                {editForm.performed_by === 'internal' ? (
                  <div style={{ marginBottom: 12 }}>
                    <label style={lbl}>Serviser</label>
                    <select value={editForm.technician_id} onChange={e => setEditForm((f: any) => ({ ...f, technician_id: e.target.value }))} style={inp}>
                      <option value="">-- Odaberi --</option>
                      {technicians.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                    </select>
                  </div>
                ) : (
                  <div style={{ marginBottom: 12 }}>
                    <label style={lbl}>Radionica</label>
                    <input value={editForm.external_shop} onChange={e => setEditForm((f: any) => ({ ...f, external_shop: e.target.value }))} placeholder="Naziv radionice..." style={inp} />
                  </div>
                )}

                <div style={{ marginBottom: 12 }}>
                  <label style={lbl}>Šta je urađeno</label>
                  <textarea value={editForm.what_was_done} onChange={e => setEditForm((f: any) => ({ ...f, what_was_done: e.target.value }))}
                    placeholder="Opis radova..." style={{ ...inp, minHeight: 70, resize: 'vertical' as const }} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                  <div>
                    <label style={lbl}>Dijelovi (€)</label>
                    <input type="number" step="0.01" value={editForm.parts_cost} onChange={e => setEditForm((f: any) => ({ ...f, parts_cost: e.target.value }))} placeholder="0.00" style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>Rad (€)</label>
                    <input type="number" step="0.01" value={editForm.labour_cost} onChange={e => setEditForm((f: any) => ({ ...f, labour_cost: e.target.value }))} placeholder="0.00" style={inp} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                  <div>
                    <label style={lbl}>Sljedeći servis (datum)</label>
                    <input type="date" value={editForm.next_service_date} onChange={e => setEditForm((f: any) => ({ ...f, next_service_date: e.target.value }))} style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>Sljedeći servis (km)</label>
                    <input type="number" value={editForm.next_service_mileage} onChange={e => setEditForm((f: any) => ({ ...f, next_service_mileage: e.target.value }))} placeholder="50000" style={inp} />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={saveEdit} disabled={editSaving}
                    style={{ flex: 2, padding: '10px', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                    {editSaving ? '...' : 'Sačuvaj'}
                  </button>
                  <button onClick={() => setEditMode(false)}
                    style={{ flex: 1, padding: '10px', border: '1px solid #d1d5db', borderRadius: 8, background: 'transparent', fontSize: 13, cursor: 'pointer', color: '#374151' }}>
                    Odustani
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
