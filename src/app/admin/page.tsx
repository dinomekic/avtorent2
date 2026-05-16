'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Collection = {
  id: string; reservation_id: string; agent_name: string; amount: number
  collection_type: string; payment_method: string
  cash_amount: number; card_amount: number; wire_amount: number
  note: string; created_at: string
  reservations?: { ref_code: string; guest_name: string; vehicles?: { name: string } }
}

type Reservation = {
  id: string; ref_code: string; guest_name: string; guest_phone: string
  pickup_date: string; return_date: string; pickup_time: string; return_time: string
  total_price: number; final_total: number | null; status: string; payment_status: string
  vehicles?: { name: string } | null
}

type AgentFinSummary = {
  saldo: number
  firmaDug: number
  pendingCount: number
}

const CTYPE_LABELS: Record<string, string> = {
  rental: 'Najam', surcharge: 'Doplata', debt_collected: 'Naplata duga', prepaid_returned: 'Povrat pretplate'
}

function getCookie(name: string): string {
  if (typeof document === 'undefined') return ''
  const match = document.cookie.match(new RegExp(`${name}=([^;]+)`))
  return match ? decodeURIComponent(match[1]) : ''
}

function getOrigin(): string {
  if (typeof window === 'undefined') return ''
  return window.location.origin
}

export default function AdminDashboardPage() {
  const [collections, setCollections] = useState<Collection[]>([])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [viewMode, setViewMode] = useState<'today' | 'all'>('today')
  const [agentName, setAgentName] = useState('')
  const [agentEmail, setAgentEmail] = useState('')
  const [agentPartners, setAgentPartners] = useState<any[]>([])
  const [showPartners, setShowPartners] = useState(false)
  const [finSummary, setFinSummary] = useState<AgentFinSummary | null>(null)

  const [dnevneStats, setDnevneStats] = useState({ izdavanja: 0, povratci: 0, aktivni: 0 })
  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    async function fetchDnevne() {
      const today = new Date().toISOString().split('T')[0]
      const { data } = await supabase
        .from('rezervacije')
        .select('od_datuma, do_datuma, daily_status')
        .or(`od_datuma.eq.${today},do_datuma.eq.${today},and(od_datuma.lt.${today},do_datuma.gt.${today})`)
      const rows = data || []
      setDnevneStats({
        izdavanja: rows.filter(r => r.od_datuma === today).length,
        povratci: rows.filter(r => r.do_datuma === today).length,
        aktivni: rows.filter(r => r.od_datuma < today && r.do_datuma > today && r.daily_status === 'Izdato').length,
      })
    }
    fetchDnevne()
  }, [])

  useEffect(() => {
    const name = getCookie('avtorent-agent-name')
    if (name) {
      setAgentName(name)
      fetchAgentPartners(name)
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email) {
        setAgentEmail(session.user.email)
        fetchFinSummary(session.user.email)
      }
    })
  }, [])

  useEffect(() => { fetchData() }, [selectedDate, viewMode])

  async function fetchFinSummary(email: string) {
    let allTrans: any[] = []
    let from = 0
    const step = 1000
    while (true) {
      const { data } = await supabase.from('transakcije').select('*')
        .range(from, from + step - 1)
      if (!data || data.length === 0) break
      allTrans = [...allTrans, ...data]
      if (data.length < step) break
      from += step
    }

    let s = 0, df = 0, pending = 0
    allTrans.forEach((t: any) => {
      if ((t.status || '').toLowerCase() !== 'zavrseno') {
        if ((t.status || '').toLowerCase() === 'na cekanju' &&
            (t.primaocemail || '').toLowerCase().trim() === email.toLowerCase()) pending++
        return
      }
      const iz = t.iznos || 0
      const kat = (t.kategorija || '').toUpperCase()
      const mail = (t.osobaemail || '').toLowerCase().trim()
      const pMail = (t.primaocemail || '').toLowerCase().trim()
      const emailL = email.toLowerCase()
      if (kat.includes('DUG PREMA FIRMI') && !kat.includes('UPLATA')) {
        if (mail === emailL) df += iz
        if (pMail === emailL) df -= iz
      } else if (kat.includes('UPLATA DUGA PREMA FIRMI')) {
        if (mail === emailL) df -= iz
        if (pMail === emailL) df += iz
      } else {
        if (mail === emailL) s += iz
        if (pMail === emailL) s -= iz
      }
    })
    setFinSummary({ saldo: s, firmaDug: df, pendingCount: pending })
  }

  async function fetchAgentPartners(name: string) {
    const { data } = await supabase.from('partners').select('*').eq('acquired_by_agent', name).eq('is_active', true)
    if (data && data.length > 0) {
      const ids = data.map((p: any) => p.id)
      const { data: res } = await supabase.from('reservations').select('partner_id, total_price').in('partner_id', ids).neq('status', 'cancelled')
      const enriched = data.map((p: any) => ({
        ...p,
        reservation_count: (res || []).filter((r: any) => r.partner_id === p.id).length,
        total_revenue: (res || []).filter((r: any) => r.partner_id === p.id).reduce((s: number, r: any) => s + (r.total_price || 0), 0),
      }))
      setAgentPartners(enriched)
    }
  }

  async function fetchData() {
    setLoading(true)
    let collectionsQuery = supabase.from('agent_collections').select('*, reservations(ref_code, guest_name, vehicles(name))').order('created_at', { ascending: false })
    const name = getCookie('avtorent-agent-name')
    if (name) collectionsQuery = collectionsQuery.eq('agent_name', name)
    if (viewMode === 'today') {
      collectionsQuery = collectionsQuery.gte('created_at', `${selectedDate}T00:00:00`).lte('created_at', `${selectedDate}T23:59:59`)
    }
    const { data: res } = await supabase.from('reservations').select('*, vehicles(name)').neq('status', 'cancelled')
      .or(`pickup_date.eq.${today},return_date.eq.${today},and(pickup_date.lt.${today},return_date.gt.${today})`).order('pickup_time')
    const { data: col } = await collectionsQuery
    setCollections(col || [])
    setReservations(res || [])
    setLoading(false)
  }

  const pickups = reservations.filter(r => r.pickup_date === today)
  const returns = reservations.filter(r => r.return_date === today)
  const active = reservations.filter(r => r.pickup_date < today && r.return_date > today)
  const totalCash = collections.filter(c => c.amount > 0).reduce((s, c) => s + (c.cash_amount || 0), 0)
  const totalCard = collections.filter(c => c.amount > 0).reduce((s, c) => s + (c.card_amount || 0), 0)
  const totalWire = collections.filter(c => c.amount > 0).reduce((s, c) => s + (c.wire_amount || 0), 0)
  const totalReturned = collections.filter(c => c.amount < 0).reduce((s, c) => s + Math.abs(c.amount), 0)
  const netTotal = totalCash + totalCard + totalWire - totalReturned
  const upcoming = reservations.filter(r => r.pickup_date > today && r.status === 'confirmed').sort((a, b) => a.pickup_date.localeCompare(b.pickup_date)).slice(0, 5)

  const origin = getOrigin()

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      <style>{`
        @media (max-width: 640px) {
          .stats-grid { grid-template-columns: 1fr 1fr !important; }
          .fin-grid { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#111' }}>Dobrodošli{agentName ? `, ${agentName}` : ''}!</h1>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>Pregled za danas — {new Date().toLocaleDateString('sr-RS', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <a href={`${origin}/admin/dan`} style={{ padding: '8px 16px', border: '1px solid #1D9E75', borderRadius: 8, background: '#E1F5EE', fontSize: 13, fontWeight: 600, color: '#085041', textDecoration: 'none' }}>
          📅 Dnevni pregled →
        </a>
      </div>

      {/* Metrike dana */}
      <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Izdavanja danas', value: dnevneStats.izdavanja, sub: 'vozila idu van', color: '#1D9E75', bg: '#E1F5EE' },
          { label: 'Povratci danas', value: dnevneStats.povratci, sub: 'vozila dolaze', color: '#185FA5', bg: '#E6F1FB' },
          { label: 'Aktivni najam', value: dnevneStats.aktivni, sub: 'vozila trenutno vani', color: '#BA7517', bg: '#FAEEDA' },
          { label: 'Ukupno naplaćeno', value: `${netTotal.toFixed(0)}€`, sub: viewMode === 'today' ? 'danas' : 'sve', color: '#111', bg: '#f3f4f6' },
        ].map(m => (
          <a key={m.label} href={`${origin}/admin/dan`} style={{ background: m.bg, borderRadius: 10, padding: '16px', textDecoration: 'none', display: 'block', cursor: 'pointer' }}>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>{m.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: m.color }}>{m.value}</div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{m.sub}</div>
          </a>
        ))}
      </div>

      {/* MOJE FINANSIJE KARTICA — prečica */}
      {finSummary !== null && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '16px 20px', marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>💰 Moje finansije</div>
            <a href={`${origin}/admin/finansije`}
              style={{ padding: '6px 14px', background: '#1D9E75', color: '#fff', borderRadius: 8, fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
              Otvori finansije →
            </a>
          </div>
          <div className="fin-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            <div style={{ background: finSummary.saldo >= 0 ? '#E1F5EE' : '#FCEBEB', borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Saldo</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: finSummary.saldo >= 0 ? '#085041' : '#dc2626' }}>{finSummary.saldo.toFixed(2)}€</div>
            </div>
            <div style={{ background: '#FAEEDA', borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Firma dug</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#633806' }}>{finSummary.firmaDug.toFixed(2)}€</div>
            </div>
            <div style={{ background: finSummary.pendingCount > 0 ? '#FAEEDA' : '#f3f4f6', borderRadius: 10, padding: '12px 14px', textAlign: 'center', cursor: finSummary.pendingCount > 0 ? 'pointer' : 'default' }}
              onClick={() => finSummary.pendingCount > 0 && (window.location.href = `${origin}/admin/finansije`)}>
              <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Na čekanju</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: finSummary.pendingCount > 0 ? '#BA7517' : '#374151' }}>
                {finSummary.pendingCount > 0 ? `🔔 ${finSummary.pendingCount}` : '—'}
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
        {/* Zaduženja agenta */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#111' }}>Moja zaduženja</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setViewMode('today')} style={{ padding: '5px 12px', fontSize: 11, border: `1px solid ${viewMode === 'today' ? '#1D9E75' : '#e5e7eb'}`, borderRadius: 20, background: viewMode === 'today' ? '#E1F5EE' : '#fff', color: viewMode === 'today' ? '#085041' : '#6b7280', cursor: 'pointer', fontWeight: viewMode === 'today' ? 600 : 400 }}>Danas</button>
              <button onClick={() => setViewMode('all')} style={{ padding: '5px 12px', fontSize: 11, border: `1px solid ${viewMode === 'all' ? '#1D9E75' : '#e5e7eb'}`, borderRadius: 20, background: viewMode === 'all' ? '#E1F5EE' : '#fff', color: viewMode === 'all' ? '#085041' : '#6b7280', cursor: 'pointer', fontWeight: viewMode === 'all' ? 600 : 400 }}>Sve</button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
            {[
              { label: 'Keš', value: totalCash, color: '#1D9E75', bg: '#E1F5EE' },
              { label: 'Kartica', value: totalCard, color: '#185FA5', bg: '#E6F1FB' },
              { label: 'Virmanski', value: totalWire, color: '#BA7517', bg: '#FAEEDA' },
            ].map(m => (
              <div key={m.label} style={{ background: m.bg, borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>{m.label}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: m.color }}>{m.value.toFixed(0)}€</div>
              </div>
            ))}
          </div>
          {totalReturned > 0 && (
            <div style={{ background: '#FCEBEB', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 13, color: '#791F1F' }}>
              Povrati: -{totalReturned.toFixed(2)}€
            </div>
          )}
          <div style={{ background: '#f9fafb', borderRadius: 8, padding: '10px 14px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: '#6b7280' }}>Neto zaduženje</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: '#111' }}>{netTotal.toFixed(2)}€</span>
          </div>
          {loading ? <div style={{ color: '#9ca3af', fontSize: 13 }}>Učitavanje...</div> : collections.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, color: '#9ca3af', fontSize: 13 }}>Nema naplata za odabrani period</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 240, overflowY: 'auto' }}>
              {collections.map(c => (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: '#f9fafb', borderRadius: 8, fontSize: 12 }}>
                  <div>
                    <div style={{ fontWeight: 500, color: '#111' }}>{c.reservations?.guest_name || '—'}</div>
                    <div style={{ color: '#9ca3af', fontSize: 11 }}>{c.reservations?.ref_code} · {CTYPE_LABELS[c.collection_type] || c.collection_type}</div>
                    {c.note && <div style={{ color: '#9ca3af', fontSize: 11 }}>{c.note}</div>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, color: c.amount >= 0 ? '#1D9E75' : '#dc2626' }}>{c.amount >= 0 ? '+' : ''}{c.amount.toFixed(2)}€</div>
                    <div style={{ fontSize: 10, color: '#9ca3af' }}>
                      {c.payment_method === 'split' ? `K:${c.cash_amount}€ / C:${c.card_amount}€` : c.payment_method === 'cash' ? 'Keš' : c.payment_method === 'card' ? 'Kartica' : c.payment_method === 'wire' ? 'Virmanski' : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      {/* Moji partneri */}
      {agentPartners.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '20px 24px', marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#111' }}>Moji partneri ({agentPartners.length})</div>
            <button onClick={() => setShowPartners(!showPartners)} style={{ fontSize: 12, color: '#1D9E75', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
              {showPartners ? 'Sakrij' : 'Prikaži sve'}
            </button>
          </div>
          {showPartners && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {['Partner', 'Lokacija', 'QR', 'Rezervacije', 'Prihod'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 500, fontSize: 12, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {agentPartners.map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 500, color: '#111' }}>{p.name}</td>
                    <td style={{ padding: '10px 12px', color: '#6b7280', fontSize: 12 }}>{p.city || '—'}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#854F0B', background: '#FAEEDA', padding: '2px 7px', borderRadius: 20 }}>{p.qr_code}</span>
                    </td>
                    <td style={{ padding: '10px 12px', color: '#374151' }}>{p.reservation_count}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: '#1D9E75' }}>{(p.total_revenue || 0).toFixed(0)}€</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!showPartners && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {agentPartners.slice(0, 3).map(p => (
                <div key={p.id} style={{ background: '#f9fafb', borderRadius: 8, padding: '10px 12px', fontSize: 12 }}>
                  <div style={{ fontWeight: 500, color: '#111' }}>{p.name}</div>
                  <div style={{ color: '#9ca3af', fontSize: 11 }}>{p.reservation_count} rezervacija</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Nadolazeće rezervacije */}
      {upcoming.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '20px 24px' }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#111', marginBottom: 14 }}>Nadolazeće rezervacije</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['Ref', 'Gost', 'Vozilo', 'Preuzimanje', 'Iznos'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 500, fontSize: 12, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {upcoming.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 11, color: '#9ca3af' }}>{r.ref_code}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ fontWeight: 500, color: '#111' }}>{r.guest_name}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>{r.guest_phone}</div>
                  </td>
                  <td style={{ padding: '10px 12px', color: '#374151' }}>{r.vehicles?.name || '—'}</td>
                  <td style={{ padding: '10px 12px', fontSize: 12, color: '#374151' }}>
                    {new Date(r.pickup_date).toLocaleDateString('sr-RS', { day: 'numeric', month: 'short' })} u {r.pickup_time?.slice(0,5)}
                  </td>
                  <td style={{ padding: '10px 12px', fontWeight: 600, color: '#1D9E75' }}>{r.total_price}€</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
    </div>
  )
}
