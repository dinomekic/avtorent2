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
  if (period === 'week') { const d = new Date(now); d.setDate(d.getDate() - 7); return { from: d.toISOString().split('T')[0], to: today } }
  if (period === 'month') { const d = new Date(now); d.setDate(d.getDate() - 30); return { from: d.toISOString().split('T')[0], to: today } }
  return { from: customFrom, to: customTo }
}

export default function PerformancePage() {
  const [period, setPeriod] = useState<Period>('month')
  const [customFrom, setCustomFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0] })
  const [customTo, setCustomTo] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(true)
  const [agents, setAgents] = useState<any[]>([])
  const [collections, setCollections] = useState<any[]>([])
  const [charges, setCharges] = useState<any[]>([])
  const [sessions, setSessions] = useState<any[]>([])
  const [editAgent, setEditAgent] = useState<any | null>(null)
  const [editForm, setEditForm] = useState<any>({})
  const [editSaving, setEditSaving] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const [serviceActivities, setServiceActivities] = useState<any[]>([])
  const [historicalData, setHistoricalData] = useState<any[]>([])

  const fetchData = useCallback(async () => {
    setLoading(true)
    const { from, to } = getDateRange(period, customFrom, customTo)
    const fromTs = `${from}T00:00:00`
    const toTs = `${to}T23:59:59`

    const [{ data: ag }, { data: col }, { data: ch }, { data: sess }] = await Promise.all([
      supabase.from('agents').select('*').order('full_name'),
      supabase.from('agent_collections').select('*').gte('created_at', fromTs).lte('created_at', toTs),
      supabase.from('reservation_charges').select('*').gte('created_at', fromTs).lte('created_at', toTs),
      supabase.from('agent_sessions').select('*').gte('logged_in_at', fromTs).lte('logged_in_at', toTs),
    ])
    setAgents(ag || [])
    setCollections(col || [])
    setCharges(ch || [])
    setSessions(sess || [])

    // Fetch service activities
    const { data: sa } = await supabase
      .from('service_activities')
      .select('reported_by, activity_type, reported_at')
      .gte('reported_at', fromTs)
      .lte('reported_at', toTs)
    setServiceActivities(sa || [])

    // Fetch last 12 months of collections for historical analysis
    const twelveMonthsAgo = new Date(); twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)
    const { data: hist } = await supabase
      .from('agent_collections')
      .select('agent_name, amount, collection_type, created_at')
      .eq('collection_type', 'rental')
      .gte('created_at', twelveMonthsAgo.toISOString())
    setHistoricalData(hist || [])

    setLoading(false)
  }, [period, customFrom, customTo])

  useEffect(() => { fetchData() }, [fetchData])

  async function saveAgent() {
    if (!editAgent) return
    setEditSaving(true)
    await supabase.from('agents').update({
      salary: parseFloat(editForm.salary || '0'),
      bonus_per_issue: parseFloat(editForm.bonus_per_issue || '0'),
      bonus_per_close: parseFloat(editForm.bonus_per_close || '0'),
      bonus_per_extra: parseFloat(editForm.bonus_per_extra || '0'),
      notes: editForm.notes || null,
    }).eq('id', editAgent.id)
    setEditSaving(false)
    setEditAgent(null)
    fetchData()
  }

  const { from, to } = getDateRange(period, customFrom, customTo)

  const agentStats = agents.map(agent => {
    const name = agent.full_name
    const agentCols = collections.filter(c => c.agent_name === name)
    const issues = agentCols.filter(c => c.collection_type === 'rental').length
    const closes = agentCols.filter(c => c.collection_type === 'rental').length
    const extraCharges = charges.filter(c => c.agent_name === name && c.charge_type === 'extra')
    const totalCollected = agentCols.filter(c => c.amount > 0).reduce((s, c) => s + c.amount, 0)
    const agentSessions = sessions.filter(s => s.agent_name === name)
    const totalMinutes = agentSessions.reduce((s, sess) => s + (sess.duration_minutes || 0), 0)
    const bonusIssue = issues * (agent.bonus_per_issue || 0)
    const bonusClose = closes * (agent.bonus_per_close || 0)
    const bonusExtra = extraCharges.length * (agent.bonus_per_extra || 0)
    const totalBonus = bonusIssue + bonusClose + bonusExtra
    const totalComp = (agent.salary || 0) + totalBonus
    const inspections = serviceActivities.filter(a => a.reported_by === name && a.activity_type === 'inspection').length
    const faults = serviceActivities.filter(a => a.reported_by === name && a.activity_type === 'fault').length
    return { ...agent, issues, closes, extras: extraCharges.length, totalCollected, totalMinutes, totalBonus, totalComp, sessionCount: agentSessions.length, inspections, faults }
  })

  const selected = selectedAgent ? agentStats.find(a => a.full_name === selectedAgent) : null

  // Agregirane metrike
  const totalIssues = agentStats.reduce((s, a) => s + a.issues, 0)
  const totalCloses = agentStats.reduce((s, a) => s + a.closes, 0)
  const totalAgentExtrasValue = charges.filter(c => c.charge_type === 'extra').reduce((s, c) => s + (c.amount || 0), 0)

  // Troškovi po izdavanju — tekući i prethodni mjesec
  const now = new Date()
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString()

  const currentMonthIssues = historicalData.filter(c => c.created_at >= currentMonthStart).length
  const prevMonthIssues = historicalData.filter(c => c.created_at >= prevMonthStart && c.created_at <= prevMonthEnd).length
  const totalSalariesCurrentMonth = agents.reduce((s, a) => s + (a.salary || 0), 0)
  const costPerIssueCurrent = currentMonthIssues > 0 ? totalSalariesCurrentMonth / currentMonthIssues : 0
  const costPerIssuePrev = prevMonthIssues > 0 ? totalSalariesCurrentMonth / prevMonthIssues : 0

  // Best i worst month (najniža i najviša cijena po izdavanju)
  const monthlyStats: Record<string, { issues: number; month: string }> = {}
  historicalData.forEach(c => {
    const month = c.created_at.slice(0, 7) // YYYY-MM
    if (!monthlyStats[month]) monthlyStats[month] = { issues: 0, month }
    monthlyStats[month].issues++
  })
  const monthsWithData = Object.values(monthlyStats).filter(m => m.issues > 0).map(m => ({
    ...m,
    costPerIssue: totalSalariesCurrentMonth / m.issues,
  })).sort((a, b) => a.costPerIssue - b.costPerIssue)
  const bestMonth = monthsWithData[0]
  const worstMonth = monthsWithData[monthsWithData.length - 1]

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: '#111' }}>Performanse agenata</h1>
        <p style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>{from} — {to}</p>
      </div>

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

      {loading ? <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af' }}>Učitavanje...</div> : (
        <>
          {/* Agregirane metrike */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 12, marginBottom: 16 }}>
            {[
              { label: 'Ukupno izdavanja', value: String(totalIssues), color: '#185FA5', bg: '#E6F1FB', sub: 'u odabranom periodu' },
              { label: 'Ukupno preuzimanja', value: String(totalCloses), color: '#1D9E75', bg: '#E1F5EE', sub: 'u odabranom periodu' },
              { label: 'Dodaci (agenti)', value: `${totalAgentExtrasValue.toFixed(0)}€`, color: '#BA7517', bg: '#FAEEDA', sub: 'vrijednost prodatih' },
              { label: 'Agenti ukupno', value: String(agents.length), color: '#374151', bg: '#f3f4f6', sub: 'aktivnih' },
            ].map(m => (
              <div key={m.label} style={{ background: m.bg, borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>{m.label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: m.color }}>{m.value}</div>
                <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>{m.sub}</div>
              </div>
            ))}
          </div>

          {/* Trošak po izdavanju */}
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '16px 20px', marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#111', marginBottom: 14 }}>Trošak agenta po izdavanju</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 12 }}>
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '12px 14px' }}>
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Tekući mjesec</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#185FA5' }}>{costPerIssueCurrent > 0 ? `${costPerIssueCurrent.toFixed(0)}€` : '—'}</div>
                <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>{currentMonthIssues} izdavanja</div>
              </div>
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '12px 14px' }}>
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Prethodni mjesec</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#374151' }}>{costPerIssuePrev > 0 ? `${costPerIssuePrev.toFixed(0)}€` : '—'}</div>
                <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>{prevMonthIssues} izdavanja</div>
              </div>
              <div style={{ border: '1px solid #E1F5EE', background: '#f0fdf8', borderRadius: 8, padding: '12px 14px' }}>
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Najbolji mjesec</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#1D9E75' }}>{bestMonth ? `${bestMonth.costPerIssue.toFixed(0)}€` : '—'}</div>
                <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>{bestMonth ? `${bestMonth.month} · ${bestMonth.issues} izd.` : ''}</div>
              </div>
              <div style={{ border: '1px solid #FCEBEB', background: '#fff5f5', borderRadius: 8, padding: '12px 14px' }}>
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Najgori mjesec</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#dc2626' }}>{worstMonth ? `${worstMonth.costPerIssue.toFixed(0)}€` : '—'}</div>
                <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>{worstMonth ? `${worstMonth.month} · ${worstMonth.issues} izd.` : ''}</div>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, marginBottom: 24 }}>
            {agentStats.map(agent => (
              <div key={agent.id} onClick={() => setSelectedAgent(selectedAgent === agent.full_name ? null : agent.full_name)}
                style={{ background: '#fff', border: `2px solid ${selectedAgent === agent.full_name ? '#1D9E75' : '#e5e7eb'}`, borderRadius: 12, padding: '18px 20px', cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15, color: '#111' }}>{agent.full_name}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{agent.role || 'agent'}</div>
                  </div>
                  <button onClick={e => { e.stopPropagation(); setEditAgent(agent); setEditForm({ salary: agent.salary || '', bonus_per_issue: agent.bonus_per_issue || '', bonus_per_close: agent.bonus_per_close || '', bonus_per_extra: agent.bonus_per_extra || '', notes: agent.notes || '' }) }}
                    style={{ padding: '4px 10px', fontSize: 11, border: '1px solid #d1d5db', borderRadius: 6, background: 'transparent', cursor: 'pointer', color: '#6b7280' }}>
                    Uredi platu
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                  {[
                    { label: 'Izdavanja', value: agent.issues, color: '#185FA5', bg: '#E6F1FB' },
                    { label: 'Preuzimanja', value: agent.closes, color: '#1D9E75', bg: '#E1F5EE' },
                    { label: 'Dodaci', value: agent.extras, color: '#BA7517', bg: '#FAEEDA' },
                    { label: 'Naplaćeno', value: `${agent.totalCollected.toFixed(0)}€`, color: '#111', bg: '#f3f4f6' },
                  ].map(m => (
                    <div key={m.label} style={{ background: m.bg, borderRadius: 8, padding: '8px 10px' }}>
                      <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 2 }}>{m.label}</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: m.color }}>{m.value}</div>
                    </div>
                  ))}
                </div>
                <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: '#6b7280' }}>Fiksna plata</span>
                    <span style={{ fontWeight: 500 }}>{(agent.salary || 0).toFixed(0)}€</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: '#6b7280' }}>Bonus</span>
                    <span style={{ fontWeight: 500, color: '#1D9E75' }}>+{agent.totalBonus.toFixed(0)}€</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 6, paddingTop: 6, borderTop: '1px solid #f3f4f6' }}>
                    <span style={{ fontWeight: 600 }}>Ukupno</span>
                    <span style={{ fontWeight: 700, color: '#1D9E75' }}>{agent.totalComp.toFixed(0)}€</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 6, color: '#9ca3af' }}>
                    <span>⏱ {Math.floor(agent.totalMinutes / 60)}h {agent.totalMinutes % 60}m online</span>
                    <span>{agent.sessionCount} sesija</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {selected && (
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '20px 24px' }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#111', marginBottom: 16 }}>Detalji — {selected.full_name}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 10 }}>KPI Breakdown</div>
                  {[
                    ['Izdavanja', selected.issues, selected.bonus_per_issue || 0, selected.issues * (selected.bonus_per_issue || 0)],
                    ['Preuzimanja', selected.closes, selected.bonus_per_close || 0, selected.closes * (selected.bonus_per_close || 0)],
                    ['Dodaci', selected.extras, selected.bonus_per_extra || 0, selected.extras * (selected.bonus_per_extra || 0)],
                    ['Provjere vozila', selected.inspections, 0, 0],
                    ['Kvarovi prijavljeni', selected.faults, 0, 0],
                  ].map(([label, count, rate, bonus]) => (
                    <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f3f4f6', fontSize: 12 }}>
                      <span style={{ color: '#6b7280' }}>{label}</span>
                      <span>{count} × {rate}€ = <strong style={{ color: '#1D9E75' }}>{(bonus as number).toFixed(0)}€</strong></span>
                    </div>
                  ))}
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 10 }}>Kompenzacija</div>
                  {[
                    ['Fiksna plata', (selected.salary || 0).toFixed(0) + '€'],
                    ['Bonus izdavanja', (selected.issues * (selected.bonus_per_issue || 0)).toFixed(0) + '€'],
                    ['Bonus preuzimanja', (selected.closes * (selected.bonus_per_close || 0)).toFixed(0) + '€'],
                    ['Bonus dodaci', (selected.extras * (selected.bonus_per_extra || 0)).toFixed(0) + '€'],
                    ['UKUPNO', selected.totalComp.toFixed(0) + '€'],
                  ].map(([label, value], i) => (
                    <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f3f4f6', fontSize: 12, fontWeight: i === 4 ? 700 : 400 }}>
                      <span style={{ color: i === 4 ? '#111' : '#6b7280' }}>{label}</span>
                      <span style={{ color: i === 4 ? '#1D9E75' : '#111' }}>{value}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 10 }}>Aktivnost</div>
                  {[
                    ['Ukupno naplaćeno', `${selected.totalCollected.toFixed(0)}€`],
                    ['Sesije na platformi', `${selected.sessionCount}`],
                    ['Ukupno online', `${Math.floor(selected.totalMinutes / 60)}h ${selected.totalMinutes % 60}m`],
                  ].map(([label, value]) => (
                    <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f3f4f6', fontSize: 12 }}>
                      <span style={{ color: '#6b7280' }}>{label}</span>
                      <span style={{ color: '#111', fontWeight: 500 }}>{value}</span>
                    </div>
                  ))}
                  {selected.notes && (
                    <div style={{ marginTop: 10, padding: '8px 10px', background: '#f9fafb', borderRadius: 8, fontSize: 12, color: '#6b7280', fontStyle: 'italic' }}>
                      {selected.notes}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {editAgent && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: '24px', maxWidth: 400, width: '100%' }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#111', marginBottom: 4 }}>Plata i bonusi</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 18 }}>{editAgent.full_name}</div>
            {[
              { key: 'salary', label: 'Fiksna plata (€/mjesec)' },
              { key: 'bonus_per_issue', label: 'Bonus po izdavanju (€)' },
              { key: 'bonus_per_close', label: 'Bonus po preuzimanju (€)' },
              { key: 'bonus_per_extra', label: 'Bonus po prodanom dodatku (€)' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>{f.label}</label>
                <input type="number" step="0.01" value={editForm[f.key]} onChange={e => setEditForm((ef: any) => ({ ...ef, [f.key]: e.target.value }))}
                  style={{ width: '100%', padding: '9px 12px', fontSize: 14, border: '1px solid #d1d5db', borderRadius: 8, color: '#111', boxSizing: 'border-box' as const }} />
              </div>
            ))}
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Napomena</label>
              <textarea value={editForm.notes} onChange={e => setEditForm((ef: any) => ({ ...ef, notes: e.target.value }))} placeholder="Opciono..."
                style={{ width: '100%', padding: '9px 12px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, minHeight: 60, resize: 'vertical' as const, color: '#111', boxSizing: 'border-box' as const }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={saveAgent} disabled={editSaving}
                style={{ flex: 2, padding: '10px', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                {editSaving ? '...' : 'Sačuvaj'}
              </button>
              <button onClick={() => setEditAgent(null)} style={{ flex: 1, padding: '10px', border: '1px solid #d1d5db', borderRadius: 8, background: 'transparent', fontSize: 13, cursor: 'pointer', color: '#374151' }}>
                Odustani
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
