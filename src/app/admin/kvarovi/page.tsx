'use client'

import { useEffect, useState } from 'react'
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

const FAULT_TYPES = [
  { key: 'transmission', label: 'Mjenjač' },
  { key: 'engine', label: 'Motor' },
  { key: 'brakes', label: 'Kočnice' },
  { key: 'dashboard', label: 'Instrument tabla' },
  { key: 'ignition', label: 'Paljenje' },
  { key: 'lights', label: 'Svjetla' },
  { key: 'wipers', label: 'Brisači' },
  { key: 'cooling', label: 'Gubi vodu / hlađenje' },
  { key: 'windows', label: 'Podizači stakala' },
  { key: 'other', label: 'Ostalo' },
]

const TASK_STATUS_LABELS: Record<string, { label: string; bg: string; color: string }> = {
  pending:          { label: 'Na čekanju', bg: '#FAEEDA', color: '#633806' },
  our_service:      { label: 'Naš servis', bg: '#E6F1FB', color: '#0C447C' },
  external_service: { label: 'Vanjski servis', bg: '#E6F1FB', color: '#0C447C' },
  testing:          { label: 'Testiranje', bg: '#fef3c7', color: '#d97706' },
  ready:            { label: 'Spremno', bg: '#E1F5EE', color: '#085041' },
}

const PRIORITY_LABELS: Record<string, { label: string; bg: string; color: string }> = {
  low:    { label: 'Nizak', bg: '#f3f4f6', color: '#374151' },
  normal: { label: 'Normalan', bg: '#E6F1FB', color: '#0C447C' },
  high:   { label: 'Visok', bg: '#FAEEDA', color: '#633806' },
  urgent: { label: 'HITNO', bg: '#FCEBEB', color: '#791F1F' },
}

export default function KvaroviPage() {
  const [vehicles, setVehicles] = useState<any[]>([])
  const [technicians, setTechnicians] = useState<any[]>([])
  const [faults, setFaults] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showForm, setShowForm] = useState(true)
  const [editFault, setEditFault] = useState<any | null>(null)

  const agentName = getCookie('avtorent-agent-name')

  const emptyForm = {
    vehicle_id: '', fault_type: 'other', fault_description: '',
    is_drivable: true, can_be_rented: true,
    task_status: 'pending', priority: 'normal',
    performed_by: 'internal', technician_id: '', external_shop: '',
    what_was_done: '', parts_cost: '', labour_cost: '', repair_notes: '',
  }
  const [form, setForm] = useState(emptyForm)

  useEffect(() => {
    Promise.all([
      supabase.from('vehicles').select('id, name, license_plate').order('name'),
      supabase.from('technicians').select('*').eq('is_active', true),
    ]).then(([{ data: v }, { data: t }]) => {
      setVehicles(v || [])
      setTechnicians(t || [])
    })
    fetchFaults()
  }, [])

  async function fetchFaults() {
    const { data } = await supabase
      .from('vehicle_faults')
      .select('*, vehicles(name, license_plate), technicians(full_name)')
      .order('created_at', { ascending: false })
    setFaults(data || [])
    setLoading(false)
  }

  async function handleSubmit() {
    if (!form.vehicle_id || !form.fault_description) return
    setSaving(true)

    const totalRepair = (parseFloat(form.parts_cost || '0') + parseFloat(form.labour_cost || '0')) || null

    const payload: any = {
      vehicle_id: form.vehicle_id,
      reported_by: agentName || 'Agent',
      fault_type: form.fault_type,
      fault_description: form.fault_description,
      is_drivable: form.is_drivable,
      can_be_rented: form.can_be_rented,
      task_status: form.task_status,
      priority: form.priority,
      performed_by: form.performed_by || null,
      technician_id: form.technician_id || null,
      external_shop: form.external_shop || null,
      what_was_done: form.what_was_done || null,
      parts_cost: form.parts_cost ? parseFloat(form.parts_cost) : null,
      labour_cost: form.labour_cost ? parseFloat(form.labour_cost) : null,
      total_repair_cost: totalRepair,
      repair_notes: form.repair_notes || null,
    }

    if (!form.can_be_rented) {
      await supabase.from('vehicles').update({ fleet_status: 'service', is_available: false }).eq('id', form.vehicle_id)
    }

    await supabase.from('vehicle_faults').insert(payload)
    setSaving(false); setSaved(true)
    setForm(emptyForm)
    fetchFaults()
    setTimeout(() => setSaved(false), 3000)
  }

  async function updateFaultStatus(id: string, task_status: string, vehicleId: string) {
    await supabase.from('vehicle_faults').update({ task_status }).eq('id', id)
    if (task_status === 'ready') {
      await supabase.from('vehicles').update({ fleet_status: 'available', is_available: true }).eq('id', vehicleId)
    }
    fetchFaults()
  }

  const inp = { width: '100%', padding: '9px 12px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, color: '#111', background: '#fff', boxSizing: 'border-box' as const }
  const openFaults = faults.filter(f => f.task_status !== 'ready')
  const closedFaults = faults.filter(f => f.task_status === 'ready')

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#111' }}>Prijave kvarova</h1>
          {openFaults.length > 0 && <div style={{ fontSize: 13, color: '#dc2626', marginTop: 2 }}>{openFaults.length} otvorenih kvarova</div>}
        </div>
        <button onClick={() => setShowForm(s => !s)}
          style={{ padding: '8px 16px', fontSize: 13, border: '1px solid #1D9E75', borderRadius: 8, background: showForm ? '#1D9E75' : '#E1F5EE', color: showForm ? '#fff' : '#085041', cursor: 'pointer', fontWeight: 600 }}>
          {showForm ? 'Sakrij formu' : '+ Prijavi kvar'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: showForm ? '1fr 400px' : '1fr', gap: 24 }}>

        {/* Lista kvarova */}
        <div>
          {/* Otvoreni */}
          <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 10 }}>Otvoreni kvarovi ({openFaults.length})</div>
          {loading ? <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>Učitavanje...</div> :
            openFaults.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 24, color: '#9ca3af', fontSize: 13, border: '1px dashed #e5e7eb', borderRadius: 8, background: '#fff', marginBottom: 16 }}>Nema otvorenih kvarova</div>
            ) : openFaults.map(f => {
              const ts = TASK_STATUS_LABELS[f.task_status] || TASK_STATUS_LABELS.pending
              const pr = PRIORITY_LABELS[f.priority] || PRIORITY_LABELS.normal
              const ft = FAULT_TYPES.find(x => x.key === f.fault_type)
              return (
                <div key={f.id} style={{ background: '#fff', border: `1px solid ${f.priority === 'urgent' ? '#fecaca' : '#e5e7eb'}`, borderRadius: 10, padding: '14px 16px', marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: '#111' }}>{f.vehicles?.name}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>{f.vehicles?.license_plate} · {new Date(f.created_at).toLocaleDateString('sr-RS')} · {f.reported_by}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <span style={{ fontSize: 11, background: pr.bg, color: pr.color, padding: '2px 8px', borderRadius: 20, fontWeight: 500 }}>{pr.label}</span>
                      <span style={{ fontSize: 11, background: ts.bg, color: ts.color, padding: '2px 8px', borderRadius: 20, fontWeight: 500 }}>{ts.label}</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, background: '#f9fafb', borderRadius: 6, padding: '6px 10px', marginBottom: 8 }}>
                    <span style={{ color: '#6b7280' }}>{ft?.label}: </span>
                    <span style={{ color: '#111' }}>{f.fault_description}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, fontSize: 11, marginBottom: 8, flexWrap: 'wrap' }}>
                    {!f.is_drivable && <span style={{ background: '#FCEBEB', color: '#791F1F', padding: '2px 7px', borderRadius: 10, fontWeight: 500 }}>Nije u voznom stanju</span>}
                    {!f.can_be_rented && <span style={{ background: '#FCEBEB', color: '#791F1F', padding: '2px 7px', borderRadius: 10, fontWeight: 500 }}>Ne može se izdavati</span>}
                    {f.technicians?.full_name && <span style={{ color: '#6b7280' }}>Serviser: {f.technicians.full_name}</span>}
                    {f.external_shop && <span style={{ color: '#6b7280' }}>Radionica: {f.external_shop}</span>}
                    {f.total_repair_cost && <span style={{ color: '#1D9E75', fontWeight: 600 }}>{f.total_repair_cost}€</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {['pending', 'our_service', 'external_service', 'testing', 'ready'].map(s => (
                      <button key={s} onClick={() => updateFaultStatus(f.id, s, f.vehicle_id)}
                        style={{ padding: '4px 10px', fontSize: 11, border: `1px solid ${f.task_status === s ? '#1D9E75' : '#e5e7eb'}`, borderRadius: 6, background: f.task_status === s ? '#E1F5EE' : '#fff', color: f.task_status === s ? '#085041' : '#6b7280', cursor: 'pointer', fontWeight: f.task_status === s ? 600 : 400 }}>
                        {TASK_STATUS_LABELS[s]?.label}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })
          }

          {/* Zatvoreni */}
          {closedFaults.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 10 }}>Riješeni kvarovi ({closedFaults.length})</div>
              {closedFaults.map(f => {
                const ft = FAULT_TYPES.find(x => x.key === f.fault_type)
                return (
                  <div key={f.id} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px', marginBottom: 8, opacity: 0.8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <div style={{ fontWeight: 500, fontSize: 13, color: '#374151' }}>{f.vehicles?.name}</div>
                      <span style={{ fontSize: 11, background: '#E1F5EE', color: '#085041', padding: '2px 8px', borderRadius: 20 }}>Riješeno</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>{ft?.label} · {new Date(f.created_at).toLocaleDateString('sr-RS')}</div>
                    {f.total_repair_cost && <div style={{ fontSize: 12, color: '#1D9E75', fontWeight: 500, marginTop: 2 }}>Troškovi: {f.total_repair_cost}€</div>}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Forma za prijavu */}
        {showForm && (
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, alignSelf: 'start' }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#111', marginBottom: 16 }}>Prijavi kvar</div>

            {saved && (
              <div style={{ background: '#E1F5EE', border: '1px solid #5DCAA5', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, fontWeight: 600, color: '#085041' }}>
                ✓ Kvar je prijavljen!
              </div>
            )}

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Vozilo *</label>
              <select value={form.vehicle_id} onChange={e => setForm(f => ({ ...f, vehicle_id: e.target.value }))} style={inp}>
                <option value="">-- Odaberi vozilo --</option>
                {vehicles.map(v => <option key={v.id} value={v.id}>{v.name} {v.license_plate ? `(${v.license_plate})` : ''}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Tip kvara *</label>
              <select value={form.fault_type} onChange={e => setForm(f => ({ ...f, fault_type: e.target.value }))} style={inp}>
                {FAULT_TYPES.map(ft => <option key={ft.key} value={ft.key}>{ft.label}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Opis kvara *</label>
              <textarea value={form.fault_description} onChange={e => setForm(f => ({ ...f, fault_description: e.target.value }))}
                placeholder="Opišite kvar što detaljnije..."
                style={{ ...inp, minHeight: 70, resize: 'vertical' as const }} />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 6 }}>Status vozila</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.is_drivable} onChange={e => setForm(f => ({ ...f, is_drivable: e.target.checked }))} />
                  Vozilo je u voznom stanju
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.can_be_rented} onChange={e => setForm(f => ({ ...f, can_be_rented: e.target.checked }))} />
                  Vozilo se može izdavati
                </label>
              </div>
              {!form.can_be_rented && (
                <div style={{ marginTop: 8, fontSize: 11, color: '#dc2626', background: '#fff5f5', borderRadius: 6, padding: '6px 10px' }}>
                  ⚠ Vozilo će biti postavljeno kao nedostupno za izdavanje
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Prioritet</label>
                <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} style={inp}>
                  <option value="low">Nizak</option>
                  <option value="normal">Normalan</option>
                  <option value="high">Visok</option>
                  <option value="urgent">HITNO</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Ko servisira?</label>
                <select value={form.performed_by} onChange={e => setForm(f => ({ ...f, performed_by: e.target.value }))} style={inp}>
                  <option value="internal">Interni serviser</option>
                  <option value="external">Vanjska radionica</option>
                </select>
              </div>
            </div>

            {form.performed_by === 'internal' && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Serviser</label>
                <select value={form.technician_id} onChange={e => setForm(f => ({ ...f, technician_id: e.target.value }))} style={inp}>
                  <option value="">-- Odaberi --</option>
                  {technicians.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                </select>
              </div>
            )}

            {form.performed_by === 'external' && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Naziv radionice</label>
                <input value={form.external_shop} onChange={e => setForm(f => ({ ...f, external_shop: e.target.value }))} placeholder="Auto servis..." style={inp} />
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Cijena dijelova (€)</label>
                <input type="number" step="0.01" value={form.parts_cost} onChange={e => setForm(f => ({ ...f, parts_cost: e.target.value }))} placeholder="0.00" style={inp} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Cijena rada (€)</label>
                <input type="number" step="0.01" value={form.labour_cost} onChange={e => setForm(f => ({ ...f, labour_cost: e.target.value }))} placeholder="0.00" style={inp} />
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Šta je urađeno</label>
              <textarea value={form.what_was_done} onChange={e => setForm(f => ({ ...f, what_was_done: e.target.value }))}
                placeholder="Opis popravke..."
                style={{ ...inp, minHeight: 60, resize: 'vertical' as const }} />
            </div>

            <button onClick={handleSubmit} disabled={saving || !form.vehicle_id || !form.fault_description}
              style={{ width: '100%', padding: '11px', background: !form.vehicle_id || !form.fault_description ? '#9ca3af' : '#dc2626', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              {saving ? 'Prijavljujem...' : 'Prijavi kvar'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
