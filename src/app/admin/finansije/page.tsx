'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyunN3qJRFk-bydMWkEImsYoXdw-n-e7nln3aerDLGtc5gxXUmwkBPgCFMNzS7qBitpjg/exec'
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
  'Provizije posrednicima', 'Putni troškovi', 'Taksi', 'Kirija',
  'Komunalije', 'Telekomunikacije', 'Kancelarijski materijal', 'Plata', 'MOJA plata',
  'Slepanje vozila', 'Uplata duga za službeno vozilo', 'Rata za vozilo (dodaj sliku potvrde)',
  'Marketing i oglasavanje', 'Osiguranje', 'Transfer', 'OSTAVLJENO U SANDUCE',
  'Neutralni novcani tok', 'DUG PREMA FIRMI ( u komentaru upisi iznos preostalog duga)',
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
  const [pendingCount, setPendingCount] = useState(0)

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

    const { data: v } = await supabase.from('vozila_fleet').select('id, license_plate, agregirani_2').order('agregirani_2')
    setVozila(v || [])

    const { data: agents } = await supabase.from('agents').select('email, full_name').eq('is_active', true)
    setKolege((agents || []).filter(a => a.email !== email).map(a => ({ email: a.email, ime: a.full_name })))

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
      if (sE === email || pE === email) prikazano.push(t)
    })
    setSaldo(s); setFirmaDug(df)
    setPrikazTrans(prikazano); setPendingTrans(pending); setPendingCount(pending.length)

    const { data: km } = await supabase.from('koristenje').select('*').order('timestamp_upisa', { ascending: false })
    const svaKor = km || []
    setAktivnoKor(svaKor.find(k => k.email?.toLowerCase() === email && k.status === 'Aktivno') || null)
    setKorHistory(svaKor.filter(k => k.email?.toLowerCase() === email && k.status !== 'Aktivno').slice(0, 10))
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

  async function handleUgovorUpload(e: React.ChangeEvent<HTMLInputElement>, rezId: number) {
    const file = e.target.files?.[0]; if (!file) return
    try {
      const url = await uploadSlika(file, `UGOVOR_${rezId}`)
      await supabase.from('rezervacije').update({ ugovor_slika: url }).eq('id', rezId)
      loadUgovori()
    } catch { alert('Greška pri uploadu') }
    e.target.value = ''
  }

  async function saveTransakcija() {
    const izVal = parseFloat(iznos)
    if (!izVal || !kategorija) { alert('Unesite iznos i kategoriju!'); return }
    
    // DEBUG - privremeno
    console.log('agentEmail:', agentEmail)
    console.log('agentIme:', agentIme)
    console.log('iznos:', izVal, 'kategorija:', kategorija)
    
    if (!agentEmail) { alert('Greška: email nije učitan. Osvježi stranicu.'); return }
    
    setUnosSaving(true)
    const jeRazmjena = kategorija.toLowerCase().includes('razmjena') && primaoc
    const { data, error } = await supabase.from('transakcije').insert([{
      id: genId(), tip_transakcije: tip, datum, kategorija,
      iznos: tip === 'priliv' ? Math.abs(izVal) : -Math.abs(izVal),
      vozilo: voziloUnos || 'OPŠTE',
      komentar: komentar + (photoUrl ? ' ' + photoUrl : ''),
      osoba: agentIme, osobaemail: agentEmail,
      timestamp_upisa: new Date().toISOString(),
      status: jeRazmjena ? 'na cekanju' : 'Zavrseno',
      primaocemail: jeRazmjena ? primaoc : null,
    }])
    
    console.log('INSERT data:', data, 'error:', error)
    
    if (error) { alert('Greška: ' + error.message); setUnosSaving(false); return }
    
    setIznos(''); setKomentar(''); setVoziloUnos(''); setPhotoUrl('')
    setUploadStatus(''); setPrimaoc(''); setUnosSaving(false)
    alert('Upisano!'); loadAll(agentEmail, agentIme)
  }

  function getUgovorStatus(u: Rezervacija) {
    const imeBez = agentIme.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const isIzdao = u.ko_je_izdao === imeBez
    const isPreuzeo = u.ko_je_preuzeo === imeBez
    const fazaReturn = !!u.ko_je_preuzeo
    const uTrans = allTrans.filter(t => t.komentar?.includes(`REZ #${u.id}`))
    const upisanNajam = uTrans.filter(t => t.tip_transakcije === 'priliv' && (t.kategorija === 'Izdavanje vozila' || t.kategorija === 'Naplata Duga')).reduce((s, t) => s + Math.abs(parseFloat(t.iznos as any || 0)), 0)
    const depUzetUKasi = uTrans.some(t => t.tip_transakcije === 'priliv' && t.kategorija === 'Depozit')
    const depVracenIzKase = uTrans.some(t => t.tip_transakcije === 'odliv' && t.kategorija === 'Povrat Depozita')
    const fali = Math.max(0, (u.naplaceno || 0) - upisanNajam)
    return {
      isIzdao, isPreuzeo, fazaReturn, depozit: u.depozit || 0,
      vracenDep: u.vraceni_depozit_iznos || 0, fali,
      trebaSlika: !u.ugovor_slika && isIzdao,
      trebaNajam: fali > 0.01 && !fazaReturn && isIzdao,
      trebaDepozit: u.depozit_uzet && !depUzetUKasi && isIzdao,
      trebaDug: fali > 0.01 && fazaReturn && isPreuzeo,
      trebaDepVracen: u.depozit_vracen && (u.vraceni_depozit_iznos || 0) > 0 && !depVracenIzKase && isPreuzeo,
    }
  }

  async function trInsert(tip_t: 'priliv' | 'odliv', kat: string, iznT: number, voz: string, kom: string) {
    await supabase.from('transakcije').insert([{
      id: genId(), tip_transakcije: tip_t, datum: new Date().toISOString().split('T')[0],
      kategorija: kat, iznos: tip_t === 'odliv' ? -Math.abs(iznT) : Math.abs(iznT),
      vozilo: voz, komentar: kom, osoba: agentIme, osobaemail: agentEmail,
      timestamp_upisa: new Date().toISOString(), status: 'Zavrseno',
    }])
  }

  async function zavediNajam(u: Rezervacija, iznT: number) {
    if (!confirm(`Zaduži ${iznT}€ u kasu za ${u.br_tablica}?`)) return
    const p = Math.max(0, (u.ukupno_naplata || 0) - (u.naplaceno || 0))
    await trInsert('priliv', 'Izdavanje vozila', iznT, u.br_tablica, `Početna naplata pri izdavanju (Ugovor REZ #${u.id}).${p > 0.01 ? ` Preostali dug: ${p.toFixed(2)}€` : ' Ugovor u potpunosti isplaćen.'}`)
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
    await supabase.from('transakcije').insert([
      { id: genId() + '1', tip_transakcije: 'priliv', datum: new Date().toISOString().split('T')[0], kategorija: 'Izdavanje vozila', iznos: najam, vozilo: u.br_tablica, komentar: `Početna naplata pri izdavanju (Ugovor REZ #${u.id}).${p > 0.01 ? ` Preostali dug: ${p.toFixed(2)}€` : ''}`, osoba: agentIme, osobaemail: agentEmail, timestamp_upisa: new Date().toISOString(), status: 'Zavrseno' },
      { id: genId() + '2', tip_transakcije: 'priliv', datum: new Date().toISOString().split('T')[0], kategorija: 'Depozit', iznos: dep, vozilo: u.br_tablica, komentar: `Uzet depozit pri izdavanju (Ugovor REZ #${u.id})`, osoba: agentIme, osobaemail: agentEmail, timestamp_upisa: new Date().toISOString(), status: 'Zavrseno' },
    ])
    alert('Sve zaduženo!'); loadAll(agentEmail, agentIme); loadUgovori()
  }

  async function zavediDug(u: Rezervacija, iznT: number) {
    if (!confirm(`Zaduži naplatu duga ${iznT}€?`)) return
    await trInsert('priliv', 'Naplata Duga', iznT, u.br_tablica, `Naplata duga pri preuzimanju (Ugovor REZ #${u.id})`)
    alert('Naplata zavedena!'); loadAll(agentEmail, agentIme); loadUgovori()
  }

  async function zavediPovratDep(u: Rezervacija, iznT: number) {
    if (!confirm(`Razdužuješ ${iznT}€ iz kase za povrat depozita?`)) return
    await trInsert('odliv', 'Povrat Depozita', iznT, u.br_tablica, `Vraćen depozit pri preuzimanju (Ugovor REZ #${u.id})`)
    alert('Povrat razdužen!'); loadAll(agentEmail, agentIme); loadUgovori()
  }

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

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>Učitavanje...</div>

  const needsFoto = FOTO_KAT.includes(kategorija)
  const isRazmjena = kategorija.toLowerCase().includes('razmjena')
  const katOptions = tip === 'priliv' ? KATEGORIJE_PRILIV : KATEGORIJE_ODLIV
  const filteredTrans = prikazTrans.filter(t => {
    const matchTip = filterTip === 'sve' || t.tip_transakcije === filterTip
    const matchSearch = !filterSearch || (t.kategorija || '').toLowerCase().includes(filterSearch.toLowerCase()) || (t.vozilo || '').toLowerCase().includes(filterSearch.toLowerCase())
    return matchTip && matchSearch
  })
  const cekanjuUgovori = ugovori.filter(u => { const s = getUgovorStatus(u); return s.trebaSlika || s.trebaNajam || s.trebaDepozit })
  const dugDepUgovori = ugovori.filter(u => { const s = getUgovorStatus(u); return s.trebaDug || s.trebaDepVracen })
  const zavrsenoUgovori = ugovori.filter(u => { const s = getUgovorStatus(u); return !s.trebaSlika && !s.trebaNajam && !s.trebaDepozit && !s.trebaDug && !s.trebaDepVracen })

  const TABS: { id: Tab; label: string; badge?: number }[] = [
    { id: 'transakcije', label: '💸 Transakcije' },
    { id: 'ugovori', label: '📄 Ugovori', badge: (cekanjuUgovori.length + dugDepUgovori.length) || undefined },
    { id: 'vozilo', label: '🚗 Vozilo' },
    { id: 'spisak', label: '📊 Spisak' },
    { id: 'potvrde', label: '🔔 Potvrde', badge: pendingCount || undefined },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#111', margin: 0 }}>Finansije</h1>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4, margin: 0 }}>Evidencija transakcija i ugovora</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ background: saldo >= 0 ? '#E1F5EE' : '#FCEBEB', border: `1px solid ${saldo >= 0 ? '#5DCAA5' : '#fecaca'}`, borderRadius: 10, padding: '10px 18px', textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 2 }}>SALDO</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: saldo >= 0 ? '#085041' : '#dc2626' }}>{saldo.toFixed(2)} €</div>
          </div>
          <div style={{ background: '#FAEEDA', border: '1px solid #f59e0b', borderRadius: 10, padding: '10px 18px', textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 2 }}>FIRMA DUG</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#633806' }}>{firmaDug.toFixed(2)} €</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 2, marginBottom: 20, borderBottom: '1px solid #e5e7eb' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={{ padding: '9px 16px', fontSize: 13, border: 'none', background: 'none', cursor: 'pointer', fontWeight: activeTab === t.id ? 600 : 400, color: activeTab === t.id ? '#1D9E75' : '#6b7280', borderBottom: activeTab === t.id ? '2px solid #1D9E75' : '2px solid transparent', marginBottom: -1 }}>
            {t.label}
            {t.badge ? <span style={{ marginLeft: 5, background: '#dc2626', color: '#fff', borderRadius: 20, fontSize: 10, padding: '1px 5px', fontWeight: 700 }}>{t.badge}</span> : null}
          </button>
        ))}
      </div>

      {activeTab === 'transakcije' && (
        <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', gap: 20 }}>
          <div style={card}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#111', marginBottom: 16 }}>Nova transakcija</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <button onClick={() => { setTip('priliv'); setKategorija('') }} style={{ flex: 1, padding: '10px', border: `2px solid ${tip === 'priliv' ? '#1D9E75' : '#e5e7eb'}`, borderRadius: 8, background: tip === 'priliv' ? '#E1F5EE' : '#fff', color: tip === 'priliv' ? '#085041' : '#6b7280', fontWeight: tip === 'priliv' ? 700 : 400, cursor: 'pointer', fontSize: 13 }}>↑ PRILIV</button>
              <button onClick={() => { setTip('odliv'); setKategorija('') }} style={{ flex: 1, padding: '10px', border: `2px solid ${tip === 'odliv' ? '#dc2626' : '#e5e7eb'}`, borderRadius: 8, background: tip === 'odliv' ? '#FCEBEB' : '#fff', color: tip === 'odliv' ? '#dc2626' : '#6b7280', fontWeight: tip === 'odliv' ? 700 : 400, cursor: 'pointer', fontSize: 13 }}>↓ ODLIV</button>
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
              <input list="voz-unos" value={voziloUnos} onChange={e => setVoziloUnos(e.target.value)} placeholder="Pretraži po tablicama..." style={inp} />
              <datalist id="voz-unos">{vozila.map(v => <option key={v.id} value={v.license_plate || ''}>{v.agregirani_2} ({v.license_plate})</option>)}</datalist>
            </div>
            {needsFoto && (
              <div style={{ border: '1px dashed #d1d5db', borderRadius: 8, padding: 12, marginBottom: 10, background: '#f9fafb' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#1D9E75', marginBottom: 8 }}>📎 OBAVEZNA SLIKA RAČUNA</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <label style={{ flex: 1, background: '#E1F5EE', border: '1px solid #1D9E75', padding: '8px', borderRadius: 8, textAlign: 'center', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#085041' }}>📷 Slikaj<input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFotoUpload} /></label>
                  <label style={{ flex: 1, background: '#E1F5EE', border: '1px solid #1D9E75', padding: '8px', borderRadius: 8, textAlign: 'center', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#085041' }}>🖼️ Dodaj<input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFotoUpload} /></label>
                </div>
                {uploadStatus && <div style={{ fontSize: 12, marginTop: 6, color: uploadStatus.includes('✅') ? '#1D9E75' : '#633806', fontWeight: 600 }}>{uploadStatus}</div>}
              </div>
            )}
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Napomena</label>
              <textarea value={komentar} onChange={e => setKomentar(e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' as const }} />
            </div>
            <button onClick={saveTransakcija} disabled={unosSaving} style={{ width: '100%', padding: '11px', background: unosSaving ? '#5DCAA5' : '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              {unosSaving ? '⏳ Snimam...' : 'POTVRDI UPIS'}
            </button>
          </div>
          <div style={card}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#111', marginBottom: 12 }}>Zadnjih 10 transakcija</div>
            {prikazTrans.slice(0, 10).map(t => {
              const iz = parseFloat(t.iznos as any || 0)
              return (
                <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <div><div style={{ fontSize: 13, fontWeight: 500 }}>{t.kategorija}</div><div style={{ fontSize: 11, color: '#9ca3af' }}>{t.vozilo} · {t.datum}</div></div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: iz > 0 ? '#1D9E75' : '#dc2626', marginLeft: 10 }}>{iz > 0 ? '+' : ''}{iz.toFixed(2)}€</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {activeTab === 'ugovori' && (
        <div>
          {ugovoriLoading ? <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>Učitavanje...</div> : (
            <>
              {cekanjuUgovori.length > 0 && (<>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#633806', background: '#FAEEDA', border: '1px solid #f59e0b', borderRadius: 8, padding: '8px 14px', marginBottom: 12 }}>⏳ Čekaju slikanje ili početnu naplatu ({cekanjuUgovori.length})</div>
                {cekanjuUgovori.map(u => { const s = getUgovorStatus(u); return (
                  <div key={u.id} style={{ ...card, borderLeft: '4px solid #f59e0b' }}>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{u.br_tablica} — {u.ime_prezime}</div>
                    <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 4 }}>REZ #{u.id} · {u.od_datuma} → {u.do_datuma}</div>
                    <div style={{ fontSize: 12, color: '#1D9E75', marginBottom: 10 }}>Naplaćeno: {u.naplaceno}€ | Duguje: {Math.max(0, (u.ukupno_naplata || 0) - (u.naplaceno || 0)).toFixed(2)}€</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {s.trebaSlika ? (<label style={{ padding: '8px 14px', background: '#6b7280', color: '#fff', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>📸 Slikaj ugovor<input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={e => handleUgovorUpload(e, u.id)} /></label>)
                        : (<a href={u.ugovor_slika} target="_blank" rel="noopener noreferrer" style={{ padding: '8px 14px', background: '#E1F5EE', color: '#085041', borderRadius: 8, fontSize: 12, fontWeight: 600, textDecoration: 'none', border: '1px solid #1D9E75' }}>✅ Ugovor OK</a>)}
                      {s.trebaNajam && s.trebaDepozit && (<button onClick={() => zavediNajamIDepozit(u, s.fali, s.depozit)} style={{ padding: '8px 14px', background: '#185FA5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>✅ Zaduži sve ({s.fali}€ + Dep {s.depozit}€)</button>)}
                      {s.trebaNajam && !s.trebaDepozit && (<button onClick={() => zavediNajam(u, s.fali)} style={{ padding: '8px 14px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>💰 Kasa najam: {s.fali}€</button>)}
                      {s.trebaDepozit && !s.trebaNajam && (<button onClick={() => zavediDepozit(u, s.depozit)} style={{ padding: '8px 14px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>🛡️ Kasa depozit: {s.depozit}€</button>)}
                    </div>
                  </div>
                )})}
              </>)}
              {dugDepUgovori.length > 0 && (<>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#791F1F', background: '#FCEBEB', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 14px', marginBottom: 12, marginTop: 20 }}>⚠️ Naplata duga i povrat depozita ({dugDepUgovori.length})</div>
                {dugDepUgovori.map(u => { const s = getUgovorStatus(u); return (
                  <div key={u.id} style={{ ...card, borderLeft: '4px solid #dc2626' }}>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{u.br_tablica} — {u.ime_prezime}</div>
                    <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8 }}>REZ #{u.id}</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {s.trebaDug && (<button onClick={() => zavediDug(u, s.fali)} style={{ padding: '8px 14px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>💰 U kasu: {s.fali}€</button>)}
                      {s.trebaDepVracen && (<button onClick={() => zavediPovratDep(u, s.vracenDep)} style={{ padding: '8px 14px', background: '#f59e0b', color: '#000', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>🛡️ Povrat: -{s.vracenDep}€</button>)}
                    </div>
                  </div>
                )})}
              </>)}
              {zavrsenoUgovori.slice(0, 15).map(u => (
                <div key={u.id} style={{ ...card, borderLeft: '4px solid #1D9E75' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div><div style={{ fontWeight: 600, fontSize: 14 }}>{u.br_tablica} — {u.ime_prezime}</div><div style={{ fontSize: 11, color: '#9ca3af' }}>REZ #{u.id} · {u.od_datuma} → {u.do_datuma}</div></div>
                    {u.ugovor_slika ? (<a href={u.ugovor_slika} target="_blank" rel="noopener noreferrer" style={{ padding: '6px 12px', background: '#E1F5EE', color: '#085041', border: '1px solid #1D9E75', borderRadius: 8, fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>✅ Pogledaj</a>)
                      : (<label style={{ padding: '6px 12px', background: '#f9fafb', color: '#6b7280', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}>📸 Dodaj<input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={e => handleUgovorUpload(e, u.id)} /></label>)}
                  </div>
                </div>
              ))}
              {ugovori.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af', fontSize: 13 }}>Nema ugovora.</div>}
            </>
          )}
        </div>
      )}

      {activeTab === 'vozilo' && (
        <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 20 }}>
          <div style={card}>
            {aktivnoKor ? (<>
              <div style={{ background: '#FAEEDA', border: '1px solid #f59e0b', borderRadius: 10, padding: '14px 18px', marginBottom: 14, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#633806', marginBottom: 4 }}>AKTIVNO VOZILO</div>
                <div style={{ fontSize: 26, fontWeight: 900, color: '#633806' }}>{aktivnoKor.tablice}</div>
              </div>
              <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 14 }}>📍 {aktivnoKor.destinacija}<br />🕒 {aktivnoKor.vreme_zaduzenja}</div>
              <div style={{ marginBottom: 14 }}><label style={lbl}>Krajnje KM *</label><input type="number" value={kmEnd} onChange={e => setKmEnd(e.target.value)} placeholder="KM..." style={inp} /></div>
              <button onClick={() => finishPrivate(aktivnoKor.id, aktivnoKor.km_start)} style={{ width: '100%', padding: '11px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>RAZDUŽI VOZILO</button>
            </>) : (<>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#111', marginBottom: 16 }}>Zaduži vozilo</div>
              <div style={{ marginBottom: 10 }}><label style={lbl}>Vozilo</label><input list="voz-priv" value={privVozilo} onChange={e => setPrivVozilo(e.target.value)} placeholder="Pretraži po tablicama..." style={inp} /><datalist id="voz-priv">{vozila.map(v => <option key={v.id} value={v.license_plate || ''}>{v.agregirani_2} ({v.license_plate})</option>)}</datalist></div>
              <div style={{ marginBottom: 10 }}><label style={lbl}>Početna KM</label><input type="number" value={kmStart} onChange={e => setKmStart(e.target.value)} placeholder="Npr. 45230" style={inp} /></div>
              <div style={{ marginBottom: 14 }}><label style={lbl}>Destinacija</label><input value={privDest} onChange={e => setPrivDest(e.target.value)} placeholder="Npr. Aerodrom" style={inp} /></div>
              <button onClick={startPrivate} disabled={vozSaving} style={{ width: '100%', padding: '11px', background: vozSaving ? '#5DCAA5' : '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{vozSaving ? '⏳...' : 'ZADUŽI VOZILO'}</button>
            </>)}
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#111', marginBottom: 12 }}>Historija</div>
            {korHistory.length === 0 ? (<div style={{ textAlign: 'center', padding: 40, color: '#9ca3af', fontSize: 13, border: '1px dashed #e5e7eb', borderRadius: 10 }}>Nema historije.</div>)
              : korHistory.map(k => (<div key={k.id} style={card}><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><strong>{k.tablice}</strong><span style={{ fontSize: 11, color: '#9ca3af' }}>{k.vreme_zaduzenja}</span></div><div style={{ fontSize: 12, color: '#6b7280' }}>📍 {k.destinacija} · 📏 {k.predjena_km || 0} km</div></div>))}
          </div>
        </div>
      )}

      {activeTab === 'spisak' && (
        <div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['sve', 'priliv', 'odliv'] as const).map(f => (
                <button key={f} onClick={() => setFilterTip(f)} style={{ padding: '6px 14px', fontSize: 12, border: `1px solid ${filterTip === f ? '#1D9E75' : '#e5e7eb'}`, borderRadius: 20, background: filterTip === f ? '#E1F5EE' : '#fff', color: filterTip === f ? '#085041' : '#6b7280', cursor: 'pointer', fontWeight: filterTip === f ? 600 : 400 }}>
                  {f === 'sve' ? 'Sve' : f === 'priliv' ? '↑ Prihodi' : '↓ Rashodi'}
                </button>
              ))}
            </div>
            <input value={filterSearch} onChange={e => setFilterSearch(e.target.value)} placeholder="Pretraži..." style={{ ...inp, width: 220 }} />
            <span style={{ fontSize: 12, color: '#9ca3af' }}>{filteredTrans.length} transakcija</span>
          </div>
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr style={{ background: '#f9fafb' }}>{['Kategorija', 'Vozilo', 'Datum', 'Iznos'].map(h => (<th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 500, fontSize: 12, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>{h}</th>))}</tr></thead>
              <tbody>
                {filteredTrans.slice(0, 50).map(t => { const iz = parseFloat(t.iznos as any || 0); return (
                  <tr key={t.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 500 }}>{t.kategorija}</td>
                    <td style={{ padding: '10px 14px', color: '#6b7280', fontSize: 12 }}>{t.vozilo}</td>
                    <td style={{ padding: '10px 14px', color: '#9ca3af', fontSize: 12 }}>{t.datum}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 700, color: iz > 0 ? '#1D9E75' : '#dc2626' }}>{iz > 0 ? '+' : ''}{iz.toFixed(2)}€</td>
                  </tr>
                )})}
                {filteredTrans.length === 0 && <tr><td colSpan={4} style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>Nema transakcija.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'potvrde' && (
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#111', marginBottom: 16 }}>Potvrde razmjene ({pendingTrans.length})</div>
          {pendingTrans.length === 0 ? (<div style={{ textAlign: 'center', padding: 40, color: '#9ca3af', fontSize: 13, border: '1px dashed #e5e7eb', borderRadius: 10 }}>Nema transakcija na čekanju.</div>)
            : pendingTrans.map(t => {
              const iz = Math.abs(parseFloat(t.iznos as any || 0))
              return (
                <div key={t.id} style={{ ...card, borderLeft: '4px solid #f59e0b' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 15 }}>Primio si {iz.toFixed(2)}€</div>
                      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>od <strong>{t.osoba}</strong> · {t.datum}</div>
                    </div>
                    <button onClick={() => confirmTrans(t.id)} style={{ padding: '10px 20px', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>POTVRDI</button>
                  </div>
                </div>
              )
            })}
        </div>
      )}
    </div>
  )
}
