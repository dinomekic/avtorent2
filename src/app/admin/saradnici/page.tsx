'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Collaborator = {
  id: string; full_name: string; email: string; phone: string
  portal_email: string; commission_per_partner: number
  commission_per_reservation_percent: number; is_active: boolean; notes: string
  partner_count?: number; reservation_count?: number; total_commission?: number
  paid_commission?: number
}

type Payout = { id: string; amount: number; note: string; status: string; created_at: string }

const emptyForm = { full_name: '', email: '', phone: '', portal_email: '', commission_per_partner: '20', commission_per_reservation_percent: '2', notes: '' }

export default function AdminSaradniciPage() {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editCollab, setEditCollab] = useState<Collaborator | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [selectedCollab, setSelectedCollab] = useState<Collaborator | null>(null)
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [payoutAmount, setPayoutAmount] = useState('')
  const [payoutNote, setPayoutNote] = useState('')
  const [payoutSaving, setPayoutSaving] = useState(false)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const { data: collabs } = await supabase.from('collaborators').select('*').order('created_at', { ascending: false })
    const { data: partners } = await supabase.from('partners').select('acquired_by_collaborator_id, id').not('acquired_by_collaborator_id', 'is', null)
    const { data: reservations } = await supabase.from('reservations').select('partner_id, total_price, commission_amount').neq('status', 'cancelled')
    const { data: payoutsData } = await supabase.from('collaborator_payouts').select('collaborator_id, amount, status')

    const enriched = (collabs || []).map(c => {
      const myPartners = (partners || []).filter(p => p.acquired_by_collaborator_id === c.id)
      const myPartnerIds = myPartners.map(p => p.id)
      const myReservations = (reservations || []).filter(r => myPartnerIds.includes(r.partner_id))
      const totalRevenue = myReservations.reduce((s: number, r: any) => s + (r.total_price || 0), 0)
      const commissionFromPartners = myPartners.length * c.commission_per_partner
      const commissionFromRes = totalRevenue * (c.commission_per_reservation_percent / 100)
      const totalCommission = commissionFromPartners + commissionFromRes
      const paidCommission = (payoutsData || []).filter((p: any) => p.collaborator_id === c.id && p.status === 'confirmed').reduce((s: number, p: any) => s + p.amount, 0)
      return { ...c, partner_count: myPartners.length, reservation_count: myReservations.length, total_commission: totalCommission, paid_commission: paidCommission }
    })

    setCollaborators(enriched)
    setLoading(false)
  }

  async function fetchPayouts(collabId: string) {
    const { data } = await supabase.from('collaborator_payouts').select('*').eq('collaborator_id', collabId).order('created_at', { ascending: false })
    setPayouts(data || [])
  }

  function openEdit(c: Collaborator) {
    setEditCollab(c)
    setForm({ full_name: c.full_name, email: c.email || '', phone: c.phone || '', portal_email: c.portal_email || '', commission_per_partner: String(c.commission_per_partner), commission_per_reservation_percent: String(c.commission_per_reservation_percent), notes: c.notes || '' })
    setShowForm(true)
    setSelectedCollab(null)
  }

  async function saveCollab() {
    if (!form.full_name) return
    setSaving(true)
    const payload = { full_name: form.full_name, email: form.email, phone: form.phone, portal_email: form.portal_email, commission_per_partner: parseFloat(form.commission_per_partner), commission_per_reservation_percent: parseFloat(form.commission_per_reservation_percent), notes: form.notes, is_active: true }
    if (editCollab) {
      await supabase.from('collaborators').update(payload).eq('id', editCollab.id)
    } else {
      await supabase.from('collaborators').insert(payload)
    }
    setSaving(false); setShowForm(false); fetchData()
  }

  async function sendPayout() {
    if (!selectedCollab || !payoutAmount) return
    setPayoutSaving(true)
    await supabase.from('collaborator_payouts').insert({ collaborator_id: selectedCollab.id, amount: parseFloat(payoutAmount), note: payoutNote, status: 'pending' })
    setPayoutAmount(''); setPayoutNote('')
    setPayoutSaving(false)
    fetchPayouts(selectedCollab.id)
    fetchData()
  }

  const inp = { width: '100%', padding: '8px 12px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', color: '#111' }
  const lbl = { fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#111' }}>Saradnici</h1>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>Eksterni saradnici koji razvijaju partnersku mrežu</p>
        </div>
        <button onClick={() => { setEditCollab(null); setForm(emptyForm); setShowForm(true); setSelectedCollab(null) }}
          style={{ padding: '8px 16px', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          + Dodaj saradnika
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: (showForm || selectedCollab) ? '1fr 340px' : '1fr', gap: 16 }}>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
          {loading ? <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Učitavanje...</div> : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {['Saradnik', 'Portal', 'Partneri', 'Rezervacije', 'Provizija', 'Preostalo', ''].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 500, fontSize: 12, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {collaborators.map(c => {
                  const remaining = (c.total_commission || 0) - (c.paid_commission || 0)
                  return (
                    <tr key={c.id} style={{ borderBottom: '1px solid #f3f4f6', background: selectedCollab?.id === c.id ? '#f0fdf8' : 'transparent' }}>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: 500, color: '#111' }}>{c.full_name}</div>
                        <div style={{ fontSize: 11, color: '#9ca3af' }}>{c.email}{c.phone && ` · ${c.phone}`}</div>
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: 11, color: '#1D9E75' }}>{c.portal_email || '—'}</td>
                      <td style={{ padding: '12px 14px', color: '#374151' }}>{c.partner_count}</td>
                      <td style={{ padding: '12px 14px', color: '#374151' }}>{c.reservation_count}</td>
                      <td style={{ padding: '12px 14px', fontWeight: 600, color: '#1D9E75' }}>{c.total_commission?.toFixed(2)}€</td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ fontWeight: 600, color: remaining > 0 ? '#BA7517' : '#9ca3af' }}>{remaining.toFixed(2)}€</span>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => openEdit(c)} style={{ padding: '4px 8px', fontSize: 11, border: '1px solid #d1d5db', borderRadius: 6, background: 'transparent', cursor: 'pointer', color: '#6b7280' }}>Uredi</button>
                          <button onClick={() => { setSelectedCollab(c); setShowForm(false); fetchPayouts(c.id) }} style={{ padding: '4px 8px', fontSize: 11, border: '1px solid #5DCAA5', borderRadius: 6, background: 'transparent', cursor: 'pointer', color: '#0F6E56' }}>Isplata</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {collaborators.length === 0 && (
                  <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Nema saradnika.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Forma */}
        {showForm && (
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 20, background: '#fff', alignSelf: 'start' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#111' }}>{editCollab ? 'Uredi saradnika' : 'Novi saradnik'}</div>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#9ca3af' }}>✕</button>
            </div>
            {[{ label: 'Ime i prezime *', key: 'full_name', ph: 'Marko Petrović' }, { label: 'Email', key: 'email', ph: 'marko@email.com' }, { label: 'Telefon', key: 'phone', ph: '+382 67...' }, { label: 'Portal email (Google login)', key: 'portal_email', ph: 'marko@gmail.com' }].map(f => (
              <div key={f.key} style={{ marginBottom: 12 }}>
                <label style={lbl}>{f.label}</label>
                <input style={inp} value={(form as any)[f.key]} onChange={e => setForm(fm => ({ ...fm, [f.key]: e.target.value }))} placeholder={f.ph} />
              </div>
            ))}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div>
                <label style={lbl}>Provizija po partneru (€)</label>
                <input style={inp} type="number" value={form.commission_per_partner} onChange={e => setForm(fm => ({ ...fm, commission_per_partner: e.target.value }))} />
              </div>
              <div>
                <label style={lbl}>Provizija po rezervaciji (%)</label>
                <input style={inp} type="number" step="0.1" value={form.commission_per_reservation_percent} onChange={e => setForm(fm => ({ ...fm, commission_per_reservation_percent: e.target.value }))} />
              </div>
            </div>
            <div style={{ marginBottom: 18 }}>
              <label style={lbl}>Napomena</label>
              <textarea value={form.notes} onChange={e => setForm(fm => ({ ...fm, notes: e.target.value }))} style={{ ...inp, minHeight: 60, resize: 'vertical' as const }} />
            </div>
            <div style={{ background: '#E6F1FB', border: '1px solid #85B7EB', borderRadius: 8, padding: '10px 12px', marginBottom: 16, fontSize: 12, color: '#0C447C' }}>
              Saradnik se prijavljuje na <strong>/saradnik/login</strong> sa Google nalogom koji odgovara "Portal email".
            </div>
            <button onClick={saveCollab} disabled={saving || !form.full_name} style={{ width: '100%', padding: 10, background: saving ? '#5DCAA5' : '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              {saving ? 'Snimanje...' : editCollab ? 'Sačuvaj' : 'Dodaj saradnika'}
            </button>
          </div>
        )}

        {/* Isplate panel */}
        {selectedCollab && !showForm && (
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 20, background: '#fff', alignSelf: 'start' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#111' }}>Isplate — {selectedCollab.full_name}</div>
              <button onClick={() => setSelectedCollab(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#9ca3af' }}>✕</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
              <div style={{ background: '#f9fafb', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ fontSize: 11, color: '#9ca3af' }}>Ukupno zarađeno</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#1D9E75' }}>{selectedCollab.total_commission?.toFixed(2)}€</div>
              </div>
              <div style={{ background: '#FAEEDA', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ fontSize: 11, color: '#9ca3af' }}>Preostalo</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#BA7517' }}>{((selectedCollab.total_commission || 0) - (selectedCollab.paid_commission || 0)).toFixed(2)}€</div>
              </div>
            </div>
            <div style={{ background: '#f9fafb', borderRadius: 8, padding: 14, marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: '#111' }}>Nova isplata</div>
              <div style={{ marginBottom: 8 }}>
                <label style={lbl}>Iznos (€)</label>
                <input style={inp} type="number" step="0.01" value={payoutAmount} onChange={e => setPayoutAmount(e.target.value)} />
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={lbl}>Napomena</label>
                <input style={inp} value={payoutNote} onChange={e => setPayoutNote(e.target.value)} placeholder="Isplata za maj..." />
              </div>
              <button onClick={sendPayout} disabled={payoutSaving || !payoutAmount} style={{ width: '100%', padding: '9px', background: !payoutAmount ? '#9ca3af' : '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                {payoutSaving ? '...' : 'Pošalji zahtjev'}
              </button>
            </div>
            {payouts.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {payouts.map(p => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', background: '#f9fafb', borderRadius: 8, fontSize: 12 }}>
                    <span style={{ fontWeight: 600, color: '#1D9E75' }}>{p.amount.toFixed(2)}€</span>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: p.status === 'confirmed' ? '#E1F5EE' : '#FAEEDA', color: p.status === 'confirmed' ? '#085041' : '#633806' }}>
                      {p.status === 'confirmed' ? 'Potvrđeno' : 'Čeka'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
