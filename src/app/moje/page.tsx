'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Client = {
  id: string; email: string; full_name: string; phone: string
  nationality: string; client_type: string; created_at: string
  licence_number: string | null; licence_country: string | null
  licence_expiry: string | null; licence_image_url: string | null
  date_of_birth: string | null; address: string | null
}

type Reservation = {
  id: string; ref_code: string; pickup_date: string; return_date: string
  pickup_time: string; return_time: string; pickup_location: string
  total_price: number; status: string; created_at: string
  vehicles: { name: string; image_url: string | null } | null
}

const DS = {
  primary: '#1a56a0',
  primaryDark: '#0e2d5e',
  primaryLight: '#E6F1FB',
  primaryAccent: '#378ADD',
  primaryMid: '#185FA5',
  textPrimary: '#111827',
  textSecondary: '#6b7280',
  textMuted: '#9ca3af',
  border: '#e5e7eb',
  borderBlue: '#c5d9f5',
  bgPage: '#f9fafb',
  bgCard: '#ffffff',
  bgSubtle: '#f3f4f6',
}

const ST: Record<string, { bg: string; color: string; label: string }> = {
  pending:   { bg: '#FAEEDA', color: '#633806', label: 'Na čekanju' },
  confirmed: { bg: DS.primaryLight, color: DS.primaryMid, label: 'Potvrđeno' },
  completed: { bg: '#EAF3DE', color: '#27500A', label: 'Završeno' },
  cancelled: { bg: '#FCEBEB', color: '#791F1F', label: 'Otkazano' },
}

const inp = {
  width: '100%',
  padding: '9px 12px',
  fontSize: 14,
  border: `1px solid ${DS.border}`,
  borderRadius: 8,
  color: DS.textPrimary,
  boxSizing: 'border-box' as const,
  background: DS.bgCard,
}

function getCookie(name: string): string {
  if (typeof document === 'undefined') return ''
  const match = document.cookie.match(new RegExp(`${name}=([^;]+)`))
  return match ? decodeURIComponent(match[1]) : ''
}

function ReservationCard({ r }: { r: Reservation }) {
  const st = ST[r.status] || ST.pending
  const today = new Date().toISOString().split('T')[0]
  const isActive = r.return_date >= today && r.status === 'confirmed'

  return (
    <div style={{
      background: DS.bgCard,
      border: `1px solid ${isActive ? DS.borderBlue : DS.border}`,
      borderRadius: 12,
      padding: '16px 18px',
      display: 'flex',
      gap: 16,
      alignItems: 'flex-start',
    }}>
      <div style={{ width: 64, height: 64, borderRadius: 10, background: DS.bgSubtle, overflow: 'hidden', flexShrink: 0 }}>
        {r.vehicles?.image_url ? (
          <img src={r.vehicles.image_url} alt={r.vehicles.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>🚗</div>
        )}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, color: DS.textPrimary }}>{r.vehicles?.name || '—'}</div>
            <div style={{ fontFamily: 'monospace', fontSize: 11, color: DS.textMuted, marginTop: 2 }}>{r.ref_code}</div>
          </div>
          <span style={{ fontSize: 11, background: st.bg, color: st.color, padding: '3px 10px', borderRadius: 20, fontWeight: 600 }}>{st.label}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
          <div style={{ color: DS.textMuted }}>Preuzimanje<br /><span style={{ color: DS.textPrimary, fontWeight: 500 }}>{r.pickup_date} u {r.pickup_time?.slice(0, 5) || '10:00'}</span></div>
          <div style={{ color: DS.textMuted }}>Vraćanje<br /><span style={{ color: DS.textPrimary, fontWeight: 500 }}>{r.return_date} u {r.return_time?.slice(0, 5) || '10:00'}</span></div>
          <div style={{ color: DS.textMuted }}>Lokacija<br /><span style={{ color: DS.textPrimary, fontWeight: 500 }}>{r.pickup_location}</span></div>
          <div style={{ color: DS.textMuted }}>Iznos<br /><span style={{ color: DS.primary, fontWeight: 700, fontSize: 15 }}>{r.total_price}€</span></div>
        </div>
      </div>
    </div>
  )
}

export default function ClientPortalPage() {
  const [client, setClient] = useState<Client | null>(null)
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'reservations' | 'feedback' | 'profile'>('reservations')
  const [feedbackRating, setFeedbackRating] = useState(5)
  const [feedbackComment, setFeedbackComment] = useState('')
  const [feedbackSending, setFeedbackSending] = useState(false)
  const [feedbackSent, setFeedbackSent] = useState(false)
  const [editProfile, setEditProfile] = useState(false)
  const [profileForm, setProfileForm] = useState({ full_name: '', phone: '', date_of_birth: '', address: '', licence_number: '', licence_country: '', licence_expiry: '' })
  const [licenceFile, setLicenceFile] = useState<File | null>(null)
  const [licenceUploading, setLicenceUploading] = useState(false)
  const [profileSaving, setProfileSaving] = useState(false)

  const GOOGLE_REVIEW_URL = process.env.NEXT_PUBLIC_GOOGLE_REVIEW_URL || '#'

  useEffect(() => {
    const email = getCookie('avtorent-client-email')
    if (!email) { window.location.href = '/moje/login'; return }
    fetchData(email)
  }, [])

  async function fetchData(email: string) {
    const { data: clientData } = await supabase.from('clients').select('*').eq('email', email).single()
    if (!clientData) { window.location.href = '/moje/login'; return }
    setClient(clientData)
    setProfileForm({ full_name: clientData.full_name || '', phone: clientData.phone || '', date_of_birth: clientData.date_of_birth || '', address: clientData.address || '', licence_number: clientData.licence_number || '', licence_country: clientData.licence_country || '', licence_expiry: clientData.licence_expiry || '' })
    const { data: res } = await supabase.from('reservations').select('*, vehicles(name, image_url)').eq('guest_email', email).order('created_at', { ascending: false })
    setReservations(res || [])
    setLoading(false)
  }

  async function saveProfile() {
    if (!client) return
    setProfileSaving(true)
    let licenceImageUrl = client.licence_image_url
    if (licenceFile) {
      setLicenceUploading(true)
      const ext = licenceFile.name.split('.').pop()
      const path = `licences/${client.id}.${ext}`
      const { error: upErr } = await supabase.storage.from('client-documents').upload(path, licenceFile, { upsert: true })
      if (!upErr) {
        const { data: urlData } = supabase.storage.from('client-documents').getPublicUrl(path)
        licenceImageUrl = urlData.publicUrl
      }
      setLicenceUploading(false)
    }
    await supabase.from('clients').update({ ...profileForm, date_of_birth: profileForm.date_of_birth || null, address: profileForm.address || null, licence_number: profileForm.licence_number || null, licence_country: profileForm.licence_country || null, licence_expiry: profileForm.licence_expiry || null, licence_image_url: licenceImageUrl }).eq('id', client.id)
    setClient(c => c ? { ...c, ...profileForm, licence_image_url: licenceImageUrl } : null)
    setProfileSaving(false)
    setEditProfile(false)
  }

  async function sendFeedback() {
    if (!client || !feedbackComment.trim()) return
    setFeedbackSending(true)
    await supabase.from('client_feedback').insert({ client_id: client.id, rating: feedbackRating, comment: feedbackComment.trim() })
    setFeedbackSent(true)
    setFeedbackSending(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    document.cookie = 'avtorent-client-token=; path=/; max-age=0'
    document.cookie = 'avtorent-client-email=; path=/; max-age=0'
    window.location.href = '/'
  }

  const active = reservations.filter(r => r.status === 'confirmed' || r.status === 'pending')
  const past = reservations.filter(r => r.status === 'completed' || r.status === 'cancelled')

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: DS.textMuted, background: DS.bgPage }}>
      Učitavanje...
    </div>
  )

  const tabStyle = (tab: string) => ({
    padding: '8px 18px',
    fontSize: 13,
    border: 'none',
    background: activeTab === tab ? DS.primary : 'transparent',
    color: activeTab === tab ? '#fff' : DS.textSecondary,
    cursor: 'pointer',
    borderRadius: 8,
    fontWeight: activeTab === tab ? 600 : 400,
    transition: 'all 0.15s',
  })

  return (
    <div style={{ minHeight: '100vh', background: DS.bgPage, fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* Nav */}
      <nav style={{ background: DS.bgCard, borderBottom: `1px solid ${DS.border}`, padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <a href="/" style={{ fontSize: 18, fontWeight: 700, color: DS.textPrimary, textDecoration: 'none' }}>
          ADRIA<span style={{ color: DS.primaryAccent, fontWeight: 300 }}>DRIVE</span>
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: DS.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: DS.primary }}>
              {(client?.full_name || client?.email || '?')[0].toUpperCase()}
            </div>
            <span style={{ fontSize: 13, color: DS.textPrimary, fontWeight: 500 }}>{client?.full_name || client?.email}</span>
          </div>
          <button onClick={handleLogout} style={{ background: 'none', border: 'none', fontSize: 12, color: DS.textMuted, cursor: 'pointer', textDecoration: 'underline' }}>
            Odjavi se
          </button>
        </div>
      </nav>

      <main style={{ maxWidth: 860, margin: '0 auto', padding: '28px 16px 60px' }}>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, background: DS.bgSubtle, borderRadius: 10, padding: 4, marginBottom: 24, width: 'fit-content' }}>
          <button style={tabStyle('reservations')} onClick={() => setActiveTab('reservations')}>Moje rezervacije</button>
          <button style={tabStyle('feedback')} onClick={() => setActiveTab('feedback')}>Ocjena i feedback</button>
          <button style={tabStyle('profile')} onClick={() => setActiveTab('profile')}>Moj profil</button>
        </div>

        {/* Rezervacije */}
        {activeTab === 'reservations' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 600, color: DS.textPrimary }}>Moje rezervacije</h2>
              <a href="/" style={{ padding: '8px 18px', background: DS.primary, color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                + Nova rezervacija
              </a>
            </div>

            {reservations.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 24px', border: `1px dashed ${DS.border}`, borderRadius: 12, color: DS.textMuted }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>🚗</div>
                <div style={{ fontSize: 15, marginBottom: 8, color: DS.textSecondary }}>Još nemate rezervacija</div>
                <a href="/" style={{ color: DS.primary, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>Rezervišite vozilo →</a>
              </div>
            ) : (
              <>
                {active.length > 0 && (
                  <div style={{ marginBottom: 28 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: DS.primary, letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 12 }}>Aktuelne</div>
                    <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 12 }}>
                      {active.map(r => <ReservationCard key={r.id} r={r} />)}
                    </div>
                  </div>
                )}
                {past.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: DS.textMuted, letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 12 }}>Prošle</div>
                    <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 12 }}>
                      {past.map(r => <ReservationCard key={r.id} r={r} />)}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Feedback */}
        {activeTab === 'feedback' && (
          <div style={{ maxWidth: 560 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: DS.textPrimary, marginBottom: 20 }}>Ocjena i feedback</h2>

            {/* Google recenzija */}
            <div style={{ background: DS.bgCard, border: `1px solid ${DS.border}`, borderRadius: 12, padding: '20px 24px', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 8, background: DS.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="#378ADD"/>
                  </svg>
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: DS.textPrimary }}>Ocijenite nas na Google</div>
                  <div style={{ fontSize: 12, color: DS.textMuted }}>Vaša recenzija nam znači!</div>
                </div>
              </div>
              <p style={{ fontSize: 13, color: DS.textSecondary, marginBottom: 16, lineHeight: 1.6 }}>
                Bili smo zadovoljstvo da vam pružimo uslugu. Ako ste zadovoljni, molimo vas da nas ocijenite na Google — to nam puno znači!
              </p>
              <a href={GOOGLE_REVIEW_URL} target="_blank" rel="noreferrer" style={{ display: 'inline-block', padding: '10px 20px', background: '#4285F4', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                Ostavite recenziju na Google →
              </a>
            </div>

            {/* Interni feedback */}
            <div style={{ background: DS.bgCard, border: `1px solid ${DS.border}`, borderRadius: 12, padding: '20px 24px' }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: DS.textPrimary, marginBottom: 4 }}>Privatni feedback</div>
              <div style={{ fontSize: 12, color: DS.textMuted, marginBottom: 16 }}>Vaše mišljenje vidimo samo mi</div>

              {feedbackSent ? (
                <div style={{ background: DS.primaryLight, border: `1px solid ${DS.borderBlue}`, borderRadius: 8, padding: '14px 16px', fontSize: 13, color: DS.primaryMid, textAlign: 'center' as const }}>
                  Hvala na feedbacku! 🙏
                </div>
              ) : (
                <>
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 12, color: DS.textSecondary, marginBottom: 8 }}>Ocjena</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {[1, 2, 3, 4, 5].map(n => (
                        <button key={n} onClick={() => setFeedbackRating(n)} style={{ width: 40, height: 40, borderRadius: 8, border: `1px solid ${feedbackRating >= n ? DS.borderBlue : DS.border}`, background: feedbackRating >= n ? DS.primaryLight : DS.bgCard, fontSize: 18, cursor: 'pointer' }}>
                          {feedbackRating >= n ? '⭐' : '☆'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: 12, color: DS.textSecondary, display: 'block', marginBottom: 4 }}>Komentar</label>
                    <textarea value={feedbackComment} onChange={e => setFeedbackComment(e.target.value)} placeholder="Šta vam se svidjelo? Šta možemo poboljšati?" style={{ ...inp, minHeight: 100, resize: 'vertical' as const }} />
                  </div>
                  <button onClick={sendFeedback} disabled={feedbackSending || !feedbackComment.trim()} style={{ padding: '10px 20px', background: !feedbackComment.trim() ? DS.textMuted : DS.primary, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: !feedbackComment.trim() ? 'not-allowed' : 'pointer' }}>
                    {feedbackSending ? 'Slanje...' : 'Pošalji feedback'}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Profil */}
        {activeTab === 'profile' && (
          <div style={{ maxWidth: 480 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: DS.textPrimary, marginBottom: 20 }}>Moj profil</h2>
            <div style={{ background: DS.bgCard, border: `1px solid ${DS.border}`, borderRadius: 12, padding: '24px' }}>

              {/* Avatar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
                <div style={{ width: 52, height: 52, borderRadius: '50%', background: DS.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: DS.primary }}>
                  {(client?.full_name || client?.email || '?')[0].toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15, color: DS.textPrimary }}>{client?.full_name || '—'}</div>
                  <div style={{ fontSize: 13, color: DS.textMuted }}>{client?.email}</div>
                </div>
              </div>

              {editProfile ? (
                <>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 12, color: DS.textSecondary, display: 'block', marginBottom: 4 }}>Ime i prezime</label>
                    <input style={inp} value={profileForm.full_name} onChange={e => setProfileForm(f => ({ ...f, full_name: e.target.value }))} />
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 12, color: DS.textSecondary, display: 'block', marginBottom: 4 }}>Telefon</label>
                    <input style={inp} value={profileForm.phone} onChange={e => setProfileForm(f => ({ ...f, phone: e.target.value }))} placeholder="+382 67 000 000" />
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 12, color: DS.textSecondary, display: 'block', marginBottom: 4 }}>Datum rođenja</label>
                    <input type="date" style={inp} value={profileForm.date_of_birth} onChange={e => setProfileForm(f => ({ ...f, date_of_birth: e.target.value }))} />
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: 12, color: DS.textSecondary, display: 'block', marginBottom: 4 }}>Adresa</label>
                    <input style={inp} value={profileForm.address} onChange={e => setProfileForm(f => ({ ...f, address: e.target.value }))} placeholder="Ulica, grad, država" />
                  </div>

                  {/* Vozačka dozvola */}
                  <div style={{ background: DS.primaryLight, border: `1px solid ${DS.borderBlue}`, borderRadius: 8, padding: '14px', marginBottom: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: DS.primaryMid, marginBottom: 10 }}>Podaci vozačke dozvole</div>
                    <div style={{ marginBottom: 10 }}>
                      <label style={{ fontSize: 12, color: DS.textSecondary, display: 'block', marginBottom: 4 }}>Broj dozvole</label>
                      <input style={{ ...inp, border: `1px solid ${DS.borderBlue}` }} value={profileForm.licence_number} onChange={e => setProfileForm(f => ({ ...f, licence_number: e.target.value }))} placeholder="npr. 123456789" />
                    </div>
                    <div style={{ marginBottom: 10 }}>
                      <label style={{ fontSize: 12, color: DS.textSecondary, display: 'block', marginBottom: 4 }}>Država izdavanja</label>
                      <input style={{ ...inp, border: `1px solid ${DS.borderBlue}` }} value={profileForm.licence_country} onChange={e => setProfileForm(f => ({ ...f, licence_country: e.target.value }))} placeholder="npr. Crna Gora" />
                    </div>
                    <div style={{ marginBottom: 10 }}>
                      <label style={{ fontSize: 12, color: DS.textSecondary, display: 'block', marginBottom: 4 }}>Datum isteka</label>
                      <input type="date" style={{ ...inp, border: `1px solid ${DS.borderBlue}` }} value={profileForm.licence_expiry} onChange={e => setProfileForm(f => ({ ...f, licence_expiry: e.target.value }))} />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, color: DS.textSecondary, display: 'block', marginBottom: 4 }}>
                        Slika dozvole {client?.licence_image_url && <span style={{ color: DS.primary }}>✓ Uploadovana</span>}
                      </label>
                      <input type="file" accept="image/*,.pdf" onChange={e => setLicenceFile(e.target.files?.[0] || null)} style={{ ...inp, border: `1px solid ${DS.borderBlue}`, cursor: 'pointer' }} />
                    </div>
                    {client?.licence_image_url && (
                      <div style={{ marginTop: 10 }}>
                        <a href={client.licence_image_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: DS.primary, textDecoration: 'none' }}>
                          Pogledaj uploadovanu dozvolu →
                        </a>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={saveProfile} disabled={profileSaving} style={{ flex: 1, padding: '9px', background: DS.primary, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                      {profileSaving ? 'Snimanje...' : 'Sačuvaj'}
                    </button>
                    <button onClick={() => setEditProfile(false)} style={{ flex: 1, padding: '9px', background: 'transparent', border: `1px solid ${DS.border}`, borderRadius: 8, fontSize: 13, cursor: 'pointer', color: DS.textSecondary }}>
                      Odustani
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {[
                    ['Telefon', client?.phone],
                    ['Nacionalnost', client?.nationality],
                    ['Član od', client?.created_at ? new Date(client.created_at).toLocaleDateString('sr-RS') : '—'],
                    ['Broj rezervacija', String(reservations.length)],
                  ].map(([l, v]) => (
                    <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: `1px solid ${DS.bgSubtle}`, fontSize: 13 }}>
                      <span style={{ color: DS.textMuted }}>{l}</span>
                      <span style={{ color: DS.textPrimary, fontWeight: 500 }}>{v || '—'}</span>
                    </div>
                  ))}
                  <button onClick={() => setEditProfile(true)} style={{ marginTop: 16, padding: '9px 20px', border: `1px solid ${DS.border}`, borderRadius: 8, background: 'transparent', fontSize: 13, cursor: 'pointer', color: DS.textSecondary }}>
                    Uredi profil
                  </button>
                </>
              )}
            </div>
          </div>
        )}

      </main>
    </div>
  )
}
