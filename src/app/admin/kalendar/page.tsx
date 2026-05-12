'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import { RezervacijaModal, RezForm, VoziloOption, EMPTY_REZ_FORM, calcDana, calcUkupno } from '@/lib/RezervacijaModal'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type KalRezervacija = {
  id: number; br_tablica: string; ime_prezime: string; daily_status: string
  od_datuma: string; do_datuma: string; vreme_izdavanja?: string; vreme_povratka?: string
  cijena_dan?: number; nacin_placanja?: string; firma?: string; adresa?: string
  telefon?: string; email?: string; zemlja?: string; datum_rodjenja?: string
  tip_osiguranja?: string; kasko_cijena?: number; kasko_tip?: string; kasko_ucesce?: number
  granica?: string; depozit?: number; napomena?: string; bebi_sic_cijena?: number
  dozvola_van_zemlje_cijena?: number; dostava_cijena?: number; dodatni_vozac_cijena?: number
  dodatni_vozac_vozacka?: string; ukupno_naplata?: number; naplaceno?: number
  br_vozacke?: string; br_vozacke2?: string; ime2?: string; prezime2?: string
  ko_je_izdao?: string; ko_je_preuzeo?: string; br_leta?: string
  mjesto_preuzimanja?: string; mjesto_povratka?: string; izvor_rezervacije?: string
}

type Duznik = { id?: number; br_vozacke: string; ime_prezime: string; telefon?: string; ukupan_dug: number; istorija?: any[] }

const LOKACIJE = ['CRNA GORA', 'BiH', 'SRBIJA', 'ALBANIJA']
const SIFRE: Record<string, string> = { 'CRNA GORA': 'cg810805', 'BiH': 'bih000', 'SRBIJA': 'srb222', 'ALBANIJA': 'alb333' }
const MONTHS = ['Januar', 'Februar', 'Mart', 'April', 'Maj', 'Juni', 'Juli', 'August', 'Septembar', 'Oktobar', 'Novembar', 'Decembar']

function toDMY(iso: string) {
  if (!iso) return ''
  const p = iso.split('-')
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso
}

function getCookie(name: string): string {
  if (typeof document === 'undefined') return ''
  const match = document.cookie.match(new RegExp(`${name}=([^;]+)`))
  return match ? decodeURIComponent(match[1]) : ''
}

function normalize(s: string): string {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

function rezToForm(r: KalRezervacija): RezForm {
  return {
    id: r.id, br_vozacke: r.br_vozacke || '', ime_prezime: r.ime_prezime || '',
    zemlja: r.zemlja || '', datum_rodjenja: r.datum_rodjenja || '', telefon: r.telefon || '',
    email: r.email || '', adresa: r.adresa || '', istek_vozacke: '',
    br_vozacke2: r.br_vozacke2 || '', ime2: r.ime2 || '', prezime2: r.prezime2 || '',
    br_tablica: r.br_tablica || '', firma: r.firma || 'Meriem d.o.o.',
    tip_osiguranja: r.tip_osiguranja || 'Osnovno (AO)', kasko_cijena: r.kasko_cijena || 0,
    kasko_tip: r.kasko_tip || 'FULL KASKO', kasko_ucesce: r.kasko_ucesce || 0,
    granica: r.granica || 'DOZVOLJENO VAN ZEMLJE', napomena: r.napomena || '', br_leta: r.br_leta || '',
    ko_je_izdao: r.ko_je_izdao || '', ko_je_preuzeo: r.ko_je_preuzeo || '',
    daily_status: r.daily_status || 'Na čekanju', od_datuma: r.od_datuma || '', do_datuma: r.do_datuma || '',
    vreme_izdavanja: r.vreme_izdavanja || '10:00', vreme_povratka: r.vreme_povratka || '10:00',
    cijena_dan: r.cijena_dan || 0, depozit: r.depozit || 0, nacin_placanja: r.nacin_placanja || 'Keš',
    mjesto_preuzimanja: r.mjesto_preuzimanja || 'Bulevar Veljka Vlahovića 16',
    mjesto_povratka: r.mjesto_povratka || 'Bulevar Veljka Vlahovića 16',
    izvor_rezervacije: r.izvor_rezervacije || 'Sajt',
    dozvola_van_zemlje_cijena: r.dozvola_van_zemlje_cijena || 0, dostava_cijena: r.dostava_cijena || 0,
    bebi_sic_cijena: r.bebi_sic_cijena || 0, dodatni_vozac_cijena: r.dodatni_vozac_cijena || 0,
    dodatni_vozac_vozacka: r.dodatni_vozac_vozacka || '', naplaceno: r.naplaceno || 0,
  }
}

export default function AdminKalendarPage() {
  const calendarRef = useRef<HTMLDivElement>(null)
  const calendarInstanceRef = useRef<any>(null)
  const [currentLok, setCurrentLokState] = useState('CRNA GORA')
  const currentLokRef = useRef('CRNA GORA')
  const [vozila, setVozila] = useState<VoziloOption[]>([])
  const vozilaRef = useRef<VoziloOption[]>([])
  const [rezervacije, setRezervacije] = useState<KalRezervacija[]>([])
  const rezervacijeRef = useRef<KalRezervacija[]>([])
  const [duznici, setDuznici] = useState<Duznik[]>([])
  const [loading, setLoading] = useState(true)
  const [fcLoaded, setFcLoaded] = useState(false)
  const today = new Date().toISOString().split('T')[0]

  const [showRezModal, setShowRezModal] = useState(false)
  const [showDuznici, setShowDuznici] = useState(false)
  const [rezForm, setRezForm] = useState<RezForm>(EMPTY_REZ_FORM)
  const [isNewRez, setIsNewRez] = useState(false)
  const [saving, setSaving] = useState(false)
  const [searchQ, setSearchQ] = useState('')

  // Učitaj FullCalendar Scheduler
  useEffect(() => {
    if ((window as any).FullCalendar) { setFcLoaded(true); return }
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/fullcalendar-scheduler@6.1.11/index.global.min.js'
    script.onload = () => setFcLoaded(true)
    document.head.appendChild(script)
    const style = document.createElement('link')
    style.rel = 'stylesheet'
    style.href = 'https://cdn.jsdelivr.net/npm/fullcalendar-scheduler@6.1.11/index.global.min.css'
    document.head.appendChild(style)
  }, [])

  const loadAll = useCallback(async () => {
    setLoading(true)
    const [{ data: v }, { data: r }, { data: d }] = await Promise.all([
      supabase.from('vozila_fleet').select('id, license_plate, marka, model, agregirani_2, fleet_status, lokacija').order('marka'),
      supabase.from('rezervacije').select('*'),
      supabase.from('duznici').select('*').order('ukupan_dug', { ascending: false }),
    ])
    if (v) { setVozila(v); vozilaRef.current = v }
    if (r) { setRezervacije(r); rezervacijeRef.current = r }
    if (d) setDuznici(d)
    setLoading(false)
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  // Real-time
  useEffect(() => {
    const ch = supabase.channel('kal-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rezervacije' }, async () => {
        const { data } = await supabase.from('rezervacije').select('*')
        if (data) { rezervacijeRef.current = data; setRezervacije(data) }
        calendarInstanceRef.current?.refetchEvents()
      }).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  // Init FullCalendar kada su podaci i biblioteka učitani
  useEffect(() => {
    if (!fcLoaded || loading || !calendarRef.current) return
    if (calendarInstanceRef.current) {
      calendarInstanceRef.current.destroy()
      calendarInstanceRef.current = null
    }
    initCalendar()
  }, [fcLoaded, loading, currentLok])

  function getResources() {
    const q = searchQ.toLowerCase()
    return vozilaRef.current
      .filter(v => v.lokacija === currentLokRef.current)
      .filter(v => !q || (v.agregirani_2 || '').toLowerCase().includes(q) || (v.license_plate || '').toLowerCase().includes(q))
      .map(v => ({
        id: v.license_plate || '',
        building: (v.marka || 'Ostalo').toUpperCase(),
        title: v.agregirani_2 || v.license_plate || '',
      }))
  }

  function getEvents() {
    return rezervacijeRef.current.map(r => {
      const tStart = (r.vreme_izdavanja || '10:00').padEnd(5, '0')
      const tEnd = (r.vreme_povratka || '10:00').padEnd(5, '0')
      return {
        id: String(r.id),
        resourceId: r.br_tablica,
        start: `${r.od_datuma}T${tStart}`,
        end: `${r.do_datuma}T${tEnd}`,
        title: r.ime_prezime,
        className: r.daily_status === 'Izdato' ? 'ev-izdato' : r.daily_status === 'Nije izdato' ? 'ev-nije-izdato' : 'ev-cekanje',
      }
    })
  }

  function initCalendar() {
    if (!calendarRef.current || !(window as any).FullCalendar) return
    const FC = (window as any).FullCalendar

    const cal = new FC.Calendar(calendarRef.current, {
      schedulerLicenseKey: 'CC-Attribution-NonCommercialNoDerivatives',
      initialView: 'resourceTimelineMonth',
      editable: true,
      selectable: true,
      resourceGroupField: 'building',
      locale: 'sr-Latn',
      headerToolbar: {
        left: 'prev,next today',
        center: 'title',
        right: 'resourceTimelineMonth,resourceTimelineWeek',
      },
      slotLabelFormat: [{ weekday: 'short' }, { day: 'numeric' }],
      height: 'calc(100vh - 200px)',
      resources: getResources(),
      events: getEvents(),

      eventDrop: async (info: any) => {
        const startIso = info.event.startStr.split('T')[0]
        const endIso = info.event.endStr ? info.event.endStr.split('T')[0] : startIso
        const resId = info.newResource ? info.newResource.id : info.event.getResources()[0]?.id
        const payload: any = { od_datuma: startIso, do_datuma: endIso }
        if (resId) payload.br_tablica = resId
        const { error } = await supabase.from('rezervacije').update(payload).eq('id', info.event.id)
        if (error) { alert('Greška pri pomjeranju: ' + error.message); info.revert(); return }
        await supabase.from('logovi').insert([{ akcija: `Drag&Drop REZ #${info.event.id} → ${resId}, ${startIso}–${endIso}` }])
        const idx = rezervacijeRef.current.findIndex(r => r.id === parseInt(info.event.id))
        if (idx !== -1) rezervacijeRef.current[idx] = { ...rezervacijeRef.current[idx], ...payload }
      },

      eventClick: (info: any) => {
        const rez = rezervacijeRef.current.find(r => r.id === parseInt(info.event.id))
        if (rez) { setRezForm(rezToForm(rez)); setIsNewRez(false); setShowRezModal(true) }
      },

      select: (info: any) => {
        const startIso = info.startStr.split('T')[0]
        const resId = info.resource?.id || ''
        setRezForm({ ...EMPTY_REZ_FORM, br_tablica: resId, od_datuma: startIso })
        setIsNewRez(true)
        setShowRezModal(true)
        cal.unselect()
      },
    })

    cal.render()
    calendarInstanceRef.current = cal

    // CSS za boje
    const style = document.createElement('style')
    style.textContent = `
      .ev-cekanje { background-color: #f97316 !important; color: #fff !important; font-weight: 700; border: none !important; border-radius: 4px !important; }
      .ev-izdato { background-color: #1D9E75 !important; color: #fff !important; font-weight: 700; border: none !important; border-radius: 4px !important; }
      .ev-nije-izdato { background-color: #dc2626 !important; color: #fff !important; font-weight: 700; border: none !important; border-radius: 4px !important; }
      .fc-license-message { display: none !important; }
      .fc-datagrid-cell-frame { height: 32px !important; }
      .fc-timeline-lane { height: 32px !important; }
      .fc-resource-group .fc-datagrid-cell-frame { background: #1a1a2e !important; color: #fff !important; font-weight: 900 !important; }
      .fc-day-today { background-color: rgba(29, 158, 117, 0.08) !important; }
    `
    document.head.appendChild(style)
  }

  // Osvježi resurse kada se promijeni pretraga
  useEffect(() => {
    if (!calendarInstanceRef.current) return
    calendarInstanceRef.current.setOption('resources', getResources())
  }, [searchQ])

  function setLokacija(lok: string) {
    const key = `auth_${lok.replace(/\s+/g, '')}`
    if (sessionStorage.getItem(key) === 'ok') {
      currentLokRef.current = lok
      setCurrentLokState(lok)
      return
    }
    const uneto = window.prompt(`Lozinka za: ${lok}`)
    if (uneto === SIFRE[lok]) {
      sessionStorage.setItem(key, 'ok')
      currentLokRef.current = lok
      setCurrentLokState(lok)
    } else if (uneto !== null) alert('Pogrešna lozinka!')
  }

  async function saveRezervacija() {
    if (!rezForm.br_tablica || !rezForm.ime_prezime) { alert('Unesite tablice i ime!'); return }
    setSaving(true)
    const dana = calcDana(rezForm)
    const ukupno = calcUkupno(rezForm)
    const payload = {
      br_tablica: rezForm.br_tablica, ime_prezime: rezForm.ime_prezime, br_vozacke: rezForm.br_vozacke,
      daily_status: rezForm.daily_status, od_datuma: rezForm.od_datuma, do_datuma: rezForm.do_datuma,
      vreme_izdavanja: rezForm.vreme_izdavanja, vreme_povratka: rezForm.vreme_povratka,
      cijena_dan: rezForm.cijena_dan, nacin_placanja: rezForm.nacin_placanja, firma: rezForm.firma,
      adresa: rezForm.adresa, telefon: rezForm.telefon, email: rezForm.email, zemlja: rezForm.zemlja,
      datum_rodjenja: rezForm.datum_rodjenja, tip_osiguranja: rezForm.tip_osiguranja,
      kasko_cijena: rezForm.kasko_cijena, kasko_tip: rezForm.kasko_tip, kasko_ucesce: rezForm.kasko_ucesce,
      granica: rezForm.granica, depozit: rezForm.depozit, napomena: rezForm.napomena,
      bebi_sic_cijena: rezForm.bebi_sic_cijena, dozvola_van_zemlje_cijena: rezForm.dozvola_van_zemlje_cijena,
      dostava_cijena: rezForm.dostava_cijena, dodatni_vozac_cijena: rezForm.dodatni_vozac_cijena,
      dodatni_vozac_vozacka: rezForm.br_vozacke2, br_leta: rezForm.br_leta,
      mjesto_preuzimanja: rezForm.mjesto_preuzimanja, mjesto_povratka: rezForm.mjesto_povratka,
      izvor_rezervacije: rezForm.izvor_rezervacije, ko_je_izdao: rezForm.ko_je_izdao,
      naplaceno: rezForm.naplaceno, ukupno_naplata: ukupno, broj_dana: dana,
    }
    if (rezForm.id) {
      await supabase.from('rezervacije').update(payload).eq('id', rezForm.id)
      await supabase.from('logovi').insert([{ akcija: `Izmijenjena REZ #${rezForm.id}` }])
    } else {
      await supabase.from('rezervacije').insert([payload])
      await supabase.from('logovi').insert([{ akcija: `Kreirana rezervacija za ${rezForm.ime_prezime}` }])
    }
    setSaving(false)
    setShowRezModal(false)
    loadAll()
    calendarInstanceRef.current?.refetchEvents()
  }

  async function deleteRezervacija() {
    if (!rezForm.id) return
    const sifra = window.prompt('Admin lozinka za brisanje:')
    if (sifra !== '810805') { alert('Pogrešna!'); return }
    if (!confirm('Sigurno obrišete?')) return
    await supabase.from('rezervacije').delete().eq('id', rezForm.id)
    await supabase.from('logovi').insert([{ akcija: `Obrisana REZ #${rezForm.id}` }])
    setShowRezModal(false)
    loadAll()
    calendarInstanceRef.current?.refetchEvents()
  }

  async function razduziDuznika(br_v: string, trenutniDug: number) {
    const unos = window.prompt(`Dug: ${trenutniDug}€. Koliko plaća?`)
    if (!unos) return
    const sifra = window.prompt('Admin lozinka:')
    if (sifra !== '810805') { alert('Pogrešna!'); return }
    const uplata = parseFloat(unos)
    if (isNaN(uplata) || uplata <= 0) return
    const { data: d } = await supabase.from('duznici').select('*').eq('br_vozacke', br_v).single()
    if (!d) return
    const noviDug = d.ukupan_dug - uplata
    const istorija = [...(d.istorija || []), { datum: new Date().toLocaleString('sr-RS'), iznos: uplata, komentar: 'Uplata', tip: 'razduzenje' }]
    if (noviDug <= 0) {
      if (confirm('Dug otplaćen! Obrisati?')) await supabase.from('duznici').delete().eq('br_vozacke', br_v)
      else await supabase.from('duznici').update({ ukupan_dug: 0, istorija }).eq('br_vozacke', br_v)
    } else {
      await supabase.from('duznici').update({ ukupan_dug: noviDug, istorija }).eq('br_vozacke', br_v)
    }
    loadAll()
  }

  const vozilaLok = vozila.filter(v => v.lokacija === currentLok)
  const zauzetaDanas = new Set(
    rezervacije.filter(r => r.daily_status !== 'Nije izdato' && r.od_datuma <= today && r.do_datuma > today && vozilaLok.find(v => v.license_plate === r.br_tablica)).map(r => r.br_tablica)
  )

  return (
    <div>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#111', margin: 0 }}>Kalendar zauzetosti</h1>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '2px 0 0' }}>
            {vozilaLok.length} vozila · <span style={{ color: '#dc2626' }}>{zauzetaDanas.size} zauzeto</span> · <span style={{ color: '#1D9E75' }}>{vozilaLok.length - zauzetaDanas.size} slobodno</span> danas
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Pretraži vozilo..."
            style={{ padding: '7px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, width: 180 }} />
          <button onClick={() => { setRezForm(EMPTY_REZ_FORM); setIsNewRez(true); setShowRezModal(true) }}
            style={{ padding: '8px 16px', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            + Nova rezervacija
          </button>
          <button onClick={() => setShowDuznici(true)}
            style={{ padding: '8px 16px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            📝 Dužnici ({duznici.length})
          </button>
        </div>
      </div>

      {/* LOKACIJE */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {LOKACIJE.map(l => (
          <button key={l} onClick={() => setLokacija(l)}
            style={{ padding: '7px 16px', fontSize: 12, fontWeight: 600, border: `1px solid ${currentLok === l ? '#1D9E75' : '#e5e7eb'}`, borderRadius: 20, background: currentLok === l ? '#E1F5EE' : '#fff', color: currentLok === l ? '#085041' : '#6b7280', cursor: 'pointer' }}>
            {l === 'CRNA GORA' ? '🇲🇪' : l === 'BiH' ? '🇧🇦' : l === 'SRBIJA' ? '🇷🇸' : '🇦🇱'} {l}
          </button>
        ))}
      </div>

      {/* LEGENDA */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        {[['#f97316', 'Na čekanju'], ['#1D9E75', 'Izdato'], ['#dc2626', 'Nije izdato']].map(([color, label]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#6b7280' }}>
            <div style={{ width: 12, height: 12, borderRadius: 2, background: color }} />{label}
          </div>
        ))}
        <span style={{ fontSize: 11, color: '#9ca3af' }}>✦ Prevuci rezervaciju da pomjeriš · Klikni za detalje · Selektuj prazno polje za novu rezervaciju</span>
      </div>

      {/* KALENDAR */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af', fontSize: 14 }}>Učitavanje...</div>
      ) : !fcLoaded ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af', fontSize: 14 }}>Učitavam FullCalendar...</div>
      ) : (
        <div ref={calendarRef} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }} />
      )}

      {/* REZ MODAL */}
      {showRezModal && (
        <RezervacijaModal
          form={rezForm} setForm={setRezForm}
          vozila={vozilaLok}
          onSave={saveRezervacija}
          onClose={() => setShowRezModal(false)}
          onDelete={!isNewRez ? deleteRezervacija : undefined}
          saving={saving} isNew={isNewRez}
        />
      )}

      {/* DUŽNICI MODAL */}
      {showDuznici && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 800, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#fff' }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#dc2626' }}>⚠️ Lista dužnika</h2>
              <button onClick={() => setShowDuznici(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#9ca3af' }}>✕</button>
            </div>
            <div style={{ padding: 20 }}>
              <NoviDugForm onSave={loadAll} />
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginTop: 16 }}>
                <thead><tr style={{ background: '#f9fafb' }}>
                  {['Ime', 'Vozačka', 'Telefon', 'Dug', 'Akcija'].map(h => <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, fontSize: 12, color: '#6b7280', borderBottom: '2px solid #e5e7eb' }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {duznici.map(d => (
                    <tr key={d.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>{d.ime_prezime}</td>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: '#6b7280' }}>{d.br_vozacke}</td>
                      <td style={{ padding: '10px 12px', color: '#6b7280' }}>{d.telefon || '/'}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 700, fontSize: 16, color: '#dc2626' }}>{d.ukupan_dug.toFixed(2)} €</td>
                      <td style={{ padding: '10px 12px' }}>
                        <button onClick={() => razduziDuznika(d.br_vozacke, d.ukupan_dug)}
                          style={{ padding: '6px 12px', fontSize: 12, border: '1px solid #1D9E75', borderRadius: 8, background: '#E1F5EE', cursor: 'pointer', color: '#085041', fontWeight: 600 }}>Uplata</button>
                      </td>
                    </tr>
                  ))}
                  {duznici.length === 0 && <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>Nema dužnika.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function NoviDugForm({ onSave }: { onSave: () => void }) {
  const [form, setForm] = useState({ br_vozacke: '', ime_prezime: '', telefon: '', iznos: '', komentar: '' })
  const inp: React.CSSProperties = { width: '100%', padding: '7px 10px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', color: '#111', boxSizing: 'border-box' }
  const lbl: React.CSSProperties = { fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 3 }
  async function save() {
    if (!form.br_vozacke || !form.ime_prezime || !form.iznos || !form.komentar) { alert('Popunite sva polja!'); return }
    const iznos = parseFloat(form.iznos)
    const { data: d } = await supabase.from('duznici').select('*').eq('br_vozacke', form.br_vozacke).maybeSingle()
    const hist = [...(d?.istorija || []), { datum: new Date().toLocaleString('sr-RS'), iznos, komentar: form.komentar, tip: 'zaduzenje' }]
    if (d) await supabase.from('duznici').update({ ukupan_dug: d.ukupan_dug + iznos, istorija: hist }).eq('br_vozacke', form.br_vozacke)
    else await supabase.from('duznici').insert([{ br_vozacke: form.br_vozacke, ime_prezime: form.ime_prezime, telefon: form.telefon, ukupan_dug: iznos, istorija: hist }])
    setForm({ br_vozacke: '', ime_prezime: '', telefon: '', iznos: '', komentar: '' })
    onSave()
  }
  return (
    <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: 14, marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>+ Unesi novi dug</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        {[['br_vozacke','Vozačka *'],['ime_prezime','Ime *'],['telefon','Tel'],['iznos','Iznos €*'],['komentar','Komentar *']].map(([k,l]) => (
          <div key={k} style={{ flex: 1, minWidth: 90 }}>
            <label style={lbl}>{l}</label>
            <input style={inp} value={(form as any)[k]} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))} />
          </div>
        ))}
        <button onClick={save} style={{ padding: '7px 14px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>+ Zaduži</button>
      </div>
    </div>
  )
}
