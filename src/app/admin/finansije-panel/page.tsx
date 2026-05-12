'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Transakcija = {
  id: string; tip_transakcije: string; datum: string; kategorija: string
  iznos: number; vozilo: string | null; komentar: string | null; osoba: string | null
  osobaemail: string | null; timestamp_upisa: string | null; status: string | null
  primaocemail: string | null; slika1: string | null; slika2: string | null
  slika3: string | null; provereno: boolean | null; xstrik: string | null
}

type Rezervacija = {
  id: number; br_tablica: string; ime_prezime: string; telefon: string | null
  od_datuma: string; do_datuma: string; ukupno_naplata: number | null
  naplaceno: number | null; ko_je_izdao: string | null; ko_je_preuzeo: string | null
  daily_status: string; ugovor_slika: string | null; email: string | null
  nacin_placanja: string | null; depozit: number | null
}

type Agent = { id: string; email: string; full_name: string; role: string; is_active: boolean }
type Tab = 'transakcije' | 'ugovori'

export default function AdminFinansijePanelPage() {
  const [tab, setTab] = useState<Tab>('transakcije')
  const [transakcije, setTransakcije] = useState<Transakcija[]>([])
  const [rezervacije, setRezervacije] = useState<Rezervacija[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)

  // Transakcije filteri
  const [tSearch, setTSearch] = useState('')
  const [tOd, setTOd] = useState('')
  const [tDo, setTDo] = useState('')
  const [tTip, setTTip] = useState('all')
  const [tKat, setTKat] = useState('all')
  const [tVStatus, setTVStatus] = useState('all')
  const [selAgents, setSelAgents] = useState<Set<string>>(new Set())
  const [selKats, setSelKats] = useState<Set<string>>(new Set())
  const [katSearch, setKatSearch] = useState('')
  const [tLimit, setTLimit] = useState(50)

  // Ugovori filteri
  const [uSearch, setUSearch] = useState('')
  const [uOd, setUOd] = useState('')
  const [uDo, setUDo] = useState('')
  const [uStatus, setUStatus] = useState('all')

  const loadData = useCallback(async () => {
    setLoading(true)
    const [{ data: t }, { data: r }, { data: a }] = await Promise.all([
      supabase.from('transakcije').select('*').order('timestamp_upisa', { ascending: false }),
      supabase.from('rezervacije').select('id, br_tablica, ime_prezime, telefon, od_datuma, do_datuma, ukupno_naplata, naplaceno, ko_je_izdao, ko_je_preuzeo, daily_status, ugovor_slika, email, nacin_placanja, depozit').order('id', { ascending: false }),
      supabase.from('agents').select('id, email, full_name, role, is_active').eq('is_active', true).order('full_name'),
    ])
    setTransakcije(t || [])
    setRezervacije(r || [])
    setAgents(a || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // Email → ime mapa iz agents tabele
  const emailToName = useMemo(() => {
    const map: Record<string, string> = {}
    agents.forEach(a => { map[a.email.toLowerCase()] = a.full_name })
    return map
  }, [agents])

  function getName(email: string | null): string {
    if (!email) return '/'
    return emailToName[email.toLowerCase()] || email.split('@')[0]
  }

  // ── SALDO PO AGENTU ──
  const { saldo, dugFirma, stanjeSanduce } = useMemo(() => {
    const saldo: Record<string, number> = {}
    const dugFirma: Record<string, number> = {}
    let sOst = 0, sPre = 0

    transakcije.forEach(t => {
      if ((t.status || '').toLowerCase() !== 'zavrseno') return
      const iz = t.iznos || 0
      const kat = (t.kategorija || '').toUpperCase()
      const mail = (t.osobaemail || '').toLowerCase().trim()
      const pMail = (t.primaocemail || '').toLowerCase().trim()

      if (kat.includes('DUG PREMA FIRMI') && !kat.includes('UPLATA')) {
        if (mail) dugFirma[mail] = (dugFirma[mail] || 0) + iz
        if (pMail) dugFirma[pMail] = (dugFirma[pMail] || 0) - iz
      } else if (kat.includes('UPLATA DUGA PREMA FIRMI')) {
        if (mail) dugFirma[mail] = (dugFirma[mail] || 0) - iz
        if (pMail) dugFirma[pMail] = (dugFirma[pMail] || 0) + iz
      } else {
        if (mail) saldo[mail] = (saldo[mail] || 0) + iz
        if (pMail) saldo[pMail] = (saldo[pMail] || 0) - iz
      }

      if (kat.includes('OSTAVLJENO U SANDUCE')) sOst += Math.abs(iz)
      if (kat.includes('PREUZETO IZ SANDUCETA')) sPre += Math.abs(iz)
    })

    return { saldo, dugFirma, stanjeSanduce: sOst - sPre }
  }, [transakcije])

  // ── FILTER TRANSAKCIJE ──
  const filteredTrans = useMemo(() => {
    return transakcije.filter(t => {
      const q = tSearch.toLowerCase()
      const mail = (t.osobaemail || '').toLowerCase()
      const pMail = (t.primaocemail || '').toLowerCase()
      const ime = getName(t.osobaemail).toLowerCase()
      const matchQ = !q || ime.includes(q) || mail.includes(q) ||
        (t.kategorija || '').toLowerCase().includes(q) ||
        (t.vozilo || '').toLowerCase().includes(q) ||
        (t.komentar || '').toLowerCase().includes(q)
      const matchOd = !tOd || (t.datum || '') >= tOd
      const matchDo = !tDo || (t.datum || '') <= tDo
      const matchTip = tTip === 'all' || t.tip_transakcije === tTip
      const matchKat = selKats.size === 0 || selKats.has(t.kategorija || '')
      const matchAgent = selAgents.size === 0 || selAgents.has(mail) || selAgents.has(pMail)
      const vS = t.provereno ? 'ok' : t.xstrik === 'x' ? 'cancel' : 'pending'
      const matchV = tVStatus === 'all' || vS === tVStatus
      return matchQ && matchOd && matchDo && matchTip && matchKat && matchAgent && matchV
    })
  }, [transakcije, tSearch, tOd, tDo, tTip, selKats, selAgents, tVStatus])

  const totalPriliv = filteredTrans.filter(t => t.tip_transakcije === 'Priliv' && (t.status || '').toLowerCase() === 'zavrseno').reduce((s, t) => s + (t.iznos || 0), 0)
  const totalOdliv = filteredTrans.filter(t => t.tip_transakcije === 'Odliv' && (t.status || '').toLowerCase() === 'zavrseno').reduce((s, t) => s + Math.abs(t.iznos || 0), 0)
  const neto = totalPriliv - totalOdliv

  const allKats = useMemo(() => Array.from(new Set(transakcije.map(t => t.kategorija).filter(Boolean))).sort() as string[], [transakcije])
  const filteredKats = katSearch ? allKats.filter(k => k.toLowerCase().includes(katSearch.toLowerCase())) : allKats
  const tipovi = useMemo(() => Array.from(new Set(transakcije.map(t => t.tip_transakcije).filter(Boolean))) as string[], [transakcije])

  // Agenti koji se pojavljuju u transakcijama
  const transAgentEmails = useMemo(() => {
    const emails = new Set<string>()
    transakcije.forEach(t => {
      if (t.osobaemail) emails.add(t.osobaemail.toLowerCase())
      if (t.primaocemail) emails.add(t.primaocemail.toLowerCase())
    })
    return Array.from(emails).sort((a, b) => getName(a).localeCompare(getName(b)))
  }, [transakcije, emailToName])

  // ── FILTER UGOVORI ──
  const filteredUgovori = useMemo(() => {
    return rezervacije.filter(r => {
      const q = uSearch.toLowerCase()
      const matchQ = !q || (r.ime_prezime || '').toLowerCase().includes(q) ||
        (r.br_tablica || '').toLowerCase().includes(q) || String(r.id).includes(q)
      const matchOd = !uOd || (r.od_datuma || '') >= uOd
      const matchDo = !uDo || (r.od_datuma || '') <= uDo
      const dug = Math.max(0, (r.ukupno_naplata || 0) - (r.naplaceno || 0))
      const matchStatus = uStatus === 'all' ||
        (uStatus === 'dug' && dug > 0) ||
        (uStatus === 'bez_ugovora' && !r.ugovor_slika) ||
        (uStatus === 'placeno' && dug <= 0 && (r.ukupno_naplata || 0) > 0)
      return matchQ && matchOd && matchDo && matchStatus
    })
  }, [rezervacije, uSearch, uOd, uDo, uStatus])

  const ukupnoNaplaceno = filteredUgovori.reduce((s, r) => s + (r.naplaceno || 0), 0)
  const ukupnoDug = filteredUgovori.reduce((s, r) => s + Math.max(0, (r.ukupno_naplata || 0) - (r.naplaceno || 0)), 0)

  async function toggleProvereno(id: string, cur: boolean | null) {
    await supabase.from('transakcije').update({ provereno: !cur }).eq('id', id)
    setTransakcije(prev => prev.map(t => t.id === id ? { ...t, provereno: !cur } : t))
  }

  async function deleteTransakcija(id: string) {
    if (!confirm('Obrisati transakciju?')) return
    await supabase.from('transakcije').delete().eq('id', id)
    setTransakcije(prev => prev.filter(t => t.id !== id))
  }

  function toggleAgent(email: string) {
    setSelAgents(prev => { const n = new Set(prev); n.has(email) ? n.delete(email) : n.add(email); return n })
  }

  function toggleKat(kat: string) {
    setSelKats(prev => { const n = new Set(prev); n.has(kat) ? n.delete(kat) : n.add(kat); return n })
  }

  function resetAll() {
    setTSearch(''); setTOd(''); setTDo(''); setTTip('all')
    setTVStatus('all'); setSelAgents(new Set()); setSelKats(new Set()); setKatSearch('')
  }

  const fmt = (n: number) => n.toFixed(2) + '€'
  const fmtDate = (d: string) => d ? d.split('-').reverse().join('.') : '/'
  const inp: React.CSSProperties = { padding: '7px 10px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', color: '#111', outline: 'none', width: '100%', boxSizing: 'border-box' }
  const lbl: React.CSSProperties = { fontSize: 10, color: '#9ca3af', marginBottom: 3, fontWeight: 700, display: 'block', textTransform: 'uppercase' as const }

  const saldoAgents = Object.keys(saldo).filter(a => Math.abs(saldo[a] || 0) > 0.01)
  const dugAgents = Object.keys(dugFirma).filter(a => Math.abs(dugFirma[a] || 0) > 0.01)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: '#111', margin: 0 }}>Finansije panel</h1>
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '1px solid #e5e7eb', paddingBottom: 12 }}>
        {([['transakcije', '💸 Transakcije'], ['ugovori', '📑 Ugovori i naplate']] as [Tab, string][]).map(([t, l]) => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding: '8px 18px', fontSize: 13, fontWeight: 600, border: '1px solid', borderColor: tab === t ? '#185FA5' : '#e5e7eb', borderRadius: 8, background: tab === t ? '#E6F1FB' : '#fff', color: tab === t ? '#0C447C' : '#6b7280', cursor: 'pointer' }}>
            {l}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: 60, textAlign: 'center', color: '#9ca3af' }}>Učitavanje...</div>
      ) : (
        <>
          {/* ══════════════ TRANSAKCIJE ══════════════ */}
          {tab === 'transakcije' && (
            <div>
              {/* Sanduče + Saldo paneli */}
              <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr 1fr', gap: 12, marginBottom: 16 }}>
                {/* Sanduče */}
                <div style={{ background: '#fff', border: '2px solid #f59e0b', borderRadius: 12, padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 700, marginBottom: 4 }}>📦 STANJE SANDUČETA</div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: stanjeSanduce >= 0 ? '#1D9E75' : '#dc2626' }}>
                    {fmt(stanjeSanduce)}
                  </div>
                </div>

                {/* Saldo po agentu */}
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '12px 16px', maxHeight: 160, overflowY: 'auto' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid #f3f4f6' }}>
                    💸 Saldo agenata
                  </div>
                  {saldoAgents.length === 0 ? (
                    <div style={{ fontSize: 12, color: '#9ca3af' }}>Nema podataka</div>
                  ) : saldoAgents.map(email => (
                    <div key={email} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #f9fafb', fontSize: 12 }}>
                      <span style={{ color: '#374151' }}>{getName(email)}</span>
                      <span style={{ fontWeight: 700, color: (saldo[email] || 0) >= 0 ? '#1D9E75' : '#dc2626' }}>
                        {fmt(saldo[email] || 0)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Dug prema firmi */}
                <div style={{ background: '#fff', border: '1px solid #fecaca', borderRadius: 12, padding: '12px 16px', maxHeight: 160, overflowY: 'auto' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid #fef2f2' }}>
                    ⚠️ Dug prema firmi
                  </div>
                  {dugAgents.length === 0 ? (
                    <div style={{ fontSize: 12, color: '#9ca3af' }}>Nema dugova</div>
                  ) : dugAgents.map(email => (
                    <div key={email} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #fef2f2', fontSize: 12 }}>
                      <span style={{ color: '#374151' }}>{getName(email)}</span>
                      <span style={{ fontWeight: 700, color: '#dc2626' }}>{fmt(dugFirma[email] || 0)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
                {[
                  { label: 'Ukupno priliv', value: fmt(totalPriliv), color: '#1D9E75', bg: '#E1F5EE', border: '#5DCAA5' },
                  { label: 'Ukupno odliv', value: fmt(totalOdliv), color: '#dc2626', bg: '#FCEBEB', border: '#fecaca' },
                  { label: 'Neto', value: fmt(neto), color: neto >= 0 ? '#1D9E75' : '#dc2626', bg: neto >= 0 ? '#E1F5EE' : '#FCEBEB', border: neto >= 0 ? '#5DCAA5' : '#fecaca' },
                ].map(s => (
                  <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 10, padding: '12px 18px' }}>
                    <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>{s.label}</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
                  </div>
                ))}
              </div>

              {/* Filteri */}
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 16px', marginBottom: 14 }}>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  {/* Pretraga */}
                  <div style={{ flex: '1 1 200px' }}>
                    <label style={lbl}>Pretraga</label>
                    <input value={tSearch} onChange={e => setTSearch(e.target.value)} placeholder="Osoba, kategorija, vozilo..." style={inp} />
                  </div>

                  {/* Od */}
                  <div style={{ flex: '0 0 130px' }}>
                    <label style={lbl}>Od</label>
                    <input type="date" value={tOd} onChange={e => setTOd(e.target.value)} style={inp} />
                  </div>

                  {/* Do */}
                  <div style={{ flex: '0 0 130px' }}>
                    <label style={lbl}>Do</label>
                    <input type="date" value={tDo} onChange={e => setTDo(e.target.value)} style={inp} />
                  </div>

                  {/* Tip */}
                  <div style={{ flex: '0 0 130px' }}>
                    <label style={lbl}>Tip</label>
                    <select value={tTip} onChange={e => setTTip(e.target.value)} style={inp}>
                      <option value="all">Svi tipovi</option>
                      {tipovi.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>

                  {/* V Status */}
                  <div style={{ flex: '0 0 130px' }}>
                    <label style={lbl}>V Status</label>
                    <select value={tVStatus} onChange={e => setTVStatus(e.target.value)} style={inp}>
                      <option value="all">Svi</option>
                      <option value="ok">✅ OK</option>
                      <option value="cancel">❌ Otkazano</option>
                      <option value="pending">⚪ Na čekanju</option>
                    </select>
                  </div>

                  {/* Agenti multiselect */}
                  <div style={{ flex: '1 1 160px' }}>
                    <label style={lbl}>Agenti {selAgents.size > 0 && `(${selAgents.size})`}</label>
                    <div style={{ border: '1px solid #d1d5db', borderRadius: 8, height: 120, overflowY: 'auto', background: '#fff', padding: 4 }}>
                      {transAgentEmails.map(email => (
                        <label key={email} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 4px', cursor: 'pointer', borderRadius: 4, background: selAgents.has(email) ? '#E1F5EE' : 'transparent', fontSize: 11 }}>
                          <input type="checkbox" checked={selAgents.has(email)} onChange={() => toggleAgent(email)} style={{ accentColor: '#1D9E75' }} />
                          <span style={{ color: selAgents.has(email) ? '#085041' : '#374151', fontWeight: selAgents.has(email) ? 600 : 400 }}>
                            {getName(email)}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Kategorije multiselect */}
                  <div style={{ flex: '1 1 180px' }}>
                    <label style={lbl}>Kategorije {selKats.size > 0 && `(${selKats.size})`}</label>
                    <input value={katSearch} onChange={e => setKatSearch(e.target.value)} placeholder="Pretraži kategoriju..." style={{ ...inp, marginBottom: 4, height: 28, fontSize: 11 }} />
                    <div style={{ border: '1px solid #d1d5db', borderRadius: 8, height: 88, overflowY: 'auto', background: '#fff', padding: 4 }}>
                      {filteredKats.map(k => (
                        <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 4px', cursor: 'pointer', borderRadius: 4, background: selKats.has(k) ? '#E6F1FB' : 'transparent', fontSize: 11 }}>
                          <input type="checkbox" checked={selKats.has(k)} onChange={() => toggleKat(k)} style={{ accentColor: '#185FA5' }} />
                          <span style={{ color: selKats.has(k) ? '#0C447C' : '#374151', fontWeight: selKats.has(k) ? 600 : 400 }}>{k}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Reset */}
                  <div style={{ flex: '0 0 auto', alignSelf: 'flex-end' }}>
                    <button onClick={resetAll}
                      style={{ padding: '8px 14px', fontSize: 12, border: '1px solid #fecaca', borderRadius: 8, background: '#FCEBEB', cursor: 'pointer', color: '#dc2626', fontWeight: 600 }}>
                      ✕ Reset
                    </button>
                  </div>

                  <span style={{ fontSize: 12, color: '#9ca3af', alignSelf: 'flex-end', marginLeft: 'auto' }}>
                    {filteredTrans.length} transakcija
                  </span>
                </div>
              </div>

              {/* Tabela */}
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 950 }}>
                  <thead>
                    <tr style={{ background: '#f9fafb' }}>
                      {['V', 'Datum', 'Tip', 'Kategorija', 'Iznos', 'Vozilo', 'Agent / Relacija', 'Komentar', 'Status', ''].map(h => (
                        <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 600, fontSize: 11, color: '#6b7280', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' as const }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTrans.slice(0, tLimit).map(t => {
                      const isPriliv = t.tip_transakcije === 'Priliv'
                      const iznos = t.iznos || 0
                      const isProvereno = t.provereno === true
                      const isXstrik = t.xstrik === 'x'
                      const aIme = getName(t.osobaemail)
                      const pIme = t.primaocemail ? getName(t.primaocemail) : null
                      const relacija = pIme ? `${aIme} → ${pIme}` : aIme
                      return (
                        <tr key={t.id} style={{ borderBottom: '1px solid #f3f4f6', background: isProvereno ? 'rgba(29,158,117,0.06)' : isXstrik ? 'rgba(220,38,38,0.04)' : 'transparent' }}>
                          <td style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 16, textAlign: 'center' }}
                            onClick={() => toggleProvereno(t.id, t.provereno)}>
                            {isProvereno ? '✅' : isXstrik ? '❌' : '⚪'}
                          </td>
                          <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' as const, color: '#374151' }}>{t.datum || '/'}</td>
                          <td style={{ padding: '8px 12px' }}>
                            <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, fontWeight: 600, background: isPriliv ? '#E1F5EE' : '#FCEBEB', color: isPriliv ? '#085041' : '#dc2626' }}>
                              {t.tip_transakcije || '/'}
                            </span>
                          </td>
                          <td style={{ padding: '8px 12px', color: '#374151', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                            {t.kategorija || '/'}
                          </td>
                          <td style={{ padding: '8px 12px', fontWeight: 700, color: isPriliv ? '#1D9E75' : '#dc2626', whiteSpace: 'nowrap' as const }}>
                            {isPriliv ? '+' : '-'}{Math.abs(iznos).toFixed(2)}€
                          </td>
                          <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 11, color: '#6b7280' }}>{t.vozilo || '/'}</td>
                          <td style={{ padding: '8px 12px', fontSize: 11, color: '#374151', whiteSpace: 'nowrap' as const, fontWeight: 500 }}>
                            {relacija}
                          </td>
                          <td style={{ padding: '8px 12px', color: '#6b7280', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                            {t.komentar || '/'}
                            {(t.slika1 || t.slika2 || t.slika3) && (
                              <span style={{ marginLeft: 6 }}>
                                {[t.slika1, t.slika2, t.slika3].filter(Boolean).map((s, i) => (
                                  <a key={i} href={s!} target="_blank" rel="noreferrer"
                                    style={{ fontSize: 10, marginLeft: 4, color: '#185FA5', textDecoration: 'none', background: '#E6F1FB', padding: '1px 5px', borderRadius: 4 }}>
                                    📷{i + 1}
                                  </a>
                                ))}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, fontWeight: 600, background: (t.status || '').toLowerCase() === 'zavrseno' ? '#E1F5EE' : '#FAEEDA', color: (t.status || '').toLowerCase() === 'zavrseno' ? '#085041' : '#633806' }}>
                              {t.status || 'na čekanju'}
                            </span>
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            <button onClick={() => deleteTransakcija(t.id)}
                              style={{ fontSize: 12, border: '1px solid #fecaca', borderRadius: 6, background: 'transparent', cursor: 'pointer', color: '#dc2626', padding: '2px 7px' }}>✕</button>
                          </td>
                        </tr>
                      )
                    })}
                    {filteredTrans.length === 0 && (
                      <tr><td colSpan={10} style={{ padding: 32, textAlign: 'center', color: '#9ca3af' }}>Nema transakcija.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              {filteredTrans.length > tLimit && (
                <button onClick={() => setTLimit(l => l + 50)}
                  style={{ width: '100%', padding: '11px', marginTop: 10, border: '1px dashed #d1d5db', borderRadius: 8, background: '#fff', cursor: 'pointer', color: '#6b7280', fontSize: 13 }}>
                  Prikaži još +50 (prikazano {tLimit} od {filteredTrans.length})
                </button>
              )}
            </div>
          )}

          {/* ══════════════ UGOVORI ══════════════ */}
          {tab === 'ugovori' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
                {[
                  { label: 'Ukupno ugovora', value: filteredUgovori.length, color: '#374151', bg: '#f9fafb', border: '#e5e7eb', isNum: true },
                  { label: 'Naplaćeno', value: fmt(ukupnoNaplaceno), color: '#1D9E75', bg: '#E1F5EE', border: '#5DCAA5', isNum: false },
                  { label: 'Neplaćeno (dug)', value: fmt(ukupnoDug), color: '#dc2626', bg: '#FCEBEB', border: '#fecaca', isNum: false },
                  { label: 'Bez ugovora', value: filteredUgovori.filter(r => !r.ugovor_slika).length, color: '#BA7517', bg: '#FAEEDA', border: '#EF9F27', isNum: true },
                ].map(s => (
                  <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 10, padding: '12px 16px' }}>
                    <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>{s.label}</div>
                    <div style={{ fontSize: s.isNum ? 28 : 20, fontWeight: 700, color: s.color }}>{s.value}</div>
                  </div>
                ))}
              </div>

              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 16px', marginBottom: 14, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: '1 1 200px' }}>
                  <label style={lbl}>Pretraga</label>
                  <input value={uSearch} onChange={e => setUSearch(e.target.value)} placeholder="Klijent, tablice, ID..." style={inp} />
                </div>
                <div style={{ flex: '0 0 130px' }}>
                  <label style={lbl}>Od datuma</label>
                  <input type="date" value={uOd} onChange={e => setUOd(e.target.value)} style={inp} />
                </div>
                <div style={{ flex: '0 0 130px' }}>
                  <label style={lbl}>Do datuma</label>
                  <input type="date" value={uDo} onChange={e => setUDo(e.target.value)} style={inp} />
                </div>
                <div style={{ flex: '0 0 200px' }}>
                  <label style={lbl}>Filter</label>
                  <select value={uStatus} onChange={e => setUStatus(e.target.value)} style={inp}>
                    <option value="all">Svi ugovori</option>
                    <option value="dug">⚠️ Sa dugom</option>
                    <option value="placeno">✅ Plaćeno</option>
                    <option value="bez_ugovora">❌ Bez slike ugovora</option>
                  </select>
                </div>
                {(uSearch || uOd || uDo || uStatus !== 'all') && (
                  <button onClick={() => { setUSearch(''); setUOd(''); setUDo(''); setUStatus('all') }}
                    style={{ padding: '7px 12px', fontSize: 12, border: '1px solid #fecaca', borderRadius: 8, background: '#FCEBEB', cursor: 'pointer', color: '#dc2626', alignSelf: 'flex-end' }}>
                    ✕ Reset
                  </button>
                )}
                <span style={{ fontSize: 12, color: '#9ca3af', alignSelf: 'flex-end', marginLeft: 'auto' }}>{filteredUgovori.length} ugovora</span>
              </div>

              <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 900 }}>
                  <thead>
                    <tr style={{ background: '#f9fafb' }}>
                      {['#', 'Period', 'Klijent', 'Vozilo', 'Izdao / Preuzeo', 'Ukupno', 'Naplaćeno', 'Dug', 'Status', 'Ugovor'].map(h => (
                        <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 600, fontSize: 11, color: '#6b7280', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' as const }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUgovori.map(r => {
                      const ukupno = r.ukupno_naplata || 0
                      const naplaceno = r.naplaceno || 0
                      const dug = Math.max(0, ukupno - naplaceno)
                      return (
                        <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6', background: dug > 0 ? 'rgba(220,38,38,0.03)' : 'transparent' }}>
                          <td style={{ padding: '8px 12px', fontWeight: 700, color: '#9ca3af', fontSize: 11 }}>#{r.id}</td>
                          <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' as const }}>
                            <div style={{ fontWeight: 600, color: '#111' }}>{fmtDate(r.od_datuma)}</div>
                            <div style={{ fontSize: 10, color: '#9ca3af' }}>do {fmtDate(r.do_datuma)}</div>
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            <div style={{ fontWeight: 600, color: '#111' }}>{r.ime_prezime || '/'}</div>
                            <div style={{ fontSize: 10, color: '#9ca3af' }}>{r.telefon || ''}</div>
                          </td>
                          <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 600, color: '#374151' }}>{r.br_tablica}</td>
                          <td style={{ padding: '8px 12px', fontSize: 11 }}>
                            <div>↗️ <span style={{ color: '#1D9E75', fontWeight: 600 }}>{r.ko_je_izdao?.split(' ')[0] || '/'}</span></div>
                            <div>↙️ <span style={{ color: '#dc2626', fontWeight: 600 }}>{r.ko_je_preuzeo?.split(' ')[0] || '/'}</span></div>
                          </td>
                          <td style={{ padding: '8px 12px', fontWeight: 700, color: '#111' }}>{ukupno.toFixed(2)}€</td>
                          <td style={{ padding: '8px 12px', fontWeight: 700, color: '#1D9E75' }}>{naplaceno.toFixed(2)}€</td>
                          <td style={{ padding: '8px 12px', fontWeight: 700, color: dug > 0 ? '#dc2626' : '#1D9E75' }}>
                            {dug > 0 ? `${dug.toFixed(2)}€` : '✓'}
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, fontWeight: 600, background: r.daily_status === 'Izdato' ? '#E6F1FB' : '#E1F5EE', color: r.daily_status === 'Izdato' ? '#0C447C' : '#085041' }}>
                              {r.daily_status || '/'}
                            </span>
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                            {r.ugovor_slika ? (
                              <a href={r.ugovor_slika} target="_blank" rel="noreferrer"
                                style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, background: '#E1F5EE', color: '#085041', fontWeight: 600, textDecoration: 'none' }}>
                                📄 Vidi
                              </a>
                            ) : (
                              <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, background: '#FCEBEB', color: '#dc2626', fontWeight: 600 }}>❌ Fali</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                    {filteredUgovori.length === 0 && (
                      <tr><td colSpan={10} style={{ padding: 32, textAlign: 'center', color: '#9ca3af' }}>Nema ugovora.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
