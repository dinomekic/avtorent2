'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import { RezervacijaModal, RezForm, VoziloOption, EMPTY_REZ_FORM, calcDana, calcUkupno, generateUgovor } from './RezervacijaModal'

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

const LOKACIJE = ['CRNA GORA', 'BiH', 'SRBIJA', 'ALBANIJA']
const SIFRE: Record<string, string> = { 'CRNA GORA': 'cg810805', 'BiH': 'bih000', 'SRBIJA': 'srb222', 'ALBANIJA': 'alb333' }
const MONTHS = ['Januar', 'Februar', 'Mart', 'April', 'Maj', 'Juni', 'Juli', 'August', 'Septembar', 'Oktobar', 'Novembar', 'Decembar']
const AGENTI = ['Ranka Bulatovic', 'Ena Rondic', 'Esad Djokic', 'Kenan Kolic', 'Edmir Paljevic', 'Semira Pepic', 'Adis Nikaj', 'Besim Adzovic', 'Jasmin Skrijelj', 'Edin Suljevic', 'Dino Mekic']

const STATUS_COLORS: Record<string, string> = {
  'Na čekanju': '#f97316',
  'Izdato': '#1D9E75',
  'Nije izdato': '#dc2626',
}

function toDMY(iso: string) {
  if (!iso) return ''
  const p = iso.split('-')
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function dateStr(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

// Konvertuj KalRezervacija u RezForm
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

export default function AdminKalendarPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [currentLok, setCurrentLok] = useState('CRNA GORA')
  const [vozila, setVozila] = useState<VoziloOption[]>([])
  const [rezervacije, setRezervacije] = useState<KalRezervacija[]>([])
  const [duznici, setDuznici] = useState<Duznik[]>([])
  const [upiti, setUpiti] = useState<Upit[]>([])
  const [logovi, setLogovi] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [hoveredId, setHoveredId] = useState<number | null>(null)
  const today = new Date().toISOString().split('T')[0]

  // Modal stanja
  const [showRezModal, setShowRezModal] = useState(false)
  const [showDuznici, setShowDuznici] = useState(false)
  const [showUpiti, setShowUpiti] = useState(false)
  const [showLogovi, setShowLogovi] = useState(false)
  const [showAgentModal, setShowAgentModal] = useState(false)
  const [agentTip, setAgentTip] = useState<'izdavanje' | 'preuzimanje'>('izdavanje')
  const [agentRezId, setAgentRezId] = useState<number | null>(null)

  const [rezForm, setRezForm] = useState<RezForm>(EMPTY_REZ_FORM)
  const [isNewRez, setIsNewRez] = useState(false)
  const [saving, setSaving] = useState(false)

  // Filteri
  const [searchQ, setSearchQ] = useState('')
  const [filterGear, setFilterGear] = useState('ALL')

  const vozilaLok = vozila.filter(v => v.lokacija === currentLok)
  const vozilaKal = vozilaLok.filter(v => {
    if (filterGear !== 'ALL') {
      // Potrebno je dohvatiti transmission iz baze
    }
    if (!searchQ) return true
    const q = searchQ.toLowerCase()
    return (v.license_plate || '').toLowerCase().includes(q) ||
      (v.agregirani_2 || '').toLowerCase().includes(q)
  })

  const zauzetaDanas = new Set(
    rezervacije.filter(r => {
      if (r.daily_status === 'Nije izdato') return false
      return r.od_datuma <= today && r.do_datuma > today &&
        vozilaLok.find(v => v.license_plate === r.br_tablica)
    }).map(r => r.br_tablica)
  )

  const loadAll = useCallback(async () => {
    setLoading(true)
    const [{ data: v }, { data: r }, { data: d }, { data: u }] = await Promise.all([
      supabase.from('vozila_fleet').select('id, license_plate, marka, model, agregirani_2, fleet_status, lokacija').order('marka'),
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

  function setLokacija(lok: string) {
    const key = `auth_${lok.replace(/\s+/g, '')}`
    if (sessionStorage.getItem(key) === 'ok') { setCurrentLok(lok); return }
    const uneto = window.prompt(`Lozinka za: ${lok}`)
    if (uneto === SIFRE[lok]) { sessionStorage.setItem(key, 'ok'); setCurrentLok(lok) }
    else if (uneto !== null) alert('Pogrešna lozinka!')
  }

  function openRez(r: KalRezervacija) {
    setRezForm(rezToForm(r))
    setIsNewRez(false)
    setShowRezModal(true)
  }

  function openNewRez(tablica?: string, datum?: string) {
    setRezForm({
      ...EMPTY_REZ_FORM,
      br_tablica: tablica || '',
      od_datuma: datum || '',
    })
    setIsNewRez(true)
    setShowRezModal(true)
  }

  async function saveRezervacija() {
    if (!rezForm.br_tablica || !rezForm.ime_prezime) {
      alert('Unesite tablice i ime!'); return
    }
    setSaving(true)
    const dana = calcDana(rezForm)
    const ukupno = calcUkupno(rezForm)

    const payload = {
      br_tablica: rezForm.br_tablica,
      ime_prezime: rezForm.ime_prezime,
      br_vozacke: rezForm.br_vozacke,
      daily_status: rezForm.daily_status,
      od_datuma: rezForm.od_datuma,
      do_datuma: rezForm.do_datuma,
      vreme_izdavanja: rezForm.vreme_izdavanja,
      vreme_povratka: rezForm.vreme_povratka,
      cijena_dan: rezForm.cijena_dan,
      nacin_placanja: rezForm.nacin_placanja,
      firma: rezForm.firma,
      adresa: rezForm.adresa,
      telefon: rezForm.telefon,
      email: rezForm.email,
      zemlja: rezForm.zemlja,
      datum_rodjenja: rezForm.datum_rodjenja,
      tip_osiguranja: rezForm.tip_osiguranja,
      kasko_cijena: rezForm.kasko_cijena,
      kasko_tip: rezForm.kasko_tip,
      kasko_ucesce: rezForm.kasko_ucesce,
      granica: rezForm.granica,
      depozit: rezForm.depozit,
      napomena: rezForm.napomena,
      bebi_sic_cijena: rezForm.bebi_sic_cijena,
      dozvola_van_zemlje_cijena: rezForm.dozvola_van_zemlje_cijena,
      dostava_cijena: rezForm.dostava_cijena,
      dodatni_vozac_cijena: rezForm.dodatni_vozac_cijena,
      dodatni_vozac_vozacka: rezForm.br_vozacke2,
      br_leta: rezForm.br_leta,
      mjesto_preuzimanja: rezForm.mjesto_preuzimanja,
      mjesto_povratka: rezForm.mjesto_povratka,
      izvor_rezervacije: rezForm.izvor_rezervacije,
      ko_je_izdao: rezForm.ko_je_izdao,
      naplaceno: rezForm.naplaceno,
      ukupno_naplata: ukupno,
      broj_dana: dana,
    }

    if (rezForm.id) {
      await supabase.from('rezervacije').update(payload).eq('id', rezForm.id)
      await supabase.from('logovi').insert([{ akcija: `Izmijenjena rezervacija REZ #${rezForm.id}` }])
    } else {
      await supabase.from('rezervacije').insert([payload])
      await supabase.from('logovi').insert([{ akcija: `Kreirana rezervacija za ${rezForm.ime_prezime} (${rezForm.br_tablica})` }])
    }

    setSaving(false)
    setShowRezModal(false)
    loadAll()
  }

  async function deleteRezervacija() {
    if (!rezForm.id) return
    const sifra = window.prompt('Admin lozinka za brisanje:')
    if (sifra !== '810805') { alert('Pogrešna!'); return }
    if (!confirm('Sigurno obrišete?')) return
    await supabase.from('rezervacije').delete().eq('id', rezForm.id)
    await supabase.from('logovi').insert([{ akcija: `Obrisana rezervacija REZ #${rezForm.id}` }])
    setShowRezModal(false)
    loadAll()
  }

  async function izvrsiAgentAkciju(agent: string) {
    if (!agentRezId) return
    const rez = rezervacije.find(r => r.id === agentRezId)
    if (!rez) return

    if (agentTip === 'izdavanje') {
      const naplataStr = window.prompt('Iznos naplaćen (€):', '0')
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
      await supabase.from('logovi').insert([{ akcija: `${agent} preuzeo vozilo REZ #${agentRezId}` }])
    }
    setShowAgentModal(false)
    loadAll()
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

  async function otvoriLogove() {
    const sifra = window.prompt('Admin lozinka:')
    if (sifra !== '810805') { alert('Pogrešna!'); return }
    const { data } = await supabase.from('logovi').select('*').order('vrijeme', { ascending: false }).limit(100)
    setLogovi(data || [])
    setShowLogovi(true)
  }

  function odobriUpit(u: Upit) {
    setRezForm({
      ...EMPTY_REZ_FORM,
      br_vozacke: u.br_vozacke || '',
      ime_prezime: u.ime_prezime || '',
      telefon: u.telefon || '',
      email: u.email || '',
      zemlja: u.zemlja || '',
      datum_rodjenja: u.datum_rodjenja || '',
      od_datuma: u.od_datuma,
      do_datuma: u.do_datuma,
      mjesto_preuzimanja: u.mjesto_preuzimanja || 'Bulevar Veljka Vlahovića 16',
      mjesto_povratka: u.mjesto_povratka || 'Bulevar Veljka Vlahovića 16',
      napomena: `ŽELJENI MODEL: ${u.izabrani_model || ''}${u.napomena ? '\nNAPOMENA: ' + u.napomena : ''}`,
      granica: u.granica || 'DOZVOLJENO VAN ZEMLJE',
      tip_osiguranja: u.osiguranje?.includes('Kasko') ? 'Full Kasko' : 'Osnovno (AO)',
    })
    setIsNewRez(true)
    setShowUpiti(false)
    setShowRezModal(true)
  }

  const daysInMonth = getDaysInMonth(year, month)
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  function getRezForCell(tablica: string, day: number): KalRezervacija | undefined {
    const ds = dateStr(year, month, day)
    return rezervacije.find(r => r.br_tablica === tablica && r.od_datuma <= ds && r.do_datuma > ds)
  }

  const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', color: '#111', boxSizing: 'border-box' }
  const lbl: React.CSSProperties = { fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 3, fontWeight: 500 }

  return (
    <div style={{ fontFamily: 'inherit' }}>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#111', margin: 0 }}>Kalendar zauzetosti</h1>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4, margin: 0 }}>
            {vozilaLok.length} vozila · {zauzetaDanas.size} zauzeto danas · {vozilaLok.length - zauzetaDanas.size} slobodno
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => openNewRez()}
            style={{ padding: '8px 16px', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            + Nova rezervacija
          </button>
          {upiti.length > 0 && (
            <button onClick={() => setShowUpiti(true)}
              style={{ padding: '8px 16px', background: '#f97316', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              ⏳ Upiti ({upiti.length})
            </button>
          )}
          <button onClick={() => setShowDuznici(true)}
            style={{ padding: '8px 16px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            📝 Dužnici ({duznici.length})
          </button>
          <button onClick={otvoriLogove}
            style={{ padding: '8px 16px', background: '#6b7280', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            📜 Logovi
          </button>
        </div>
      </div>

      {/* LOKACIJE */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {LOKACIJE.map(l => (
          <button key={l} onClick={() => setLokacija(l)}
            style={{ padding: '7px 16px', fontSize: 12, fontWeight: 600, border: `1px solid ${currentLok === l ? '#1D9E75' : '#e5e7eb'}`, borderRadius: 20, background: currentLok === l ? '#E1F5EE' : '#fff', color: currentLok === l ? '#085041' : '#6b7280', cursor: 'pointer' }}>
            {l === 'CRNA GORA' ? '🇲🇪' : l === 'BiH' ? '🇧🇦' : l === 'SRBIJA' ? '🇷🇸' : '🇦🇱'} {l}
          </button>
        ))}
      </div>

      {/* NAVIGACIJA */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <button onClick={() => { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }}
          style={{ padding: '7px 14px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 16 }}>←</button>
        <span style={{ fontSize: 16, fontWeight: 600, color: '#111', minWidth: 160, textAlign: 'center' as const }}>{MONTHS[month]} {year}</span>
        <button onClick={() => { if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1) }}
          style={{ padding: '7px 14px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 16 }}>→</button>
        <button onClick={() => { setYear(now.getFullYear()); setMonth(now.getMonth()) }}
          style={{ padding: '7px 14px', border: '1px solid #1D9E75', borderRadius: 8, background: '#E1F5EE', cursor: 'pointer', fontSize: 12, color: '#0F6E56', fontWeight: 600 }}>Danas</button>
        <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Pretraži vozilo..."
          style={{ ...inp, width: 160, marginBottom: 0 }} />
        <span style={{ fontSize: 12, color: '#9ca3af' }}>{vozilaKal.length} vozila</span>
      </div>

      {/* LEGENDA */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
        {[['#f97316', 'Na čekanju'], ['#1D9E75', 'Izdato'], ['#dc2626', 'Nije izdato']].map(([color, label]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#6b7280' }}>
            <div style={{ width: 12, height: 12, borderRadius: 2, background: color }} />
            {label}
          </div>
        ))}
      </div>

      {/* KALENDAR TABELA */}
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
                        borderBottom: '2px solid #e5e7eb', borderRight: '1px solid #f3f4f6',
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
                {Array.from(new Set(vozilaKal.map(v => v.marka || 'Ostalo'))).sort().map(marka => {
                  const vozilaMarke = vozilaKal.filter(v => (v.marka || 'Ostalo') === marka)
                  return [
                    <tr key={`group-${marka}`}>
                      <td colSpan={daysInMonth + 1} style={{ padding: '6px 12px', background: '#f3f4f6', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' as const, letterSpacing: 1, borderBottom: '1px solid #e5e7eb' }}>
                        {marka} ({vozilaMarke.length})
                      </td>
                    </tr>,
                    ...vozilaMarke.map(v => (
                      <tr key={v.id}>
                        <td style={{ padding: '6px 10px', borderBottom: '1px solid #f3f4f6', borderRight: '1px solid #e5e7eb', fontWeight: 500, color: '#111', fontSize: 11, background: '#fff', position: 'sticky', left: 0, zIndex: 1, whiteSpace: 'nowrap' as const }}>
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
                              title={rez ? `${rez.ime_prezime} (${rez.daily_status})` : 'Klikni za novu rezervaciju'}
                              style={{
                                padding: '2px 1px', height: 36,
                                background: isToday ? '#f0fdf8' : '#fff',
                                borderBottom: '1px solid #f3f4f6',
                                borderRight: '1px solid #f3f4f6',
                                cursor: 'pointer',
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
                                    <span style={{ fontSize: 10, color: isHov ? '#fff' : color, paddingLeft: 4, whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 80, fontWeight: 600 }}>
                                      {rez.ime_prezime?.split(' ')[0]}
                                    </span>
                                  )}
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

      {/* REZERVACIJA MODAL */}
      {showRezModal && (
        <RezervacijaModal
          form={rezForm}
          setForm={setRezForm}
          vozila={vozilaLok}
          onSave={saveRezervacija}
          onClose={() => setShowRezModal(false)}
          onDelete={!isNewRez ? deleteRezervacija : undefined}
          saving={saving}
          isNew={isNewRez}
          onIzdaj={!isNewRez && !rezForm.ko_je_izdao ? () => {
            setAgentTip('izdavanje')
            setAgentRezId(rezForm.id!)
            setShowAgentModal(true)
          } : undefined}
          onPreuzmi={!isNewRez && rezForm.ko_je_izdao && !rezForm.ko_je_preuzeo ? () => {
            setAgentTip('preuzimanje')
            setAgentRezId(rezForm.id!)
            setShowAgentModal(true)
          } : undefined}
        />
      )}

      {/* AGENT MODAL */}
      {showAgentModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, maxWidth: 400, width: '100%' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 700 }}>
              {agentTip === 'izdavanje' ? '🚗 Ko izdaje vozilo?' : '🔙 Ko preuzima vozilo?'}
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
              {AGENTI.map(a => (
                <button key={a} onClick={() => izvrsiAgentAkciju(a)}
                  style={{ padding: '10px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 13, color: '#374151' }}>
                  {a}
                </button>
              ))}
            </div>
            <button onClick={() => setShowAgentModal(false)}
              style={{ width: '100%', padding: 10, border: '1px solid #e5e7eb', borderRadius: 8, background: 'transparent', cursor: 'pointer', fontSize: 13, color: '#6b7280' }}>
              Odustani
            </button>
          </div>
        </div>
      )}

      {/* DUZNICI MODAL */}
      {showDuznici && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 800, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#fff' }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#dc2626' }}>⚠️ Lista dužnika</h2>
              <button onClick={() => setShowDuznici(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#9ca3af' }}>✕</button>
            </div>
            <div style={{ padding: 20 }}>
              {/* Novi dug */}
              <NoviDugForm onSave={loadAll} />
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
                  {duznici.length === 0 && <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>Nema dužnika.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* UPITI MODAL */}
      {showUpiti && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 900, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#fff' }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#f59e0b' }}>⏳ Upiti sa sajta ({upiti.length})</h2>
              <button onClick={() => setShowUpiti(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#9ca3af' }}>✕</button>
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {upiti.map(u => (
                <div key={u.id} style={{ border: '1px solid #e5e7eb', borderLeft: '4px solid #f59e0b', borderRadius: 10, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{u.ime_prezime}</div>
                      <div style={{ fontSize: 13, color: '#f59e0b', fontWeight: 600, marginTop: 2 }}>Model: {u.izabrani_model}</div>
                      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{toDMY(u.od_datuma)} → {toDMY(u.do_datuma)}</div>
                      <div style={{ fontSize: 12, marginTop: 2 }}>📍 {u.mjesto_preuzimanja} → {u.mjesto_povratka}</div>
                      {u.telefon && <div style={{ fontSize: 12, marginTop: 2 }}>📞 {u.telefon}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                      <button onClick={() => odobriUpit(u)}
                        style={{ padding: '8px 14px', fontSize: 12, background: '#E1F5EE', color: '#085041', border: '1px solid #1D9E75', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
                        ✅ Odobri
                      </button>
                      <button onClick={async () => { if (!confirm('Obrisati upit?')) return; await supabase.from('upiti_sajt').delete().eq('id', u.id); loadAll() }}
                        style={{ padding: '8px 12px', fontSize: 12, background: 'transparent', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 8, cursor: 'pointer' }}>
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {upiti.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>Nema upita.</div>}
            </div>
          </div>
        </div>
      )}

      {/* LOGOVI MODAL */}
      {showLogovi && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 700, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#fff' }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>📜 Sistemski logovi</h2>
              <button onClick={() => setShowLogovi(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#9ca3af' }}>✕</button>
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

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.7} }`}</style>
    </div>
  )
}

// ─── NOVI DUG FORMA ───────────────────────────────────────
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
        {[['br_vozacke', 'Vozačka *'], ['ime_prezime', 'Ime *'], ['telefon', 'Tel'], ['iznos', 'Iznos €*'], ['komentar', 'Komentar *']].map(([k, l]) => (
          <div key={k} style={{ flex: 1, minWidth: 90 }}>
            <label style={lbl}>{l}</label>
            <input style={inp} value={(form as any)[k]} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))} />
          </div>
        ))}
        <button onClick={save} style={{ padding: '7px 14px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
          + Zaduži
        </button>
      </div>
    </div>
  )
}
