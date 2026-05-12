'use client'

import { useEffect, useState, useCallback } from 'react'
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

type Tab = 'transakcije' | 'ugovori'

export default function AdminFinansijePage() {
  const [tab, setTab] = useState<Tab>('transakcije')
  const [transakcije, setTransakcije] = useState<Transakcija[]>([])
  const [rezervacije, setRezervacije] = useState<Rezervacija[]>([])
  const [loading, setLoading] = useState(true)

  // Transakcije filteri
  const [tSearch, setTSearch] = useState('')
  const [tOd, setTOd] = useState('')
  const [tDo, setTDo] = useState('')
  const [tTip, setTTip] = useState('all')
  const [tKat, setTKat] = useState('all')
  const [tLimit, setTLimit] = useState(50)

  // Ugovori filteri
  const [uSearch, setUSearch] = useState('')
  const [uOd, setUOd] = useState('')
  const [uDo, setUDo] = useState('')
  const [uStatus, setUStatus] = useState('all')

  const loadData = useCallback(async () => {
    setLoading(true)
    const [{ data: t }, { data: r }] = await Promise.all([
      supabase.from('transakcije').select('*').order('timestamp_upisa', { ascending: false }),
      supabase.from('rezervacije').select('id, br_tablica, ime_prezime, telefon, od_datuma, do_datuma, ukupno_naplata, naplaceno, ko_je_izdao, ko_je_preuzeo, daily_status, ugovor_slika, email, nacin_placanja, depozit').order('id', { ascending: false }),
    ])
    setTransakcije(t || [])
    setRezervacije(r || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // ── TRANSAKCIJE stats ──
  const filteredTrans = transakcije.filter(t => {
    const q = tSearch.toLowerCase()
    const matchQ = !q || (t.osoba || '').toLowerCase().includes(q) ||
      (t.kategorija || '').toLowerCase().includes(q) ||
      (t.vozilo || '').toLowerCase().includes(q) ||
      (t.komentar || '').toLowerCase().includes(q)
    const matchOd = !tOd || (t.datum || '') >= tOd
    const matchDo = !tDo || (t.datum || '') <= tDo
    const matchTip = tTip === 'all' || t.tip_transakcije === tTip
    const matchKat = tKat === 'all' || t.kategorija === tKat
    return matchQ && matchOd && matchDo && matchTip && matchKat
  })

  const totalPriliv = filteredTrans.filter(t => t.tip_transakcije === 'Priliv' && t.status === 'zavrseno').reduce((s, t) => s + (t.iznos || 0), 0)
  const totalOdliv = filteredTrans.filter(t => t.tip_transakcije === 'Odliv' && t.status === 'zavrseno').reduce((s, t) => s + Math.abs(t.iznos || 0), 0)
  const neto = totalPriliv - totalOdliv

  const kategorije = ['all', ...Array.from(new Set(transakcije.map(t => t.kategorija).filter(Boolean))).sort()] as string[]
  const tipovi = ['all', ...Array.from(new Set(transakcije.map(t => t.tip_transakcije).filter(Boolean)))] as string[]

  // ── UGOVORI stats ──
  const filteredUgovori = rezervacije.filter(r => {
    const q = uSearch.toLowerCase()
    const matchQ = !q || (r.ime_prezime || '').toLowerCase().includes(q) ||
      (r.br_tablica || '').toLowerCase().includes(q) ||
      String(r.id).includes(q)
    const matchOd = !uOd || (r.od_datuma || '') >= uOd
    const matchDo = !uDo || (r.od_datuma || '') <= uDo
    const ukupno = r.ukupno_naplata || 0
    const naplaceno = r.naplaceno || 0
    const dug = ukupno - naplaceno
    const matchStatus = uStatus === 'all' ||
      (uStatus === 'dug' && dug > 0) ||
      (uStatus === 'bez_ugovora' && !r.ugovor_slika) ||
      (uStatus === 'placeno' && dug <= 0 && ukupno > 0)
    return matchQ && matchOd && matchDo && matchStatus
  })

  const ukupnoNaplaceno = filteredUgovori.reduce((s, r) => s + (r.naplaceno || 0), 0)
  const ukupnoDug = filteredUgovori.reduce((s, r) => s + Math.max(0, (r.ukupno_naplata || 0) - (r.naplaceno || 0)), 0)
  const ukupnoUgovora = filteredUgovori.length
  const bezUgovora = filteredUgovori.filter(r => !r.ugovor_slika).length

  async function toggleProvereno(id: string, cur: boolean | null) {
    await supabase.from('transakcije').update({ provereno: !cur }).eq('id', id)
    setTransakcije(prev => prev.map(t => t.id === id ? { ...t, provereno: !cur } : t))
  }

  async function deleteTransakcija(id: string) {
    if (!confirm('Obrisati transakciju?')) return
    await supabase.from('transakcije').delete().eq('id', id)
    setTransakcije(prev => prev.filter(t => t.id !== id))
  }

  const fmt = (n: number) => n.toFixed(2) + '€'
  const fmtDate = (d: string) => d ? d.split('-').reverse().join('.') : '/'

  const inp: React.CSSProperties = { padding: '7px 10px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', color: '#111', outline: 'none' }

  return (
    <div>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: '#111', margin: 0 }}>Finansije</h1>
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
              {/* Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
                {[
                  { label: 'Ukupno priliv', value: fmt(totalPriliv), color: '#1D9E75', bg: '#E1F5EE', border: '#5DCAA5' },
                  { label: 'Ukupno odliv', value: fmt(totalOdliv), color: '#dc2626', bg: '#FCEBEB', border: '#fecaca' },
                  { label: 'Neto', value: fmt(neto), color: neto >= 0 ? '#1D9E75' : '#dc2626', bg: neto >= 0 ? '#E1F5EE' : '#FCEBEB', border: neto >= 0 ? '#5DCAA5' : '#fecaca' },
                ].map(s => (
                  <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 10, padding: '14px 18px' }}>
                    <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>{s.label}</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
                  </div>
                ))}
              </div>

              {/* Filteri */}
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 16px', marginBottom: 14, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div>
                  <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 3, fontWeight: 600 }}>PRETRAGA</div>
                  <input value={tSearch} onChange={e => setTSearch(e.target.value)} placeholder="Osoba, kategorija, vozilo..." style={{ ...inp, width: 220 }} />
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 3, fontWeight: 600 }}>TIP</div>
                  <select value={tTip} onChange={e => setTTip(e.target.value)} style={{ ...inp, width: 130 }}>
                    {tipovi.map(t => <option key={t} value={t}>{t === 'all' ? 'Svi tipovi' : t}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 3, fontWeight: 600 }}>KATEGORIJA</div>
                  <select value={tKat} onChange={e => setTKat(e.target.value)} style={{ ...inp, width: 180 }}>
                    {kategorije.map(k => <option key={k} value={k}>{k === 'all' ? 'Sve kategorije' : k}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 3, fontWeight: 600 }}>OD</div>
                  <input type="date" value={tOd} onChange={e => setTOd(e.target.value)} style={inp} />
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 3, fontWeight: 600 }}>DO</div>
                  <input type="date" value={tDo} onChange={e => setTDo(e.target.value)} style={inp} />
                </div>
                {(tSearch || tOd || tDo || tTip !== 'all' || tKat !== 'all') && (
                  <button onClick={() => { setTSearch(''); setTOd(''); setTDo(''); setTTip('all'); setTKat('all') }}
                    style={{ padding: '7px 12px', fontSize: 12, border: '1px solid #fecaca', borderRadius: 8, background: '#FCEBEB', cursor: 'pointer', color: '#dc2626', alignSelf: 'flex-end' }}>
                    ✕ Reset
                  </button>
                )}
                <span style={{ fontSize: 12, color: '#9ca3af', alignSelf: 'flex-end', marginLeft: 'auto' }}>{filteredTrans.length} transakcija</span>
              </div>

              {/* Tabela */}
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 900 }}>
                  <thead>
                    <tr style={{ background: '#f9fafb' }}>
                      {['V', 'Datum', 'Tip', 'Kategorija', 'Iznos', 'Vozilo', 'Osoba', 'Komentar', 'Status', ''].map(h => (
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
                          <td style={{ padding: '8px 12px', color: '#374151', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                            {t.kategorija || '/'}
                          </td>
                          <td style={{ padding: '8px 12px', fontWeight: 700, color: isPriliv ? '#1D9E75' : '#dc2626', whiteSpace: 'nowrap' as const }}>
                            {isPriliv ? '+' : '-'}{Math.abs(iznos).toFixed(2)}€
                          </td>
                          <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 11, color: '#6b7280' }}>{t.vozilo || '/'}</td>
                          <td style={{ padding: '8px 12px', fontSize: 11, color: '#374151', whiteSpace: 'nowrap' as const }}>{t.osoba || '/'}</td>
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
                            <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, fontWeight: 600, background: t.status === 'zavrseno' ? '#E1F5EE' : '#FAEEDA', color: t.status === 'zavrseno' ? '#085041' : '#633806' }}>
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
              {/* Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
                {[
                  { label: 'Ukupno ugovora', value: ukupnoUgovora, color: '#374151', bg: '#f9fafb', border: '#e5e7eb', isNum: true },
                  { label: 'Naplaćeno', value: fmt(ukupnoNaplaceno), color: '#1D9E75', bg: '#E1F5EE', border: '#5DCAA5', isNum: false },
                  { label: 'Neplaćeno (dug)', value: fmt(ukupnoDug), color: '#dc2626', bg: '#FCEBEB', border: '#fecaca', isNum: false },
                  { label: 'Bez ugovora', value: bezUgovora, color: '#BA7517', bg: '#FAEEDA', border: '#EF9F27', isNum: true },
                ].map(s => (
                  <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 10, padding: '12px 16px' }}>
                    <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>{s.label}</div>
                    <div style={{ fontSize: s.isNum ? 28 : 20, fontWeight: 700, color: s.color }}>{s.value}</div>
                  </div>
                ))}
              </div>

              {/* Filteri */}
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 16px', marginBottom: 14, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div>
                  <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 3, fontWeight: 600 }}>PRETRAGA</div>
                  <input value={uSearch} onChange={e => setUSearch(e.target.value)} placeholder="Klijent, tablice, ID..." style={{ ...inp, width: 220 }} />
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 3, fontWeight: 600 }}>OD DATUMA</div>
                  <input type="date" value={uOd} onChange={e => setUOd(e.target.value)} style={inp} />
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 3, fontWeight: 600 }}>DO DATUMA</div>
                  <input type="date" value={uDo} onChange={e => setUDo(e.target.value)} style={inp} />
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 3, fontWeight: 600 }}>FILTER</div>
                  <select value={uStatus} onChange={e => setUStatus(e.target.value)} style={{ ...inp, width: 200 }}>
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

              {/* Tabela */}
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
                          <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 600, color: '#374151', fontSize: 12 }}>
                            {r.br_tablica}
                          </td>
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
