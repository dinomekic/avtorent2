'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Partner = {
  id: string; name: string; qr_code: string; city: string; country: string
  is_active: boolean; is_draft: boolean; created_at: string
  client_discount_percent: number; commission_percent: number
  reservation_count?: number; total_revenue?: number
}

type Collaborator = {
  id: string; full_name: string; commission_per_partner: number
  commission_per_reservation_percent: number
}

type Payout = {
  id: string; amount: number; note: string; status: string; created_at: string
}

function getCookie(name: string): string {
  if (typeof document === 'undefined') return ''
  const match = document.cookie.match(new RegExp(`${name}=([^;]+)`))
  return match ? decodeURIComponent(match[1]) : ''
}

export default function SaradnikPortalPage() {
  const [collabId, setCollabId] = useState('')
  const [collabName, setCollabName] = useState('')
  const [collab, setCollab] = useState<Collaborator | null>(null)
  const [partners, setPartners] = useState<Partner[]>([])
  const [draftPartners, setDraftPartners] = useState<Partner[]>([])
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'partners' | 'activate' | 'payouts'>('overview')
  const [activatingPartner, setActivatingPartner] = useState<Partner | null>(null)
  const [activateForm, setActivateForm] = useState({ name: '', contact_name: '', email: '', portal_email: '', phone: '', city: '', country: 'Crna Gora', google_maps_url: '' })
  const [activateSaving, setActivateSaving] = useState(false)
  const [confirming, setConfirming] = useState<string | null>(null)

  useEffect(() => {
    const id = getCookie('avtorent-collab-id')
    const name = getCookie('avtorent-collab-name')
    if (!id) { window.location.href = '/saradnik/login'; return }
    setCollabId(id)
    setCollabName(name)
    fetchData(id)
  }, [])

  async function fetchData(id: string) {
    const [{ data: collabData }, { data: myPartners }, { data: drafts }, { data: payoutsData }] = await Promise.all([
      supabase.from('collaborators').select('*').eq('id', id).single(),
      supabase.from('partners').select('*').eq('acquired_by_collaborator_id', id).order('created_at', { ascending: false }),
      supabase.from('partners').select('*').eq('is_draft', true).order('qr_code'),
      supabase.from('collaborator_payouts').select('*').eq('collaborator_id', id).order('created_at', { ascending: false }),
    ])

    // Dohvati rezervacije za partnere
    const partnerIds = (myPartners || []).map(p => p.id)
    let enrichedPartners = myPartners || []
    if (partnerIds.length > 0) {
      const { data: res } = await supabase.from('reservations').select('partner_id, total_price').in('partner_id', partnerIds).neq('status', 'cancelled')
      enrichedPartners = enrichedPartners.map(p => ({
        ...p,
        reservation_count: (res || []).filter(r => r.partner_id === p.id).length,
        total_revenue: (res || []).filter(r => r.partner_id === p.id).reduce((s: number, r: any) => s + (r.total_price || 0), 0),
      }))
    }

    setCollab(collabData)
    setPartners(enrichedPartners)
    setDraftPartners(drafts || [])
    setPayouts(payoutsData || [])
    setLoading(false)
  }

  async function activatePartner() {
    if (!activatingPartner || !activateForm.name) return
    setActivateSaving(true)
    await supabase.from('partners').update({
      name: activateForm.name,
      contact_name: activateForm.contact_name,
      email: activateForm.email,
      portal_email: activateForm.portal_email,
      phone: activateForm.phone,
      city: activateForm.city,
      country: activateForm.country,
      google_maps_url: activateForm.google_maps_url,
      is_active: true,
      is_draft: false,
      acquisition_channel: 'collaborator',
      acquired_by_collaborator_id: collabId,
    }).eq('id', activatingPartner.id)

    setActivateSaving(false)
    setActivatingPartner(null)
    setActivateForm({ name: '', contact_name: '', email: '', portal_email: '', phone: '', city: '', country: 'Crna Gora', google_maps_url: '' })
    fetchData(collabId)
    setActiveTab('partners')
  }

  async function confirmPayout(payoutId: string) {
    setConfirming(payoutId)
    await supabase.from('collaborator_payouts').update({ status: 'confirmed', confirmed_at: new Date().toISOString() }).eq('id', payoutId)
    fetchData(collabId)
    setConfirming(null)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    document.cookie = 'avtorent-collab-token=; path=/; max-age=0'
    document.cookie = 'avtorent-collab-id=; path=/; max-age=0'
    document.cookie = 'avtorent-collab-name=; path=/; max-age=0'
    window.location.href = '/saradnik/login'
  }

  const activePartners = partners.filter(p => p.is_active)
  const totalReservations = partners.reduce((s, p) => s + (p.reservation_count || 0), 0)
  const totalRevenue = partners.reduce((s, p) => s + (p.total_revenue || 0), 0)
  const commissionFromPartners = activePartners.length * (collab?.commission_per_partner || 0)
  const commissionFromReservations = totalRevenue * ((collab?.commission_per_reservation_percent || 0) / 100)
  const totalCommission = commissionFromPartners + commissionFromReservations
  const totalPaid = payouts.filter(p => p.status === 'confirmed').reduce((s, p) => s + p.amount, 0)
  const remaining = totalCommission - totalPaid

  const tabStyle = (tab: string) => ({
    padding: '8px 16px', fontSize: 13, border: 'none',
    background: activeTab === tab ? '#1D9E75' : 'transparent',
    color: activeTab === tab ? '#fff' : '#6b7280',
    cursor: 'pointer', borderRadius: 8, fontWeight: activeTab === tab ? 600 : 400,
  })

  const inp = { width: '100%', padding: '8px 12px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', color: '#111', boxSizing: 'border-box' as const }
  const lbl = { fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }

  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>Učitavanje...</div>

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb' }}>
      <nav style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#111' }}>
          Avto<span style={{ color: '#1D9E75' }}>Rent</span>
          <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 400, marginLeft: 8 }}>portal saradnika</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>{collabName}</span>
          <button onClick={handleLogout} style={{ background: 'none', border: 'none', fontSize: 12, color: '#9ca3af', cursor: 'pointer', textDecoration: 'underline' }}>Odjavi se</button>
        </div>
      </nav>

      <main style={{ maxWidth: 1000, margin: '0 auto', padding: '28px 16px' }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, background: '#f3f4f6', borderRadius: 10, padding: 4, marginBottom: 24, width: 'fit-content' }}>
          <button style={tabStyle('overview')} onClick={() => setActiveTab('overview')}>Pregled</button>
          <button style={tabStyle('partners')} onClick={() => setActiveTab('partners')}>Moji partneri</button>
          <button style={tabStyle('activate')} onClick={() => setActiveTab('activate')}>Aktiviraj partnera</button>
          <button style={tabStyle('payouts')} onClick={() => setActiveTab('payouts')}>Provizije</button>
        </div>

        {/* PREGLED */}
        {activeTab === 'overview' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 12, marginBottom: 24 }}>
              {[
                { label: 'Aktivirani partneri', value: activePartners.length, color: '#1D9E75', bg: '#E1F5EE' },
                { label: 'Ukupno rezervacija', value: totalReservations, color: '#185FA5', bg: '#E6F1FB' },
                { label: 'Ukupna provizija', value: `${totalCommission.toFixed(2)}€`, color: '#BA7517', bg: '#FAEEDA' },
                { label: 'Preostalo za naplatu', value: `${remaining.toFixed(2)}€`, color: remaining > 0 ? '#dc2626' : '#9ca3af', bg: '#f3f4f6' },
              ].map(m => (
                <div key={m.label} style={{ background: m.bg, borderRadius: 10, padding: '16px' }}>
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>{m.label}</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: m.color }}>{m.value}</div>
                </div>
              ))}
            </div>

            {collab && (
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '20px 24px', marginBottom: 20 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#111', marginBottom: 14 }}>Moja provizija</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div style={{ background: '#f9fafb', borderRadius: 8, padding: '12px 14px' }}>
                    <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 4 }}>Po aktiviranom partneru</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#1D9E75' }}>{collab.commission_per_partner}€</div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{activePartners.length} partnera = {commissionFromPartners.toFixed(2)}€</div>
                  </div>
                  <div style={{ background: '#f9fafb', borderRadius: 8, padding: '12px 14px' }}>
                    <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 4 }}>Po rezervacijama (%)</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#185FA5' }}>{collab.commission_per_reservation_percent}%</div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>od {totalRevenue.toFixed(0)}€ = {commissionFromReservations.toFixed(2)}€</div>
                  </div>
                </div>
              </div>
            )}

            {/* Posljednji partneri */}
            {activePartners.length > 0 && (
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '20px 24px' }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#111', marginBottom: 14 }}>Posljednji aktivirani partneri</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {activePartners.slice(0, 5).map(p => (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#f9fafb', borderRadius: 8, fontSize: 13 }}>
                      <div>
                        <div style={{ fontWeight: 500, color: '#111' }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: '#9ca3af' }}>{p.city}, {p.country} · {p.qr_code}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 600, color: '#1D9E75' }}>{p.reservation_count || 0} rezervacija</div>
                        <div style={{ fontSize: 11, color: '#9ca3af' }}>{(p.total_revenue || 0).toFixed(0)}€ prihoda</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* MOJI PARTNERI */}
        {activeTab === 'partners' && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: '#111', marginBottom: 20 }}>Moji partneri ({activePartners.length})</h2>
            {activePartners.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 48, border: '1px dashed #e5e7eb', borderRadius: 12, color: '#9ca3af' }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>🤝</div>
                <div style={{ fontSize: 14, color: '#374151', marginBottom: 8 }}>Još nemate aktiviranih partnera</div>
                <button onClick={() => setActiveTab('activate')} style={{ padding: '8px 20px', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Aktiviraj prvog partnera →</button>
              </div>
            ) : (
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f9fafb' }}>
                      {['Partner', 'Lokacija', 'QR', 'Rezervacije', 'Prihod', 'Popust'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 500, fontSize: 12, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activePartners.map(p => (
                      <tr key={p.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ fontWeight: 500, color: '#111' }}>{p.name}</div>
                        </td>
                        <td style={{ padding: '12px 14px', color: '#6b7280', fontSize: 12 }}>{p.city || '—'}, {p.country || '—'}</td>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#854F0B', background: '#FAEEDA', padding: '3px 8px', borderRadius: 20 }}>{p.qr_code}</span>
                        </td>
                        <td style={{ padding: '12px 14px', color: '#374151' }}>{p.reservation_count || 0}</td>
                        <td style={{ padding: '12px 14px', fontWeight: 600, color: '#1D9E75' }}>{(p.total_revenue || 0).toFixed(0)}€</td>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{ fontSize: 11, background: '#E1F5EE', color: '#085041', padding: '3px 8px', borderRadius: 20 }}>{p.client_discount_percent}%</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* AKTIVIRAJ PARTNERA */}
        {activeTab === 'activate' && (
          <div style={{ maxWidth: 560 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: '#111', marginBottom: 20 }}>Aktiviraj partnera</h2>

            {!activatingPartner ? (
              <div>
                <div style={{ background: '#E6F1FB', border: '1px solid #85B7EB', borderRadius: 8, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: '#0C447C' }}>
                  Odaberi blanko QR kod koji ćeš dodijeliti novom partneru, pa popuni njihove podatke.
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {draftPartners.map(p => (
                    <div key={p.id} onClick={() => setActivatingPartner(p)}
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', border: '1px solid #e5e7eb', borderRadius: 10, background: '#fff', cursor: 'pointer' }}>
                      <div>
                        <div style={{ fontFamily: 'monospace', fontWeight: 600, color: '#854F0B', fontSize: 14 }}>{p.qr_code}</div>
                        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>Blanko QR kod</div>
                      </div>
                      <span style={{ fontSize: 13, color: '#1D9E75', fontWeight: 500 }}>Aktiviraj →</span>
                    </div>
                  ))}
                  {draftPartners.length === 0 && (
                    <div style={{ textAlign: 'center', padding: 32, color: '#9ca3af', fontSize: 13, border: '1px dashed #e5e7eb', borderRadius: 10 }}>
                      Nema dostupnih blanko QR kodova. Kontaktirajte administratora.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#111' }}>Aktiviraj QR kod</div>
                    <div style={{ fontSize: 13, color: '#854F0B', fontFamily: 'monospace', marginTop: 2 }}>{activatingPartner.qr_code}</div>
                  </div>
                  <button onClick={() => setActivatingPartner(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#9ca3af' }}>✕</button>
                </div>

                {[
                  { label: 'Naziv partnera *', key: 'name', ph: 'Vila Jadran' },
                  { label: 'Kontakt osoba', key: 'contact_name', ph: 'Marko Petrović' },
                  { label: 'Email', key: 'email', ph: 'vlasnik@email.com' },
                  { label: 'Portal email (Google login)', key: 'portal_email', ph: 'marko@gmail.com' },
                  { label: 'Telefon', key: 'phone', ph: '+382 67 111 222' },
                  { label: 'Grad', key: 'city', ph: 'Budva' },
                  { label: 'Država', key: 'country', ph: 'Crna Gora' },
                  { label: 'Google Maps link (opciono)', key: 'google_maps_url', ph: 'https://maps.google.com/...' },
                ].map(f => (
                  <div key={f.key} style={{ marginBottom: 12 }}>
                    <label style={lbl}>{f.label}</label>
                    <input style={inp} value={(activateForm as any)[f.key]} onChange={e => setActivateForm(fm => ({ ...fm, [f.key]: e.target.value }))} placeholder={f.ph} />
                  </div>
                ))}

                <button onClick={activatePartner} disabled={activateSaving || !activateForm.name}
                  style={{ width: '100%', padding: 11, background: !activateForm.name ? '#9ca3af' : activateSaving ? '#5DCAA5' : '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: !activateForm.name ? 'not-allowed' : 'pointer', marginTop: 8 }}>
                  {activateSaving ? 'Aktiviranje...' : 'Aktiviraj partnera'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* PROVIZIJE */}
        {activeTab === 'payouts' && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: '#111', marginBottom: 20 }}>Provizije</h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
              <div style={{ background: '#E1F5EE', borderRadius: 10, padding: '16px' }}>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Ukupno zarađeno</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#1D9E75' }}>{totalCommission.toFixed(2)}€</div>
              </div>
              <div style={{ background: '#f3f4f6', borderRadius: 10, padding: '16px' }}>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Isplaćeno</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#374151' }}>{totalPaid.toFixed(2)}€</div>
              </div>
              <div style={{ background: remaining > 0 ? '#FAEEDA' : '#f3f4f6', borderRadius: 10, padding: '16px' }}>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Preostalo</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: remaining > 0 ? '#BA7517' : '#9ca3af' }}>{remaining.toFixed(2)}€</div>
              </div>
            </div>

            {payouts.filter(p => p.status === 'pending').length > 0 && (
              <div style={{ background: '#FAEEDA', border: '1px solid #EF9F27', borderRadius: 12, padding: '16px 20px', marginBottom: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#633806', marginBottom: 12 }}>Čeka potvrdu</div>
                {payouts.filter(p => p.status === 'pending').map(p => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', borderRadius: 8, padding: '10px 14px', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#1D9E75' }}>{p.amount.toFixed(2)}€</div>
                      {p.note && <div style={{ fontSize: 12, color: '#9ca3af' }}>{p.note}</div>}
                    </div>
                    <button onClick={() => confirmPayout(p.id)} disabled={confirming === p.id}
                      style={{ padding: '6px 14px', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      {confirming === p.id ? '...' : 'Potvrdi prijem'}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {payouts.filter(p => p.status === 'confirmed').length > 0 && (
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid #e5e7eb', fontSize: 14, fontWeight: 600, color: '#111' }}>Istorija isplata</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <tbody>
                    {payouts.filter(p => p.status === 'confirmed').map(p => (
                      <tr key={p.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '10px 16px', color: '#9ca3af', fontSize: 12 }}>{new Date(p.created_at).toLocaleDateString('sr-RS')}</td>
                        <td style={{ padding: '10px 16px', color: '#6b7280' }}>{p.note || '—'}</td>
                        <td style={{ padding: '10px 16px', fontWeight: 600, color: '#1D9E75', textAlign: 'right' }}>{p.amount.toFixed(2)}€</td>
                        <td style={{ padding: '10px 16px' }}>
                          <span style={{ fontSize: 11, background: '#E1F5EE', color: '#085041', padding: '2px 8px', borderRadius: 20 }}>Potvrđeno</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
