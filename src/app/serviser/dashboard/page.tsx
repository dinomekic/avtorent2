'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const TASK_STATUS_LABELS: Record<string, { label: string; bg: string; color: string }> = {
  pending:          { label: 'Na čekanju', bg: '#FAEEDA', color: '#633806' },
  our_service:      { label: 'U radu', bg: '#E6F1FB', color: '#0C447C' },
  external_service: { label: 'Vanjski servis', bg: '#E6F1FB', color: '#0C447C' },
  testing:          { label: 'Testiranje', bg: '#fef3c7', color: '#d97706' },
  ready:            { label: 'Završeno', bg: '#E1F5EE', color: '#085041' },
}

const PRIORITY_LABELS: Record<string, { label: string; color: string }> = {
  low:    { label: 'Nizak', color: '#9ca3af' },
  normal: { label: 'Normalan', color: '#185FA5' },
  high:   { label: 'Visok', color: '#d97706' },
  urgent: { label: 'HITNO!', color: '#dc2626' },
}

export default function ServiserDashboard() {
  const [technician, setTechnician] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [faults, setFaults] = useState<any[]>([])
  const [inspections, setInspections] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'open' | 'mine' | 'done' | 'payouts'>('open')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [updateForm, setUpdateForm] = useState<any>({})
  const [period, setPeriod] = useState<'month' | 'prev'>('month')

  useEffect(() => {
    checkAuth()
  }, [])

  async function checkAuth() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      window.location.href = '/serviser/login'
      return
    }

    const { data: tech } = await supabase
      .from('technicians')
      .select('*')
      .eq('portal_email', user.email)
      .single()

    if (!tech) {
      window.location.href = '/serviser/login'
      return
    }

    setTechnician(tech)
    fetchData(tech.id)
  }

  async function fetchData(techId: string) {
    const [{ data: f }, { data: i }] = await Promise.all([
      supabase.from('vehicle_faults')
        .select('*, vehicles(name, license_plate)')
        .or(`technician_id.eq.${techId},task_status.eq.pending`)
        .order('created_at', { ascending: false }),
      supabase.from('vehicle_inspections')
        .select('*, vehicles(name, license_plate)')
        .or(`technician_id.eq.${techId},task_status.eq.pending`)
        .eq('status', 'needs_service')
        .order('inspection_date', { ascending: false }),
    ])
    setFaults(f || [])
    setInspections(i || [])
    setLoading(false)
  }

  async function updateStatus(table: string, id: string, updates: any, vehicleId: string) {
    await supabase.from(table).update(updates).eq('id', id)
    if (updates.task_status === 'ready') {
      await supabase.from('vehicles').update({ fleet_status: 'available', is_available: true }).eq('id', vehicleId)
    } else if (['our_service', 'external_service', 'testing'].includes(updates.task_status)) {
      await supabase.from('vehicles').update({ fleet_status: 'service', is_available: false }).eq('id', vehicleId)
    }
    fetchData(technician.id)
    setUpdatingId(null)
    setUpdateForm({})
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = '/serviser/login'
  }

  // Obračun plaće
  const now = new Date()
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString()

  const periodStart = period === 'month' ? currentMonthStart : prevMonthStart
  const periodEnd = period === 'month' ? now.toISOString() : prevMonthEnd

  const doneFaults = faults.filter(f =>
    f.task_status === 'ready' &&
    f.technician_id === technician?.id &&
    f.updated_at >= periodStart && f.updated_at <= periodEnd
  )
  const doneInspections = inspections.filter(i =>
    i.task_status === 'ready' &&
    i.technician_id === technician?.id &&
    i.updated_at >= periodStart && i.updated_at <= periodEnd
  )

  const bonusRepairs = doneFaults.length * (technician?.bonus_per_repair || 0)
  const bonusServices = doneInspections.length * (technician?.bonus_per_service || 0)
  const totalBonus = bonusRepairs + bonusServices
  const totalComp = (technician?.salary || 0) + totalBonus

  const openItems = [
    ...faults.filter(f => f.task_status !== 'ready').map(f => ({ ...f, _type: 'fault' })),
    ...inspections.filter(i => i.task_status !== 'ready').map(i => ({ ...i, _type: 'inspection' })),
  ].sort((a, b) => {
    const pOrder: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 }
    return (pOrder[a.priority] || 2) - (pOrder[b.priority] || 2)
  })

  const myItems = openItems.filter(i => i.technician_id === technician?.id)

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb' }}>
      <div style={{ color: '#9ca3af', fontSize: 16 }}>Učitavanje...</div>
    </div>
  )

  const tabStyle = (tab: string) => ({
    padding: '8px 16px', fontSize: 13, border: 'none',
    background: activeTab === tab ? '#1D9E75' : '#f3f4f6',
    color: activeTab === tab ? '#fff' : '#6b7280',
    cursor: 'pointer', borderRadius: 8, fontWeight: activeTab === tab ? 600 : 400,
  })

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#111' }}>🔧 Serviser portal</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 1 }}>{technician?.full_name}</div>
        </div>
        <button onClick={handleLogout} style={{ fontSize: 12, color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
          Odjava
        </button>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>

        {/* Metrike */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Otvoreno', value: openItems.length, color: '#dc2626', bg: '#fff5f5' },
            { label: 'Moji taskovi', value: myItems.length, color: '#185FA5', bg: '#E6F1FB' },
            { label: 'Završeno (mj.)', value: doneFaults.length + doneInspections.length, color: '#1D9E75', bg: '#E1F5EE' },
            { label: 'Zarada (mj.)', value: `${totalComp.toFixed(0)}€`, color: '#633806', bg: '#FAEEDA' },
          ].map(m => (
            <div key={m.label} style={{ background: m.bg, borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>{m.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: m.color }}>{m.value}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <button onClick={() => setActiveTab('open')} style={tabStyle('open')}>Svi otvoreni ({openItems.length})</button>
          <button onClick={() => setActiveTab('mine')} style={tabStyle('mine')}>Moji ({myItems.length})</button>
          <button onClick={() => setActiveTab('done')} style={tabStyle('done')}>Završeni</button>
          <button onClick={() => setActiveTab('payouts')} style={tabStyle('payouts')}>Obračun</button>
        </div>

        {/* Lista taskova */}
        {(activeTab === 'open' || activeTab === 'mine') && (
          <div>
            {(activeTab === 'open' ? openItems : myItems).length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af', background: '#fff', borderRadius: 12, border: '1px dashed #e5e7eb' }}>
                Nema otvorenih stavki
              </div>
            ) : (activeTab === 'open' ? openItems : myItems).map(item => {
              const isEditing = updatingId === item.id
              const pr = PRIORITY_LABELS[item.priority || 'normal']
              const ts = TASK_STATUS_LABELS[item.task_status] || TASK_STATUS_LABELS.pending
              return (
                <div key={item.id} style={{ background: '#fff', border: `1px solid ${item.priority === 'urgent' ? '#fecaca' : '#e5e7eb'}`, borderRadius: 12, padding: '16px 18px', marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 15, color: '#111' }}>{item.vehicles?.name}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                        {item.vehicles?.license_plate} · {new Date(item.created_at || item.inspection_date).toLocaleDateString('sr-RS')}
                        <span style={{ marginLeft: 8, color: pr.color, fontWeight: 600 }}>{pr.label}</span>
                      </div>
                    </div>
                    <span style={{ fontSize: 12, background: ts.bg, color: ts.color, padding: '3px 10px', borderRadius: 20, fontWeight: 500 }}>{ts.label}</span>
                  </div>

                  <div style={{ fontSize: 13, color: '#374151', marginBottom: 10, background: '#f9fafb', borderRadius: 6, padding: '8px 10px' }}>
                    {item._type === 'fault' ? item.fault_description : item.notes || 'Provjera vozila — pronađeni problemi'}
                  </div>

                  {item.total_repair_cost && (
                    <div style={{ fontSize: 12, color: '#1D9E75', fontWeight: 600, marginBottom: 8 }}>
                      Troškovi: dijelovi {item.parts_cost || 0}€ + rad {item.labour_cost || 0}€ = {item.total_repair_cost}€
                    </div>
                  )}

                  {!isEditing ? (
                    <button onClick={() => { setUpdatingId(item.id); setUpdateForm({ task_status: item.task_status, what_was_done: item.what_was_done || '', parts_cost: item.parts_cost || '', labour_cost: item.labour_cost || '' }) }}
                      style={{ padding: '7px 16px', fontSize: 12, border: '1px solid #1D9E75', borderRadius: 8, background: '#E1F5EE', cursor: 'pointer', color: '#085041', fontWeight: 600 }}>
                      Ažuriraj status
                    </button>
                  ) : (
                    <div style={{ background: '#f9fafb', borderRadius: 8, padding: 14 }}>
                      <div style={{ marginBottom: 10 }}>
                        <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Status</label>
                        <select value={updateForm.task_status} onChange={e => setUpdateForm((f: any) => ({ ...f, task_status: e.target.value }))}
                          style={{ width: '100%', padding: '8px 12px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, color: '#111' }}>
                          <option value="pending">Na čekanju</option>
                          <option value="our_service">U radu</option>
                          <option value="testing">Testiranje</option>
                          <option value="ready">Završeno</option>
                        </select>
                      </div>
                      <div style={{ marginBottom: 10 }}>
                        <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Šta je urađeno</label>
                        <textarea value={updateForm.what_was_done} onChange={e => setUpdateForm((f: any) => ({ ...f, what_was_done: e.target.value }))}
                          placeholder="Opis popravke..."
                          style={{ width: '100%', padding: '8px 12px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, minHeight: 60, resize: 'vertical' as const, color: '#111', boxSizing: 'border-box' as const }} />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                        <div>
                          <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Dijelovi (€)</label>
                          <input type="number" step="0.01" value={updateForm.parts_cost} onChange={e => setUpdateForm((f: any) => ({ ...f, parts_cost: e.target.value }))}
                            style={{ width: '100%', padding: '8px 12px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, color: '#111', boxSizing: 'border-box' as const }} />
                        </div>
                        <div>
                          <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Rad (€)</label>
                          <input type="number" step="0.01" value={updateForm.labour_cost} onChange={e => setUpdateForm((f: any) => ({ ...f, labour_cost: e.target.value }))}
                            style={{ width: '100%', padding: '8px 12px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, color: '#111', boxSizing: 'border-box' as const }} />
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => updateStatus(
                          item._type === 'fault' ? 'vehicle_faults' : 'vehicle_inspections',
                          item.id,
                          { task_status: updateForm.task_status, what_was_done: updateForm.what_was_done || null, parts_cost: updateForm.parts_cost ? parseFloat(updateForm.parts_cost) : null, labour_cost: updateForm.labour_cost ? parseFloat(updateForm.labour_cost) : null, total_repair_cost: updateForm.parts_cost || updateForm.labour_cost ? parseFloat(updateForm.parts_cost || '0') + parseFloat(updateForm.labour_cost || '0') : null, completed_at: updateForm.task_status === 'ready' ? new Date().toISOString() : null },
                          item.vehicle_id
                        )}
                          style={{ flex: 2, padding: '9px', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                          Sačuvaj
                        </button>
                        <button onClick={() => { setUpdatingId(null); setUpdateForm({}) }}
                          style={{ flex: 1, padding: '9px', border: '1px solid #d1d5db', borderRadius: 8, background: 'transparent', fontSize: 13, cursor: 'pointer', color: '#374151' }}>
                          Odustani
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Završeni */}
        {activeTab === 'done' && (
          <div>
            {[...faults, ...inspections].filter(i => i.task_status === 'ready' && i.technician_id === technician?.id).length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af', background: '#fff', borderRadius: 12, border: '1px dashed #e5e7eb' }}>Nema završenih stavki</div>
            ) : [...faults, ...inspections].filter(i => i.task_status === 'ready' && i.technician_id === technician?.id).map(item => (
              <div key={item.id} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px', marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div style={{ fontWeight: 500, fontSize: 13, color: '#374151' }}>{item.vehicles?.name}</div>
                  <span style={{ fontSize: 11, background: '#E1F5EE', color: '#085041', padding: '2px 8px', borderRadius: 20 }}>Završeno</span>
                </div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>
                  {item.what_was_done || item.fault_description || 'Provjera vozila'}
                </div>
                {item.total_repair_cost && (
                  <div style={{ fontSize: 12, color: '#1D9E75', fontWeight: 600, marginTop: 4 }}>
                    Troškovi: {item.total_repair_cost}€
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Obračun */}
        {activeTab === 'payouts' && (
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 24 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              <button onClick={() => setPeriod('month')} style={{ ...tabStyle('month'), background: period === 'month' ? '#1D9E75' : '#f3f4f6', color: period === 'month' ? '#fff' : '#6b7280' }}>Tekući mjesec</button>
              <button onClick={() => setPeriod('prev')} style={{ ...tabStyle('prev'), background: period === 'prev' ? '#1D9E75' : '#f3f4f6', color: period === 'prev' ? '#fff' : '#6b7280' }}>Prethodni mjesec</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                ['Fiksna plata', `${(technician?.salary || 0).toFixed(0)}€`],
                ['Popravke', `${doneFaults.length} × ${technician?.bonus_per_repair || 0}€ = ${bonusRepairs.toFixed(0)}€`],
                ['Servisi', `${doneInspections.length} × ${technician?.bonus_per_service || 0}€ = ${bonusServices.toFixed(0)}€`],
                ['Ukupno bonusi', `${totalBonus.toFixed(0)}€`],
              ].map(([label, value], i) => (
                <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f3f4f6', fontSize: 14 }}>
                  <span style={{ color: '#6b7280' }}>{label}</span>
                  <span style={{ color: '#111', fontWeight: 500 }}>{value}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 16px', background: '#E1F5EE', borderRadius: 10, marginTop: 8 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#085041' }}>UKUPNO</span>
                <span style={{ fontSize: 20, fontWeight: 700, color: '#1D9E75' }}>{totalComp.toFixed(0)}€</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
