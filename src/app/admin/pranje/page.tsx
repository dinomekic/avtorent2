'use client'

import { useEffect, useState } from 'react'
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

const STATUS_LABELS: Record<string, { label: string; bg: string; color: string }> = {
  pending:     { label: 'Čeka pranje', bg: '#FAEEDA', color: '#633806' },
  in_progress: { label: 'U toku', bg: '#E6F1FB', color: '#0C447C' },
  done:        { label: 'Završeno', bg: '#E1F5EE', color: '#085041' },
}

function getCookie(name: string): string {
  if (typeof document === 'undefined') return ''
  const match = document.cookie.match(new RegExp(`${name}=([^;]+)`))
  return match ? decodeURIComponent(match[1]) : ''
}

export default function AdminPranjePage() {
  const [orders, setOrders] = useState<WashOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'in_progress' | 'done'>('all')
  const [payoutOrder, setPayoutOrder] = useState<WashOrder | null>(null)
  const [payoutAmount, setPayoutAmount] = useState('')
  const [payoutNote, setPayoutNote] = useState('')
  const [payoutSaving, setPayoutSaving] = useState(false)
  const [washPartner, setWashPartner] = useState<any>(null)
  const agentName = getCookie('avtorent-agent-name')
  const [showNewWash, setShowNewWash] = useState(false)
  const [newWashVehicle, setNewWashVehicle] = useState('')
  const [newWashType, setNewWashType] = useState('')
  const [newWashAssignedTo, setNewWashAssignedTo] = useState<'partner' | 'agent'>('partner')
  const [newWashCustomPrice, setNewWashCustomPrice] = useState('')
  const [newWashNotes, setNewWashNotes] = useState('')
  const [newWashSaving, setNewWashSaving] = useState(false)
  const [vehicles, setVehicles] = useState<{id: string; name: string}[]>([])

  const WASH_TYPES = [
    { key: 'quick', label: 'Brzo pranje', price: 5 },
    { key: 'detailed', label: 'Detaljno pranje', price: 10 },
    { key: 'deep_quick', label: 'Dubinsko brzo', price: 40 },
    { key: 'deep_detailed', label: 'Dubinsko detaljno', price: 80 },
    { key: 'specific', label: 'Specifično pranje', price: 0 },
  ]

  useEffect(() => {
    fetchData()
    supabase.from('wash_partners').select('*').eq('is_active', true).single().then(({ data }) => setWashPartner(data))
    supabase.from('vehicles').select('id, name').eq('is_available', true).order('name').then(({ data }) => setVehicles(data || []))
  }, [])

  async function fetchData() {
    const { data } = await supabase.from('wash_orders')
      .select('*, reservations(ref_code, guest_name)')
      .order('created_at', { ascending: false })
    setOrders(data || [])
    setLoading(false)
  }

  async function handleNewWash() {
    if (!newWashVehicle || !newWashType) return
    setNewWashSaving(true)
    const wt = WASH_TYPES.find(w => w.key === newWashType)
    const price = newWashType === 'specific' ? parseFloat(newWashCustomPrice || '0') : (wt?.price || 0)
    await supabase.from('wash_orders').insert({
      reservation_id: null,
      vehicle_name: newWashVehicle,
      wash_type: newWashType,
      wash_type_label: wt?.label || newWashType,
      price,
      status: 'pending',
      assigned_to: newWashAssignedTo,
      agent_name: newWashAssignedTo === 'agent' ? (agentName || 'Agent') : null,
      wash_partner_id: newWashAssignedTo === 'partner' ? washPartner?.id : null,
      notes: newWashNotes || null,
      payout_status: newWashAssignedTo === 'partner' ? 'unpaid' : null,
      payout_amount: newWashAssignedTo === 'partner' ? price : null,
    })
    setNewWashSaving(false)
    setShowNewWash(false)
    setNewWashVehicle(''); setNewWashType(''); setNewWashCustomPrice(''); setNewWashNotes('')
    fetchData()
  }

  async function sendPayout() {
    if (!payoutOrder || !payoutAmount || !washPartner) return
    setPayoutSaving(true)

    // Zaduži agenta (odliv)
    await supabase.from('agent_transactions').insert({
      agent_name: agentName || 'Agent',
      type: 'expense',
      category: 'Isplata praonice',
      amount: parseFloat(payoutAmount),
      comment: payoutNote || `Pranje: ${payoutOrder.vehicle_name}`,
      counterpart_agent: washPartner.id,
      transfer_status: 'pending',
    })

    // Ažuriraj wash order
    await supabase.from('wash_orders').update({
      payout_status: 'pending',
      payout_amount: parseFloat(payoutAmount),
    }).eq('id', payoutOrder.id)

    setPayoutSaving(false)
    setPayoutOrder(null)
    setPayoutAmount('')
    setPayoutNote('')
    fetchData()
  }

  const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter)
  const pending = orders.filter(o => o.status === 'pending').length
  const inProgress = orders.filter(o => o.status === 'in_progress').length
  const done = orders.filter(o => o.status === 'done').length
  const unpaid = orders.filter(o => o.status === 'done' && o.payout_status === 'unpaid').length
  const totalCost = orders.filter(o => o.status === 'done').reduce((s, o) => s + (o.price || 0), 0)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#111' }}>Pranje vozila</h1>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>Evidencija i isplate praonici</p>
        </div>
        <button onClick={() => setShowNewWash(true)}
          style={{ padding: '8px 16px', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          + Novo pranje
        </button>
        {washPartner && (
          <div style={{ fontSize: 13, color: '#6b7280', background: '#f9fafb', padding: '6px 14px', borderRadius: 8, border: '1px solid #e5e7eb' }}>
            Praonica: <strong style={{ color: '#111' }}>{washPartner.name}</strong>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0,1fr))', gap: 12, marginBottom: 20 }}>
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

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[['all', 'Svi'], ['pending', 'Na čekanju'], ['in_progress', 'U toku'], ['done', 'Završeno']].map(([val, lbl]) => (
          <button key={val} onClick={() => setFilter(val as any)}
            style={{ padding: '5px 14px', fontSize: 12, borderRadius: 20, border: '1px solid', borderColor: filter === val ? '#1D9E75' : '#e5e7eb', background: filter === val ? '#E1F5EE' : '#fff', color: filter === val ? '#085041' : '#6b7280', cursor: 'pointer', fontWeight: filter === val ? 600 : 400 }}>
            {lbl}
          </button>
        ))}
      </div>

      <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
        {loading ? <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Učitavanje...</div> : (
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
                      {o.assigned_to === 'agent'
                        ? <span style={{ fontSize: 11, background: '#E1F5EE', color: '#085041', padding: '2px 8px', borderRadius: 20 }}>Agent: {o.agent_name}</span>
                        : <span style={{ fontSize: 11, background: '#E6F1FB', color: '#0C447C', padding: '2px 8px', borderRadius: 20 }}>Praoница</span>
                      }
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: 11, background: st.bg, color: st.color, padding: '2px 8px', borderRadius: 20, fontWeight: 500 }}>{st.label}</span>
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: '#1D9E75' }}>{o.price}€</td>
                    <td style={{ padding: '12px 16px' }}>
                      {o.assigned_to === 'partner' ? (
                        o.payout_status === 'unpaid'
                          ? <span style={{ fontSize: 11, background: '#FCEBEB', color: '#791F1F', padding: '2px 8px', borderRadius: 20 }}>Neplaćeno</span>
                          : o.payout_status === 'pending'
                          ? <span style={{ fontSize: 11, background: '#FAEEDA', color: '#633806', padding: '2px 8px', borderRadius: 20 }}>Čeka potvrdu</span>
                          : <span style={{ fontSize: 11, background: '#E1F5EE', color: '#085041', padding: '2px 8px', borderRadius: 20 }}>Plaćeno</span>
                      ) : <span style={{ fontSize: 11, color: '#9ca3af' }}>—</span>}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {o.assigned_to === 'partner' && o.status === 'done' && o.payout_status === 'unpaid' && (
                        <button onClick={() => { setPayoutOrder(o); setPayoutAmount(String(o.price)); setPayoutNote('') }}
                          style={{ padding: '4px 12px', fontSize: 11, border: '1px solid #1D9E75', borderRadius: 6, background: '#E1F5EE', cursor: 'pointer', color: '#085041', fontWeight: 500 }}>
                          Isplati
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Nema naloga za pranje.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* New wash modal */}
      {showNewWash && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: '24px', maxWidth: 460, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#111' }}>Novo pranje — bez rezervacije</div>
              <button onClick={() => setShowNewWash(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9ca3af' }}>✕</button>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Vozilo *</label>
              <select value={newWashVehicle} onChange={e => setNewWashVehicle(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', color: '#111' }}>
                <option value="">-- Odaberi vozilo --</option>
                {vehicles.map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Tip pranja *</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {WASH_TYPES.map(w => (
                  <button key={w.key} onClick={() => setNewWashType(w.key)}
                    style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 14px', border: `1px solid ${newWashType === w.key ? '#1D9E75' : '#e5e7eb'}`, borderRadius: 8, background: newWashType === w.key ? '#E1F5EE' : '#fff', cursor: 'pointer', fontSize: 13, color: newWashType === w.key ? '#085041' : '#374151', fontWeight: newWashType === w.key ? 600 : 400, textAlign: 'left' as const }}>
                    <span>{w.label}</span>
                    <span style={{ color: newWashType === w.key ? '#1D9E75' : '#9ca3af', fontWeight: 600 }}>{w.price > 0 ? `${w.price}€` : 'unesi cijenu'}</span>
                  </button>
                ))}
              </div>
            </div>
            {newWashType === 'specific' && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Cijena (€)</label>
                <input type="number" step="0.01" value={newWashCustomPrice} onChange={e => setNewWashCustomPrice(e.target.value)} placeholder="0.00"
                  style={{ width: '100%', padding: '9px 12px', fontSize: 14, border: '1px solid #d1d5db', borderRadius: 8, color: '#111', boxSizing: 'border-box' as const }} />
              </div>
            )}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Ko pere?</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setNewWashAssignedTo('partner')} style={{ flex: 1, padding: '9px', border: `1px solid ${newWashAssignedTo === 'partner' ? '#1D9E75' : '#e5e7eb'}`, borderRadius: 8, background: newWashAssignedTo === 'partner' ? '#E1F5EE' : '#fff', cursor: 'pointer', fontSize: 13, fontWeight: newWashAssignedTo === 'partner' ? 600 : 400, color: newWashAssignedTo === 'partner' ? '#085041' : '#374151' }}>Praonica</button>
                <button onClick={() => setNewWashAssignedTo('agent')} style={{ flex: 1, padding: '9px', border: `1px solid ${newWashAssignedTo === 'agent' ? '#1D9E75' : '#e5e7eb'}`, borderRadius: 8, background: newWashAssignedTo === 'agent' ? '#E1F5EE' : '#fff', cursor: 'pointer', fontSize: 13, fontWeight: newWashAssignedTo === 'agent' ? 600 : 400, color: newWashAssignedTo === 'agent' ? '#085041' : '#374151' }}>Agent sam</button>
              </div>
            </div>
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Napomena</label>
              <input value={newWashNotes} onChange={e => setNewWashNotes(e.target.value)} placeholder="Opciono..."
                style={{ width: '100%', padding: '9px 12px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, color: '#111', boxSizing: 'border-box' as const }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleNewWash} disabled={newWashSaving || !newWashVehicle || !newWashType || (newWashType === 'specific' && !newWashCustomPrice)}
                style={{ flex: 2, padding: '10px', background: !newWashVehicle || !newWashType ? '#9ca3af' : '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                {newWashSaving ? '...' : 'Kreiraj nalog za pranje'}
              </button>
              <button onClick={() => setShowNewWash(false)} style={{ flex: 1, padding: '10px', border: '1px solid #d1d5db', borderRadius: 8, background: 'transparent', fontSize: 13, cursor: 'pointer', color: '#374151' }}>
                Odustani
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payout modal */}
      {payoutOrder && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: '24px', maxWidth: 400, width: '100%' }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#111', marginBottom: 4 }}>Isplati praonici</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>{payoutOrder.vehicle_name} — {payoutOrder.wash_type_label}</div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Iznos (€)</label>
              <input type="number" step="0.01" value={payoutAmount} onChange={e => setPayoutAmount(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', fontSize: 14, border: '1px solid #d1d5db', borderRadius: 8, color: '#111', boxSizing: 'border-box' as const }} />
            </div>
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Napomena</label>
              <input value={payoutNote} onChange={e => setPayoutNote(e.target.value)} placeholder="Opciono..."
                style={{ width: '100%', padding: '9px 12px', fontSize: 14, border: '1px solid #d1d5db', borderRadius: 8, color: '#111', boxSizing: 'border-box' as const }} />
            </div>
            <div style={{ background: '#E6F1FB', borderRadius: 8, padding: '10px 12px', marginBottom: 16, fontSize: 12, color: '#0C447C' }}>
              Praonici će stići obavještenje da potvrdi prijem novca.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={sendPayout} disabled={payoutSaving || !payoutAmount}
                style={{ flex: 2, padding: '10px', background: !payoutAmount ? '#9ca3af' : '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                {payoutSaving ? '...' : 'Pošalji isplatu'}
              </button>
              <button onClick={() => setPayoutOrder(null)} style={{ flex: 1, padding: '10px', border: '1px solid #d1d5db', borderRadius: 8, background: 'transparent', fontSize: 13, cursor: 'pointer', color: '#374151' }}>
                Odustani
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
