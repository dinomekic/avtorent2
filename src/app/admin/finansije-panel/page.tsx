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
  admin_notes: string | null
}

type Rezervacija = {
  id: number; br_tablica: string; ime_prezime: string; telefon: string | null
  od_datuma: string; do_datuma: string; ukupno_naplata: number | null
  naplaceno: number | null; ko_je_izdao: string | null; ko_je_preuzeo: string | null
  daily_status: string; ugovor_slika: string | null
  nacin_placanja: string | null; depozit: number | null
}

type Agent = { id: string; email: string; full_name: string }
type FinLog = { id: number; transakcija_id: string; admin_email: string; akcija: string; staro: any; novo: any; created_at: string }
type Tab = 'transakcije' | 'ugovori' | 'log'

export default function AdminFinansijePanelPage() {
  const [tab, setTab] = useState<Tab>('transakcije')
  const [transakcije, setTransakcije] = useState<Transakcija[]>([])
  const [rezervacije, setRezervacije] = useState<Rezervacija[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [finLog, setFinLog] = useState<FinLog[]>([])
  const [loading, setLoading] = useState(true)
  const [accessDenied, setAccessDenied] = useState(false)
  const [currentAdmin, setCurrentAdmin] = useState('')

  const [tSearch, setTSearch] = useState('')
  const [tOd, setTOd] = useState('')
  const [tDo, setTDo] = useState('')
  const [tTip, setTTip] = useState('all')
  const [tVStatus, setTVStatus] = useState('all')
  const [selAgents, setSelAgents] = useState<Set<string>>(new Set())
  const [selKats, setSelKats] = useState<Set<string>>(new Set())
  const [katSearch, setKatSearch] = useState('')
  const [tLimit, setTLimit] = useState(50)

  const [editT, setEditT] = useState<Transakcija | null>(null)
  const [editForm, setEditForm] = useState({ datum: '', kategorija: '', iznos: '', komentar: '', vozilo: '', status: '', admin_notes: '' })
  const [editSaving, setEditSaving] = useState(false)

  const [uSearch, setUSearch] = useState('')
  const [uOd, setUOd] = useState('')
  const [uDo, setUDo] = useState('')
  const [uStatus, setUStatus] = useState('all')

  const loadData = useCallback(async () => {
    setLoading(true)

    // Provjeri role
    const cookieVal = typeof document !== 'undefined'
      ? (document.cookie.match(/avtorent-agent-name=([^;]+)/) || [])[1]
      : ''
    const agentName = cookieVal ? decodeURIComponent(cookieVal) : ''

    if (agentName) {
      const { data: agentData } = await supabase.from('agents').select('role, email').eq('full_name', agentName).single()
      if (!agentData || agentData.role !== 'admin') {
        setAccessDenied(true); setLoading(false); return
      }
      setCurrentAdmin(agentData.email || agentName)
    }

    // Učitaj SVE transakcije straničenjem
    let allTrans: any[] = []
    let from = 0
    const step = 1000
    while (true) {
      const { data } = await supabase.from('transakcije').select('*')
        .order('timestamp_upisa', { ascending: false }).range(from, from + step - 1)
      if (!data || data.length === 0) break
      allTrans = [...allTrans, ...data]
      if (data.length < step) break
      from += step
    }

    // Sortiraj po timestamp desc (format može biti "M/D/YYYY HH:MM:SS")
    allTrans.sort((a: any, b: any) =>
      new Date(b.timestamp_upisa || 0).getTime() - new Date(a.timestamp_upisa || 0).getTime()
    )

    const [{ data: r }, { data: a }, { data: l }] = await Promise.all([
      supabase.from('rezervacije').select('id, br_tablica, ime_prezime, telefon, od_datuma, do_datuma, ukupno_naplata, naplaceno, ko_je_izdao, ko_je_preuzeo, daily_status, ugovor_slika, nacin_placanja, depozit').order('id', { ascending: false }),
      supabase.from('agents').select('id, email, full_name').eq('is_active', true).order('full_name'),
      supabase.from('finansije_log').select('*').order('created_at', { ascending: false }).limit(200),
    ])

    setTransakcije(allTrans)
    setRezervacije(r || [])
    setAgents(a || [])
    setFinLog(l || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const emailToName = useMemo(() => {
    const map: Record<string, string> = {}
    agents.forEach(a => { map[a.email.toLowerCase()] = a.full_name })
    return map
  }, [agents])

  function getName(email: string | null): string {
    if (!email) return '/'
    const e = email.toLowerCase()
    return emailToName[e] || e.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  }

  const isPriliv = (t: Transakcija) => (t.tip_transakcije || '').toLowerCase() === 'priliv'

  // Saldo po HTML logici
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

  const filteredTrans = useMemo(() => transakcije.filter(t => {
    const q = tSearch.toLowerCase()
    const mail = (t.osobaemail || '').toLowerCase()
    const pMail = (t.primaocemail || '').toLowerCase()
    const matchQ = !q || getName(t.osobaemail).toLowerCase().includes(q) || mail.includes(q) ||
      (t.kategorija || '').toLowerCase().includes(q) || (t.vozilo || '').toLowerCase().includes(q) ||
      (t.komentar || '').toLowerCase().includes(q) || (t.admin_notes || '').toLowerCase().includes(q)
    const matchOd = !tOd || (t.datum || '') >= tOd
    const matchDo = !tDo || (t.datum || '') <= tDo
    const matchTip = tTip === 'all' || (t.tip_transakcije || '').toLowerCase() === tTip
    const matchKat = selKats.size === 0 || selKats.has(t.kategorija || '')
    const matchAgent = selAgents.size === 0 || selAgents.has(mail) || selAgents.has(pMail)
    const vS = t.provereno ? 'ok' : t.xstrik === 'x' ? 'cancel' : 'pending'
    const matchV = tVStatus === 'all' || vS === tVStatus
    return matchQ && matchOd && matchDo && matchTip && matchKat && matchAgent && matchV
  }), [transakcije, tSearch, tOd, tDo, tTip, selKats, selAgents, tVStatus])

  const allKats = useMemo(() =>
    Array.from(new Set(transakcije.map(t => t.kategorija).filter(Boolean))).sort() as string[], [transakcije])
  const filteredKats = katSearch ? allKats.filter(k => k.toLowerCase().includes(katSearch.toLowerCase())) : allKats

  const transAgentEmails = useMemo(() => {
    const emails = new Set<string>()
    transakcije.forEach(t => {
      if (t.osobaemail) emails.add(t.osobaemail.toLowerCase())
      if (t.primaocemail) emails.add(t.primaocemail.toLowerCase())
    })
    return Array.from(emails).sort((a, b) => getName(a).localeCompare(getName(b)))
  }, [transakcije, emailToName])

  const filteredUgovori = useMemo(() => rezervacije.filter(r => {
    const q = uSearch.toLowerCase()
    const matchQ = !q || (r.ime_prezime || '').toLowerCase().includes(q) ||
      (r.br_tablica || '').toLowerCase().includes(q) || String(r.id).includes(q)
    const matchOd = !uOd || (r.od_datuma || '') >= uOd
    const matchDo = !uDo || (r.od_datuma || '') <= uDo
    const dug = Math.max(0, (r.ukupno_naplata || 0) - (r.naplaceno || 0))
    const matchStatus = uStatus === 'all' || (uStatus === 'dug' && dug > 0) ||
      (uStatus === 'bez_ugovora' && !r.ugovor_slika) ||
      (uStatus === 'placeno' && dug <= 0 && (r.ukupno_naplata || 0) > 0)
    return matchQ && matchOd && matchDo && matchStatus
  }), [rezervacije, uSearch, uOd, uDo, uStatus])

  async function writeLog(transakcija_id: string, akcija: string, staro: any, novo: any) {
    await supabase.from('finansije_log').insert({
      transakcija_id, admin_email: currentAdmin, akcija,
      staro: staro ? JSON.parse(JSON.stringify(staro)) : null,
      novo: novo ? JSON.parse(JSON.stringify(novo)) : null,
    })
  }

  async function toggleProvereno(id: string, cur: boolean | null) {
    const novo = !cur
    await supabase.from('transakcije').update({ provereno: novo }).eq('id', id)
    await writeLog(id, novo ? 'Označeno kao provjereno ✅' : 'Skinuto označavanje ⚪', { provereno: cur }, { provereno: novo })
    setTransakcije(prev => prev.map(t => t.id === id ? { ...t, provereno: novo } : t))
    setFinLog(prev => [{ id: Date.now(), transakcija_id: id, admin_email: currentAdmin, akcija: novo ? 'Označeno kao provjereno ✅' : 'Skinuto označavanje ⚪', staro: { provereno: cur }, novo: { provereno: novo }, created_at: new Date().toISOString() }, ...prev])
  }

  function openEdit(t: Transakcija) {
    setEditT(t)
    setEditForm({
      datum: t.datum || '', kategorija: t.kategorija || '',
      iznos: String(t.iznos || ''), komentar: t.komentar || '',
      vozilo: t.vozilo || '', status: t.status || '',
      admin_notes: t.admin_notes || '',
    })
  }

  async function saveEdit() {
    if (!editT) return
    setEditSaving(true)
    const updates = {
      datum: editForm.datum, kategorija: editForm.kategorija,
      iznos: parseFloat(editForm.iznos) || 0, komentar: editForm.komentar || null,
      vozilo: editForm.vozilo || null, status: editForm.status,
      admin_notes: editForm.admin_notes || null,
    }
    await supabase.from('transakcije').update(updates).eq('id', editT.id)

    // Log izmjena
    const izmjene: string[] = []
    if (editT.datum !== updates.datum) izmjene.push(`datum: ${editT.datum} → ${updates.datum}`)
    if (editT.iznos !== updates.iznos) izmjene.push(`iznos: ${editT.iznos} → ${updates.iznos}`)
    if (editT.kategorija !== updates.kategorija) izmjene.push(`kategorija: ${editT.kategorija} → ${updates.kategorija}`)
    if (editT.komentar !== updates.komentar) izmjene.push(`komentar promijenjen`)
    if (editT.admin_notes !== updates.admin_notes) izmjene.push(`admin notes promijenjen`)
    if (izmjene.length > 0) {
      await writeLog(editT.id, `Editovano: ${izmjene.join(', ')}`,
        { datum: editT.datum, iznos: editT.iznos, kategorija: editT.kategorija, komentar: editT.komentar },
        updates)
      setFinLog(prev => [{ id: Date.now(), transakcija_id: editT.id, admin_email: currentAdmin, akcija: `Editovano: ${izmjene.join(', ')}`, staro: null, novo: null, created_at: new Date().toISOString() }, ...prev])
    }

    setTransakcije(prev => prev.map(t => t.id === editT.id ? { ...t, ...updates } : t))
    setEditSaving(false); setEditT(null)
  }

  async function deleteTransakcija(id: string) {
    if (!confirm('Obrisati transakciju?')) return
    const t = transakcije.find(x => x.id === id)
    await supabase.from('transakcije').delete().eq('id', id)
    await writeLog(id, `Obrisana transakcija: ${t?.kategorija} ${t?.iznos}€`, t, null)
    setTransakcije(prev => prev.filter(t => t.id !== id))
    setFinLog(prev => [{ id: Date.now(), transakcija_id: id, admin_email: currentAdmin, akcija: `Obrisana transakcija: ${t?.kategorija} ${t?.iznos}€`, staro: null, novo: null, created_at: new Date().toISOString() }, ...prev])
  }

  function toggleAgent(email: string) { setSelAgents(prev => { const n = new Set(prev); n.has(email) ? n.delete(email) : n.add(email); return n }) }
  function toggleKat(kat: string) { setSelKats(prev => { const n = new Set(prev); n.has(kat) ? n.delete(kat) : n.add(kat); return n }) }
  function resetAll() { setTSearch(''); setTOd(''); setTDo(''); setTTip('all'); setTVStatus('all'); setSelAgents(new Set()); setSelKats(new Set()); setKatSearch('') }

  const fmt = (n: number) => n.toFixed(2) + '€'
  const fmtDate = (d: string) => d ? d.split('-').reverse().join('.') : '/'
  const saldoEntries = Object.entries(saldo).filter(([, v]) => Math.abs(v) > 0.01).sort((a, b) => b[1] - a[1])
  const dugEntries = Object.entries(dugFirma).filter(([, v]) => Math.abs(v) > 0.01)
  const ukupnoNaplaceno = filteredUgovori.reduce((s, r) => s + (r.naplaceno || 0), 0)
  const ukupnoDug = filteredUgovori.reduce((s, r) => s + Math.max(0, (r.ukupno_naplata || 0) - (r.naplaceno || 0)), 0)

  const inp: React.CSSProperties = { padding: '7px 10px', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', color: '#111', outline: 'none', width: '100%', boxSizing: 'border-box' as const }
  const lbl: React.CSSProperties = { fontSize: 10, color: '#9ca3af', marginBottom: 3, fontWeight: 700, display: 'block', textTransform: 'uppercase' as const, letterSpacing: 0.4 }
  const TH: React.CSSProperties = { padding: '10px 12px', textAlign: 'left', fontWeight: 600, fontSize: 10, color: '#9ca3af', textTransform: 'uppercase' as const, letterSpacing: 0.4, background: '#fafafa', whiteSpace: 'nowrap' as const }

  if (accessDenied) return (
    <div style={{ padding: 60, textAlign: 'center' }}>
      <div style={{ fontSize: 40, marginBottom: 16 }}>🔒</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#111', marginBottom: 8 }}>Pristup odbijen</div>
      <div style={{ fontSize: 14, color: '#9ca3af' }}>Ova stranica je dostupna samo adminima.</div>
    </div>
  )

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111', margin: 0 }}>Finansije panel</h1>
        <p style={{ fontSize: 13, color: '#9ca3af', margin: '4px 0 0' }}>
          {transakcije.length} transakcija · {rezervacije.length} ugovora
        </p>
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '2px solid #f3f4f6' }}>
        {([['transakcije', '💸 Transakcije'], ['ugovori', '📑 Ugovori'], ['log', '📋 Log izmjena']] as [Tab, string][]).map(([t, l]) => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding: '9px 20px', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', borderBottom: tab === t ? '2px solid #111' : '2px solid transparent', background: 'none', color: tab === t ? '#111' : '#9ca3af', marginBottom: -2 }}>
            {l}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: 60, textAlign: 'center', color: '#9ca3af' }}>Učitavanje {transakcije.length > 0 ? `${transakcije.length}...` : '...'}</div>
      ) : (
        <>
          {/* ══ TRANSAKCIJE ══ */}
          {tab === 'transakcije' && (
            <div>
              {/* TOP PANELI */}
              <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 1fr', gap: 12, marginBottom: 20 }}>
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 4 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5 }}>📦 Sandučić</div>
                  <div style={{ fontSize: 26, fontWeight: 900, color: stanjeSanduce >= 0 ? '#16a34a' : '#dc2626' }}>{fmt(stanjeSanduce)}</div>
                </div>
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '12px 16px', maxHeight: 160, overflowY: 'auto' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, position: 'sticky', top: 0, background: '#fff', paddingBottom: 4, borderBottom: '1px solid #f3f4f6' }}>💸 Saldo agenata</div>
                  {saldoEntries.length === 0 ? <div style={{ fontSize: 12, color: '#9ca3af' }}>Nema podataka</div>
                    : saldoEntries.map(([email, val]) => (
                      <div key={email} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #f9fafb', fontSize: 12 }}>
                        <span style={{ color: '#374151' }}>{getName(email)}</span>
                        <span style={{ fontWeight: 700, color: val >= 0 ? '#16a34a' : '#dc2626' }}>{fmt(val)}</span>
                      </div>
                    ))}
                </div>
                <div style={{ background: '#fff', border: '1px solid #fecaca', borderRadius: 12, padding: '12px 16px', maxHeight: 160, overflowY: 'auto' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, position: 'sticky', top: 0, background: '#fff', paddingBottom: 4, borderBottom: '1px solid #fef2f2' }}>⚠️ Dug prema firmi</div>
                  {dugEntries.length === 0 ? <div style={{ fontSize: 12, color: '#9ca3af' }}>Nema dugova ✓</div>
                    : dugEntries.map(([email, val]) => (
                      <div key={email} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #fef2f2', fontSize: 12 }}>
                        <span style={{ color: '#374151' }}>{getName(email)}</span>
                        <span style={{ fontWeight: 700, color: '#dc2626' }}>{fmt(val)}</span>
                      </div>
                    ))}
                </div>
              </div>

              {/* FILTERI */}
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '14px 16px', marginBottom: 14 }}>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <div style={{ flex: '1 1 180px' }}>
                    <label style={lbl}>Pretraga</label>
                    <input value={tSearch} onChange={e => setTSearch(e.target.value)} placeholder="Osoba, kategorija, vozilo, notes..." style={inp} />
                  </div>
                  <div style={{ flex: '0 0 120px' }}><label style={lbl}>Od</label><input type="date" value={tOd} onChange={e => setTOd(e.target.value)} style={inp} /></div>
                  <div style={{ flex: '0 0 120px' }}><label style={lbl}>Do</label><input type="date" value={tDo} onChange={e => setTDo(e.target.value)} style={inp} /></div>
                  <div style={{ flex: '0 0 120px' }}>
                    <label style={lbl}>Tip</label>
                    <select value={tTip} onChange={e => setTTip(e.target.value)} style={inp}>
                      <option value="all">Svi</option>
                      <option value="priliv">Priliv</option>
                      <option value="odliv">Odliv</option>
                    </select>
                  </div>
                  <div style={{ flex: '0 0 120px' }}>
                    <label style={lbl}>V Status</label>
                    <select value={tVStatus} onChange={e => setTVStatus(e.target.value)} style={inp}>
                      <option value="all">Svi</option>
                      <option value="ok">✅ OK</option>
                      <option value="cancel">❌ X</option>
                      <option value="pending">⚪ Čekanje</option>
                    </select>
                  </div>
                  <div style={{ flex: '1 1 150px' }}>
                    <label style={lbl}>Agenti {selAgents.size > 0 && `(${selAgents.size})`}</label>
                    <div style={{ border: '1px solid #e5e7eb', borderRadius: 6, height: 110, overflowY: 'auto', background: '#fafafa' }}>
                      {transAgentEmails.map(email => (
                        <label key={email} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', cursor: 'pointer', background: selAgents.has(email) ? '#f0fdf8' : 'transparent', borderBottom: '1px solid #f3f4f6' }}>
                          <input type="checkbox" checked={selAgents.has(email)} onChange={() => toggleAgent(email)} style={{ accentColor: '#1D9E75' }} />
                          <span style={{ fontSize: 11, color: selAgents.has(email) ? '#085041' : '#374151', fontWeight: selAgents.has(email) ? 600 : 400 }}>{getName(email)}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div style={{ flex: '1 1 180px' }}>
                    <label style={lbl}>Kategorije {selKats.size > 0 && `(${selKats.size})`}</label>
                    <input value={katSearch} onChange={e => setKatSearch(e.target.value)} placeholder="Pretraži..." style={{ ...inp, marginBottom: 4, height: 30 }} />
                    <div style={{ border: '1px solid #e5e7eb', borderRadius: 6, height: 76, overflowY: 'auto', background: '#fafafa' }}>
                      {filteredKats.map(k => (
                        <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 8px', cursor: 'pointer', background: selKats.has(k) ? '#eff6ff' : 'transparent', borderBottom: '1px solid #f3f4f6' }}>
                          <input type="checkbox" checked={selKats.has(k)} onChange={() => toggleKat(k)} style={{ accentColor: '#185FA5' }} />
                          <span style={{ fontSize: 11, color: selKats.has(k) ? '#1e40af' : '#374151', fontWeight: selKats.has(k) ? 600 : 400 }}>{k}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div style={{ flex: '0 0 auto', alignSelf: 'flex-end', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <button onClick={resetAll} style={{ padding: '7px 14px', fontSize: 11, border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', cursor: 'pointer', color: '#6b7280', fontWeight: 600 }}>✕ Reset</button>
                    <div style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center' }}>{filteredTrans.length}</div>
                  </div>
                </div>
              </div>

              {/* TABELA */}
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'auto', background: '#fff' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 1000 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <th style={TH}>V</th>
                      <th style={TH}>Datum</th>
                      <th style={TH}>Kategorija</th>
                      <th style={TH}>Iznos</th>
                      <th style={TH}>Vozilo</th>
                      <th style={TH}>Agent</th>
                      <th style={TH}>Komentar</th>
                      <th style={TH}>Slike</th>
                      <th style={TH}>Admin notes</th>
                      <th style={TH}>Upisano</th>
                      <th style={TH}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTrans.slice(0, tLimit).map(t => {
                      const pril = isPriliv(t)
                      const iznos = t.iznos || 0
                      const isOk = t.provereno === true
                      const isX = t.xstrik === 'x'
                      const aIme = getName(t.osobaemail)
                      const pIme = t.primaocemail ? getName(t.primaocemail) : null
                      return (
                        <tr key={t.id} style={{ borderBottom: '1px solid #f9fafb', background: isOk ? '#f0fdf8' : isX ? '#fff5f5' : '#fff' }}>
                          <td style={{ padding: '10px 12px', textAlign: 'center', cursor: 'pointer', fontSize: 15 }}
                            onClick={() => toggleProvereno(t.id, t.provereno)}>
                            {isOk ? '✅' : isX ? '❌' : '⚪'}
                          </td>
                          <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' as const, color: '#374151' }}>
                            <div style={{ fontWeight: 500 }}>{t.datum || '/'}</div>
                            <div style={{ fontSize: 10, color: '#9ca3af' }}>
                              {t.timestamp_upisa ? new Date(t.timestamp_upisa).toLocaleTimeString('sr-RS', { hour: '2-digit', minute: '2-digit' }) : ''}
                            </div>
                          </td>
                          <td style={{ padding: '10px 12px', maxWidth: 160 }}>
                            <div style={{ fontSize: 11, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, color: '#374151' }}>{t.kategorija || '/'}</div>
                            <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, fontWeight: 600, background: pril ? '#dcfce7' : '#fee2e2', color: pril ? '#166534' : '#991b1b' }}>
                              {pril ? '↑' : '↓'} {pril ? 'Priliv' : 'Odliv'}
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px', fontWeight: 700, fontSize: 14, color: pril ? '#16a34a' : '#dc2626', whiteSpace: 'nowrap' as const }}>
                            {pril ? '+' : ''}{iznos.toFixed(2)}€
                          </td>
                          <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 11, color: '#6b7280' }}>{t.vozilo || '—'}</td>
                          <td style={{ padding: '10px 12px', fontSize: 11, whiteSpace: 'nowrap' as const }}>
                            <div style={{ fontWeight: 600, color: '#111' }}>{aIme}</div>
                            {pIme && <div style={{ fontSize: 10, color: '#9ca3af' }}>→ {pIme}</div>}
                          </td>
                          <td style={{ padding: '10px 12px', color: '#6b7280', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, fontSize: 11 }}>
                            {(() => {
                              const kom = t.komentar || ''
                              const urlMatch = kom.match(/https?:\/\/[^\s]+/)
                              const tekst = urlMatch ? kom.replace(urlMatch[0], '').trim() : kom
                              return tekst || '—'
                            })()}
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            {(() => {
                              const kom = t.komentar || ''
                              const urlMatch = kom.match(/https?:\/\/[^\s]+/)
                              const slike = [t.slika1, t.slika2, t.slika3].filter(Boolean) as string[]
                              const sveUrls = urlMatch ? [urlMatch[0], ...slike] : slike

                              function toThumb(url: string): string {
                                const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/)
                                if (m) return `https://drive.google.com/thumbnail?id=${m[1]}&sz=w80`
                                return url
                              }

                              return sveUrls.length > 0 ? (
                                <div style={{ display: 'flex', gap: 4 }}>
                                  {sveUrls.map((s, i) => (
                                    <a key={i} href={s} target="_blank" rel="noreferrer"
                                      style={{ display: 'block', width: 44, height: 34, borderRadius: 4, overflow: 'hidden', border: '1px solid #e5e7eb', flexShrink: 0, background: '#f3f4f6' }}>
                                      <img
                                        src={toThumb(s)}
                                        alt=""
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        onError={(e) => {
                                          const t = e.currentTarget
                                          t.style.display = 'none'
                                          const p = t.parentElement
                                          if (p) p.innerHTML = '<span style="font-size:18px;display:flex;align-items:center;justify-content:center;height:100%;">📷</span>'
                                        }}
                                      />
                                    </a>
                                  ))}
                                </div>
                              ) : <span style={{ color: '#d1d5db', fontSize: 11 }}>—</span>
                            })()}
                          </td>
                          <td style={{ padding: '10px 12px', maxWidth: 160 }}>
                            {t.admin_notes ? (
                              <div style={{ fontSize: 11, color: '#0C447C', background: '#E6F1FB', padding: '3px 8px', borderRadius: 6, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                                📝 {t.admin_notes}
                              </div>
                            ) : <span style={{ color: '#d1d5db', fontSize: 11 }}>—</span>}
                          </td>
                          <td style={{ padding: '10px 12px', fontSize: 10, color: '#9ca3af', whiteSpace: 'nowrap' as const }}>
                            {t.timestamp_upisa
                              ? new Date(t.timestamp_upisa).toLocaleString('sr-RS', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                              : '—'}
                          </td>
                          <td style={{ padding: '10px 8px', whiteSpace: 'nowrap' as const }}>
                            <button onClick={() => openEdit(t)} style={{ fontSize: 11, border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', cursor: 'pointer', color: '#374151', padding: '2px 8px', marginRight: 4 }}>✏️</button>
                            <button onClick={() => deleteTransakcija(t.id)} style={{ fontSize: 11, border: '1px solid #fee2e2', borderRadius: 6, background: 'transparent', cursor: 'pointer', color: '#dc2626', padding: '2px 8px' }}>✕</button>
                          </td>
                        </tr>
                      )
                    })}
                    {filteredTrans.length === 0 && (
                      <tr><td colSpan={11} style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Nema transakcija</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              {filteredTrans.length > tLimit && (
                <button onClick={() => setTLimit(l => l + 50)}
                  style={{ width: '100%', padding: 11, marginTop: 10, border: '1px dashed #e5e7eb', borderRadius: 8, background: '#fff', cursor: 'pointer', color: '#6b7280', fontSize: 12 }}>
                  Prikaži još +50 · prikazano {tLimit} od {filteredTrans.length}
                </button>
              )}
            </div>
          )}

          {/* ══ UGOVORI ══ */}
          {tab === 'ugovori' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
                {[
                  { label: 'Ugovora', value: filteredUgovori.length, big: true, color: '#111', bg: '#fafafa', border: '#e5e7eb' },
                  { label: 'Naplaćeno', value: fmt(ukupnoNaplaceno), big: false, color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
                  { label: 'Dug', value: fmt(ukupnoDug), big: false, color: '#dc2626', bg: '#fff5f5', border: '#fecaca' },
                  { label: 'Bez ugovora', value: filteredUgovori.filter(r => !r.ugovor_slika).length, big: true, color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
                ].map(s => (
                  <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 10, padding: '12px 16px' }}>
                    <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>{s.label}</div>
                    <div style={{ fontSize: s.big ? 28 : 20, fontWeight: 700, color: s.color }}>{s.value}</div>
                  </div>
                ))}
              </div>
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '12px 16px', marginBottom: 14, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: '1 1 200px' }}><label style={lbl}>Pretraga</label><input value={uSearch} onChange={e => setUSearch(e.target.value)} placeholder="Klijent, tablice, ID..." style={inp} /></div>
                <div style={{ flex: '0 0 130px' }}><label style={lbl}>Od datuma</label><input type="date" value={uOd} onChange={e => setUOd(e.target.value)} style={inp} /></div>
                <div style={{ flex: '0 0 130px' }}><label style={lbl}>Do datuma</label><input type="date" value={uDo} onChange={e => setUDo(e.target.value)} style={inp} /></div>
                <div style={{ flex: '0 0 180px' }}>
                  <label style={lbl}>Filter</label>
                  <select value={uStatus} onChange={e => setUStatus(e.target.value)} style={inp}>
                    <option value="all">Svi ugovori</option>
                    <option value="dug">⚠️ Sa dugom</option>
                    <option value="placeno">✅ Plaćeno</option>
                    <option value="bez_ugovora">❌ Bez slike</option>
                  </select>
                </div>
                {(uSearch || uOd || uDo || uStatus !== 'all') && (
                  <button onClick={() => { setUSearch(''); setUOd(''); setUDo(''); setUStatus('all') }}
                    style={{ padding: '7px 12px', fontSize: 11, border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', cursor: 'pointer', color: '#6b7280', alignSelf: 'flex-end' }}>✕</button>
                )}
                <span style={{ fontSize: 11, color: '#9ca3af', alignSelf: 'flex-end', marginLeft: 'auto' }}>{filteredUgovori.length}</span>
              </div>
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'auto', background: '#fff' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 860 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #f3f4f6', background: '#fafafa' }}>
                      {['#', 'Period', 'Klijent', 'Vozilo', 'Agent', 'Ukupno', 'Naplaćeno', 'Dug', 'Status', 'Ugovor'].map(h => (
                        <th key={h} style={TH}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUgovori.map(r => {
                      const ukupno = r.ukupno_naplata || 0
                      const naplaceno = r.naplaceno || 0
                      const dug = Math.max(0, ukupno - naplaceno)
                      return (
                        <tr key={r.id} style={{ borderBottom: '1px solid #f9fafb', background: dug > 0 ? '#fff5f5' : '#fff' }}>
                          <td style={{ padding: '10px 12px', color: '#9ca3af', fontSize: 11, fontWeight: 600 }}>#{r.id}</td>
                          <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' as const }}>
                            <div style={{ fontWeight: 600, color: '#111' }}>{fmtDate(r.od_datuma)}</div>
                            <div style={{ fontSize: 10, color: '#9ca3af' }}>→ {fmtDate(r.do_datuma)}</div>
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <div style={{ fontWeight: 600, color: '#111' }}>{r.ime_prezime || '/'}</div>
                            <div style={{ fontSize: 10, color: '#9ca3af' }}>{r.telefon || ''}</div>
                          </td>
                          <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 700, color: '#374151' }}>{r.br_tablica}</td>
                          <td style={{ padding: '10px 12px', fontSize: 11 }}>
                            <div>↗ <span style={{ color: '#16a34a', fontWeight: 600 }}>{r.ko_je_izdao?.split(' ')[0] || '/'}</span></div>
                            <div>↙ <span style={{ color: '#dc2626', fontWeight: 600 }}>{r.ko_je_preuzeo?.split(' ')[0] || '/'}</span></div>
                          </td>
                          <td style={{ padding: '10px 12px', fontWeight: 700, color: '#111' }}>{ukupno.toFixed(2)}€</td>
                          <td style={{ padding: '10px 12px', fontWeight: 700, color: '#16a34a' }}>{naplaceno.toFixed(2)}€</td>
                          <td style={{ padding: '10px 12px', fontWeight: 700, color: dug > 0 ? '#dc2626' : '#9ca3af' }}>{dug > 0 ? `${dug.toFixed(2)}€` : '—'}</td>
                          <td style={{ padding: '10px 12px' }}>
                            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 600, background: r.daily_status === 'Izdato' ? '#dbeafe' : '#dcfce7', color: r.daily_status === 'Izdato' ? '#1d4ed8' : '#166534' }}>
                              {r.daily_status || '/'}
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            {r.ugovor_slika
                              ? <a href={r.ugovor_slika} target="_blank" rel="noreferrer" style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, background: '#f0fdf4', color: '#166534', fontWeight: 600, textDecoration: 'none' }}>📄 Vidi</a>
                              : <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: '#fee2e2', color: '#dc2626', fontWeight: 600 }}>❌ Fali</span>}
                          </td>
                        </tr>
                      )
                    })}
                    {filteredUgovori.length === 0 && <tr><td colSpan={10} style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Nema ugovora</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ══ LOG IZMJENA ══ */}
          {tab === 'log' && (
            <div>
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'auto', background: '#fff' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #f3f4f6', background: '#fafafa' }}>
                      {['Kada', 'Admin', 'Transakcija ID', 'Akcija'].map(h => <th key={h} style={TH}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {finLog.map(l => (
                      <tr key={l.id} style={{ borderBottom: '1px solid #f9fafb' }}>
                        <td style={{ padding: '9px 12px', fontSize: 11, color: '#9ca3af', whiteSpace: 'nowrap' as const }}>
                          {new Date(l.created_at).toLocaleString('sr-RS', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td style={{ padding: '9px 12px', fontSize: 12, fontWeight: 600, color: '#374151' }}>{getName(l.admin_email)}</td>
                        <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 10, color: '#9ca3af' }}>{l.transakcija_id}</td>
                        <td style={{ padding: '9px 12px', fontSize: 12, color: '#111' }}>{l.akcija}</td>
                      </tr>
                    ))}
                    {finLog.length === 0 && <tr><td colSpan={4} style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Nema logova</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* EDIT MODAL */}
      {editT && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 460, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#fff' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>Uredi transakciju</div>
              <button onClick={() => setEditT(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#9ca3af' }}>✕</button>
            </div>
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ ...lbl, color: '#374151' }}>Datum</label>
                  <input type="date" value={editForm.datum} onChange={e => setEditForm(f => ({ ...f, datum: e.target.value }))} style={inp} />
                </div>
                <div>
                  <label style={{ ...lbl, color: '#374151' }}>Iznos (€)</label>
                  <input type="number" value={editForm.iznos} onChange={e => setEditForm(f => ({ ...f, iznos: e.target.value }))}
                    style={{ ...inp, fontWeight: 700, color: parseFloat(editForm.iznos) >= 0 ? '#16a34a' : '#dc2626' }} />
                </div>
              </div>
              <div>
                <label style={{ ...lbl, color: '#374151' }}>Kategorija</label>
                <input value={editForm.kategorija} onChange={e => setEditForm(f => ({ ...f, kategorija: e.target.value }))} style={inp} />
              </div>
              <div>
                <label style={{ ...lbl, color: '#374151' }}>Vozilo</label>
                <input value={editForm.vozilo} onChange={e => setEditForm(f => ({ ...f, vozilo: e.target.value }))} style={inp} />
              </div>
              <div>
                <label style={{ ...lbl, color: '#374151' }}>Komentar</label>
                <textarea value={editForm.komentar} onChange={e => setEditForm(f => ({ ...f, komentar: e.target.value }))}
                  style={{ ...inp, minHeight: 60, resize: 'vertical' as const }} />
              </div>
              <div>
                <label style={{ ...lbl, color: '#0C447C' }}>📝 Admin notes (interno)</label>
                <textarea value={editForm.admin_notes} onChange={e => setEditForm(f => ({ ...f, admin_notes: e.target.value }))}
                  placeholder="Bilješka za admin tim..."
                  style={{ ...inp, minHeight: 60, resize: 'vertical' as const, borderColor: '#1D9E75', background: '#f0fdf8' }} />
              </div>
              <div>
                <label style={{ ...lbl, color: '#374151' }}>Status</label>
                <select value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))} style={inp}>
                  <option value="Zavrseno">Zavrseno</option>
                  <option value="na cekanju">Na čekanju</option>
                </select>
              </div>
              {(editT.slika1 || editT.slika2 || editT.slika3) && (
                <div>
                  <label style={{ ...lbl, color: '#374151' }}>Slike</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[editT.slika1, editT.slika2, editT.slika3].filter(Boolean).map((s, i) => (
                      <a key={i} href={s!} target="_blank" rel="noreferrer"
                        style={{ display: 'block', width: 80, height: 60, borderRadius: 6, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
                        <img src={s!} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </a>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button onClick={() => setEditT(null)} style={{ flex: 1, padding: '9px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 13, color: '#374151' }}>Odustani</button>
                <button onClick={saveEdit} disabled={editSaving}
                  style={{ flex: 2, padding: '9px', background: editSaving ? '#5DCAA5' : '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  {editSaving ? 'Snimanje...' : '💾 Sačuvaj'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
