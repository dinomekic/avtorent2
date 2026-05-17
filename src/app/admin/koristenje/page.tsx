'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Koristenje = {
  id: string; timestamp_tekst: string | null; email: string | null
  ime_prezime: string | null; tablice: string | null; destinacija: string | null
  kilometraza: number | null; km_start: number | null; km_end: number | null
  predjena_km: number | null; status: string | null
  vreme_zaduzenja: string | null; vreme_povratka: string | null
  ukupno_vremena: string | null; timestamp_upisa: string | null
}

type Transakcija = {
  id: string; osobaemail: string | null; kategorija: string | null
  iznos: number | null; status: string | null
}

function getCookie(name: string): string {
  if (typeof document === 'undefined') return ''
  const match = document.cookie.match(new RegExp(`${name}=([^;]+)`))
  return match ? decodeURIComponent(match[1]) : ''
}

const inp: React.CSSProperties = { width: '100%', padding: '7px 10px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 7, color: '#111', boxSizing: 'border-box' as const, background: '#fff' }

export default function AdminKoristenjePage() {
  const [koristenje, setKoristenje] = useState<Koristenje[]>([])
  const [transakcije, setTransakcije] = useState<Transakcija[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterAgent, setFilterAgent] = useState('')
  const [filterTablice, setFilterTablice] = useState('')
  const [activeTab, setActiveTab] = useState<'lista' | 'dugovi'>('lista')
  const agentName = getCookie('avtorent-agent-name')

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [{ data: k }, { data: t }] = await Promise.all([
      supabase.from('koristenje').select('*').order('timestamp_upisa', { ascending: false }),
      supabase.from('transakcije').select('id, osobaemail, kategorija, iznos, status')
        .eq('kategorija', 'Uplata duga za službeno vozilo').eq('status', 'Zavrseno'),
    ])
    setKoristenje(k || [])
    setTransakcije(t || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  async function updateField(id: string, col: string, val: string) {
    await supabase.from('koristenje').update({ [col]: val }).eq('id', id)
  }

  async function deleteRow(id: string) {
    if (!confirm('Obrisati zapis?')) return
    await supabase.from('koristenje').delete().eq('id', id)
    setKoristenje(prev => prev.filter(k => k.id !== id))
  }

  // Izračunaj dugove — cijena: 1.44€/100km * 8 = ~0.1152€/km
  const KM_CIJENA = 1.44 * 8 / 100 // € po km

  const dugovi: Record<string, { ime: string; email: string; ukupnoKm: number; uplaceno: number; dug: number }> = {}

  koristenje.forEach(k => {
    const email = (k.email || '').toLowerCase().trim()
    if (!email) return
    const km = parseFloat(String(k.predjena_km || k.kilometraza || 0))
    if (!dugovi[email]) dugovi[email] = { ime: k.ime_prezime || email, email, ukupnoKm: 0, uplaceno: 0, dug: 0 }
    dugovi[email].ukupnoKm += km
  })

  transakcije.forEach(t => {
    const email = (t.osobaemail || '').toLowerCase().trim()
    if (!email || !dugovi[email]) return
    dugovi[email].uplaceno += Math.abs(parseFloat(String(t.iznos || 0)))
  })

  Object.values(dugovi).forEach(d => {
    d.dug = d.ukupnoKm * KM_CIJENA - d.uplaceno
  })

  const dugSorted = Object.values(dugovi).filter(d => d.ukupnoKm > 0).sort((a, b) => b.dug - a.dug)

  // Filtrirani zapisi
  const agenti = Array.from(new Set(koristenje.map(k => k.ime_prezime || k.email || '').filter(Boolean))).sort()
  const tabliceList = Array.from(new Set(koristenje.map(k => k.tablice || '').filter(Boolean))).sort()

  const filtered = koristenje.filter(k => {
    const q = search.toLowerCase()
    const matchQ = !q || (k.tablice || '').toLowerCase().includes(q) || (k.ime_prezime || '').toLowerCase().includes(q) || (k.destinacija || '').toLowerCase().includes(q) || (k.email || '').toLowerCase().includes(q)
    const matchAgent = !filterAgent || k.ime_prezime === filterAgent || k.email === filterAgent
    const matchTablice = !filterTablice || k.tablice === filterTablice
    return matchQ && matchAgent && matchTablice
  })

  const totalKm = filtered.reduce((s, k) => s + parseFloat(String(k.predjena_km || k.kilometraza || 0)), 0)

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 0 80px' }}>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#111' }}>Korišćenje vozila</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Evidencija i dugovi za km</div>
        </div>
      </div>

      {/* DUGOVI BANNER */}
      {dugSorted.filter(d => d.dug > 1).length > 0 && (
        <div onClick={() => setActiveTab('dugovi')}
          style={{ background: '#FCEBEB', border: '1px solid #DC2626', borderRadius: 8, padding: '8px 14px', marginBottom: 12, cursor: 'pointer', fontSize: 12 }}>
          <span style={{ color: '#DC2626', fontWeight: 700 }}>⚠️ Aktivni dugovi za km: </span>
          {dugSorted.filter(d => d.dug > 1).map(d => (
            <span key={d.email} style={{ marginRight: 12, color: '#DC2626' }}>
              {d.ime} ({d.dug.toFixed(2)}€)
            </span>
          ))}
        </div>
      )}

      {/* TABOVI */}
      <div style={{ display: 'flex', borderBottom: '2px solid #f3f4f6', marginBottom: 14 }}>
        {([['lista', '📋 Lista korišćenja'], ['dugovi', '⚠️ Dugovi za km']] as const).map(([t, l]) => (
          <button key={t} onClick={() => setActiveTab(t)}
            style={{ padding: '8px 18px', fontSize: 13, border: 'none', background: 'none', cursor: 'pointer', fontWeight: activeTab === t ? 700 : 400, color: activeTab === t ? '#1D9E75' : '#9ca3af', borderBottom: activeTab === t ? '2px solid #1D9E75' : '2px solid transparent', marginBottom: -2 }}>
            {l}
          </button>
        ))}
      </div>

      {/* ═══ TAB: LISTA ═══ */}
      {activeTab === 'lista' && (
        <>
          {/* FILTERI */}
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '10px 12px', marginBottom: 12 }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Pretraži tablice, ime, destinacija..." style={{ ...inp, marginBottom: 8, fontSize: 13 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <select value={filterAgent} onChange={e => setFilterAgent(e.target.value)} style={{ ...inp, flex: 1 }}>
                <option value="">Svi agenti</option>
                {agenti.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              <select value={filterTablice} onChange={e => setFilterTablice(e.target.value)} style={{ ...inp, flex: 1 }}>
                <option value="">Sve tablice</option>
                {tabliceList.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              {(search || filterAgent || filterTablice) && (
                <button onClick={() => { setSearch(''); setFilterAgent(''); setFilterTablice('') }}
                  style={{ padding: '5px 10px', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 7, background: '#fff', cursor: 'pointer', color: '#6b7280' }}>✕</button>
              )}
            </div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>
              {filtered.length} zapisa · Ukupno km: <strong>{totalKm.toFixed(0)} km</strong>
            </div>
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Učitavanje...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', border: '1px dashed #e5e7eb', borderRadius: 12 }}>Nema zapisa.</div>
          ) : (
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' as const }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 700 }}>
                  <thead>
                    <tr style={{ background: '#f9fafb' }}>
                      {['Datum/Vrijme', 'Agent', 'Tablice', 'KM', 'Destinacija', 'Zaduženje', 'Povratak', 'Ukupno', 'Status', ''].map(h => (
                        <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, fontSize: 11, color: '#6b7280', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' as const }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(k => {
                      const km = parseFloat(String(k.predjena_km || k.kilometraza || 0))
                      const cijena = km * KM_CIJENA
                      return (
                        <tr key={k.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '8px 10px', color: '#9ca3af', whiteSpace: 'nowrap' as const }}>
                            {k.timestamp_upisa ? new Date(k.timestamp_upisa).toLocaleDateString('sr-RS', { day: '2-digit', month: '2-digit', year: '2-digit' }) : k.timestamp_tekst || '—'}
                          </td>
                          <td style={{ padding: '8px 10px', fontWeight: 600, color: '#111' }}>{k.ime_prezime || k.email || '—'}</td>
                          <td style={{ padding: '8px 10px' }}>
                            <input defaultValue={k.tablice || ''} onBlur={e => updateField(k.id, 'tablice', e.target.value)} style={{ ...inp, fontFamily: 'monospace', fontWeight: 700, width: 90 }} />
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            <div style={{ fontWeight: 700, color: '#111' }}>{km > 0 ? `${km.toFixed(0)} km` : '—'}</div>
                            {cijena > 0 && <div style={{ fontSize: 10, color: '#DC2626', fontWeight: 600 }}>{cijena.toFixed(2)}€</div>}
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            <input defaultValue={k.destinacija || ''} onBlur={e => updateField(k.id, 'destinacija', e.target.value)} style={{ ...inp, minWidth: 120 }} />
                          </td>
                          <td style={{ padding: '8px 10px', color: '#374151', fontSize: 11 }}>{k.vreme_zaduzenja || '—'}</td>
                          <td style={{ padding: '8px 10px', color: '#374151', fontSize: 11 }}>{k.vreme_povratka || '—'}</td>
                          <td style={{ padding: '8px 10px', color: '#374151', fontSize: 11, whiteSpace: 'nowrap' as const }}>{k.ukupno_vremena || '—'}</td>
                          <td style={{ padding: '8px 10px' }}>
                            {k.status && <span style={{ fontSize: 10, background: '#E1F5EE', color: '#085041', padding: '2px 7px', borderRadius: 20 }}>{k.status}</span>}
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            <button onClick={() => deleteRow(k.id)} style={{ color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}>✕</button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ═══ TAB: DUGOVI ═══ */}
      {activeTab === 'dugovi' && (
        <>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>
            Cijena po km: <strong>1.44€/100km × 8 = {(KM_CIJENA * 100).toFixed(2)}€/100km</strong>
          </div>

          <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
            <div style={{ background: '#f9fafb', padding: '8px 14px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' as const }}>
              <span>Agent</span>
              <div style={{ display: 'flex', gap: 40 }}>
                <span>Km ukupno</span>
                <span>Plaćeno</span>
                <span>Dug</span>
              </div>
            </div>
            {dugSorted.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Nema dugova.</div>
            ) : dugSorted.map(d => (
              <div key={d.email} style={{ padding: '12px 14px', borderBottom: '1px solid #f3f4f6', background: '#fff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#111' }}>{d.ime}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>{d.email}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 32, alignItems: 'center', fontSize: 13 }}>
                    <div style={{ textAlign: 'right' as const }}>
                      <div style={{ fontWeight: 600, color: '#374151' }}>{d.ukupnoKm.toFixed(0)} km</div>
                      <div style={{ fontSize: 10, color: '#9ca3af' }}>× {(KM_CIJENA).toFixed(4)}€/km</div>
                    </div>
                    <div style={{ textAlign: 'right' as const }}>
                      <div style={{ fontWeight: 600, color: '#1D9E75' }}>{d.uplaceno.toFixed(2)}€</div>
                      <div style={{ fontSize: 10, color: '#9ca3af' }}>uplaćeno</div>
                    </div>
                    <div style={{ textAlign: 'right' as const, minWidth: 80 }}>
                      <div style={{ fontWeight: 800, fontSize: 16, color: d.dug > 1 ? '#DC2626' : '#1D9E75' }}>
                        {d.dug > 0 ? `${d.dug.toFixed(2)}€` : '✓'}
                      </div>
                      <div style={{ fontSize: 10, color: '#9ca3af' }}>{d.dug > 0 ? 'dug' : 'izmireno'}</div>
                    </div>
                  </div>
                </div>

                {/* Breakdown po tablicama */}
                {(() => {
                  const byTablice: Record<string, number> = {}
                  koristenje.filter(k => (k.email || '').toLowerCase().trim() === d.email).forEach(k => {
                    const t = k.tablice || 'Nepoznato'
                    const km = parseFloat(String(k.predjena_km || k.kilometraza || 0))
                    byTablice[t] = (byTablice[t] || 0) + km
                  })
                  const entries = Object.entries(byTablice).filter(([, km]) => km > 0).sort((a, b) => b[1] - a[1])
                  if (entries.length === 0) return null
                  return (
                    <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap' as const, gap: 6 }}>
                      {entries.map(([tab, km]) => (
                        <span key={tab} style={{ fontSize: 11, background: '#f3f4f6', border: '1px solid #e5e7eb', padding: '2px 8px', borderRadius: 6, fontFamily: 'monospace', fontWeight: 600 }}>
                          {tab}: {km.toFixed(0)}km · {(km * KM_CIJENA).toFixed(2)}€
                        </span>
                      ))}
                    </div>
                  )
                })()}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
