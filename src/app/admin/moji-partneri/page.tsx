'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Partner = {
  id: string; name: string; qr_code: string; city: string; country: string
  client_discount_percent: number; commission_percent: number
  is_active: boolean; is_draft: boolean; portal_email: string
  reservation_count?: number; total_revenue?: number; commission_earned?: number
}

function getCookie(name: string): string {
  if (typeof document === 'undefined') return ''
  const match = document.cookie.match(new RegExp(`${name}=([^;]+)`))
  return match ? decodeURIComponent(match[1]) : ''
}

const ST: Record<string, { bg: string; color: string; label: string }> = {
  pending:   { bg: '#FAEEDA', color: '#633806', label: 'Na čekanju' },
  confirmed: { bg: '#E1F5EE', color: '#085041', label: 'Potvrđeno' },
  issued:    { bg: '#E6F1FB', color: '#0C447C', label: 'Izdato' },
  closed:    { bg: '#f3f4f6', color: '#374151', label: 'Zatvoreno' },
}

export default function MojiPartneriPage() {
  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading] = useState(true)
  const [agentName, setAgentName] = useState('')
  const [selected, setSelected] = useState<Partner | null>(null)
  const [partnerReservations, setPartnerReservations] = useState<any[]>([])
  const [view, setView] = useState<'list' | 'batch' | 'activate'>('list')
  const [batchCount, setBatchCount] = useState('5')
  const [batchGenerating, setBatchGenerating] = useState(false)
  const [activatingPartner, setActivatingPartner] = useState<Partner | null>(null)
  const [activateForm, setActivateForm] = useState({ name: '', contact_name: '', email: '', portal_email: '', phone: '', city: '', country: 'Crna Gora', google_maps_url: '', commission_percent: '10', client_discount_percent: '5' })
  const [activateSaving, setActivateSaving] = useState(false)
  const [filterMode, setFilterMode] = useState<'all' | 'active' | 'draft'>('all')

  const siteUrl = typeof window !== 'undefined' ? window.location.origin : 'https://rent-cars.me'

  useEffect(() => {
    const name = getCookie('avtorent-agent-name')
    setAgentName(name)
    if (name) fetchData(name)
  }, [])

  async function fetchData(name: string) {
    const { data: partnersData } = await supabase
      .from('partners')
      .select('*')
      .eq('acquired_by_agent', name)
      .order('created_at', { ascending: false })

    if (!partnersData || partnersData.length === 0) {
      setPartners([])
      setLoading(false)
      return
    }

    const activeIds = partnersData.filter(p => !p.is_draft).map(p => p.id)
    let reservations: any[] = []
    if (activeIds.length > 0) {
      const { data: res } = await supabase
        .from('reservations')
        .select('partner_id, total_price, commission_amount, status')
        .in('partner_id', activeIds)
        .neq('status', 'cancelled')
      reservations = res || []
    }

    const enriched = partnersData.map(p => {
      const pRes = reservations.filter(r => r.partner_id === p.id)
      const completed = pRes.filter(r => r.status === 'closed' || r.status === 'completed')
      return {
        ...p,
        reservation_count: pRes.length,
        total_revenue: pRes.reduce((s: number, r: any) => s + (r.total_price || 0), 0),
        commission_earned: completed.reduce((s: number, r: any) => s + (r.commission_amount || 0), 0),
      }
    })

    setPartners(enriched)
    setLoading(false)
  }

  async function generateBatch() {
    const count = Math.min(parseInt(batchCount), 10)
    if (!count || count < 1) return
    setBatchGenerating(true)

    const existing = partners.filter(p => p.qr_code.startsWith('AP-'))
    const { data: allAP } = await supabase.from('partners').select('qr_code').like('qr_code', 'AP-%')
    const maxNum = (allAP || []).reduce((max, p) => {
      const num = parseInt(p.qr_code.split('-')[1] || '0')
      return num > max ? num : max
    }, 0)

    const toInsert = Array.from({ length: count }, (_, i) => ({
      name: '',
      qr_code: `AP-${String(maxNum + i + 1).padStart(4, '0')}`,
      commission_percent: 10,
      client_discount_percent: 5,
      is_active: false,
      is_draft: true,
      acquisition_channel: 'agent',
      acquired_by_agent: agentName,
    }))

    await supabase.from('partners').insert(toInsert)
    setBatchGenerating(false)
    setBatchCount('5')
    setView('list')
    fetchData(agentName)
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
      commission_percent: parseFloat((activateForm as any).commission_percent || '10'),
      client_discount_percent: parseFloat((activateForm as any).client_discount_percent || '5'),
      is_active: true,
      is_draft: false,
    }).eq('id', activatingPartner.id)

    setActivateSaving(false)
    setActivatingPartner(null)
    setActivateForm({ name: '', contact_name: '', email: '', portal_email: '', phone: '', city: '', country: 'Crna Gora', google_maps_url: '', commission_percent: '10', client_discount_percent: '5' })
    setView('list')
    fetchData(agentName)
  }

  async function openPartner(p: Partner) {
    if (p.is_draft) {
      setActivatingPartner(p)
      setView('activate')
      return
    }
    setSelected(selected?.id === p.id ? null : p)
    if (selected?.id !== p.id) {
      const { data } = await supabase
        .from('reservations')
        .select('*, vehicles(name)')
        .eq('partner_id', p.id)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false })
      setPartnerReservations(data || [])
    }
  }

  function printQR(p: Partner) {
    const url = `${siteUrl}/?ref=${p.qr_code}`
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(url)}&format=png`
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`<html><head><title>QR - ${p.qr_code}</title>
      <style>body{font-family:Arial;text-align:center;padding:40px}.code{font-size:14px;color:#666;margin-top:10px}.name{font-size:20px;font-weight:bold;margin-top:8px}.url{font-size:11px;color:#999;margin-top:6px}</style>
      </head><body>
      <img src="${qrUrl}" width="300" height="300" />
      <div class="code">${p.qr_code}</div>
      <div class="name">${p.name || 'AvtoRent Montenegro'}</div>
      <div class="url">${url}</div>
      <script>window.onload=function(){window.print()}<\/script>
      </body></html>`)
  }

  const activePartners = partners.filter(p => p.is_active)
  const draftPartners = partners.filter(p => p.is_draft)
  const filtered = filterMode === 'active' ? activePartners : filterMode === 'draft' ? draftPartners : partners
  const totalRevenue = activePartners.reduce((s, p) => s + (p.total_revenue || 0), 0)
  const totalReservations = activePartners.reduce((s, p) => s + (p.reservation_count || 0), 0)

  const inp = { width: '100%', padding: '8px 12px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', color: '#111', boxSizing: 'border-box' as const }
  const lbl = { fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#111' }}>Moji partneri</h1>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>{agentName}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setView(view === 'batch' ? 'list' : 'batch')}
            style={{ padding: '8px 16px', border: '1px solid #185FA5', borderRadius: 8, background: view === 'batch' ? '#E6F1FB' : 'transparent', fontSize: 13, cursor: 'pointer', color: '#185FA5', fontWeight: 600 }}>
            Generiši QR kodove
          </button>
        </div>
      </div>

      {/* Metrike */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Aktivni partneri', value: activePartners.length, color: '#1D9E75', bg: '#E1F5EE' },
          { label: 'Blanko kodovi', value: draftPartners.length, color: '#185FA5', bg: '#E6F1FB' },
          { label: 'Rezervacije', value: totalReservations, color: '#BA7517', bg: '#FAEEDA' },
          { label: 'Ukupan prihod', value: `${totalRevenue.toFixed(0)}€`, color: '#111', bg: '#f3f4f6' },
        ].map(m => (
          <div key={m.label} style={{ background: m.bg, borderRadius: 10, padding: '14px' }}>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{m.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: m.color }}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Batch forma */}
      {view === 'batch' && (
        <div style={{ background: '#fff', border: '1px solid #85B7EB', borderRadius: 12, padding: '20px 24px', marginBottom: 20, maxWidth: 400 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#111', marginBottom: 8 }}>Generiši QR kodove</div>
          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>Kreiraj blanko QR kodove za terenska posjeta. Maksimum 10 po batch-u.</div>
          <div style={{ marginBottom: 16 }}>
            <label style={lbl}>Broj kodova (max 10)</label>
            <input type="number" min="1" max="10" style={inp} value={batchCount} onChange={e => setBatchCount(String(Math.min(10, parseInt(e.target.value) || 1)))} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={generateBatch} disabled={batchGenerating}
              style={{ flex: 1, padding: '10px', background: batchGenerating ? '#5DCAA5' : '#185FA5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {batchGenerating ? 'Generisanje...' : `Generiši ${batchCount} kodova`}
            </button>
            <button onClick={() => setView('list')} style={{ padding: '10px 16px', border: '1px solid #d1d5db', borderRadius: 8, background: 'transparent', fontSize: 13, cursor: 'pointer', color: '#374151' }}>
              Odustani
            </button>
          </div>
        </div>
      )}

      {/* Aktiviraj formu */}
      {view === 'activate' && activatingPartner && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '20px 24px', marginBottom: 20, maxWidth: 520 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#111' }}>Aktiviraj partnera</div>
              <div style={{ fontSize: 12, fontFamily: 'monospace', color: '#854F0B', marginTop: 2 }}>{activatingPartner.qr_code}</div>
            </div>
            <button onClick={() => { setView('list'); setActivatingPartner(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#9ca3af' }}>✕</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { label: 'Naziv partnera *', key: 'name', ph: 'Vila Jadran' },
              { label: 'Kontakt osoba', key: 'contact_name', ph: 'Marko Petrović' },
              { label: 'Email', key: 'email', ph: 'vlasnik@email.com' },
              { label: 'Portal email', key: 'portal_email', ph: 'marko@gmail.com' },
              { label: 'Telefon', key: 'phone', ph: '+382 67...' },
              { label: 'Grad', key: 'city', ph: 'Budva' },
              { label: 'Država', key: 'country', ph: 'Crna Gora' },
              { label: 'Google Maps link', key: 'google_maps_url', ph: 'https://maps.google...' },
            ].map(f => (
              <div key={f.key} style={{ gridColumn: f.key === 'google_maps_url' ? '1 / -1' : 'auto' }}>
                <label style={lbl}>{f.label}</label>
                <input style={inp} value={(activateForm as any)[f.key]} onChange={e => setActivateForm(fm => ({ ...fm, [f.key]: e.target.value }))} placeholder={f.ph} />
              </div>
            ))}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 4 }}>
              <div>
                <label style={lbl}>Provizija (%)</label>
                <input type="number" min="0" max="100" step="0.5" style={inp} value={(activateForm as any).commission_percent || '10'} onChange={e => setActivateForm(fm => ({ ...fm, commission_percent: e.target.value }))} />
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>Interni prihod</div>
              </div>
              <div>
                <label style={lbl}>Popust klijentu (%)</label>
                <input type="number" min="0" max="100" step="0.5" style={inp} value={(activateForm as any).client_discount_percent || '5'} onChange={e => setActivateForm(fm => ({ ...fm, client_discount_percent: e.target.value }))} />
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>Vidljiv klijentu</div>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button onClick={activatePartner} disabled={activateSaving || !activateForm.name}
              style={{ flex: 2, padding: '10px', background: !activateForm.name ? '#9ca3af' : activateSaving ? '#5DCAA5' : '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: !activateForm.name ? 'not-allowed' : 'pointer' }}>
              {activateSaving ? 'Aktiviranje...' : 'Aktiviraj partnera'}
            </button>
            <button onClick={() => { setView('list'); setActivatingPartner(null) }} style={{ flex: 1, padding: '10px', border: '1px solid #d1d5db', borderRadius: 8, background: 'transparent', fontSize: 13, cursor: 'pointer', color: '#374151' }}>
              Odustani
            </button>
          </div>
        </div>
      )}

      {/* Filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {[['all', `Svi (${partners.length})`], ['active', `Aktivni (${activePartners.length})`], ['draft', `Blanko (${draftPartners.length})`]].map(([val, label]) => (
          <button key={val} onClick={() => setFilterMode(val as any)} style={{ padding: '5px 14px', fontSize: 12, borderRadius: 20, border: '1px solid', borderColor: filterMode === val ? '#1D9E75' : '#e5e7eb', background: filterMode === val ? '#E1F5EE' : '#fff', color: filterMode === val ? '#085041' : '#6b7280', cursor: 'pointer', fontWeight: filterMode === val ? 600 : 400 }}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 360px' : '1fr', gap: 16 }}>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Učitavanje...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🤝</div>
              <div style={{ fontSize: 14, color: '#374151', marginBottom: 8 }}>
                {filterMode === 'draft' ? 'Nema blanko kodova' : filterMode === 'active' ? 'Nema aktivnih partnera' : 'Još nemate partnera'}
              </div>
              <button onClick={() => setView('batch')} style={{ padding: '8px 20px', background: '#185FA5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Generiši QR kodove →
              </button>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {['Partner', 'Lokacija', 'QR', 'Rezervacije', 'Prihod', 'Status', ''].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 500, fontSize: 12, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid #f3f4f6', background: selected?.id === p.id ? '#f0fdf8' : p.is_draft ? '#fefce8' : 'transparent', cursor: 'pointer' }}
                    onClick={() => openPartner(p)}>
                    <td style={{ padding: '12px 14px' }}>
                      {p.is_draft ? <span style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic' }}>Blanko QR kod</span> : (
                        <>
                          <div style={{ fontWeight: 500, color: '#111' }}>{p.name}</div>
                          {p.portal_email && <div style={{ fontSize: 11, color: '#1D9E75' }}>{p.portal_email}</div>}
                        </>
                      )}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: '#6b7280' }}>{p.is_draft ? '—' : `${p.city || '—'}, ${p.country || '—'}`}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#854F0B', background: '#FAEEDA', padding: '3px 8px', borderRadius: 20 }}>{p.qr_code}</span>
                    </td>
                    <td style={{ padding: '12px 14px', color: '#374151' }}>{p.is_draft ? '—' : p.reservation_count}</td>
                    <td style={{ padding: '12px 14px', fontWeight: 600, color: '#1D9E75' }}>{p.is_draft ? '—' : `${(p.total_revenue || 0).toFixed(0)}€`}</td>
                    <td style={{ padding: '12px 14px' }}>
                      {p.is_draft
                        ? <span style={{ fontSize: 11, background: '#fef9c3', color: '#854d0e', padding: '3px 8px', borderRadius: 20 }}>Blanko</span>
                        : <span style={{ fontSize: 11, background: '#E1F5EE', color: '#085041', padding: '3px 8px', borderRadius: 20 }}>Aktivan</span>}
                    </td>
                    <td style={{ padding: '12px 14px' }} onClick={e => e.stopPropagation()}>
                      {p.is_draft ? (
                        <button onClick={() => { setActivatingPartner(p); setView('activate') }} style={{ padding: '4px 10px', fontSize: 11, border: '1px solid #1D9E75', borderRadius: 6, background: '#E1F5EE', cursor: 'pointer', color: '#085041', fontWeight: 500 }}>Aktiviraj</button>
                      ) : (
                        <button onClick={() => printQR(p)} style={{ padding: '4px 10px', fontSize: 11, border: '1px solid #EF9F27', borderRadius: 6, background: '#FAEEDA', cursor: 'pointer', color: '#854F0B' }}>QR</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Detalji */}
        {selected && !selected.is_draft && (
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, background: '#fff', alignSelf: 'start' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#111' }}>{selected.name}</div>
                <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#854F0B', marginTop: 2 }}>{selected.qr_code}</div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#9ca3af' }}>✕</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
              {[['Grad', `${selected.city || '—'}`], ['Popust', `${selected.client_discount_percent}%`], ['Rezervacije', String(selected.reservation_count)], ['Prihod', `${(selected.total_revenue || 0).toFixed(0)}€`]].map(([l, v]) => (
                <div key={l} style={{ background: '#f9fafb', borderRadius: 8, padding: '8px 10px' }}>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>{l}</div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#111' }}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Rezervacije</div>
            {partnerReservations.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 16, color: '#9ca3af', fontSize: 13 }}>Nema rezervacija</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 300, overflowY: 'auto' }}>
                {partnerReservations.map(r => {
                  const st = ST[r.status] || { bg: '#f3f4f6', color: '#374151', label: r.status }
                  return (
                    <div key={r.id} style={{ padding: '8px 10px', background: '#f9fafb', borderRadius: 8, fontSize: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{ fontWeight: 500, color: '#111' }}>{r.guest_name}</span>
                        <span style={{ fontSize: 11, background: st.bg, color: st.color, padding: '1px 7px', borderRadius: 20 }}>{st.label}</span>
                      </div>
                      <div style={{ color: '#9ca3af' }}>{r.vehicles?.name} · {r.pickup_date}</div>
                      <div style={{ fontWeight: 600, color: '#1D9E75', marginTop: 2 }}>{r.total_price}€</div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
