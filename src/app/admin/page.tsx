'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const UPLOAD_URL = '/api/upload'
const FOLDER_ID = '1gFiCAgolZu9fAn5d-Ngmsx9qp3hWdIkN'

type Tab = 'transakcije' | 'ugovori' | 'vozilo' | 'spisak' | 'potvrde'
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
type Vozilo = { id: number; license_plate: string; agregirani_2: string }
type KoriscenjeVozila = {
  id: string; email: string; tablice: string; km_start: number
  km_end?: number; predjena_km?: number; destinacija: string
  status: string; vreme_zaduzenja: string; timestamp_upisa: string
}

function getCookie(name: string): string {
  if (typeof document === 'undefined') return ''
  const match = document.cookie.match(new RegExp(`${name}=([^;]+)`))
  return match ? decodeURIComponent(match[1]) : ''
}

function genId(): string {
  return Date.now().toString() + Math.random().toString(36).slice(2, 6)
}

function normalize(s: string): string {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

function getDirectImg(url: string): string {
  if (!url || !url.includes('drive.google.com')) return url
  try {
    const id = url.includes('/d/') ? url.split('/d/')[1].split('/')[0] : url.split('id=')[1]
    return `https://lh3.googleusercontent.com/u/0/d/${id}`
  } catch { return url }
}

const FOTO_KAT = [
  'Gorivo (dodaj sliku racuna)', 'Gorivo', 'Djelovi (dodaj sliku racuna)',
  'Registracija vozila (dodaj sliku racuna)', 'Rata za vozilo (dodaj sliku potvrde)',
  'Parking (dodaj sliku racuna)', 'Doplata za kazne (dodaj sliku kazne)',
]

const DEFAULT_PRILIV = [
  'Izdavanje vozila','Naplata Duga','Depozit','Bonus','MOJ bonus',
  'MOJA dnevnica','Renta','Uplata duga prema FIRMI','Neutralni novcani tokovi',
  'PREUZETO IZ SANDUCETA','Prodaja vozila','Razmjena novca',
  'Razmjena novca medju nama','Refundacija (u komentaru dodaj razlog)','Ostalo',
]
const DEFAULT_ODLIV = [
  'Gorivo (dodaj sliku racuna)','Gorivo','Djelovi (dodaj sliku racuna)','Djelovi',
  'Servisiranje vozila','Servis','Registracija vozila (dodaj sliku racuna)',
  'Pranje','Pranje Planet','Parking (dodaj sliku racuna)','Parking',
  'Kazne i prekrsaji','Doplata za kazne (dodaj sliku kazne)','Doplata za oštetu',
  'Doplata za gorivo','Doplata za pranje','Povrat Depozita',
  'Provizije posrednicima','Putni troškovi','Taksi','Kirija',
  'Komunalije','Telekomunikacije','Kancelarijski materijal','Plata','MOJA plata',
  'Slepanje vozila','Uplata duga za službeno vozilo','Rata za vozilo (dodaj sliku potvrde)',
  'Marketing i oglasavanje','Osiguranje','Transfer','OSTAVLJENO U SANDUCE',
  'Neutralni novcani tok','DUG PREMA FIRMI ( u komentaru upisi iznos preostalog duga)',
  'Pozajmica (u komenatru upisi preostali dug)','Ostalo',
]

const inp: React.CSSProperties = { width: '100%', padding: '10px 12px', fontSize: 14, border: '1.5px solid #e5e7eb', borderRadius: 10, background: '#fff', color: '#111', boxSizing: 'border-box' }
const lbl: React.CSSProperties = { fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 }
const card: React.CSSProperties = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, marginBottom: 12 }

export default function FinansijePage() {
  const [activeTab, setActiveTab] = useState<Tab>('transakcije')
  const [agentEmail, setAgentEmail] = useState('')
  const [agentIme, setAgentIme] = useState('')
  const [allTrans, setAllTrans] = useState<Transakcija[]>([])
  const [vozila, setVozila] = useState<Vozilo[]>([])
  const [kolege, setKolege] = useState<{ email: string; ime: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [saldo, setSaldo] = useState(0)
  const [firmaDug, setFirmaDug] = useState(0)
  const [kmDug, setKmDug] = useState(0)
  const [pendingCount, setPendingCount] = useState(0)
  const [katPriliv, setKatPriliv] = useState<string[]>(DEFAULT_PRILIV)
  const [katOdliv, setKatOdliv] = useState<string[]>(DEFAULT_ODLIV)
  const [katLoaded, setKatLoaded] = useState(false)

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

  const [ugovori, setUgovori] = useState<Rezervacija[]>([])
  const [ugovoriLoading, setUgovoriLoading] = useState(false)
  const [uploadingRezId, setUploadingRezId] = useState<number | null>(null)

  const [aktivnoKor, setAktivnoKor] = useState<KoriscenjeVozila | null>(null)
  const [korHistory, setKorHistory] = useState<KoriscenjeVozila[]>([])
  const [privVozilo, setPrivVozilo] = useState('')
  const [kmStart, setKmStart] = useState('')
  const [privDest, setPrivDest] = useState('')
  const [kmEnd, setKmEnd] = useState('')
  const [vozSaving, setVozSaving] = useState(false)

  const [prikazTrans, setPrikazTrans] = useState<Transakcija[]>([])
  const [filterTip, setFilterTip] = useState<'sve' | 'priliv' | 'odliv'>('sve')
  const [filterSearch, setFilterSearch] = useState('')
  const [pendingTrans, setPendingTrans] = useState<Transakcija[]>([])

  useEffect(() => {
    async function loadKat() {
      try {
        const { data } = await supabase.from('konfiguracija').select('*').eq('id', 'kategorije_transakcija').maybeSingle()
        if (data) {
          if (Array.isArray(data.priliv) && data.priliv.length > 0) setKatPriliv(data.priliv)
          if (Array.isArray(data.odliv) && data.odliv.length > 0) setKatOdliv(data.odliv)
        }
      } catch {}
      setKatLoaded(true)
    }
    loadKat()
  }, [])

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
    const { data: transMoje } = await supabase
      .from('transakcije').select('*')
      .or(`osobaemail.eq.${email},primaocemail.eq.${email}`)
      .order('timestamp_upisa', { ascending: false }).limit(300)
    const trans = transMoje || []
    setAllTrans(trans)

    const { data: v } = await supabase.from('vozila_fleet').select('id, license_plate, agregirani_2').order('agregirani_2')
    setVozila(v || [])

    const { data: agents } = await supabase.from('agents').select('email, full_name').eq('is_active', true)
    setKolege((agents || []).filter((a: any) => a.email !== email).map((a: any) => ({ email: a.email, ime: a.full_name })))

    let s = 0, df = 0, uKm = 0
    const prikazano: Transakcija[] = []
    const pending: Transakcija[] = []

    trans.forEach(t => {
      const kat = (t.kategorija || '').toUpperCase()
      const sE = (t.osobaemail || '').toLowerCase().trim()
      const pE = (t.primaocemail || '').toLowerCase().trim()
      const emailL = email.toLowerCase()

      if ((t.status || 'Zavrseno').toLowerCase() !== 'zavrseno') {
        if ((t.status || '').toLowerCase() === 'na cekanju' && pE === emailL) pending.push(t)
        if (sE === emailL || pE === emailL) prikazano.push(t)
        return
      }

      const iz = t.iznos || 0

      if (kat.includes('UPLAT') && kat.includes('VOZILO')) {
        if (sE === emailL) uKm += Math.abs(iz)
      } else if (kat.includes('OSTAVLJENO U SANDUCE') || kat.includes('PREUZETO IZ SANDUCETA')) {
        // Sandučić — ne ulazi u saldo agenta
      } else if (kat.includes('DUG PREMA FIRMI') && !kat.includes('UPLATA')) {
        if (sE === emailL) df += iz
        if (pE === emailL) df -= iz
      } else if (kat.includes('UPLATA DUGA PREMA FIRMI')) {
        if (sE === emailL) df -= iz
        if (pE === emailL) df += iz
      } else {
        if (sE === emailL) s += iz
        if (pE === emailL) s -= iz
      }
      if (sE === emailL || pE === emailL) prikazano.push(t)
    })
    setSaldo(s); setFirmaDug(df)
    setPrikazTrans(prikazano); setPendingTrans(pending); setPendingCount(pending.length)

    const { data: km } = await supabase.from('koristenje').select('*').ilike('email', email).order('timestamp_upisa', { ascending: false })
    const svaKor = km || []
    let totalPredjeno = 0
    svaKor.forEach((k: any) => {
      if ((k.status || '').trim() !== 'Aktivno') totalPredjeno += parseFloat(k.predjena_km || k.kilometraza || 0)
    })
    setKmDug(((totalPredjeno / 100) * 1.44 * 8) - uKm)
    setAktivnoKor(svaKor.find((k: any) => (k.status || '').trim() === 'Aktivno') || null)
    setKorHistory(svaKor.filter((k: any) => (k.status || '').trim() !== 'Aktivno').slice(0, 10))
    setLoading(false)
  }, [])

  const loadUgovori = useCallback(async () => {
    if (!agentIme) return
    setUgovoriLoading(true)
    const imeNorm = normalize(agentIme)
    const { data } = await supabase.from('rezervacije').select('*').order('id', { ascending: false }).limit(200)
    const filtered = (data || []).filter((u: any) =>
      normalize(u.ko_je_izdao || '') === imeNorm || normalize(u.ko_je_preuzeo || '') === imeNorm
    )
    setUgovori(filtered)
    setUgovoriLoading(false)
  }, [agentIme])

  useEffect(() => {
    if (activeTab === 'ugovori' && agentIme) loadUgovori()
  }, [activeTab, agentIme, loadUgovori])

  async function uploadSlika(file: File, naziv: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1]
        try {
          const res = await fetch(UPLOAD_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ base64, contentType: file.type, name: naziv, folderId: FOLDER_ID }) })
          const json = await res.json()
          if (json.status === 'success') resolve(json.url)
          else reject(new Error('Upload failed'))
        } catch (e) { reject(e) }
      }
      reader.onerror = () => reject(new Error('File read error'))
    })
  }

  async function handleFotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setUploadStatus('⏳ Uploading...')
    try {
      const url = await uploadSlika(file, `RACUN_${Date.now()}`)
      setPhotoUrl(url); setUploadStatus('✅ Slika dodana')
    } catch { setUploadStatus('❌ Greška') }
  }

  async function handleUgovorUpload(e: React.ChangeEvent<HTMLInputElement>, rezId: number) {
    const file = e.target.files?.[0]; if (!file) return
    setUploadingRezId(rezId)
    try {
      const url = await uploadSlika(file, `UGOVOR_${rezId}_${Date.now()}`)
      await supabase.from('rezervacije').update({ ugovor_slika: url }).eq('id', rezId)
      alert('✅ Ugovor uploadovan!'); loadUgovori()
    } catch { alert('❌ Greška pri uploadu') }
    setUploadingRezId(null); e.target.value = ''
  }

  async function saveTransakcija() {
    const izVal = parseFloat(iznos)
    if (!izVal || !kategorija) { alert('Unesite iznos i kategoriju!'); return }
    if (!agentEmail) { alert('Email nije učitan.'); return }
    if (FOTO_KAT.includes(kategorija) && !photoUrl) { alert('⚠️ Ova kategorija zahtijeva sliku računa! Dodajte sliku prije unosa.'); return }
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
    }])
    setIznos(''); setKomentar(''); setVoziloUnos(''); setPhotoUrl(''); setUploadStatus(''); setPrimaoc('')
    setUnosSaving(false); alert('Upisano!'); loadAll(agentEmail, agentIme)
  }

  function getUgovorStatus(u: Rezervacija) {
    const imeNorm = normalize(agentIme)
    const isIzdao = normalize(u.ko_je_izdao) === imeNorm
    const isPreuzeo = normalize(u.ko_je_preuzeo) === imeNorm
    const fazaReturn = !!u.ko_je_preuzeo
    const uTrans = allTrans.filter(t => t.komentar?.includes(`REZ #${u.id}`))
    const upisanNajam = uTrans.filter(t => t.tip_transakcije === 'priliv' && ['Izdavanje vozila','Naplata Duga'].includes(t.kategorija)).reduce((s, t) => s + Math.abs(parseFloat(t.iznos as any || 0)), 0)
    const depUzetUKasi = uTrans.some(t => t.tip_transakcije === 'priliv' && t.kategorija === 'Depozit')
    const depVracenIzKase = uTrans.some(t => t.tip_transakcije === 'odliv' && t.kategorija === 'Povrat Depozita')
    const fali = Math.max(0, (u.naplaceno || 0) - upisanNajam)
    return { isIzdao, isPreuzeo, fazaReturn, depozit: u.depozit || 0, vracenDep: u.vraceni_depozit_iznos || 0, fali, trebaSlika: !u.ugovor_slika && isIzdao, trebaNajam: fali > 0.01 && !fazaReturn && isIzdao, trebaDepozit: u.depozit_uzet && !depUzetUKasi && isIzdao, trebaDug: fali > 0.01 && fazaReturn && isPreuzeo, trebaDepVracen: u.depozit_vracen && (u.vraceni_depozit_iznos || 0) > 0 && !depVracenIzKase && isPreuzeo }
  }

  async function trInsert(tip_t: 'priliv' | 'odliv', kat: string, iznT: number, voz: string, kom: string) {
    await supabase.from('transakcije').insert([{ id: genId(), tip_transakcije: tip_t, datum: new Date().toISOString().split('T')[0], kategorija: kat, iznos: tip_t === 'odliv' ? -Math.abs(iznT) : Math.abs(iznT), vozilo: voz, komentar: kom, osoba: agentIme, osobaemail: agentEmail, timestamp_upisa: new Date().toISOString(), status: 'Zavrseno' }])
  }

  async function zavediNajam(u: Rezervacija, iznT: number) {
    if (!confirm(`Zaduži ${iznT}€?`)) return
    await trInsert('priliv', 'Izdavanje vozila', iznT, u.br_tablica, `Početna naplata pri izdavanju (Ugovor REZ #${u.id}).`)
    loadAll(agentEmail, agentIme); loadUgovori()
  }

  async function zavediDepozit(u: Rezervacija, iznT: number) {
    if (!confirm(`Zaduži depozit ${iznT}€?`)) return
    await trInsert('priliv', 'Depozit', iznT, u.br_tablica, `Uzet depozit pri izdavanju (Ugovor REZ #${u.id})`)
    loadAll(agentEmail, agentIme); loadUgovori()
  }

  async function zavediNajamIDepozit(u: Rezervacija, najam: number, dep: number) {
    if (!confirm(`Zaduži NAJAM (${najam}€) i DEPOZIT (${dep}€)?`)) return
    await supabase.from('transakcije').insert([
      { id: genId()+'1', tip_transakcije: 'priliv', datum: new Date().toISOString().split('T')[0], kategorija: 'Izdavanje vozila', iznos: najam, vozilo: u.br_tablica, komentar: `Naplata pri izdavanju (Ugovor REZ #${u.id})`, osoba: agentIme, osobaemail: agentEmail, timestamp_upisa: new Date().toISOString(), status: 'Zavrseno' },
      { id: genId()+'2', tip_transakcije: 'priliv', datum: new Date().toISOString().split('T')[0], kategorija: 'Depozit', iznos: dep, vozilo: u.br_tablica, komentar: `Uzet depozit (Ugovor REZ #${u.id})`, osoba: agentIme, osobaemail: agentEmail, timestamp_upisa: new Date().toISOString(), status: 'Zavrseno' },
    ])
    loadAll(agentEmail, agentIme); loadUgovori()
  }

  async function zavediDug(u: Rezervacija, iznT: number) {
    if (!confirm(`Zaduži dug ${iznT}€?`)) return
    await trInsert('priliv', 'Naplata Duga', iznT, u.br_tablica, `Naplata duga pri preuzimanju (Ugovor REZ #${u.id})`)
    loadAll(agentEmail, agentIme); loadUgovori()
  }

  async function zavediPovratDep(u: Rezervacija, iznT: number) {
    if (!confirm(`Razdužuješ ${iznT}€ za povrat depozita?`)) return
    await trInsert('odliv', 'Povrat Depozita', iznT, u.br_tablica, `Vraćen depozit (Ugovor REZ #${u.id})`)
    loadAll(agentEmail, agentIme); loadUgovori()
  }

  async function startPrivate() {
    if (!privVozilo || !kmStart) { alert('Unesite vozilo i KM!'); return }
    const vozilo = vozila.find(v => v.license_plate === privVozilo || normalize(v.agregirani_2 || '').includes(normalize(privVozilo)))
    const tablice = vozilo?.agregirani_2 || privVozilo.toUpperCase()
    setVozSaving(true)
    const { error } = await supabase.from('koristenje').insert([{ id: genId(), email: agentEmail, ime_prezime: agentIme, tablice, km_start: parseFloat(kmStart), kilometraza: 0, destinacija: privDest, status: 'Aktivno', vreme_zaduzenja: new Date().toLocaleString('sr-RS'), timestamp_upisa: new Date().toISOString() }])
    if (error) { alert('Greška: ' + error.message); setVozSaving(false); return }
    setPrivVozilo(''); setKmStart(''); setPrivDest('')
    setVozSaving(false); loadAll(agentEmail, agentIme)
  }

  async function finishPrivate(id: string, kmS: number) {
    if (!kmEnd) { alert('Unesite krajnje KM!'); return }
    const km_end = parseFloat(kmEnd)
    const predjena = kmS > 0 ? km_end - kmS : km_end
    await supabase.from('koristenje').update({ km_end, predjena_km: predjena, kilometraza: predjena, status: 'Završeno', vreme_povratka: new Date().toLocaleString('sr-RS') }).eq('id', id)
    setKmEnd(''); loadAll(agentEmail, agentIme)
  }

  async function confirmTrans(id: string) {
    await supabase.from('transakcije').update({ status: 'Zavrseno' }).eq('id', id)
    loadAll(agentEmail, agentIme)
  }

  // Helper za naziv kolege po emailu
  function getImeByEmail(email: string): string {
    if (!email) return '/'
    const k = kolege.find(k => k.email.toLowerCase() === email.toLowerCase())
    return k?.ime || email.split('@')[0]
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>Učitavanje...</div>

  const needsFoto = FOTO_KAT.includes(kategorija)
  const isRazmjena = kategorija.toLowerCase().includes('razmjena')
  const katOptions = tip === 'priliv' ? katPriliv : katOdliv

  const sortedTrans = [...prikazTrans].sort((a, b) =>
    new Date(b.timestamp_upisa || b.datum || 0).getTime() - new Date(a.timestamp_upisa || a.datum || 0).getTime()
  )
  const filteredTrans = sortedTrans.filter(t => {
    const matchTip = filterTip === 'sve' || t.tip_transakcije === filterTip
    const matchSearch = !filterSearch || normalize(t.kategorija).includes(normalize(filterSearch)) || normalize(t.vozilo || '').includes(normalize(filterSearch))
    return matchTip && matchSearch
  })

  const cekanjuUgovori = ugovori.filter(u => { const s = getUgovorStatus(u); return s.trebaSlika || s.trebaNajam || s.trebaDepozit })
  const dugDepUgovori = ugovori.filter(u => { const s = getUgovorStatus(u); return s.trebaDug || s.trebaDepVracen })
  const zavrsenoUgovori = ugovori.filter(u => { const s = getUgovorStatus(u); return !s.trebaSlika && !s.trebaNajam && !s.trebaDepozit && !s.trebaDug && !s.trebaDepVracen })

  const TABS: { id: Tab; label: string; badge?: number }[] = [
    { id: 'transakcije', label: '💸' },
    { id: 'ugovori', label: '📄', badge: (cekanjuUgovori.length + dugDepUgovori.length) || undefined },
    { id: 'vozilo', label: '🚗' },
    { id: 'spisak', label: '📊' },
    { id: 'potvrde', label: '🔔', badge: pendingCount || undefined },
  ]

  const TAB_LABELS: Record<Tab, string> = {
    transakcije: '💸 Transakcije',
    ugovori: '📄 Ugovori',
    vozilo: '🚗 Vozilo',
    spisak: '📊 Spisak',
    potvrde: '🔔 Potvrde',
  }

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 0 80px' }}>
      <style>{`
        @media (max-width: 640px) {
          .fin-grid { grid-template-columns: 1fr !important; }
          .saldo-grid { grid-template-columns: 1fr 1fr !important; }
        }
        input:focus, select:focus, textarea:focus { border-color: #1D9E75 !important; outline: none; box-shadow: 0 0 0 3px rgba(29,158,117,0.1); }
      `}</style>

      {/* HEADER */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '14px 16px', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#111' }}>Finansije</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>{agentIme}</div>
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: saldo >= 0 ? '#085041' : '#dc2626', background: saldo >= 0 ? '#E1F5EE' : '#FCEBEB', padding: '6px 14px', borderRadius: 20 }}>
            SALDO: {saldo.toFixed(2)}€
          </div>
        </div>

        {/* Mini saldo kartica */}
        <div className="saldo-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
          <div style={{ background: saldo >= 0 ? '#E1F5EE' : '#FCEBEB', borderRadius: 10, padding: '8px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: '#6b7280', fontWeight: 700, textTransform: 'uppercase' }}>Saldo</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: saldo >= 0 ? '#085041' : '#dc2626' }}>{saldo.toFixed(0)}€</div>
          </div>
          <div style={{ background: '#FAEEDA', borderRadius: 10, padding: '8px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: '#6b7280', fontWeight: 700, textTransform: 'uppercase' }}>Firma dug</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#633806' }}>{firmaDug.toFixed(0)}€</div>
          </div>
          <div style={{ background: '#E6F1FB', borderRadius: 10, padding: '8px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: '#6b7280', fontWeight: 700, textTransform: 'uppercase' }}>KM dug</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#0C447C' }}>{kmDug.toFixed(0)}€</div>
          </div>
        </div>

        {/* TABS */}
        <div style={{ display: 'flex', borderRadius: 10, background: '#f3f4f6', padding: 3, gap: 2 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{ flex: 1, padding: '8px 4px', fontSize: 18, border: 'none', borderRadius: 8, background: activeTab === t.id ? '#fff' : 'transparent', cursor: 'pointer', position: 'relative', boxShadow: activeTab === t.id ? '0 1px 4px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.15s' }}>
              {t.label}
              {t.badge ? <span style={{ position: 'absolute', top: 2, right: 2, background: '#dc2626', color: '#fff', borderRadius: '50%', width: 16, height: 16, fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{t.badge}</span> : null}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', textAlign: 'center', marginTop: 6 }}>{TAB_LABELS[activeTab]}</div>
      </div>

      <div style={{ padding: '16px' }}>

        {/* ═══ TRANSAKCIJE ═══ */}
        {activeTab === 'transakcije' && (
          <div>
            {/* Nova transakcija */}
            <div style={card}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#111', marginBottom: 14 }}>Nova transakcija</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                <button onClick={() => { setTip('priliv'); setKategorija('') }} style={{ padding: '12px', border: `2px solid ${tip === 'priliv' ? '#1D9E75' : '#e5e7eb'}`, borderRadius: 10, background: tip === 'priliv' ? '#E1F5EE' : '#fff', color: tip === 'priliv' ? '#085041' : '#6b7280', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>↑ PRILIV</button>
                <button onClick={() => { setTip('odliv'); setKategorija('') }} style={{ padding: '12px', border: `2px solid ${tip === 'odliv' ? '#dc2626' : '#e5e7eb'}`, borderRadius: 10, background: tip === 'odliv' ? '#FCEBEB' : '#fff', color: tip === 'odliv' ? '#dc2626' : '#6b7280', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>↓ ODLIV</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div><label style={lbl}>Datum</label><input type="date" value={datum} onChange={e => setDatum(e.target.value)} style={inp} /></div>
                <div><label style={lbl}>Iznos (€) *</label><input type="number" step="0.01" value={iznos} onChange={e => setIznos(e.target.value)} placeholder="0.00" style={{ ...inp, fontWeight: 700, fontSize: 16 }} /></div>
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={lbl}>Kategorija *</label>
                <select value={kategorija} onChange={e => setKategorija(e.target.value)} style={inp}>
                  <option value="">-- Odaberi --</option>
                  {katOptions.map(k => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>
              {isRazmjena && (
                <div style={{ marginBottom: 10, background: '#E6F1FB', border: '1px solid #85B7EB', borderRadius: 10, padding: 12 }}>
                  <label style={{ ...lbl, color: '#0C447C' }}>Pošalji kolegi</label>
                  <select value={primaoc} onChange={e => setPrimaoc(e.target.value)} style={inp}>
                    <option value="">→ Izaberi kolegu...</option>
                    {kolege.map(k => <option key={k.email} value={k.email}>{k.ime}</option>)}
                  </select>
                </div>
              )}
              <div style={{ marginBottom: 10 }}>
                <label style={lbl}>Vozilo</label>
                <input list="voz-unos" value={voziloUnos} onChange={e => setVoziloUnos(e.target.value)} placeholder="Pretraži po tablicama..." style={inp} />
                <datalist id="voz-unos">{vozila.map(v => <option key={v.id} value={v.license_plate || ''}>{v.agregirani_2}</option>)}</datalist>
              </div>
              {needsFoto && (
                <div style={{ border: '1px dashed #1D9E75', borderRadius: 10, padding: 12, marginBottom: 10, background: '#f9fafb' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#1D9E75', marginBottom: 8 }}>📎 OBAVEZNA SLIKA RAČUNA</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <label style={{ flex: 1, background: '#E1F5EE', border: '1px solid #1D9E75', padding: '10px', borderRadius: 10, textAlign: 'center', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#085041' }}>📷 Slikaj<input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFotoUpload} /></label>
                    <label style={{ flex: 1, background: '#E1F5EE', border: '1px solid #1D9E75', padding: '10px', borderRadius: 10, textAlign: 'center', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#085041' }}>🖼️ Dodaj<input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFotoUpload} /></label>
                  </div>
                  {uploadStatus && <div style={{ fontSize: 12, marginTop: 6, color: uploadStatus.includes('✅') ? '#1D9E75' : '#dc2626', fontWeight: 600 }}>{uploadStatus}</div>}
                  {photoUrl && <img src={getDirectImg(photoUrl)} style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 8, marginTop: 8, cursor: 'pointer' }} onClick={() => window.open(photoUrl, '_blank')} alt="račun" />}
                </div>
              )}
              <div style={{ marginBottom: 14 }}>
                <label style={lbl}>Napomena</label>
                <textarea value={komentar} onChange={e => setKomentar(e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' as const }} />
              </div>
              <button onClick={saveTransakcija} disabled={unosSaving || (FOTO_KAT.includes(kategorija) && !photoUrl)} style={{ width: '100%', padding: '13px', background: unosSaving ? '#5DCAA5' : (FOTO_KAT.includes(kategorija) && !photoUrl) ? '#9ca3af' : tip === 'priliv' ? '#1D9E75' : '#dc2626', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: (FOTO_KAT.includes(kategorija) && !photoUrl) ? 'not-allowed' : 'pointer' }}>
                {unosSaving ? '⏳ Snimam...' : (FOTO_KAT.includes(kategorija) && !photoUrl) ? '📎 Dodaj sliku računa!' : tip === 'priliv' ? '↑ UPIŠI PRILIV' : '↓ UPIŠI ODLIV'}
              </button>
            </div>

            {/* Zadnje transakcije */}
            <div style={card}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#111', marginBottom: 12 }}>Zadnje transakcije</div>
              {sortedTrans.slice(0, 15).map(t => {
                const iz = parseFloat(t.iznos as any || 0)
                const slikaUrl = t.komentar?.match(/https?:\/\/\S+/)?.[0]
                const jeSlao = (t.osobaemail || '').toLowerCase() === agentEmail.toLowerCase()
                const isPril = (t.tip_transakcije || '').toLowerCase() === 'priliv'
                const jePending = (t.status || '').toLowerCase() === 'na cekanju'

                // Razmjena logika
                const jeRazmjenaT = (t.kategorija || '').toLowerCase().includes('razmjena')
                let razmjenaInfo = ''
                if (jeRazmjenaT) {
                  if (jeSlao && t.primaocemail) razmjenaInfo = `→ ${getImeByEmail(t.primaocemail)}`
                  else if (!jeSlao) razmjenaInfo = `← od ${getImeByEmail(t.osobaemail)}`
                }
                // Prikazni iznos: ako je razmjena i nisi slao (primio si), prikaži pozitivno
                const prikazIz = (jeRazmjenaT && !jeSlao) ? Math.abs(iz) : iz
                const prikazBoja = prikazIz >= 0 ? '#1D9E75' : '#dc2626'

                return (
                  <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f3f4f6', opacity: jePending ? 0.7 : 1 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#111', marginBottom: 2 }}>
                        {t.kategorija}
                        {jePending && <span style={{ marginLeft: 6, fontSize: 10, background: '#FAEEDA', color: '#633806', padding: '1px 6px', borderRadius: 10, fontWeight: 700 }}>⏳ čeka</span>}
                      </div>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>
                        {t.vozilo && t.vozilo !== 'OPŠTE' ? t.vozilo + ' · ' : ''}{t.datum}
                        {razmjenaInfo && <span style={{ color: '#185FA5', fontWeight: 600 }}> {razmjenaInfo}</span>}
                      </div>
                      {t.komentar && !t.komentar.startsWith('http') && (
                        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, maxWidth: 200 }}>
                          {t.komentar.replace(/https?:\/\/\S+/g, '').trim()}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      {slikaUrl && <img src={getDirectImg(slikaUrl)} style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 6, border: '1px solid #e5e7eb', cursor: 'pointer' }} onClick={() => window.open(slikaUrl, '_blank')} alt="" />}
                      <div style={{ fontSize: 15, fontWeight: 800, color: prikazBoja, textAlign: 'right' as const }}>
                        {prikazIz >= 0 ? '+' : ''}{prikazIz.toFixed(2)}€
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ═══ UGOVORI ═══ */}
        {activeTab === 'ugovori' && (
          <div>
            {ugovoriLoading ? <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>Učitavanje...</div> : (<>
              {cekanjuUgovori.length > 0 && (<>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#633806', background: '#FAEEDA', border: '1px solid #f59e0b', borderRadius: 10, padding: '8px 14px', marginBottom: 10 }}>⏳ Čekaju akciju ({cekanjuUgovori.length})</div>
                {cekanjuUgovori.map(u => { const s = getUgovorStatus(u); return (
                  <div key={u.id} style={{ ...card, borderLeft: '4px solid #f59e0b' }}>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>{u.br_tablica} — {u.ime_prezime}</div>
                    <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 6 }}>REZ #{u.id} · {u.od_datuma} → {u.do_datuma}</div>
                    <div style={{ fontSize: 12, color: '#1D9E75', marginBottom: 10 }}>Naplaćeno: {u.naplaceno}€ · Duguje: {Math.max(0,(u.ukupno_naplata||0)-(u.naplaceno||0)).toFixed(2)}€</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
                      {s.trebaSlika ? (
                        <label style={{ padding: '10px 14px', background: '#6b7280', color: '#fff', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                          {uploadingRezId === u.id ? '⏳...' : '📸 Slikaj ugovor'}
                          <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={e => handleUgovorUpload(e, u.id)} />
                        </label>
                      ) : (
                        <a href={u.ugovor_slika} target="_blank" rel="noopener noreferrer" style={{ padding: '10px 14px', background: '#E1F5EE', color: '#085041', borderRadius: 10, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>✅ Ugovor OK</a>
                      )}
                      {s.trebaNajam && s.trebaDepozit && <button onClick={() => zavediNajamIDepozit(u, s.fali, s.depozit)} style={{ padding: '10px 14px', background: '#185FA5', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>✅ Sve ({s.fali}€ + {s.depozit}€)</button>}
                      {s.trebaNajam && !s.trebaDepozit && <button onClick={() => zavediNajam(u, s.fali)} style={{ padding: '10px 14px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>💰 {s.fali}€</button>}
                      {s.trebaDepozit && !s.trebaNajam && <button onClick={() => zavediDepozit(u, s.depozit)} style={{ padding: '10px 14px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>🛡️ Dep {s.depozit}€</button>}
                    </div>
                  </div>
                )})}
              </>)}

              {dugDepUgovori.length > 0 && (<>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#791F1F', background: '#FCEBEB', border: '1px solid #fecaca', borderRadius: 10, padding: '8px 14px', marginBottom: 10, marginTop: 16 }}>⚠️ Dug i povrat depozita ({dugDepUgovori.length})</div>
                {dugDepUgovori.map(u => { const s = getUgovorStatus(u); return (
                  <div key={u.id} style={{ ...card, borderLeft: '4px solid #dc2626' }}>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>{u.br_tablica} — {u.ime_prezime}</div>
                    <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8 }}>REZ #{u.id}</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {s.trebaDug && <button onClick={() => zavediDug(u, s.fali)} style={{ padding: '10px 14px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>💰 Naplati dug {s.fali}€</button>}
                      {s.trebaDepVracen && <button onClick={() => zavediPovratDep(u, s.vracenDep)} style={{ padding: '10px 14px', background: '#f59e0b', color: '#000', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>🛡️ Povrat -{s.vracenDep}€</button>}
                    </div>
                  </div>
                )})}
              </>)}

              {zavrsenoUgovori.length > 0 && (<>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#085041', marginBottom: 10, marginTop: 16 }}>✅ Završeni ({zavrsenoUgovori.length})</div>
                {zavrsenoUgovori.slice(0, 20).map(u => (
                  <div key={u.id} style={{ ...card, borderLeft: '4px solid #1D9E75' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{u.br_tablica} — {u.ime_prezime}</div>
                        <div style={{ fontSize: 11, color: '#9ca3af' }}>REZ #{u.id} · {u.od_datuma} → {u.do_datuma}</div>
                        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>💰 {u.naplaceno}€{u.depozit > 0 ? ` · 🛡️ ${u.depozit}€` : ''}</div>
                      </div>
                      {u.ugovor_slika ? (
                        <a href={u.ugovor_slika} target="_blank" rel="noopener noreferrer" style={{ padding: '8px 12px', background: '#E1F5EE', color: '#085041', borderRadius: 10, fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>📄 Ugovor</a>
                      ) : (
                        <label style={{ padding: '8px 12px', background: '#FAEEDA', color: '#633806', border: '1px solid #f59e0b', borderRadius: 10, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>📸 Dodaj<input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={e => handleUgovorUpload(e, u.id)} /></label>
                      )}
                    </div>
                  </div>
                ))}
              </>)}
              {ugovori.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>Nema ugovora.</div>}
            </>)}
          </div>
        )}

        {/* ═══ VOZILO ═══ */}
        {activeTab === 'vozilo' && (
          <div>
            <div style={card}>
              {aktivnoKor ? (<>
                <div style={{ background: '#FAEEDA', border: '1px solid #f59e0b', borderRadius: 10, padding: '14px', marginBottom: 14, textAlign: 'center' as const }}>
                  <div style={{ fontSize: 11, color: '#633806', marginBottom: 4, fontWeight: 700 }}>AKTIVNO VOZILO</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#633806' }}>{aktivnoKor.tablice}</div>
                  <div style={{ fontSize: 12, color: '#633806', marginTop: 4 }}>📍 {aktivnoKor.destinacija} · Start: {aktivnoKor.km_start} km</div>
                </div>
                <div style={{ marginBottom: 14 }}><label style={lbl}>Krajnje KM *</label><input type="number" value={kmEnd} onChange={e => setKmEnd(e.target.value)} placeholder="Unesite krajnje KM" style={{ ...inp, fontSize: 16, fontWeight: 700 }} /></div>
                {kmEnd && aktivnoKor.km_start && (
                  <div style={{ background: '#E6F1FB', border: '1px solid #85B7EB', borderRadius: 10, padding: '10px 14px', marginBottom: 12, fontSize: 14, color: '#0C447C', fontWeight: 700 }}>
                    📏 Prešao: {Math.max(0, parseFloat(kmEnd) - aktivnoKor.km_start)} km
                  </div>
                )}
                <button onClick={() => finishPrivate(aktivnoKor.id, aktivnoKor.km_start)} style={{ width: '100%', padding: '13px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>RAZDUŽI VOZILO</button>
              </>) : (<>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#111', marginBottom: 14 }}>Zaduži vozilo za privatno korišćenje</div>
                <div style={{ marginBottom: 10 }}>
                  <label style={lbl}>Vozilo</label>
                  <input list="voz-priv" value={privVozilo} onChange={e => setPrivVozilo(e.target.value)} placeholder="Pretraži..." style={inp} />
                  <datalist id="voz-priv">{vozila.map(v => <option key={v.id} value={v.license_plate || ''}>{v.agregirani_2}</option>)}</datalist>
                </div>
                <div style={{ marginBottom: 10 }}><label style={lbl}>Početna KM</label><input type="number" value={kmStart} onChange={e => setKmStart(e.target.value)} placeholder="Npr. 45230" style={{ ...inp, fontSize: 16 }} /></div>
                <div style={{ marginBottom: 14 }}><label style={lbl}>Destinacija</label><input value={privDest} onChange={e => setPrivDest(e.target.value)} placeholder="Npr. Aerodrom" style={inp} /></div>
                <button onClick={startPrivate} disabled={vozSaving} style={{ width: '100%', padding: '13px', background: vozSaving ? '#5DCAA5' : '#1D9E75', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>{vozSaving ? '⏳...' : 'ZADUŽI VOZILO'}</button>
              </>)}
              {kmDug > 0.01 && (
                <div style={{ marginTop: 14, background: '#E6F1FB', border: '1px solid #85B7EB', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 700 }}>DUG ZA KM KORIŠĆENJE</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#0C447C' }}>{kmDug.toFixed(2)} €</div>
                  <div style={{ fontSize: 10, color: '#9ca3af' }}>(km / 100) × 1.44 × 8€</div>
                </div>
              )}
            </div>
            {korHistory.length > 0 && (
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 10 }}>Historija korišćenja</div>
                {korHistory.map(k => (
                  <div key={k.id} style={card}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                      <strong style={{ fontSize: 13 }}>{k.tablice}</strong>
                      <span style={{ fontSize: 11, color: '#9ca3af' }}>{k.vreme_zaduzenja}</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>📍 {k.destinacija} · 📏 {k.predjena_km || 0} km</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══ SPISAK ═══ */}
        {activeTab === 'spisak' && (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' as const }}>
              {(['sve','priliv','odliv'] as const).map(f => (
                <button key={f} onClick={() => setFilterTip(f)} style={{ padding: '8px 16px', fontSize: 13, border: `1.5px solid ${filterTip === f ? '#1D9E75' : '#e5e7eb'}`, borderRadius: 20, background: filterTip === f ? '#E1F5EE' : '#fff', color: filterTip === f ? '#085041' : '#6b7280', cursor: 'pointer', fontWeight: filterTip === f ? 700 : 400 }}>
                  {f === 'sve' ? 'Sve' : f === 'priliv' ? '↑ Prihodi' : '↓ Rashodi'}
                </button>
              ))}
              <input value={filterSearch} onChange={e => setFilterSearch(e.target.value)} placeholder="Pretraži..." style={{ ...inp, width: 'auto', flex: 1, minWidth: 120 }} />
            </div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 10 }}>{filteredTrans.length} transakcija</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filteredTrans.slice(0, 60).map(t => {
                const iz = parseFloat(t.iznos as any || 0)
                const slikaUrl = t.komentar?.match(/https?:\/\/\S+/)?.[0]
                const jeSlao = (t.osobaemail || '').toLowerCase() === agentEmail.toLowerCase()
                const jeRazmjenaT = (t.kategorija || '').toLowerCase().includes('razmjena')
                const jePending = (t.status || '').toLowerCase() === 'na cekanju'

                // Razmjena info
                let razmjenaLabel = ''
                let razmjenaDir = ''
                if (jeRazmjenaT) {
                  if (jeSlao && t.primaocemail) {
                    razmjenaLabel = getImeByEmail(t.primaocemail)
                    razmjenaDir = 'Poslao'
                  } else if (!jeSlao) {
                    razmjenaLabel = getImeByEmail(t.osobaemail)
                    razmjenaDir = 'Primio od'
                  }
                }

                // Prikazni iznos: razmjena primljena = pozitivno
                const prikazIz2 = (jeRazmjenaT && !jeSlao) ? Math.abs(iz) : iz
                const prikazBoja2 = prikazIz2 >= 0 ? '#1D9E75' : '#dc2626'

                return (
                  <div key={t.id} style={{ background: '#fff', border: `1px solid ${jePending ? '#fde68a' : '#f3f4f6'}`, borderLeft: `4px solid ${prikazBoja2}`, borderRadius: 10, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#111', marginBottom: 2 }}>
                        {t.kategorija}
                        {jePending && <span style={{ marginLeft: 6, fontSize: 10, background: '#FAEEDA', color: '#633806', padding: '1px 5px', borderRadius: 8, fontWeight: 700 }}>⏳</span>}
                      </div>
                      {jeRazmjenaT && razmjenaLabel && (
                        <div style={{ fontSize: 12, color: '#185FA5', fontWeight: 600, marginBottom: 2 }}>
                          {razmjenaDir === 'Poslao' ? '→ Poslao:' : '← Primio od:'} <strong>{razmjenaLabel}</strong>
                        </div>
                      )}
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>
                        {t.vozilo && t.vozilo !== 'OPŠTE' ? t.vozilo + ' · ' : ''}{t.datum}
                      </div>
                      {t.komentar && (
                        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                          {t.komentar.replace(/https?:\/\/\S+/g, '').trim()}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: prikazBoja2 }}>
                        {prikazIz2 >= 0 ? '+' : ''}{prikazIz2.toFixed(2)}€
                      </div>
                      {slikaUrl && <img src={getDirectImg(slikaUrl)} style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 6, border: '1px solid #e5e7eb', cursor: 'pointer' }} onClick={() => window.open(slikaUrl, '_blank')} alt="" />}
                    </div>
                  </div>
                )
              })}
              {filteredTrans.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>Nema transakcija.</div>}
            </div>
          </div>
        )}

        {/* ═══ POTVRDE ═══ */}
        {activeTab === 'potvrde' && (
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#111', marginBottom: 14 }}>🔔 Potvrde razmjene ({pendingTrans.length})</div>
            {pendingTrans.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af', border: '1px dashed #e5e7eb', borderRadius: 12 }}>Nema transakcija na čekanju.</div>
            ) : pendingTrans.map(t => {
              const iz = Math.abs(parseFloat(t.iznos as any || 0))
              return (
                <div key={t.id} style={{ ...card, borderLeft: '4px solid #f59e0b' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 16, color: '#1D9E75', marginBottom: 4 }}>
                        ← Primio si <span style={{ color: '#111' }}>{iz.toFixed(2)}€</span>
                      </div>
                      <div style={{ fontSize: 13, color: '#374151', marginBottom: 2 }}>
                        od <strong>{t.osoba}</strong>
                      </div>
                      <div style={{ fontSize: 12, color: '#9ca3af' }}>{t.kategorija} · {t.datum}</div>
                    </div>
                    <button onClick={() => confirmTrans(t.id)} style={{ padding: '12px 20px', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>POTVRDI ✓</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
