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
  notes: string | null; created_at: string; started_at: string | null
  completed_at: string | null; payout_status: string; payout_amount: number | null
  reservations?: { ref_code: string; guest_name: string } | null
}

type Payout = { id: string; amount: number; status: string; created_at: string }

function getCookie(name: string): string {
  if (typeof document === 'undefined') return ''
  const match = document.cookie.match(new RegExp(`${name}=([^;]+)`))
  return match ? decodeURIComponent(match[1]) : ''
}

const STATUS_LABELS: Record<string, { label: string; bg: string; color: string }> = {
  pending:     { label: 'Čeka pranje', bg: '#FAEEDA', color: '#633806' },
  in_progress: { label: 'U toku', bg: '#E6F1FB', color: '#0C447C' },
  done:        { label: 'Završeno', bg: '#E1F5EE', color: '#085041' },
}

export default function PranjePortalPage() {
  const [orders, setOrders] = useState<WashOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [washName, setWashName] = useState('')
  const [washId, setWashId] = useState('')
  const [filter, setFilter] = useState<'pending' | 'in_progress' | 'done' | 'all'>('pending')
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [activeTab, setActiveTab] = useState<'orders' | 'payouts'>('orders')
  const [updating, setUpdating] = useState<string | null>(null)

  useEffect(() => {
    const name = getCookie('avtorent-wash-name')
    const id = getCookie('avtorent-wash-id')
    if (!id) { window.location.href = '/pranje/login'; return }
    setWashName(name); setWashId(id)
    fetchData(id)
  }, [])

  async function fetchData(id: string) {
    const [{ data: ord }, { data: pay }] = await Promise.all([
      supabase.from('wash_orders').select('*, reservations(ref_code, guest_name)')
        .eq('wash_partner_id', id).eq('assigned_to', 'partner')
        .order('created_at', { ascending: false }),
      supabase.from('agent_transactions').select('*')
        .eq('category', 'Isplata praonice').eq('counterpart_agent', id)
        .order('created_at', { ascending: false }),
    ])
    setOrders(ord || [])
    setPayouts(pay || [])
    setLoading(false)
  }

  async function updateStatus(orderId: string, newStatus: string) {
    setUpdating(orderId)
    const update: any = { status: newStatus }
    if (newStatus === 'in_progress') update.started_at = new Date().toISOString()
    if (newStatus === 'done') update.completed_at = new Date().toISOString()
    await supabase.from('wash_orders').update(update).eq('id', orderId)
    fetchData(washId)
    setUpdating(null)
  }

  async function confirmPayout(payoutId: string) {
    await supabase.from('agent_transactions').update({ transfer_status: 'accepted' }).eq('id', payoutId)
    fetchData(washId)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    document.cookie = 'avtorent-wash-token=; path=/; max-age=0'
    document.cookie = 'avtorent-wash-id=; path=/; max-age=0'
    document.cookie = 'avtorent-wash-name=; path=/; max-age=0'
    window.location.href = '/pranje/login'
  }

  const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter)
  const pending = orders.filter(o => o.status === 'pending').length
  const inProgress = orders.filter(o => o.status === 'in_progress').length
  const done = orders.filter(o => o.status === 'done').length
  const totalEarned = orders.filter(o => o.status === 'done').reduce((s, o) => s + (o.price || 0), 0)
  const pendingPayouts = payouts.filter(p => (p as any).transfer_status === 'pending' || (p as any).transfer_status === undefined)

  const tabStyle = (tab: string) => ({
    padding: '8px 18px', fontSize: 13, border: 'none',
    background: activeTab === tab ? '#1D9E75' : 'transparent',
    color: activeTab === tab ? '#fff' : '#6b7280',
    cursor: 'pointer', borderRadius: 8, fontWeight: activeTab === tab ? 600 : 400,
  })

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb' }}>
      <nav style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>🚗💦</span>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#111' }}>Portal Praonice</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>{washName}</span>
          <button onClick={handleLogout} style={{ background: 'none', border: 'none', fontSize: 12, color: '#9ca3af', cursor: 'pointer', textDecoration: 'underline' }}>Odjavi se</button>
        </div>
      </nav>

      <main style={{ maxWidth: 900, margin: '0 auto', padding: '28px 16px' }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, background: '#f3f4f6', borderRadius: 10, padding: 4, marginBottom: 24, width: 'fit-content' }}>
          <button style={tabStyle('orders')} onClick={() => setActiveTab('orders')}>Nalozi za pranje</button>
          <button style={tabStyle('payouts')} onClick={() => setActiveTab('payouts')}>
            Isplate {pendingPayouts.length > 0 && <span style={{ background: '#EF9F27', color: '#fff', borderRadius: 20, padding: '1px 6px', fontSize: 11, marginLeft: 4 }}>{pendingPayouts.length}</span>}
          </button>
        </div>

        {activeTab === 'orders' && (
          <>
            {/* Metrike */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 12, marginBottom: 20 }}>
              {[
                { label: 'Na čekanju', value: pending, color: '#BA7517', bg: '#FAEEDA' },
                { label: 'U toku', value: inProgress, color: '#185FA5', bg: '#E6F1FB' },
                { label: 'Završeno', value: done, color: '#1D9E75', bg: '#E1F5EE' },
                { label: 'Ukupno zarađeno', value: `${totalEarned}€`, color: '#111', bg: '#f3f4f6' },
              ].map(m => (
                <div key={m.label} style={{ background: m.bg, borderRadius: 10, padding: '14px' }}>
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{m.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: m.color }}>{m.value}</div>
                </div>
              ))}
            </div>

            {/* Filter */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {[['pending', 'Na čekanju'], ['in_progress', 'U toku'], ['done', 'Završeno'], ['all', 'Svi']].map(([val, lbl]) => (
                <button key={val} onClick={() => setFilter(val as any)}
                  style={{ padding: '5px 14px', fontSize: 12, borderRadius: 20, border: '1px solid', borderColor: filter === val ? '#1D9E75' : '#e5e7eb', background: filter === val ? '#E1F5EE' : '#fff', color: filter === val ? '#085041' : '#6b7280', cursor: 'pointer', fontWeight: filter === val ? 600 : 400 }}>
                  {lbl}
                </button>
              ))}
            </div>

            {/* Lista naloga */}
            {loading ? <div style={{ textAlign: 'center', padding: 32, color: '#9ca3af' }}>Učitavanje...</div> : filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 48, border: '1px dashed #e5e7eb', borderRadius: 12, color: '#9ca3af' }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>💦</div>
                <div>Nema naloga za pranje</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {filtered.map(o => {
                  const st = STATUS_LABELS[o.status] || STATUS_LABELS.pending
                  return (
                    <div key={o.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '16px 20px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                        <div>
                          <div style={{ fontSize: 16, fontWeight: 600, color: '#111', marginBottom: 2 }}>{o.vehicle_name}</div>
                          <div style={{ fontSize: 13, color: '#6b7280' }}>{o.wash_type_label} · <strong style={{ color: '#1D9E75' }}>{o.price}€</strong></div>
                          {o.reservations && (
                            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{o.reservations.ref_code} — {o.reservations.guest_name}</div>
                          )}
                          {o.notes && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4, fontStyle: 'italic' }}>{o.notes}</div>}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: 12, background: st.bg, color: st.color, padding: '3px 10px', borderRadius: 20, fontWeight: 500 }}>{st.label}</span>
                          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>{new Date(o.created_at).toLocaleDateString('sr-RS')}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        {o.status === 'pending' && (
                          <button onClick={() => updateStatus(o.id, 'in_progress')} disabled={updating === o.id}
                            style={{ padding: '7px 16px', background: '#185FA5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                            {updating === o.id ? '...' : 'Preuzmi na pranje'}
                          </button>
                        )}
                        {o.status === 'in_progress' && (
                          <button onClick={() => updateStatus(o.id, 'done')} disabled={updating === o.id}
                            style={{ padding: '7px 16px', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                            {updating === o.id ? '...' : '✓ Pranje završeno'}
                          </button>
                        )}
                        {o.status === 'done' && (
                          <span style={{ fontSize: 12, color: '#1D9E75', fontWeight: 500 }}>✓ Završeno {o.completed_at ? new Date(o.completed_at).toLocaleTimeString('sr-RS', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {activeTab === 'payouts' && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: '#111', marginBottom: 20 }}>Isplate</h2>
            {pendingPayouts.length > 0 && (
              <div style={{ background: '#FAEEDA', border: '1px solid #EF9F27', borderRadius: 12, padding: '16px 20px', marginBottom: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#633806', marginBottom: 12 }}>Čeka potvrdu prijema</div>
                {pendingPayouts.map((p: any) => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', borderRadius: 8, padding: '10px 14px', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#1D9E75' }}>{p.amount?.toFixed(2)}€</div>
                      {p.comment && <div style={{ fontSize: 12, color: '#9ca3af' }}>{p.comment}</div>}
                    </div>
                    <button onClick={() => confirmPayout(p.id)}
                      style={{ padding: '6px 14px', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      Potvrdi prijem
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {payouts.filter((p: any) => p.transfer_status === 'accepted').map((p: any) => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 13 }}>
                  <div>
                    <span style={{ fontWeight: 600, color: '#1D9E75' }}>{p.amount?.toFixed(2)}€</span>
                    {p.comment && <span style={{ color: '#9ca3af', marginLeft: 8 }}>{p.comment}</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: '#9ca3af' }}>{new Date(p.created_at).toLocaleDateString('sr-RS')}</span>
                    <span style={{ fontSize: 11, background: '#E1F5EE', color: '#085041', padding: '2px 8px', borderRadius: 20 }}>Potvrđeno</span>
                  </div>
                </div>
              ))}
              {payouts.length === 0 && <div style={{ textAlign: 'center', padding: 32, color: '#9ca3af', fontSize: 13 }}>Nema isplata</div>}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
