'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import { RezervacijaModal, RezForm, VoziloOption, EMPTY_REZ_FORM, calcDana, calcUkupno, generateUgovor } from '@/lib/RezervacijaModal'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type KalRezervacija = {
  id: number
  br_tablica: string
  ime_prezime: string
  daily_status: string
  od_datuma: string
  do_datuma: string
  vreme_izdavanja?: string
  vreme_povratka?: string
  cijena_dan?: number
  nacin_placanja?: string
  firma?: string
  adresa?: string
  telefon?: string
  email?: string
  zemlja?: string
  datum_rodjenja?: string
  tip_osiguranja?: string
  kasko_cijena?: number
  kasko_tip?: string
  kasko_ucesce?: number
  granica?: string
  depozit?: number
  napomena?: string
  bebi_sic_cijena?: number
  dozvola_van_zemlje_cijena?: number
  dostava_cijena?: number
  dodatni_vozac_cijena?: number
  dodatni_vozac_vozacka?: string
  ukupno_naplata?: number
  naplaceno?: number
  br_vozacke?: string
  br_vozacke2?: string
  ime2?: string
  prezime2?: string
  ko_je_izdao?: string
  ko_je_preuzeo?: string
  br_leta?: string
  mjesto_preuzimanja?: string
  mjesto_povratka?: string
  izvor_rezervacije?: string
  ugovor_slika?: string
  depozit_uzet?: boolean
  depozit_vracen?: boolean
  vraceni_depozit_iznos?: number
}

const LOKACIJE = ['CRNA GORA', 'BiH', 'SRBIJA', 'ALBANIJA']
const SIFRE: Record<string, string> = { 'CRNA GORA': 'cg810805', 'BiH': 'bih000', 'SRBIJA': 'srb222', 'ALBANIJA': 'alb333' }
const MONTHS = ['Januar', 'Februar', 'Mart', 'April', 'Maj', 'Juni', 'Juli', 'August', 'Septembar', 'Oktobar', 'Novembar', 'Decembar']

const STATUS_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  'Na čekanju': { bg: '#FAEEDA', color: '#633806', label: 'Na čekanju' },
  'Izdato':     { bg: '#E1F5EE', color: '#085041', label: 'Izdato' },
  'Nije izdato':{ bg: '#FCEBEB', color: '#791F1F', label: 'Nije izdato' },
}

function getCookie(name: string): string {
  if (typeof document === 'undefined') return ''
  const match = document.cookie.match(new RegExp(`${name}=([^;]+)`))
  return match ? decodeURIComponent(match[1]) : ''
}

function toDMY(iso: string) {
  if (!iso) return ''
  const p = iso.split('-')
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso)
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

function rezToForm(r: KalRezervacija): RezForm {
  return {
    id: r.id,
    br_vozacke: r.br_vozacke || '',
    ime_prezime: r.ime_prezime || '',
    zemlja: r.zemlja || '',
    datum_rodjenja: r.datum_rodjenja || '',
    telefon: r.telefon || '',
    email: r.email || '',
    adresa: r.adresa || '',
    istek_vozacke: '',
    br_vozacke2: r.br_vozacke2 || '',
    ime2: r.ime2 || '',
    prezime2: r.prezime2 || '',
    br_tablica: r.br_tablica || '',
    firma: r.firma || 'Meriem d.o.o.',
    tip_osiguranja: r.tip_osiguranja || 'Osnovno (AO)',
    kasko_cijena: r.kasko_cijena || 0,
    kasko_tip: r.kasko_tip || 'FULL KASKO',
    kasko_ucesce: r.kasko_ucesce || 0,
    granica: r.granica || 'DOZVOLJENO VAN ZEMLJE',
    napomena: r.napomena || '',
    br_leta: r.br_leta || '',
    ko_je_izdao: r.ko_je_izdao || '',
    ko_je_preuzeo: r.ko_je_preuzeo || '',
    daily_status: r.daily_status || 'Na čekanju',
    od_datuma: r.od_datuma || '',
    do_datuma: r.do_datuma || '',
    vreme_izdavanja: r.vreme_izdavanja || '10:00',
    vreme_povratka: r.vreme_povratka || '10:00',
    cijena_dan: r.cijena_dan || 0,
    depozit: r.depozit || 0,
    nacin_placanja: r.nacin_placanja || 'Keš',
    mjesto_preuzimanja: r.mjesto_preuzimanja || 'Bulevar Veljka Vlahovića 16',
    mjesto_povratka: r.mjesto_povratka || 'Bulevar Veljka Vlahovića 16',
    izvor_rezervacije: r.izvor_rezervacije || 'Sajt',
    dozvola_van_zemlje_cijena: r.dozvola_van_zemlje_cijena || 0,
    dostava_cijena: r.dostava_cijena || 0,
    bebi_sic_cijena: r.bebi_sic_cijena || 0,
    dodatni_vozac_cijena: r.dodatni_vozac_cijena || 0,
    dodatni_vozac_vozacka: r.dodatni_vozac_vozacka || '',
    naplaceno: r.naplaceno || 0,
  }
}

export default function AdminDanPage() {
  const today = new Date().toISOString().split('T')[0]
  const [selectedDate, setSelectedDate] = useState(today)
  const [currentLok, setCurrentLok] = useState('CRNA GORA')
  const [rezervacije, setRezervacije] = useState<KalRezervacija[]>([])
  const [vozila, setVozila] = useState<VoziloOption[]>([])
  const [loading, setLoading] = useState(true)
  const [showDone, setShowDone] = useState(false)
  const [newAlert, setNewAlert] = useState<string | null>(null)

  // ─── LOGOVAN AGENT ────────────────────────────────────────
  const [logovanAgent, setLogovanAgent] = useState('')
  useEffect(() => {
    const ime = getCookie('avtorent-agent-name')
    setLogovanAgent(ime || '')
  }, [])

  const [showRezModal, setShowRezModal] = useState(false)
  const [rezForm, setRezForm] = useState<RezForm>(EMPTY_REZ_FORM)
  const [isNewRez, setIsNewRez] = useState(false)
  const [saving, setSaving] = useState(false)

  // Agent modal — samo za slučaj da nema cookie
  const [showAgentModal, setShowAgentModal] = useState(false)
  const [agentTip, setAgentTip] = useState<'izdavanje' | 'preuzimanje'>('izdavanje')
  const [agentRezId, setAgentRezId] = useState<number | null>(null)
  const [agentiLista, setAgentiLista] = useState<string[]>([])

  const [showProduziModal, setShowProduziModal] = useState(false)
  const [produziRezId, setProduziRezId] = useState<number | null>(null)
  const [produziDana, setProduziDana] = useState('')
  const [produziCijena, setProduziCijena] = useState('')
  const [produziNaplaceno, setProduziNaplaceno] = useState('')
  const [produziSaving, setProduziSaving] = useState(false)

  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadRezId, setUploadRezId] = useState<number | null>(null)
  const [uploadUrl, setUploadUrl] = useState('')
  const [uploadSaving, setUploadSaving] = useState(false)

  // ─── AKCIJA MODAL (Izdaj / Preuzmi) ──────────────────────
  const [showAkcijaModal, setShowAkcijaModal] = useState(false)
  const [akcijaRez, setAkcijaRez] = useState<KalRezervacija | null>(null)
  const [akcijaTip, setAkcijaTip] = useState<'izdavanje' | 'preuzimanje'>('izdavanje')
  const [akcijaAgent, setAkcijaAgent] = useState('')
  // Izdavanje
  const [izdNaplata, setIzdNaplata] = useState('')
  const [izdDepozit, setIzdDepozit] = useState('')
  const [izdNacinPlacanja, setIzdNacinPlacanja] = useState('Keš')
  const [izdKes, setIzdKes] = useState('')
  const [izdKartica, setIzdKartica] = useState('')
  // Preuzimanje
  const [preuzDugNaplacen, setPreuzDugNaplacen] = useState(false)
  const [preuzDugIznos, setPreuzDugIznos] = useState('')
  const [preuzDugNacin, setPreuzDugNacin] = useState('Keš')
  const [preuzDugKes, setPreuzDugKes] = useState('')
  const [preuzDugKartica, setPreuzDugKartica] = useState('')
  const [preuzDepVracen, setPreuzDepVracen] = useState(false)
  const [preuzDepIznos, setPreuzDepIznos] = useState('')
  const [preuzDepRazlog, setPreuzDepRazlog] = useState('')
  const [regUpozorenje, setRegUpozorenje] = useState<{ istek: string; dana: number } | null>(null)
  const [akcijaSaving, setAkcijaSaving] = useState(false)

  const vozilaLok = vozila.filter(v => v.lokacija === currentLok)

  const loadAll = useCallback(async () => {
    setLoading(true)
    const [{ data: v }, { data: r }] = await Promise.all([
      supabase.from('vozila_fleet').select('id, license_plate, marka, model, agregirani_2, fleet_status, lokacija').order('marka'),
      supabase.from('rezervacije').select('*')
        .or(`od_datuma.eq.${selectedDate},do_datuma.eq.${selectedDate},and(od_datuma.lt.${selectedDate},do_datuma.gt.${selectedDate})`)
        .order('vreme_izdavanja'),
    ])
    if (v) setVozila(v)
    if (r) setRezervacije(r)
    setLoading(false)
  }, [selectedDate])

  const [overdueRez, setOverdueRez] = useState<KalRezervacija[]>([])
  const loadOverdue = useCallback(async () => {
    const { data } = await supabase.from('rezervacije').select('*')
      .neq('daily_status', 'Nije izdato')
      .or(`and(daily_status.eq.Na čekanju,od_datuma.lt.${selectedDate}),and(daily_status.eq.Izdato,do_datuma.lt.${selectedDate})`)
    setOverdueRez(data || [])
  }, [selectedDate])

  // Učitaj listu agenata iz baze
  useEffect(() => {
    supabase.from('agents').select('full_name').eq('is_active', true)
      .then(({ data }) => {
        if (data) setAgentiLista(data.map(a => a.full_name).filter(Boolean))
      })
  }, [])

  useEffect(() => { loadAll(); loadOverdue() }, [loadAll, loadOverdue])

  useEffect(() => {
    const channel = supabase.channel('dan-rez')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'rezervacije' }, (payload) => {
        const r = payload.new as any
        if (r.od_datuma === selectedDate || r.do_datuma === selectedDate) {
          setNewAlert(`Nova rezervacija: ${r.ime_prezime} — ${r.od_datuma}`)
          setTimeout(() => setNewAlert(null), 8000)
        }
        loadAll()
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rezervacije' }, () => loadAll())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [loadAll, selectedDate])

  function provjeriSifru(lok: string): boolean {
    const key = `auth_${lok.replace(/\s+/g, '')}`
    if (sessionStorage.getItem(key) === 'ok') return true
    const uneto = window.prompt(`Lozinka za: ${lok}`)
    if (uneto === SIFRE[lok]) { sessionStorage.setItem(key, 'ok'); return true }
    else if (uneto !== null) alert('Pogrešna lozinka!')
    return false
  }

  function setLokacija(lok: string) {
    if (provjeriSifru(lok)) setCurrentLok(lok)
  }

  function prevDay() {
    const d = new Date(selectedDate); d.setDate(d.getDate() - 1)
    setSelectedDate(d.toISOString().split('T')[0])
  }

  function nextDay() {
    const d = new Date(selectedDate); d.setDate(d.getDate() + 1)
    setSelectedDate(d.toISOString().split('T')[0])
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('sr-RS', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  }

  const vozilaLokTablice = new Set(vozilaLok.map(v => v.license_plate).filter(Boolean))

  const izdavanja = rezervacije.filter(r =>
    r.od_datuma === selectedDate && vozilaLokTablice.has(r.br_tablica)
  ).sort((a, b) => (a.vreme_izdavanja || '').localeCompare(b.vreme_izdavanja || ''))

  const povratci = rezervacije.filter(r =>
    r.do_datuma === selectedDate && vozilaLokTablice.has(r.br_tablica)
  ).sort((a, b) => (a.vreme_povratka || '').localeCompare(b.vreme_povratka || ''))

  const pendingIzdavanja = izdavanja.filter(r => r.daily_status === 'Na čekanju')
  const pendingPovratci = povratci.filter(r => r.daily_status !== 'Nije izdato' && !r.ko_je_preuzeo)
  const pendingCount = pendingIzdavanja.length + pendingPovratci.length
  const totalCount = izdavanja.length + povratci.length
  const doneCount = totalCount - pendingCount

  const overdueFiltered = overdueRez.filter(r => vozilaLokTablice.has(r.br_tablica))

  function openRez(r: KalRezervacija) {
    setRezForm(rezToForm(r)); setIsNewRez(false); setShowRezModal(true)
  }

  async function saveRezervacija() {
    if (!rezForm.br_tablica || !rezForm.ime_prezime) { alert('Unesite tablice i ime!'); return }
    setSaving(true)
    const dana = calcDana(rezForm)
    const ukupno = calcUkupno(rezForm)
    const payload = {
      br_tablica: rezForm.br_tablica, ime_prezime: rezForm.ime_prezime,
      br_vozacke: rezForm.br_vozacke, daily_status: rezForm.daily_status,
      od_datuma: rezForm.od_datuma, do_datuma: rezForm.do_datuma,
      vreme_izdavanja: rezForm.vreme_izdavanja, vreme_povratka: rezForm.vreme_povratka,
      cijena_dan: rezForm.cijena_dan, nacin_placanja: rezForm.nacin_placanja,
      firma: rezForm.firma, adresa: rezForm.adresa, telefon: rezForm.telefon,
      email: rezForm.email, zemlja: rezForm.zemlja, datum_rodjenja: rezForm.datum_rodjenja,
      tip_osiguranja: rezForm.tip_osiguranja, kasko_cijena: rezForm.kasko_cijena,
      kasko_tip: rezForm.kasko_tip, kasko_ucesce: rezForm.kasko_ucesce,
      granica: rezForm.granica, depozit: rezForm.depozit, napomena: rezForm.napomena,
      bebi_sic_cijena: rezForm.bebi_sic_cijena,
      dozvola_van_zemlje_cijena: rezForm.dozvola_van_zemlje_cijena,
      dostava_cijena: rezForm.dostava_cijena,
      dodatni_vozac_cijena: rezForm.dodatni_vozac_cijena,
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
    setSaving(false); setShowRezModal(false); loadAll()
  }

  async function deleteRezervacija() {
    if (!rezForm.id) return
    const sifra = window.prompt('Admin lozinka za brisanje:')
    if (sifra !== '810805') { alert('Pogrešna!'); return }
    if (!confirm('Sigurno obrišete?')) return
    await supabase.from('rezervacije').delete().eq('id', rezForm.id)
    await supabase.from('logovi').insert([{ akcija: `Obrisana REZ #${rezForm.id}` }])
    setShowRezModal(false); loadAll()
  }

  // ─── AGENT AKCIJE — otvori modal ────────────────────────
  async function pokreniIzdaj(r: KalRezervacija) {
    const agent = getCookie('avtorent-agent-name') || logovanAgent
    setAkcijaRez(r)
    setAkcijaTip('izdavanje')
    setAkcijaAgent(agent || '')
    setIzdNaplata(String(r.ukupno_naplata || 0))
    setIzdDepozit(String(r.depozit || 0))
    setIzdNacinPlacanja('Keš')
    setIzdKes('')
    setIzdKartica('')
    setRegUpozorenje(null)

    // Provjeri istek registracije
    const { data: voz } = await supabase
      .from('vozila_fleet')
      .select('istek_reg')
      .eq('license_plate', r.br_tablica)
      .single()

    if (voz?.istek_reg && r.do_datuma) {
      const istek = new Date(voz.istek_reg)
      const danas = new Date(selectedDate)
      danas.setHours(0, 0, 0, 0)
      const povratak = new Date(r.do_datuma)

      // Ako je registracija već istekla — blokiraj
      if (istek < danas) {
        const istekStr = istek.toLocaleDateString('sr-RS', { day: '2-digit', month: '2-digit', year: 'numeric' })
        alert(`🚫 NIJE MOGUĆE IZDATI VOZILO\n\nRegistracija je istekla: ${istekStr}\n\nRijesi registraciju prije izdavanja.`)
        return
      }

      // Ako registracija ističe tokom najma — upozorenje
      if (istek < povratak) {
        const dana = Math.ceil((povratak.getTime() - istek.getTime()) / 86400000)
        const istekStr = istek.toLocaleDateString('sr-RS', { day: '2-digit', month: '2-digit', year: 'numeric' })
        setRegUpozorenje({ istek: istekStr, dana })
      }
    }

    setShowAkcijaModal(true)
  }

  function pokreniPreuzmi(r: KalRezervacija) {
    const agent = getCookie('avtorent-agent-name') || logovanAgent
    const dug = Math.max(0, (r.ukupno_naplata || 0) - (r.naplaceno || 0))
    const dep = r.depozit || 0
    setAkcijaRez(r)
    setAkcijaTip('preuzimanje')
    setAkcijaAgent(agent || '')
    setPreuzDugNaplacen(dug > 0)
    setPreuzDugIznos(dug > 0 ? String(dug.toFixed(2)) : '0')
    setPreuzDugNacin('Keš')
    setPreuzDugKes('')
    setPreuzDugKartica('')
    setPreuzDepVracen(dep > 0)
    setPreuzDepIznos(dep > 0 ? String(dep) : '0')
    setPreuzDepRazlog('')
    setShowAkcijaModal(true)
  }

  async function potvrdiAkcijuIzdaj() {
    if (!akcijaRez || !akcijaAgent) return
    setAkcijaSaving(true)

    // Provjeri istek registracije
    const { data: voziloData } = await supabase
      .from('vozila_fleet')
      .select('istek_reg, agregirani_2')
      .eq('license_plate', akcijaRez.br_tablica)
      .single()

    if (voziloData?.istek_reg) {
      const istekReg = new Date(voziloData.istek_reg)
      const danas = new Date()
      danas.setHours(0, 0, 0, 0)
      const datumPovratka = new Date(akcijaRez.do_datuma)
      const istekStr = istekReg.toLocaleDateString('sr-RS', { day: '2-digit', month: '2-digit', year: 'numeric' })

      // Blokada — registracija već istekla
      if (istekReg < danas) {
        alert(`🚫 NIJE MOGUĆE IZDATI VOZILO\n\nRegistracija je istekla: ${istekStr}\n\nRijesi registraciju prije izdavanja.`)
        setAkcijaSaving(false)
        return
      }

      // Upozorenje — ističe tokom najma
      if (istekReg < datumPovratka) {
        const povratakStr = datumPovratka.toLocaleDateString('sr-RS', { day: '2-digit', month: '2-digit', year: 'numeric' })
        const potvrda = window.confirm(
          `⚠️ UPOZORENJE — REGISTRACIJA ISTIČE PRIJE POVRATKA!\n\n` +
          `🚗 Vozilo: ${voziloData.agregirani_2 || akcijaRez.br_tablica}\n` +
          `📋 Istek registracije: ${istekStr}\n` +
          `📅 Datum povratka: ${povratakStr}\n\n` +
          `Registracija ističe za vrijeme najma!\n\n` +
          `Jesi li siguran/na da želiš izdati vozilo?`
        )
        if (!potvrda) {
          setAkcijaSaving(false)
          return
        }
      }
    }
    const naplata = parseFloat(izdNaplata) || 0
    const depozitUzet = parseFloat(izdDepozit) || 0
    const rez = akcijaRez
    const rezId = rez.id
    const kesIznos = izdNacinPlacanja === 'Kartica' ? 0
      : izdNacinPlacanja === 'Kartica + Keš' ? (parseFloat(izdKes) || 0)
      : naplata // Keš — sve je keš
    const splitInfo = izdNacinPlacanja === 'Kartica + Keš'
      ? ` (Keš: ${parseFloat(izdKes)||0}€, Kartica: ${parseFloat(izdKartica)||0}€)`
      : ''
    const nacinSaInfom = izdNacinPlacanja + splitInfo

    const { error } = await supabase.from('rezervacije').update({
      daily_status: 'Izdato', ko_je_izdao: akcijaAgent,
      naplaceno: naplata, depozit_uzet: depozitUzet > 0,
      depozit: depozitUzet > 0 ? depozitUzet : (rez.depozit || 0),
      nacin_placanja: nacinSaInfom,
    }).eq('id', rezId)
    if (error) { alert('Greška: ' + error.message); setAkcijaSaving(false); return }

    const { data: agentData } = await supabase.from('agents').select('email').eq('full_name', akcijaAgent).maybeSingle()
    const agentEmail = agentData?.email || ''
    const inserti: any[] = []

    // Agenta zadužujemo SAMO za keš iznos (kartica ide direktno u firmu)
    if (kesIznos > 0) {
      const p = Math.max(0, (rez.ukupno_naplata || 0) - naplata)
      inserti.push({ id: Date.now()+'1', tip_transakcije: 'priliv', datum: new Date().toISOString().split('T')[0], kategorija: 'Izdavanje vozila', iznos: kesIznos, vozilo: rez.br_tablica, komentar: `Naplata pri izdavanju (REZ #${rezId}). Način: ${nacinSaInfom}.${p > 0.01 ? ` Preostali dug: ${p.toFixed(2)}€` : ''}`, osoba: akcijaAgent, osobaemail: agentEmail, timestamp_upisa: new Date().toISOString(), status: 'Zavrseno' })
    }
    // Kartica — evidentira se odvojeno, ne zadužuje agenta (nema osoba/osobaemail)
    const karticaIznos = izdNacinPlacanja === 'Kartica' ? naplata
      : izdNacinPlacanja === 'Kartica + Keš' ? (parseFloat(izdKartica) || 0)
      : 0
    if (karticaIznos > 0) {
      inserti.push({ id: Date.now()+'1k', tip_transakcije: 'priliv', datum: new Date().toISOString().split('T')[0], kategorija: 'Naplata Karticom', iznos: karticaIznos, vozilo: rez.br_tablica, komentar: `Kartica pri izdavanju (REZ #${rezId}) — ${nacinSaInfom}. Agent: ${akcijaAgent}`, osoba: null, osobaemail: null, timestamp_upisa: new Date().toISOString(), status: 'Zavrseno' })
    }
    if (depozitUzet > 0) {
      inserti.push({ id: Date.now()+'2', tip_transakcije: 'priliv', datum: new Date().toISOString().split('T')[0], kategorija: 'Depozit', iznos: depozitUzet, vozilo: rez.br_tablica, komentar: `Depozit pri izdavanju (REZ #${rezId})`, osoba: akcijaAgent, osobaemail: agentEmail, timestamp_upisa: new Date().toISOString(), status: 'Zavrseno' })
    }
    if (inserti.length > 0) await supabase.from('transakcije').insert(inserti)
    await supabase.from('logovi').insert([{ akcija: `${akcijaAgent} izdao REZ #${rezId}. Naplaćeno: ${naplata}€ (keš: ${kesIznos}€). Depozit: ${depozitUzet}€` }])
    setAkcijaSaving(false); setShowAkcijaModal(false); loadAll(); loadOverdue()
  }

  async function potvrdiAkcijuPreuzmi() {
    if (!akcijaRez || !akcijaAgent) return
    setAkcijaSaving(true)
    const rez = akcijaRez; const rezId = rez.id
    const naplataDuga = preuzDugNaplacen ? (parseFloat(preuzDugIznos) || 0) : 0
    const vracenDepozit = preuzDepVracen ? (parseFloat(preuzDepIznos) || 0) : 0
    const novoNaplaceno = (rez.naplaceno || 0) + naplataDuga
    const preostaliDug = (rez.ukupno_naplata || 0) - novoNaplaceno
    const splitInfoPreuz = preuzDugNacin === 'Kartica + Keš'
      ? ` (Keš: ${parseFloat(preuzDugKes)||0}€, Kartica: ${parseFloat(preuzDugKartica)||0}€)`
      : ''
    const kesIznosPreuz = preuzDugNacin === 'Kartica' ? 0
      : preuzDugNacin === 'Kartica + Keš' ? (parseFloat(preuzDugKes) || 0)
      : naplataDuga
    let novaNapomena = rez.napomena || ''
    if (preuzDepRazlog) novaNapomena += ` | Zadržan depozit: ${preuzDepRazlog}`

    await supabase.from('rezervacije').update({
      ko_je_preuzeo: akcijaAgent, naplaceno: novoNaplaceno,
      depozit_vracen: true, vraceni_depozit_iznos: vracenDepozit, napomena: novaNapomena,
    }).eq('id', rezId)

    const { data: agentData } = await supabase.from('agents').select('email').eq('full_name', akcijaAgent).maybeSingle()
    const agentEmail = agentData?.email || ''
    const tranInsert: any[] = []
    if (naplataDuga > 0) {
      tranInsert.push({ id: Date.now()+'r1', tip_transakcije: 'priliv', datum: new Date().toISOString().split('T')[0], kategorija: 'Naplata Duga', iznos: kesIznosPreuz > 0 ? kesIznosPreuz : naplataDuga, vozilo: rez.br_tablica, komentar: `Naplata duga pri preuzimanju (REZ #${rezId}). Način: ${preuzDugNacin}${splitInfoPreuz}${kesIznosPreuz < naplataDuga ? ` — kartica ${(naplataDuga - kesIznosPreuz).toFixed(2)}€ ne zadužuje agenta` : ''}`, osoba: akcijaAgent, osobaemail: agentEmail, timestamp_upisa: new Date().toISOString(), status: 'Zavrseno' })
      // Kartica dio — evidentira se odvojeno
      const karticaDugIznos = preuzDugNacin === 'Kartica' ? naplataDuga
        : preuzDugNacin === 'Kartica + Keš' ? (parseFloat(preuzDugKartica) || 0)
        : 0
      if (karticaDugIznos > 0) {
        tranInsert.push({ id: Date.now()+'r1k', tip_transakcije: 'priliv', datum: new Date().toISOString().split('T')[0], kategorija: 'Naplata Karticom', iznos: karticaDugIznos, vozilo: rez.br_tablica, komentar: `Kartica pri preuzimanju (REZ #${rezId}) — ${preuzDugNacin}${splitInfoPreuz}. Agent: ${akcijaAgent}`, osoba: null, osobaemail: null, timestamp_upisa: new Date().toISOString(), status: 'Zavrseno' })
      }
    }
    if (vracenDepozit > 0) {
      tranInsert.push({ id: Date.now()+'r2', tip_transakcije: 'odliv', datum: new Date().toISOString().split('T')[0], kategorija: 'Povrat Depozita', iznos: vracenDepozit, vozilo: rez.br_tablica, komentar: `Vraćen depozit pri preuzimanju (REZ #${rezId})`, osoba: akcijaAgent, osobaemail: agentEmail, timestamp_upisa: new Date().toISOString(), status: 'Zavrseno' })
    }
    if (tranInsert.length > 0) await supabase.from('transakcije').insert(tranInsert)
    await supabase.from('logovi').insert([{ akcija: `${akcijaAgent} preuzeo REZ #${rezId}. Naplaćeno: ${naplataDuga}€` }])

    if (preostaliDug > 0.01 && rez.br_vozacke) {
      const { data: dData } = await supabase.from('duznici').select('*').eq('br_vozacke', rez.br_vozacke).maybeSingle()
      const istorija = [...(dData?.istorija || []), { datum: new Date().toLocaleString('sr-RS'), iznos: preostaliDug, komentar: `Ostao dug REZ #${rezId}`, tip: 'zaduzenje' }]
      if (dData) await supabase.from('duznici').update({ ukupan_dug: (dData.ukupan_dug || 0) + preostaliDug, istorija }).eq('br_vozacke', rez.br_vozacke)
      else await supabase.from('duznici').insert([{ br_vozacke: rez.br_vozacke, ime_prezime: rez.ime_prezime, telefon: rez.telefon || '', ukupan_dug: preostaliDug, istorija }])
    }
    setAkcijaSaving(false); setShowAkcijaModal(false); loadAll(); loadOverdue()
  }

  async function izvrsiAgentAkciju(agent: string) {
    const rez = rezervacije.find(r => r.id === agentRezId) || overdueRez.find(r => r.id === agentRezId)
    if (!rez || !agentRezId) return
    setShowAgentModal(false)
    // Otvori akcija modal sa odabranim agentom
    if (agentTip === 'izdavanje') {
      setAkcijaRez(rez); setAkcijaTip('izdavanje'); setAkcijaAgent(agent)
      setIzdNaplata(String(rez.ukupno_naplata || 0)); setIzdDepozit(String(rez.depozit || 0)); setIzdNacinPlacanja('Keš')
      setIzdKes(''); setIzdKartica('')
      setShowAkcijaModal(true)
    } else {
      const dug = Math.max(0, (rez.ukupno_naplata || 0) - (rez.naplaceno || 0))
      setAkcijaRez(rez); setAkcijaTip('preuzimanje'); setAkcijaAgent(agent)
      setPreuzDugNaplacen(dug > 0); setPreuzDugIznos(dug > 0 ? dug.toFixed(2) : '0'); setPreuzDugNacin('Keš')
      setPreuzDugKes(''); setPreuzDugKartica('')
      setPreuzDepVracen((rez.depozit || 0) > 0); setPreuzDepIznos(String(rez.depozit || 0)); setPreuzDepRazlog('')
      setShowAkcijaModal(true)
    }
  }

  async function otkaziIzdavanje() {
    if (!agentRezId) return
    await supabase.from('rezervacije').update({ daily_status: 'Nije izdato' }).eq('id', agentRezId)
    await supabase.from('logovi').insert([{ akcija: `Otkazano izdavanje REZ #${agentRezId}` }])
    setShowAgentModal(false); loadAll()
  }

  function otvoriProduzi(r: KalRezervacija) {
    setProduziRezId(r.id)
    setProduziDana('')
    setProduziCijena(String(r.cijena_dan || 0))
    setProduziNaplaceno('')
    setShowProduziModal(true)
  }

  async function sacuvajProduzi() {
    if (!produziRezId) return
    const dani = parseInt(produziDana)
    const cijena = parseFloat(produziCijena)
    if (isNaN(dani) || dani <= 0 || isNaN(cijena)) { alert('Unesite ispravne podatke!'); return }
    const rez = rezervacije.find(r => r.id === produziRezId) || overdueRez.find(r => r.id === produziRezId)
    if (!rez) return

    const doplata = dani * cijena
    const naplacenoProduzenje = parseFloat(produziNaplaceno || '0')

    setProduziSaving(true)
    const novoDo = addDays(rez.do_datuma, dani)
    const novoUkupno = (rez.ukupno_naplata || 0) + doplata
    const novoNaplaceno = (rez.naplaceno || 0) + naplacenoProduzenje
    const noviBrojDana = Math.ceil((new Date(novoDo).getTime() - new Date(rez.od_datuma).getTime()) / 86400000)

    const { error } = await supabase.from('rezervacije').update({
      do_datuma: novoDo, ukupno_naplata: novoUkupno,
      naplaceno: novoNaplaceno, broj_dana: noviBrojDana,
    }).eq('id', produziRezId)
    if (error) { alert('Greška: ' + error.message); setProduziSaving(false); return }

    const agent = getCookie('avtorent-agent-name') || logovanAgent
    if (agent && naplacenoProduzenje > 0) {
      const { data: agentData } = await supabase.from('agents').select('email').eq('full_name', agent).maybeSingle()
      const agentEmail = agentData?.email || ''
      await supabase.from('transakcije').insert([{
        id: Date.now().toString() + 'p',
        tip_transakcije: 'priliv',
        datum: new Date().toISOString().split('T')[0],
        kategorija: 'Izdavanje vozila',
        iznos: naplacenoProduzenje,
        vozilo: rez.br_tablica,
        komentar: `Produženje rente ${dani} dana (REZ #${produziRezId}). Novo do: ${novoDo}.`,
        osoba: agent, osobaemail: agentEmail,
        timestamp_upisa: new Date().toISOString(), status: 'Zavrseno',
      }])
    }

    const ukupniDug = novoUkupno - novoNaplaceno
    if (ukupniDug > 0.01 && rez.br_vozacke) {
      const { data: dData } = await supabase.from('duznici').select('*').eq('br_vozacke', rez.br_vozacke).maybeSingle()
      const istorija = [...(dData?.istorija || []), {
        datum: new Date().toLocaleString('sr-RS'), iznos: ukupniDug,
        komentar: `Dug nakon produženja REZ #${produziRezId} do ${novoDo}`, tip: 'zaduzenje'
      }]
      if (dData) await supabase.from('duznici').update({ ukupan_dug: ukupniDug, istorija, telefon: rez.telefon || dData.telefon }).eq('br_vozacke', rez.br_vozacke)
      else await supabase.from('duznici').insert([{ br_vozacke: rez.br_vozacke, ime_prezime: rez.ime_prezime, telefon: rez.telefon || '', ukupan_dug: ukupniDug, istorija }])
    }

    await supabase.from('logovi').insert([{
      akcija: `Produžena renta REZ #${produziRezId} za ${dani} dana do ${novoDo}. Doplata: ${doplata}€. Naplaćeno: ${naplacenoProduzenje}€.`
    }])

    // Dohvati ažurirane podatke PRIJE zatvaranja modala
    const { data: azurRez } = await supabase.from('rezervacije').select('*').eq('id', produziRezId).single()

    setProduziSaving(false)
    setShowProduziModal(false)
    loadAll()
    loadOverdue()

    // Pitaj za ugovor — vozila su i dalje dostupna u closure
    if (azurRez) {
      const stampa = window.confirm(`✅ Renta produžena do: ${toDMY(novoDo)}\nNaplaćeno: ${naplacenoProduzenje}€${ukupniDug > 0.01 ? `\nPreostali dug: ${ukupniDug.toFixed(2)}€` : ''}\n\nŽeliš li odštampati novi ugovor?`)
      if (stampa) {
        generateUgovor(rezToForm(azurRez as KalRezervacija), vozila)
      }
    }
  }

  function otvoriUpload(r: KalRezervacija) {
    setUploadRezId(r.id); setUploadUrl(r.ugovor_slika || ''); setShowUploadModal(true)
  }

  async function sacuvajUpload() {
    if (!uploadRezId || !uploadUrl.trim()) return
    setUploadSaving(true)
    await supabase.from('rezervacije').update({ ugovor_slika: uploadUrl.trim() }).eq('id', uploadRezId)
    await supabase.from('logovi').insert([{ akcija: `Upload ugovora za REZ #${uploadRezId}` }])
    setUploadSaving(false); setShowUploadModal(false); loadAll()
  }

  const ReservationCard = ({ r, tip }: { r: KalRezervacija; tip: 'out' | 'in' }) => {
    const st = STATUS_COLORS[r.daily_status] || STATUS_COLORS['Na čekanju']
    const sat = tip === 'out' ? (r.vreme_izdavanja || '10:00').slice(0, 5) : (r.vreme_povratka || '10:00').slice(0, 5)
    const vozilo = vozila.find(v => v.license_plate === r.br_tablica)
    const vozNaziv = vozilo?.agregirani_2 || r.br_tablica
    const ukupno = r.ukupno_naplata || 0
    const naplaceno = r.naplaceno || 0
    const dug = ukupno - naplaceno
    const depozit = r.depozit || 0
    const isDone = tip === 'out' ? (r.daily_status === 'Izdato' || r.daily_status === 'Nije izdato') : !!r.ko_je_preuzeo
    const isEarlyReturn = tip === 'in' && r.do_datuma > selectedDate
    const borderColor = tip === 'out' ? '#1D9E75' : '#185FA5'
    const timeColor = tip === 'out' ? '#1D9E75' : '#185FA5'
    const timeBg = tip === 'out' ? '#E1F5EE' : '#E6F1FB'

    return (
      <div style={{ border: `1px solid #e5e7eb`, borderLeft: `4px solid ${borderColor}`, borderRadius: 10, padding: 16, background: isDone ? '#fafafa' : '#fff', opacity: isDone && !showDone ? 0.7 : 1, transition: 'opacity 0.2s' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#111' }}>{r.ime_prezime}</div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{r.telefon}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ background: timeBg, color: timeColor, padding: '4px 10px', borderRadius: 20, fontSize: 13, fontWeight: 700 }}>🕒 {sat}h</div>
            <span style={{ fontSize: 11, background: st.bg, color: st.color, padding: '3px 8px', borderRadius: 20, fontWeight: 600 }}>{st.label}</span>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
          <div style={{ background: '#f9fafb', borderRadius: 6, padding: '8px 10px' }}>
            <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 2 }}>Vozilo</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>{vozNaziv}</div>
          </div>
          <div style={{ background: '#f9fafb', borderRadius: 6, padding: '8px 10px' }}>
            <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 2 }}>{tip === 'out' ? 'Preuzimanje' : 'Povratak'}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>{tip === 'out' ? r.mjesto_preuzimanja : r.mjesto_povratka}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          {tip === 'out' && (<span style={{ fontSize: 12, background: '#E1F5EE', color: '#085041', padding: '3px 8px', borderRadius: 20, fontWeight: 600 }}>💰 Za zaduženje: {ukupno}€</span>)}
          {tip === 'in' && dug > 0 && (<span style={{ fontSize: 12, background: '#FCEBEB', color: '#791F1F', padding: '3px 8px', borderRadius: 20, fontWeight: 700 }}>⚠️ DUG ZA NAPLATU: {dug.toFixed(2)}€</span>)}
          {tip === 'in' && dug <= 0 && (<span style={{ fontSize: 12, background: '#E1F5EE', color: '#085041', padding: '3px 8px', borderRadius: 20, fontWeight: 600 }}>✅ Naplaćeno sve ({naplaceno}€)</span>)}
          {depozit > 0 && (<span style={{ fontSize: 12, background: '#FAEEDA', color: '#633806', padding: '3px 8px', borderRadius: 20, fontWeight: 600 }}>🛡️ DEP: {depozit}€</span>)}
          {r.br_leta && (<span style={{ fontSize: 12, background: '#E6F1FB', color: '#0C447C', padding: '3px 8px', borderRadius: 20, fontWeight: 600 }}>✈️ LET: {r.br_leta}</span>)}
        </div>
        {r.ko_je_izdao && (
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>
            🚗 Izdao: <strong>{r.ko_je_izdao}</strong>
            {r.ko_je_preuzeo && <span> · 🔙 Preuzeo: <strong>{r.ko_je_preuzeo}</strong></span>}
          </div>
        )}
        {r.ugovor_slika && (
          <div style={{ marginBottom: 8 }}>
            <a href={r.ugovor_slika} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#1D9E75', fontWeight: 600, textDecoration: 'none' }}>📄 Pogledaj ugovor →</a>
          </div>
        )}
        {isEarlyReturn && (
          <div style={{ background: '#fef9c3', border: '1px solid #fbbf24', borderRadius: 6, padding: '6px 10px', marginBottom: 8, fontSize: 12, color: '#713f12' }}>
            ⚡ Prijevremeni povratak (do: {toDMY(r.do_datuma)})
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#9ca3af' }}>REZ #{r.id}</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button onClick={() => otvoriUpload(r)} style={{ padding: '6px 10px', fontSize: 11, border: '1px solid #e5e7eb', borderRadius: 8, background: '#f9fafb', cursor: 'pointer', color: '#6b7280' }}>📎 Ugovor</button>
            <button onClick={() => openRez(r)} style={{ padding: '6px 10px', fontSize: 11, border: '1px solid #e5e7eb', borderRadius: 8, background: '#f9fafb', cursor: 'pointer', color: '#374151' }}>Detalji</button>
            {tip === 'in' && r.daily_status === 'Izdato' && (
              <button onClick={() => otvoriProduzi(r)} style={{ padding: '6px 12px', fontSize: 12, border: '1px solid #0ea5e9', borderRadius: 8, background: '#e0f2fe', cursor: 'pointer', color: '#0369a1', fontWeight: 600 }}>🔄 Produži</button>
            )}
            {tip === 'out' && r.daily_status === 'Na čekanju' && (
              <button onClick={() => pokreniIzdaj(r)} style={{ padding: '6px 14px', fontSize: 12, border: '1px solid #185FA5', borderRadius: 8, background: '#E6F1FB', cursor: 'pointer', color: '#185FA5', fontWeight: 700 }}>🚗 Izdaj</button>
            )}
            {tip === 'in' && r.daily_status === 'Izdato' && !r.ko_je_preuzeo && (
              <button onClick={() => pokreniPreuzmi(r)} style={{ padding: '6px 14px', fontSize: 12, border: '1px solid #1D9E75', borderRadius: 8, background: '#E1F5EE', cursor: 'pointer', color: '#085041', fontWeight: 700 }}>🔙 Preuzmi</button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 600, color: '#111', margin: 0 }}>Dnevni pregled obaveza</h1>
            <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4, textTransform: 'capitalize' }}>
              {formatDate(selectedDate)}
              {selectedDate === today && <span style={{ marginLeft: 8, background: '#E1F5EE', color: '#0F6E56', fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>Danas</span>}
              {selectedDate > today && <span style={{ marginLeft: 8, background: '#E6F1FB', color: '#0C447C', fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>Predstojeći</span>}
            </div>
            {logovanAgent && (
              <div style={{ fontSize: 12, color: '#1D9E75', marginTop: 4, fontWeight: 600 }}>
                👤 Logovani agent: {logovanAgent}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={prevDay} style={{ padding: '8px 14px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 16 }}>←</button>
            <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, color: '#111', background: '#fff' }} />
            <button onClick={() => setSelectedDate(today)} style={{ padding: '8px 14px', border: '1px solid #1D9E75', borderRadius: 8, background: '#E1F5EE', cursor: 'pointer', fontSize: 12, color: '#0F6E56', fontWeight: 600 }}>Danas</button>
            <button onClick={nextDay} style={{ padding: '8px 14px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 16 }}>→</button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {LOKACIJE.map(l => (
            <button key={l} onClick={() => setLokacija(l)} style={{ padding: '7px 16px', fontSize: 12, fontWeight: 600, border: `1px solid ${currentLok === l ? '#1D9E75' : '#e5e7eb'}`, borderRadius: 20, background: currentLok === l ? '#E1F5EE' : '#fff', color: currentLok === l ? '#085041' : '#6b7280', cursor: 'pointer' }}>
              {l === 'CRNA GORA' ? '🇲🇪' : l === 'BiH' ? '🇧🇦' : l === 'SRBIJA' ? '🇷🇸' : '🇦🇱'} {l}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <button onClick={() => { setRezForm(EMPTY_REZ_FORM); setIsNewRez(true); setShowRezModal(true) }} style={{ padding: '8px 16px', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          + Nova rezervacija
        </button>
      </div>

      {newAlert && (
        <div style={{ background: '#E1F5EE', border: '1px solid #1D9E75', borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>🔔</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#085041' }}>NOVA REZERVACIJA!</div>
              <div style={{ fontSize: 12, color: '#0F6E56' }}>{newAlert}</div>
            </div>
          </div>
          <button onClick={() => setNewAlert(null)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#085041' }}>✕</button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Izdavanja', value: `${izdavanja.filter(r => r.daily_status === 'Izdato' || r.daily_status === 'Nije izdato').length}/${izdavanja.length}`, color: '#1D9E75', bg: '#E1F5EE', sub: 'završeno/ukupno' },
          { label: 'Vraćanja', value: `${povratci.filter(r => !!r.ko_je_preuzeo).length}/${povratci.length}`, color: '#185FA5', bg: '#E6F1FB', sub: 'završeno/ukupno' },
          { label: 'Preostale obaveze', value: pendingCount, color: pendingCount === 0 ? '#085041' : '#BA7517', bg: pendingCount === 0 ? '#E1F5EE' : '#FAEEDA', sub: pendingCount === 0 ? 'sve završeno! ✓' : 'čeka na akciju' },
        ].map(m => (
          <div key={m.label} style={{ background: m.bg, borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>{m.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: m.color }}>{m.value}</div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{m.sub}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af', fontSize: 13 }}>Učitavanje...</div>
      ) : (
        <>
          <div style={{ background: pendingCount === 0 ? '#E1F5EE' : '#f9fafb', border: `1px solid ${pendingCount === 0 ? '#5DCAA5' : '#e5e7eb'}`, borderRadius: 10, padding: '14px 20px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: pendingCount === 0 ? '#085041' : '#374151' }}>
              {pendingCount === 0 ? '✓ NEMA OBAVEZA NA ČEKANJU' : `Obaveze: ${doneCount}/${totalCount} završeno`}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {pendingCount > 0 && (
                <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
                  <span style={{ color: '#1D9E75' }}>✓ {doneCount} završeno</span>
                  <span style={{ color: '#BA7517' }}>⏳ {pendingCount} preostalo</span>
                </div>
              )}
              {doneCount > 0 && (
                <button onClick={() => setShowDone(s => !s)} style={{ fontSize: 11, padding: '3px 10px', border: '1px solid #d1d5db', borderRadius: 20, background: '#fff', cursor: 'pointer', color: '#6b7280' }}>
                  {showDone ? 'Sakrij završene' : 'Prikaži završene'}
                </button>
              )}
            </div>
          </div>

          {(izdavanja.length > 0 || povratci.length > 0) ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#1D9E75' }} />
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>🚗 IZDAVANJA (OUT)</div>
                  <div style={{ background: '#E1F5EE', color: '#085041', fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>{izdavanja.length}</div>
                </div>
                {izdavanja.length === 0 ? (
                  <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af', fontSize: 13, border: '1px dashed #e5e7eb', borderRadius: 10 }}>Nema izdavanja</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {[...izdavanja].sort((a, b) => { const aD = a.daily_status !== 'Na čekanju'; const bD = b.daily_status !== 'Na čekanju'; if (aD !== bD) return aD ? 1 : -1; return (a.vreme_izdavanja || '').localeCompare(b.vreme_izdavanja || '') })
                      .filter(r => showDone || r.daily_status === 'Na čekanju')
                      .map(r => <ReservationCard key={r.id} r={r} tip="out" />)}
                  </div>
                )}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#185FA5' }} />
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>🔙 POVRATAK (IN)</div>
                  <div style={{ background: '#E6F1FB', color: '#0C447C', fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>{povratci.length}</div>
                </div>
                {povratci.length === 0 ? (
                  <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af', fontSize: 13, border: '1px dashed #e5e7eb', borderRadius: 10 }}>Nema vraćanja</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {[...povratci].sort((a, b) => { const aD = !!a.ko_je_preuzeo; const bD = !!b.ko_je_preuzeo; if (aD !== bD) return aD ? 1 : -1; return (a.vreme_povratka || '').localeCompare(b.vreme_povratka || '') })
                      .filter(r => showDone || !r.ko_je_preuzeo)
                      .map(r => <ReservationCard key={r.id} r={r} tip="in" />)}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af', fontSize: 14, border: '1px dashed #e5e7eb', borderRadius: 12, marginBottom: 32 }}>Nema rezervacija za ovaj dan.</div>
          )}

          {overdueFiltered.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#dc2626' }} />
                <div style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>⚠️ Neizmirene obaveze</div>
                <div style={{ background: '#FCEBEB', color: '#791F1F', fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>{overdueFiltered.length}</div>
                <div style={{ fontSize: 12, color: '#9ca3af' }}>iz prethodnih dana</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {overdueFiltered.map(r => {
                  const isOverduePickup = r.daily_status === 'Na čekanju'
                  const vozilo = vozila.find(v => v.license_plate === r.br_tablica)
                  const vozNaziv = vozilo?.agregirani_2 || r.br_tablica
                  const dug = (r.ukupno_naplata || 0) - (r.naplaceno || 0)
                  return (
                    <div key={r.id} style={{ border: '1px solid #fecaca', borderLeft: '4px solid #dc2626', borderRadius: 10, padding: 16, background: '#fff' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 15, color: '#111' }}>{r.ime_prezime}</div>
                          <div style={{ fontSize: 12, color: '#9ca3af' }}>{r.telefon}</div>
                        </div>
                        <span style={{ fontSize: 11, background: '#FCEBEB', color: '#791F1F', padding: '3px 8px', borderRadius: 20, fontWeight: 600 }}>
                          {isOverduePickup ? 'Nije preuzeto' : 'Nije vraćeno'}
                        </span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
                        <div style={{ background: '#f9fafb', borderRadius: 6, padding: '7px 10px' }}>
                          <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 1 }}>Vozilo</div>
                          <div style={{ fontSize: 12, fontWeight: 600 }}>{vozNaziv}</div>
                        </div>
                        <div style={{ background: '#f9fafb', borderRadius: 6, padding: '7px 10px' }}>
                          <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 1 }}>{isOverduePickup ? 'Trebalo preuzimanje' : 'Trebalo vraćanje'}</div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#dc2626' }}>{toDMY(isOverduePickup ? r.od_datuma : r.do_datuma)}</div>
                        </div>
                        <div style={{ background: '#f9fafb', borderRadius: 6, padding: '7px 10px' }}>
                          <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 1 }}>Dug</div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: dug > 0 ? '#dc2626' : '#1D9E75' }}>{dug > 0 ? `${dug.toFixed(2)}€` : 'Plaćeno'}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#9ca3af' }}>REZ #{r.id}</span>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => otvoriUpload(r)} style={{ padding: '6px 10px', fontSize: 11, border: '1px solid #e5e7eb', borderRadius: 8, background: '#f9fafb', cursor: 'pointer', color: '#6b7280' }}>📎 Ugovor</button>
                          <button onClick={() => openRez(r)} style={{ padding: '6px 10px', fontSize: 11, border: '1px solid #e5e7eb', borderRadius: 8, background: '#f9fafb', cursor: 'pointer', color: '#374151' }}>Detalji</button>
                          {isOverduePickup && (<button onClick={() => pokreniIzdaj(r)} style={{ padding: '6px 12px', fontSize: 12, border: '1px solid #185FA5', borderRadius: 8, background: '#E6F1FB', color: '#185FA5', cursor: 'pointer', fontWeight: 600 }}>🚗 Izdaj</button>)}
                          {!isOverduePickup && (<>
                            <button onClick={() => otvoriProduzi(r)} style={{ padding: '6px 12px', fontSize: 12, border: '1px solid #0ea5e9', borderRadius: 8, background: '#e0f2fe', color: '#0369a1', cursor: 'pointer', fontWeight: 600 }}>🔄 Produži</button>
                            <button onClick={() => pokreniPreuzmi(r)} style={{ padding: '6px 12px', fontSize: 12, border: '1px solid #1D9E75', borderRadius: 8, background: '#E1F5EE', color: '#085041', cursor: 'pointer', fontWeight: 600 }}>🔙 Preuzmi</button>
                          </>)}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* ─── AKCIJA MODAL (Izdaj / Preuzmi) ─── */}
      {showAkcijaModal && akcijaRez && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, maxWidth: 460, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>

            {/* Header */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#111', marginBottom: 4 }}>
                {akcijaTip === 'izdavanje' ? '🚗 Izdaj vozilo' : '🔙 Preuzmi vozilo'}
              </div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>
                {akcijaRez.br_tablica} — {akcijaRez.ime_prezime}
              </div>
              {akcijaAgent && (
                <div style={{ fontSize: 12, color: '#1D9E75', fontWeight: 600, marginTop: 4 }}>
                  👤 Agent: {akcijaAgent}
                </div>
              )}
            </div>

            {/* Finansije pregled */}
            <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 14px', marginBottom: 16, display: 'flex', gap: 16 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: '#9ca3af' }}>UKUPNO</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#111' }}>{akcijaRez.ukupno_naplata || 0}€</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: '#9ca3af' }}>NAPLAĆENO</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#1D9E75' }}>{akcijaRez.naplaceno || 0}€</div>
              </div>
              {(akcijaRez.depozit || 0) > 0 && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: '#9ca3af' }}>DEPOZIT</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#633806' }}>{akcijaRez.depozit}€</div>
                </div>
              )}
              {Math.max(0, (akcijaRez.ukupno_naplata || 0) - (akcijaRez.naplaceno || 0)) > 0 && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: '#9ca3af' }}>DUG</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#dc2626' }}>
                    {Math.max(0, (akcijaRez.ukupno_naplata || 0) - (akcijaRez.naplaceno || 0)).toFixed(2)}€
                  </div>
                </div>
              )}
            </div>

            {/* UPOZORENJE registracija */}
            {regUpozorenje && (
              <div style={{ background: '#FCEBEB', border: '2px solid #dc2626', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 24 }}>⚠️</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#dc2626', marginBottom: 4 }}>
                      REGISTRACIJA ISTIČE TOKOM NAJMA!
                    </div>
                    <div style={{ fontSize: 12, color: '#791F1F' }}>
                      Istek registracije: <strong>{regUpozorenje.istek}</strong>
                    </div>
                    <div style={{ fontSize: 12, color: '#791F1F' }}>
                      Vozilo će biti {regUpozorenje.dana} {regUpozorenje.dana === 1 ? 'dan' : 'dana'} bez važeće registracije prije povratka.
                    </div>
                    <div style={{ marginTop: 8, fontSize: 11, color: '#dc2626', fontWeight: 700 }}>
                      Potvrdom prihvataš odgovornost za ovo izdavanje.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* IZDAVANJE */}
            {akcijaTip === 'izdavanje' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>💰 Naplaćeno od klijenta (€)</label>
                  <input type="number" step="0.01" value={izdNaplata} onChange={e => setIzdNaplata(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', fontSize: 15, fontWeight: 700, border: '1px solid #d1d5db', borderRadius: 8, color: '#111', boxSizing: 'border-box' as const }} />
                  {Math.abs((parseFloat(izdNaplata)||0) - (akcijaRez.ukupno_naplata||0)) > 0.01 && (
                    <div style={{ marginTop: 4, fontSize: 12, color: (parseFloat(izdNaplata)||0) < (akcijaRez.ukupno_naplata||0) ? '#dc2626' : '#1D9E75', fontWeight: 600 }}>
                      {(parseFloat(izdNaplata)||0) < (akcijaRez.ukupno_naplata||0)
                        ? `⚠️ Dug: ${((akcijaRez.ukupno_naplata||0) - (parseFloat(izdNaplata)||0)).toFixed(2)}€`
                        : `✅ Pretplata: ${((parseFloat(izdNaplata)||0) - (akcijaRez.ukupno_naplata||0)).toFixed(2)}€`}
                    </div>
                  )}
                </div>
                {(akcijaRez.depozit || 0) > 0 && (
                  <div>
                    <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>🛡️ Uzet depozit (€)</label>
                    <input type="number" step="0.01" value={izdDepozit} onChange={e => setIzdDepozit(e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', fontSize: 15, fontWeight: 700, border: '1px solid #d1d5db', borderRadius: 8, color: '#111', boxSizing: 'border-box' as const }} />
                  </div>
                )}
                <div>
                  <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 6 }}>💳 Način plaćanja</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                    {['Keš', 'Kartica', 'Kartica + Keš'].map(m => (
                      <button key={m} onClick={() => { setIzdNacinPlacanja(m); setIzdKes(''); setIzdKartica('') }}
                        style={{ padding: '9px', border: `1px solid ${izdNacinPlacanja === m ? '#1D9E75' : '#e5e7eb'}`, borderRadius: 8, background: izdNacinPlacanja === m ? '#E1F5EE' : '#fff', color: izdNacinPlacanja === m ? '#085041' : '#6b7280', cursor: 'pointer', fontSize: 12, fontWeight: izdNacinPlacanja === m ? 700 : 400 }}>
                        {m}
                      </button>
                    ))}
                  </div>
                  {izdNacinPlacanja === 'Kartica + Keš' && (
                    <div style={{ marginTop: 10, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '12px 14px' }}>
                      <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 700, marginBottom: 8 }}>Podijeli iznos od {parseFloat(izdNaplata)||0}€</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <div>
                          <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 3 }}>💵 Keš (€)</label>
                          <input type="number" step="0.01" value={izdKes}
                            onChange={e => { setIzdKes(e.target.value); const k = parseFloat(e.target.value)||0; const uk = parseFloat(izdNaplata)||0; setIzdKartica(uk > k ? (uk - k).toFixed(2) : '0') }}
                            placeholder="0.00"
                            style={{ width: '100%', padding: '8px 10px', fontSize: 13, fontWeight: 700, border: '1px solid #d1d5db', borderRadius: 8, color: '#111', boxSizing: 'border-box' as const }} />
                        </div>
                        <div>
                          <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 3 }}>💳 Kartica (€)</label>
                          <input type="number" step="0.01" value={izdKartica}
                            onChange={e => { setIzdKartica(e.target.value); const ka = parseFloat(e.target.value)||0; const uk = parseFloat(izdNaplata)||0; setIzdKes(uk > ka ? (uk - ka).toFixed(2) : '0') }}
                            placeholder="0.00"
                            style={{ width: '100%', padding: '8px 10px', fontSize: 13, fontWeight: 700, border: '1px solid #d1d5db', borderRadius: 8, color: '#111', boxSizing: 'border-box' as const }} />
                        </div>
                      </div>
                      {(() => { const uk = parseFloat(izdNaplata)||0; const k = parseFloat(izdKes)||0; const ka = parseFloat(izdKartica)||0; const r = uk - k - ka; return Math.abs(r) > 0.01 ? (
                        <div style={{ marginTop: 6, fontSize: 11, color: r > 0 ? '#dc2626' : '#9ca3af', fontWeight: 600 }}>
                          {r > 0 ? `⚠️ Ostaje ${r.toFixed(2)}€ nerasporedjeno` : `ℹ️ Razlika ${Math.abs(r).toFixed(2)}€`}
                        </div>
                      ) : <div style={{ marginTop: 6, fontSize: 11, color: '#1D9E75', fontWeight: 600 }}>✓ Iznos raspoređen</div> })()}
                    </div>
                  )}
                </div>
                <div style={{ background: '#E6F1FB', border: '1px solid #85B7EB', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#0C447C' }}>
                  Agent <strong>{akcijaAgent}</strong> se zadužuje za naplaćeni iznos.
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                  <button onClick={() => setShowAkcijaModal(false)} style={{ flex: 1, padding: 10, border: '1px solid #e5e7eb', borderRadius: 8, background: 'transparent', fontSize: 13, cursor: 'pointer', color: '#374151' }}>Odustani</button>
                  <button onClick={potvrdiAkcijuIzdaj} disabled={akcijaSaving}
                    style={{ flex: 2, padding: 10, background: akcijaSaving ? '#5DCAA5' : regUpozorenje ? '#dc2626' : '#185FA5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                    {akcijaSaving ? '⏳...' : regUpozorenje ? '⚠️ Svjestan/na rizika — Izdaj' : '✓ Potvrdi izdavanje'}
                  </button>
                </div>
                {/* Otkaži dugme samo za izdavanje */}
                <button onClick={async () => {
                  await supabase.from('rezervacije').update({ daily_status: 'Nije izdato' }).eq('id', akcijaRez.id)
                  await supabase.from('logovi').insert([{ akcija: `Otkazano izdavanje REZ #${akcijaRez.id}` }])
                  setShowAkcijaModal(false); loadAll()
                }} style={{ width: '100%', padding: 10, border: '1px solid #fecaca', borderRadius: 8, background: '#FCEBEB', cursor: 'pointer', fontSize: 12, color: '#dc2626', fontWeight: 600 }}>
                  🚫 Označi: NIJE IZDATO
                </button>
              </div>
            )}

            {/* PREUZIMANJE */}
            {akcijaTip === 'preuzimanje' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Dug */}
                {Math.max(0, (akcijaRez.ukupno_naplata || 0) - (akcijaRez.naplaceno || 0)) > 0.01 && (
                  <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '12px 14px' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
                      💰 Dug za naplatu: <span style={{ color: '#dc2626' }}>{Math.max(0, (akcijaRez.ukupno_naplata || 0) - (akcijaRez.naplaceno || 0)).toFixed(2)}€</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginBottom: preuzDugNaplacen ? 8 : 0 }}>
                      <button onClick={() => setPreuzDugNaplacen(true)} style={{ flex: 1, padding: '8px', border: `1px solid ${preuzDugNaplacen ? '#1D9E75' : '#e5e7eb'}`, borderRadius: 8, background: preuzDugNaplacen ? '#E1F5EE' : '#fff', cursor: 'pointer', fontSize: 13, color: preuzDugNaplacen ? '#085041' : '#374151', fontWeight: preuzDugNaplacen ? 600 : 400 }}>Naplaćeno ✓</button>
                      <button onClick={() => setPreuzDugNaplacen(false)} style={{ flex: 1, padding: '8px', border: `1px solid ${!preuzDugNaplacen ? '#dc2626' : '#e5e7eb'}`, borderRadius: 8, background: !preuzDugNaplacen ? '#FCEBEB' : '#fff', cursor: 'pointer', fontSize: 13, color: !preuzDugNaplacen ? '#dc2626' : '#374151', fontWeight: !preuzDugNaplacen ? 600 : 400 }}>Nije naplaćeno</button>
                    </div>
                    {preuzDugNaplacen && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <input type="number" step="0.01" value={preuzDugIznos} onChange={e => setPreuzDugIznos(e.target.value)}
                          style={{ width: '100%', padding: '9px 12px', fontSize: 14, fontWeight: 700, border: '1px solid #d1d5db', borderRadius: 8, color: '#111', boxSizing: 'border-box' as const }} />
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                          {['Keš', 'Kartica', 'Kartica + Keš'].map(m => (
                            <button key={m} onClick={() => { setPreuzDugNacin(m); setPreuzDugKes(''); setPreuzDugKartica('') }}
                              style={{ padding: '7px', border: `1px solid ${preuzDugNacin === m ? '#1D9E75' : '#e5e7eb'}`, borderRadius: 8, background: preuzDugNacin === m ? '#E1F5EE' : '#fff', color: preuzDugNacin === m ? '#085041' : '#6b7280', cursor: 'pointer', fontSize: 11, fontWeight: preuzDugNacin === m ? 700 : 400 }}>
                              {m}
                            </button>
                          ))}
                        </div>
                        {preuzDugNacin === 'Kartica + Keš' && (
                          <div style={{ marginTop: 8, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 12px' }}>
                            <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 700, marginBottom: 6 }}>Podijeli iznos od {parseFloat(preuzDugIznos)||0}€</div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                              <div>
                                <label style={{ fontSize: 10, color: '#6b7280', display: 'block', marginBottom: 2 }}>💵 Keš (€)</label>
                                <input type="number" step="0.01" value={preuzDugKes}
                                  onChange={e => { setPreuzDugKes(e.target.value); const k = parseFloat(e.target.value)||0; const uk = parseFloat(preuzDugIznos)||0; setPreuzDugKartica(uk > k ? (uk - k).toFixed(2) : '0') }}
                                  placeholder="0.00"
                                  style={{ width: '100%', padding: '7px 10px', fontSize: 13, fontWeight: 700, border: '1px solid #d1d5db', borderRadius: 6, color: '#111', boxSizing: 'border-box' as const }} />
                              </div>
                              <div>
                                <label style={{ fontSize: 10, color: '#6b7280', display: 'block', marginBottom: 2 }}>💳 Kartica (€)</label>
                                <input type="number" step="0.01" value={preuzDugKartica}
                                  onChange={e => { setPreuzDugKartica(e.target.value); const ka = parseFloat(e.target.value)||0; const uk = parseFloat(preuzDugIznos)||0; setPreuzDugKes(uk > ka ? (uk - ka).toFixed(2) : '0') }}
                                  placeholder="0.00"
                                  style={{ width: '100%', padding: '7px 10px', fontSize: 13, fontWeight: 700, border: '1px solid #d1d5db', borderRadius: 6, color: '#111', boxSizing: 'border-box' as const }} />
                              </div>
                            </div>
                            {(() => { const uk = parseFloat(preuzDugIznos)||0; const k = parseFloat(preuzDugKes)||0; const ka = parseFloat(preuzDugKartica)||0; const r = uk - k - ka; return Math.abs(r) > 0.01 ? (
                              <div style={{ marginTop: 4, fontSize: 10, color: '#dc2626', fontWeight: 600 }}>⚠️ Ostaje {r.toFixed(2)}€ nerasporedjeno</div>
                            ) : <div style={{ marginTop: 4, fontSize: 10, color: '#1D9E75', fontWeight: 600 }}>✓ Raspoređeno</div> })()}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Depozit */}
                {(akcijaRez.depozit || 0) > 0 && (
                  <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '12px 14px' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
                      🛡️ Depozit: <span style={{ color: '#633806' }}>{akcijaRez.depozit}€</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginBottom: preuzDepVracen ? 8 : 0 }}>
                      <button onClick={() => { setPreuzDepVracen(true); setPreuzDepIznos(String(akcijaRez.depozit)) }} style={{ flex: 1, padding: '8px', border: `1px solid ${preuzDepVracen ? '#1D9E75' : '#e5e7eb'}`, borderRadius: 8, background: preuzDepVracen ? '#E1F5EE' : '#fff', cursor: 'pointer', fontSize: 13, color: preuzDepVracen ? '#085041' : '#374151', fontWeight: preuzDepVracen ? 600 : 400 }}>Vraćen ✓</button>
                      <button onClick={() => { setPreuzDepVracen(false); setPreuzDepIznos('0') }} style={{ flex: 1, padding: '8px', border: `1px solid ${!preuzDepVracen ? '#f59e0b' : '#e5e7eb'}`, borderRadius: 8, background: !preuzDepVracen ? '#FAEEDA' : '#fff', cursor: 'pointer', fontSize: 13, color: !preuzDepVracen ? '#633806' : '#374151', fontWeight: !preuzDepVracen ? 600 : 400 }}>Zadržan</button>
                    </div>
                    {preuzDepVracen && (
                      <input type="number" step="0.01" value={preuzDepIznos} onChange={e => setPreuzDepIznos(e.target.value)} placeholder="Iznos vraćen"
                        style={{ width: '100%', padding: '9px 12px', fontSize: 14, fontWeight: 700, border: '1px solid #d1d5db', borderRadius: 8, color: '#111', boxSizing: 'border-box' as const }} />
                    )}
                    {!preuzDepVracen && (
                      <input value={preuzDepRazlog} onChange={e => setPreuzDepRazlog(e.target.value)} placeholder="Razlog zadržavanja..."
                        style={{ width: '100%', padding: '9px 12px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, color: '#111', boxSizing: 'border-box' as const, marginTop: 8 }} />
                    )}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setShowAkcijaModal(false)} style={{ flex: 1, padding: 10, border: '1px solid #e5e7eb', borderRadius: 8, background: 'transparent', fontSize: 13, cursor: 'pointer', color: '#374151' }}>Odustani</button>
                  <button onClick={potvrdiAkcijuPreuzmi} disabled={akcijaSaving}
                    style={{ flex: 2, padding: 10, background: akcijaSaving ? '#5DCAA5' : '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                    {akcijaSaving ? '⏳...' : '✓ Potvrdi preuzimanje'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* REZ MODAL */}
      {showRezModal && (
        <RezervacijaModal
          form={rezForm} setForm={setRezForm} vozila={vozilaLok}
          onSave={saveRezervacija} onClose={() => setShowRezModal(false)}
          onDelete={!isNewRez ? deleteRezervacija : undefined}
          saving={saving} isNew={isNewRez}
          onIzdaj={!isNewRez && !rezForm.ko_je_izdao ? () => {
            setShowRezModal(false)
            const r = rezervacije.find(x => x.id === rezForm.id) || overdueRez.find(x => x.id === rezForm.id)
            if (r) pokreniIzdaj(r)
          } : undefined}
          onPreuzmi={!isNewRez && rezForm.ko_je_izdao && !rezForm.ko_je_preuzeo ? () => {
            setShowRezModal(false)
            const r = rezervacije.find(x => x.id === rezForm.id) || overdueRez.find(x => x.id === rezForm.id)
            if (r) pokreniPreuzmi(r)
          } : undefined}
        />
      )}

      {/* AGENT MODAL — fallback ako nema cookie */}
      {showAgentModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, maxWidth: 420, width: '100%' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 700 }}>
              {agentTip === 'izdavanje' ? '🚗 Ko izdaje vozilo?' : '🔙 Ko preuzima vozilo?'}
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
              {agentiLista.map(a => (
                <button key={a} onClick={() => izvrsiAgentAkciju(a)}
                  style={{ padding: '10px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 13, color: '#374151', textAlign: 'left' }}>
                  {a}
                </button>
              ))}
            </div>
            {agentTip === 'izdavanje' && (
              <button onClick={otkaziIzdavanje} style={{ width: '100%', padding: 10, border: '1px solid #fecaca', borderRadius: 8, background: '#FCEBEB', cursor: 'pointer', fontSize: 13, color: '#dc2626', fontWeight: 600, marginBottom: 8 }}>
                🚫 Označi: NIJE IZDATO
              </button>
            )}
            <button onClick={() => setShowAgentModal(false)} style={{ width: '100%', padding: 10, border: '1px solid #e5e7eb', borderRadius: 8, background: 'transparent', cursor: 'pointer', fontSize: 13, color: '#6b7280' }}>
              Odustani
            </button>
          </div>
        </div>
      )}

      {/* PRODUŽI MODAL */}
      {showProduziModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, maxWidth: 400, width: '100%' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 700 }}>🔄 Produži rentu</h3>
            {(() => {
              const rez = rezervacije.find(r => r.id === produziRezId) || overdueRez.find(r => r.id === produziRezId)
              const doplata = (parseInt(produziDana) || 0) * (parseFloat(produziCijena) || 0)
              return (<>
                {rez && (<div style={{ background: '#f9fafb', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}><strong>{rez.ime_prezime}</strong> · {rez.br_tablica}<br /><span style={{ color: '#6b7280', fontSize: 12 }}>Trenutno do: {toDMY(rez.do_datuma)}</span></div>)}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div><label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Broj dana *</label><input type="number" value={produziDana} onChange={e => setProduziDana(e.target.value)} placeholder="Npr. 3" style={{ width: '100%', padding: '9px 12px', fontSize: 14, border: '1px solid #d1d5db', borderRadius: 8, color: '#111', boxSizing: 'border-box' as const }} /></div>
                  <div><label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Cijena €/dan *</label><input type="number" value={produziCijena} onChange={e => setProduziCijena(e.target.value)} style={{ width: '100%', padding: '9px 12px', fontSize: 14, border: '1px solid #d1d5db', borderRadius: 8, color: '#111', boxSizing: 'border-box' as const }} /></div>
                  {doplata > 0 && (<div style={{ background: '#E1F5EE', border: '1px solid #1D9E75', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#085041' }}>Ukupno za produženje: <strong>{doplata}€</strong></div>)}
                  <div><label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Naplaćeno za produženje (€)</label><input type="number" value={produziNaplaceno} onChange={e => setProduziNaplaceno(e.target.value)} placeholder={String(doplata || 0)} style={{ width: '100%', padding: '9px 12px', fontSize: 14, border: '1px solid #d1d5db', borderRadius: 8, color: '#111', boxSizing: 'border-box' as const }} /></div>
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                  <button onClick={() => setShowProduziModal(false)} style={{ flex: 1, padding: 10, border: '1px solid #d1d5db', borderRadius: 8, background: 'transparent', fontSize: 13, cursor: 'pointer', color: '#374151' }}>Odustani</button>
                  <button onClick={sacuvajProduzi} disabled={produziSaving || !produziDana || !produziCijena} style={{ flex: 2, padding: 10, background: produziSaving ? '#5DCAA5' : '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{produziSaving ? '...' : '✓ Produži rentu'}</button>
                </div>
              </>)
            })()}
          </div>
        </div>
      )}

      {/* UPLOAD MODAL */}
      {showUploadModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, maxWidth: 480, width: '100%' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700 }}>📎 Upload ugovora</h3>
            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>Unesite URL slike ugovora.</p>
            {uploadUrl && (<div style={{ marginBottom: 12 }}><a href={uploadUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: '#1D9E75', fontWeight: 600, textDecoration: 'none' }}>📄 Trenutni ugovor →</a></div>)}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>URL *</label>
              <input value={uploadUrl} onChange={e => setUploadUrl(e.target.value)} placeholder="https://drive.google.com/..." style={{ width: '100%', padding: '9px 12px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, color: '#111', boxSizing: 'border-box' as const }} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowUploadModal(false)} style={{ flex: 1, padding: 10, border: '1px solid #d1d5db', borderRadius: 8, background: 'transparent', fontSize: 13, cursor: 'pointer', color: '#374151' }}>Odustani</button>
              <button onClick={sacuvajUpload} disabled={uploadSaving || !uploadUrl.trim()} style={{ flex: 2, padding: 10, background: uploadSaving ? '#5DCAA5' : '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{uploadSaving ? '...' : '💾 Snimi'}</button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.7} }`}</style>
    </div>
  )
}
