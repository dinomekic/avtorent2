'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type WashOrder = {
  id: string; vehicle_name: string; wash_type_label: string; price: number
  status: string; assigned_to: string; agent_name: string | null
  notes: string | null; created_at: string; completed_at: string | null
  payout_status: string; payout_amount: number | null
  reservations?: { ref_code: string; guest_name: string } | null
}

type FleetVehicle = {
  id: number; license_plate: string; agregirani_2: string; marka: string; model: string
}

type WashPartner = {
  id: string; name: string; phone: string | null; is_active: boolean
  price_quick: number; price_detailed: number; price_deep_quick: number; price_deep_detailed: number
  portal_email: string | null
}

const STATUS_LABELS: Record<string, { label: string; bg: string; color: string }> = {
  pending:     { label: 'Čeka pranje', bg: '#FAEEDA', color: '#633806' },
  in_progress: { label: 'U toku', bg: '#E6F1FB', color: '#0C447C' },
  done:        { label: 'Završeno', bg: '#E1F5EE', color: '#085041' },
}

const WASH_TYPES = [
  { key: 'quick',        label: 'Brzo pranje',        priceKey: 'price_quick' },
  { key: 'detailed',     label: 'Detaljno pranje',     priceKey: 'price_detailed' },
  { key: 'deep_quick',   label: 'Dubinsko brzo',       priceKey: 'price_deep_quick' },
  { key: 'deep_detailed',label: 'Dubinsko detaljno',   priceKey: 'price_deep_detailed' },
  { key: 'specific',     label: 'Specifično pranje',   priceKey: null },
]

function getCookie(name: string): string {
  if (typeof document === 'undefined') return ''
  const match = document.cookie.match(new RegExp(`${name}=([^;]+)`))
  return match ? decodeURIComponent(match[1]) : ''
}

function genId(): string {
  return Date.now().toString() + Math.random().toString(36).slice(2, 6)
}

const inp: React.CSSProperties = { width: '100%', padding: '9px 12px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, color: '#111', boxSizing: 'border-box' as const, background: '#fff' }
const lbl: React.CSSProperties = { fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }
const inpSm: React.CSSProperties = { ...inp, padding: '7px 10px', fontSize: 12 }

function VehicleSearch({ search, setSearch, selected, setSelected, dropdown, setDropdown, fleetVehicles }: {
  search: string; setSearch: (v: string) => void
  selected: FleetVehicle | null; setSelected: (v: FleetVehicle | null) => void
  dropdown: boolean; setDropdown: (v: boolean) => void
  fleetVehicles: FleetVehicle[]
}) {
  const filtered = fleetVehicles.filter(v =>
    (v.license_plate || '').toLowerCase().includes(search.toLowerCase()) ||
    (v.agregirani_2 || '').toLowerCase().includes(search.toLowerCase())
  ).slice(0, 8)

  return (
    <div style={{ position: 'relative' }}>
      <input
        value={selected ? `${selected.license_plate} — ${selected.agregirani_2}` : search}
        onChange={e => { setSearch(e.target.value); setSelected(null); setDropdown(true) }}
        onFocus={() => setDropdown(true)}
        placeholder="Pretraži po tablicama..."
        style={inp}
      />
      {selected && (
        <button onClick={() => { setSelected(null); setSearch(''); setDropdown(false) }}
          style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 16 }}>✕</button>
      )}
      {dropdown && !selected && filtered.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 50, maxHeight: 220, overflowY: 'auto' }}>
          {filtered.map((v: FleetVehicle) => (
            <div key={v.id} onClick={() => { setSelected(v); setSearch(''); setDropdown(false) }}
              style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6', fontSize: 13 }}
              onMouseOver={e => (e.currentTarget.style.background = '#f0fdf8')}
              onMouseOut={e => (e.currentTarget.style.background = '#fff')}>
              <span style={{ fontWeight: 700, color: '#1D9E75', marginRight: 8 }}>{v.license_plate}</span>
              <span style={{ color: '#374151' }}>{v.agregirani_2}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function AdminPranjePage() {
  const [activeTab, setActiveTab] = useState<'nalozi' | 'peraci' | 'istorija'>('nalozi')
  const [orders, setOrders] = useState<WashOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'in_progress' | 'done'>('all')
  const [payoutOrder, setPayoutOrder] = useState<WashOrder | null>(null)
  const [payoutAmount, setPayoutAmount] = useState('')
  const [payoutNote, setPayoutNote] = useState('')
  const [payoutSaving, setPayoutSaving] = useState(false)
  const [washPartners, setWashPartners] = useState<WashPartner[]>([])
  const [washPartner, setWashPartner] = useState<WashPartner | null>(null)
  const [selectedPartnerId, setSelectedPartnerId] = useState('')
  const agentName = getCookie('avtorent-agent-name')
  const [agentEmail, setAgentEmail] = useState('')
  const [fleetVehicles, setFleetVehicles] = useState<FleetVehicle[]>([])
  const [vehicleSearch, setVehicleSearch] = useState('')
  const [vehicleDropdown, setVehicleDropdown] = useState(false)
  const [selectedVehicle, setSelectedVehicle] = useState<FleetVehicle | null>(null)
  const [showNewWash, setShowNewWash] = useState(false)
  const [newWashType, setNewWashType] = useState('')
  const [newWashCustomPrice, setNewWashCustomPrice] = useState('')
  const [newWashNotes, setNewWashNotes] = useState('')
  const [newWashSaving, setNewWashSaving] = useState(false)
  const [showSelfWash, setShowSelfWash] = useState(false)
  const [selfVehicleSearch, setSelfVehicleSearch] = useState('')
  const [selfVehicleDropdown, setSelfVehicleDropdown] = useState(false)
  const [selfSelectedVehicle, setSelfSelectedVehicle] = useState<FleetVehicle | null>(null)
  const [selfWashCost, setSelfWashCost] = useState('')
  const [selfWashNote, setSelfWashNote] = useState('')
  const [selfWashSaving, setSelfWashSaving] = useState(false)
  const [selfPresetVehicleName, setSelfPresetVehicleName] = useState('')
  const [selfPresetOrderId, setSelfPresetOrderId] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
    supabase.from('wash_partners').select('*').eq('is_active', true).order('name').then(({ data }) => {
      setWashPartners(data || [])
      if (data && data.length > 0) { setWashPartner(data[0]); setSelectedPartnerId(data[0].id) }
    })
    supabase.from('vozila_fleet').select('id, license_plate, agregirani_2, marka, model').eq('fleet_status', 'available').order('marka').then(({ data }) => setFleetVehicles(data || []))
    supabase.auth.getSession().then(({ data: { session } }) => { if (session?.user?.email) setAgentEmail(session.user.email) })
  }, [])

  async function fetchData() {
    const { data } = await supabase.from('wash_orders').select('*, reservations(ref_code, guest_name)').order('created_at', { ascending: false })
    setOrders(data || [])
    setLoading(false)
  }

  async function handleNewWash() {
    if (!selectedVehicle || !newWashType) return
    if (!washPartner) { alert('Odaberite perača!'); return }
    setNewWashSaving(true)
    const wt = WASH_TYPES.find(w => w.key === newWashType)
    let price = 0
    if (newWashType === 'specific') price = parseFloat(newWashCustomPrice || '0')
    else if (wt?.priceKey && washPartner) price = (washPartner as any)[wt.priceKey] || 0

    await supabase.from('wash_orders').insert({
      reservation_id: null,
      vehicle_name: selectedVehicle.agregirani_2 || selectedVehicle.license_plate,
      wash_type: newWashType, wash_type_label: wt?.label || newWashType, price,
      status: 'pending', assigned_to: 'partner',
      agent_name: null,
      wash_partner_id: washPartner.id,
      notes: newWashNotes || null,
      payout_status: 'unpaid',
      payout_amount: price,
    })
    setNewWashSaving(false); setShowNewWash(false)
    setSelectedVehicle(null); setVehicleSearch(''); setNewWashType(''); setNewWashCustomPrice(''); setNewWashNotes('')
    fetchData()
  }

  async function handleSelfWash() {
    if ((!selfSelectedVehicle && !selfPresetVehicleName) || !selfWashCost) { alert('Unesite vozilo i iznos!'); return }
    setSelfWashSaving(true)
    const cost = parseFloat(selfWashCost)
    const vehicleName = selfSelectedVehicle?.agregirani_2 || selfSelectedVehicle?.license_plate || selfPresetVehicleName
    const licensePlate = selfSelectedVehicle?.license_plate || selfPresetVehicleName
    if (selfPresetOrderId) {
      await supabase.from('wash_orders').update({ status: 'done', assigned_to: 'agent', agent_name: agentName || 'Agent', price: cost, completed_at: new Date().toISOString(), payout_status: null }).eq('id', selfPresetOrderId)
    } else {
      await supabase.from('wash_orders').insert({ reservation_id: null, vehicle_name: vehicleName, wash_type: 'self', wash_type_label: 'Pranje — agent', price: cost, status: 'done', assigned_to: 'agent', agent_name: agentName || 'Agent', notes: selfWashNote || null, payout_status: null, completed_at: new Date().toISOString() })
    }
    await supabase.from('transakcije').insert([{ id: genId(), tip_transakcije: 'odliv', datum: new Date().toISOString().split('T')[0], kategorija: 'Pranje', iznos: -Math.abs(cost), vozilo: licensePlate, komentar: `Pranje vozila: ${vehicleName}${selfWashNote ? ' — ' + selfWashNote : ''}`, osoba: agentName || 'Agent', osobaemail: agentEmail || null, timestamp_upisa: new Date().toISOString(), status: 'Zavrseno' }])
    setSelfWashSaving(false); setShowSelfWash(false)
    setSelfSelectedVehicle(null); setSelfVehicleSearch(''); setSelfWashCost(''); setSelfWashNote(''); setSelfPresetVehicleName(''); setSelfPresetOrderId(null)
    fetchData(); alert(`✅ Pranje evidentirano! Odliv ${cost}€ upisan u finansije.`)
  }

  async function sendPayout() {
    if (!payoutOrder || !payoutAmount || !washPartner) return
    setPayoutSaving(true)
    await supabase.from('agent_transactions').insert({ agent_name: agentName || 'Agent', type: 'expense', category: 'Isplata praonice', amount: parseFloat(payoutAmount), comment: payoutNote || `Pranje: ${payoutOrder.vehicle_name}`, counterpart_agent: washPartner.id, transfer_status: 'pending' })
    await supabase.from('wash_orders').update({ payout_status: 'pending', payout_amount: parseFloat(payoutAmount) }).eq('id', payoutOrder.id)
    setPayoutSaving(false); setPayoutOrder(null); setPayoutAmount(''); setPayoutNote(''); fetchData()
  }

  const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter)
  const pending = orders.filter(o => o.status === 'pending').length
  const inProgress = orders.filter(o => o.status === 'in_progress').length
  const done = orders.filter(o => o.status === 'done').length
  const unpaid = orders.filter(o => o.status === 'done' && o.payout_status === 'unpaid').length
  const totalCost = orders.filter(o => o.status === 'done').reduce((s, o) => s + (o.price || 0), 0)

  return (
    <div onClick={() => { setVehicleDropdown(false); setSelfVehicleDropdown(false) }}>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#111' }}>Pranje vozila</h1>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>Evidencija, perači i istorija</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowNewWash(true)} style={{ padding: '8px 16px', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>+ Novo pranje</button>
          <button onClick={() => setShowSelfWash(true)} style={{ padding: '8px 16px', background: '#185FA5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>🧹 Ja ću oprati</button>
        </div>
      </div>

      {/* TABOVI */}
      <div style={{ display: 'flex', borderBottom: '2px solid #f3f4f6', marginBottom: 16 }}>
        {([['nalozi', '📋 Nalozi'], ['peraci', '👤 Perači'], ['istorija', '📜 Istorija po vozilu']] as const).map(([t, l]) => (
          <button key={t} onClick={() => setActiveTab(t)}
            style={{ padding: '8px 18px', fontSize: 13, border: 'none', background: 'none', cursor: 'pointer', fontWeight: activeTab === t ? 700 : 400, color: activeTab === t ? '#1D9E75' : '#9ca3af', borderBottom: activeTab === t ? '2px solid #1D9E75' : '2px solid transparent', marginBottom: -2 }}>
            {l}
          </button>
        ))}
      </div>

      {/* ═══ TAB: NALOZI ═══ */}
      {activeTab === 'nalozi' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0,1fr))', gap: 12, marginBottom: 16 }}>
            {[
              { label: 'Na čekanju', value: pending, color: '#BA7517', bg: '#FAEEDA' },
              { label: 'U toku', value: inProgress, color: '#185FA5', bg: '#E6F1FB' },
              { label: 'Završeno', value: done, color: '#1D9E75', bg: '#E1F5EE' },
              { label: 'Neplaćeno', value: unpaid, color: '#dc2626', bg: '#FCEBEB' },
              { label: 'Ukupan trošak', value: `${totalCost}€`, color: '#111', bg: '#f3f4f6' },
            ].map(m => (
              <div key={m.label} style={{ background: m.bg, borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>{m.label}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: m.color }}>{m.value}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {[['all', 'Svi'], ['pending', 'Na čekanju'], ['in_progress', 'U toku'], ['done', 'Završeno']].map(([val, lbl]) => (
              <button key={val} onClick={() => setFilter(val as any)}
                style={{ padding: '5px 14px', fontSize: 12, borderRadius: 20, border: '1px solid', borderColor: filter === val ? '#1D9E75' : '#e5e7eb', background: filter === val ? '#E1F5EE' : '#fff', color: filter === val ? '#085041' : '#6b7280', cursor: 'pointer', fontWeight: filter === val ? 600 : 400 }}>
                {lbl}
              </button>
            ))}
          </div>

          <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
            {loading ? <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>Učitavanje...</div> : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    {['Vozilo', 'Tip pranja', 'Izvršio', 'Status', 'Cijena', 'Isplata', ''].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 500, fontSize: 12, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(o => {
                    const st = STATUS_LABELS[o.status] || STATUS_LABELS.pending
                    return (
                      <tr key={o.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 500, color: '#111' }}>{o.vehicle_name}</div>
                          {o.reservations && <div style={{ fontSize: 11, color: '#9ca3af' }}>{o.reservations.ref_code}</div>}
                        </td>
                        <td style={{ padding: '12px 16px', color: '#374151' }}>{o.wash_type_label}</td>
                        <td style={{ padding: '12px 16px' }}>
                          {o.assigned_to === 'partner'
                            ? <span style={{ fontSize: 11, background: '#E6F1FB', color: '#0C447C', padding: '2px 8px', borderRadius: 20 }}>
                                {washPartners.find(p => (o as any).wash_partner_id === p.id)?.name || 'Praonica'}
                              </span>
                            : <span style={{ fontSize: 11, background: '#E1F5EE', color: '#085041', padding: '2px 8px', borderRadius: 20 }}>Agent: {o.agent_name}</span>}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ fontSize: 11, background: st.bg, color: st.color, padding: '2px 8px', borderRadius: 20, fontWeight: 500 }}>{st.label}</span>
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 600, color: '#1D9E75' }}>{o.price}€</td>
                        <td style={{ padding: '12px 16px' }}>
                          {o.assigned_to === 'partner' ? (
                            o.payout_status === 'unpaid' ? <span style={{ fontSize: 11, background: '#FCEBEB', color: '#791F1F', padding: '2px 8px', borderRadius: 20 }}>Neplaćeno</span>
                            : o.payout_status === 'pending' ? <span style={{ fontSize: 11, background: '#FAEEDA', color: '#633806', padding: '2px 8px', borderRadius: 20 }}>Čeka potvrdu</span>
                            : <span style={{ fontSize: 11, background: '#E1F5EE', color: '#085041', padding: '2px 8px', borderRadius: 20 }}>Plaćeno</span>
                          ) : <span style={{ fontSize: 11, color: '#9ca3af' }}>—</span>}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            {o.assigned_to === 'partner' && o.status === 'done' && o.payout_status === 'unpaid' && (
                              <button onClick={() => { setPayoutOrder(o); setPayoutAmount(String(o.price)); setPayoutNote('') }}
                                style={{ padding: '4px 12px', fontSize: 11, border: '1px solid #1D9E75', borderRadius: 6, background: '#E1F5EE', cursor: 'pointer', color: '#085041', fontWeight: 500 }}>Isplati</button>
                            )}
                            {o.status === 'pending' && (
                              <button onClick={() => { setSelfSelectedVehicle(null); setSelfVehicleSearch(o.vehicle_name); setSelfWashCost(''); setSelfWashNote(''); setShowSelfWash(true); setSelfPresetVehicleName(o.vehicle_name); setSelfPresetOrderId(o.id) }}
                                style={{ padding: '4px 12px', fontSize: 11, border: '1px solid #185FA5', borderRadius: 6, background: '#E6F1FB', cursor: 'pointer', color: '#0C447C', fontWeight: 600 }}>🧹 Ja ću oprati</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {filtered.length === 0 && <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#9ca3af' }}>Nema naloga.</td></tr>}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* ═══ TAB: PERAČI ═══ */}
      {activeTab === 'peraci' && <PeraciTab />}

      {/* ═══ TAB: ISTORIJA ═══ */}
      {activeTab === 'istorija' && <IstorijaTab orders={orders} />}

      {/* NOVO PRANJE MODAL */}
      {showNewWash && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }} onClick={() => setShowNewWash(false)}>
          <div style={{ background: '#fff', borderRadius: 12, padding: '24px', maxWidth: 460, width: '100%', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#111' }}>Novo pranje</div>
              <button onClick={() => setShowNewWash(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9ca3af' }}>✕</button>
            </div>
            <div style={{ marginBottom: 14 }} onClick={e => e.stopPropagation()}>
              <label style={lbl}>Vozilo *</label>
              <VehicleSearch search={vehicleSearch} setSearch={setVehicleSearch} selected={selectedVehicle} setSelected={setSelectedVehicle} dropdown={vehicleDropdown} setDropdown={setVehicleDropdown} fleetVehicles={fleetVehicles} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Tip pranja *</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {WASH_TYPES.map(w => {
                  const price = w.priceKey && washPartner ? (washPartner as any)[w.priceKey] : null
                  return (
                    <button key={w.key} onClick={() => setNewWashType(w.key)}
                      style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 14px', border: `1px solid ${newWashType === w.key ? '#1D9E75' : '#e5e7eb'}`, borderRadius: 8, background: newWashType === w.key ? '#E1F5EE' : '#fff', cursor: 'pointer', fontSize: 13, color: newWashType === w.key ? '#085041' : '#374151', fontWeight: newWashType === w.key ? 600 : 400, textAlign: 'left' as const }}>
                      <span>{w.label}</span>
                      <span style={{ color: newWashType === w.key ? '#1D9E75' : '#9ca3af', fontWeight: 600 }}>{price != null ? `${price}€` : w.key === 'specific' ? 'unesi cijenu' : '—'}</span>
                    </button>
                  )
                })}
              </div>
            </div>
            {newWashType === 'specific' && (
              <div style={{ marginBottom: 14 }}>
                <label style={lbl}>Cijena (€)</label>
                <input type="number" step="0.01" value={newWashCustomPrice} onChange={e => setNewWashCustomPrice(e.target.value)} style={inp} />
              </div>
            )}
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Dodjeli perača *</label>
              {washPartners.length === 0 ? (
                <div style={{ background: '#FCEBEB', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#dc2626' }}>
                  Nema aktivnih perača. Dodaj perača u tab Perači.
                </div>
              ) : (
                <select value={selectedPartnerId} onChange={e => {
                  setSelectedPartnerId(e.target.value)
                  setWashPartner(washPartners.find(p => p.id === e.target.value) || null)
                }} style={inp}>
                  {washPartners.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              )}
            </div>
            <div style={{ marginBottom: 18 }}>
              <label style={lbl}>Napomena</label>
              <input value={newWashNotes} onChange={e => setNewWashNotes(e.target.value)} style={inp} placeholder="Opciono..." />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleNewWash} disabled={newWashSaving || !selectedVehicle || !newWashType} style={{ flex: 2, padding: '10px', background: (!selectedVehicle || !newWashType) ? '#9ca3af' : '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>{newWashSaving ? '...' : 'Kreiraj nalog'}</button>
              <button onClick={() => setShowNewWash(false)} style={{ flex: 1, padding: '10px', border: '1px solid #d1d5db', borderRadius: 8, background: 'transparent', fontSize: 13, cursor: 'pointer', color: '#374151' }}>Odustani</button>
            </div>
          </div>
        </div>
      )}

      {/* JA ĆU OPRATI MODAL */}
      {showSelfWash && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }} onClick={() => setShowSelfWash(false)}>
          <div style={{ background: '#fff', borderRadius: 12, padding: '24px', maxWidth: 420, width: '100%' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#111' }}>🧹 Ja ću oprati</div>
              <button onClick={() => setShowSelfWash(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9ca3af' }}>✕</button>
            </div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>Unesite iznos koji ste potrošili — upisaće se kao odliv u finansije.</div>
            {selfPresetVehicleName ? (
              <div style={{ background: '#f0fdf8', border: '1px solid #1D9E75', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 13, fontWeight: 600, color: '#085041' }}>🚗 {selfPresetVehicleName}</div>
            ) : (
              <div style={{ marginBottom: 14 }} onClick={e => e.stopPropagation()}>
                <label style={lbl}>Vozilo *</label>
                <VehicleSearch search={selfVehicleSearch} setSearch={setSelfVehicleSearch} selected={selfSelectedVehicle} setSelected={setSelfSelectedVehicle} dropdown={selfVehicleDropdown} setDropdown={setSelfVehicleDropdown} fleetVehicles={fleetVehicles} />
              </div>
            )}
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Koliko ste potrošili? (€) *</label>
              <input type="number" step="0.01" value={selfWashCost} onChange={e => setSelfWashCost(e.target.value)} placeholder="npr. 5" style={{ ...inp, fontSize: 18, fontWeight: 700 }} />
            </div>
            <div style={{ marginBottom: 18 }}>
              <label style={lbl}>Napomena (opciono)</label>
              <input value={selfWashNote} onChange={e => setSelfWashNote(e.target.value)} style={inp} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleSelfWash} disabled={selfWashSaving || (!selfSelectedVehicle && !selfPresetVehicleName) || !selfWashCost}
                style={{ flex: 2, padding: '12px', background: ((!selfSelectedVehicle && !selfPresetVehicleName) || !selfWashCost) ? '#9ca3af' : '#dc2626', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                {selfWashSaving ? '⏳...' : '✓ Potvrdi i upiši odliv'}
              </button>
              <button onClick={() => setShowSelfWash(false)} style={{ flex: 1, padding: '12px', border: '1px solid #d1d5db', borderRadius: 8, background: 'transparent', fontSize: 13, cursor: 'pointer', color: '#374151' }}>Odustani</button>
            </div>
          </div>
        </div>
      )}

      {/* ISPLATA MODAL */}
      {payoutOrder && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: '24px', maxWidth: 400, width: '100%' }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#111', marginBottom: 4 }}>Isplati praonici</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>{payoutOrder.vehicle_name} — {payoutOrder.wash_type_label}</div>
            <div style={{ marginBottom: 12 }}><label style={lbl}>Iznos (€)</label><input type="number" step="0.01" value={payoutAmount} onChange={e => setPayoutAmount(e.target.value)} style={inp} /></div>
            <div style={{ marginBottom: 18 }}><label style={lbl}>Napomena</label><input value={payoutNote} onChange={e => setPayoutNote(e.target.value)} style={inp} placeholder="Opciono..." /></div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={sendPayout} disabled={payoutSaving || !payoutAmount} style={{ flex: 2, padding: '10px', background: !payoutAmount ? '#9ca3af' : '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>{payoutSaving ? '...' : 'Pošalji isplatu'}</button>
              <button onClick={() => setPayoutOrder(null)} style={{ flex: 1, padding: '10px', border: '1px solid #d1d5db', borderRadius: 8, background: 'transparent', fontSize: 13, cursor: 'pointer', color: '#374151' }}>Odustani</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ═══ PERAČI TAB ═══
function PeraciTab() {
  const [peraci, setPeraci] = useState<WashPartner[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', phone: '', portal_email: '', email: '', is_active: true, price_quick: 5, price_detailed: 10, price_deep_quick: 40, price_deep_detailed: 80 })
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchPeraci() }, [])

  async function fetchPeraci() {
    setLoading(true)
    const { data } = await supabase.from('wash_partners').select('*').order('name')
    setPeraci(data || [])
    setLoading(false)
  }

  function openNew() { setEditId(null); setForm({ name: '', phone: '', portal_email: '', email: '', is_active: true, price_quick: 5, price_detailed: 10, price_deep_quick: 40, price_deep_detailed: 80 }); setShowForm(true) }
  function openEdit(p: WashPartner) { setEditId(p.id); setForm({ name: p.name, phone: p.phone || '', portal_email: p.portal_email || '', email: p.portal_email || '', is_active: p.is_active, price_quick: p.price_quick || 5, price_detailed: p.price_detailed || 10, price_deep_quick: p.price_deep_quick || 40, price_deep_detailed: p.price_deep_detailed || 80 }); setShowForm(true) }

  async function save() {
    if (!form.name.trim()) { alert('Unesite ime perača!'); return }
    setSaving(true)
    const payload = { ...form, email: form.portal_email }
    if (editId) await supabase.from('wash_partners').update(payload).eq('id', editId)
    else await supabase.from('wash_partners').insert(payload)
    setSaving(false); setShowForm(false); fetchPeraci()
  }

  async function toggleActive(id: string, current: boolean) {
    await supabase.from('wash_partners').update({ is_active: !current }).eq('id', id)
    fetchPeraci()
  }

  async function deletePerac(id: string, name: string) {
    if (!confirm(`Obrisati perača "${name}"?`)) return
    await supabase.from('wash_partners').delete().eq('id', id)
    fetchPeraci()
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Učitavanje...</div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>Registrovani perači ({peraci.length})</div>
        <button onClick={openNew} style={{ padding: '7px 14px', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>+ Novi perač</button>
      </div>

      <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
        {peraci.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#9ca3af' }}>Nema perača. Dodaj prvog.</div>
        ) : peraci.map((p, i) => (
          <div key={p.id} style={{ padding: '14px 16px', borderBottom: i < peraci.length - 1 ? '1px solid #f3f4f6' : 'none', background: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#111' }}>{p.name}</div>
                {p.phone && <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>📞 {p.phone}</div>}
                {p.portal_email && <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 1 }}>✉️ {p.portal_email}</div>}
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <button onClick={() => toggleActive(p.id, p.is_active)}
                  style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, border: 'none', cursor: 'pointer', fontWeight: 600, background: p.is_active ? '#E1F5EE' : '#f3f4f6', color: p.is_active ? '#085041' : '#9ca3af' }}>
                  {p.is_active ? 'Aktivan' : 'Neaktivan'}
                </button>
                <button onClick={() => openEdit(p)} style={{ padding: '5px 10px', fontSize: 11, border: '1px solid #e5e7eb', borderRadius: 7, background: '#fff', cursor: 'pointer', color: '#374151' }}>✏️</button>
                <button onClick={() => deletePerac(p.id, p.name)} style={{ padding: '5px 8px', fontSize: 11, border: '1px solid #fecaca', borderRadius: 7, background: '#fff', cursor: 'pointer', color: '#dc2626' }}>✕</button>
              </div>
            </div>
            {/* Cijene */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
              {[
                { label: 'Brzo', value: p.price_quick },
                { label: 'Detaljno', value: p.price_detailed },
                { label: 'Dub. brzo', value: p.price_deep_quick },
                { label: 'Dub. det.', value: p.price_deep_detailed },
              ].map(c => (
                <div key={c.label} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '6px 10px', textAlign: 'center' as const }}>
                  <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 2 }}>{c.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1D9E75' }}>{c.value || 0}€</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* FORMA MODAL */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: '24px', maxWidth: 420, width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#111' }}>{editId ? 'Uredi perača' : 'Novi perač'}</div>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9ca3af' }}>✕</button>
            </div>
            <div style={{ marginBottom: 12 }}><label style={lbl}>Ime perača *</label><input style={inp} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="npr. Autoperionica Centar" /></div>
            <div style={{ marginBottom: 12 }}><label style={lbl}>Telefon</label><input style={inp} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+382 67 123 456" /></div>
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Email za login na portal (Google)</label>
              <input style={inp} type="email" value={form.portal_email} onChange={e => setForm(f => ({ ...f, portal_email: e.target.value }))} placeholder="peraonica@gmail.com" />
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>Perač se loguje na /pranje/login sa ovim Google nalogom</div>
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 8 }}>Cijene po kategoriji (€)</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
              {[
                { key: 'price_quick', label: 'Brzo pranje' },
                { key: 'price_detailed', label: 'Detaljno pranje' },
                { key: 'price_deep_quick', label: 'Dubinsko brzo' },
                { key: 'price_deep_detailed', label: 'Dubinsko detaljno' },
              ].map(f => (
                <div key={f.key}>
                  <label style={lbl}>{f.label}</label>
                  <input type="number" step="0.01" style={inpSm} value={(form as any)[f.key]} onChange={e => setForm(prev => ({ ...prev, [f.key]: parseFloat(e.target.value) || 0 }))} />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <input type="checkbox" id="is_active" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} style={{ width: 16, height: 16, accentColor: '#1D9E75' }} />
              <label htmlFor="is_active" style={{ fontSize: 13, color: '#374151', cursor: 'pointer' }}>Aktivan perač</label>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={save} disabled={saving} style={{ flex: 2, padding: '10px', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>{saving ? '...' : '💾 Sačuvaj'}</button>
              <button onClick={() => setShowForm(false)} style={{ flex: 1, padding: '10px', border: '1px solid #d1d5db', borderRadius: 8, background: 'transparent', fontSize: 13, cursor: 'pointer', color: '#374151' }}>Odustani</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ═══ ISTORIJA TAB ═══
function IstorijaTab({ orders }: { orders: WashOrder[] }) {
  const [search, setSearch] = useState('')

  const vozila = Array.from(new Set(orders.map(o => o.vehicle_name).filter(Boolean))).sort()
  const filtered = search ? vozila.filter(v => v.toLowerCase().includes(search.toLowerCase())) : vozila

  const [selectedVozilo, setSelectedVozilo] = useState<string | null>(null)

  const voziloOrders = selectedVozilo
    ? orders.filter(o => o.vehicle_name === selectedVozilo).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    : []

  const ukupno = voziloOrders.filter(o => o.status === 'done').reduce((s, o) => s + (o.price || 0), 0)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16 }}>
      {/* Lista vozila */}
      <div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Pretraži vozilo..." style={{ ...inp, marginBottom: 10, fontSize: 13 }} />
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden', maxHeight: 600, overflowY: 'auto' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Nema vozila.</div>
          ) : filtered.map(v => {
            const count = orders.filter(o => o.vehicle_name === v && o.status === 'done').length
            return (
              <div key={v} onClick={() => setSelectedVozilo(v)}
                style={{ padding: '10px 14px', borderBottom: '1px solid #f3f4f6', cursor: 'pointer', background: selectedVozilo === v ? '#f0fdf8' : '#fff', borderLeft: selectedVozilo === v ? '3px solid #1D9E75' : '3px solid transparent' }}>
                <div style={{ fontSize: 13, fontWeight: selectedVozilo === v ? 700 : 500, color: '#111' }}>{v}</div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{count} pranja</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Istorija odabranog vozila */}
      <div>
        {!selectedVozilo ? (
          <div style={{ padding: 60, textAlign: 'center', color: '#9ca3af', border: '1px dashed #e5e7eb', borderRadius: 12 }}>
            Odaberite vozilo sa liste
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>{selectedVozilo}</div>
              <div style={{ fontSize: 13, background: '#E1F5EE', color: '#085041', padding: '4px 12px', borderRadius: 20, fontWeight: 700 }}>
                Ukupno plaćeno: {ukupno.toFixed(0)}€
              </div>
            </div>
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    {['Datum', 'Tip pranja', 'Izvršio', 'Status', 'Cijena'].map(h => (
                      <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 500, fontSize: 12, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {voziloOrders.map(o => {
                    const st = STATUS_LABELS[o.status] || STATUS_LABELS.pending
                    return (
                      <tr key={o.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '10px 14px', color: '#374151' }}>{new Date(o.created_at).toLocaleDateString('sr-RS')}</td>
                        <td style={{ padding: '10px 14px', color: '#374151' }}>{o.wash_type_label}</td>
                        <td style={{ padding: '10px 14px' }}>
                          {o.assigned_to === 'partner'
                            ? <span style={{ fontSize: 11, background: '#E6F1FB', color: '#0C447C', padding: '2px 8px', borderRadius: 20 }}>Praonica</span>
                            : <span style={{ fontSize: 11, background: '#E1F5EE', color: '#085041', padding: '2px 8px', borderRadius: 20 }}>{o.agent_name}</span>}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ fontSize: 11, background: st.bg, color: st.color, padding: '2px 8px', borderRadius: 20 }}>{st.label}</span>
                        </td>
                        <td style={{ padding: '10px 14px', fontWeight: 700, color: '#1D9E75' }}>{o.price}€</td>
                      </tr>
                    )
                  })}
                  {voziloOrders.length === 0 && <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>Nema historije.</td></tr>}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
