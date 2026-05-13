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

function toDMY(iso: string) {
  if (!iso) return ''
  const p = iso.split('-')
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso
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
  const calInstanceRef = useRef<any>(null)
  const [currentLok, setCurrentLokState] = useState('CRNA GORA')
  const currentLokRef = useRef('CRNA GORA')
  const [vozila, setVozila] = useState<VoziloOption[]>([])
  const vozilaRef = useRef<VoziloOption[]>([])
  const rezervacijeRef = useRef<KalRezervacija[]>([])
  const [duznici, setDuznici] = useState<Duznik[]>([])
  const [loading, setLoading] = useState(true)
  const [fcLoaded, setFcLoaded] = useState(false)
  const [searchQ, setSearchQ] = useState('')
  const searchQRef = useRef('')
  const today = new Date().toISOString().split('T')[0]

  const [showRezModal, setShowRezModal] = useState(false)
  const [showDuznici, setShowDuznici] = useState(false)
  const [rezForm, setRezForm] = useState<RezForm>(EMPTY_REZ_FORM)
  const [isNewRez, setIsNewRez] = useState(false)
  const [saving, setSaving] = useState(false)

  // Stats
  const [stats, setStats] = useState({ total: 0, zauzeto: 0 })
  const [slotWidth, setSlotWidth] = useState(28)
  const [rowHeight, setRowHeight] = useState(48)

  // Logovi
  const [showLogovi, setShowLogovi] = useState(false)
  const [logovi, setLogovi] = useState<any[]>([])

  // Filteri
  const [filterMenjac, setFilterMenjac] = useState('ALL')
  const filterMenjacRef = useRef('ALL')

  // Učitaj FullCalendar + CSS
  useEffect(() => {
    const addStyle = () => {
      if (document.getElementById('fc-custom-style')) return
      const s = document.createElement('style')
      s.id = 'fc-custom-style'
      s.textContent = `
        .fc { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 11px; }
        .fc .fc-license-message { display: none !important; }
        .fc-theme-standard td, .fc-theme-standard th { border-color: #e5e7eb !important; }
        .fc .fc-scrollgrid { border-color: #e5e7eb !important; }
        
        /* Header toolbar */
        .fc .fc-toolbar { padding: 8px 12px; background: #f9fafb; border-bottom: 1px solid #e5e7eb; margin: 0 !important; }
        .fc .fc-toolbar-title { font-size: 14px !important; font-weight: 700 !important; color: #111 !important; text-transform: capitalize; }
        .fc .fc-button { background: #fff !important; border: 1px solid #d1d5db !important; color: #374151 !important; font-size: 11px !important; font-weight: 600 !important; padding: 5px 10px !important; border-radius: 6px !important; box-shadow: none !important; text-transform: none !important; }
        .fc .fc-button:hover { background: #f3f4f6 !important; }
        .fc .fc-button-active, .fc .fc-button-primary:not(:disabled).fc-button-active { background: #1D9E75 !important; border-color: #1D9E75 !important; color: #fff !important; }
        .fc .fc-today-button { background: #E1F5EE !important; border-color: #1D9E75 !important; color: #085041 !important; }

        /* Column headers (days) */
        .fc .fc-col-header-cell { background: #f9fafb; }
        .fc .fc-col-header-cell-cushion { color: #6b7280 !important; font-weight: 600 !important; font-size: 10px !important; text-decoration: none !important; padding: 3px 2px !important; }
        .fc .fc-day-today .fc-col-header-cell-cushion { color: #1D9E75 !important; font-weight: 800 !important; }
        .fc .fc-day-today { background-color: rgba(29,158,117,0.06) !important; }

        /* Resource column — fiksna širina */
        .fc .fc-datagrid-cell { width: 180px !important; min-width: 180px !important; max-width: 180px !important; }
        .fc .fc-datagrid-header { width: 180px !important; min-width: 180px !important; }
        .fc .fc-datagrid-cell-cushion { 
          padding: 3px 8px !important; font-size: 11px !important; font-weight: 600 !important; 
          color: #111 !important; white-space: nowrap !important; overflow: hidden !important;
          text-overflow: ellipsis !important; max-width: 164px !important; display: block !important;
        }
        
        /* Resource group row */
        .fc .fc-resource-group .fc-datagrid-cell { background: #1a1f2e !important; }
        .fc .fc-resource-group .fc-datagrid-cell-cushion { 
          background: #1a1f2e !important; color: #e2e8f0 !important; font-weight: 900 !important;
          font-size: 10px !important; text-transform: uppercase !important; letter-spacing: 0.5px !important;
        }
        .fc .fc-resource-group td { background: #1a1f2e !important; border-color: #2d3748 !important; }
        .fc .fc-resource-group .fc-timeline-lane { background: #1a1f2e !important; }
        
        /* ROW HEIGHT — kritično za poravnanje */
        .fc .fc-datagrid-body tr, .fc .fc-timeline-body tr { height: 48px !important; }
        .fc .fc-datagrid-cell-frame { height: 48px !important; min-height: 48px !important; max-height: 48px !important; display: flex !important; align-items: center !important; }
        .fc .fc-timeline-lane-frame { height: 48px !important; min-height: 48px !important; }
        .fc .fc-timeline-lane { height: 48px !important; min-height: 48px !important; max-height: 48px !important; }

        /* Events */
        .fc .fc-event { border-radius: 3px !important; border: none !important; font-size: 10px !important; font-weight: 700 !important; padding: 1px 4px !important; cursor: pointer !important; margin: 1px 0 !important; }
        .fc .fc-event:hover { filter: brightness(0.9); }
        .ev-cekanje { background-color: #f97316 !important; color: #fff !important; }
        .ev-izdato { background-color: #1D9E75 !important; color: #fff !important; }
        .ev-nije-izdato { background-color: #dc2626 !important; color: #fff !important; }
        
        /* Timeline slot */
        .fc .fc-timeline-slot-frame { height: 48px !important; }
        .fc .fc-timeline-slot { min-width: 28px !important; }

        /* Scrollbar */
        .fc .fc-scroller::-webkit-scrollbar { height: 5px; width: 5px; }
        .fc .fc-scroller::-webkit-scrollbar-track { background: #f9fafb; }
        .fc .fc-scroller::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 3px; }
        
        /* Selection + now */
        .fc .fc-highlight { background: rgba(29,158,117,0.12) !important; }
        .fc .fc-now-indicator-line { border-color: #1D9E75 !important; border-width: 2px !important; }
        .fc .fc-now-indicator-arrow { border-top-color: #1D9E75 !important; }
        
        /* Sync scroll — ovo je ključno za poravnanje */
        .fc .fc-datagrid-body { overflow: hidden !important; }
      `
      document.head.appendChild(s)
    }

    if ((window as any).FullCalendar) { addStyle(); setFcLoaded(true); return }
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/fullcalendar-scheduler@6.1.11/index.global.min.js'
    script.onload = () => { addStyle(); setFcLoaded(true) }
    document.head.appendChild(script)
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://cdn.jsdelivr.net/npm/fullcalendar-scheduler@6.1.11/index.global.min.css'
    document.head.appendChild(link)
  }, [])

  const loadAll = useCallback(async () => {
    setLoading(true)
    const [{ data: v }, { data: r }, { data: d }] = await Promise.all([
      supabase.from('vozila_fleet').select('id, license_plate, marka, model, agregirani_2, fleet_status, lokacija').order('marka'),
      supabase.from('rezervacije').select('*'),
      supabase.from('duznici').select('*').order('ukupan_dug', { ascending: false }),
    ])
    if (v) { setVozila(v); vozilaRef.current = v }
    if (r) { rezervacijeRef.current = r }
    if (d) setDuznici(d)
    setLoading(false)
    updateStats(v || [], r || [])
  }, [])

  function updateStats(v: any[], r: any[]) {
    const lok = currentLokRef.current
    const vLok = v.filter((x: any) => x.lokacija === lok && (x.fleet_status || '').toLowerCase() === 'available')
    const tablice = new Set(vLok.map((x: any) => x.license_plate))
    const zauzeto = new Set(r.filter((x: any) =>
      x.daily_status !== 'Nije izdato' && x.od_datuma <= today && x.do_datuma > today && tablice.has(x.br_tablica)
    ).map((x: any) => x.br_tablica)).size
    setStats({ total: vLok.length, zauzeto })
  }

  useEffect(() => { loadAll() }, [loadAll])

  // Real-time
  useEffect(() => {
    const ch = supabase.channel('kal-rt2')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rezervacije' }, async () => {
        const { data } = await supabase.from('rezervacije').select('*')
        if (data) {
          rezervacijeRef.current = data
          calInstanceRef.current?.refetchEvents()
          updateStats(vozilaRef.current, data)
        }
      }).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  function getResources() {
    const q = searchQRef.current.toLowerCase()

    return vozilaRef.current
      .filter(v => v.lokacija === currentLokRef.current && (v.fleet_status || '').toLowerCase() === 'available')
      .filter(v => !q || (v.agregirani_2 || '').toLowerCase().includes(q) || (v.license_plate || '').toLowerCase().includes(q))
      .map(v => ({
        id: v.license_plate || '',
        building: (v.marka || 'Ostalo').toUpperCase(),
        title: v.agregirani_2 || v.license_plate || '',
      }))
  }

  function getEvents() {
    return rezervacijeRef.current.map(r => ({
      id: String(r.id),
      resourceId: r.br_tablica,
      start: `${r.od_datuma}T${(r.vreme_izdavanja || '10:00')}`,
      end: `${r.do_datuma}T${(r.vreme_povratka || '10:00')}`,
      title: r.ime_prezime,
      className: r.daily_status === 'Izdato' ? 'ev-izdato' : r.daily_status === 'Nije izdato' ? 'ev-nije-izdato' : 'ev-cekanje',
    }))
  }

  // Init / reinit kalendar
  useEffect(() => {
    if (!fcLoaded || loading || !calendarRef.current) return

    const FC = (window as any).FullCalendar
    if (!FC) return

    if (calInstanceRef.current) {
      calInstanceRef.current.destroy()
      calInstanceRef.current = null
    }

    const resources = getResources()
    const events = getEvents()

    const cal = new FC.Calendar(calendarRef.current, {
      schedulerLicenseKey: 'CC-Attribution-NonCommercialNoDerivatives',
      initialView: 'resourceTimelineMonth',
      editable: true,
      selectable: true,
      nowIndicator: true,
      eventMinWidth: 3,
      slotMinWidth: slotWidth,
      resourceAreaWidth: '220px',
      resourceGroupField: 'building',
      locale: 'sr-Latn',
      headerToolbar: { left: 'prev,next today', center: 'title', right: 'resourceTimelineMonth,resourceTimelineWeek' },
      buttonText: { today: 'Danas', month: 'Mjesec', week: 'Sedmica' },
      slotLabelFormat: [{ weekday: 'short' }, { day: 'numeric' }],
      height: 'calc(100vh - 210px)',
      resources,
      events,

      resourceLabelContent: (arg: any) => {
        const v = vozilaRef.current.find(v => v.license_plate === arg.resource.id)
        const naziv = v?.agregirani_2 || arg.resource.title
        const plate = v?.license_plate || ''
        const kratko = naziv.replace(plate, '').replace(/\s+/g, ' ').trim()
        return {
          html: `<div style="padding:2px 0;max-width:212px;">
            <div style="font-size:9px;font-weight:700;color:#111;white-space:normal;word-break:break-word;line-height:1.3;">${kratko}</div>
            <div style="font-size:9px;color:#6b7280;font-family:monospace;font-weight:700;">${plate.toUpperCase()}</div>
          </div>`
        }
      },

      slotLabelContent: (arg: any) => {
        const text = arg.text.trim()
        const isDay = !isNaN(parseInt(text)) && text.length <= 2
        if (isDay) {
          const d = arg.date
          const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
          const count = rezervacijeRef.current.filter(r =>
            r.od_datuma <= iso && r.do_datuma > iso &&
            vozilaRef.current.some(v => v.license_plate === r.br_tablica && v.lokacija === currentLokRef.current)
          ).length
          return { html: `<div style="text-align:center;"><div>${text}</div>${count > 0 ? `<div style="font-size:9px;color:#1D9E75;font-weight:900;">${count}🚗</div>` : '<div style="font-size:9px;">&nbsp;</div>'}</div>` }
        }
        return { html: `<span style="text-transform:lowercase;font-size:9px;color:#9ca3af;">${text}</span>` }
      },

      eventDrop: async (info: any) => {
        const startIso = info.event.startStr.split('T')[0]
        const endIso = info.event.endStr ? info.event.endStr.split('T')[0] : startIso
        const resId = info.newResource ? info.newResource.id : info.event.getResources()[0]?.id
        const payload: any = { od_datuma: startIso, do_datuma: endIso }
        if (resId) payload.br_tablica = resId
        const { error } = await supabase.from('rezervacije').update(payload).eq('id', info.event.id)
        if (error) { alert('Greška: ' + error.message); info.revert(); return }
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
    calInstanceRef.current = cal

    return () => {
      cal.destroy()
      calInstanceRef.current = null
    }
  }, [fcLoaded, loading, currentLok])

  useEffect(() => {
    searchQRef.current = searchQ
    if (calInstanceRef.current) {
      calInstanceRef.current.setOption('resources', getResources())
    }
  }, [searchQ])

  useEffect(() => {
    if (!calInstanceRef.current) return
    calInstanceRef.current.setOption('slotMinWidth', slotWidth)
  }, [slotWidth])

  useEffect(() => {
    if (!calInstanceRef.current) return
    // Updateuj CSS za visinu redova dinamički
    const styleId = 'fc-row-height-dynamic'
    let el = document.getElementById(styleId)
    if (!el) { el = document.createElement('style'); el.id = styleId; document.head.appendChild(el) }
    el.textContent = `
      .fc .fc-datagrid-body tr, .fc .fc-timeline-body tr { height: ${rowHeight}px !important; }
      .fc .fc-datagrid-cell-frame { height: ${rowHeight}px !important; min-height: ${rowHeight}px !important; max-height: ${rowHeight}px !important; }
      .fc .fc-timeline-lane-frame { height: ${rowHeight}px !important; min-height: ${rowHeight}px !important; }
      .fc .fc-timeline-lane { height: ${rowHeight}px !important; min-height: ${rowHeight}px !important; max-height: ${rowHeight}px !important; }
      .fc .fc-timeline-slot-frame { height: ${rowHeight}px !important; }
    `
    // Forsiraj re-render
    calInstanceRef.current.updateSize()
  }, [rowHeight])

  function setLokacija(lok: string) {
    const key = `auth_${lok.replace(/\s+/g, '')}`
    if (sessionStorage.getItem(key) === 'ok') { currentLokRef.current = lok; setCurrentLokState(lok); return }
    const uneto = window.prompt(`Lozinka za: ${lok}`)
    if (uneto === SIFRE[lok]) { sessionStorage.setItem(key, 'ok'); currentLokRef.current = lok; setCurrentLokState(lok) }
    else if (uneto !== null) alert('Pogrešna lozinka!')
  }

  async function saveRezervacija() {
    if (!rezForm.br_tablica || !rezForm.ime_prezime) { alert('Unesite tablice i ime!'); return }
    setSaving(true)
    const dana = calcDana(rezForm); const ukupno = calcUkupno(rezForm)
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
    setSaving(false); setShowRezModal(false)
    loadAll()
    setTimeout(() => calInstanceRef.current?.refetchEvents(), 500)
  }

  async function deleteRezervacija() {
    if (!rezForm.id) return
    const sifra = window.prompt('Admin lozinka za brisanje:')
    if (sifra !== '810805') { alert('Pogrešna!'); return }
    if (!confirm('Sigurno obrišete?')) return
    await supabase.from('rezervacije').delete().eq('id', rezForm.id)
    await supabase.from('logovi').insert([{ akcija: `Obrisana REZ #${rezForm.id}` }])
    setShowRezModal(false); loadAll()
    setTimeout(() => calInstanceRef.current?.refetchEvents(), 500)
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
    } else await supabase.from('duznici').update({ ukupan_dug: noviDug, istorija }).eq('br_vozacke', br_v)
    loadAll()
  }

  async function otvoriLogove() {
    const sifra = window.prompt('Admin lozinka:')
    if (sifra !== '810805') { alert('Pogrešna!'); return }
    const { data } = await supabase.from('logovi').select('*').order('id', { ascending: false }).limit(150)
    setLogovi(data || [])
    setShowLogovi(true)
  }

  const vozilaLok = vozila.filter(v => v.lokacija === currentLok && (v.fleet_status || '').toLowerCase() === 'available')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: '#111', margin: 0 }}>Kalendar zauzetosti</h1>
          </div>
          {/* Stats */}
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ background: '#FCEBEB', border: '1px solid #fecaca', borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 700, color: '#dc2626' }}>
              📊 Zauzeto: {stats.zauzeto}/{stats.total}
            </div>
            <div style={{ background: '#E1F5EE', border: '1px solid #5DCAA5', borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 700, color: '#085041' }}>
              🟢 Slobodno: {stats.total - stats.zauzeto}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Pretraži vozilo..."
            style={{ padding: '7px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 12, width: 170, outline: 'none' }} />

          {/* ZOOM KONTROLE */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '4px 8px' }}>
            <span style={{ fontSize: 10, color: '#9ca3af', fontWeight: 700, marginRight: 2 }}>↔</span>
            <button onClick={() => setSlotWidth(w => Math.max(14, w - 4))}
              style={{ width: 22, height: 22, border: '1px solid #e5e7eb', borderRadius: 4, background: '#f9fafb', cursor: 'pointer', fontSize: 13, lineHeight: 1, color: '#374151' }}>−</button>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#374151', minWidth: 20, textAlign: 'center' }}>{slotWidth}</span>
            <button onClick={() => setSlotWidth(w => Math.min(80, w + 4))}
              style={{ width: 22, height: 22, border: '1px solid #e5e7eb', borderRadius: 4, background: '#f9fafb', cursor: 'pointer', fontSize: 13, lineHeight: 1, color: '#374151' }}>+</button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '4px 8px' }}>
            <span style={{ fontSize: 10, color: '#9ca3af', fontWeight: 700, marginRight: 2 }}>↕</span>
            <button onClick={() => setRowHeight(h => Math.max(24, h - 4))}
              style={{ width: 22, height: 22, border: '1px solid #e5e7eb', borderRadius: 4, background: '#f9fafb', cursor: 'pointer', fontSize: 13, lineHeight: 1, color: '#374151' }}>−</button>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#374151', minWidth: 20, textAlign: 'center' }}>{rowHeight}</span>
            <button onClick={() => setRowHeight(h => Math.min(80, h + 4))}
              style={{ width: 22, height: 22, border: '1px solid #e5e7eb', borderRadius: 4, background: '#f9fafb', cursor: 'pointer', fontSize: 13, lineHeight: 1, color: '#374151' }}>+</button>
          </div>

          <button onClick={() => { setSlotWidth(28); setRowHeight(48) }}
            title="Reset zoom"
            style={{ width: 30, height: 30, border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 14, color: '#9ca3af' }}>↺</button>
          <button onClick={() => { setRezForm(EMPTY_REZ_FORM); setIsNewRez(true); setShowRezModal(true) }}
            style={{ padding: '8px 16px', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            + Nova rezervacija
          </button>
          <button onClick={() => setShowDuznici(true)}
            style={{ padding: '8px 14px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            📝 Dužnici ({duznici.length})
          </button>
          <button onClick={otvoriLogove}
            style={{ padding: '8px 14px', background: '#6b7280', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            📜 Logovi
          </button>
        </div>
      </div>

      {/* LOKACIJE + LEGENDA u jednom redu */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {LOKACIJE.map(l => (
            <button key={l} onClick={() => setLokacija(l)}
              style={{ padding: '6px 14px', fontSize: 11, fontWeight: 700, border: `1px solid ${currentLok === l ? '#1D9E75' : '#e5e7eb'}`, borderRadius: 20, background: currentLok === l ? '#E1F5EE' : '#fff', color: currentLok === l ? '#085041' : '#6b7280', cursor: 'pointer', transition: 'all 0.15s' }}>
              {l === 'CRNA GORA' ? '🇲🇪' : l === 'BiH' ? '🇧🇦' : l === 'SRBIJA' ? '🇷🇸' : '🇦🇱'} {l}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {[['#f97316', 'Na čekanju'], ['#1D9E75', 'Izdato'], ['#dc2626', 'Nije izdato']].map(([c, l]) => (
            <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#6b7280' }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: c }} />{l}
            </div>
          ))}
          <span style={{ fontSize: 10, color: '#9ca3af' }}>✦ Vuci · Klikni · Selektuj za novu</span>
        </div>
      </div>

      {/* KALENDAR */}
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden', background: '#fff' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af', fontSize: 14 }}>Učitavanje podataka...</div>
        ) : !fcLoaded ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af', fontSize: 14 }}>Učitavam kalendar...</div>
        ) : (
          <div ref={calendarRef} />
        )}
      </div>

      {/* REZ MODAL */}
      {showRezModal && (
        <RezervacijaModal
          form={rezForm} setForm={setRezForm} vozila={vozilaLok}
          onSave={saveRezervacija} onClose={() => setShowRezModal(false)}
          onDelete={!isNewRez ? deleteRezervacija : undefined}
          saving={saving} isNew={isNewRez}
        />
      )}

      {/* DUŽNICI */}
      {showDuznici && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 800, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#fff' }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#dc2626' }}>⚠️ Lista dužnika</h2>
              <button onClick={() => setShowDuznici(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#9ca3af' }}>✕</button>
            </div>
            <div style={{ padding: 20 }}>
              <NoviDugForm onSave={loadAll} />
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ background: '#f9fafb' }}>
                  {['Ime', 'Vozačka', 'Telefon', 'Dug', 'Akcija'].map(h => <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, fontSize: 11, color: '#6b7280', borderBottom: '2px solid #e5e7eb' }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {duznici.map(d => (
                    <tr key={d.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>{d.ime_prezime}</td>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: '#6b7280', fontSize: 11 }}>{d.br_vozacke}</td>
                      <td style={{ padding: '10px 12px', color: '#6b7280' }}>{d.telefon || '/'}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 700, fontSize: 15, color: '#dc2626' }}>{d.ukupan_dug.toFixed(2)} €</td>
                      <td style={{ padding: '10px 12px' }}>
                        <button onClick={() => razduziDuznika(d.br_vozacke, d.ukupan_dug)}
                          style={{ padding: '6px 12px', fontSize: 11, border: '1px solid #1D9E75', borderRadius: 8, background: '#E1F5EE', cursor: 'pointer', color: '#085041', fontWeight: 600 }}>
                          Uplata
                        </button>
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

      {/* LOGOVI */}
      {showLogovi && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 700, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#fff' }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>📜 Sistemski logovi</h2>
              <button onClick={() => setShowLogovi(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#9ca3af' }}>✕</button>
            </div>
            <div style={{ padding: 20 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#6b7280', borderBottom: '2px solid #e5e7eb', width: 40 }}>#</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#6b7280', borderBottom: '2px solid #e5e7eb' }}>Akcija</th>
                  </tr>
                </thead>
                <tbody>
                  {logovi.map(l => (
                    <tr key={l.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '8px 12px', color: '#9ca3af', fontSize: 11, fontFamily: 'monospace' }}>{l.id}</td>
                      <td style={{ padding: '8px 12px', fontWeight: 500, color: '#374151' }}>{l.akcija}</td>
                    </tr>
                  ))}
                  {logovi.length === 0 && <tr><td colSpan={2} style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>Nema logova.</td></tr>}
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
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10 }}>+ Unesi novi dug</div>
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
