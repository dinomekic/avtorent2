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
  const [rezervacije, setRezervacije] = useState<any[]>([])
  const [transakcije, setTransakcije] = useState<any[]>([])
  const [sessions, setSessions] = useState<any[]>([])
  const [editAgent, setEditAgent] = useState<any | null>(null)
  const [editForm, setEditForm] = useState<any>({})
  const [editSaving, setEditSaving] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const { from, to } = getDateRange(period, customFrom, customTo)

    const [{ data: ag }, { data: rez }, { data: trans }, { data: sess }] = await Promise.all([
      supabase.from('agents').select('*').eq('is_active', true).order('full_name'),
      supabase.from('rezervacije').select('id, ko_je_izdao, ko_je_preuzeo, od_datuma, do_datuma, ukupno_naplata, naplaceno, br_tablica, daily_status')
        .gte('od_datuma', from).lte('od_datuma', to),
      supabase.from('transakcije').select('osoba, osobaemail, iznos, kategorija, tip_transakcije, datum, status')
        .gte('datum', from).lte('datum', to).eq('status', 'Zavrseno'),
      supabase.from('agent_sessions').select('agent_name, duration_minutes, logged_in_at').gte('logged_in_at', `${from}T00:00:00`).lte('logged_in_at', `${to}T23:59:59`),
    ])

    setAgents(ag || [])
    setRezervacije(rez || [])
    setTransakcije(trans || [])
    setSessions(sess || [])
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
      notes: editForm.notes || null,
    }).eq('id', editAgent.id)
    setEditSaving(false)
    setEditAgent(null)
    fetchData()
  }

  const { from, to } = getDateRange(period, customFrom, customTo)

  // Normalizuj ime agenta za matching
  function normIme(s: string) {
    return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
  }

  const agentStats = agents.map(agent => {
    const ime = agent.full_name || ''
    const imeNorm = normIme(ime)

    // Izdavanja — ko_je_izdao
    const izdavanja = rezervacije.filter(r => normIme(r.ko_je_izdao || '') === imeNorm)
    // Preuzimanja — ko_je_preuzeo
    const preuzimanja = rezervacije.filter(r => normIme(r.ko_je_preuzeo || '') === imeNorm)

    // Transakcije — po imenu ili emailu
    const agentEmail = (agent.email || '').toLowerCase().trim()
    const agentTrans = transakcije.filter(t =>
      normIme(t.osoba || '') === imeNorm || (t.osobaemail || '').toLowerCase().trim() === agentEmail
    )

    // Naplaćeno (prilivu)
    const naplaceno = agentTrans
      .filter(t => t.tip_transakcije === 'priliv' && ['Izdavanje vozila', 'Naplata Duga', 'Depozit'].includes(t.kategorija))
      .reduce((s: number, t: any) => s + Math.abs(parseFloat(t.iznos || 0)), 0)

    // Odlivi (troškovi)
    const troskovi = agentTrans
      .filter(t => t.tip_transakcije === 'odliv')
      .reduce((s: number, t: any) => s + Math.abs(parseFloat(t.iznos || 0)), 0)

    // Sesije
    const agentSessions = sessions.filter(s => normIme(s.agent_name || '') === imeNorm)
    const totalMinutes = agentSessions.reduce((s: number, sess: any) => s + (sess.duration_minutes || 0), 0)

    // Bonusi
    const bonusIssue = izdavanja.length * (agent.bonus_per_issue || 0)
    const bonusClose = preuzimanja.length * (agent.bonus_per_close || 0)
    const totalBonus = bonusIssue + bonusClose
    const totalComp = (agent.salary || 0) + totalBonus

    return {
      ...agent,
      izdavanja: izdavanja.length,
      preuzimanja: preuzimanja.length,
      naplaceno,
      troskovi,
      totalMinutes,
      sessionCount: agentSessions.length,
      totalBonus,
      totalComp,
      bonusIssue,
      bonusClose,
    }
  })

  const selected = selectedAgent ? agentStats.find(a => a.full_name === selectedAgent) : null
  const totalIzdavanja = agentStats.reduce((s, a) => s + a.izdavanja, 0)
  const totalPreuzimanja = agentStats.reduce((s, a) => s + a.preuzimanja, 0)
  const totalNaplaceno = agentStats.reduce((s, a) => s + a.naplaceno, 0)

  const inp: React.CSSProperties = { width: '100%', padding: '9px 12px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, color: '#111', boxSizing: 'border-box' as const }
  const lbl: React.CSSProperties = { fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: '#111' }}>Performanse agenata</h1>
        <p style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>{from} — {to}</p>
      </div>

      {/* Period filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' as const }}>
        {([['today', 'Danas'], ['week', '7 dana'], ['month', '30 dana'], ['custom', 'Prilagođeno']] as const).map(([val, lbl]) => (
          <button key={val} onClick={() => setPeriod(val)}
            style={{ padding: '7px 16px', fontSize: 13, border: '1px solid', borderColor: period === val ? '#1D9E75' : '#e5e7eb', borderRadius: 20, background: period === val ? '#E1F5EE' : '#fff', color: period === val ? '#085041' : '#6b7280', cursor: 'pointer', fontWeight: period === val ? 600 : 400 }}>
            {lbl}
          </button>
        ))}
        {period === 'custom' && (
          <>
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} style={{ padding: '7px 10px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, color: '#111' }} />
            <span style={{ color: '#9ca3af' }}>—</span>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} style={{ padding: '7px 10px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, color: '#111' }} />
          </>
        )}
      </div>

      {loading ? <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af' }}>Učitavanje...</div> : (<>

        {/* Agregirane metrike */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Ukupno izdavanja', value: String(totalIzdavanja), color: '#185FA5', bg: '#E6F1FB' },
            { label: 'Ukupno preuzimanja', value: String(totalPreuzimanja), color: '#1D9E75', bg: '#E1F5EE' },
            { label: 'Ukupno naplaćeno', value: `${totalNaplaceno.toFixed(0)}€`, color: '#BA7517', bg: '#FAEEDA' },
            { label: 'Aktivnih agenata', value: String(agents.length), color: '#374151', bg: '#f3f4f6' },
          ].map(m => (
            <div key={m.label} style={{ background: m.bg, borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>{m.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: m.color }}>{m.value}</div>
            </div>
          ))}
        </div>

        {/* Kartice agenata */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, marginBottom: 24 }}>
          {agentStats.map(agent => (
            <div key={agent.id}
              onClick={() => setSelectedAgent(selectedAgent === agent.full_name ? null : agent.full_name)}
              style={{ background: '#fff', border: `2px solid ${selectedAgent === agent.full_name ? '#1D9E75' : '#e5e7eb'}`, borderRadius: 12, padding: '18px 20px', cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15, color: '#111' }}>{agent.full_name}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{agent.role || 'agent'}</div>
                </div>
                <button onClick={e => { e.stopPropagation(); setEditAgent(agent); setEditForm({ salary: agent.salary || '', bonus_per_issue: agent.bonus_per_issue || '', bonus_per_close: agent.bonus_per_close || '', notes: agent.notes || '' }) }}
                  style={{ padding: '4px 10px', fontSize: 11, border: '1px solid #d1d5db', borderRadius: 6, background: 'transparent', cursor: 'pointer', color: '#6b7280' }}>
                  Uredi platu
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                {[
                  { label: 'Izdavanja', value: agent.izdavanja, color: '#185FA5', bg: '#E6F1FB' },
                  { label: 'Preuzimanja', value: agent.preuzimanja, color: '#1D9E75', bg: '#E1F5EE' },
                  { label: 'Naplaćeno', value: `${agent.naplaceno.toFixed(0)}€`, color: '#BA7517', bg: '#FAEEDA' },
                  { label: 'Troškovi', value: `${agent.troskovi.toFixed(0)}€`, color: '#dc2626', bg: '#FCEBEB' },
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

        {/* Detalji selektovanog agenta */}
        {selected && (
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '20px 24px', marginBottom: 20 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#111', marginBottom: 16 }}>Detalji — {selected.full_name}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 10 }}>KPI Breakdown</div>
                {[
                  ['Izdavanja', selected.izdavanja, selected.bonus_per_issue || 0, selected.bonusIssue],
                  ['Preuzimanja', selected.preuzimanja, selected.bonus_per_close || 0, selected.bonusClose],
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
                  ['Fiksna plata', `${(selected.salary || 0).toFixed(0)}€`],
                  ['Bonus izdavanja', `${selected.bonusIssue.toFixed(0)}€`],
                  ['Bonus preuzimanja', `${selected.bonusClose.toFixed(0)}€`],
                  ['UKUPNO', `${selected.totalComp.toFixed(0)}€`],
                ].map(([label, value], i) => (
                  <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f3f4f6', fontSize: 12, fontWeight: i === 3 ? 700 : 400 }}>
                    <span style={{ color: i === 3 ? '#111' : '#6b7280' }}>{label}</span>
                    <span style={{ color: i === 3 ? '#1D9E75' : '#111' }}>{value}</span>
                  </div>
                ))}
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 10 }}>Finansije</div>
                {[
                  ['Naplaćeno od gostiju', `${selected.naplaceno.toFixed(0)}€`],
                  ['Troškovi upisani', `${selected.troskovi.toFixed(0)}€`],
                  ['Online sesije', `${selected.sessionCount}`],
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
      </>)}

      {/* Edit plata modal */}
      {editAgent && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: '24px', maxWidth: 400, width: '100%' }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#111', marginBottom: 4 }}>Plata i bonusi</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 18 }}>{editAgent.full_name}</div>
            {[
              { key: 'salary', label: 'Fiksna plata (€/mjesec)' },
              { key: 'bonus_per_issue', label: 'Bonus po izdavanju (€)' },
              { key: 'bonus_per_close', label: 'Bonus po preuzimanju (€)' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 12 }}>
                <label style={lbl}>{f.label}</label>
                <input type="number" step="0.01" value={editForm[f.key]} onChange={e => setEditForm((ef: any) => ({ ...ef, [f.key]: e.target.value }))} style={inp} />
              </div>
            ))}
            <div style={{ marginBottom: 18 }}>
              <label style={lbl}>Napomena</label>
              <textarea value={editForm.notes} onChange={e => setEditForm((ef: any) => ({ ...ef, notes: e.target.value }))}
                style={{ ...inp, minHeight: 60, resize: 'vertical' as const }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={saveAgent} disabled={editSaving}
                style={{ flex: 2, padding: '10px', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                {editSaving ? '...' : 'Sačuvaj'}
              </button>
              <button onClick={() => setEditAgent(null)}
                style={{ flex: 1, padding: '10px', border: '1px solid #d1d5db', borderRadius: 8, background: 'transparent', fontSize: 13, cursor: 'pointer', color: '#374151' }}>
                Odustani
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
