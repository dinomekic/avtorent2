'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Period = 'today' | 'week' | 'month' | 'custom'

function getDateRange(period: Period, customFrom: string, customTo: string) {
  const now = new Date()
  const today = now.toISOString().split('T')[0]
  if (period === 'today') return { from: today, to: today }
  if (period === 'week') {
    const d = new Date(now); d.setDate(d.getDate() - 7)
    return { from: d.toISOString().split('T')[0], to: today }
  }
  if (period === 'month') {
    const d = new Date(now); d.setDate(d.getDate() - 30)
    return { from: d.toISOString().split('T')[0], to: today }
  }
  return { from: customFrom, to: customTo }
}

export default function ReportingPage() {
  const [period, setPeriod] = useState<Period>('month')
  const [customFrom, setCustomFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30)
    return d.toISOString().split('T')[0]
  })
  const [customTo, setCustomTo] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(true)

  // Data
  const [reservations, setReservations] = useState<any[]>([])
  const [collections, setCollections] = useState<any[]>([])
  const [charges, setCharges] = useState<any[]>([])
  const [agentTransactions, setAgentTransactions] = useState<any[]>([])
  const [partners, setPartners] = useState<any[]>([])

  const fetchData = useCallback(async () => {
    setLoading(true)
    const { from, to } = getDateRange(period, customFrom, customTo)
    const fromTs = `${from}T00:00:00`
    const toTs = `${to}T23:59:59`

    const [
      { data: res },
      { data: col },
      { data: ch },
      { data: tx },
      { data: pt },
    ] = await Promise.all([
      supabase.from('reservations').select('*, vehicles(name), partners(name)').neq('status', 'cancelled').gte('created_at', fromTs).lte('created_at', toTs),
      supabase.from('agent_collections').select('*').gte('created_at', fromTs).lte('created_at', toTs),
      supabase.from('reservation_charges').select('*').gte('created_at', fromTs).lte('created_at', toTs),
      supabase.from('agent_transactions').select('*').gte('created_at', fromTs).lte('created_at', toTs),
      supabase.from('partners').select('*, reservations(total_price, commission_amount, status)').eq('is_active', true),
    ])

    setReservations(res || [])
    setCollections(col || [])
    setCharges(ch || [])
    setAgentTransactions(tx || [])
    setPartners(pt || [])
    setLoading(false)
  }, [period, customFrom, customTo])

  useEffect(() => { fetchData() }, [fetchData])

  // === KALKULACIJE ===
  const closed = reservations.filter(r => r.status === 'closed')
  const issued = reservations.filter(r => r.status === 'issued')
  const confirmed = reservations.filter(r => r.status === 'confirmed' || r.status === 'pending')

  const totalRevenue = closed.reduce((s, r) => s + (r.final_total || r.total_price || 0), 0)
    + charges.reduce((s, c) => s + (c.amount || 0), 0)
  const totalCash = collections.filter(c => c.amount > 0).reduce((s, c) => s + (c.cash_amount || 0), 0)
  const totalCard = collections.filter(c => c.amount > 0).reduce((s, c) => s + (c.card_amount || 0), 0)
  const totalWire = collections.filter(c => c.amount > 0).reduce((s, c) => s + (c.wire_amount || 0), 0)
  const totalExpenses = agentTransactions.filter(t => t.type === 'expense' && t.transfer_status !== 'pending').reduce((s, t) => s + t.amount, 0)
  const totalCommissions = closed.reduce((s, r) => s + (r.commission_amount || 0), 0)
  const neto = totalRevenue - totalExpenses - totalCommissions

  // Po agentu
  const byAgent: Record<string, { name: string; revenue: number; cash: number; card: number; wire: number; count: number }> = {}
  collections.filter(c => c.amount > 0).forEach(c => {
    if (!byAgent[c.agent_name]) byAgent[c.agent_name] = { name: c.agent_name, revenue: 0, cash: 0, card: 0, wire: 0, count: 0 }
    byAgent[c.agent_name].revenue += c.amount
    byAgent[c.agent_name].cash += c.cash_amount || 0
    byAgent[c.agent_name].card += c.card_amount || 0
    byAgent[c.agent_name].wire += c.wire_amount || 0
    byAgent[c.agent_name].count += 1
  })

  // Po vozilu
  const byVehicle: Record<string, { name: string; revenue: number; count: number; days: number }> = {}
  closed.forEach(r => {
    const name = r.vehicles?.name || 'Nepoznato'
    if (!byVehicle[name]) byVehicle[name] = { name, revenue: 0, count: 0, days: 0 }
    byVehicle[name].revenue += r.final_total || r.total_price || 0
    byVehicle[name].count += 1
    const days = Math.ceil((new Date(r.return_date).getTime() - new Date(r.pickup_date).getTime()) / 86400000)
    byVehicle[name].days += days
  })

  // Po načinu plaćanja
  const pmTotal = totalCash + totalCard + totalWire
  const pmData = [
    { label: 'Keš', value: totalCash, color: '#1D9E75', bg: '#E1F5EE' },
    { label: 'Kartica', value: totalCard, color: '#185FA5', bg: '#E6F1FB' },
    { label: 'Virmanski', value: totalWire, color: '#BA7517', bg: '#FAEEDA' },
  ]

  // Partner statistike
  const partnerStats = partners.map(p => {
    const pRes = (p.reservations || [])
    const completed = pRes.filter((r: any) => r.status === 'closed' || r.status === 'completed')
    const revenue = completed.reduce((s: number, r: any) => s + (r.total_price || 0), 0)
    const commission = completed.reduce((s: number, r: any) => s + (r.commission_amount || 0), 0)
    return { ...p, res_count: pRes.length, revenue, commission }
  }).filter(p => p.res_count > 0).sort((a, b) => b.revenue - a.revenue).slice(0, 10)

  const { from, to } = getDateRange(period, customFrom, customTo)

  const card = (label: string, value: string, sub: string, color: string, bg: string) => (
    <div style={{ background: bg, borderRadius: 12, padding: '16px 20px' }}>
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{sub}</div>
    </div>
  )

  function exportCSV() {
    const rows = [
      ['Ref', 'Gost', 'Vozilo', 'Status', 'Preuzimanje', 'Vraćanje', 'Iznos', 'Agent'],
      ...reservations.map(r => [r.ref_code, r.guest_name, r.vehicles?.name, r.status, r.pickup_date, r.return_date, r.final_total || r.total_price, r.issued_by || ''])
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `izvjestaj_${from}_${to}.csv`
    a.click()
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#111' }}>Finansijski izvještaj</h1>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>{from} — {to}</p>
        </div>
        <button onClick={exportCSV} style={{ padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', fontSize: 13, cursor: 'pointer', color: '#374151' }}>
          Izvoz CSV
        </button>
      </div>

      {/* Period filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, alignItems: 'center', flexWrap: 'wrap' }}>
        {[['today', 'Danas'], ['week', '7 dana'], ['month', '30 dana'], ['custom', 'Prilagođeno']].map(([val, lbl]) => (
          <button key={val} onClick={() => setPeriod(val as Period)}
            style={{ padding: '7px 16px', fontSize: 13, border: '1px solid', borderColor: period === val ? '#1D9E75' : '#e5e7eb', borderRadius: 20, background: period === val ? '#E1F5EE' : '#fff', color: period === val ? '#085041' : '#6b7280', cursor: 'pointer', fontWeight: period === val ? 600 : 400 }}>
            {lbl}
          </button>
        ))}
        {period === 'custom' && (
          <>
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
              style={{ padding: '7px 10px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, color: '#111' }} />
            <span style={{ color: '#9ca3af' }}>—</span>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
              style={{ padding: '7px 10px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, color: '#111' }} />
          </>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af' }}>Učitavanje...</div>
      ) : (
        <>
          {/* Ključne metrike */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 12, marginBottom: 24 }}>
            {card('Ukupan prihod', `${totalRevenue.toFixed(0)}€`, `${closed.length} zatvorenih rezervacija`, '#1D9E75', '#E1F5EE')}
            {card('Neto prihod', `${neto.toFixed(0)}€`, `Nakon provizija i rashoda`, neto >= 0 ? '#085041' : '#dc2626', neto >= 0 ? '#E1F5EE' : '#FCEBEB')}
            {card('Provizije partnerima', `${totalCommissions.toFixed(0)}€`, `${partners.filter(p => p.res_count > 0).length} aktivnih partnera`, '#BA7517', '#FAEEDA')}
            {card('Rashodi', `${totalExpenses.toFixed(0)}€`, 'Troškovi agenata', '#dc2626', '#FCEBEB')}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 12, marginBottom: 28 }}>
            {card('Rezervacije ukupno', String(reservations.length), `${confirmed.length} aktivnih`, '#185FA5', '#E6F1FB')}
            {card('Zatvorene', String(closed.length), 'Završene rezervacije', '#374151', '#f3f4f6')}
            {card('U toku', String(issued.length), 'Vozila van', '#1D9E75', '#E1F5EE')}
            {card('Prosječna rezervacija', closed.length > 0 ? `${(totalRevenue / closed.length).toFixed(0)}€` : '—', 'Po rezervaciji', '#185FA5', '#E6F1FB')}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
            {/* Načini plaćanja */}
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '20px 24px' }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#111', marginBottom: 16 }}>Načini plaćanja</div>
              {pmData.map(m => (
                <div key={m.label} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, color: '#374151' }}>{m.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: m.color }}>{m.value.toFixed(0)}€</span>
                  </div>
                  <div style={{ height: 6, background: '#f3f4f6', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pmTotal > 0 ? (m.value / pmTotal) * 100 : 0}%`, background: m.color, borderRadius: 3, transition: 'width 0.5s' }} />
                  </div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                    {pmTotal > 0 ? Math.round((m.value / pmTotal) * 100) : 0}% od ukupnog
                  </div>
                </div>
              ))}
              <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: '#6b7280' }}>Ukupno naplaćeno</span>
                <span style={{ fontWeight: 700, color: '#111' }}>{pmTotal.toFixed(0)}€</span>
              </div>
            </div>

            {/* Po agentu */}
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '20px 24px' }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#111', marginBottom: 16 }}>Prihodi po agentu</div>
              {Object.values(byAgent).sort((a, b) => b.revenue - a.revenue).map(a => (
                <div key={a.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f3f4f6', fontSize: 13 }}>
                  <div>
                    <div style={{ fontWeight: 500, color: '#111' }}>{a.name}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>
                      K:{a.cash.toFixed(0)}€ · C:{a.card.toFixed(0)}€ · V:{a.wire.toFixed(0)}€
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, color: '#1D9E75' }}>{a.revenue.toFixed(0)}€</div>
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>{a.count} naplata</div>
                  </div>
                </div>
              ))}
              {Object.keys(byAgent).length === 0 && <div style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', padding: 20 }}>Nema podataka</div>}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
            {/* Top vozila */}
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '20px 24px' }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#111', marginBottom: 16 }}>Top vozila po prihodu</div>
              {Object.values(byVehicle).sort((a, b) => b.revenue - a.revenue).slice(0, 8).map(v => (
                <div key={v.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f3f4f6', fontSize: 13 }}>
                  <div>
                    <div style={{ fontWeight: 500, color: '#111' }}>{v.name}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>{v.count} rez · {v.days} dana</div>
                  </div>
                  <div style={{ fontWeight: 700, color: '#1D9E75' }}>{v.revenue.toFixed(0)}€</div>
                </div>
              ))}
              {Object.keys(byVehicle).length === 0 && <div style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', padding: 20 }}>Nema podataka</div>}
            </div>

            {/* Top partneri */}
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '20px 24px' }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#111', marginBottom: 16 }}>Top partneri</div>
              {partnerStats.map(p => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f3f4f6', fontSize: 13 }}>
                  <div>
                    <div style={{ fontWeight: 500, color: '#111' }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>{p.res_count} rezervacija · prov: {p.commission.toFixed(0)}€</div>
                  </div>
                  <div style={{ fontWeight: 700, color: '#1D9E75' }}>{p.revenue.toFixed(0)}€</div>
                </div>
              ))}
              {partnerStats.length === 0 && <div style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', padding: 20 }}>Nema podataka</div>}
            </div>
          </div>

          {/* Lista rezervacija */}
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#111' }}>Rezervacije u periodu</div>
              <span style={{ fontSize: 12, color: '#9ca3af' }}>{reservations.length} ukupno</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {['Ref', 'Gost', 'Vozilo', 'Period', 'Iznos', 'Status', 'Agent'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 500, fontSize: 12, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reservations.slice(0, 50).map(r => {
                  const stColors: Record<string, string> = { closed: '#374151', issued: '#0C447C', confirmed: '#085041', pending: '#633806' }
                  const stBg: Record<string, string> = { closed: '#f3f4f6', issued: '#E6F1FB', confirmed: '#E1F5EE', pending: '#FAEEDA' }
                  return (
                    <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: 11, color: '#9ca3af' }}>{r.ref_code}</td>
                      <td style={{ padding: '10px 16px', fontWeight: 500, color: '#111' }}>{r.guest_name}</td>
                      <td style={{ padding: '10px 16px', color: '#374151' }}>{r.vehicles?.name || '—'}</td>
                      <td style={{ padding: '10px 16px', fontSize: 12, color: '#6b7280' }}>{r.pickup_date} → {r.return_date}</td>
                      <td style={{ padding: '10px 16px', fontWeight: 600, color: '#1D9E75' }}>{r.final_total || r.total_price}€</td>
                      <td style={{ padding: '10px 16px' }}>
                        <span style={{ fontSize: 11, background: stBg[r.status] || '#f3f4f6', color: stColors[r.status] || '#374151', padding: '2px 8px', borderRadius: 20, fontWeight: 500 }}>
                          {r.status === 'closed' ? 'Zatvoreno' : r.status === 'issued' ? 'Izdato' : r.status === 'confirmed' ? 'Potvrđeno' : 'Na čekanju'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 16px', fontSize: 12, color: '#6b7280' }}>{r.issued_by || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {reservations.length > 50 && (
              <div style={{ padding: '12px 20px', textAlign: 'center', fontSize: 12, color: '#9ca3af', borderTop: '1px solid #e5e7eb' }}>
                Prikazano 50 od {reservations.length}. Koristite Izvoz CSV za kompletan pregled.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
