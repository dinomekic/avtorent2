'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyunN3qJRFk-bydMWkEImsYoXdw-n-e7nln3aerDLGtc5gxXUmwkBPgCFMNzS7qBitpjg/exec'
const FOLDER_ID = '1gFiCAgolZu9fAn5d-Ngmsx9qp3hWdIkN'

const PERACI = ['anelnikaj0@gmail.com', 'rentacarplanetcg@gmail.com', 'bulatovicandrija123@gmail.com']

type Tab = 'unos' | 'ugovori' | 'prijava' | 'pranje' | 'vozilo' | 'saldo'

type Transakcija = {
  id: string
  tip_transakcije: string
  datum: string
  kategorija: string
  iznos: number
  vozilo: string
  komentar: string
  osoba: string
  osobaemail: string
  timestamp_upisa: string
  status: string
  primaocemail?: string
  slika1?: string
}

type Rezervacija = {
  id: number
  br_tablica: string
  ime_prezime: string
  od_datuma: string
  do_datuma: string
  ukupno_naplata: number
  naplaceno: number
  depozit: number
  depozit_uzet: boolean
  depozit_vracen: boolean
  vraceni_depozit_iznos: number
  ko_je_izdao: string
  ko_je_preuzeo: string
  ugovor_slika: string
  br_vozacke: string
  telefon: string
}

type Vozilo = {
  br_tablica: string
  agregirani_2: string
  marka: string
}

type KoriscenjeVozila = {
  id: string
  email: string
  ime_prezime: string
  tablice: string
  km_start: number
  km_end?: number
  predjena_km?: number
  destinacija: string
  status: string
  vreme_zaduzenja: string
  timestamp_upisa: string
}

type PranjeItem = {
  id: string
  datum_tekst: string
  agent: string
  email: string
  vozilo: string
  status: string
  naplaceno: string
  Kommentar?: string
}

type ProveraItem = {
  id: string
  datum: string
  tablice: string
  ulje: boolean
  antifriz: boolean
  tecnost_brisaci: boolean
  svetla: boolean
  klima: boolean
  brave: boolean
  enterijer: boolean
  komentar: string
  slike: string
  agent: string
}

function getCookie(name: string): string {
  if (typeof document === 'undefined') return ''
  const match = document.cookie.match(new RegExp(`${name}=([^;]+)`))
  return match ? decodeURIComponent(match[1]) : ''
}

function genId(): string {
  return Date.now().toString() + Math.random().toString(36).slice(2, 6)
}

function getDirectImg(url: string): string {
  if (!url || !url.includes('drive.google.com')) return url
  try {
    const id = url.includes('/d/') ? url.split('/d/')[1].split('/')[0] : url.split('id=')[1]
    return `https://lh3.googleusercontent.com/u/0/d/${id}`
  } catch { return url }
}

const KATEGORIJE_PRILIV = [
  'Izdavanje vozila', 'Naplata Duga', 'Depozit', 'Bonus', 'MOJ bonus',
  'MOJA dnevnica', 'Renta', 'Uplata duga prema FIRMI', 'Refundacija (u komentaru dodaj razlog)',
  'Neutralni novcani tokovi', 'PREUZETO IZ SANDUCETA', 'Prodaja vozila',
  'Provizija Ena', 'Razmjena novca', 'Razmjena novca medju nama', 'Ostalo',
]
const KATEGORIJE_ODLIV = [
  'Gorivo (dodaj sliku racuna)', 'Gorivo', 'Djelovi (dodaj sliku racuna)', 'Djelovi',
  'Servisiranje vozila', 'Servis', 'Registracija vozila (dodaj sliku racuna)',
  'Pranje', 'Pranje Planet', 'Parking (dodaj sliku racuna)', 'Parking',
  'Kazne i prekrsaji', 'Doplata za kazne (dodaj sliku kazne)', 'Doplata za oštetu',
  'Doplata za gorivo', 'Doplata za pranje', 'Povrat Depozita',
  'Provizije posrednicima', 'Provizije posrednicima (u komentaru dodaj kome)',
  'Putni troškovi (u komentaru dodaj destinaciju)', 'Putni troškovi', 'Taksi',
  'Kirija', 'Komunalije', 'Telekomunikacije', 'Kancelarijski materijal',
  'Plata', 'MOJA plata', 'Dnevnice drugi (u komentaru upisi osobu)',
  'Uplata duga za službeno vozilo', 'Rata za vozilo (dodaj sliku potvrde)',
  'Slepanje vozila', 'Marketing i oglasavanje', 'Osiguranje',
  'Transfer', 'Ostalo', 'OSTAVLJENO U SANDUCE', 'Neutralni novcani tok',
  'DUG PREMA FIRMI ( u komentaru upisi iznos preostalog duga)',
  'Pozajmica (u komenatru upisi preostali dug)', 'Razmjena novca',
]

export default function AgentPanelPage() {
  const [activeTab, setActiveTab] = useState<Tab>('unos')
  const [agentEmail, setAgentEmail] = useState('')
  const [agentIme, setAgentIme] = useState('')
  const [allTrans, setAllTrans] = useState<Transakcija[]>([])
  const [vozila, setVozila] = useState<Vozilo[]>([])
  const [kolege, setKolege] = useState<{ email: string; ime: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)

  // UNOS state
  const [tip, setTip] = useState<'priliv' | 'odliv'>('priliv')
  const [datum, setDatum] = useState(new Date().toISOString().split('T')[0])
  const [kategorija, setKategorija] = useState('')
  const [iznos, setIznos] = useState('')
  const [voziloUnos, setVoziloUnos] = useState('')
  const [komentar, setKomentar] = useState('')
  const [primaoc, setPrimaoc] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [uploadStatus, setUploadStatus] = useState('')
  const [unosSaving, setUnosSaving] = useState(false)

  // UGOVORI state
  const [ugovori, setUgovori] = useState<Rezervacija[]>([])
  const [ugovoriLoading, setUgovoriLoading] = useState(false)
  const [currentUgovorId, setCurrentUgovorId] = useState<number | null>(null)
  const [ugovorUploading, setUgovorUploading] = useState(false)

  // PRIJAVA state
  const [prijavaVozilo, setPrijavaVozilo] = useState('')
  const [prijavaPokazano, setPrijavaPokazano] = useState(false)
  const [checkUlje, setCheckUlje] = useState(false)
  const [checkAntifriz, setCheckAntifriz] = useState(false)
  const [checkBrisaci, setCheckBrisaci] = useState(false)
  const [checkSvetla, setCheckSvetla] = useState(false)
  const [checkKlima, setCheckKlima] = useState(false)
  const [checkBrave, setCheckBrave] = useState(false)
  const [checkEnterijer, setCheckEnterijer] = useState(false)
  const [prijavaKomentar, setPrijavaKomentar] = useState('')
  const [prijavaSlike, setPrijavaSlike] = useState<string[]>([])
  const [prijavaUploadProgress, setPrijavaUploadProgress] = useState(0)
  const [prijavaUploadInfo, setPrijavaUploadInfo] = useState('SLIKE NISU DODATE')
  const [provjere, setProovjere] = useState<ProveraItem[]>([])
  const [prijavaSaving, setPrijavaSaving] = useState(false)
  const [showSveProvjere, setShowSveProvjere] = useState(false)
  const [pretragaVozilo, setPretragaVozilo] = useState('')
  const [pretragaAgent, setPretragaAgent] = useState('')

  // PRANJE state
  const [pranjeVozilo, setPranjeVozilo] = useState('')
  const [pranjeNaplaceno, setPranjeNaplaceno] = useState<'DA' | 'NE'>('DA')
  const [pranjeRazlog, setPranjeRazlog] = useState('')
  const [pranja, setPranja] = useState<PranjeItem[]>([])
  const [pranjeSaving, setPranjeSaving] = useState(false)

  // VOZILO (privatno) state
  const [koriscenje, setKoriscenje] = useState<KoriscenjeVozila[]>([])
  const [aktivnoKoriscenje, setAktivnoKoriscenje] = useState<KoriscenjeVozila | null>(null)
  const [privatnoVozilo, setPrivatnoVozilo] = useState('')
  const [kmStart, setKmStart] = useState('')
  const [privatnoDest, setPrivatnoDest] = useState('')
  const [kmEnd, setKmEnd] = useState('')
  const [vozileSaving, setVozileSaving] = useState(false)

  // SALDO state
  const [saldo, setSaldo] = useState(0)
  const [firmaDug, setFirmaDug] = useState(0)
  const [kmDug, setKmDug] = useState(0)
  const [prikazTransakcija, setPrikazTransakcija] = useState<Transakcija[]>([])
  const [pendingTrans, setPendingTrans] = useState<Transakcija[]>([])

  useEffect(() => {
    const email = getCookie('avtorent-agent-name')
    const ime = getCookie('avtorent-agent-name')
    // Cookie čuva ime agenta
    const agIme = getCookie('avtorent-agent-name')
    setAgentIme(agIme)

    // Dohvati email iz supabase sesije
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email) {
        setAgentEmail(session.user.email)
        loadAll(session.user.email, agIme)
      } else {
        window.location.href = '/admin/login'
      }
    })
  }, [])

  const loadAll = useCallback(async (email: string, ime: string) => {
    setLoading(true)

    // Transakcije
    let trans: Transakcija[] = []
    let from = 0
    let hasMore = true
    while (hasMore) {
      const { data } = await supabase.from('transakcije').select('*').range(from, from + 999)
      if (data && data.length > 0) { trans = [...trans, ...data]; from += 1000; if (data.length < 1000) hasMore = false }
      else hasMore = false
    }
    trans.sort((a, b) => new Date(b.timestamp_upisa || 0).getTime() - new Date(a.timestamp_upisa || 0).getTime())
    setAllTrans(trans)

    // Vozila
    const { data: v } = await supabase.from('vozila').select('br_tablica, agregirani_2, marka').order('agregirani_2')
    setVozila(v || [])

    // Agenti (kolege)
    const { data: agents } = await supabase.from('agents').select('email, full_name').eq('is_active', true)
    setKolege((agents || []).filter(a => a.email !== email).map(a => ({ email: a.email, ime: a.full_name })))

    // Izračunaj saldo
    izracunajSaldo(trans, email)

    // Pranja
    const { data: pr } = await supabase.from('pranje').select('*').eq('status', 'Na čekanju').order('vrijeme_upisa', { ascending: false })
    setPranja(pr || [])

    // Korišćenje vozila
    const { data: km } = await supabase.from('koristenje').select('*').order('timestamp_upisa', { ascending: false })
    const svaKor = km || []
    const aktKor = svaKor.find(k => k.email?.toLowerCase() === email && k.status === 'Aktivno')
    setKoriscenje(svaKor.filter(k => k.email?.toLowerCase() === email))
    setAktivnoKoriscenje(aktKor || null)

    // Izračunaj km dug
    let totalPredjeno = 0
    let uKm = 0
    svaKor.forEach(k => { if (k.email?.toLowerCase() === email && k.status !== 'Aktivno') totalPredjeno += parseFloat(k.predjena_km || 0) })
    trans.forEach(t => { if (t.osobaemail?.toLowerCase() === email && t.kategorija?.toLowerCase().includes('uplat') && t.kategorija?.toLowerCase().includes('vozilo')) uKm += Math.abs(parseFloat(t.iznos as any || 0)) })
    setKmDug(((totalPredjeno / 100) * 1.44 * 8) - uKm)

    setLoading(false)

    // Pending potvrde
    const pending = trans.filter(t => (t.status || '').toLowerCase() === 'na cekanju' && t.primaocemail?.toLowerCase() === email)
    setPendingTrans(pending)
    setPendingCount(pending.length)
  }, [])

  function izracunajSaldo(trans: Transakcija[], email: string) {
    let s = 0, df = 0
    const prikazano: Transakcija[] = []
    trans.forEach(t => {
      const iz = parseFloat(t.iznos as any || 0)
      const kat = (t.kategorija || '').toLowerCase()
      const sE = (t.osobaemail || '').toLowerCase().trim()
      const pE = (t.primaocemail || '').toLowerCase().trim()
      const status = (t.status || 'Zavrseno').toLowerCase()

      if (status === 'zavrseno') {
        if (sE === email) {
          if (kat.includes('dug prema firmi')) df += Math.abs(iz)
          else if (kat.includes('uplata duga prema firmi')) df -= Math.abs(iz)
          else s += iz
        }
        if (pE === email) s -= iz
      }

      if ((sE === email || pE === email) && prikazano.length < 30) prikazano.push(t)
    })
    setSaldo(s)
    setFirmaDug(df)
    setPrikazTransakcija(prikazano)
  }

  // ─── UPLOAD SLIKE ─────────────────────────────────────────
  async function uploadSlika(file: File, naziv: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1]
        try {
          const res = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ base64, contentType: file.type, name: naziv, folderId: FOLDER_ID })
          }).then(r => r.json())
          if (res.status === 'success') resolve(res.url)
          else reject(new Error('Upload failed'))
        } catch (e) { reject(e) }
      }
    })
  }

  async function handleFotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadStatus('⏳ Uploadujem...')
    try {
      const url = await uploadSlika(file, `RACUN_${Date.now()}`)
      setPhotoUrl(url)
      setUploadStatus('✅ Slika dodana')
    } catch { setUploadStatus('❌ Greška pri uploadu') }
  }

  async function handleMultiUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files?.length) return
    setPrijavaUploadInfo('⏳ Uploadujem...')
    setPrijavaUploadProgress(0)
    const urls: string[] = []
    for (let i = 0; i < files.length; i++) {
      try {
        const url = await uploadSlika(files[i], `AUTO_${Date.now()}_${i}`)
        urls.push(url)
      } catch { }
      setPrijavaUploadProgress(Math.round(((i + 1) / files.length) * 100))
    }
    setPrijavaSlike(urls)
    setPrijavaUploadInfo(`✅ DODATO ${urls.length} slika`)
    setTimeout(() => setPrijavaUploadProgress(0), 2000)
  }

  async function handleUgovorUpload(e: React.ChangeEvent<HTMLInputElement>, rezId: number) {
    const file = e.target.files?.[0]
    if (!file || !rezId) return
    setUgovorUploading(true)
    try {
      const url = await uploadSlika(file, `UGOVOR_${rezId}`)
      await supabase.from('rezervacije').update({ ugovor_slika: url }).eq('id', rezId)
      await supabase.from('logovi').insert([{ akcija: `Upload ugovora za REZ #${rezId} od agenta ${agentIme}` }])
      loadUgovori()
    } catch { alert('Greška pri uploadu ugovora') }
    setUgovorUploading(false)
    e.target.value = ''
  }

  // ─── UNOS TRANSAKCIJE ────────────────────────────────────
  async function saveTransakcija() {
    const izVal = parseFloat(iznos)
    if (!izVal || !kategorija) { alert('Unesite iznos i kategoriju!'); return }
    setUnosSaving(true)

    const jeRazmjena = kategorija.toLowerCase().includes('razmjena') && primaoc
    const payload: any = {
      id: genId(),
      tip_transakcije: tip,
      datum,
      kategorija,
      iznos: tip === 'priliv' ? Math.abs(izVal) : -Math.abs(izVal),
      vozilo: voziloUnos || 'OPŠTE',
      komentar: komentar + (photoUrl ? ' ' + photoUrl : ''),
      osoba: agentIme,
      osobaemail: agentEmail,
      timestamp_upisa: new Date().toISOString(),
      status: jeRazmjena ? 'na cekanju' : 'Zavrseno',
      primaocemail: jeRazmjena ? primaoc : null,
      provereno: false,
      provera_status: 'pending',
      v_status: 'pending',
    }

    await supabase.from('transakcije').insert([payload])

    // Reset
    setIznos(''); setKomentar(''); setVoziloUnos(''); setPhotoUrl('')
    setUploadStatus(''); setPrimaoc(''); setUnosSaving(false)
    alert('Upisano!')
    loadAll(agentEmail, agentIme)
  }

  // ─── UGOVORI ─────────────────────────────────────────────
  const loadUgovori = useCallback(async () => {
    setUgovoriLoading(true)
    const imeBezKvacica = agentIme.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const { data } = await supabase.from('rezervacije').select('*')
      .or(`ko_je_izdao.eq.${imeBezKvacica},ko_je_preuzeo.eq.${imeBezKvacica}`)
      .order('id', { ascending: false }).limit(100)
    setUgovori(data || [])
    setUgovoriLoading(false)
  }, [agentIme])

  useEffect(() => {
    if (activeTab === 'ugovori' && agentIme) loadUgovori()
  }, [activeTab, agentIme, loadUgovori])

  function getUgovorStatus(u: Rezervacija) {
    const imeBezKvacica = agentIme.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const isIzdao = u.ko_je_izdao === imeBezKvacica
    const isPreuzeo = u.ko_je_preuzeo === imeBezKvacica
    const fazaReturn = !!u.ko_je_preuzeo

    const naplacenoNajam = u.naplaceno || 0
    const ukupno = u.ukupno_naplata || 0
    const depozit = u.depozit || 0
    const vracenDep = u.vraceni_depozit_iznos || 0
    const preostaliDug = Math.max(0, ukupno - naplacenoNajam)

    // Provjeri transakcije
    const uTrans = allTrans.filter(t => t.komentar?.includes(`REZ #${u.id}`))
    const upisanNajam = uTrans.filter(t => t.tip_transakcije === 'priliv' && (t.kategorija === 'Izdavanje vozila' || t.kategorija === 'Naplata Duga')).reduce((s, t) => s + Math.abs(parseFloat(t.iznos as any || 0)), 0)
    const depozitUzetUKasi = uTrans.some(t => t.tip_transakcije === 'priliv' && t.kategorija === 'Depozit')
    const depozitVracenIzKase = uTrans.some(t => t.tip_transakcije === 'odliv' && t.kategorija === 'Povrat Depozita')

    const novacKojiFali = Math.max(0, naplacenoNajam - upisanNajam)

    return {
      isIzdao, isPreuzeo, fazaReturn, preostaliDug, depozit, vracenDep,
      novacKojiFali, depozitUzetUKasi, depozitVracenIzKase,
      trebaSlika: !u.ugovor_slika && isIzdao,
      trebaPocetnoNajam: novacKojiFali > 0.01 && !fazaReturn && isIzdao,
      trebaPocetnoDepozit: u.depozit_uzet && !depozitUzetUKasi && isIzdao,
      trebaDug: novacKojiFali > 0.01 && fazaReturn && isPreuzeo,
      trebaDepozitPovrat: u.depozit_vracen && vracenDep > 0 && !depozitVracenIzKase && isPreuzeo,
    }
  }

  async function zavediNajamUKasu(u: Rezervacija, iznos: number, preostaliDug: number) {
    if (!confirm(`Da li želiš da zadužiš ${iznos}€ u kasu za vozilo ${u.br_tablica}?`)) return
    let kom = `Početna naplata pri izdavanju (Ugovor REZ #${u.id}).`
    if (preostaliDug > 0.01) kom += ` Preostali dug klijenta: ${preostaliDug.toFixed(2)}€`
    else kom += ` Ugovor je u potpunosti isplaćen.`

    await supabase.from('transakcije').insert([{
      id: genId(), tip_transakcije: 'priliv', datum: new Date().toISOString().split('T')[0],
      kategorija: 'Izdavanje vozila', iznos, vozilo: u.br_tablica,
      komentar: kom, osoba: agentIme, osobaemail: agentEmail,
      timestamp_upisa: new Date().toISOString(), status: 'Zavrseno',
      provereno: false, provera_status: 'pending', v_status: 'pending',
    }])
    alert('Zaduženo!'); loadAll(agentEmail, agentIme); loadUgovori()
  }

  async function zavediDepozitUKasu(u: Rezervacija, iznos: number) {
    if (!confirm(`Da li želiš da zadužiš depozit od ${iznos}€ u kasu?`)) return
    await supabase.from('transakcije').insert([{
      id: genId(), tip_transakcije: 'priliv', datum: new Date().toISOString().split('T')[0],
      kategorija: 'Depozit', iznos, vozilo: u.br_tablica,
      komentar: `Uzet depozit pri izdavanju (Ugovor REZ #${u.id})`,
      osoba: agentIme, osobaemail: agentEmail,
      timestamp_upisa: new Date().toISOString(), status: 'Zavrseno',
      provereno: false, provera_status: 'pending', v_status: 'pending',
    }])
    alert('Depozit zadužen!'); loadAll(agentEmail, agentIme); loadUgovori()
  }

  async function zavediNajamIDepozit(u: Rezervacija, najam: number, dep: number, preostaliDug: number) {
    if (!confirm(`Da li želiš da zadužiš NAJAM (${najam}€) i DEPOZIT (${dep}€) u kasu?`)) return
    let kom = `Početna naplata pri izdavanju (Ugovor REZ #${u.id}).`
    if (preostaliDug > 0.01) kom += ` Preostali dug klijenta: ${preostaliDug.toFixed(2)}€`
    else kom += ` Ugovor je u potpunosti isplaćen.`

    await supabase.from('transakcije').insert([
      { id: genId() + '1', tip_transakcije: 'priliv', datum: new Date().toISOString().split('T')[0], kategorija: 'Izdavanje vozila', iznos: najam, vozilo: u.br_tablica, komentar: kom, osoba: agentIme, osobaemail: agentEmail, timestamp_upisa: new Date().toISOString(), status: 'Zavrseno', provereno: false, provera_status: 'pending', v_status: 'pending' },
      { id: genId() + '2', tip_transakcije: 'priliv', datum: new Date().toISOString().split('T')[0], kategorija: 'Depozit', iznos: dep, vozilo: u.br_tablica, komentar: `Uzet depozit pri izdavanju (Ugovor REZ #${u.id})`, osoba: agentIme, osobaemail: agentEmail, timestamp_upisa: new Date().toISOString(), status: 'Zavrseno', provereno: false, provera_status: 'pending', v_status: 'pending' },
    ])
    alert('Sve uspješno zaduženo!'); loadAll(agentEmail, agentIme); loadUgovori()
  }

  async function zavediDugUKasu(u: Rezervacija, iznos: number, preostaliDug: number) {
    if (!confirm(`Da li želiš da zadužiš naknadnu uplatu od ${iznos}€ u kasu?`)) return
    let kom = `Naplata duga pri preuzimanju (Ugovor REZ #${u.id}).`
    if (preostaliDug > 0.01) kom += ` Preostali dug klijenta: ${preostaliDug.toFixed(2)}€`
    else kom += ` Ugovor je u potpunosti isplaćen.`

    await supabase.from('transakcije').insert([{
      id: genId(), tip_transakcije: 'priliv', datum: new Date().toISOString().split('T')[0],
      kategorija: 'Naplata Duga', iznos, vozilo: u.br_tablica, komentar: kom,
      osoba: agentIme, osobaemail: agentEmail, timestamp_upisa: new Date().toISOString(),
      status: 'Zavrseno', provereno: false, provera_status: 'pending', v_status: 'pending',
    }])
    alert('Naplata zavedena!'); loadAll(agentEmail, agentIme); loadUgovori()
  }

  async function zavediPovratDepozita(u: Rezervacija, iznos: number) {
    if (!confirm(`Da li potvrđuješ da iz kase RAZDUŽUJEŠ ${iznos}€ za povrat depozita klijentu?`)) return
    await supabase.from('transakcije').insert([{
      id: genId(), tip_transakcije: 'odliv', datum: new Date().toISOString().split('T')[0],
      kategorija: 'Povrat Depozita', iznos: -Math.abs(iznos), vozilo: u.br_tablica,
      komentar: `Vraćen depozit pri preuzimanju (Ugovor REZ #${u.id})`,
      osoba: agentIme, osobaemail: agentEmail, timestamp_upisa: new Date().toISOString(),
      status: 'Zavrseno', provereno: false, provera_status: 'pending', v_status: 'pending',
    }])
    alert('Povrat depozita razdužen iz kase!'); loadAll(agentEmail, agentIme); loadUgovori()
  }

  // ─── PRIJAVA VOZILA ──────────────────────────────────────
  async function savePrijava() {
    if (!prijavaVozilo) { alert('Unesite tablice!'); return }
    setPrijavaSaving(true)
    await supabase.from('provere').insert([{
      id: genId(), datum: new Date().toLocaleString('sr-RS'),
      tablice: prijavaVozilo.toUpperCase(),
      ulje: checkUlje, antifriz: checkAntifriz, tecnost_brisaci: checkBrisaci,
      svetla: checkSvetla, klima: checkKlima, brave: checkBrave, enterijer: checkEnterijer,
      komentar: prijavaKomentar, slike: prijavaSlike.join(' '),
      agent: agentIme, vreme_upisa: new Date().toISOString(),
    }])
    // Reset
    setPrijavaVozilo(''); setPrijavaPokazano(false)
    setCheckUlje(false); setCheckAntifriz(false); setCheckBrisaci(false)
    setCheckSvetla(false); setCheckKlima(false); setCheckBrave(false); setCheckEnterijer(false)
    setPrijavaKomentar(''); setPrijavaSlike([]); setPrijavaUploadInfo('SLIKE NISU DODATE')
    setPrijavaSaving(false)
    alert('Provjera upisana!')
  }

  async function loadProvjere(all: boolean) {
    let q = supabase.from('provere').select('*').order('vreme_upisa', { ascending: false })
    if (all) {
      if (pretragaVozilo) q = q.ilike('tablice', `%${pretragaVozilo}%`)
      if (pretragaAgent) q = q.ilike('agent', `%${pretragaAgent}%`)
      q = q.limit(30)
    } else {
      q = q.ilike('tablice', `%${prijavaVozilo}%`)
    }
    const { data } = await q
    setProovjere(data || [])
  }

  useEffect(() => {
    if (prijavaVozilo.length > 2) { setPrijavaPokazano(true); loadProvjere(false) }
  }, [prijavaVozilo])

  useEffect(() => {
    if (showSveProvjere) loadProvjere(true)
  }, [showSveProvjere, pretragaVozilo, pretragaAgent])

  // ─── PRANJE ──────────────────────────────────────────────
  async function savePranje() {
    if (!pranjeVozilo) { alert('Unesite vozilo!'); return }
    setPranjeSaving(true)
    await supabase.from('pranje').insert([{
      id: genId(), datum_tekst: new Date().toLocaleString('sr-RS'),
      agent: agentIme, email: agentEmail, vozilo: pranjeVozilo.toUpperCase(),
      status: 'Na čekanju', naplaceno: pranjeNaplaceno,
      Kommentar: pranjeNaplaceno === 'NE' ? pranjeRazlog : '',
      vrijeme_upisa: new Date().toISOString(),
    }])
    setPranjeVozilo(''); setPranjeRazlog(''); setPranjeSaving(false)
    loadAll(agentEmail, agentIme); alert('Poslano na pranje!')
  }

  async function completePranje(id: string, vozilo: string) {
    await supabase.from('pranje').update({ status: 'ZAVRŠENO' }).eq('id', id)
    await supabase.from('transakcije').insert([{
      id: genId(), tip_transakcije: 'odliv', datum: new Date().toISOString().split('T')[0],
      kategorija: 'Pranje Planet', iznos: -5, vozilo,
      osoba: agentIme, osobaemail: agentEmail,
      timestamp_upisa: new Date().toISOString(), status: 'Zavrseno',
      provereno: false, provera_status: 'pending', v_status: 'pending',
    }])
    loadAll(agentEmail, agentIme)
  }

  async function agentPrao(id: string, vozilo: string) {
    const izStr = window.prompt('Iznos pranja (€)?')
    if (!izStr) return
    await supabase.from('pranje').update({ status: 'ZAVRŠENO' }).eq('id', id)
    await supabase.from('transakcije').insert([{
      id: genId(), tip_transakcije: 'odliv', datum: new Date().toISOString().split('T')[0],
      kategorija: 'PRANJE', iznos: -Math.abs(parseFloat(izStr)),
      vozilo, osoba: agentIme, osobaemail: agentEmail,
      timestamp_upisa: new Date().toISOString(), status: 'Zavrseno',
      provereno: false, provera_status: 'pending', v_status: 'pending',
    }])
    loadAll(agentEmail, agentIme)
  }

  // ─── PRIVATNO VOZILO ─────────────────────────────────────
  async function startPrivate() {
    if (!privatnoVozilo || !kmStart) { alert('Unesite vozilo i KM!'); return }
    setVozileSaving(true)
    await supabase.from('koristenje').insert([{
      id: genId(), email: agentEmail, ime_prezime: agentIme,
      tablice: privatnoVozilo.toUpperCase(), km_start: parseFloat(kmStart),
      destinacija: privatnoDest, status: 'Aktivno',
      vreme_zaduzenja: new Date().toLocaleString('sr-RS'),
      timestamp_upisa: new Date().toISOString(),
    }])
    setPrivatnoVozilo(''); setKmStart(''); setPrivatnoDest('')
    setVozileSaving(false)
    loadAll(agentEmail, agentIme)
  }

  async function finishPrivate(id: string, kmS: number) {
    if (!kmEnd) { alert('Unesite krajnje KM!'); return }
    const km_end = parseFloat(kmEnd)
    await supabase.from('koristenje').update({
      km_end, predjena_km: km_end - kmS, status: 'Završeno'
    }).eq('id', id)
    setKmEnd('')
    loadAll(agentEmail, agentIme)
  }

  // ─── POTVRDI RAZMJENU ────────────────────────────────────
  async function confirmTrans(id: string) {
    await supabase.from('transakcije').update({ status: 'Zavrseno' }).eq('id', id)
    loadAll(agentEmail, agentIme)
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
        <div style={{ textAlign: 'center', color: '#6b7280' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
          <div>Učitavanje...</div>
        </div>
      </div>
    )
  }

  const needsPhoto = ['Gorivo (dodaj sliku racuna)', 'Gorivo', 'Djelovi (dodaj sliku racuna)', 'Registracija vozila (dodaj sliku racuna)', 'Rata za vozilo (dodaj sliku potvrde)', 'Parking (dodaj sliku racuna)', 'Doplata za kazne (dodaj sliku kazne)'].includes(kategorija)
  const isRazmjena = kategorija.toLowerCase().includes('razmjena')
  const katOptions = tip === 'priliv' ? KATEGORIJE_PRILIV : KATEGORIJE_ODLIV

  const inp: React.CSSProperties = { width: '100%', padding: '12px 14px', fontSize: 14, border: '1px solid #e2e8f0', borderRadius: 12, background: '#fff', color: '#0f172a', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' }
  const card: React.CSSProperties = { background: '#fff', borderRadius: 20, padding: 20, marginBottom: 14, border: '1px solid #f1f5f9', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }
  const btn: React.CSSProperties = { width: '100%', padding: '16px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 14, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }

  // Ugovori kategorije
  const cekanjuUgovori = ugovori.filter(u => { const s = getUgovorStatus(u); return s.trebaSlika || s.trebaPocetnoNajam || s.trebaPocetnoDepozit })
  const dugDepUgovori = ugovori.filter(u => { const s = getUgovorStatus(u); return s.trebaDug || s.trebaDepozitPovrat })
  const zavrsenoUgovori = ugovori.filter(u => { const s = getUgovorStatus(u); return !s.trebaSlika && !s.trebaPocetnoNajam && !s.trebaPocetnoDepozit && !s.trebaDug && !s.trebaDepozitPovrat })

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', paddingBottom: 120, fontFamily: 'Inter, sans-serif' }}>

      {/* HEADER */}
      <div style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)', padding: '32px 16px 60px', textAlign: 'center', position: 'relative' }}>
        <img src="https://planetrentacar.me/wp-content/uploads/2023/03/logo-1.png" style={{ width: 120, filter: 'brightness(0) invert(1)', marginBottom: 8 }} alt="Planet" />
        <div style={{ fontSize: 10, letterSpacing: 4, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', marginBottom: 8 }}>OPERATIVNI SISTEM</div>
        <button onClick={() => { supabase.auth.signOut(); window.location.href = '/admin/login' }}
          style={{ position: 'absolute', right: 16, top: 16, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', padding: '6px 12px', borderRadius: 20, fontSize: 11, cursor: 'pointer' }}>
          Odjava
        </button>
      </div>

      {/* SALDO CARD */}
      <div style={{ maxWidth: 500, margin: '-40px auto 0', padding: '0 16px' }}>
        <div style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)', borderRadius: 24, padding: '20px 24px', marginBottom: 16, color: '#fff', boxShadow: '0 10px 30px rgba(99,102,241,0.3)', border: '1px solid rgba(255,255,255,0.2)' }}>
          <div style={{ fontSize: 11, opacity: 0.8, marginBottom: 4 }}>MOJ SALDO</div>
          <div style={{ fontSize: 42, fontWeight: 900, letterSpacing: -1 }}>{saldo.toFixed(2)} €</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <div style={{ background: 'rgba(255,255,255,0.12)', padding: '6px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
              Dug KM: {kmDug.toFixed(2)}€
            </div>
            <div style={{ background: 'rgba(255,255,255,0.12)', padding: '6px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, color: '#fbbf24' }}>
              Firma: {firmaDug.toFixed(2)}€
            </div>
          </div>
        </div>

        {/* TABS CONTENT */}
        {activeTab === 'unos' && (
          <div>
            <div style={card}>
              {/* TIP */}
              <div style={{ display: 'flex', background: '#f1f5f9', padding: 4, borderRadius: 14, marginBottom: 14 }}>
                <button onClick={() => { setTip('priliv'); setKategorija('') }}
                  style={{ flex: 1, padding: '11px', border: 'none', borderRadius: 11, fontWeight: 700, cursor: 'pointer', background: tip === 'priliv' ? '#10b981' : 'transparent', color: tip === 'priliv' ? '#fff' : '#64748b', fontSize: 13 }}>
                  PRILIV
                </button>
                <button onClick={() => { setTip('odliv'); setKategorija('') }}
                  style={{ flex: 1, padding: '11px', border: 'none', borderRadius: 11, fontWeight: 700, cursor: 'pointer', background: tip === 'odliv' ? '#f43f5e' : 'transparent', color: tip === 'odliv' ? '#fff' : '#64748b', fontSize: 13 }}>
                  ODLIV
                </button>
              </div>

              <input type="date" value={datum} onChange={e => setDatum(e.target.value)} style={{ ...inp, marginBottom: 10, fontWeight: 700 }} />

              <select value={kategorija} onChange={e => setKategorija(e.target.value)} style={{ ...inp, marginBottom: 10 }}>
                <option value="">-- Odaberi kategoriju --</option>
                {katOptions.map(k => <option key={k} value={k}>{k}</option>)}
              </select>

              {isRazmjena && (
                <select value={primaoc} onChange={e => setPrimaoc(e.target.value)} style={{ ...inp, marginBottom: 10 }}>
                  <option value="">→ Izaberi kolegu...</option>
                  {kolege.map(k => <option key={k.email} value={k.email}>{k.ime.toUpperCase()}</option>)}
                </select>
              )}

              <input list="voz-list" value={voziloUnos} onChange={e => setVoziloUnos(e.target.value)} placeholder="Vozilo (opciono)..." style={{ ...inp, marginBottom: 10 }} />
              <datalist id="voz-list">{vozila.map(v => <option key={v.br_tablica} value={v.br_tablica}>{v.agregirani_2}</option>)}</datalist>

              <input type="number" step="0.01" value={iznos} onChange={e => setIznos(e.target.value)} placeholder="0.00 EUR" style={{ ...inp, marginBottom: 10, fontSize: 18, fontWeight: 700 }} />

              {/* FOTO UPLOAD */}
              {needsPhoto && (
                <div style={{ border: '2px dashed #6366f1', borderRadius: 14, padding: 16, marginBottom: 10, background: 'rgba(99,102,241,0.04)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#6366f1', textAlign: 'center', marginBottom: 10 }}>OBAVEZNA SLIKA RAČUNA</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <label style={{ flex: 1, background: 'rgba(99,102,241,0.08)', border: '1px dashed #6366f1', padding: 12, borderRadius: 12, textAlign: 'center', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#6366f1' }}>
                      📷 SLIKAJ
                      <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFotoUpload} />
                    </label>
                    <label style={{ flex: 1, background: 'rgba(99,102,241,0.08)', border: '1px dashed #6366f1', padding: 12, borderRadius: 12, textAlign: 'center', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#6366f1' }}>
                      🖼️ DODAJ
                      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFotoUpload} />
                    </label>
                  </div>
                  {uploadStatus && <div style={{ textAlign: 'center', fontSize: 12, marginTop: 8, fontWeight: 700, color: uploadStatus.includes('✅') ? '#10b981' : '#6366f1' }}>{uploadStatus}</div>}
                </div>
              )}

              <textarea value={komentar} onChange={e => setKomentar(e.target.value)} rows={2} placeholder="Napomena..." style={{ ...inp, resize: 'vertical', marginBottom: 14 }} />

              <button onClick={saveTransakcija} disabled={unosSaving} style={{ ...btn, background: unosSaving ? '#a5b4fc' : '#6366f1' }}>
                {unosSaving ? '⏳ ČEKAJ...' : 'POTVRDI UPIS'}
              </button>
            </div>

            {/* POTVRDE (pending razmjene) */}
            {pendingTrans.length > 0 && (
              <div style={card}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#f43f5e', marginBottom: 12 }}>🔔 POTVRDE RAZMJENE ({pendingTrans.length})</div>
                {pendingTrans.map(t => (
                  <div key={t.id} style={{ background: '#f8fafc', borderRadius: 12, padding: 14, marginBottom: 8, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                      Primio si {Math.abs(parseFloat(t.iznos as any))}€ od <strong>{t.osoba}</strong>
                    </div>
                    <button onClick={() => confirmTrans(t.id)} style={{ ...btn, padding: '10px', fontSize: 13, background: '#10b981' }}>
                      POTVRDI
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'ugovori' && (
          <div>
            {ugovoriLoading ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Učitavanje ugovora...</div>
            ) : (
              <>
                {/* ČEKAJU AKCIJU */}
                <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textAlign: 'center', letterSpacing: 1, marginBottom: 10, textTransform: 'uppercase' }}>
                  Čekaju slikanje ili početnu naplatu
                </div>
                {cekanjuUgovori.length === 0 ? (
                  <div style={{ textAlign: 'center', fontSize: 13, color: '#94a3b8', marginBottom: 20 }}>Sve je uslikano i zaduženo.</div>
                ) : cekanjuUgovori.map(u => {
                  const s = getUgovorStatus(u)
                  return (
                    <div key={u.id} style={{ ...card, borderLeft: '5px solid #f59e0b' }}>
                      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{u.br_tablica} — {u.ime_prezime}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>REZ #{u.id} | {u.od_datuma} → {u.do_datuma}</div>
                      <div style={{ fontSize: 12, color: '#6366f1', marginBottom: 10 }}>
                        Naplaćeno: {u.naplaceno}€ | Duguje: {Math.max(0, (u.ukupno_naplata || 0) - (u.naplaceno || 0))}€
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {/* Slika ugovora */}
                        {s.trebaSlika ? (
                          <label style={{ background: '#6366f1', color: '#fff', padding: '10px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', textAlign: 'center' }}>
                            📸 SLIKAJ UGOVOR
                            <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
                              onChange={e => { if (e.target.files?.[0]) handleUgovorUpload(e, u.id); setCurrentUgovorId(u.id) }} />
                          </label>
                        ) : (
                          <a href={u.ugovor_slika} target="_blank" rel="noopener noreferrer"
                            style={{ background: '#10b981', color: '#fff', padding: '10px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700, textAlign: 'center', textDecoration: 'none', display: 'block' }}>
                            ✅ POGLEDAJ UGOVOR
                          </a>
                        )}

                        {/* Zaduži sve zajedno */}
                        {s.trebaPocetnoNajam && s.trebaPocetnoDepozit && (
                          <button onClick={() => zavediNajamIDepozit(u, s.novacKojiFali, s.depozit, s.preostaliDug)}
                            style={{ background: '#4338ca', color: '#fff', padding: '10px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
                            ✅ ZADUŽI SVE ({s.novacKojiFali}€ + Dep {s.depozit}€)
                          </button>
                        )}

                        {/* Zaduži samo najam */}
                        {s.trebaPocetnoNajam && !s.trebaPocetnoDepozit && (
                          <button onClick={() => zavediNajamUKasu(u, s.novacKojiFali, s.preostaliDug)}
                            style={{ background: '#f43f5e', color: '#fff', padding: '10px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
                            💰 KASA NAJAM: {s.novacKojiFali}€
                          </button>
                        )}

                        {/* Zaduži samo depozit */}
                        {s.trebaPocetnoDepozit && !s.trebaPocetnoNajam && (
                          <button onClick={() => zavediDepozitUKasu(u, s.depozit)}
                            style={{ background: '#8b5cf6', color: '#fff', padding: '10px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
                            🛡️ KASA DEPOZIT: {s.depozit}€
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}

                {/* DUG I DEPOZIT (preuzimanje) */}
                {dugDepUgovori.length > 0 && (
                  <>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textAlign: 'center', letterSpacing: 1, margin: '20px 0 10px', textTransform: 'uppercase' }}>
                      Naplata duga i povrat depozita
                    </div>
                    {dugDepUgovori.map(u => {
                      const s = getUgovorStatus(u)
                      return (
                        <div key={u.id} style={{ ...card, borderLeft: '5px solid #f43f5e' }}>
                          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{u.br_tablica} — {u.ime_prezime}</div>
                          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>REZ #{u.id} | ZAVRŠENO PREUZIMANJE</div>
                          <div style={{ fontSize: 12, color: '#f43f5e', marginBottom: 10 }}>FALI U KASI: {s.novacKojiFali}€</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {s.trebaDug && (
                              <button onClick={() => zavediDugUKasu(u, s.novacKojiFali, s.preostaliDug)}
                                style={{ background: '#f43f5e', color: '#fff', padding: '10px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
                                💰 U KASU NAPLATA: {s.novacKojiFali}€
                              </button>
                            )}
                            {s.trebaDepozitPovrat && (
                              <button onClick={() => zavediPovratDepozita(u, s.vracenDep)}
                                style={{ background: '#f59e0b', color: '#000', padding: '10px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
                                🛡️ U KASU POVRAT: -{s.vracenDep}€
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </>
                )}

                {/* ISTORIJA */}
                {zavrsenoUgovori.length > 0 && (
                  <>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textAlign: 'center', letterSpacing: 1, margin: '20px 0 10px', textTransform: 'uppercase' }}>
                      Istorija završenih ugovora
                    </div>
                    {zavrsenoUgovori.slice(0, 10).map(u => (
                      <div key={u.id} style={{ ...card, borderLeft: '5px solid #10b981' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 14 }}>{u.br_tablica} — {u.ime_prezime}</div>
                            <div style={{ fontSize: 11, color: '#94a3b8' }}>REZ #{u.id} | SVE ZAVRŠENO</div>
                          </div>
                          {u.ugovor_slika && (
                            <a href={u.ugovor_slika} target="_blank" rel="noopener noreferrer"
                              style={{ background: '#10b981', color: '#fff', padding: '8px 12px', borderRadius: 10, fontSize: 11, fontWeight: 700, textDecoration: 'none' }}>
                              ✅ POGLEDAJ
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'prijava' && (
          <div>
            <div style={card}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <input list="voz-list2" value={prijavaVozilo} onChange={e => setPrijavaVozilo(e.target.value)} placeholder="Ukucaj tablice..." style={{ ...inp, flex: 1 }} />
                <datalist id="voz-list2">{vozila.map(v => <option key={v.br_tablica} value={v.br_tablica}>{v.agregirani_2}</option>)}</datalist>
                <button onClick={() => { setPrijavaVozilo(''); setPrijavaPokazano(false) }}
                  style={{ width: 44, height: 44, background: '#f43f5e', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>X</button>
              </div>

              {prijavaPokazano && (
                <>
                  {/* Upload slika */}
                  <label style={{ display: 'block', border: '2px dashed #6366f1', borderRadius: 14, padding: 20, textAlign: 'center', cursor: 'pointer', background: 'rgba(99,102,241,0.04)', marginBottom: 14 }}>
                    <div style={{ fontSize: 28, marginBottom: 4 }}>📸</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#6366f1' }}>DODAJ SLIKE VOZILA</div>
                    <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleMultiUpload} />
                    <div style={{ fontSize: 11, color: '#6366f1', marginTop: 8 }}>{prijavaUploadInfo}</div>
                    {prijavaUploadProgress > 0 && (
                      <div style={{ marginTop: 8, height: 6, background: '#e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
                        <div style={{ height: '100%', background: '#10b981', width: `${prijavaUploadProgress}%`, transition: '0.3s' }} />
                      </div>
                    )}
                  </label>

                  {/* Checkboxes */}
                  {[
                    ['checkUlje', 'Provjera ulja', checkUlje, setCheckUlje],
                    ['checkAntifriz', 'Rashladna tečnost', checkAntifriz, setCheckAntifriz],
                    ['checkBrisaci', 'Tečnost za brisače', checkBrisaci, setCheckBrisaci],
                    ['checkSvetla', 'Signalizacija/Svjetla', checkSvetla, setCheckSvetla],
                    ['checkKlima', 'Klima uređaj', checkKlima, setCheckKlima],
                    ['checkBrave', 'Brave / Vrata-Gepek', checkBrave, setCheckBrave],
                    ['checkEnterijer', 'Enterijer / Čistoća', checkEnterijer, setCheckEnterijer],
                  ].map(([id, label, val, setter]) => (
                    <div key={id as string} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: '#f8fafc', marginBottom: 8, borderRadius: 12, border: '1px solid #e2e8f0' }}>
                      <label style={{ fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>{label as string}</label>
                      <input type="checkbox" checked={val as boolean} onChange={e => (setter as any)(e.target.checked)}
                        style={{ width: 22, height: 22, cursor: 'pointer', accentColor: '#10b981' }} />
                    </div>
                  ))}

                  <textarea value={prijavaKomentar} onChange={e => setPrijavaKomentar(e.target.value)} rows={2}
                    placeholder="Dodatni komentar o vozilu..." style={{ ...inp, resize: 'vertical', marginBottom: 12 }} />

                  <button onClick={savePrijava} disabled={prijavaSaving}
                    style={{ ...btn, background: prijavaSaving ? '#a7f3d0' : '#10b981' }}>
                    {prijavaSaving ? '⏳...' : 'UPIŠI PROVJERU'}
                  </button>
                </>
              )}

              <button onClick={() => setShowSveProvjere(s => !s)}
                style={{ ...btn, background: '#6366f1', padding: '12px', fontSize: 12, marginTop: 12 }}>
                SVA ČEKIRANA AUTA / PRETRAGA
              </button>

              {showSveProvjere && (
                <div style={{ marginTop: 12 }}>
                  <input value={pretragaVozilo} onChange={e => setPretragaVozilo(e.target.value)} placeholder="Pretraži po tablicama..." style={{ ...inp, marginBottom: 8 }} />
                  <input value={pretragaAgent} onChange={e => setPretragaAgent(e.target.value)} placeholder="Pretraži po agentu..." style={{ ...inp }} />
                </div>
              )}
            </div>

            {/* Historija provjera */}
            {provjere.map(p => (
              <div key={p.id} style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, marginBottom: 4 }}>
                  <span>{p.tablice}</span>
                  <span style={{ fontSize: 11, color: '#6366f1' }}>{p.datum}</span>
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 8 }}>Agent: {p.agent}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 6, marginBottom: 8 }}>
                  {[['ULJE', p.ulje], ['ANTIFRIZ', p.antifriz], ['BRISAČI', p.tecnost_brisaci], ['SVJETLA', p.svetla], ['KLIMA', p.klima], ['BRAVE', p.brave], ['ENTERIJER', p.enterijer]].map(([lbl, ok]) => (
                    <div key={lbl as string} style={{ background: ok ? 'rgba(16,185,129,0.08)' : 'rgba(244,63,94,0.08)', color: ok ? '#10b981' : '#f43f5e', padding: '4px 8px', borderRadius: 8, fontSize: 11, fontWeight: 700, textAlign: 'center' }}>
                      {lbl as string}
                    </div>
                  ))}
                </div>
                {p.slike && (
                  <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                    {p.slike.split(' ').filter(Boolean).map((s, i) => (
                      <img key={i} src={getDirectImg(s)} style={{ width: 70, height: 70, objectFit: 'cover', borderRadius: 10, border: '2px solid #e2e8f0', cursor: 'pointer', flexShrink: 0 }}
                        onClick={() => window.open(s, '_blank')} alt="" />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'pranje' && (
          <div>
            <div style={card}>
              <input list="voz-list3" value={pranjeVozilo} onChange={e => setPranjeVozilo(e.target.value)} placeholder="Vozilo za pranje..." style={{ ...inp, marginBottom: 10 }} />
              <datalist id="voz-list3">{vozila.map(v => <option key={v.br_tablica} value={v.br_tablica}>{v.agregirani_2}</option>)}</datalist>

              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                {(['DA', 'NE'] as const).map(v => (
                  <button key={v} onClick={() => setPranjeNaplaceno(v)}
                    style={{ flex: 1, padding: '12px', border: `2px solid ${pranjeNaplaceno === v ? '#0ea5e9' : '#e2e8f0'}`, borderRadius: 12, background: pranjeNaplaceno === v ? '#e0f2fe' : '#fff', color: pranjeNaplaceno === v ? '#0369a1' : '#64748b', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
                    {v === 'DA' ? 'NAPLAĆUJE SE' : 'NE NAPLAĆUJE'}
                  </button>
                ))}
              </div>

              {pranjeNaplaceno === 'NE' && (
                <textarea value={pranjeRazlog} onChange={e => setPranjeRazlog(e.target.value)} rows={2}
                  placeholder="Zašto se ne naplaćuje?" style={{ ...inp, resize: 'vertical', marginBottom: 10 }} />
              )}

              <button onClick={savePranje} disabled={pranjeSaving}
                style={{ ...btn, background: pranjeSaving ? '#7dd3fc' : '#0ea5e9' }}>
                {pranjeSaving ? '⏳...' : 'POŠALJI NA PRANJE'}
              </button>
            </div>

            {pranja.map(p => (
              <div key={p.id} style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{p.vozilo}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>{p.agent}</div>
                    {p.Kommentar && <div style={{ fontSize: 12, color: '#f59e0b', marginTop: 4 }}>{p.Kommentar}</div>}
                  </div>
                  {PERACI.includes(agentEmail) ? (
                    <button onClick={() => completePranje(p.id, p.vozilo)}
                      style={{ padding: '10px 16px', background: '#10b981', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer', fontSize: 12 }}>
                      ZAVRŠI
                    </button>
                  ) : (
                    <button onClick={() => agentPrao(p.id, p.vozilo)}
                      style={{ padding: '10px 16px', background: '#f59e0b', color: '#000', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer', fontSize: 12 }}>
                      JA OPRAO
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'vozilo' && (
          <div>
            {aktivnoKoriscenje ? (
              <div style={card}>
                <div style={{ background: '#f59e0b', color: '#000', padding: '16px', borderRadius: 16, fontWeight: 900, fontSize: 24, textAlign: 'center', marginBottom: 14, textTransform: 'uppercase' }}>
                  {aktivnoKoriscenje.tablice}
                </div>
                <div style={{ textAlign: 'center', fontSize: 13, marginBottom: 14, color: '#64748b' }}>
                  📍 Destinacija: <strong>{aktivnoKoriscenje.destinacija}</strong><br />
                  🕒 Zaduženo: <strong>{aktivnoKoriscenje.vreme_zaduzenja}</strong>
                </div>
                <input type="number" value={kmEnd} onChange={e => setKmEnd(e.target.value)} placeholder="Nova KM stanja..." style={{ ...inp, marginBottom: 12 }} />
                <button onClick={() => finishPrivate(aktivnoKoriscenje.id, aktivnoKoriscenje.km_start)}
                  disabled={vozileSaving}
                  style={{ ...btn, background: '#f43f5e' }}>
                  RAZDUŽI VOZILO
                </button>
              </div>
            ) : (
              <div style={card}>
                <input list="voz-list4" value={privatnoVozilo} onChange={e => setPrivatnoVozilo(e.target.value)} placeholder="Vozilo..." style={{ ...inp, marginBottom: 10 }} />
                <datalist id="voz-list4">{vozila.map(v => <option key={v.br_tablica} value={v.br_tablica}>{v.agregirani_2}</option>)}</datalist>
                <input type="number" value={kmStart} onChange={e => setKmStart(e.target.value)} placeholder="Početna KM stanja..." style={{ ...inp, marginBottom: 10 }} />
                <input value={privatnoDest} onChange={e => setPrivatnoDest(e.target.value)} placeholder="Destinacija..." style={{ ...inp, marginBottom: 14 }} />
                <button onClick={startPrivate} disabled={vozileSaving} style={{ ...btn, background: '#10b981' }}>
                  ZADUŽI VOZILO
                </button>
              </div>
            )}

            {/* Historija */}
            {koriscenje.filter(k => k.status !== 'Aktivno').slice(0, 5).map(k => (
              <div key={k.id} style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <strong>{k.tablice}</strong>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>{k.vreme_zaduzenja}</span>
                </div>
                <div style={{ fontSize: 12, color: '#64748b' }}>
                  📍 {k.destinacija} · 📏 {k.predjena_km || 0} km
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'saldo' && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', textAlign: 'center', marginBottom: 14, textTransform: 'uppercase', letterSpacing: 1 }}>
              Posljednjih 30 transakcija
            </div>
            {prikazTransakcija.map(t => {
              const iz = parseFloat(t.iznos as any || 0)
              const pE = (t.primaocemail || '').toLowerCase()
              const col = pE === agentEmail ? '#10b981' : iz > 0 ? '#10b981' : '#f43f5e'
              return (
                <div key={t.id} style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderLeft: `4px solid ${col}` }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{t.kategorija}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>{t.vozilo} · {t.datum}</div>
                    {t.komentar && <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{t.komentar.slice(0, 60)}{t.komentar.length > 60 ? '...' : ''}</div>}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: col, flexShrink: 0, marginLeft: 10 }}>
                    {iz > 0 ? '+' : ''}{iz.toFixed(2)}€
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* BOTTOM NAV */}
      <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', display: 'flex', padding: '12px 8px 28px', zIndex: 999, borderRadius: '20px 20px 0 0', boxShadow: '0 -4px 20px rgba(0,0,0,0.06)', borderTop: '1px solid #f1f5f9' }}>
        {([
          ['unos', '💸', 'UNOS'],
          ['ugovori', '📄', 'UGOVORI'],
          ['prijava', '📋', 'PRIJAVA'],
          ['pranje', '🧼', 'PRANJE'],
          ['vozilo', '🚗', 'VOZILO'],
          ['saldo', '📊', 'SALDO'],
        ] as [Tab, string, string][]).map(([tab, icon, label]) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{ flex: 1, border: 'none', background: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', fontSize: 8, fontWeight: 700, color: activeTab === tab ? '#6366f1' : '#94a3b8', cursor: 'pointer', position: 'relative' }}>
            <span style={{ fontSize: 20, marginBottom: 4, filter: activeTab === tab ? 'none' : 'grayscale(1)', opacity: activeTab === tab ? 1 : 0.5, transform: activeTab === tab ? 'translateY(-4px) scale(1.1)' : 'none', transition: '0.2s', display: 'block' }}>
              {icon}
            </span>
            {label}
            {tab === 'ugovori' && cekanjuUgovori.length > 0 && (
              <span style={{ position: 'absolute', top: 0, right: '20%', width: 8, height: 8, background: '#f43f5e', borderRadius: '50%', border: '2px solid #fff' }} />
            )}
            {tab === 'unos' && pendingCount > 0 && (
              <span style={{ position: 'absolute', top: 0, right: '20%', width: 8, height: 8, background: '#f43f5e', borderRadius: '50%', border: '2px solid #fff' }} />
            )}
          </button>
        ))}
      </nav>
    </div>
  )
}
