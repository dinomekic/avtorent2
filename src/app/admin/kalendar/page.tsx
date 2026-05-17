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
const LOK_FLAG: Record<string, string> = { 'CRNA GORA': '🇲🇪', 'BiH': '🇧🇦', 'SRBIJA': '🇷🇸', 'ALBANIJA': '🇦🇱' }

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

const FC_CSS = `
  .fc { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 11px; }
  .fc .fc-license-message { display: none !important; }
  .fc-theme-standard td, .fc-theme-standard th { border-color: #e2e8f0 !important; }
  .fc .fc-scrollgrid { border-color: #e2e8f0 !important; }
  .fc .fc-toolbar { padding: 10px 14px; background: #fff; border-bottom: 1px solid #e2e8f0; margin: 0 !important; gap: 8px; flex-wrap: wrap; }
  .fc .fc-toolbar-title { font-size: 15px !important; font-weight: 800 !important; color: #0f172a !important; text-transform: capitalize; letter-spacing: -0.3px; }
  .fc .fc-button { background: #f8fafc !important; border: 1px solid #e2e8f0 !important; color: #374151 !important; font-size: 11px !important; font-weight: 600 !important; padding: 6px 12px !important; border-radius: 8px !important; box-shadow: none !important; text-transform: none !important; transition: all 0.15s !important; }
  .fc .fc-button:hover { background: #f1f5f9 !important; border-color: #cbd5e1 !important; }
  .fc .fc-button-active, .fc .fc-button-primary:not(:disabled).fc-button-active { background: #1D9E75 !important; border-color: #1D9E75 !important; color: #fff !important; }
  .fc .fc-today-button { background: #E1F5EE !important; border-color: #1D9E75 !important; color: #085041 !important; font-weight: 700 !important; }
  .fc .fc-col-header-cell { background: #f8fafc; }
  .fc .fc-col-header-cell-cushion { color: #64748b !important; font-weight: 700 !important; font-size: 10px !important; text-decoration: none !important; padding: 4px 2px !important; text-transform: uppercase; letter-spacing: 0.3px; }
  .fc .fc-day-today .fc-col-header-cell-cushion { color: #1D9E75 !important; font-weight: 900 !important; }
  .fc .fc-day-today { background-color: rgba(29,158,117,0.05) !important; }
  .fc .fc-day-today .fc-datagrid-cell-frame { background: rgba(29,158,117,0.05) !important; }
  .fc .fc-datagrid-cell { width: 160px !important; min-width: 160px !important; max-width: 160px !important; background: #fff; }
  .fc .fc-datagrid-header { width: 160px !important; min-width: 160px !important; background: #f8fafc; }
  .fc .fc-datagrid-cell-cushion { padding: 4px 10px !important; display: block !important; }
  .fc .fc-resource-group .fc-datagrid-cell { background: #0f172a !important; }
  .fc .fc-resource-group .fc-datagrid-cell-cushion { background: #0f172a !important; color: #94a3b8 !important; font-weight: 800 !important; font-size: 9px !important; text-transform: uppercase !important; letter-spacing: 1.5px !important; padding: 8px 10px !important; }
  .fc .fc-resource-group td { background: #0f172a !important; border-color: #1e293b !important; }
  .fc .fc-resource-group .fc-timeline-lane { background: #0f172a !important; }
  .fc .fc-datagrid-cell-frame { display: flex !important; align-items: center !important; }
  .fc .fc-timeline-lane { overflow: hidden !important; }
  .fc .fc-datagrid-body tr:nth-child(even) .fc-datagrid-cell { background: #fafafa !important; }
  .fc .fc-timeline-body tr:nth-child(even) .fc-timeline-lane { background: rgba(0,0,0,0.012) !important; }
  .fc .fc-event { border-radius: 4px !important; border: none !important; font-size: 10px !important; font-weight: 700 !important; padding: 2px 5px !important; cursor: pointer !important; margin: 2px 0 !important; box-shadow: 0 1px 3px rgba(0,0,0,0.15) !important; }
  .fc .fc-event:hover { filter: brightness(0.92); transform: translateY(-1px); box-shadow: 0 2px 6px rgba(0,0,0,0.2) !important; }
  .ev-cekanje { background: linear-gradient(135deg, #f97316, #fb923c) !important; color: #fff !important; }
  .ev-izdato { background: linear-gradient(135deg, #1D9E75, #10b981) !important; color: #fff !important; }
  .ev-nije-izdato { background: linear-gradient(135deg, #dc2626, #ef4444) !important; color: #fff !important; }
  .fc .fc-timeline-slot { min-width: 28px !important; border-right: 1px solid #f1f5f9 !important; }
  .fc .fc-timeline-slot:hover { background: rgba(29,158,117,0.04) !important; }
  .fc .fc-scroller::-webkit-scrollbar { height: 4px; width: 4px; }
  .fc .fc-scroller::-webkit-scrollbar-track { background: #f8fafc; }
  .fc .fc-scroller::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
  .fc .fc-scroller::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
  .fc .fc-highlight { background: rgba(29,158,117,0.1) !important; }
  .fc .fc-now-indicator-line { border-color: #1D9E75 !important; border-width: 2px !important; }
  .fc .fc-now-indicator-arrow { border-top-color: #1D9E75 !important; }
  .fc .fc-datagrid-body { overflow: hidden !important; }
  .fc .fc-event { touch-action: none; }
`

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
  const [stats, setStats] = useState({ total: 0, zauzeto: 0 })
  const [slotWidth, setSlotWidth] = useState(26)
  const [showLogovi, setShowLogovi] = useState(false)
  const [logovi, setLogovi] = useState<any[]>([])

  useEffect(() => {
    const injectStyle = () => {
      if (document.getElementById('fc-planet-style')) return
      const s = document.createElement('style'); s.id = 'fc-planet-style'; s.textContent = FC_CSS
      document.head.appendChild(s)
    }
    if ((window as any).FullCalendar) { injectStyle(); setFcLoaded(true); return }
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/fullcalendar-scheduler@6.1.11/index.global.min.js'
    script.onload = () => { injectStyle(); setFcLoaded(true) }
    document.head.appendChild(script)
    const link = document.createElement('link'); link.rel = 'stylesheet'
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

  useEffect(() => {
    if (!fcLoaded || loading || !calendarRef.current) return
    const FC = (window as any).FullCalendar
    if (!FC) return
    if (calInstanceRef.current) { calInstanceRef.current.destroy(); calInstanceRef.current = null }

    const cal = new FC.Calendar(calendarRef.current, {
      schedulerLicenseKey: 'CC-Attribution-NonCommercialNoDerivatives',
      initialView: 'resourceTimelineMonth',
      initialDate: today,
      editable: true,
      selectable: true,
      nowIndicator: true,
      eventMinWidth: 4,
      slotMinWidth: slotWidth,
      resourceAreaWidth: '170px',
      resourceGroupField: 'building',
      locale: 'sr-Latn',
      headerToolbar: { left: 'prev,next today', center: 'title', right: 'resourceTimelineMonth,resourceTimelineWeek' },
      buttonText: { today: 'Danas', month: 'Mjesec', week: 'Sedmica' },
      slotLabelFormat: [{ weekday: 'short' }, { day: 'numeric' }],
      height: 'auto',
      expandRows: true,
      stickyHeaderDates: true,
      resources: getResources(),
      scrollTime: undefined,

      events: (_info: any, successCallback: any) => {
        successCallback(rezervacijeRef.current.filter(r => r.br_tablica).map(r => ({
          id: String(r.id),
          resourceId: r.br_tablica,
          start: `${r.od_datuma}T${r.vreme_izdavanja || '10:00'}`,
          end: `${r.do_datuma}T${r.vreme_povratka || '10:00'}`,
          title: r.ime_prezime,
          className: r.daily_status === 'Izdato' ? 'ev-izdato' : r.daily_status === 'Nije izdato' ? 'ev-nije-izdato' : 'ev-cekanje',
        })))
      },

      // ═══ HIRURSKI PRECIZAN NAZIV — prati agregirani_2 kolonu, tablice zeleno ispod ═══
      resourceLabelContent: (arg: any) => {
        const v = vozilaRef.current.find(v => v.license_plate === arg.resource.id)
        const plate = (v?.license_plate || arg.resource.id || '').trim()
        // Uzmi agregirani_2 direktno — bez ikakvih izmjena ili skraćivanja
        const agregirani = (v?.agregirani_2 || '').trim()
        // Ako agregirani_2 sadrži tablicu, ukloni je da ne bude duplikat
        const naziv = agregirani.replace(plate, '').replace(/\s+/g, ' ').trim()
          || `${(v?.marka || '').trim()} ${(v?.model || '').trim()}`.trim()
          || plate
        return {
          html: `<div style="width:140px;padding:1px 0;line-height:1.4;overflow:hidden;">
            <div style="font-size:10px;font-weight:700;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${agregirani}">${naziv}</div>
            <div style="font-size:9px;color:#1D9E75;font-family:monospace;font-weight:900;letter-spacing:0.8px;white-space:nowrap;">${plate}</div>
          </div>`
        }
      },

      slotLabelContent: (arg: any) => {
        const text = arg.text.trim()
        const isDay = !isNaN(parseInt(text)) && text.length <= 2
        if (isDay) {
          const d = arg.date
          const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
          const isToday = iso === today
          const count = rezervacijeRef.current.filter(r =>
            r.od_datuma <= iso && r.do_datuma > iso &&
            vozilaRef.current.some(v => v.license_plate === r.br_tablica && v.lokacija === currentLokRef.current)
          ).length
          return {
            html: `<div style="text-align:center;">
              <div style="font-weight:${isToday ? '900' : '600'};color:${isToday ? '#1D9E75' : 'inherit'}">${text}</div>
              ${count > 0 ? `<div style="font-size:8px;color:#1D9E75;font-weight:900;line-height:1;">${count}🚗</div>` : '<div style="font-size:8px;line-height:1;">&nbsp;</div>'}
            </div>`
          }
        }
        return { html: `<span style="font-size:9px;color:#94a3b8;text-transform:lowercase;">${text}</span>` }
      },

      eventDrop: async (info: any) => {
        const startIso = info.event.startStr.split('T')[0]
        const endIso = info.event.endStr ? info.event.endStr.split('T')[0] : startIso
        const resId = info.newResource ? info.newResource.id : info.event.getResources()[0]?.id
        const stariRes = info.oldResource ? info.oldResource.id : resId
        const promijenjenoVozilo = info.newResource && info.newResource.id !== stariRes
        const poruka = promijenjenoVozilo
          ? `Premjestiti rezervaciju?\n👤 ${info.event.title}\n🚗 ${stariRes} → ${resId}\n📅 ${startIso} – ${endIso}`
          : `Promijeniti datum?\n👤 ${info.event.title}\n📅 ${startIso} – ${endIso}`
        if (!window.confirm(poruka)) { info.revert(); return }
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
        setIsNewRez(true); setShowRezModal(true); cal.unselect()
      },

      datesSet: () => {
        setTimeout(() => {
          const todayEl = calendarRef.current?.querySelector('.fc-day-today') as HTMLElement
          if (todayEl) {
            const scroller = calendarRef.current?.querySelector('.fc-timeline-body')?.closest('.fc-scroller') as HTMLElement
            if (scroller) {
              const offset = todayEl.offsetLeft - 180
              scroller.scrollLeft = Math.max(0, offset)
            }
          }
        }, 100)
      }
    })

    cal.render()
    calInstanceRef.current = cal
    return () => { cal.destroy(); calInstanceRef.current = null }
  }, [fcLoaded, loading, currentLok])

  useEffect(() => {
    searchQRef.current = searchQ
    if (calInstanceRef.current) calInstanceRef.current.setOption('resources', getResources())
  }, [searchQ])

  useEffect(() => {
    if (!calInstanceRef.current) return
    calInstanceRef.current.setOption('slotMinWidth', slotWidth)
  }, [slotWidth])

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
    let savedRow: any = null
    if (rezForm.id) {
      const { data: upd, error } = await supabase.from('rezervacije').update(payload).eq('id', rezForm.id).select().single()
      if (!error) savedRow = upd
      await supabase.from('logovi').insert([{ akcija: `Izmijenjena REZ #${rezForm.id}` }])
    } else {
      const { data: ins, error } = await supabase.from('rezervacije').insert([payload]).select().single()
      if (!error) savedRow = ins
      await supabase.from('logovi').insert([{ akcija: `Kreirana rezervacija za ${rezForm.ime_prezime}` }])
    }
    setSaving(false); setShowRezModal(false)
    if (savedRow) {
      if (rezForm.id) {
        const idx = rezervacijeRef.current.findIndex(r => r.id === rezForm.id)
        if (idx !== -1) rezervacijeRef.current[idx] = savedRow
        else rezervacijeRef.current.push(savedRow)
      } else {
        rezervacijeRef.current.push(savedRow)
      }
      updateStats(vozilaRef.current, rezervacijeRef.current)
      calInstanceRef.current?.refetchEvents()
    }
  }

  async function deleteRezervacija() {
    if (!rezForm.id) return
    const sifra = window.prompt('Admin lozinka za brisanje:')
    if (sifra !== '810805') { alert('Pogrešna!'); return }
    if (!confirm('Sigurno obrišete?')) return
    await supabase.from('rezervacije').delete().eq('id', rezForm.id)
    await supabase.from('logovi').insert([{ akcija: `Obrisana REZ #${rezForm.id}` }])
    setShowRezModal(false)
    rezervacijeRef.current = rezervacijeRef.current.filter(r => r.id !== rezForm.id)
    updateStats(vozilaRef.current, rezervacijeRef.current)
    calInstanceRef.current?.refetchEvents()
  }

  async function razduziDuznika(br_v: string, trenutniDug: number) {
    const unos = window.prompt(`Dug: ${trenutniDug}€. Koliko plaća?`); if (!unos) return
    const sifra = window.prompt('Admin lozinka:'); if (sifra !== '810805') { alert('Pogrešna!'); return }
    const uplata = parseFloat(unos); if (isNaN(uplata) || uplata <= 0) return
    const { data: d } = await supabase.from('duznici').select('*').eq('br_vozacke', br_v).single(); if (!d) return
    const noviDug = d.ukupan_dug - uplata
    const istorija = [...(d.istorija || []), { datum: new Date().toLocaleString('sr-RS'), iznos: uplata, komentar: 'Uplata', tip: 'razduzenje' }]
    if (noviDug <= 0) {
      if (confirm('Dug otplaćen! Obrisati?')) await supabase.from('duznici').delete().eq('br_vozacke', br_v)
      else await supabase.from('duznici').update({ ukupan_dug: 0, istorija }).eq('br_vozacke', br_v)
    } else await supabase.from('duznici').update({ ukupan_dug: noviDug, istorija }).eq('br_vozacke', br_v)
    loadAll()
  }

  async function otvoriLogove() {
    const sifra = window.prompt('Admin lozinka:'); if (sifra !== '810805') { alert('Pogrešna!'); return }
    const { data } = await supabase.from('logovi').select('*').order('id', { ascending: false }).limit(150)
    setLogovi(data || []); setShowLogovi(true)
  }

  const vozilaLok = vozila.filter(v => v.lokacija === currentLok && (v.fleet_status || '').toLowerCase() === 'available')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <div style={{ padding: '10px 12px', background: '#fff', borderBottom: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: '#0f172a', marginRight: 4 }}>📅 Kalendar</div>
          <div style={{ display: 'flex', gap: 6, flex: 1 }}>
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700, color: '#dc2626', whiteSpace: 'nowrap' as const }}>🔴 {stats.zauzeto}/{stats.total}</div>
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700, color: '#15803d', whiteSpace: 'nowrap' as const }}>🟢 {stats.total - stats.zauzeto}</div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <button onClick={() => { setRezForm(EMPTY_REZ_FORM); setIsNewRez(true); setShowRezModal(true) }} style={{ padding: '7px 14px', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' as const }}>+ Nova</button>
            <button onClick={() => setShowDuznici(true)} style={{ padding: '7px 12px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>📝 {duznici.length}</button>
            <button onClick={otvoriLogove} style={{ padding: '7px 12px', background: '#64748b', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}>📜</button>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {LOKACIJE.map(l => (
              <button key={l} onClick={() => setLokacija(l)} style={{ padding: '5px 10px', fontSize: 11, fontWeight: 700, border: `1.5px solid ${currentLok === l ? '#1D9E75' : '#e2e8f0'}`, borderRadius: 20, background: currentLok === l ? '#E1F5EE' : '#f8fafc', color: currentLok === l ? '#085041' : '#64748b', cursor: 'pointer', whiteSpace: 'nowrap' as const }}>
                {LOK_FLAG[l]} {l === 'CRNA GORA' ? 'CG' : l}
              </button>
            ))}
          </div>
          <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="🔍 Pretraži vozilo..." style={{ flex: 1, minWidth: 120, maxWidth: 180, padding: '5px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12, outline: 'none', background: '#f8fafc' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '3px 8px' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', fontWeight: 700 }}>↔</span>
            <button onClick={() => setSlotWidth(w => Math.max(14, w - 4))} style={{ width: 20, height: 20, border: '1px solid #e2e8f0', borderRadius: 4, background: '#fff', cursor: 'pointer', fontSize: 12, color: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#374151', minWidth: 18, textAlign: 'center' }}>{slotWidth}</span>
            <button onClick={() => setSlotWidth(w => Math.min(80, w + 4))} style={{ width: 20, height: 20, border: '1px solid #e2e8f0', borderRadius: 4, background: '#fff', cursor: 'pointer', fontSize: 12, color: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
          </div>
          <button onClick={() => setSlotWidth(26)} title="Reset" style={{ width: 28, height: 28, border: '1px solid #e2e8f0', borderRadius: 8, background: '#f8fafc', cursor: 'pointer', fontSize: 13, color: '#94a3b8' }}>↺</button>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {[['#f97316', 'Na čekanju'], ['#1D9E75', 'Izdato'], ['#dc2626', 'Nije izdato']].map(([c, l]) => (
            <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#64748b' }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: c }} />{l}
            </div>
          ))}
          <span style={{ fontSize: 10, color: '#cbd5e1', marginLeft: 'auto' }}>Vuci · Klikni · Selektuj</span>
        </div>
      </div>

      <div style={{ flex: 1, background: '#fff' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: '#94a3b8', fontSize: 14 }}><div style={{ textAlign: 'center' }}><div style={{ fontSize: 32, marginBottom: 12 }}>📅</div><div>Učitavanje...</div></div></div>
        ) : !fcLoaded ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: '#94a3b8', fontSize: 14 }}><div style={{ textAlign: 'center' }}><div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div><div>Inicijalizacija kalendara...</div></div></div>
        ) : (
          <div ref={calendarRef} />
        )}
      </div>

      {showRezModal && (
        <RezervacijaModal form={rezForm} setForm={setRezForm} vozila={vozilaLok}
          onSave={saveRezervacija} onClose={() => setShowRezModal(false)}
          onDelete={!isNewRez ? deleteRezervacija : undefined}
          saving={saving} isNew={isNewRez} />
      )}

      {showDuznici && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: '#fff', borderRadius: '16px 16px 0 0', width: '100%', maxWidth: 800, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#fff' }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#dc2626' }}>⚠️ Lista dužnika ({duznici.length})</div>
              <button onClick={() => setShowDuznici(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#94a3b8' }}>✕</button>
            </div>
            <div style={{ padding: 16 }}>
              <NoviDugForm onSave={loadAll} />
              {duznici.length === 0 ? (
                <div style={{ padding: 30, textAlign: 'center', color: '#94a3b8' }}>Nema dužnika.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {duznici.map(d => (
                    <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 10, background: '#fff' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{d.ime_prezime}</div>
                        <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>{d.br_vozacke} · {d.telefon || '/'}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ fontWeight: 800, fontSize: 16, color: '#dc2626' }}>{d.ukupan_dug.toFixed(2)}€</div>
                        <button onClick={() => razduziDuznika(d.br_vozacke, d.ukupan_dug)} style={{ padding: '6px 10px', fontSize: 11, border: '1px solid #1D9E75', borderRadius: 8, background: '#E1F5EE', cursor: 'pointer', color: '#085041', fontWeight: 600 }}>Uplata</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showLogovi && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 300 }}>
          <div style={{ background: '#fff', borderRadius: '16px 16px 0 0', width: '100%', maxWidth: 700, maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#fff' }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>📜 Sistemski logovi</div>
              <button onClick={() => setShowLogovi(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#94a3b8' }}>✕</button>
            </div>
            <div style={{ padding: 16 }}>
              {logovi.map(l => (
                <div key={l.id} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid #f1f5f9', fontSize: 12 }}>
                  <span style={{ color: '#94a3b8', fontFamily: 'monospace', flexShrink: 0 }}>#{l.id}</span>
                  <span style={{ color: '#374151' }}>{l.akcija}</span>
                </div>
              ))}
              {logovi.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>Nema logova.</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function NoviDugForm({ onSave }: { onSave: () => void }) {
  const [form, setForm] = useState({ br_vozacke: '', ime_prezime: '', telefon: '', iznos: '', komentar: '' })
  const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', fontSize: 12, border: '1px solid #e2e8f0', borderRadius: 8, background: '#f8fafc', color: '#111', boxSizing: 'border-box', marginBottom: 0 }
  const lbl: React.CSSProperties = { fontSize: 10, color: '#64748b', display: 'block', marginBottom: 3, fontWeight: 600, textTransform: 'uppercase' }
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
    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 12, marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, color: '#374151' }}>+ Unesi novi dug</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
        <div><label style={lbl}>Vozačka *</label><input style={inp} value={form.br_vozacke} onChange={e => setForm(p => ({ ...p, br_vozacke: e.target.value }))} /></div>
        <div><label style={lbl}>Ime *</label><input style={inp} value={form.ime_prezime} onChange={e => setForm(p => ({ ...p, ime_prezime: e.target.value }))} /></div>
        <div><label style={lbl}>Telefon</label><input style={inp} value={form.telefon} onChange={e => setForm(p => ({ ...p, telefon: e.target.value }))} /></div>
        <div><label style={lbl}>Iznos € *</label><input style={inp} type="number" value={form.iznos} onChange={e => setForm(p => ({ ...p, iznos: e.target.value }))} /></div>
        <div style={{ gridColumn: 'span 2' }}><label style={lbl}>Komentar *</label><input style={inp} value={form.komentar} onChange={e => setForm(p => ({ ...p, komentar: e.target.value }))} /></div>
      </div>
      <button onClick={save} style={{ width: '100%', padding: '9px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>+ Zaduži</button>
    </div>
  )
}
