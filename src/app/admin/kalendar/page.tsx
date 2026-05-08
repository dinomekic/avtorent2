'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ─── TIPOVI ───────────────────────────────────────────────
type Vozilo = {
  id: number
  license_plate: string | null
  marka: string | null
  model: string | null
  agregirani_2: string | null
  fleet_status: string
  lokacija: string
  transmission: string | null
}

type Rezervacija = {
  id: number
  br_tablica: string
  ime_prezime: string
  br_vozacke?: string
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
  broj_dana?: number
  ko_je_izdao?: string
  ko_je_preuzeo?: string
  br_leta?: string
  mjesto_preuzimanja?: string
  mjesto_povratka?: string
  izvor_rezervacije?: string
}

type Duznik = {
  id?: number
  br_vozacke: string
  ime_prezime: string
  telefon?: string
  ukupan_dug: number
  istorija?: any[]
}

type Upit = {
  id: number
  ime_prezime: string
  telefon?: string
  email?: string
  izabrani_model?: string
  od_datuma: string
  do_datuma: string
  mjesto_preuzimanja?: string
  mjesto_povratka?: string
  status: string
  vrijeme_upisa: string
  br_vozacke?: string
  zemlja?: string
  datum_rodjenja?: string
  osiguranje?: string
  granica?: string
  br_leta?: string
  napomena?: string
}

// ─── KONSTANTE ────────────────────────────────────────────
const LOKACIJE = ['CRNA GORA', 'BiH', 'SRBIJA', 'ALBANIJA']
const FIRME = ['Meriem d.o.o.', 'Planet Rent a Car', '3G-COMPANY DOO']
const AGENTI = ['Ranka Bulatovic', 'Ena Rondic', 'Esad Djokic', 'Kenan Kolic', 'Edmir Paljevic', 'Semira Pepic', 'Adis Nikaj', 'Besim Adzovic', 'Jasmin Skrijelj', 'Edin Suljevic', 'Dino Mekic']
const SIFRE: Record<string, string> = { 'CRNA GORA': 'cg810805', 'BiH': 'bih000', 'SRBIJA': 'srb222', 'ALBANIJA': 'alb333' }
const MONTHS = ['Januar', 'Februar', 'Mart', 'April', 'Maj', 'Juni', 'Juli', 'August', 'Septembar', 'Oktobar', 'Novembar', 'Decembar']

const STATUS_COLORS: Record<string, string> = {
  'Na čekanju': '#f97316',
  'Izdato': '#1D9E75',
  'Nije izdato': '#dc2626',
}

// ─── HELPERS ─────────────────────────────────────────────
function toDMY(iso: string) {
  if (!iso) return ''
  const p = iso.split('-')
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso
}
function toISO(dmy: string) {
  if (!dmy) return ''
  const p = dmy.split('/')
  return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : dmy
}
function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}
function dateStr(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

const EMPTY_REZ: Partial<Rezervacija> = {
  daily_status: 'Na čekanju',
  firma: 'Meriem d.o.o.',
  nacin_placanja: 'Keš',
  granica: 'DOZVOLJENO VAN ZEMLJE',
  tip_osiguranja: 'Osnovno (AO)',
  mjesto_preuzimanja: 'Bulevar Veljka Vlahovića 16',
  mjesto_povratka: 'Bulevar Veljka Vlahovića 16',
  izvor_rezervacije: 'Sajt',
  depozit: 0, naplaceno: 0,
  vreme_izdavanja: '10:00',
  vreme_povratka: '10:00',
}

// ─── GLAVNI KOMPONENT ─────────────────────────────────────
export default function AdminKalendarPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [currentLok, setCurrentLok] = useState('CRNA GORA')
  const [vozila, setVozila] = useState<Vozilo[]>([])
  const [rezervacije, setRezervacije] = useState<Rezervacija[]>([])
  const [duznici, setDuznici] = useState<Duznik[]>([])
  const [upiti, setUpiti] = useState<Upit[]>([])
  const [logovi, setLogovi] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [hoveredId, setHoveredId] = useState<number | null>(null)
  const today = new Date().toISOString().split('T')[0]

  // Modali
  const [modal, setModal] = useState<'none' | 'rez' | 'duznici' | 'upiti' | 'logovi' | 'agent'>('none')
  const [selectedRez, setSelectedRez] = useState<Rezervacija | null>(null)
  const [rezForm, setRezForm] = useState<Partial<Rezervacija>>(EMPTY_REZ)
  const [isNewRez, setIsNewRez] = useState(false)
  const [saving, setSaving] = useState(false)
  const [agentTip, setAgentTip] = useState<'izdavanje' | 'preuzimanje'>('izdavanje')
  const [agentRezId, setAgentRezId] = useState<number | null>(null)

  // Filteri kalendara
  const [searchQ, setSearchQ] = useState('')
  const [filterGear, setFilterGear] = useState('ALL')

  // Stats
  const vozilaLok = vozila.filter(v => v.lokacija === currentLok && v.fleet_status === 'available')
  const rezLok = rezervacije.filter(r => vozilaLok.find(v => v.license_plate === r.br_tablica))
  const zauzetaDanas = new Set(rezLok.filter(r => {
    if (r.daily_status === 'Nije izdato') return false
    return r.od_datuma <= today && r.do_datuma > today
  }).map(r => r.br_tablica))

  // ─── LOAD ─────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true)
    const [{ data: v }, { data: r }, { data: d }, { data: u }] = await Promise.all([
      supabase.from('vozila_fleet').select('id, license_plate, marka, model, agregirani_2, fleet_status, lokacija, transmission').order('marka'),
      supabase.from('rezervacije').select('*'),
      supabase.from('duznici').select('*').order('ukupan_dug', { ascending: false }),
      supabase.from('upiti_sajt').select('*').eq('status', 'PENDING'),
    ])
    if (v) setVozila(v)
    if (r) setRezervacije(r)
    if (d) setDuznici(d)
    if (u) setUpiti(u)
    setLoading(false)
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  // ─── LOKACIJA PROVJERA ────────────────────────────────
  function setLokacija(lok: string) {
    const key = `auth_${lok.replace(/\s+/g, '')}`
    if (sessionStorage.getItem(key) === 'ok') { setCurrentLok(lok); return }
    const uneto = window.prompt(`Lozinka za: ${lok}`)
    if (uneto === SIFRE[lok]) { sessionStorage.setItem(key, 'ok'); setCurrentLok(lok) }
    else if (uneto !== null) alert('Pogrešna lozinka!')
  }

  // ─── FILTRIRANA VOZILA ZA KALENDAR ───────────────────
  const vozilaKal = vozilaLok.filter(v => {
    if (filterGear === 'ALL') return true
    const t = (v.transmission || '').toUpperCase()
    if (filterGear === 'AUTOMATIC') return t.includes('AUTO') || t.includes('AUTOMAT')
    if (filterGear === 'MANUAL') return t.includes('MAN')
    return true
  }).filter(v => {
    if (!searchQ) return true
    const q = searchQ.toLowerCase()
    return (v.license_plate || '').toLowerCase().includes(q) ||
      (v.agregirani_2 || '').toLowerCase().includes(q)
  })

  // ─── REZERVACIJA SAVE ────────────────────────────────
  async function saveRezervacija() {
    if (!rezForm.br_tablica || !rezForm.ime_prezime) {
      alert('Unesite tablice i ime gosta!'); return
    }
    setSaving(true)
    const dana = calcDana(rezForm)
    const ukupno = calcUkupno(rezForm, dana)
    const payload = { ...rezForm, broj_dana: dana, ukupno_naplata: ukupno }

    if (selectedRez?.id) {
      await supabase.from('rezervacije').update(payload).eq('id', selectedRez.id)
      await supabase.from('logovi').insert([{ akcija: `Izmijenjena rezervacija REZ #${selectedRez.id}` }])
    } else {
      await supabase.from('rezervacije').insert([payload])
      await supabase.from('logovi').insert([{ akcija: `Kreirana rezervacija za ${rezForm.ime_prezime} (${rezForm.br_tablica})` }])
    }
    setSaving(false)
    setModal('none')
    setSelectedRez(null)
    loadAll()
  }

  async function deleteRezervacija() {
    if (!selectedRez?.id) return
    const sifra = window.prompt('Admin lozinka za brisanje:')
    if (sifra !== '810805') { alert('Pogrešna lozinka!'); return }
    if (!confirm('Sigurno obrišete ovu rezervaciju?')) return
    await supabase.from('rezervacije').delete().eq('id', selectedRez.id)
    await supabase.from('logovi').insert([{ akcija: `Obrisana rezervacija REZ #${selectedRez.id}` }])
    setModal('none')
    setSelectedRez(null)
    loadAll()
  }

  // ─── AGENT AKCIJA ────────────────────────────────────
  async function izvrsiAgentAkciju(agent: string) {
    if (!agentRezId) return
    const rez = rezervacije.find(r => r.id === agentRezId)
    if (!rez) return

    if (agentTip === 'izdavanje') {
      const naplataStr = window.prompt('Iznos naplaćen na licu mjesta (€):', '0')
      if (naplataStr === null) return
      await supabase.from('rezervacije').update({
        daily_status: 'Izdato', ko_je_izdao: agent,
        naplaceno: parseFloat(naplataStr) || 0
      }).eq('id', agentRezId)
      await supabase.from('logovi').insert([{ akcija: `${agent} izdao vozilo REZ #${agentRezId}` }])
    } else {
      const dug = (rez.ukupno_naplata || 0) - (rez.naplaceno || 0)
      let naplacenoDuga = 0
      if (dug > 0) {
        const dugStr = window.prompt(`Dug: ${dug.toFixed(2)}€. Koliko naplaćujete?`, dug.toFixed(2))
        if (dugStr === null) return
        naplacenoDuga = parseFloat(dugStr) || 0
      }
      const novoNaplaceno = (rez.naplaceno || 0) + naplacenoDuga
      await supabase.from('rezervacije').update({ ko_je_preuzeo: agent, naplaceno: novoNaplaceno }).eq('id', agentRezId)

      // Provjeri dug
      const preostaliDug = (rez.ukupno_naplata || 0) - novoNaplaceno
      if (preostaliDug > 0 && rez.br_vozacke) {
        const { data: d } = await supabase.from('duznici').select('*').eq('br_vozacke', rez.br_vozacke).maybeSingle()
        const hist = [...(d?.istorija || []), { datum: new Date().toLocaleString('sr-RS'), iznos: preostaliDug, komentar: `Dug sa REZ #${agentRezId}`, tip: 'zaduzenje' }]
        if (d) {
          await supabase.from('duznici').update({ ukupan_dug: d.ukupan_dug + preostaliDug, istorija: hist }).eq('br_vozacke', rez.br_vozacke)
        } else {
          await supabase.from('duznici').insert([{ br_vozacke: rez.br_vozacke, ime_prezime: rez.ime_prezime, telefon: rez.telefon || '', ukupan_dug: preostaliDug, istorija: hist }])
        }
        alert(`Klijent ostao dužan ${preostaliDug.toFixed(2)}€ — dodato u dužnike!`)
      }
      await supabase.from('logovi').insert([{ akcija: `${agent} preuzeo vozilo REZ #${agentRezId}` }])
    }
    setModal('none')
    loadAll()
  }

  // ─── DUZNICI ────────────────────────────────────────
  async function razduziDuznika(br_v: string, trenutniDug: number) {
    const unos = window.prompt(`Dug: ${trenutniDug}€. Koliko plaća?`)
    if (!unos) return
    const sifra = window.prompt('Admin lozinka:')
    if (sifra !== '810805') { alert('Pogrešna lozinka!'); return }
    const uplata = parseFloat(unos)
    if (isNaN(uplata) || uplata <= 0) return
    const { data: d } = await supabase.from('duznici').select('*').eq('br_vozacke', br_v).single()
    if (!d) return
    const noviDug = d.ukupan_dug - uplata
    const istorija = [...(d.istorija || []), { datum: new Date().toLocaleString('sr-RS'), iznos: uplata, komentar: 'Uplata', tip: 'razduzenje' }]
    if (noviDug <= 0) {
      if (confirm('Dug otplaćen! Obrisati klijenta?')) {
        await supabase.from('duznici').delete().eq('br_vozacke', br_v)
      } else {
        await supabase.from('duznici').update({ ukupan_dug: 0, istorija }).eq('br_vozacke', br_v)
      }
    } else {
      await supabase.from('duznici').update({ ukupan_dug: noviDug, istorija }).eq('br_vozacke', br_v)
    }
    loadAll()
  }

  // ─── LOGOVI ─────────────────────────────────────────
  async function otvoriLogove() {
    const sifra = window.prompt('Admin lozinka za logove:')
    if (sifra !== '810805') { alert('Pogrešna!'); return }
    const { data } = await supabase.from('logovi').select('*').order('vrijeme', { ascending: false }).limit(100)
    setLogovi(data || [])
    setModal('logovi')
  }

  // ─── UPIT ODOBRI ─────────────────────────────────────
  function odobriUpit(u: Upit) {
    setIsNewRez(true)
    setSelectedRez(null)
    setRezForm({
      ...EMPTY_REZ,
      br_vozacke: u.br_vozacke || '',
      ime_prezime: u.ime_prezime || '',
      telefon: u.telefon || '',
      email: u.email || '',
      zemlja: u.zemlja || '',
      datum_rodjenja: u.datum_rodjenja || '',
      od_datuma: u.od_datuma,
      do_datuma: u.do_datuma,
      vreme_izdavanja: '10:00',
      vreme_povratka: '10:00',
      mjesto_preuzimanja: u.mjesto_preuzimanja || 'Bulevar Veljka Vlahovića 16',
      mjesto_povratka: u.mjesto_povratka || 'Bulevar Veljka Vlahovića 16',
      napomena: `ŽELJENI MODEL: ${u.izabrani_model || ''}${u.napomena ? '\nNAPOMENA: ' + u.napomena : ''}`,
      granica: u.granica || 'DOZVOLJENO VAN ZEMLJE',
      tip_osiguranja: u.osiguranje?.includes('Kasko') ? 'Full Kasko' : 'Osnovno (AO)',
    })
    setModal('rez')
  }

  async function obrisiUpit(id: number) {
    if (!confirm('Obrisati upit?')) return
    await supabase.from('upiti_sajt').delete().eq('id', id)
    loadAll()
  }

  // ─── KALKULACIJE ─────────────────────────────────────
  function calcDana(f: Partial<Rezervacija>): number {
    if (!f.od_datuma || !f.do_datuma) return 0
    const d1 = new Date(f.od_datuma), d2 = new Date(f.do_datuma)
    return Math.max(1, Math.ceil((d2.getTime() - d1.getTime()) / 86400000))
  }

  function calcUkupno(f: Partial<Rezervacija>, dana: number): number {
    let tot = dana * (f.cijena_dan || 0)
    if (f.tip_osiguranja?.includes('Kasko')) tot += dana * (f.kasko_cijena || 0)
    tot += (f.bebi_sic_cijena || 0) * dana
    tot += (f.dozvola_van_zemlje_cijena || 0)
    tot += (f.dostava_cijena || 0)
    tot += (f.dodatni_vozac_cijena || 0)
    return tot
  }

  // ─── RENDER KALENDAR ─────────────────────────────────
  const daysInMonth = getDaysInMonth(year, month)
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  function getRezForCell(tablica: string, day: number): Rezervacija | undefined {
    const ds = dateStr(year, month, day)
    return rezervacije.find(r =>
      r.br_tablica === tablica &&
      r.od_datuma <= ds &&
      r.do_datuma > ds
    )
  }

  function openRez(r: Rezervacija) {
    setSelectedRez(r)
    setRezForm({ ...r })
    setIsNewRez(false)
    setModal('rez')
  }

  function openNewRez(tablica?: string, datum?: string) {
    setSelectedRez(null)
    setIsNewRez(true)
    setRezForm({
      ...EMPTY_REZ,
      br_tablica: tablica || '',
      od_datuma: datum || '',
    })
    setModal('rez')
  }

  const dana = calcDana(rezForm)
  const ukupno = calcUkupno(rezForm, dana)
  const dug = ukupno - (rezForm.naplaceno || 0)

  const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', color: '#111', boxSizing: 'border-box' }
  const lbl: React.CSSProperties = { fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 3, fontWeight: 500 }

  return (
    <div style={{ fontFamily: 'inherit' }}>
      {/* ─── HEADER ─── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#111', margin: 0 }}>Kalendar zauzetosti</h1>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4, margin: 0 }}>
            {vozilaLok.filter(v => v.fleet_status === 'available').length} vozila · {zauzetaDanas.size} zauzeto danas · {vozilaLok.length - zauzetaDanas.size} slobodno
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => openNewRez()}
            style={{ padding: '8px 16px', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            + Nova rezervacija
          </button>
          {upiti.length > 0 && (
            <button onClick={() => setModal('upiti')}
              style={{ padding: '8px 16px', background: '#f97316', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', animation: 'pulse 2s infinite' }}>
              ⏳ Upiti ({upiti.length})
            </button>
          )}
          <button onClick={() => setModal('duznici')}
            style={{ padding: '8px 16px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            📝 Dužnici ({duznici.length})
          </button>
          <button onClick={otvoriLogove}
            style={{ padding: '8px 16px', background: '#6b7280', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            📜 Logovi
          </button>
        </div>
      </div>

      {/* ─── LOKACIJE ─── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {LOKACIJE.map(l => (
          <button key={l} onClick={() => setLokacija(l)}
            style={{ padding: '7px 16px', fontSize: 12, fontWeight: 600, border: `1px solid ${currentLok === l ? '#1D9E75' : '#e5e7eb'}`, borderRadius: 20, background: currentLok === l ? '#E1F5EE' : '#fff', color: currentLok === l ? '#085041' : '#6b7280', cursor: 'pointer' }}>
            {l === 'CRNA GORA' ? '🇲🇪' : l === 'BiH' ? '🇧🇦' : l === 'SRBIJA' ? '🇷🇸' : '🇦🇱'} {l}
          </button>
        ))}
      </div>

      {/* ─── NAVIGACIJA I FILTERI ─── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <button onClick={() => { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }}
          style={{ padding: '7px 14px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 16 }}>←</button>
        <span style={{ fontSize: 16, fontWeight: 600, color: '#111', minWidth: 160, textAlign: 'center' }}>{MONTHS[month]} {year}</span>
        <button onClick={() => { if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1) }}
          style={{ padding: '7px 14px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 16 }}>→</button>
        <button onClick={() => { setYear(now.getFullYear()); setMonth(now.getMonth()) }}
          style={{ padding: '7px 14px', border: '1px solid #1D9E75', borderRadius: 8, background: '#E1F5EE', cursor: 'pointer', fontSize: 12, color: '#0F6E56', fontWeight: 600 }}>Danas</button>

        <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Pretraži vozilo..."
          style={{ ...inp, width: 160, marginBottom: 0 }} />
        <select value={filterGear} onChange={e => setFilterGear(e.target.value)}
          style={{ ...inp, width: 120, marginBottom: 0 }}>
          <option value="ALL">Svi mjenjači</option>
          <option value="MANUAL">Manual</option>
          <option value="AUTOMATIC">Automat</option>
        </select>
        <span style={{ fontSize: 12, color: '#9ca3af' }}>{vozilaKal.length} vozila</span>
      </div>

      {/* ─── LEGENDA ─── */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
        {[['#f97316', 'Na čekanju'], ['#1D9E75', 'Izdato'], ['#dc2626', 'Nije izdato']].map(([color, label]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#6b7280' }}>
            <div style={{ width: 12, height: 12, borderRadius: 2, background: color }} />
            {label}
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#6b7280' }}>
          <div style={{ width: 12, height: 12, borderRadius: 2, background: '#f0fdf8', border: '1px solid #1D9E75' }} />
          Danas
        </div>
      </div>

      {/* ─── KALENDAR TABELA ─── */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Učitavanje...</div>
        ) : vozilaKal.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Nema vozila za odabranu lokaciju.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', fontSize: 11, minWidth: '100%' }}>
              <thead>
                <tr>
                  <th style={{ padding: '8px 12px', textAlign: 'left', background: '#f9fafb', borderBottom: '2px solid #e5e7eb', borderRight: '1px solid #e5e7eb', minWidth: 160, position: 'sticky', left: 0, zIndex: 3, fontSize: 12, color: '#374151', fontWeight: 600 }}>
                    Vozilo
                  </th>
                  {days.map(day => {
                    const ds = dateStr(year, month, day)
                    const isToday = ds === today
                    const dow = new Date(year, month, day).getDay()
                    const isWeekend = dow === 0 || dow === 6
                    const dayRez = rezervacije.filter(r =>
                      vozilaKal.find(v => v.license_plate === r.br_tablica) &&
                      r.od_datuma <= ds && r.do_datuma > ds
                    )
                    return (
                      <th key={day} style={{
                        padding: '4px 2px', textAlign: 'center', minWidth: 34,
                        background: isToday ? '#E1F5EE' : '#f9fafb',
                        borderBottom: '2px solid #e5e7eb',
                        borderRight: '1px solid #f3f4f6',
                        color: isToday ? '#085041' : isWeekend ? '#9ca3af' : '#374151',
                        fontWeight: isToday ? 700 : 400,
                      }}>
                        <div style={{ fontSize: 9, color: isToday ? '#085041' : '#9ca3af' }}>
                          {['N', 'P', 'U', 'S', 'Č', 'P', 'S'][dow]}
                        </div>
                        <div>{day}</div>
                        {dayRez.length > 0 && (
                          <div style={{ fontSize: 9, color: '#1D9E75', fontWeight: 700 }}>{dayRez.length}🚗</div>
                        )}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {/* Grupiši po marki */}
                {Array.from(new Set(vozilaKal.map(v => v.marka || 'Ostalo'))).sort().map(marka => {
                  const vozilaMarke = vozilaKal.filter(v => (v.marka || 'Ostalo') === marka)
                  return [
                    <tr key={`group-${marka}`}>
                      <td colSpan={daysInMonth + 1} style={{ padding: '6px 12px', background: '#f3f4f6', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1, borderBottom: '1px solid #e5e7eb' }}>
                        {marka} ({vozilaMarke.length})
                      </td>
                    </tr>,
                    ...vozilaMarke.map(v => (
                      <tr key={v.id}>
                        <td style={{ padding: '6px 10px', borderBottom: '1px solid #f3f4f6', borderRight: '1px solid #e5e7eb', fontWeight: 500, color: '#111', fontSize: 11, background: '#fff', position: 'sticky', left: 0, zIndex: 1, whiteSpace: 'nowrap' }}>
                          <div>{v.agregirani_2 || `${v.marka} ${v.model}`}</div>
                          {v.license_plate && (
                            <div style={{ fontFamily: 'monospace', fontSize: 10, color: '#9ca3af' }}>{v.license_plate}</div>
                          )}
                        </td>
                        {days.map(day => {
                          const ds = dateStr(year, month, day)
                          const isToday = ds === today
                          const rez = v.license_plate ? getRezForCell(v.license_plate, day) : undefined
                          const isStart = rez && rez.od_datuma === ds
                          const isEnd = rez && rez.do_datuma === ds
                          const color = rez ? (STATUS_COLORS[rez.daily_status] || '#6b7280') : null
                          const isHov = rez && hoveredId === rez.id

                          return (
                            <td key={day}
                              onClick={() => {
                                if (rez) openRez(rez)
                                else if (v.license_plate) openNewRez(v.license_plate, ds)
                              }}
                              onMouseEnter={() => rez && setHoveredId(rez.id)}
                              onMouseLeave={() => setHoveredId(null)}
                              style={{
                                padding: '2px 1px', height: 36,
                                background: isToday ? '#f0fdf8' : '#fff',
                                borderBottom: '1px solid #f3f4f6',
                                borderRight: '1px solid #f3f4f6',
                                cursor: 'pointer',
                                position: 'relative',
                              }}
                            >
                              {rez && color && (
                                <div style={{
                                  height: 28, margin: '0 1px',
                                  background: isHov ? color : `${color}25`,
                                  borderTop: `2px solid ${color}`,
                                  borderBottom: `2px solid ${color}`,
                                  borderLeft: isStart ? `2px solid ${color}` : 'none',
                                  borderRight: isEnd ? `2px solid ${color}` : 'none',
                                  borderRadius: isStart && isEnd ? 4 : isStart ? '4px 0 0 4px' : isEnd ? '0 4px 4px 0' : 0,
                                  display: 'flex', alignItems: 'center',
                                  overflow: 'hidden', transition: 'background .1s',
                                }}>
                                  {isStart && (
                                    <span style={{ fontSize: 10, color: isHov ? '#fff' : color, paddingLeft: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 80, fontWeight: 600 }}>
                                      {rez.ime_prezime?.split(' ')[0]}
                                    </span>
                                  )}
                                </div>
                              )}
                              {!rez && (
                                <div style={{ height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0 }}
                                  className="hover-plus">
                                  <span style={{ fontSize: 14, color: '#d1d5db' }}>+</span>
                                </div>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    ))
                  ]
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── MODAL: REZERVACIJA ─── */}
      {modal === 'rez' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 1100, maxHeight: '95vh', overflowY: 'auto' }}>
            {/* Header */}
            <div style={{ padding: '18px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#fff', zIndex: 10 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#111' }}>
                {isNewRez ? 'Nova rezervacija' : `REZ #${selectedRez?.id}`}
              </h2>
              <div style={{ display: 'flex', gap: 8 }}>
                {!isNewRez && selectedRez && (
                  <button onClick={deleteRezervacija}
                    style={{ padding: '7px 14px', fontSize: 12, border: '1px solid #fecaca', borderRadius: 8, background: '#fff', cursor: 'pointer', color: '#dc2626' }}>
                    🗑️ Obriši
                  </button>
                )}
                {!isNewRez && selectedRez && (
                  <>
                    {!selectedRez.ko_je_izdao && (
                      <button onClick={() => { setAgentTip('izdavanje'); setAgentRezId(selectedRez.id!); setModal('agent') }}
                        style={{ padding: '7px 14px', fontSize: 12, border: '1px solid #1D9E75', borderRadius: 8, background: '#E1F5EE', cursor: 'pointer', color: '#085041', fontWeight: 600 }}>
                        🚗 Izdaj
                      </button>
                    )}
                    {selectedRez.ko_je_izdao && !selectedRez.ko_je_preuzeo && (
                      <button onClick={() => { setAgentTip('preuzimanje'); setAgentRezId(selectedRez.id!); setModal('agent') }}
                        style={{ padding: '7px 14px', fontSize: 12, border: '1px solid #185FA5', borderRadius: 8, background: '#E6F1FB', cursor: 'pointer', color: '#0C447C', fontWeight: 600 }}>
                        🔙 Preuzmi
                      </button>
                    )}
                  </>
                )}
                <button onClick={saveRezervacija} disabled={saving}
                  style={{ padding: '7px 16px', fontSize: 12, background: saving ? '#5DCAA5' : '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
                  {saving ? '...' : '💾 Snimi'}
                </button>
                <button onClick={() => { setModal('none'); setSelectedRez(null) }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#9ca3af' }}>✕</button>
              </div>
            </div>

            <div style={{ padding: 24, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
              {/* KLIJENT */}
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#1D9E75', textTransform: 'uppercase', marginBottom: 12, paddingBottom: 6, borderBottom: '1px solid #f3f4f6' }}>Klijent</div>
                {[['br_vozacke', 'Broj vozačke'], ['ime_prezime', 'Ime i Prezime *'], ['telefon', 'Telefon'], ['email', 'Email'], ['adresa', 'Adresa'], ['zemlja', 'Zemlja'], ['datum_rodjenja', 'Datum rođenja']].map(([k, l]) => (
                  <div key={k} style={{ marginBottom: 10 }}>
                    <label style={lbl}>{l}</label>
                    <input style={inp} value={(rezForm as any)[k] || ''} onChange={e => setRezForm(f => ({ ...f, [k]: e.target.value }))} />
                  </div>
                ))}
                <div style={{ marginBottom: 10 }}>
                  <label style={lbl}>Status</label>
                  <select style={inp} value={rezForm.daily_status || 'Na čekanju'} onChange={e => setRezForm(f => ({ ...f, daily_status: e.target.value }))}>
                    {['Na čekanju', 'Izdato', 'Nije izdato'].map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                {rezForm.ko_je_izdao && (
                  <div style={{ background: '#f0fdf8', padding: '8px 10px', borderRadius: 8, fontSize: 12, color: '#085041', marginBottom: 8 }}>
                    🚗 Izdao: <strong>{rezForm.ko_je_izdao}</strong>
                  </div>
                )}
                {rezForm.ko_je_preuzeo && (
                  <div style={{ background: '#E6F1FB', padding: '8px 10px', borderRadius: 8, fontSize: 12, color: '#0C447C' }}>
                    🔙 Preuzeo: <strong>{rezForm.ko_je_preuzeo}</strong>
                  </div>
                )}
              </div>

              {/* VOZILO */}
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#1D9E75', textTransform: 'uppercase', marginBottom: 12, paddingBottom: 6, borderBottom: '1px solid #f3f4f6' }}>Vozilo & Detalji</div>
                <div style={{ marginBottom: 10 }}>
                  <label style={lbl}>Firma</label>
                  <select style={inp} value={rezForm.firma || 'Meriem d.o.o.'} onChange={e => setRezForm(f => ({ ...f, firma: e.target.value }))}>
                    {FIRME.map(fi => <option key={fi}>{fi}</option>)}
                  </select>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={lbl}>Tablice *</label>
                  <select style={{ ...inp, color: '#f59e0b', fontWeight: 700 }} value={rezForm.br_tablica || ''} onChange={e => setRezForm(f => ({ ...f, br_tablica: e.target.value }))}>
                    <option value="">-- Izaberi vozilo --</option>
                    {Array.from(new Set(vozilaLok.map(v => v.marka || 'Ostalo'))).sort().map(marka => (
                      <optgroup key={marka} label={marka}>
                        {vozilaLok.filter(v => (v.marka || 'Ostalo') === marka).map(v => (
                          <option key={v.id} value={v.license_plate || ''}>{v.agregirani_2}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={lbl}>Osiguranje</label>
                  <select style={inp} value={rezForm.tip_osiguranja || 'Osnovno (AO)'} onChange={e => setRezForm(f => ({ ...f, tip_osiguranja: e.target.value }))}>
                    {['Osnovno (AO)', 'Full Kasko', 'Kasko sa učešćem'].map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                {rezForm.tip_osiguranja?.includes('Kasko') && (
                  <div style={{ background: '#fffbeb', border: '1px solid #fbbf24', borderRadius: 8, padding: 10, marginBottom: 10 }}>
                    <label style={lbl}>Kasko €/dan</label>
                    <input style={inp} type="number" value={rezForm.kasko_cijena || 0} onChange={e => setRezForm(f => ({ ...f, kasko_cijena: parseFloat(e.target.value) || 0 }))} />
                  </div>
                )}
                <div style={{ marginBottom: 10 }}>
                  <label style={lbl}>Granica</label>
                  <select style={inp} value={rezForm.granica || 'DOZVOLJENO VAN ZEMLJE'} onChange={e => setRezForm(f => ({ ...f, granica: e.target.value }))}>
                    <option value="DOZVOLJENO VAN ZEMLJE">✅ Dozvoljeno</option>
                    <option value="ZABRANJENO VAN ZEMLJE">🚫 Zabranjeno</option>
                  </select>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={lbl}>Broj leta</label>
                  <input style={inp} value={rezForm.br_leta || ''} onChange={e => setRezForm(f => ({ ...f, br_leta: e.target.value }))} placeholder="Npr. FR1234" />
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={lbl}>Napomena / Oštećenja</label>
                  <textarea value={rezForm.napomena || ''} onChange={e => setRezForm(f => ({ ...f, napomena: e.target.value }))}
                    style={{ ...inp, minHeight: 70, resize: 'vertical' as const }} />
                </div>
              </div>

              {/* NAJAM */}
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#1D9E75', textTransform: 'uppercase', marginBottom: 12, paddingBottom: 6, borderBottom: '1px solid #f3f4f6' }}>Najam & Obračun</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                  <div>
                    <label style={lbl}>Od datuma</label>
                    <input style={inp} type="date" value={rezForm.od_datuma || ''} onChange={e => setRezForm(f => ({ ...f, od_datuma: e.target.value }))} />
                  </div>
                  <div>
                    <label style={lbl}>Do datuma</label>
                    <input style={inp} type="date" value={rezForm.do_datuma || ''} onChange={e => setRezForm(f => ({ ...f, do_datuma: e.target.value }))} />
                  </div>
                  <div>
                    <label style={lbl}>Sat izlaska</label>
                    <input style={inp} value={rezForm.vreme_izdavanja || '10:00'} onChange={e => setRezForm(f => ({ ...f, vreme_izdavanja: e.target.value }))} />
                  </div>
                  <div>
                    <label style={lbl}>Sat povratka</label>
                    <input style={inp} value={rezForm.vreme_povratka || '10:00'} onChange={e => setRezForm(f => ({ ...f, vreme_povratka: e.target.value }))} />
                  </div>
                  <div>
                    <label style={lbl}>Cijena €/dan</label>
                    <input style={inp} type="number" value={rezForm.cijena_dan || ''} onChange={e => setRezForm(f => ({ ...f, cijena_dan: parseFloat(e.target.value) || 0 }))} />
                  </div>
                  <div>
                    <label style={lbl}>Depozit €</label>
                    <input style={inp} type="number" value={rezForm.depozit || 0} onChange={e => setRezForm(f => ({ ...f, depozit: parseFloat(e.target.value) || 0 }))} />
                  </div>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={lbl}>Način plaćanja</label>
                  <select style={inp} value={rezForm.nacin_placanja || 'Keš'} onChange={e => setRezForm(f => ({ ...f, nacin_placanja: e.target.value }))}>
                    {['Keš', 'Kartica', 'Renta kartica - depozit keš', 'Preko računa'].map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={lbl}>Mjesto preuzimanja</label>
                  <input style={inp} value={rezForm.mjesto_preuzimanja || ''} onChange={e => setRezForm(f => ({ ...f, mjesto_preuzimanja: e.target.value }))} />
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={lbl}>Mjesto povratka</label>
                  <input style={inp} value={rezForm.mjesto_povratka || ''} onChange={e => setRezForm(f => ({ ...f, mjesto_povratka: e.target.value }))} />
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={lbl}>Izvor rezervacije</label>
                  <select style={inp} value={rezForm.izvor_rezervacije || 'Sajt'} onChange={e => setRezForm(f => ({ ...f, izvor_rezervacije: e.target.value }))}>
                    {['Sajt', 'Google', 'Instagram', 'Facebook', 'Mert', 'Localrents', 'Rent a car Montenegro', 'Posrednici hoteli'].map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>

                {/* Dodaci */}
                <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 10, marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Dodaci</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {[['dozvola_van_zemlje_cijena', 'Van zemlje €'], ['dostava_cijena', 'Dostava €'], ['bebi_sic_cijena', 'Bebi sic €/dan'], ['dodatni_vozac_cijena', '2. vozač €']].map(([k, l]) => (
                      <div key={k}>
                        <label style={lbl}>{l}</label>
                        <input style={inp} type="number" value={(rezForm as any)[k] || 0} onChange={e => setRezForm(f => ({ ...f, [k]: parseFloat(e.target.value) || 0 }))} />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Summary */}
                <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>Dana:</span>
                    <strong style={{ fontSize: 15 }}>{dana}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>Ukupno:</span>
                    <strong style={{ fontSize: 17, color: '#111' }}>{ukupno.toFixed(2)} €</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>Naplaćeno:</span>
                    <input type="number" value={rezForm.naplaceno || 0} onChange={e => setRezForm(f => ({ ...f, naplaceno: parseFloat(e.target.value) || 0 }))}
                      style={{ width: 80, textAlign: 'right', fontSize: 15, fontWeight: 700, color: '#1D9E75', background: 'transparent', border: 'none', borderBottom: '1px dashed #1D9E75', outline: 'none' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e5e7eb', paddingTop: 8 }}>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>Dug:</span>
                    <strong style={{ fontSize: 20, color: dug > 0 ? '#dc2626' : '#1D9E75' }}>{dug.toFixed(2)} €</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: AGENT ─── */}
      {modal === 'agent' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, maxWidth: 420, width: '100%' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 700, color: '#111' }}>
              {agentTip === 'izdavanje' ? '🚗 Ko izdaje vozilo?' : '🔙 Ko preuzima vozilo?'}
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
              {AGENTI.map(a => (
                <button key={a} onClick={() => izvrsiAgentAkciju(a)}
                  style={{ padding: '10px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: '#374151', textAlign: 'left' }}>
                  {a}
                </button>
              ))}
            </div>
            <button onClick={() => setModal('rez')}
              style={{ width: '100%', padding: 10, border: '1px solid #e5e7eb', borderRadius: 8, background: 'transparent', cursor: 'pointer', fontSize: 13, color: '#6b7280' }}>
              Odustani
            </button>
          </div>
        </div>
      )}

      {/* ─── MODAL: DUZNICI ─── */}
      {modal === 'duznici' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 800, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#fff' }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#dc2626' }}>⚠️ Lista dužnika</h2>
              <button onClick={() => setModal('none')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#9ca3af' }}>✕</button>
            </div>
            <div style={{ padding: 20 }}>
              {/* Novi dug forma */}
              <NoviDugForm onSave={loadAll} inp={inp} lbl={lbl} />
              {/* Lista */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginTop: 16 }}>
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    {['Ime', 'Vozačka', 'Telefon', 'Dug', 'Akcija'].map(h => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, fontSize: 12, color: '#6b7280', borderBottom: '2px solid #e5e7eb' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {duznici.map(d => (
                    <tr key={d.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>{d.ime_prezime}</td>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: '#6b7280' }}>{d.br_vozacke}</td>
                      <td style={{ padding: '10px 12px', color: '#6b7280' }}>{d.telefon || '/'}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 700, fontSize: 16, color: '#dc2626' }}>{d.ukupan_dug.toFixed(2)} €</td>
                      <td style={{ padding: '10px 12px' }}>
                        <button onClick={() => razduziDuznika(d.br_vozacke, d.ukupan_dug)}
                          style={{ padding: '6px 12px', fontSize: 12, border: '1px solid #1D9E75', borderRadius: 8, background: '#E1F5EE', cursor: 'pointer', color: '#085041', fontWeight: 600 }}>
                          Uplata
                        </button>
                      </td>
                    </tr>
                  ))}
                  {duznici.length === 0 && (
                    <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>Nema dužnika.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: UPITI ─── */}
      {modal === 'upiti' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 900, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#fff' }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#f59e0b' }}>⏳ Upiti sa sajta ({upiti.length})</h2>
              <button onClick={() => setModal('none')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#9ca3af' }}>✕</button>
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {upiti.map(u => (
                <div key={u.id} style={{ border: '1px solid #e5e7eb', borderLeft: '4px solid #f59e0b', borderRadius: 10, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{u.ime_prezime}</div>
                      <div style={{ fontSize: 13, color: '#f59e0b', fontWeight: 600, marginTop: 2 }}>Model: {u.izabrani_model}</div>
                      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{toDMY(u.od_datuma)} → {toDMY(u.do_datuma)}</div>
                      <div style={{ fontSize: 12, color: '#374151', marginTop: 2 }}>
                        📍 {u.mjesto_preuzimanja} → {u.mjesto_povratka}
                        {u.telefon && <span style={{ marginLeft: 12 }}>📞 {u.telefon}</span>}
                      </div>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                        Primljeno: {new Date(u.vrijeme_upisa).toLocaleString('sr-RS')}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                      <button onClick={() => odobriUpit(u)}
                        style={{ padding: '8px 14px', fontSize: 12, background: '#E1F5EE', color: '#085041', border: '1px solid #1D9E75', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
                        ✅ Odobri
                      </button>
                      <button onClick={() => obrisiUpit(u.id)}
                        style={{ padding: '8px 12px', fontSize: 12, background: 'transparent', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 8, cursor: 'pointer' }}>
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {upiti.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>Nema upita na čekanju.</div>}
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: LOGOVI ─── */}
      {modal === 'logovi' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 700, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#fff' }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>📜 Sistemski logovi</h2>
              <button onClick={() => setModal('none')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#9ca3af' }}>✕</button>
            </div>
            <div style={{ padding: 20 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#6b7280', borderBottom: '2px solid #e5e7eb', width: 180 }}>Vrijeme</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#6b7280', borderBottom: '2px solid #e5e7eb' }}>Akcija</th>
                  </tr>
                </thead>
                <tbody>
                  {logovi.map(l => (
                    <tr key={l.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '10px 12px', color: '#9ca3af' }}>{new Date(l.vrijeme).toLocaleString('sr-RS')}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 500 }}>{l.akcija}</td>
                    </tr>
                  ))}
                  {logovi.length === 0 && <tr><td colSpan={2} style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>Nema logova.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }
        tr:hover td { background: #fafafa !important; }
      `}</style>
    </div>
  )
}

// ─── NOVI DUG FORMA ───────────────────────────────────────
function NoviDugForm({ onSave, inp, lbl }: { onSave: () => void; inp: React.CSSProperties; lbl: React.CSSProperties }) {
  const [form, setForm] = useState({ br_vozacke: '', ime_prezime: '', telefon: '', iznos: '', komentar: '' })

  async function save() {
    if (!form.br_vozacke || !form.ime_prezime || !form.iznos || !form.komentar) {
      alert('Popunite sva polja!'); return
    }
    const iznos = parseFloat(form.iznos)
    const { data: d } = await supabase.from('duznici').select('*').eq('br_vozacke', form.br_vozacke).maybeSingle()
    const hist = [...(d?.istorija || []), { datum: new Date().toLocaleString('sr-RS'), iznos, komentar: form.komentar, tip: 'zaduzenje' }]
    if (d) {
      await supabase.from('duznici').update({ ukupan_dug: d.ukupan_dug + iznos, istorija: hist }).eq('br_vozacke', form.br_vozacke)
    } else {
      await supabase.from('duznici').insert([{ br_vozacke: form.br_vozacke, ime_prezime: form.ime_prezime, telefon: form.telefon, ukupan_dug: iznos, istorija: hist }])
    }
    setForm({ br_vozacke: '', ime_prezime: '', telefon: '', iznos: '', komentar: '' })
    onSave()
  }

  return (
    <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: 16, marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>+ Unesi novi dug</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        {[['br_vozacke', 'Vozačka *'], ['ime_prezime', 'Ime *'], ['telefon', 'Telefon'], ['iznos', 'Iznos €*'], ['komentar', 'Komentar *']].map(([k, l]) => (
          <div key={k} style={{ flex: 1, minWidth: 100 }}>
            <label style={lbl}>{l}</label>
            <input style={inp} value={(form as any)[k]} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))} />
          </div>
        ))}
        <button onClick={save}
          style={{ padding: '8px 16px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, marginBottom: 1 }}>
          + Zaduži
        </button>
      </div>
    </div>
  )
}
