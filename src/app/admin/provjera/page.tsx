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

const CHECKLIST = [
  { key: 'check_oil', label: 'Ulje' },
  { key: 'check_water', label: 'Voda' },
  { key: 'check_brake_fluid', label: 'Glicerin za kočnice' },
  { key: 'check_wipers', label: 'Brisači' },
  { key: 'check_washer', label: 'Prskalice brisača' },
  { key: 'check_windows', label: 'Podizači stakala' },
  { key: 'check_lights', label: 'Svjetla' },
  { key: 'check_interior', label: 'Interijer' },
  { key: 'check_radio', label: 'Radio / Multimedija' },
  { key: 'check_horn', label: 'Sirena' },
  { key: 'check_other', label: 'Ostalo' },
]

export default function ProovjeraPage() {
  const [vehicles, setVehicles] = useState<any[]>([])
  const [technicians, setTechnicians] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const agentName = getCookie('avtorent-agent-name')

  const emptyForm = {
    vehicle_id: '',
    mileage: '',
    check_oil: true, check_water: true, check_brake_fluid: true,
    check_wipers: true, check_washer: true, check_windows: true,
    check_lights: true, check_interior: true, check_radio: true,
    check_horn: true, check_other: true,
    status: 'ok',
    notes: '',
    service_trigger: '',
    service_type_needed: '',
    task_status: 'pending',
    performed_by: 'internal',
    technician_id: '',
    external_shop: '',
    parts_cost: '',
    labour_cost: '',
    repair_notes: '',
  }

  const [form, setForm] = useState(emptyForm)
  const [recentInspections, setRecentInspections] = useState<any[]>([])

  useEffect(() => {
    Promise.all([
      supabase.from('vehicles').select('id, name, license_plate, fleet_status').eq('is_available', true).order('name'),
      supabase.from('technicians').select('*').eq('is_active', true),
    ]).then(([{ data: v }, { data: t }]) => {
      setVehicles(v || [])
      setTechnicians(t || [])
      setLoading(false)
    })
    fetchRecent()
  }, [])

  async function fetchRecent() {
    const { data } = await supabase
      .from('vehicle_inspections')
      .select('*, vehicles(name)')
      .order('inspection_date', { ascending: false })
      .limit(10)
    setRecentInspections(data || [])
  }

  function setCheck(key: string, val: boolean) {
    setForm(f => ({ ...f, [key]: val }))
  }

  const allOk = CHECKLIST.every(c => (form as any)[c.key] === true)
  const hasIssue = CHECKLIST.some(c => (form as any)[c.key] === false)

  async function handleSubmit() {
    if (!form.vehicle_id) return
    setSaving(true)

    const totalRepair = (parseFloat(form.parts_cost || '0') + parseFloat(form.labour_cost || '0')) || null

    const payload: any = {
      vehicle_id: form.vehicle_id,
      inspected_by: agentName || 'Agent',
      mileage: form.mileage ? parseInt(form.mileage) : null,
      check_oil: form.check_oil, check_water: form.check_water,
      check_brake_fluid: form.check_brake_fluid, check_wipers: form.check_wipers,
      check_washer: form.check_washer, check_windows: form.check_windows,
      check_lights: form.check_lights, check_interior: form.check_interior,
      check_radio: form.check_radio, check_horn: form.check_horn,
      check_other: form.check_other,
      status: hasIssue ? 'needs_service' : 'ok',
      notes: form.notes || null,
    }

    if (hasIssue) {
      payload.service_trigger = form.service_trigger || 'issue'
      payload.service_type_needed = form.service_type_needed || null
      payload.task_status = form.task_status || 'pending'
      payload.performed_by = form.performed_by || null
      payload.technician_id = form.technician_id || null
      payload.external_shop = form.external_shop || null
      payload.parts_cost = form.parts_cost ? parseFloat(form.parts_cost) : null
      payload.labour_cost = form.labour_cost ? parseFloat(form.labour_cost) : null
      payload.total_repair_cost = totalRepair
      payload.repair_notes = form.repair_notes || null

      // Ako ne može da se izdaje — promijeni status vozila
      if (form.task_status !== 'ready') {
        await supabase.from('vehicles').update({ fleet_status: 'service', is_available: false }).eq('id', form.vehicle_id)
      }
    }

    await supabase.from('vehicle_inspections').insert(payload)
    setSaving(false)
    setSaved(true)
    setForm(emptyForm)
    fetchRecent()
    setTimeout(() => setSaved(false), 3000)
  }

  const inp = { width: '100%', padding: '9px 12px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, color: '#111', background: '#fff', boxSizing: 'border-box' as const }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Učitavanje...</div>

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: '#111' }}>Redovna provjera vozila</h1>
        <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>Popuni checklist za svako vozilo koje provjeraš</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 24 }}>
        {/* Forma */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 24 }}>

          {saved && (
            <div style={{ background: '#E1F5EE', border: '1px solid #5DCAA5', borderRadius: 8, padding: '12px 16px', marginBottom: 20, fontSize: 14, fontWeight: 600, color: '#085041' }}>
              ✓ Provjera je uspješno sačuvana!
            </div>
          )}

          {/* Vozilo i kilometraža */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            <div>
              <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Vozilo *</label>
              <select value={form.vehicle_id} onChange={e => setForm(f => ({ ...f, vehicle_id: e.target.value }))} style={inp}>
                <option value="">-- Odaberi vozilo --</option>
                {vehicles.map(v => (
                  <option key={v.id} value={v.id}>{v.name} {v.license_plate ? `(${v.license_plate})` : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Kilometraža</label>
              <input type="number" value={form.mileage} onChange={e => setForm(f => ({ ...f, mileage: e.target.value }))} placeholder="npr. 45230" style={inp} />
            </div>
          </div>

          {/* Checklist */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 12 }}>Checklist provjere</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {CHECKLIST.map(item => {
                const val = (form as any)[item.key]
                return (
                  <div key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', border: `1px solid ${val === false ? '#fecaca' : '#e5e7eb'}`, borderRadius: 8, background: val === false ? '#fff5f5' : '#fff' }}>
                    <span style={{ fontSize: 13, color: '#374151' }}>{item.label}</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => setCheck(item.key, true)}
                        style={{ padding: '4px 10px', fontSize: 11, border: `1px solid ${val === true ? '#1D9E75' : '#e5e7eb'}`, borderRadius: 6, background: val === true ? '#E1F5EE' : '#fff', color: val === true ? '#085041' : '#6b7280', cursor: 'pointer', fontWeight: val === true ? 600 : 400 }}>
                        OK
                      </button>
                      <button onClick={() => setCheck(item.key, false)}
                        style={{ padding: '4px 10px', fontSize: 11, border: `1px solid ${val === false ? '#dc2626' : '#e5e7eb'}`, borderRadius: 6, background: val === false ? '#FCEBEB' : '#fff', color: val === false ? '#dc2626' : '#6b7280', cursor: 'pointer', fontWeight: val === false ? 600 : 400 }}>
                        ✗
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Komentar */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Komentar</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Dodatne napomene o stanju vozila..."
              style={{ ...inp, minHeight: 70, resize: 'vertical' as const }} />
          </div>

          {/* Ako ima problema */}
          {hasIssue && (
            <div style={{ background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 10, padding: 16, marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#791F1F', marginBottom: 14 }}>⚠ Prijavljeni problemi — detalji</div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Okidač servisa</label>
                  <select value={form.service_trigger} onChange={e => setForm(f => ({ ...f, service_trigger: e.target.value }))} style={inp}>
                    <option value="issue">Problem na provjeri</option>
                    <option value="mileage">Kilometraža</option>
                    <option value="time">Protok vremena</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Tip servisa</label>
                  <select value={form.service_type_needed} onChange={e => setForm(f => ({ ...f, service_type_needed: e.target.value }))} style={inp}>
                    <option value="">-- Odaberi --</option>
                    <option value="small">Mali servis</option>
                    <option value="big">Veliki servis</option>
                    <option value="repair">Popravka</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Status taska</label>
                <select value={form.task_status} onChange={e => setForm(f => ({ ...f, task_status: e.target.value }))} style={inp}>
                  <option value="pending">Na čekanju</option>
                  <option value="our_service">U našem servisu</option>
                  <option value="external_service">Kod drugog servisera</option>
                  <option value="testing">Završeno — testira se</option>
                  <option value="ready">Završeno — spremno za izdavanje</option>
                </select>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Ko servisira?</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[['internal', 'Interni serviser'], ['external', 'Vanjska radionica']].map(([val, lbl]) => (
                    <button key={val} onClick={() => setForm(f => ({ ...f, performed_by: val }))}
                      style={{ flex: 1, padding: '8px', fontSize: 13, border: `1px solid ${form.performed_by === val ? '#1D9E75' : '#e5e7eb'}`, borderRadius: 8, background: form.performed_by === val ? '#E1F5EE' : '#fff', color: form.performed_by === val ? '#085041' : '#6b7280', cursor: 'pointer', fontWeight: form.performed_by === val ? 600 : 400 }}>
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>

              {form.performed_by === 'internal' && (
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Serviser</label>
                  <select value={form.technician_id} onChange={e => setForm(f => ({ ...f, technician_id: e.target.value }))} style={inp}>
                    <option value="">-- Odaberi servisera --</option>
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

              {(form.parts_cost || form.labour_cost) && (
                <div style={{ background: '#FAEEDA', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 13, fontWeight: 600, color: '#633806' }}>
                  Ukupno: {(parseFloat(form.parts_cost || '0') + parseFloat(form.labour_cost || '0')).toFixed(2)}€
                </div>
              )}

              <div>
                <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Šta je urađeno / napomene</label>
                <textarea value={form.repair_notes} onChange={e => setForm(f => ({ ...f, repair_notes: e.target.value }))}
                  placeholder="Opis popravke..."
                  style={{ ...inp, minHeight: 60, resize: 'vertical' as const }} />
              </div>

              {form.task_status !== 'ready' && (
                <div style={{ marginTop: 12, background: '#FCEBEB', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#791F1F' }}>
                  ⚠ Vozilo će biti postavljeno kao <strong>nedostupno za izdavanje</strong> dok status ne bude "Spremno za izdavanje"
                </div>
              )}
            </div>
          )}

          {allOk && (
            <div style={{ background: '#E1F5EE', border: '1px solid #5DCAA5', borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: 13, color: '#085041' }}>
              ✓ Sve stavke su OK — vozilo je spremno za izdavanje
            </div>
          )}

          <button onClick={handleSubmit} disabled={saving || !form.vehicle_id}
            style={{ width: '100%', padding: '12px', background: !form.vehicle_id ? '#9ca3af' : '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            {saving ? 'Snimanje...' : 'Sačuvaj provjeru'}
          </button>
        </div>

        {/* Nedavne provjere */}
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#111', marginBottom: 12 }}>Nedavne provjere</div>
          {recentInspections.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 24, color: '#9ca3af', fontSize: 13, border: '1px dashed #e5e7eb', borderRadius: 8, background: '#fff' }}>Nema provjera</div>
          ) : recentInspections.map(i => (
            <div key={i.id} style={{ background: '#fff', border: `1px solid ${i.status === 'needs_service' ? '#fecaca' : '#e5e7eb'}`, borderRadius: 10, padding: '12px 14px', marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ fontWeight: 500, fontSize: 13, color: '#111' }}>{i.vehicles?.name}</div>
                <span style={{ fontSize: 11, background: i.status === 'needs_service' ? '#FCEBEB' : '#E1F5EE', color: i.status === 'needs_service' ? '#791F1F' : '#085041', padding: '2px 8px', borderRadius: 20, fontWeight: 500 }}>
                  {i.status === 'needs_service' ? 'Treba servis' : 'OK'}
                </span>
              </div>
              <div style={{ fontSize: 11, color: '#9ca3af' }}>
                {new Date(i.inspection_date).toLocaleDateString('sr-RS')} · {i.inspected_by}
                {i.mileage && ` · ${i.mileage.toLocaleString()} km`}
              </div>
              {i.notes && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4, fontStyle: 'italic' }}>{i.notes}</div>}
              {i.task_status && i.task_status !== 'ready' && (
                <div style={{ fontSize: 11, color: '#d97706', marginTop: 4, fontWeight: 500 }}>
                  Status: {{pending: 'Na čekanju', our_service: 'U našem servisu', external_service: 'Vanjski servis', testing: 'Testiranje', ready: 'Spremno'}[i.task_status as string]}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
