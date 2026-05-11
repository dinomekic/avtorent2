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
  id: string; tip_transakcije: string; datum: string; kategorija: string
  iznos: number; vozilo: string; komentar: string; osoba: string
  osobaemail: string; timestamp_upisa: string; status: string; primaocemail?: string
}
type Rezervacija = {
  id: number; br_tablica: string; ime_prezime: string
  od_datuma: string; do_datuma: string
  ukupno_naplata: number; naplaceno: number; depozit: number
  depozit_uzet: boolean; depozit_vracen: boolean; vraceni_depozit_iznos: number
  ko_je_izdao: string; ko_je_preuzeo: string; ugovor_slika: string
}
type Vozilo = { br_tablica: string; agregirani_2: string }
type KoriscenjeVozila = {
  id: string; email: string; tablice: string; km_start: number
  km_end?: number; predjena_km?: number; destinacija: string
  status: string; vreme_zaduzenja: string; timestamp_upisa: string
}
type PranjeItem = {
  id: string; datum_tekst: string; agent: string; email: string
  vozilo: string; status: string; naplaceno: string; Kommentar?: string
}
type ProveraItem = {
  id: string; datum: string; tablice: string; ulje: boolean; antifriz: boolean
  tecnost_brisaci: boolean; svetla: boolean; klima: boolean; brave: boolean
  enterijer: boolean; komentar: string; slike: string; agent: string
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
  'MOJA dnevnica', 'Renta', 'Uplata duga prema FIRMI', 'Neutralni novcani tokovi',
  'PREUZETO IZ SANDUCETA', 'Prodaja vozila', 'Razmjena novca',
  'Razmjena novca medju nama', 'Refundacija (u komentaru dodaj razlog)', 'Ostalo',
]
const KATEGORIJE_ODLIV = [
  'Gorivo (dodaj sliku racuna)', 'Gorivo', 'Djelovi (dodaj sliku racuna)', 'Djelovi',
  'Servisiranje vozila', 'Servis', 'Registracija vozila (dodaj sliku racuna)',
  'Pranje', 'Pranje Planet', 'Parking (dodaj sliku racuna)', 'Parking',
  'Kazne i prekrsaji', 'Doplata za kazne (dodaj sliku kazne)', 'Doplata za oštetu',
  'Doplata za gorivo', 'Doplata za pranje', 'Povrat Depozita',
  'Provizije posrednicima', 'Putni troškovi (u komentaru dodaj destinaciju)',
  'Putni troškovi', 'Taksi', 'Kirija', 'Komunalije', 'Telekomunikacije',
  'Kancelarijski materijal', 'Plata', 'MOJA plata', 'Slepanje vozila',
  'Uplata duga za službeno vozilo', 'Rata za vozilo (dodaj sliku potvrde)',
  'Marketing i oglasavanje', 'Osiguranje', 'Transfer',
  'OSTAVLJENO U SANDUCE', 'Neutralni novcani tok',
  'DUG PREMA FIRMI ( u komentaru upisi iznos preostalog duga)',
  'Pozajmica (u komenatru upisi preostali dug)', 'Ostalo',
]
const FOTO_KAT = [
  'Gorivo (dodaj sliku racuna)', 'Gorivo', 'Djelovi (dodaj sliku racuna)',
  'Registracija vozila (dodaj sliku racuna)', 'Rata za vozilo (dodaj sliku potvrde)',
  'Parking (dodaj sliku racuna)', 'Doplata za kazne (dodaj sliku kazne)',
]

const inp: React.CSSProperties = { width: '100%', padding: '8px 12px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', color: '#111', boxSizing: 'border-box' }
const lbl: React.CSSProperties = { fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 3, fontWeight: 500 }
const card: React.CSSProperties = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 20, marginBottom: 14 }

export default function AgentPage() {
  const [activeTab, setActiveTab] = useState<Tab>('unos')
  const [agentEmail, setAgentEmail] = useState('')
  const [agentIme, setAgentIme] = useState('')
  const [allTrans, setAllTrans] = useState<Transakcija[]>([])
  const [vozila, setVozila] = useState<Vozilo[]>([])
  const [kolege, setKolege] = useState<{ email: string; ime: string }[]>([])
  const [loading, setLoading] = useState(true)

  // UNOS
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

  // UGOVORI
  const [ugovori, setUgovori] = useState<Rezervacija[]>([])
  const [ugovoriLoading, setUgovoriLoading] = useState(false)

  // PRIJAVA
  const [prijavaVozilo, setPrijavaVozilo] = useState('')
  const [prijavaPokazano, setPrijavaPokazano] = useState(false)
  const [checks, setChecks] = useState({ ulje: false, antifriz: false, brisaci: false, svetla: false, klima: false, brave: false, enterijer: false })
  const [prijavaKomentar, setPrijavaKomentar] = useState('')
  const [prijavaSlike, setPrijavaSlike] = useState<string[]>([])
  const [prijavaUploadInfo, setPrijavaUploadInfo] = useState('Slike nisu dodate')
  const [prijavaProgress, setPrijavaProgress] = useState(0)
  const [provjere, setProovjere] = useState<ProveraItem[]>([])
  const [prijavaSaving, setPrijavaSaving] = useState(false)
  const [showSveProvjere, setShowSveProvjere] = useState(false)
  const [pretragaVozilo, setPretragaVozilo] = useState('')
  const [pretragaAgent, setPretragaAgent] = useState('')

  // PRANJE
  const [pranjeVozilo, setPranjeVozilo] = useState('')
  const [pranjeNaplaceno, setPranjeNaplaceno] = useState<'DA' | 'NE'>('DA')
  const [pranjeRazlog, setPranjeRazlog] = useState('')
  const [pranja, setPranja] = useState<PranjeItem[]>([])
  const [pranjeSaving, setPranjeSaving] = useState(false)

  // VOZILO
  const [aktivnoKor, setAktivnoKor] = useState<KoriscenjeVozila | null>(null)
  const [korHistory, setKorHistory] = useState<KoriscenjeVozila[]>([])
  const [privVozilo, setPrivVozilo] = useState('')
  const [kmStart, setKmStart] = useState('')
  const [privDest, setPrivDest] = useState('')
  const [kmEnd, setKmEnd] = useState('')
  const [vozSaving, setVozSaving] = useState(false)

  // SALDO
  const [saldo, setSaldo] = useState(0)
  const [firmaDug, setFirmaDug] = useState(0)
  const [kmDug, setKmDug] = useState(0)
  const [prikazTrans, setPrikazTrans] = useState<Transakcija[]>([])
  const [pendingTrans, setPendingTrans] = useState<Transakcija[]>([])
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    const ime = getCookie('avtorent-agent-name')
    if (!ime) { window.location.href = '/admin/login'; return }
    setAgentIme(ime)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user?.email) { window.location.href = '/admin/login'; return }
      setAgentEmail(session.user.email)
      loadAll(session.user.email, ime)
    })
  }, [])

  const loadAll = useCallback(async (email: string, ime: string) => {
    setLoading(true)
    let trans: Transakcija[] = []
    let from = 0; let hasMore = true
    while (hasMore) {
      const { data } = await supabase.from('transakcije').select('*').range(from, from + 999)
      if (data && data.length > 0) { trans = [...trans, ...data]; from += 1000; if (data.length < 1000) hasMore = false } else hasMore = false
    }
    trans.sort((a, b) => new Date(b.timestamp_upisa || 0).getTime() - new Date(a.timestamp_upisa || 0).getTime())
    setAllTrans(trans)

    const { data: v } = await supabase.from('vozila').select('br_tablica, agregirani_2').order('agregirani_2')
    setVozila(v || [])

    const { data: agents } = await supabase.from('agents').select('email, full_name').eq('is_active', true)
    setKolege((agents || []).filter(a => a.email !== email).map(a => ({ email: a.email, ime: a.full_name })))

    // Saldo
    let s = 0, df = 0
    const prikazano: Transakcija[] = []
    const pending: Transakcija[] = []
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
      if (status === 'na cekanju' && pE === email) pending.push(t)
      if ((sE === email || pE === email) && prikazano.length < 40) prikazano.push(t)
    })
    setSaldo(s); setFirmaDug(df)
    setPrikazTrans(prikazano); setPendingTrans(pending); setPendingCount(pending.length)

    // KM
    let totalPredjeno = 0, uKm = 0
    const { data: km } = await supabase.from('koristenje').select('*').order('timestamp_upisa', { ascending: false })
    const svaKor = km || []
    svaKor.forEach(k => { if (k.email?.toLowerCase() === email && k.status !== 'Aktivno') totalPredjeno += parseFloat(k.predjena_km || 0) })
    trans.forEach(t => { if ((t.osobaemail || '').toLowerCase() === email && (t.kategorija || '').toLowerCase().includes('uplat') && (t.kategorija || '').toLowerCase().includes('vozilo')) uKm += Math.abs(parseFloat(t.iznos as any || 0)) })
    setKmDug(((totalPredjeno / 100) * 1.44 * 8) - uKm)
    setAktivnoKor(svaKor.find(k => k.email?.toLowerCase() === email && k.status === 'Aktivno') || null)
    setKorHistory(svaKor.filter(k => k.email?.toLowerCase() === email && k.status !== 'Aktivno').slice(0, 5))

    const { data: pr } = await supabase.from('pranje').select('*').eq('status', 'Na čekanju').order('vrijeme_upisa', { ascending: false })
    setPranja(pr || [])
    setLoading(false)
  }, [])

  const loadUgovori = useCallback(async () => {
    if (!agentIme) return
    setUgovoriLoading(true)
    const imeBez = agentIme.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const { data } = await supabase.from('rezervacije').select('*')
      .or(`ko_je_izdao.eq.${imeBez},ko_je_preuzeo.eq.${imeBez}`)
      .order('id', { ascending: false }).limit(100)
    setUgovori(data || [])
    setUgovoriLoading(false)
  }, [agentIme])

  useEffect(() => { if (activeTab === 'ugovori' && agentIme) loadUgovori() }, [activeTab, agentIme, loadUgovori])

  useEffect(() => {
    if (prijavaVozilo.length > 2) { setPrijavaPokazano(true); loadProvjere(false) }
    else { setPrijavaPokazano(false) }
  }, [prijavaVozilo])

  useEffect(() => { if (showSveProvjere) loadProvjere(true) }, [showSveProvjere, pretragaVozilo, pretragaAgent])

  // ─── UPLOAD ───────────────────────────────────────────────
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
    const file = e.target.files?.[0]; if (!file) return
    setUploadStatus('⏳ Uploading...')
    try { const url = await uploadSlika(file, `RACUN_${Date.now()}`); setPhotoUrl(url); setUploadStatus('✅ Slika dodana') }
    catch { setUploadStatus('❌ Greška') }
  }

  async function handleMultiUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files; if (!files?.length) return
    setPrijavaUploadInfo('⏳ Uploading...')
    const urls: string[] = []
    for (let i = 0; i < files.length; i++) {
      try { urls.push(await uploadSlika(files[i], `AUTO_${Date.now()}_${i}`)) } catch { }
      setPrijavaProgress(Math.round(((i + 1) / files.length) * 100))
    }
    setPrijavaSlike(urls)
    setPrijavaUploadInfo(`✅ ${urls.length} slika dodano`)
    setTimeout(() => setPrijavaProgress(0), 2000)
  }

  async function handleUgovorUpload(e: React.ChangeEvent<HTMLInputElement>, rezId: number) {
    const file = e.target.files?.[0]; if (!file) return
    try {
      const url = await uploadSlika(file, `UGOVOR_${rezId}`)
      await supabase.from('rezervacije').update({ ugovor_slika: url }).eq('id', rezId)
      await supabase.from('logovi').insert([{ akcija: `Upload ugovora REZ #${rezId} — ${agentIme}` }])
      loadUgovori()
    } catch { alert('Greška pri uploadu') }
    e.target.value = ''
  }

  // ─── TRANSAKCIJA ──────────────────────────────────────────
  async function saveTransakcija() {
    const izVal = parseFloat(iznos)
    if (!izVal || !kategorija) { alert('Unesite iznos i kategoriju!'); return }
    setUnosSaving(true)
    const jeRazmjena = kategorija.toLowerCase().includes('razmjena') && primaoc
    await supabase.from('transakcije').insert([{
      id: genId(), tip_transakcije: tip, datum, kategorija,
      iznos: tip === 'priliv' ? Math.abs(izVal) : -Math.abs(izVal),
      vozilo: voziloUnos || 'OPŠTE',
      komentar: komentar + (photoUrl ? ' ' + photoUrl : ''),
      osoba: agentIme, osobaemail: agentEmail,
      timestamp_upisa: new Date().toISOString(),
      status: jeRazmjena ? 'na cekanju' : 'Zavrseno',
      primaocemail: jeRazmjena ? primaoc : null,
      provereno: false, provera_status: 'pending', v_status: 'pending',
    }])
    setIznos(''); setKomentar(''); setVoziloUnos(''); setPhotoUrl('')
    setUploadStatus(''); setPrimaoc(''); setUnosSaving(false)
    alert('Upisano!'); loadAll(agentEmail, agentIme)
  }

  // ─── UGOVORI LOGIKA ───────────────────────────────────────
  function getUgovorStatus(u: Rezervacija) {
    const imeBez = agentIme.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const isIzdao = u.ko_je_izdao === imeBez
    const isPreuzeo = u.ko_je_preuzeo === imeBez
    const fazaReturn = !!u.ko_je_preuzeo
    const naplacenoNajam = u.naplaceno || 0
    const ukupno = u.ukupno_naplata || 0
    const depozit = u.depozit || 0
    const vracenDep = u.vraceni_depozit_iznos || 0
    const preostaliDug = Math.max(0, ukupno - naplacenoNajam)
    const uTrans = allTrans.filter(t => t.komentar?.includes(`REZ #${u.id}`))
    const upisanNajam = uTrans.filter(t => t.tip_transakcije === 'priliv' && (t.kategorija === 'Izdavanje vozila' || t.kategorija === 'Naplata Duga')).reduce((s, t) => s + Math.abs(parseFloat(t.iznos as any || 0)), 0)
    const depUzetUKasi = uTrans.some(t => t.tip_transakcije === 'priliv' && t.kategorija === 'Depozit')
    const depVracenIzKase = uTrans.some(t => t.tip_transakcije === 'odliv' && t.kategorija === 'Povrat Depozita')
    const fali = Math.max(0, naplacenoNajam - upisanNajam)
    return {
      isIzdao, isPreuzeo, fazaReturn, preostaliDug, depozit, vracenDep, fali,
      trebaSlika: !u.ugovor_slika && isIzdao,
      trebaNajam: fali > 0.01 && !fazaReturn && isIzdao,
      trebaDepozit: u.depozit_uzet && !depUzetUKasi && isIzdao,
      trebaDug: fali > 0.01 && fazaReturn && isPreuzeo,
      trebaDepVracen: u.depozit_vracen && vracenDep > 0 && !depVracenIzKase && isPreuzeo,
    }
  }

  async function trInsert(tip_t: 'priliv' | 'odliv', kat: string, iznT: number, voz: string, kom: string) {
    await supabase.from('transakcije').insert([{
      id: genId(), tip_transakcije: tip_t, datum: new Date().toISOString().split('T')[0],
      kategorija: kat, iznos: tip_t === 'odliv' ? -Math.abs(iznT) : Math.abs(iznT),
      vozilo: voz, komentar: kom, osoba: agentIme, osobaemail: agentEmail,
      timestamp_upisa: new Date().toISOString(), status: 'Zavrseno',
      provereno: false, provera_status: 'pending', v_status: 'pending',
    }])
  }

  async function zavediNajam(u: Rezervacija, iznT: number) {
    if (!confirm(`Zaduži ${iznT}€ u kasu za ${u.br_tablica}?`)) return
    const p = Math.max(0, (u.ukupno_naplata || 0) - (u.naplaceno || 0))
    let kom = `Početna naplata pri izdavanju (Ugovor REZ #${u.id}).`
    kom += p > 0.01 ? ` Preostali dug: ${p.toFixed(2)}€` : ' Ugovor u potpunosti isplaćen.'
    await trInsert('priliv', 'Izdavanje vozila', iznT, u.br_tablica, kom)
    alert('Zaduženo!'); loadAll(agentEmail, agentIme); loadUgovori()
  }

  async function zavediDepozit(u: Rezervacija, iznT: number) {
    if (!confirm(`Zaduži depozit ${iznT}€?`)) return
    await trInsert('priliv', 'Depozit', iznT, u.br_tablica, `Uzet depozit pri izdavanju (Ugovor REZ #${u.id})`)
    alert('Depozit zadužen!'); loadAll(agentEmail, agentIme); loadUgovori()
  }

  async function zavediNajamIDepozit(u: Rezervacija, najam: number, dep: number) {
    if (!confirm(`Zaduži NAJAM (${najam}€) i DEPOZIT (${dep}€)?`)) return
    const p = Math.max(0, (u.ukupno_naplata || 0) - (u.naplaceno || 0))
    let kom = `Početna naplata pri izdavanju (Ugovor REZ #${u.id}).`
    kom += p > 0.01 ? ` Preostali dug: ${p.toFixed(2)}€` : ' Ugovor u potpunosti isplaćen.'
    await supabase.from('transakcije').insert([
      { id: genId() + '1', tip_transakcije: 'priliv', datum: new Date().toISOString().split('T')[0], kategorija: 'Izdavanje vozila', iznos: najam, vozilo: u.br_tablica, komentar: kom, osoba: agentIme, osobaemail: agentEmail, timestamp_upisa: new Date().toISOString(), status: 'Zavrseno', provereno: false, provera_status: 'pending', v_status: 'pending' },
      { id: genId() + '2', tip_transakcije: 'priliv', datum: new Date().toISOString().split('T')[0], kategorija: 'Depozit', iznos: dep, vozilo: u.br_tablica, komentar: `Uzet depozit pri izdavanju (Ugovor REZ #${u.id})`, osoba: agentIme, osobaemail: agentEmail, timestamp_upisa: new Date().toISOString(), status: 'Zavrseno', provereno: false, provera_status: 'pending', v_status: 'pending' },
    ])
    alert('Sve zaduženo!'); loadAll(agentEmail, agentIme); loadUgovori()
  }

  async function zavediDug(u: Rezervacija, iznT: number) {
    if (!confirm(`Zaduži naplatu duga ${iznT}€?`)) return
    const p = Math.max(0, (u.ukupno_naplata || 0) - (u.naplaceno || 0))
    let kom = `Naplata duga pri preuzimanju (Ugovor REZ #${u.id}).`
    kom += p > 0.01 ? ` Preostali dug: ${p.toFixed(2)}€` : ' Isplaćeno u potpunosti.'
    await trInsert('priliv', 'Naplata Duga', iznT, u.br_tablica, kom)
    alert('Naplata zavedena!'); loadAll(agentEmail, agentIme); loadUgovori()
  }

  async function zavediPovratDep(u: Rezervacija, iznT: number) {
    if (!confirm(`Razdužuješ ${iznT}€ iz kase za povrat depozita?`)) return
    await trInsert('odliv', 'Povrat Depozita', iznT, u.br_tablica, `Vraćen depozit pri preuzimanju (Ugovor REZ #${u.id})`)
    alert('Povrat razdužen!'); loadAll(agentEmail, agentIme); loadUgovori()
  }

  // ─── PRIJAVA ──────────────────────────────────────────────
  async function loadProvjere(all: boolean) {
    let q = supabase.from('provere').select('*').order('vreme_upisa', { ascending: false })
    if (all) {
      if (pretragaVozilo) q = q.ilike('tablice', `%${pretragaVozilo}%`)
      if (pretragaAgent) q = q.ilike('agent', `%${pretragaAgent}%`)
      q = q.limit(30)
    } else {
      q = q.ilike('tablice', `%${prijavaVozilo}%`).limit(10)
    }
    const { data } = await q
    setProovjere(data || [])
  }

  async function savePrijava() {
    if (!prijavaVozilo) { alert('Unesite tablice!'); return }
    setPrijavaSaving(true)
    await supabase.from('provere').insert([{
      id: genId(), datum: new Date().toLocaleString('sr-RS'),
      tablice: prijavaVozilo.toUpperCase(),
      ulje: checks.ulje, antifriz: checks.antifriz, tecnost_brisaci: checks.brisaci,
      svetla: checks.svetla, klima: checks.klima, brave: checks.brave, enterijer: checks.enterijer,
      komentar: prijavaKomentar, slike: prijavaSlike.join(' '),
      agent: agentIme, vreme_upisa: new Date().toISOString(),
    }])
    setPrijavaVozilo(''); setPrijavaPokazano(false)
    setChecks({ ulje: false, antifriz: false, brisaci: false, svetla: false, klima: false, brave: false, enterijer: false })
    setPrijavaKomentar(''); setPrijavaSlike([]); setPrijavaUploadInfo('Slike nisu dodate')
    setPrijavaSaving(false); alert('Provjera upisana!')
  }

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

  async function completePranje(id: string, voz: string) {
    await supabase.from('pranje').update({ status: 'ZAVRŠENO' }).eq('id', id)
    await trInsert('odliv', 'Pranje Planet', 5, voz, 'Pranje vozila završeno')
    loadAll(agentEmail, agentIme)
  }

  async function agentPrao(id: string, voz: string) {
    const izStr = window.prompt('Iznos pranja (€)?'); if (!izStr) return
    await supabase.from('pranje').update({ status: 'ZAVRŠENO' }).eq('id', id)
    await trInsert('odliv', 'PRANJE', parseFloat(izStr), voz, 'Agent sam oprao vozilo')
    loadAll(agentEmail, agentIme)
  }

  // ─── VOZILO ───────────────────────────────────────────────
  async function startPrivate() {
    if (!privVozilo || !kmStart) { alert('Unesite vozilo i KM!'); return }
    setVozSaving(true)
    await supabase.from('koristenje').insert([{
      id: genId(), email: agentEmail, ime_prezime: agentIme,
      tablice: privVozilo.toUpperCase(), km_start: parseFloat(kmStart),
      destinacija: privDest, status: 'Aktivno',
      vreme_zaduzenja: new Date().toLocaleString('sr-RS'),
      timestamp_upisa: new Date().toISOString(),
    }])
    setPrivVozilo(''); setKmStart(''); setPrivDest('')
    setVozSaving(false); loadAll(agentEmail, agentIme)
  }

  async function finishPrivate(id: string, kmS: number) {
    if (!kmEnd) { alert('Unesite krajnje KM!'); return }
    await supabase.from('koristenje').update({ km_end: parseFloat(kmEnd), predjena_km: parseFloat(kmEnd) - kmS, status: 'Završeno' }).eq('id', id)
    setKmEnd(''); loadAll(agentEmail, agentIme)
  }

  async function confirmTrans(id: string) {
    await supabase.from('transakcije').update({ status: 'Zavrseno' }).eq('id', id)
    loadAll(agentEmail, agentIme)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    document.cookie = 'avtorent-admin-token=; path=/; max-age=0'
    document.cookie = 'avtorent-agent-name=; path=/; max-age=0'
    window.location.href = '/admin/login'
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb' }}>
      <div style={{ textAlign: 'center', color: '#9ca3af' }}>Učitavanje...</div>
    </div>
  )

  const needsFoto = FOTO_KAT.includes(kategorija)
  const isRazmjena = kategorija.toLowerCase().includes('razmjena')
  const katOptions = tip === 'priliv' ? KATEGORIJE_PRILIV : KATEGORIJE_ODLIV

  const cekanjuUgovori = ugovori.filter(u => { const s = getUgovorStatus(u); return s.trebaSlika || s.trebaNajam || s.trebaDepozit })
  const dugDepUgovori = ugovori.filter(u => { const s = getUgovorStatus(u); return s.trebaDug || s.trebaDepVracen })
  const zavrsenoUgovori = ugovori.filter(u => { const s = getUgovorStatus(u); return !s.trebaSlika && !s.trebaNajam && !s.trebaDepozit && !s.trebaDug && !s.trebaDepVracen })

  const TABS: { id: Tab; label: string; badge?: number }[] = [
    { id: 'unos', label: '💸 Unos', badge: pendingCount || undefined },
    { id: 'ugovori', label: '📄 Ugovori', badge: (cekanjuUgovori.length + dugDepUgovori.length) || undefined },
    { id: 'prijava', label: '📋 Prijava' },
    { id: 'pranje', label: '🧼 Pranje' },
    { id: 'vozilo', label: '🚗 Vozilo' },
    { id: 'saldo', label: '📊 Saldo' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb' }}>
      {/* TOP BAR */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '0 20px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#111' }}>
          Avto<span style={{ color: '#1D9E75' }}>Rent</span>
          <span style={{ fontSize: 10, color: '#9ca3af', fontWeight: 400, marginLeft: 6 }}>agent</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#E1F5EE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#085041' }}>
              {agentIme[0]?.toUpperCase()}
            </div>
            <span style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>{agentIme}</span>
          </div>
          <button onClick={handleLogout} style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 8, padding: '5px 12px', fontSize: 12, color: '#9ca3af', cursor: 'pointer' }}>
            Odjavi se
          </button>
        </div>
      </div>

      <div style={{ paddingTop: 52 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 28px' }}>

          {/* SALDO KARTICE */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
            <div style={{ background: saldo >= 0 ? '#E1F5EE' : '#FCEBEB', border: `1px solid ${saldo >= 0 ? '#5DCAA5' : '#fecaca'}`, borderRadius: 10, padding: '16px 20px' }}>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>MOJ SALDO</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: saldo >= 0 ? '#085041' : '#dc2626' }}>{saldo.toFixed(2)} €</div>
            </div>
            <div style={{ background: '#FAEEDA', border: '1px solid #f59e0b', borderRadius: 10, padding: '16px 20px' }}>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>DUG PREMA FIRMI</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#633806' }}>{firmaDug.toFixed(2)} €</div>
            </div>
            <div style={{ background: '#E6F1FB', border: '1px solid #85B7EB', borderRadius: 10, padding: '16px 20px' }}>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>DUG ZA KM</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#0C447C' }}>{kmDug.toFixed(2)} €</div>
            </div>
          </div>

          {/* TABS */}
          <div style={{ display: 'flex', gap: 2, marginBottom: 20, borderBottom: '1px solid #e5e7eb' }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                style={{ padding: '9px 16px', fontSize: 13, border: 'none', background: 'none', cursor: 'pointer', fontWeight: activeTab === t.id ? 600 : 400, color: activeTab === t.id ? '#1D9E75' : '#6b7280', borderBottom: activeTab === t.id ? '2px solid #1D9E75' : '2px solid transparent', marginBottom: -1, position: 'relative' }}>
                {t.label}
                {t.badge ? <span style={{ marginLeft: 5, background: '#dc2626', color: '#fff', borderRadius: 20, fontSize: 10, padding: '1px 5px', fontWeight: 700 }}>{t.badge}</span> : null}
              </button>
            ))}
          </div>

          {/* ─── TAB: UNOS ─── */}
          {activeTab === 'unos' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div style={card}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#111', marginBottom: 16 }}>Nova transakcija</div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                  <button onClick={() => { setTip('priliv'); setKategorija('') }}
                    style={{ flex: 1, padding: '10px', border: `2px solid ${tip === 'priliv' ? '#1D9E75' : '#e5e7eb'}`, borderRadius: 8, background: tip === 'priliv' ? '#E1F5EE' : '#fff', color: tip === 'priliv' ? '#085041' : '#6b7280', fontWeight: tip === 'priliv' ? 700 : 400, cursor: 'pointer', fontSize: 13 }}>
                    ↑ PRILIV
                  </button>
                  <button onClick={() => { setTip('odliv'); setKategorija('') }}
                    style={{ flex: 1, padding: '10px', border: `2px solid ${tip === 'odliv' ? '#dc2626' : '#e5e7eb'}`, borderRadius: 8, background: tip === 'odliv' ? '#FCEBEB' : '#fff', color: tip === 'odliv' ? '#dc2626' : '#6b7280', fontWeight: tip === 'odliv' ? 700 : 400, cursor: 'pointer', fontSize: 13 }}>
                    ↓ ODLIV
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div><label style={lbl}>Datum</label><input type="date" value={datum} onChange={e => setDatum(e.target.value)} style={inp} /></div>
                  <div><label style={lbl}>Iznos (€) *</label><input type="number" step="0.01" value={iznos} onChange={e => setIznos(e.target.value)} placeholder="0.00" style={{ ...inp, fontWeight: 700 }} /></div>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={lbl}>Kategorija *</label>
                  <select value={kategorija} onChange={e => setKategorija(e.target.value)} style={inp}>
                    <option value="">-- Odaberi --</option>
                    {katOptions.map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                </div>
                {isRazmjena && (
                  <div style={{ marginBottom: 10 }}>
                    <label style={lbl}>Pošalji kolegi</label>
                    <select value={primaoc} onChange={e => setPrimaoc(e.target.value)} style={inp}>
                      <option value="">→ Izaberi kolegu...</option>
                      {kolege.map(k => <option key={k.email} value={k.email}>{k.ime}</option>)}
                    </select>
                  </div>
                )}
                <div style={{ marginBottom: 10 }}>
                  <label style={lbl}>Vozilo</label>
                  <input list="voz-unos" value={voziloUnos} onChange={e => setVoziloUnos(e.target.value)} placeholder="Pretraži..." style={inp} />
                  <datalist id="voz-unos">{vozila.map(v => <option key={v.br_tablica} value={v.br_tablica}>{v.agregirani_2}</option>)}</datalist>
                </div>
                {needsFoto && (
                  <div style={{ border: '1px dashed #d1d5db', borderRadius: 8, padding: 12, marginBottom: 10, background: '#f9fafb' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#1D9E75', marginBottom: 8 }}>📎 OBAVEZNA SLIKA RAČUNA</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <label style={{ flex: 1, background: '#E1F5EE', border: '1px solid #1D9E75', padding: '8px', borderRadius: 8, textAlign: 'center', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#085041' }}>
                        📷 Slikaj <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFotoUpload} />
                      </label>
                      <label style={{ flex: 1, background: '#E1F5EE', border: '1px solid #1D9E75', padding: '8px', borderRadius: 8, textAlign: 'center', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#085041' }}>
                        🖼️ Dodaj <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFotoUpload} />
                      </label>
                    </div>
                    {uploadStatus && <div style={{ fontSize: 12, marginTop: 6, color: uploadStatus.includes('✅') ? '#1D9E75' : '#633806', fontWeight: 600 }}>{uploadStatus}</div>}
                  </div>
                )}
                <div style={{ marginBottom: 14 }}>
                  <label style={lbl}>Napomena</label>
                  <textarea value={komentar} onChange={e => setKomentar(e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' as const }} />
                </div>
                <button onClick={saveTransakcija} disabled={unosSaving}
                  style={{ width: '100%', padding: '11px', background: unosSaving ? '#5DCAA5' : '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                  {unosSaving ? '⏳ Snimam...' : 'POTVRDI UPIS'}
                </button>
              </div>

              <div>
                {pendingTrans.length > 0 && (
                  <div style={{ ...card, borderLeft: '4px solid #dc2626' }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#dc2626', marginBottom: 12 }}>🔔 Potvrde razmjene ({pendingTrans.length})</div>
                    {pendingTrans.map(t => (
                      <div key={t.id} style={{ background: '#fef2f2', borderRadius: 8, padding: '10px 12px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>Primio si {Math.abs(parseFloat(t.iznos as any))}€</div>
                          <div style={{ fontSize: 11, color: '#6b7280' }}>od {t.osoba}</div>
                        </div>
                        <button onClick={() => confirmTrans(t.id)}
                          style={{ padding: '6px 14px', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                          POTVRDI
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div style={card}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#111', marginBottom: 12 }}>Zadnjih 10 unosa</div>
                  {prikazTrans.slice(0, 10).map(t => {
                    const iz = parseFloat(t.iznos as any || 0)
                    return (
                      <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{t.kategorija}</div>
                          <div style={{ fontSize: 11, color: '#9ca3af' }}>{t.vozilo} · {t.datum}</div>
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: iz > 0 ? '#1D9E75' : '#dc2626', marginLeft: 10 }}>
                          {iz > 0 ? '+' : ''}{iz.toFixed(2)}€
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ─── TAB: UGOVORI ─── */}
          {activeTab === 'ugovori' && (
            <div>
              {ugovoriLoading ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>Učitavanje...</div>
              ) : (
                <>
                  {cekanjuUgovori.length > 0 && (
                    <>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#633806', background: '#FAEEDA', border: '1px solid #f59e0b', borderRadius: 8, padding: '8px 14px', marginBottom: 12 }}>
                        ⏳ Čekaju slikanje ili početnu naplatu ({cekanjuUgovori.length})
                      </div>
                      {cekanjuUgovori.map(u => {
                        const s = getUgovorStatus(u)
                        return (
                          <div key={u.id} style={{ ...card, borderLeft: '4px solid #f59e0b' }}>
                            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{u.br_tablica} — {u.ime_prezime}</div>
                            <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 4 }}>REZ #{u.id} · {u.od_datuma} → {u.do_datuma}</div>
                            <div style={{ fontSize: 12, color: '#1D9E75', marginBottom: 10 }}>Naplaćeno: {u.naplaceno}€ | Duguje: {Math.max(0, (u.ukupno_naplata || 0) - (u.naplaceno || 0)).toFixed(2)}€</div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              {s.trebaSlika ? (
                                <label style={{ padding: '8px 14px', background: '#6b7280', color: '#fff', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                                  📸 Slikaj ugovor
                                  <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={e => handleUgovorUpload(e, u.id)} />
                                </label>
                              ) : (
                                <a href={u.ugovor_slika} target="_blank" rel="noopener noreferrer"
                                  style={{ padding: '8px 14px', background: '#E1F5EE', color: '#085041', borderRadius: 8, fontSize: 12, fontWeight: 600, textDecoration: 'none', border: '1px solid #1D9E75' }}>
                                  ✅ Ugovor OK
                                </a>
                              )}
                              {s.trebaNajam && s.trebaDepozit && (
                                <button onClick={() => zavediNajamIDepozit(u, s.fali, s.depozit)}
                                  style={{ padding: '8px 14px', background: '#185FA5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                                  ✅ Zaduži sve ({s.fali}€ + Dep {s.depozit}€)
                                </button>
                              )}
                              {s.trebaNajam && !s.trebaDepozit && (
                                <button onClick={() => zavediNajam(u, s.fali)}
                                  style={{ padding: '8px 14px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                                  💰 Kasa najam: {s.fali}€
                                </button>
                              )}
                              {s.trebaDepozit && !s.trebaNajam && (
                                <button onClick={() => zavediDepozit(u, s.depozit)}
                                  style={{ padding: '8px 14px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                                  🛡️ Kasa depozit: {s.depozit}€
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </>
                  )}

                  {dugDepUgovori.length > 0 && (
                    <>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#791F1F', background: '#FCEBEB', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 14px', marginBottom: 12, marginTop: 20 }}>
                        ⚠️ Naplata duga i povrat depozita ({dugDepUgovori.length})
                      </div>
                      {dugDepUgovori.map(u => {
                        const s = getUgovorStatus(u)
                        return (
                          <div key={u.id} style={{ ...card, borderLeft: '4px solid #dc2626' }}>
                            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{u.br_tablica} — {u.ime_prezime}</div>
                            <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 4 }}>REZ #{u.id} | Završeno preuzimanje</div>
                            <div style={{ fontSize: 12, color: '#dc2626', marginBottom: 10 }}>Fali u kasi: {s.fali}€</div>
                            <div style={{ display: 'flex', gap: 8 }}>
                              {s.trebaDug && (
                                <button onClick={() => zavediDug(u, s.fali)}
                                  style={{ padding: '8px 14px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                                  💰 U kasu naplata: {s.fali}€
                                </button>
                              )}
                              {s.trebaDepVracen && (
                                <button onClick={() => zavediPovratDep(u, s.vracenDep)}
                                  style={{ padding: '8px 14px', background: '#f59e0b', color: '#000', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                                  🛡️ U kasu povrat: -{s.vracenDep}€
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </>
                  )}

                  {zavrsenoUgovori.length > 0 && (
                    <>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#085041', marginBottom: 12, marginTop: 20 }}>Istorija završenih ugovora</div>
                      {zavrsenoUgovori.slice(0, 15).map(u => (
                        <div key={u.id} style={{ ...card, borderLeft: '4px solid #1D9E75' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 14 }}>{u.br_tablica} — {u.ime_prezime}</div>
                              <div style={{ fontSize: 11, color: '#9ca3af' }}>REZ #{u.id} · {u.od_datuma} → {u.do_datuma}</div>
                            </div>
                            {u.ugovor_slika ? (
                              <a href={u.ugovor_slika} target="_blank" rel="noopener noreferrer"
                                style={{ padding: '6px 12px', background: '#E1F5EE', color: '#085041', border: '1px solid #1D9E75', borderRadius: 8, fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
                                ✅ Pogledaj
                              </a>
                            ) : (
                              <label style={{ padding: '6px 12px', background: '#f9fafb', color: '#6b7280', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}>
                                📸 Dodaj ugovor
                                <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={e => handleUgovorUpload(e, u.id)} />
                              </label>
                            )}
                          </div>
                        </div>
                      ))}
                    </>
                  )}

                  {ugovori.length === 0 && (
                    <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af', fontSize: 13 }}>Nema ugovora.</div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ─── TAB: PRIJAVA ─── */}
          {activeTab === 'prijava' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div style={card}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#111', marginBottom: 16 }}>Provjera vozila</div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label style={lbl}>Tablice vozila</label>
                    <input list="voz-prijava" value={prijavaVozilo} onChange={e => setPrijavaVozilo(e.target.value)} placeholder="Ukucaj tablice..." style={inp} />
                    <datalist id="voz-prijava">{vozila.map(v => <option key={v.br_tablica} value={v.br_tablica}>{v.agregirani_2}</option>)}</datalist>
                  </div>
                  <button onClick={() => { setPrijavaVozilo(''); setPrijavaPokazano(false) }}
                    style={{ alignSelf: 'flex-end', padding: '8px 14px', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: '#374151' }}>✕</button>
                </div>

                {prijavaPokazano && (
                  <>
                    <label style={{ display: 'block', border: '1px dashed #d1d5db', borderRadius: 8, padding: '14px', textAlign: 'center', cursor: 'pointer', background: '#f9fafb', marginBottom: 14 }}>
                      <div style={{ fontSize: 20, marginBottom: 4 }}>📸</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280' }}>Dodaj slike vozila</div>
                      <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleMultiUpload} />
                      <div style={{ fontSize: 11, color: '#1D9E75', marginTop: 4 }}>{prijavaUploadInfo}</div>
                      {prijavaProgress > 0 && (
                        <div style={{ marginTop: 8, height: 5, background: '#e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
                          <div style={{ height: '100%', background: '#1D9E75', width: `${prijavaProgress}%`, transition: '0.3s' }} />
                        </div>
                      )}
                    </label>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                      {([['ulje', 'Provjera ulja'], ['antifriz', 'Rashladna tečnost'], ['brisaci', 'Tečnost za brisače'], ['svetla', 'Signalizacija/Svjetla'], ['klima', 'Klima uređaj'], ['brave', 'Brave / Vrata-Gepek'], ['enterijer', 'Enterijer / Čistoća']] as [keyof typeof checks, string][]).map(([key, label]) => (
                        <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: checks[key] ? '#E1F5EE' : '#f9fafb', borderRadius: 8, border: `1px solid ${checks[key] ? '#1D9E75' : '#e5e7eb'}` }}>
                          <label style={{ fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>{label}</label>
                          <input type="checkbox" checked={checks[key]} onChange={e => setChecks(c => ({ ...c, [key]: e.target.checked }))} style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#1D9E75' }} />
                        </div>
                      ))}
                    </div>

                    <div style={{ marginBottom: 14 }}>
                      <label style={lbl}>Komentar</label>
                      <textarea value={prijavaKomentar} onChange={e => setPrijavaKomentar(e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' as const }} />
                    </div>

                    <button onClick={savePrijava} disabled={prijavaSaving}
                      style={{ width: '100%', padding: '11px', background: prijavaSaving ? '#5DCAA5' : '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                      {prijavaSaving ? '⏳...' : 'UPIŠI PROVJERU'}
                    </button>
                  </>
                )}

                <div style={{ marginTop: 14, borderTop: '1px solid #f3f4f6', paddingTop: 14 }}>
                  <button onClick={() => setShowSveProvjere(s => !s)}
                    style={{ width: '100%', padding: '9px', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer', fontSize: 12, color: '#374151', fontWeight: 500 }}>
                    {showSveProvjere ? 'Sakrij pretragu' : 'Pretraži sve provjere'}
                  </button>
                  {showSveProvjere && (
                    <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                      <input value={pretragaVozilo} onChange={e => setPretragaVozilo(e.target.value)} placeholder="Tablice..." style={{ ...inp, flex: 1 }} />
                      <input value={pretragaAgent} onChange={e => setPretragaAgent(e.target.value)} placeholder="Agent..." style={{ ...inp, flex: 1 }} />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#111', marginBottom: 12 }}>Historija provjera</div>
                {provjere.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af', fontSize: 13, border: '1px dashed #e5e7eb', borderRadius: 10 }}>Unesi tablice za prikaz.</div>
                ) : provjere.map(p => (
                  <div key={p.id} style={card}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <strong style={{ fontSize: 14 }}>{p.tablice}</strong>
                      <span style={{ fontSize: 11, color: '#9ca3af' }}>{p.datum}</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 8 }}>Agent: {p.agent}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, marginBottom: 8 }}>
                      {[['ULJE', p.ulje], ['ANTIFRIZ', p.antifriz], ['BRISAČI', p.tecnost_brisaci], ['SVJETLA', p.svetla], ['KLIMA', p.klima], ['BRAVE', p.brave], ['ENTERIJER', p.enterijer]].map(([l, ok]) => (
                        <div key={l as string} style={{ background: ok ? '#E1F5EE' : '#FCEBEB', color: ok ? '#085041' : '#791F1F', padding: '3px 6px', borderRadius: 6, fontSize: 10, fontWeight: 700, textAlign: 'center' }}>{l as string}</div>
                      ))}
                    </div>
                    {p.slike && (
                      <div style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
                        {p.slike.split(' ').filter(Boolean).map((s, i) => (
                          <img key={i} src={getDirectImg(s)} style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 8, border: '1px solid #e5e7eb', cursor: 'pointer', flexShrink: 0 }} onClick={() => window.open(s, '_blank')} alt="" />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─── TAB: PRANJE ─── */}
          {activeTab === 'pranje' && (
            <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 20 }}>
              <div style={card}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#111', marginBottom: 16 }}>Pošalji na pranje</div>
                <div style={{ marginBottom: 10 }}>
                  <label style={lbl}>Vozilo</label>
                  <input list="voz-pranje" value={pranjeVozilo} onChange={e => setPranjeVozilo(e.target.value)} placeholder="Tablice..." style={inp} />
                  <datalist id="voz-pranje">{vozila.map(v => <option key={v.br_tablica} value={v.br_tablica}>{v.agregirani_2}</option>)}</datalist>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={lbl}>Naplaćuje se?</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {(['DA', 'NE'] as const).map(v => (
                      <button key={v} onClick={() => setPranjeNaplaceno(v)}
                        style={{ flex: 1, padding: '9px', border: `1px solid ${pranjeNaplaceno === v ? '#1D9E75' : '#e5e7eb'}`, borderRadius: 8, background: pranjeNaplaceno === v ? '#E1F5EE' : '#fff', color: pranjeNaplaceno === v ? '#085041' : '#6b7280', cursor: 'pointer', fontWeight: pranjeNaplaceno === v ? 600 : 400, fontSize: 13 }}>
                        {v === 'DA' ? 'Da' : 'Ne'}
                      </button>
                    ))}
                  </div>
                </div>
                {pranjeNaplaceno === 'NE' && (
                  <div style={{ marginBottom: 10 }}>
                    <label style={lbl}>Razlog</label>
                    <textarea value={pranjeRazlog} onChange={e => setPranjeRazlog(e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' as const }} />
                  </div>
                )}
                <button onClick={savePranje} disabled={pranjeSaving}
                  style={{ width: '100%', padding: '11px', background: pranjeSaving ? '#5DCAA5' : '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  {pranjeSaving ? '⏳...' : 'POŠALJI NA PRANJE'}
                </button>
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#111', marginBottom: 12 }}>Na čekanju</div>
                {pranja.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af', fontSize: 13, border: '1px dashed #e5e7eb', borderRadius: 10 }}>Nema vozila na pranju.</div>
                ) : pranja.map(p => (
                  <div key={p.id} style={card}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{p.vozilo}</div>
                        <div style={{ fontSize: 12, color: '#9ca3af' }}>{p.agent} · {p.datum_tekst}</div>
                        {p.Kommentar && <div style={{ fontSize: 12, color: '#f59e0b', marginTop: 4 }}>📝 {p.Kommentar}</div>}
                      </div>
                      {PERACI.includes(agentEmail) ? (
                        <button onClick={() => completePranje(p.id, p.vozilo)}
                          style={{ padding: '8px 16px', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>ZAVRŠI</button>
                      ) : (
                        <button onClick={() => agentPrao(p.id, p.vozilo)}
                          style={{ padding: '8px 14px', background: '#FAEEDA', color: '#633806', border: '1px solid #f59e0b', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>JA OPRAO</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─── TAB: VOZILO ─── */}
          {activeTab === 'vozilo' && (
            <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 20 }}>
              <div style={card}>
                {aktivnoKor ? (
                  <>
                    <div style={{ background: '#FAEEDA', border: '1px solid #f59e0b', borderRadius: 10, padding: '14px 18px', marginBottom: 14, textAlign: 'center' }}>
                      <div style={{ fontSize: 11, color: '#633806', marginBottom: 4 }}>AKTIVNO VOZILO</div>
                      <div style={{ fontSize: 26, fontWeight: 900, color: '#633806' }}>{aktivnoKor.tablice}</div>
                    </div>
                    <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 14 }}>
                      📍 {aktivnoKor.destinacija}<br />🕒 {aktivnoKor.vreme_zaduzenja}
                    </div>
                    <div style={{ marginBottom: 14 }}>
                      <label style={lbl}>Krajnje KM stanje *</label>
                      <input type="number" value={kmEnd} onChange={e => setKmEnd(e.target.value)} placeholder="KM..." style={inp} />
                    </div>
                    <button onClick={() => finishPrivate(aktivnoKor.id, aktivnoKor.km_start)}
                      style={{ width: '100%', padding: '11px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                      RAZDUŽI VOZILO
                    </button>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#111', marginBottom: 16 }}>Zaduži vozilo</div>
                    <div style={{ marginBottom: 10 }}>
                      <label style={lbl}>Vozilo</label>
                      <input list="voz-priv" value={privVozilo} onChange={e => setPrivVozilo(e.target.value)} placeholder="Tablice..." style={inp} />
                      <datalist id="voz-priv">{vozila.map(v => <option key={v.br_tablica} value={v.br_tablica}>{v.agregirani_2}</option>)}</datalist>
                    </div>
                    <div style={{ marginBottom: 10 }}>
                      <label style={lbl}>Početna KM stanja</label>
                      <input type="number" value={kmStart} onChange={e => setKmStart(e.target.value)} placeholder="Npr. 45230" style={inp} />
                    </div>
                    <div style={{ marginBottom: 14 }}>
                      <label style={lbl}>Destinacija</label>
                      <input value={privDest} onChange={e => setPrivDest(e.target.value)} placeholder="Npr. Aerodrom" style={inp} />
                    </div>
                    <button onClick={startPrivate} disabled={vozSaving}
                      style={{ width: '100%', padding: '11px', background: vozSaving ? '#5DCAA5' : '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                      {vozSaving ? '⏳...' : 'ZADUŽI VOZILO'}
                    </button>
                  </>
                )}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#111', marginBottom: 12 }}>Historija</div>
                {korHistory.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af', fontSize: 13, border: '1px dashed #e5e7eb', borderRadius: 10 }}>Nema historije.</div>
                ) : korHistory.map(k => (
                  <div key={k.id} style={card}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <strong>{k.tablice}</strong>
                      <span style={{ fontSize: 11, color: '#9ca3af' }}>{k.vreme_zaduzenja}</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>📍 {k.destinacija} · 📏 {k.predjena_km || 0} km</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─── TAB: SALDO ─── */}
          {activeTab === 'saldo' && (
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', fontSize: 13, fontWeight: 600, color: '#374151' }}>
                Moje transakcije
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    {['Kategorija', 'Vozilo', 'Datum', 'Iznos'].map(h => (
                      <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 500, fontSize: 12, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {prikazTrans.map(t => {
                    const iz = parseFloat(t.iznos as any || 0)
                    return (
                      <tr key={t.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '10px 14px', fontWeight: 500 }}>{t.kategorija}</td>
                        <td style={{ padding: '10px 14px', color: '#6b7280', fontSize: 12 }}>{t.vozilo}</td>
                        <td style={{ padding: '10px 14px', color: '#9ca3af', fontSize: 12 }}>{t.datum}</td>
                        <td style={{ padding: '10px 14px', fontWeight: 700, color: iz > 0 ? '#1D9E75' : '#dc2626' }}>
                          {iz > 0 ? '+' : ''}{iz.toFixed(2)}€
                        </td>
                      </tr>
                    )
                  })}
                  {prikazTrans.length === 0 && (
                    <tr><td colSpan={4} style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>Nema transakcija.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
