'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Vehicle = {
  id: string; name: string; category: string; is_available: boolean
  vin: string | null; license_plate: string | null; year: number | null
  make: string | null; model: string | null; color: string | null
  fuel_type: string | null; transmission: string | null; seats: number | null
  engine_cc: number | null; purchase_date: string | null; purchase_price: number | null
  purchase_from: string | null; current_mileage: number | null
  fleet_status: string | null; fleet_notes: string | null; image_url: string | null
}

const FLEET_STATUS: Record<string, { label: string; bg: string; color: string }> = {
  available:  { label: 'Dostupno', bg: '#E1F5EE', color: '#085041' },
  rented:     { label: 'Iznajmljeno', bg: '#E6F1FB', color: '#0C447C' },
  service:    { label: 'U servisu', bg: '#FAEEDA', color: '#633806' },
  damaged:    { label: 'Oštećeno', bg: '#FCEBEB', color: '#791F1F' },
  inactive:   { label: 'Neaktivno', bg: '#f3f4f6', color: '#374151' },
}

const FUEL_LABELS: Record<string, string> = {
  petrol: 'Benzin', diesel: 'Dizel', hybrid: 'Hibrid', electric: 'Električno', lpg: 'LPG'
}

function getCookie(name: string): string {
  if (typeof document === 'undefined') return ''
  const match = document.cookie.match(new RegExp(`${name}=([^;]+)`))
  return match ? decodeURIComponent(match[1]) : ''
}

export default function FlotaPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Vehicle | null>(null)
  const [activeTab, setActiveTab] = useState<'info' | 'plates' | 'registration' | 'insurance' | 'inspection' | 'tyres' | 'docs' | 'service'>('info')
  const [showEditModal, setShowEditModal] = useState(false)
  const [editForm, setEditForm] = useState<Partial<Vehicle>>({})
  const [editSaving, setEditSaving] = useState(false)

  // Sub-records
  const [plates, setPlates] = useState<any[]>([])
  const [showAddPlate, setShowAddPlate] = useState(false)
  const [registrations, setRegistrations] = useState<any[]>([])
  const [inspections, setInspections] = useState<any[]>([])
  const [insurance, setInsurance] = useState<any[]>([])
  const [tyres, setTyres] = useState<any[]>([])
  const [docs, setDocs] = useState<any[]>([])

  // Service
  const [services, setServices] = useState<any[]>([])
  const [showAddService, setShowAddService] = useState(false)
  const [technicians, setTechnicians] = useState<any[]>([])

  // Add modals
  const [showAddReg, setShowAddReg] = useState(false)
  const [showAddInsp, setShowAddInsp] = useState(false)
  const [showAddIns, setShowAddIns] = useState(false)
  const [showAddTyre, setShowAddTyre] = useState(false)
  const [addForm, setAddForm] = useState<any>({})
  const [addSaving, setAddSaving] = useState(false)

  // Filteri
  const [filterStatus, setFilterStatus] = useState('')
  const [filterSearch, setFilterSearch] = useState('')
  const [filterFuel, setFilterFuel] = useState('')
  const [filterCategory, setFilterCategory] = useState('')

  // Servisne aktivnosti za metrike
  const [serviceActivities, setServiceActivities] = useState<any[]>([])

  useEffect(() => {
    fetchVehicles()
    supabase.from('technicians').select('*').eq('is_active', true).then(({ data }) => setTechnicians(data || []))
    supabase.from('service_activities')
      .select('vehicle_id, status, reported_at, completed_at, can_be_rented')
      .then(({ data }) => setServiceActivities(data || []))
  }, [])

  async function fetchVehicles() {
    const { data } = await supabase.from('vehicles').select('*').order('name')
    setVehicles(data || [])
    setLoading(false)
  }

  async function fetchVehicleDetails(vehicleId: string) {
    const [{ data: pl }, { data: reg }, { data: insp }, { data: ins }, { data: tyr }, { data: doc }, { data: svc }] = await Promise.all([
      supabase.from('vehicle_plates').select('*').eq('vehicle_id', vehicleId).order('valid_from', { ascending: false }),
      supabase.from('vehicle_registrations').select('*').eq('vehicle_id', vehicleId).order('registered_until', { ascending: false }),
      supabase.from('vehicle_technical_inspections').select('*').eq('vehicle_id', vehicleId).order('valid_until', { ascending: false }),
      supabase.from('vehicle_insurance').select('*').eq('vehicle_id', vehicleId).order('valid_until', { ascending: false }),
      supabase.from('vehicle_tyres').select('*').eq('vehicle_id', vehicleId).order('installed_date', { ascending: false }),
      supabase.from('vehicle_documents').select('*').eq('vehicle_id', vehicleId).order('created_at', { ascending: false }),
      supabase.from('vehicle_services').select('*, technicians(full_name)').eq('vehicle_id', vehicleId).order('service_date', { ascending: false }),
    ])
    setPlates(pl || [])
    setRegistrations(reg || [])
    setInspections(insp || [])
    setInsurance(ins || [])
    setTyres(tyr || [])
    setDocs(doc || [])
    setServices(svc || [])
  }

  function selectVehicle(v: Vehicle) {
    setSelected(v)
    setActiveTab('info')
    fetchVehicleDetails(v.id)
  }

  async function saveEdit() {
    if (!selected) return
    setEditSaving(true)
    await supabase.from('vehicles').update(editForm).eq('id', selected.id)
    setEditSaving(false)
    setShowEditModal(false)
    fetchVehicles()
    setSelected({ ...selected, ...editForm } as Vehicle)
  }

  async function savePlate() {
    if (!selected || !addForm.plate_number) return
    setAddSaving(true)

    // Zatvori trenutne aktivne tablice
    await supabase.from('vehicle_plates')
      .update({ valid_until: addForm.valid_from || today })
      .eq('vehicle_id', selected.id)
      .is('valid_until', null)

    // Dodaj nove tablice
    await supabase.from('vehicle_plates').insert({
      vehicle_id: selected.id,
      plate_number: addForm.plate_number,
      valid_from: addForm.valid_from || today,
      notes: addForm.notes || null,
    })

    // Ažuriraj current_plate na vozilu
    await supabase.from('vehicles').update({
      license_plate: addForm.plate_number,
      current_plate: addForm.plate_number,
    }).eq('id', selected.id)

    setAddSaving(false)
    setShowAddPlate(false)
    setAddForm({})
    fetchVehicleDetails(selected.id)
    fetchVehicles()
  }

  async function saveRecord(table: string, data: any) {
    if (!selected) return
    setAddSaving(true)
    await supabase.from(table).insert({ ...data, vehicle_id: selected.id })
    setAddSaving(false)
    setAddForm({})
    setShowAddReg(false); setShowAddInsp(false); setShowAddIns(false); setShowAddTyre(false)
    fetchVehicleDetails(selected.id)
  }

  const today = new Date().toISOString().split('T')[0]

  // Alert checks
  function getDaysUntil(dateStr: string | null) {
    if (!dateStr) return null
    return Math.ceil((new Date(dateStr).getTime() - new Date().getTime()) / 86400000)
  }

  function getVehicleAlerts(v: Vehicle) {
    const alerts: string[] = []
    if (v.fleet_status === 'damaged') alerts.push('Oštećeno')
    if (v.fleet_status === 'service') alerts.push('U servisu')
    return alerts
  }

  const inp = (extra?: any) => ({ padding: '8px 12px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, color: '#111', width: '100%', boxSizing: 'border-box' as const, ...extra })

  const tabStyle = (tab: string) => ({
    padding: '7px 14px', fontSize: 12, border: 'none',
    background: activeTab === tab ? '#1D9E75' : '#f3f4f6',
    color: activeTab === tab ? '#fff' : '#6b7280',
    cursor: 'pointer', borderRadius: 6, fontWeight: activeTab === tab ? 600 : 400,
  })

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: '#111' }}>Flota vozila</h1>
        <div style={{ fontSize: 13, color: '#6b7280' }}>{vehicles.length} vozila</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '320px 1fr' : '1fr', gap: 20 }}>
        {/* Metrike */}
        {(() => {
          const total = vehicles.length
          const active = vehicles.filter(v => v.fleet_status === 'available' || v.fleet_status === 'rented').length
          const inactive = vehicles.filter(v => v.fleet_status === 'service' || v.fleet_status === 'damaged' || v.fleet_status === 'inactive').length

          // Prosjecno vrijeme neaktivnosti (od prijave do zatvaranja)
          const closedActivities = serviceActivities.filter(a => a.completed_at && a.reported_at && !a.can_be_rented)
          const avgHours = closedActivities.length > 0
            ? closedActivities.reduce((sum, a) => {
                const diff = new Date(a.completed_at).getTime() - new Date(a.reported_at).getTime()
                return sum + diff / 3600000
              }, 0) / closedActivities.length
            : 0
          const avgDays = (avgHours / 24).toFixed(1)

          // Top 10 najduže neaktivnih
          const unavailableVehicles = vehicles
            .filter(v => v.fleet_status === 'service' || v.fleet_status === 'damaged')
            .map(v => {
              const openActivity = serviceActivities
                .filter(a => a.vehicle_id === v.id && !a.can_be_rented && a.status !== 'ready' && a.status !== 'cancelled')
                .sort((a, b) => new Date(a.reported_at).getTime() - new Date(b.reported_at).getTime())[0]
              const days = openActivity
                ? Math.floor((Date.now() - new Date(openActivity.reported_at).getTime()) / 86400000)
                : null
              return { ...v, daysUnavailable: days }
            })
            .sort((a, b) => (b.daysUnavailable || 0) - (a.daysUnavailable || 0))
            .slice(0, 10)

          return (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
                {[
                  { label: 'Aktivna vozila', value: `${active}/${total}`, color: '#1D9E75', bg: '#E1F5EE' },
                  { label: 'Neaktivna vozila', value: `${inactive}/${total}`, color: inactive > 0 ? '#dc2626' : '#9ca3af', bg: inactive > 0 ? '#fff5f5' : '#f9fafb' },
                  { label: 'Prosj. neaktivnost', value: closedActivities.length > 0 ? `${avgDays} dana` : '—', color: '#BA7517', bg: '#FAEEDA' },
                  { label: 'U servisu/oštećeno', value: String(vehicles.filter(v => v.fleet_status === 'service' || v.fleet_status === 'damaged').length), color: '#185FA5', bg: '#E6F1FB' },
                ].map(m => (
                  <div key={m.label} style={{ background: m.bg, borderRadius: 10, padding: '12px 14px' }}>
                    <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>{m.label}</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: m.color }}>{m.value}</div>
                  </div>
                ))}
              </div>

              {unavailableVehicles.length > 0 && (
                <div style={{ background: '#fff', border: '1px solid #fecaca', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#791F1F', marginBottom: 10 }}>
                    ⚠ Vozila izvan upotrebe — Top {unavailableVehicles.length}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {unavailableVehicles.map((v, i) => {
                      const st = FLEET_STATUS[v.fleet_status || 'available'] || FLEET_STATUS.available
                      return (
                        <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: i < unavailableVehicles.length - 1 ? '1px solid #f9fafb' : 'none' }}>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <span style={{ fontSize: 12, color: '#9ca3af', width: 20 }}>#{i + 1}</span>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 500, color: '#111' }}>{v.name}</div>
                              {v.license_plate && <div style={{ fontSize: 11, color: '#9ca3af' }}>{v.license_plate}</div>}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <span style={{ fontSize: 11, background: st.bg, color: st.color, padding: '2px 8px', borderRadius: 20 }}>{st.label}</span>
                            {v.daysUnavailable !== null && (
                              <span style={{ fontSize: 12, fontWeight: 700, color: v.daysUnavailable > 7 ? '#dc2626' : '#d97706' }}>
                                {v.daysUnavailable}d
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Filteri */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                <input value={filterSearch} onChange={e => setFilterSearch(e.target.value)} placeholder="Pretraži vozilo..."
                  style={{ padding: '7px 12px', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 20, color: '#111', background: '#fff', width: 160 }} />
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                  style={{ padding: '7px 12px', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 20, color: filterStatus ? '#111' : '#9ca3af', background: '#fff' }}>
                  <option value="">Svi statusi</option>
                  {Object.entries(FLEET_STATUS).map(([key, val]) => <option key={key} value={key}>{val.label}</option>)}
                </select>
                <select value={filterFuel} onChange={e => setFilterFuel(e.target.value)}
                  style={{ padding: '7px 12px', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 20, color: filterFuel ? '#111' : '#9ca3af', background: '#fff' }}>
                  <option value="">Sva goriva</option>
                  <option value="petrol">Benzin</option>
                  <option value="diesel">Dizel</option>
                  <option value="hybrid">Hibrid</option>
                  <option value="electric">Električno</option>
                  <option value="lpg">LPG</option>
                </select>
                <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
                  style={{ padding: '7px 12px', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 20, color: filterCategory ? '#111' : '#9ca3af', background: '#fff' }}>
                  <option value="">Sve kategorije</option>
                  <option value="economy">Ekonomična</option>
                  <option value="suv">SUV</option>
                  <option value="premium">Premium</option>
                  <option value="minivan">Kombi</option>
                  <option value="convertible">Kabriolet</option>
                </select>
                {(filterStatus || filterSearch || filterFuel || filterCategory) && (
                  <button onClick={() => { setFilterStatus(''); setFilterSearch(''); setFilterFuel(''); setFilterCategory('') }}
                    style={{ padding: '7px 12px', fontSize: 12, border: '1px solid #fecaca', borderRadius: 20, color: '#dc2626', background: 'transparent', cursor: 'pointer' }}>
                    Poništi filtere
                  </button>
                )}
              </div>
            </>
          )
        })()}

        {/* Lista vozila */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {loading ? <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>Učitavanje...</div> : vehicles.map(v => {
            const st = FLEET_STATUS[v.fleet_status || 'available'] || FLEET_STATUS.available
            const alerts = getVehicleAlerts(v)
            return (
              <div key={v.id} onClick={() => selectVehicle(v)}
                style={{ background: '#fff', border: `2px solid ${selected?.id === v.id ? '#1D9E75' : '#e5e7eb'}`, borderRadius: 10, padding: '12px 14px', cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: '#111' }}>{v.name}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                      {v.license_plate && <span style={{ fontFamily: 'monospace', marginRight: 8 }}>{v.license_plate}</span>}
                      {v.year && <span>{v.year}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <span style={{ fontSize: 11, background: st.bg, color: st.color, padding: '2px 8px', borderRadius: 20, fontWeight: 500 }}>{st.label}</span>
                    {alerts.map(a => (
                      <span key={a} style={{ fontSize: 10, background: '#FCEBEB', color: '#791F1F', padding: '1px 6px', borderRadius: 20 }}>⚠ {a}</span>
                    ))}
                  </div>
                </div>
                {v.current_mileage && (
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 6 }}>
                    {v.current_mileage.toLocaleString()} km
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Detail panel */}
        {selected && (
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#111' }}>{selected.name}</div>
                <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>
                  {selected.make} {selected.model} {selected.year && `(${selected.year})`}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { setEditForm({ ...selected }); setShowEditModal(true) }}
                  style={{ padding: '6px 14px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', cursor: 'pointer', color: '#374151' }}>
                  Uredi
                </button>
                <button onClick={() => setSelected(null)}
                  style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#9ca3af' }}>✕</button>
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
              {[
                ['info', 'Osnovni podaci'],
                ['plates', 'Tablice'],
                ['registration', 'Registracija'],
                ['inspection', 'Tehnički pregled'],
                ['insurance', 'Osiguranje'],
                ['tyres', 'Gume'],
                ['docs', 'Dokumenti'],
                ['service', 'Servisiranje'],
              ].map(([tab, label]) => (
                <button key={tab} onClick={() => setActiveTab(tab as any)} style={tabStyle(tab)}>{label}</button>
              ))}
            </div>

            {/* INFO TAB */}
            {activeTab === 'info' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {[
                  ['VIN', selected.vin],
                  ['Tablice', selected.license_plate],
                  ['Godište', selected.year],
                  ['Boja', selected.color],
                  ['Gorivo', selected.fuel_type ? FUEL_LABELS[selected.fuel_type] : null],
                  ['Mjenjač', selected.transmission === 'automatic' ? 'Automatik' : 'Ručni'],
                  ['Sjedišta', selected.seats],
                  ['Kubikaza', selected.engine_cc ? `${selected.engine_cc} cc` : null],
                  ['Kilometraža', selected.current_mileage ? `${selected.current_mileage.toLocaleString()} km` : null],
                  ['Datum nabavke', selected.purchase_date],
                  ['Cijena nabavke', selected.purchase_price ? `${selected.purchase_price}€` : null],
                  ['Nabavljeno od', selected.purchase_from],
                  ['Status flote', selected.fleet_status ? FLEET_STATUS[selected.fleet_status]?.label : null],
                ].map(([label, value]) => value ? (
                  <div key={label as string} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 11, color: '#9ca3af' }}>{label}</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: '#111' }}>{String(value)}</span>
                  </div>
                ) : null)}
                {selected.fleet_notes && (
                  <div style={{ gridColumn: '1 / -1', background: '#f9fafb', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#374151' }}>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>Napomene</div>
                    {selected.fleet_notes}
                  </div>
                )}
              </div>
            )}

            {/* PLATES TAB */}
            {activeTab === 'plates' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>Historija tablica</div>
                  <button onClick={() => { setAddForm({ valid_from: today }); setShowAddPlate(true) }}
                    style={{ padding: '5px 12px', fontSize: 12, border: '1px solid #1D9E75', borderRadius: 8, background: '#E1F5EE', cursor: 'pointer', color: '#085041', fontWeight: 600 }}>
                    + Promijeni tablice
                  </button>
                </div>
                {plates.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 24, color: '#9ca3af', fontSize: 13, border: '1px dashed #e5e7eb', borderRadius: 8 }}>Nema evidencije tablica</div>
                ) : plates.map((p, i) => {
                  const isActive = !p.valid_until
                  return (
                    <div key={p.id} style={{ border: `1px solid ${isActive ? '#1D9E75' : '#e5e7eb'}`, borderRadius: 8, padding: '12px 14px', marginBottom: 8, background: isActive ? '#f0fdf8' : '#fff' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700, color: isActive ? '#085041' : '#374151', letterSpacing: 2 }}>
                          {p.plate_number}
                        </div>
                        {isActive && <span style={{ fontSize: 11, background: '#E1F5EE', color: '#085041', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>Trenutne tablice</span>}
                      </div>
                      <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>
                        Od: {p.valid_from}
                        {p.valid_until && ` · Do: ${p.valid_until}`}
                      </div>
                      {p.notes && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4, fontStyle: 'italic' }}>{p.notes}</div>}
                    </div>
                  )
                })}
              </div>
            )}

            {/* REGISTRATION TAB */}
            {activeTab === 'registration' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>Registracije</div>
                  <button onClick={() => { setAddForm({ registered_from: today }); setShowAddReg(true) }}
                    style={{ padding: '5px 12px', fontSize: 12, border: '1px solid #1D9E75', borderRadius: 8, background: '#E1F5EE', cursor: 'pointer', color: '#085041', fontWeight: 600 }}>
                    + Dodaj
                  </button>
                </div>
                {registrations.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 24, color: '#9ca3af', fontSize: 13, border: '1px dashed #e5e7eb', borderRadius: 8 }}>Nema evidencije registracije</div>
                ) : registrations.map(r => {
                  const days = getDaysUntil(r.registered_until)
                  const isExpired = days !== null && days < 0
                  const isSoon = days !== null && days >= 0 && days <= 30
                  return (
                    <div key={r.id} style={{ border: `1px solid ${isExpired ? '#fecaca' : isSoon ? '#fbbf24' : '#e5e7eb'}`, borderRadius: 8, padding: '12px 14px', marginBottom: 8, background: isExpired ? '#fff5f5' : isSoon ? '#fffbeb' : '#fff' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>{r.registration_number || 'Bez broja'}</div>
                        <div style={{ fontSize: 12, color: isExpired ? '#dc2626' : isSoon ? '#d97706' : '#9ca3af' }}>
                          {isExpired ? `Isteklo ${Math.abs(days!)} dana` : isSoon ? `Ističe za ${days} dana` : `Važi do ${r.registered_until}`}
                        </div>
                      </div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>{r.registered_from} — {r.registered_until} {r.registration_cost ? `· ${r.registration_cost}€` : ''}</div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* INSPECTION TAB */}
            {activeTab === 'inspection' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>Tehnički pregledi</div>
                  <button onClick={() => { setAddForm({ inspection_date: today, passed: true }); setShowAddInsp(true) }}
                    style={{ padding: '5px 12px', fontSize: 12, border: '1px solid #1D9E75', borderRadius: 8, background: '#E1F5EE', cursor: 'pointer', color: '#085041', fontWeight: 600 }}>
                    + Dodaj
                  </button>
                </div>
                {inspections.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 24, color: '#9ca3af', fontSize: 13, border: '1px dashed #e5e7eb', borderRadius: 8 }}>Nema evidencije tehničkog pregleda</div>
                ) : inspections.map(i => {
                  const days = getDaysUntil(i.valid_until)
                  const isExpired = days !== null && days < 0
                  const isSoon = days !== null && days >= 0 && days <= 30
                  return (
                    <div key={i.id} style={{ border: `1px solid ${isExpired ? '#fecaca' : isSoon ? '#fbbf24' : '#e5e7eb'}`, borderRadius: 8, padding: '12px 14px', marginBottom: 8, background: isExpired ? '#fff5f5' : isSoon ? '#fffbeb' : '#fff' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>{i.inspection_date} <span style={{ fontSize: 11, color: i.passed ? '#085041' : '#dc2626', background: i.passed ? '#E1F5EE' : '#FCEBEB', padding: '1px 6px', borderRadius: 10 }}>{i.passed ? 'Prošao' : 'Nije prošao'}</span></div>
                        <div style={{ fontSize: 12, color: isExpired ? '#dc2626' : isSoon ? '#d97706' : '#9ca3af' }}>
                          {isExpired ? `Isteklo ${Math.abs(days!)} dana` : isSoon ? `Ističe za ${days} dana` : `Važi do ${i.valid_until}`}
                        </div>
                      </div>
                      {i.cost && <div style={{ fontSize: 12, color: '#6b7280' }}>Cijena: {i.cost}€</div>}
                    </div>
                  )
                })}
              </div>
            )}

            {/* INSURANCE TAB */}
            {activeTab === 'insurance' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>Osiguranje</div>
                  <button onClick={() => { setAddForm({ insurance_type: 'liability', valid_from: today }); setShowAddIns(true) }}
                    style={{ padding: '5px 12px', fontSize: 12, border: '1px solid #1D9E75', borderRadius: 8, background: '#E1F5EE', cursor: 'pointer', color: '#085041', fontWeight: 600 }}>
                    + Dodaj
                  </button>
                </div>
                {insurance.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 24, color: '#9ca3af', fontSize: 13, border: '1px dashed #e5e7eb', borderRadius: 8 }}>Nema evidencije osiguranja</div>
                ) : insurance.map(i => {
                  const days = getDaysUntil(i.valid_until)
                  const isExpired = days !== null && days < 0
                  const isSoon = days !== null && days >= 0 && days <= 30
                  const typeLabels: Record<string, string> = { liability: 'Obavezno', comprehensive: 'Kasko', other: 'Ostalo' }
                  return (
                    <div key={i.id} style={{ border: `1px solid ${isExpired ? '#fecaca' : isSoon ? '#fbbf24' : '#e5e7eb'}`, borderRadius: 8, padding: '12px 14px', marginBottom: 8, background: isExpired ? '#fff5f5' : isSoon ? '#fffbeb' : '#fff' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>{typeLabels[i.insurance_type]} {i.provider && `· ${i.provider}`}</div>
                        <div style={{ fontSize: 12, color: isExpired ? '#dc2626' : isSoon ? '#d97706' : '#9ca3af' }}>
                          {isExpired ? `Isteklo ${Math.abs(days!)} dana` : isSoon ? `Ističe za ${days} dana` : `Do ${i.valid_until}`}
                        </div>
                      </div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>
                        {i.policy_number && `Polisa: ${i.policy_number} · `}{i.valid_from} — {i.valid_until}{i.cost ? ` · ${i.cost}€` : ''}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* TYRES TAB */}
            {activeTab === 'tyres' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>Gume</div>
                  <button onClick={() => { setAddForm({ tyre_type: 'summer', condition: 'good', installed_date: today, is_active: true }); setShowAddTyre(true) }}
                    style={{ padding: '5px 12px', fontSize: 12, border: '1px solid #1D9E75', borderRadius: 8, background: '#E1F5EE', cursor: 'pointer', color: '#085041', fontWeight: 600 }}>
                    + Dodaj
                  </button>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Trenutno na vozilu</div>
                  {tyres.filter(t => t.is_active).length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 16, color: '#9ca3af', fontSize: 13, border: '1px dashed #e5e7eb', borderRadius: 8 }}>Nema evidentiranih guma</div>
                  ) : tyres.filter(t => t.is_active).map(t => {
                    const typeLabels: Record<string, string> = { summer: 'Ljetne', winter: 'Zimske', allseason: 'Cjelogodišnje' }
                    const condLabels: Record<string, { label: string; color: string }> = {
                      new: { label: 'Nove', color: '#085041' }, good: { label: 'Dobro', color: '#185FA5' },
                      worn: { label: 'Istrošene', color: '#d97706' }, replace: { label: 'Zamijeniti!', color: '#dc2626' }
                    }
                    const cond = condLabels[t.condition] || condLabels.good
                    return (
                      <div key={t.id} style={{ border: `1px solid ${t.condition === 'replace' ? '#fecaca' : '#e5e7eb'}`, borderRadius: 8, padding: '10px 12px', marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ fontWeight: 500, fontSize: 13 }}>{typeLabels[t.tyre_type]} {t.brand && `· ${t.brand}`} {t.size && `· ${t.size}`}</div>
                          <div style={{ fontSize: 12, color: '#6b7280' }}>Montirane: {t.installed_date} {t.installed_mileage ? `· ${t.installed_mileage.toLocaleString()} km` : ''}</div>
                        </div>
                        <span style={{ fontSize: 11, color: cond.color, fontWeight: 600, alignSelf: 'center' }}>{cond.label}</span>
                      </div>
                    )
                  })}
                </div>
                {tyres.filter(t => !t.is_active).length > 0 && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Na skladištu</div>
                    {tyres.filter(t => !t.is_active).map(t => {
                      const typeLabels: Record<string, string> = { summer: 'Ljetne', winter: 'Zimske', allseason: 'Cjelogodišnje' }
                      return (
                        <div key={t.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 12px', marginBottom: 6, background: '#f9fafb', display: 'flex', justifyContent: 'space-between' }}>
                          <div style={{ fontSize: 13, color: '#6b7280' }}>{typeLabels[t.tyre_type]} {t.brand && `· ${t.brand}`} {t.size && `· ${t.size}`}</div>
                          {t.storage_location && <span style={{ fontSize: 11, color: '#9ca3af' }}>{t.storage_location}</span>}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* SERVICE TAB */}
            {activeTab === 'service' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>Servisiranje i održavanje</div>
                  <button onClick={() => { setAddForm({ service_date: today, service_type: 'regular', performed_by: 'internal', status: 'completed' }); setShowAddService(true) }}
                    style={{ padding: '5px 12px', fontSize: 12, border: '1px solid #1D9E75', borderRadius: 8, background: '#E1F5EE', cursor: 'pointer', color: '#085041', fontWeight: 600 }}>
                    + Dodaj servis
                  </button>
                </div>
                {services.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 24, color: '#9ca3af', fontSize: 13, border: '1px dashed #e5e7eb', borderRadius: 8 }}>Nema evidencije servisa</div>
                ) : services.map(s => {
                  const typeLabels: Record<string, { label: string; bg: string; color: string }> = {
                    regular: { label: 'Redovni servis', bg: '#E1F5EE', color: '#085041' },
                    repair: { label: 'Popravka', bg: '#FAEEDA', color: '#633806' },
                    damage: { label: 'Šteta', bg: '#FCEBEB', color: '#791F1F' },
                    tyre: { label: 'Gume', bg: '#E6F1FB', color: '#0C447C' },
                    other: { label: 'Ostalo', bg: '#f3f4f6', color: '#374151' },
                  }
                  const st = typeLabels[s.service_type] || typeLabels.other
                  const scheduled = s.status === 'scheduled'
                  return (
                    <div key={s.id} style={{ border: `1px solid ${scheduled ? '#fbbf24' : '#e5e7eb'}`, borderRadius: 8, padding: '12px 14px', marginBottom: 8, background: scheduled ? '#fffbeb' : '#fff' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                        <div>
                          <span style={{ fontSize: 11, background: st.bg, color: st.color, padding: '2px 8px', borderRadius: 20, fontWeight: 500 }}>{st.label}</span>
                          {s.status === 'scheduled' && <span style={{ fontSize: 11, background: '#fef3c7', color: '#d97706', padding: '2px 8px', borderRadius: 20, marginLeft: 6 }}>Zakazano</span>}
                          {s.status === 'in_progress' && <span style={{ fontSize: 11, background: '#E6F1FB', color: '#0C447C', padding: '2px 8px', borderRadius: 20, marginLeft: 6 }}>U toku</span>}
                        </div>
                        <div style={{ fontSize: 12, color: '#9ca3af' }}>{s.service_date}</div>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#111', marginBottom: 4 }}>{s.description}</div>
                      <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#6b7280' }}>
                        {s.mileage_at_service && <span>{s.mileage_at_service.toLocaleString()} km</span>}
                        {s.cost && <span style={{ color: '#1D9E75', fontWeight: 600 }}>{s.cost}€</span>}
                        {s.performed_by === 'internal' && s.technicians?.full_name && <span>Serviser: {s.technicians.full_name}</span>}
                        {s.performed_by === 'external' && s.external_shop && <span>Radionica: {s.external_shop}</span>}
                      </div>
                      {s.next_service_date && (
                        <div style={{ marginTop: 6, fontSize: 11, color: '#9ca3af' }}>
                          Sljedeći servis: {s.next_service_date} {s.next_service_mileage ? `· ${s.next_service_mileage.toLocaleString()} km` : ''}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* DOCS TAB */}
            {activeTab === 'docs' && (
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#111', marginBottom: 14 }}>Dokumenti</div>
                {docs.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 24, color: '#9ca3af', fontSize: 13, border: '1px dashed #e5e7eb', borderRadius: 8 }}>Nema uploadovanih dokumenata</div>
                ) : docs.map(d => (
                  <div key={d.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 12px', marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{d.doc_name}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>{d.doc_type} {d.expires_at && `· Ističe: ${d.expires_at}`}</div>
                    </div>
                    {d.file_url && (
                      <a href={d.file_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#185FA5', textDecoration: 'none' }}>Otvori →</a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ADD PLATE MODAL */}
      {showAddPlate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: '24px', maxWidth: 380, width: '100%' }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>Promjena tablica</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 18 }}>Stare tablice će biti arhivirane, nove postaju aktivne.</div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Novi broj tablica *</label>
              <input value={addForm.plate_number || ''} onChange={e => setAddForm((a: any) => ({ ...a, plate_number: e.target.value.toUpperCase() }))}
                placeholder="PG 123-AB" style={{ ...inp(), fontFamily: 'monospace', fontSize: 16, letterSpacing: 2, textTransform: 'uppercase' as const }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Datum promjene</label>
              <input type="date" value={addForm.valid_from || today} onChange={e => setAddForm((a: any) => ({ ...a, valid_from: e.target.value }))} style={inp()} />
            </div>
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Napomena</label>
              <input value={addForm.notes || ''} onChange={e => setAddForm((a: any) => ({ ...a, notes: e.target.value }))} placeholder="npr. Administrativna promjena..." style={inp()} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={savePlate} disabled={addSaving || !addForm.plate_number}
                style={{ flex: 2, padding: '10px', background: !addForm.plate_number ? '#9ca3af' : '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                {addSaving ? '...' : 'Sačuvaj'}
              </button>
              <button onClick={() => { setShowAddPlate(false); setAddForm({}) }}
                style={{ flex: 1, padding: '10px', border: '1px solid #d1d5db', borderRadius: 8, background: 'transparent', fontSize: 13, cursor: 'pointer', color: '#374151' }}>
                Odustani
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {showEditModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: '24px', maxWidth: 560, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#111', marginBottom: 18 }}>Uredi vozilo — {selected?.name}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { key: 'vin', label: 'VIN broj', type: 'text' },
                { key: 'license_plate', label: 'Tablice', type: 'text' },
                { key: 'year', label: 'Godište', type: 'number' },
                { key: 'color', label: 'Boja', type: 'text' },
                { key: 'make', label: 'Marka', type: 'text' },
                { key: 'model', label: 'Model', type: 'text' },
                { key: 'engine_cc', label: 'Kubikaza (cc)', type: 'number' },
                { key: 'seats', label: 'Broj sjedišta', type: 'number' },
                { key: 'current_mileage', label: 'Trenutna kilometraža', type: 'number' },
                { key: 'purchase_date', label: 'Datum nabavke', type: 'date' },
                { key: 'purchase_price', label: 'Cijena nabavke (€)', type: 'number' },
                { key: 'purchase_from', label: 'Nabavljeno od', type: 'text' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>{f.label}</label>
                  <input type={f.type} value={String((editForm as any)[f.key] || '')}
                    onChange={e => setEditForm(ef => ({ ...ef, [f.key]: f.type === 'number' ? (e.target.value ? parseFloat(e.target.value) : null) : e.target.value }))}
                    style={inp()} />
                </div>
              ))}
              <div>
                <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Gorivo</label>
                <select value={(editForm as any).fuel_type || ''} onChange={e => setEditForm(ef => ({ ...ef, fuel_type: e.target.value }))} style={inp()}>
                  <option value="petrol">Benzin</option>
                  <option value="diesel">Dizel</option>
                  <option value="hybrid">Hibrid</option>
                  <option value="electric">Električno</option>
                  <option value="lpg">LPG</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Mjenjač</label>
                <select value={(editForm as any).transmission || ''} onChange={e => setEditForm(ef => ({ ...ef, transmission: e.target.value }))} style={inp()}>
                  <option value="manual">Ručni</option>
                  <option value="automatic">Automatik</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Status flote</label>
                <select value={(editForm as any).fleet_status || 'available'} onChange={e => setEditForm(ef => ({ ...ef, fleet_status: e.target.value }))} style={inp()}>
                  <option value="available">Dostupno</option>
                  <option value="rented">Iznajmljeno</option>
                  <option value="service">U servisu</option>
                  <option value="damaged">Oštećeno</option>
                  <option value="inactive">Neaktivno</option>
                </select>
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Napomene</label>
              <textarea value={(editForm as any).fleet_notes || ''} onChange={e => setEditForm(ef => ({ ...ef, fleet_notes: e.target.value }))}
                style={{ ...inp(), minHeight: 60, resize: 'vertical' as const }} />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
              <button onClick={saveEdit} disabled={editSaving}
                style={{ flex: 2, padding: '10px', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                {editSaving ? '...' : 'Sačuvaj'}
              </button>
              <button onClick={() => setShowEditModal(false)} style={{ flex: 1, padding: '10px', border: '1px solid #d1d5db', borderRadius: 8, background: 'transparent', fontSize: 13, cursor: 'pointer', color: '#374151' }}>
                Odustani
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD REGISTRATION MODAL */}
      {showAddReg && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: '24px', maxWidth: 400, width: '100%' }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Dodaj registraciju</div>
            {[
              { key: 'registration_number', label: 'Broj registracije', type: 'text' },
              { key: 'registered_from', label: 'Od', type: 'date' },
              { key: 'registered_until', label: 'Do', type: 'date' },
              { key: 'registration_cost', label: 'Cijena (€)', type: 'number' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 3 }}>{f.label}</label>
                <input type={f.type} value={addForm[f.key] || ''} onChange={e => setAddForm((a: any) => ({ ...a, [f.key]: e.target.value }))} style={inp()} />
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button onClick={() => saveRecord('vehicle_registrations', addForm)} disabled={addSaving}
                style={{ flex: 2, padding: '10px', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                {addSaving ? '...' : 'Sačuvaj'}
              </button>
              <button onClick={() => setShowAddReg(false)} style={{ flex: 1, padding: '10px', border: '1px solid #d1d5db', borderRadius: 8, background: 'transparent', fontSize: 13, cursor: 'pointer', color: '#374151' }}>Odustani</button>
            </div>
          </div>
        </div>
      )}

      {/* ADD INSPECTION MODAL */}
      {showAddInsp && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: '24px', maxWidth: 400, width: '100%' }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Dodaj tehnički pregled</div>
            {[
              { key: 'inspection_date', label: 'Datum pregleda', type: 'date' },
              { key: 'valid_until', label: 'Važi do', type: 'date' },
              { key: 'cost', label: 'Cijena (€)', type: 'number' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 3 }}>{f.label}</label>
                <input type={f.type} value={addForm[f.key] || ''} onChange={e => setAddForm((a: any) => ({ ...a, [f.key]: e.target.value }))} style={inp()} />
              </div>
            ))}
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 3 }}>Rezultat</label>
              <select value={addForm.passed ?? true} onChange={e => setAddForm((a: any) => ({ ...a, passed: e.target.value === 'true' }))} style={inp()}>
                <option value="true">Prošao</option>
                <option value="false">Nije prošao</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button onClick={() => saveRecord('vehicle_technical_inspections', addForm)} disabled={addSaving}
                style={{ flex: 2, padding: '10px', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                {addSaving ? '...' : 'Sačuvaj'}
              </button>
              <button onClick={() => setShowAddInsp(false)} style={{ flex: 1, padding: '10px', border: '1px solid #d1d5db', borderRadius: 8, background: 'transparent', fontSize: 13, cursor: 'pointer', color: '#374151' }}>Odustani</button>
            </div>
          </div>
        </div>
      )}

      {/* ADD INSURANCE MODAL */}
      {showAddIns && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: '24px', maxWidth: 400, width: '100%' }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Dodaj osiguranje</div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 3 }}>Tip osiguranja</label>
              <select value={addForm.insurance_type || 'liability'} onChange={e => setAddForm((a: any) => ({ ...a, insurance_type: e.target.value }))} style={inp()}>
                <option value="liability">Obavezno</option>
                <option value="comprehensive">Kasko</option>
                <option value="other">Ostalo</option>
              </select>
            </div>
            {[
              { key: 'provider', label: 'Osiguravač', type: 'text' },
              { key: 'policy_number', label: 'Broj polise', type: 'text' },
              { key: 'valid_from', label: 'Važi od', type: 'date' },
              { key: 'valid_until', label: 'Važi do', type: 'date' },
              { key: 'cost', label: 'Cijena (€)', type: 'number' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 3 }}>{f.label}</label>
                <input type={f.type} value={addForm[f.key] || ''} onChange={e => setAddForm((a: any) => ({ ...a, [f.key]: e.target.value }))} style={inp()} />
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button onClick={() => saveRecord('vehicle_insurance', addForm)} disabled={addSaving}
                style={{ flex: 2, padding: '10px', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                {addSaving ? '...' : 'Sačuvaj'}
              </button>
              <button onClick={() => setShowAddIns(false)} style={{ flex: 1, padding: '10px', border: '1px solid #d1d5db', borderRadius: 8, background: 'transparent', fontSize: 13, cursor: 'pointer', color: '#374151' }}>Odustani</button>
            </div>
          </div>
        </div>
      )}

      {/* ADD TYRE MODAL */}
      {showAddTyre && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: '24px', maxWidth: 400, width: '100%' }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Dodaj gume</div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 3 }}>Tip guma</label>
              <select value={addForm.tyre_type || 'summer'} onChange={e => setAddForm((a: any) => ({ ...a, tyre_type: e.target.value }))} style={inp()}>
                <option value="summer">Ljetne</option>
                <option value="winter">Zimske</option>
                <option value="allseason">Cjelogodišnje</option>
              </select>
            </div>
            {[
              { key: 'brand', label: 'Marka', type: 'text' },
              { key: 'size', label: 'Dimenzija (npr. 205/55 R16)', type: 'text' },
              { key: 'installed_date', label: 'Datum montaže', type: 'date' },
              { key: 'installed_mileage', label: 'Kilometraža pri montaži', type: 'number' },
              { key: 'storage_location', label: 'Lokacija skladišta (ako nisu montirane)', type: 'text' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 3 }}>{f.label}</label>
                <input type={f.type} value={addForm[f.key] || ''} onChange={e => setAddForm((a: any) => ({ ...a, [f.key]: e.target.value }))} style={inp()} />
              </div>
            ))}
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 3 }}>Stanje</label>
              <select value={addForm.condition || 'good'} onChange={e => setAddForm((a: any) => ({ ...a, condition: e.target.value }))} style={inp()}>
                <option value="new">Nove</option>
                <option value="good">Dobro</option>
                <option value="worn">Istrošene</option>
                <option value="replace">Zamijeniti</option>
              </select>
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 3 }}>Status</label>
              <select value={addForm.is_active ? 'true' : 'false'} onChange={e => setAddForm((a: any) => ({ ...a, is_active: e.target.value === 'true' }))} style={inp()}>
                <option value="true">Montirane na vozilu</option>
                <option value="false">Na skladištu</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button onClick={() => saveRecord('vehicle_tyres', addForm)} disabled={addSaving}
                style={{ flex: 2, padding: '10px', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                {addSaving ? '...' : 'Sačuvaj'}
              </button>
              <button onClick={() => setShowAddTyre(false)} style={{ flex: 1, padding: '10px', border: '1px solid #d1d5db', borderRadius: 8, background: 'transparent', fontSize: 13, cursor: 'pointer', color: '#374151' }}>Odustani</button>
            </div>
          </div>
        </div>
      )}
      {/* ADD SERVICE MODAL */}
      {showAddService && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: '24px', maxWidth: 480, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Dodaj servisni zapis</div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 3 }}>Tip servisa *</label>
              <select value={addForm.service_type || 'regular'} onChange={e => setAddForm((a: any) => ({ ...a, service_type: e.target.value }))} style={inp()}>
                <option value="regular">Redovni servis</option>
                <option value="repair">Popravka</option>
                <option value="damage">Šteta</option>
                <option value="tyre">Gume</option>
                <option value="other">Ostalo</option>
              </select>
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 3 }}>Opis *</label>
              <textarea value={addForm.description || ''} onChange={e => setAddForm((a: any) => ({ ...a, description: e.target.value }))}
                placeholder="npr. Zamjena ulja i filtera, provjera kočnica..."
                style={{ ...inp(), minHeight: 70, resize: 'vertical' as const }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div>
                <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 3 }}>Datum *</label>
                <input type="date" value={addForm.service_date || ''} onChange={e => setAddForm((a: any) => ({ ...a, service_date: e.target.value }))} style={inp()} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 3 }}>Kilometraža</label>
                <input type="number" value={addForm.mileage_at_service || ''} onChange={e => setAddForm((a: any) => ({ ...a, mileage_at_service: e.target.value }))} placeholder="45000" style={inp()} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div>
                <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 3 }}>Cijena (€)</label>
                <input type="number" step="0.01" value={addForm.cost || ''} onChange={e => setAddForm((a: any) => ({ ...a, cost: e.target.value }))} placeholder="0.00" style={inp()} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 3 }}>Status</label>
                <select value={addForm.status || 'completed'} onChange={e => setAddForm((a: any) => ({ ...a, status: e.target.value }))} style={inp()}>
                  <option value="completed">Završeno</option>
                  <option value="in_progress">U toku</option>
                  <option value="scheduled">Zakazano</option>
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 3 }}>Ko je radio?</label>
              <select value={addForm.performed_by || 'internal'} onChange={e => setAddForm((a: any) => ({ ...a, performed_by: e.target.value }))} style={inp()}>
                <option value="internal">Interni serviser</option>
                <option value="external">Vanjska radionica</option>
              </select>
            </div>
            {addForm.performed_by === 'internal' && (
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 3 }}>Serviser</label>
                <select value={addForm.technician_id || ''} onChange={e => setAddForm((a: any) => ({ ...a, technician_id: e.target.value }))} style={inp()}>
                  <option value="">-- Odaberi --</option>
                  {technicians.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                </select>
              </div>
            )}
            {addForm.performed_by === 'external' && (
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 3 }}>Naziv radionice</label>
                <input value={addForm.external_shop || ''} onChange={e => setAddForm((a: any) => ({ ...a, external_shop: e.target.value }))} placeholder="Auto servis..." style={inp()} />
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 3 }}>Sljedeći servis (datum)</label>
                <input type="date" value={addForm.next_service_date || ''} onChange={e => setAddForm((a: any) => ({ ...a, next_service_date: e.target.value }))} style={inp()} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 3 }}>Sljedeći servis (km)</label>
                <input type="number" value={addForm.next_service_mileage || ''} onChange={e => setAddForm((a: any) => ({ ...a, next_service_mileage: e.target.value }))} placeholder="50000" style={inp()} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => saveRecord('vehicle_services', { ...addForm, mileage_at_service: addForm.mileage_at_service ? parseInt(addForm.mileage_at_service) : null, cost: addForm.cost ? parseFloat(addForm.cost) : null, next_service_mileage: addForm.next_service_mileage ? parseInt(addForm.next_service_mileage) : null, technician_id: addForm.technician_id || null })} disabled={addSaving || !addForm.description}
                style={{ flex: 2, padding: '10px', background: !addForm.description ? '#9ca3af' : '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                {addSaving ? '...' : 'Sačuvaj'}
              </button>
              <button onClick={() => setShowAddService(false)} style={{ flex: 1, padding: '10px', border: '1px solid #d1d5db', borderRadius: 8, background: 'transparent', fontSize: 13, cursor: 'pointer', color: '#374151' }}>Odustani</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
