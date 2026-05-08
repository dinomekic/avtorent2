'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const SHEETS_API = 'https://script.google.com/macros/s/AKfycbwyCvobRS9l_19Kl45yYVspy4DZWEKXzIMM5vSAy_PLELYN7DSnRVug_K_XGfzzZSJ0/exec'

// ─── TIPOVI ───────────────────────────────────────────────
type Klijent = {
  vozacka: string; mjesto: string; istek: string
  ime: string; prezime: string; adresa: string
  rodjenje: string; zemlja: string; telefon: string; email: string
}

type Vozilo = {
  id: number; license_plate: string; marka: string
  model: string; agregirani_2: string; lokacija: string
  fleet_status: string; transmission: string
}

type Rezervacija = {
  id: string; ref_code: string; guest_name: string; guest_email: string; guest_phone: string
  guest_nationality: string; pickup_date: string; return_date: string
  pickup_time: string; return_time: string; pickup_location: string; notes: string
  total_price: number; final_total: number | null; base_price: number
  status: string; payment_status: string
  amount_paid: number; amount_debt: number; amount_prepaid: number; surcharges_total: number
  payment_method: string | null; cash_amount: number; card_amount: number; wire_amount: number
  issued_at: string | null; issued_by: string | null
  closed_at: string | null; closed_by: string | null
  is_early_return: boolean; original_return_date: string | null
  agent_name: string | null; created_at: string
  vehicles: { name: string } | null
}

type NovaRez = {
  // Klijent
  br_vozacke: string; ime: string; prezime: string
  zemlja: string; datum_rodjenja: string; telefon: string
  email: string; adresa: string; istek_vozacke: string
  // Vozilo
  br_tablica: string; firma: string; tip_osiguranja: string
  kasko_cijena: number; kasko_tip: string; kasko_ucesce: number
  granica: string; napomena: string; br_leta: string
  ko_je_izdao: string
  // Drugi vozac
  br_vozacke2: string; ime2: string; prezime2: string
  // Najam
  od_datuma: string; do_datuma: string
  vreme_izdavanja: string; vreme_povratka: string
  cijena_dan: number; depozit: number; nacin_placanja: string
  mjesto_preuzimanja: string; mjesto_povratka: string
  izvor_rezervacije: string
  // Dodaci
  dozvola_van_zemlje: number; dostava: number
  bebi_sic: number; dodatni_vozac: number
  // Obračun
  naplaceno: number
}

const FIRME = ['Meriem d.o.o.', 'Planet Rent a Car', '3G-COMPANY DOO']
const FIRM_DATA: Record<string, {pib: string; tel: string}> = {
  'Meriem d.o.o.': { pib: '02967367', tel: '+382 69 222 234' },
  'Planet Rent a Car': { pib: '03254129', tel: '+382 69 810 805' },
  '3G-COMPANY DOO': { pib: '03012548', tel: '+382 69 160 769' },
}
const AGENTI = ['Ranka Bulatovic', 'Ena Rondic', 'Esad Djokic', 'Kenan Kolic', 'Edmir Paljevic', 'Semira Pepic', 'Adis Nikaj', 'Besim Adzovic', 'Jasmin Skrijelj', 'Edin Suljevic', 'Dino Mekic']
const LOKACIJE_PREUZIMANJA = ['Bulevar Veljka Vlahovića 16', 'Podgorica aerodrom', 'Tivat aerodrom']
const IZVORI = ['Sajt', 'Google', 'Instagram', 'Facebook', 'Mert', 'Localrents', 'Rent a car Montenegro', 'Nissa', 'Preko Edina', 'Posrednici hoteli']

const EMPTY_FORM: NovaRez = {
  br_vozacke: '', ime: '', prezime: '', zemlja: '', datum_rodjenja: '',
  telefon: '', email: '', adresa: '', istek_vozacke: '',
  br_tablica: '', firma: 'Meriem d.o.o.', tip_osiguranja: 'Osnovno (AO)',
  kasko_cijena: 0, kasko_tip: 'FULL KASKO', kasko_ucesce: 0,
  granica: 'DOZVOLJENO VAN ZEMLJE', napomena: '', br_leta: '', ko_je_izdao: '',
  br_vozacke2: '', ime2: '', prezime2: '',
  od_datuma: '', do_datuma: '', vreme_izdavanja: '10:00', vreme_povratka: '10:00',
  cijena_dan: 0, depozit: 0, nacin_placanja: 'Keš',
  mjesto_preuzimanja: 'Bulevar Veljka Vlahovića 16',
  mjesto_povratka: 'Bulevar Veljka Vlahovića 16',
  izvor_rezervacije: 'Sajt',
  dozvola_van_zemlje: 0, dostava: 0, bebi_sic: 0, dodatni_vozac: 0,
  naplaceno: 0,
}

const ST: Record<string, { bg: string; color: string; label: string }> = {
  pending:   { bg: '#FAEEDA', color: '#633806', label: 'Na čekanju' },
  confirmed: { bg: '#E1F5EE', color: '#085041', label: 'Potvrđeno' },
  issued:    { bg: '#E6F1FB', color: '#0C447C', label: 'Izdato' },
  closed:    { bg: '#f3f4f6', color: '#374151', label: 'Zatvoreno' },
  cancelled: { bg: '#FCEBEB', color: '#791F1F', label: 'Otkazano' },
}

function getCookie(name: string): string {
  if (typeof document === 'undefined') return ''
  const match = document.cookie.match(new RegExp(`${name}=([^;]+)`))
  return match ? decodeURIComponent(match[1]) : ''
}

function calcDana(od: string, do_: string): number {
  if (!od || !do_) return 0
  return Math.max(1, Math.ceil((new Date(do_).getTime() - new Date(od).getTime()) / 86400000))
}

function calcUkupno(f: NovaRez): number {
  const dana = calcDana(f.od_datuma, f.do_datuma)
  let tot = dana * f.cijena_dan
  if (f.tip_osiguranja.includes('Kasko')) tot += dana * f.kasko_cijena
  tot += f.bebi_sic * dana
  tot += f.dozvola_van_zemlje + f.dostava + f.dodatni_vozac
  return tot
}

export default function AdminReservationsPage() {
  const [rezervacije, setRezervacije] = useState<Rezervacija[]>([])
  const [vozila, setVozila] = useState<Vozilo[]>([])
  const [klijenti, setKlijenti] = useState<Klijent[]>([])
  const [loading, setLoading] = useState(true)
  const [klijentiLoading, setKlijentiLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Rezervacija | null>(null)
  const [showNovaRez, setShowNovaRez] = useState(false)
  const [form, setForm] = useState<NovaRez>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [editRezId, setEditRezId] = useState<string | null>(null)
  const [showAgentModal, setShowAgentModal] = useState(false)
  const [cancelModal, setCancelModal] = useState<string | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [showDodaci, setShowDodaci] = useState(false)

  const agentName = getCookie('avtorent-agent-name')

  // ─── LOAD ─────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true)
    const [{ data: res }, { data: voz }] = await Promise.all([
      supabase.from('reservations').select('*, vehicles(name)').order('created_at', { ascending: false }),
      supabase.from('vozila_fleet').select('id, license_plate, marka, model, agregirani_2, lokacija, fleet_status, transmission').eq('fleet_status', 'available').order('marka'),
    ])
    setRezervacije(res || [])
    setVozila(voz || [])
    setLoading(false)
  }, [])

  // ─── LOAD KLIJENTI IZ SHEETS ─────────────────────────
  const loadKlijenti = useCallback(async () => {
    setKlijentiLoading(true)
    try {
      const res = await fetch(SHEETS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'getDatabase' })
      })
      const data = await res.json()
      if (data.k) {
        setKlijenti(data.k.map((r: any[]) => ({
          vozacka: String(r[0] || '').trim(),
          mjesto: String(r[1] || '').trim(),
          istek: String(r[2] || '').trim(),
          ime: String(r[3] || '').trim(),
          prezime: String(r[4] || '').trim(),
          adresa: String(r[6] || '').trim(),
          rodjenje: String(r[9] || '').trim(),
          zemlja: String(r[10] || '').trim(),
          telefon: String(r[11] || '').trim(),
          email: String(r[12] || '').trim(),
        })))
      }
    } catch (e) { console.error('Sheets greška:', e) }
    setKlijentiLoading(false)
  }, [])

  useEffect(() => { loadData(); loadKlijenti() }, [loadData, loadKlijenti])

  // ─── PRONAĐI KLIJENTA PO VOZAČKOJ ────────────────────
  function findKlijent(vozacka: string) {
    const k = klijenti.find(k => k.vozacka.trim() === vozacka.trim())
    if (k) {
      setForm(f => ({
        ...f,
        ime: k.ime, prezime: k.prezime, adresa: k.adresa,
        datum_rodjenja: k.rodjenje, zemlja: k.zemlja,
        telefon: k.telefon, email: k.email,
        istek_vozacke: k.istek,
      }))
    }
  }

  function findKlijent2(vozacka: string) {
    const k = klijenti.find(k => k.vozacka.trim() === vozacka.trim())
    if (k) setForm(f => ({ ...f, ime2: k.ime, prezime2: k.prezime }))
  }

  // ─── SAVE REZERVACIJA ────────────────────────────────
  async function saveRezervacija() {
    if (!form.br_tablica || !form.ime) { alert('Unesite tablice i ime!'); return }
    setSaving(true)
    const dana = calcDana(form.od_datuma, form.do_datuma)
    const ukupno = calcUkupno(form)

    const payload = {
      guest_name: `${form.ime} ${form.prezime}`.trim(),
      guest_email: form.email,
      guest_phone: form.telefon,
      guest_nationality: form.zemlja,
      pickup_date: form.od_datuma,
      return_date: form.do_datuma,
      pickup_time: form.vreme_izdavanja,
      return_time: form.vreme_povratka,
      pickup_location: form.mjesto_preuzimanja,
      notes: form.napomena,
      total_price: ukupno,
      status: 'confirmed',
      payment_status: 'unpaid',
      agent_name: agentName || 'Agent',
    }

    if (editRezId) {
      await supabase.from('reservations').update(payload).eq('id', editRezId)
    } else {
      await supabase.from('reservations').insert([payload])
    }

    setSaving(false)
    setShowNovaRez(false)
    setEditRezId(null)
    setForm(EMPTY_FORM)
    loadData()
  }

  // ─── OTKAŽI ──────────────────────────────────────────
  async function handleCancel() {
    if (!cancelModal || !cancelReason.trim()) return
    await supabase.from('reservations').update({
      status: 'cancelled', closed_by: agentName || 'Agent',
      closed_at: new Date().toISOString(), notes: cancelReason.trim(),
    }).eq('id', cancelModal)
    setCancelModal(null); setCancelReason(''); loadData()
  }

  // ─── GENERIŠI UGOVOR ─────────────────────────────────
  function generateContract(r?: Rezervacija) {
    const src = r || selected
    if (!src) return

    const f = form
    const firma = f.firma || 'Meriem d.o.o.'
    const fd = FIRM_DATA[firma]
    const dana = calcDana(f.od_datuma, f.do_datuma)
    const ukupno = calcUkupno(f)
    const dug = ukupno - f.naplaceno
    const isZabranjeno = f.granica.includes('ZABRANJENO')

    const html = `<html><head><style>
      @page { size: A4; margin: 5mm; }
      body { font-family: sans-serif; font-size: 9.5px; line-height: 1.15; color: #000; margin: 0; }
      .wrap { padding: 5mm; display: flex; flex-direction: column; min-height: 100vh; justify-content: space-between; }
      .head { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #000; margin-bottom: 5px; padding-bottom: 5px; }
      table { width: 100%; border-collapse: collapse; margin: 4px 0; }
      td { border: 1px solid #000; padding: 4px; vertical-align: top; }
      .gray { background: #eee; text-align: center; font-weight: bold; }
      .box { width: 11px; height: 11px; border: 1px solid #000; display: inline-block; vertical-align: middle; }
      .check-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 4px; margin: 8px 0; }
      .granica { border: 3px solid ${isZabranjeno ? 'red' : 'green'}; padding: 8px; font-weight: 800; font-size: 13px; color: ${isZabranjeno ? 'red' : 'green'}; text-transform: uppercase; margin-top: 10px; }
      .legal { border: 1px solid #000; padding: 6px; font-size: 7.5px; margin-top: 5px; line-height: 1.2; font-weight: bold; text-align: justify; }
    </style></head><body><div class="wrap">
      <div class="head">
        <div style="display:flex;align-items:center;gap:12px;">
          <img src="https://planetrentacar.me/wp-content/uploads/2023/03/logo-1.png" style="height:50px;">
          <div><h2 style="margin:0;font-size:18px;">PLANET "RENT A CAR"</h2><p style="margin:2px 0;">${firma}<br>PIB: ${fd?.pib}</p></div>
        </div>
        <div style="text-align:right">
          <p style="margin:0;font-weight:bold;font-size:11px;">PODRŠKA: ${fd?.tel}</p>
          <p style="margin:0;font-weight:bold;font-size:11px;">+382 69 160 769</p>
          <p style="margin:4px 0;font-size:11px;">Br. ugovora: ${src.id || 'NOVO'}</p>
        </div>
      </div>
      <table>
        <tr><td colspan="2" class="gray">1. KORISNIK / RENTER</td><td colspan="3" class="gray">2. VOZILO / VEHICLE</td></tr>
        <tr>
          <td width="18%">Korisnik:</td>
          <td width="32%" style="font-weight:bold">${f.ime} ${f.prezime}</td>
          <td width="18%">Vozilo:</td>
          <td colspan="2" style="font-weight:bold">${vozila.find(v => v.license_plate === f.br_tablica)?.agregirani_2 || f.br_tablica}</td>
        </tr>
        <tr>
          <td>Adresa:</td><td>${f.adresa}</td>
          <td>Reg br:</td><td colspan="2" style="font-weight:bold">${f.br_tablica}</td>
        </tr>
        <tr>
          <td>Datum Rođ.:</td><td>${f.datum_rodjenja} (${f.zemlja})</td>
          <td rowspan="2">Preuzimanje:</td>
          <td>Datum / Mjesto:</td><td>${f.od_datuma} / ${f.mjesto_preuzimanja}</td>
        </tr>
        <tr>
          <td>Vozačka/Istek:</td><td>${f.br_vozacke} (${f.istek_vozacke})</td>
          <td>Sat:</td><td>${f.vreme_izdavanja}</td>
        </tr>
        <tr>
          <td>Email/Tel:</td><td>${f.email} / ${f.telefon}</td>
          <td rowspan="2">Povratak:</td>
          <td>Datum / Mjesto:</td><td>${f.do_datuma} / ${f.mjesto_povratka}</td>
        </tr>
        <tr>
          <td>Drugi vozač:</td><td>${f.ime2} (${f.br_vozacke2})</td>
          <td>Sat:</td><td>${f.vreme_povratka}</td>
        </tr>
        <tr><td colspan="5" style="background:#eee;text-align:center;font-weight:bold;font-size:11px;">IZDAO VOZILO: ${f.ko_je_izdao || '/'}</td></tr>
      </table>
      <div class="gray" style="padding:3px;margin-top:10px;">STANJE OPREME I VOZILA</div>
      <div class="check-grid">
        <div><div class="box"></div> Dokumenta</div>
        <div><div class="box"></div> Prva pomoć</div>
        <div><div class="box"></div> Dizalica</div>
        <div><div class="box"></div> Sijalice</div>
        <div><div class="box"></div> Rezervni točak</div>
        <div><div class="box"></div> Trougao</div>
        <div><div class="box"></div> Ključ za točkove</div>
        <div><div class="box"></div> Lanci</div>
        <div><div class="box"></div> Bebi sjediste</div>
      </div>
      <div style="text-align:center;font-weight:bold;margin:8px 0;font-size:11px;">
        DA LI ĆU VRATITI ČIST AUTO? &nbsp;&nbsp; DA <div class="box"></div> &nbsp; NE <div class="box"></div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin:8px 0;">
        <img style="width:62%;" src="https://planetrentacar.me/evidencija/ugovor/skica.jpg">
        <div style="width:35%;text-align:center;display:flex;flex-direction:column;gap:8px;">
          <img style="width:100%;max-width:170px;margin:0 auto;" src="https://planetrentacar.me/evidencija/ugovor/image1.jpg">
          <div style="border:2px solid #000;padding:5px;font-weight:bold;font-size:10px;">PRANJE VOZILA SE NAPLAĆUJE 10-20€</div>
          <div class="granica">GRANICA:<br>${f.granica}</div>
          <div class="legal">Renter je odgovoran za saobraćajne prekršaje. U slučaju oštećenja vozila, kada je krivac korisnik, potrebno je da nadoknadi štetu u potpunosti 100%. Pročitao sam i slažem se sa uslovima.<br><br>Renter is liable for traffic violations. In case of damage in case of drivers fault driver is charged 100% of damage. With this signature, renter agrees with terms and conditions.</div>
        </div>
      </div>
      <table>
        <tr><td colspan="4" class="gray">3. OBRAČUN I DODACI</td></tr>
        <tr>
          <td width="20%">Dani:</td><td width="30%">${dana} x ${f.cijena_dan}€</td>
          <td width="20%">Dozvola/Dostava:</td><td width="30%">${f.dozvola_van_zemlje}€ / ${f.dostava}€</td>
        </tr>
        <tr>
          <td>Sic/2. Vozač:</td><td>${f.bebi_sic * dana}€ / ${f.dodatni_vozac}€</td>
          <td>Osiguranje:</td><td>${f.tip_osiguranja.includes('Kasko') ? f.kasko_tip + ' (' + f.kasko_ucesce + '€)' : 'AO (Standard)'}</td>
        </tr>
        <tr>
          <td>Plaćanje:</td><td>${f.nacin_placanja}</td>
          <td>Depozit:</td><td>${f.depozit}€</td>
        </tr>
        <tr style="background:#000;color:#fff;font-size:12px;">
          <td colspan="2" style="padding-left:10px;">UKUPNO ZA NAPLATU: ${ukupno.toFixed(2)} €</td>
          <td colspan="2" style="text-align:right;padding-right:15px;">NAPLAĆENO: ${f.naplaceno.toFixed(2)}€ &nbsp;|&nbsp; DUG: ${dug.toFixed(2)}€</td>
        </tr>
      </table>
      <p style="font-size:10px;margin:5px 0;"><b>NAPOMENA:</b> ${f.napomena || 'Bez oštećenja.'}</p>
      <div style="display:flex;justify-content:space-between;margin-top:30px;">
        <div style="border-top:1px solid #000;width:180px;text-align:center;font-weight:bold;">Za Planet</div>
        <div style="border-top:1px solid #000;width:180px;text-align:center;font-weight:bold;">Korisnik</div>
      </div>
    </div></body></html>`

    const win = window.open('', '_blank')
    win?.document.write(html)
    win?.document.close()
  }

  // ─── FILTERI ─────────────────────────────────────────
  const filtered = rezervacije.filter(r => {
    if (filterStatus !== 'all' && r.status !== filterStatus) return false
    if (search) {
      const q = search.toLowerCase()
      return r.guest_name?.toLowerCase().includes(q) ||
        r.ref_code?.toLowerCase().includes(q) ||
        r.guest_phone?.includes(q)
    }
    return true
  })

  const dana = calcDana(form.od_datuma, form.do_datuma)
  const ukupno = calcUkupno(form)
  const dug = ukupno - form.naplaceno

  const inp: React.CSSProperties = {
    width: '100%', padding: '8px 10px', fontSize: 13,
    border: '1px solid #d1d5db', borderRadius: 8,
    background: '#fff', color: '#111', boxSizing: 'border-box',
  }
  const lbl: React.CSSProperties = {
    fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 3, fontWeight: 500
  }
  const marke = Array.from(new Set(vozila.map(v => v.marka))).sort()

  return (
    <div>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: '#111', margin: 0 }}>Rezervacije</h1>
        <button onClick={() => { setShowNovaRez(true); setEditRezId(null); setForm(EMPTY_FORM); setShowDodaci(false) }}
          style={{ padding: '9px 18px', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          + Nova rezervacija
        </button>
      </div>

      {/* FILTERI */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          style={{ padding: '7px 10px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', color: '#111' }}>
          <option value="all">Svi statusi</option>
          <option value="pending">Na čekanju</option>
          <option value="confirmed">Potvrđeno</option>
          <option value="issued">Izdato</option>
          <option value="closed">Zatvoreno</option>
          <option value="cancelled">Otkazano</option>
        </select>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pretraži ime, ref, telefon..."
          style={{ ...inp, width: 220, marginBottom: 0 }} />
        <span style={{ fontSize: 12, color: '#9ca3af', alignSelf: 'center' }}>{filtered.length} rezervacija</span>
      </div>

      {/* TABELA */}
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden', marginBottom: 20 }}>
        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Učitavanje...</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['Ref', 'Gost', 'Vozilo', 'Period', 'Iznos', 'Status', 'Akcije'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 500, fontSize: 12, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const st = ST[r.status] || ST.pending
                return (
                  <tr key={r.id}
                    onClick={() => setSelected(selected?.id === r.id ? null : r)}
                    style={{ borderBottom: '1px solid #f3f4f6', cursor: 'pointer', background: selected?.id === r.id ? '#f0fdf8' : 'transparent' }}>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 11, color: '#6b7280' }}>{r.ref_code}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ fontWeight: 500, color: '#111' }}>{r.guest_name}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>{r.guest_phone}</div>
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 12, color: '#374151' }}>{r.vehicles?.name || '—'}</td>
                    <td style={{ padding: '10px 12px', fontSize: 11, color: '#9ca3af', whiteSpace: 'nowrap' }}>
                      {r.pickup_date}<br />{r.return_date}
                    </td>
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: '#1D9E75' }}>{r.total_price}€</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ fontSize: 11, background: st.bg, color: st.color, padding: '3px 8px', borderRadius: 20, fontWeight: 500 }}>{st.label}</span>
                    </td>
                    <td style={{ padding: '10px 12px' }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {(r.status === 'confirmed' || r.status === 'pending') && (
                          <button onClick={() => { setCancelModal(r.id); setCancelReason('') }}
                            style={{ padding: '4px 8px', fontSize: 11, border: '1px solid #fecaca', borderRadius: 6, background: 'transparent', cursor: 'pointer', color: '#dc2626' }}>
                            Otkaži
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#9ca3af' }}>Nema rezervacija.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* DETAIL PANEL */}
      {selected && !showNovaRez && (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 20, background: '#fff', maxWidth: 500 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{selected.guest_name}</div>
              <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#9ca3af' }}>{selected.ref_code}</div>
            </div>
            <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#9ca3af' }}>✕</button>
          </div>
          {[
            ['Vozilo', selected.vehicles?.name],
            ['Email', selected.guest_email],
            ['Telefon', selected.guest_phone],
            ['Preuzimanje', `${selected.pickup_date} ${selected.pickup_time?.slice(0, 5)}`],
            ['Vraćanje', `${selected.return_date} ${selected.return_time?.slice(0, 5)}`],
            ['Lokacija', selected.pickup_location],
            ['Iznos', `${selected.total_price}€`],
            ['Izdao', selected.issued_by || '—'],
          ].map(([l, v]) => (
            <div key={String(l)} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f3f4f6', fontSize: 12 }}>
              <span style={{ color: '#9ca3af' }}>{l}</span>
              <span style={{ color: '#111', fontWeight: 500 }}>{v || '—'}</span>
            </div>
          ))}
        </div>
      )}

      {/* ─── MODAL: NOVA/EDIT REZERVACIJA ─── */}
      {showNovaRez && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 1100, maxHeight: '96vh', overflowY: 'auto' }}>

            {/* Header */}
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#fff', zIndex: 10 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{editRezId ? 'Uredi rezervaciju' : 'Nova rezervacija'}</h2>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => generateContract()}
                  style={{ padding: '7px 14px', fontSize: 12, background: '#E6F1FB', color: '#185FA5', border: '1px solid #185FA5', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
                  📄 Ugovor
                </button>
                <button onClick={saveRezervacija} disabled={saving}
                  style={{ padding: '7px 16px', fontSize: 12, background: saving ? '#5DCAA5' : '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
                  {saving ? '...' : '💾 Snimi'}
                </button>
                <button onClick={() => { setShowNovaRez(false); setForm(EMPTY_FORM) }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#9ca3af' }}>✕</button>
              </div>
            </div>

            <div style={{ padding: 24, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>

              {/* ── KLIJENT ── */}
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#1D9E75', textTransform: 'uppercase', marginBottom: 12, paddingBottom: 6, borderBottom: '1px solid #f3f4f6' }}>
                  Klijent informacije
                </div>

                {/* Pretraga po vozačkoj */}
                <div style={{ marginBottom: 10 }}>
                  <label style={lbl}>Pretraga (Broj vozačke)</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      list="klijenti-list"
                      style={{ ...inp, color: '#f59e0b', fontWeight: 700, flex: 1 }}
                      value={form.br_vozacke}
                      onChange={e => {
                        setForm(f => ({ ...f, br_vozacke: e.target.value }))
                        findKlijent(e.target.value)
                      }}
                      placeholder="Unesi broj vozačke..."
                    />
                  </div>
                  <datalist id="klijenti-list">
                    {klijenti.map(k => (
                      <option key={k.vozacka} value={k.vozacka}>{k.ime} {k.prezime}</option>
                    ))}
                  </datalist>
                  {klijentiLoading && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>Učitavam bazu klijenata...</div>}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                  <div>
                    <label style={lbl}>Ime</label>
                    <input style={inp} value={form.ime} onChange={e => setForm(f => ({ ...f, ime: e.target.value }))} />
                  </div>
                  <div>
                    <label style={lbl}>Prezime</label>
                    <input style={inp} value={form.prezime} onChange={e => setForm(f => ({ ...f, prezime: e.target.value }))} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                  <div>
                    <label style={lbl}>Zemlja</label>
                    <input style={inp} value={form.zemlja} onChange={e => setForm(f => ({ ...f, zemlja: e.target.value }))} />
                  </div>
                  <div>
                    <label style={lbl}>Datum рођења</label>
                    <input style={inp} value={form.datum_rodjenja} onChange={e => setForm(f => ({ ...f, datum_rodjenja: e.target.value }))} />
                  </div>
                </div>

                <div style={{ marginBottom: 8 }}>
                  <label style={lbl}>Telefon</label>
                  <input style={inp} value={form.telefon} onChange={e => setForm(f => ({ ...f, telefon: e.target.value }))} />
                </div>
                <div style={{ marginBottom: 8 }}>
                  <label style={lbl}>Email</label>
                  <input style={inp} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div style={{ marginBottom: 8 }}>
                  <label style={lbl}>Adresa stanovanja</label>
                  <input style={inp} value={form.adresa} onChange={e => setForm(f => ({ ...f, adresa: e.target.value }))} />
                </div>
                {form.istek_vozacke && (
                  <div style={{ background: '#f0fdf8', border: '1px solid #1D9E75', borderRadius: 6, padding: '6px 10px', fontSize: 11, color: '#085041', marginBottom: 8 }}>
                    Istek vozačke: <strong>{form.istek_vozacke}</strong>
                  </div>
                )}
              </div>

              {/* ── VOZILO ── */}
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#1D9E75', textTransform: 'uppercase', marginBottom: 12, paddingBottom: 6, borderBottom: '1px solid #f3f4f6' }}>
                  Vozilo & Napomene
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={lbl}>Firma</label>
                  <select style={inp} value={form.firma} onChange={e => setForm(f => ({ ...f, firma: e.target.value }))}>
                    {FIRME.map(fi => <option key={fi}>{fi}</option>)}
                  </select>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={lbl}>Tablice</label>
                  <select style={{ ...inp, color: '#f59e0b', fontWeight: 700 }} value={form.br_tablica} onChange={e => setForm(f => ({ ...f, br_tablica: e.target.value }))}>
                    <option value="">-- Izaberi vozilo --</option>
                    {marke.map(m => (
                      <optgroup key={m} label={m}>
                        {vozila.filter(v => v.marka === m).map(v => (
                          <option key={v.id} value={v.license_plate}>{v.agregirani_2}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  {form.br_tablica && (
                    <div style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700, marginTop: 4 }}>
                      {vozila.find(v => v.license_plate === form.br_tablica)?.agregirani_2}
                    </div>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                  <div>
                    <label style={lbl}>Osiguranje</label>
                    <select style={inp} value={form.tip_osiguranja} onChange={e => setForm(f => ({ ...f, tip_osiguranja: e.target.value }))}>
                      {['Osnovno (AO)', 'Full Kasko', 'Kasko sa učešćem'].map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={lbl}>Granica</label>
                    <select style={inp} value={form.granica} onChange={e => setForm(f => ({ ...f, granica: e.target.value }))}>
                      <option value="DOZVOLJENO VAN ZEMLJE">✅ Dozvoljeno</option>
                      <option value="ZABRANJENO VAN ZEMLJE">🚫 Zabranjeno</option>
                    </select>
                  </div>
                </div>
                {form.tip_osiguranja.includes('Kasko') && (
                  <div style={{ background: '#fffbeb', border: '1px solid #fbbf24', borderRadius: 8, padding: 10, marginBottom: 10 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div>
                        <label style={lbl}>Tip kaska</label>
                        <select style={inp} value={form.kasko_tip} onChange={e => setForm(f => ({ ...f, kasko_tip: e.target.value }))}>
                          <option value="FULL KASKO">FULL KASKO</option>
                          <option value="SA UČEŠĆEM">SA UČEŠĆEM</option>
                        </select>
                      </div>
                      <div>
                        <label style={lbl}>Kasko €/dan</label>
                        <input style={inp} type="number" value={form.kasko_cijena || ''} onChange={e => setForm(f => ({ ...f, kasko_cijena: parseFloat(e.target.value) || 0 }))} />
                      </div>
                    </div>
                    {form.kasko_tip === 'SA UČEŠĆEM' && (
                      <div style={{ marginTop: 8 }}>
                        <label style={lbl}>Učešće €</label>
                        <input style={inp} type="number" value={form.kasko_ucesce || ''} onChange={e => setForm(f => ({ ...f, kasko_ucesce: parseFloat(e.target.value) || 0 }))} />
                      </div>
                    )}
                  </div>
                )}
                <div style={{ marginBottom: 8 }}>
                  <label style={{ ...lbl, color: '#dc2626' }}>Ko je izdao vozilo?</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input style={{ ...inp, flex: 1, opacity: 0.7 }} value={form.ko_je_izdao} readOnly placeholder="Odaberi agenta..." />
                    <button onClick={() => setShowAgentModal(true)}
                      style={{ padding: '7px 10px', background: '#E1F5EE', border: '1px solid #1D9E75', borderRadius: 8, cursor: 'pointer', fontSize: 11, color: '#085041', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      Izaberi
                    </button>
                  </div>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <label style={lbl}>Broj leta</label>
                  <input style={inp} value={form.br_leta} onChange={e => setForm(f => ({ ...f, br_leta: e.target.value }))} placeholder="Npr. FR1234" />
                </div>
                <div style={{ marginBottom: 8 }}>
                  <label style={lbl}>Napomena / Oštećenja</label>
                  <textarea value={form.napomena} onChange={e => setForm(f => ({ ...f, napomena: e.target.value }))}
                    style={{ ...inp, minHeight: 65, resize: 'vertical' as const }} />
                </div>

                {/* Drugi vozač */}
                <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 10 }}>
                  <label style={{ ...lbl, marginBottom: 8 }}>Drugi vozač (opciono)</label>
                  <div style={{ marginBottom: 8 }}>
                    <label style={lbl}>Vozačka 2. vozača</label>
                    <input
                      list="klijenti-list2"
                      style={inp}
                      value={form.br_vozacke2}
                      onChange={e => { setForm(f => ({ ...f, br_vozacke2: e.target.value })); findKlijent2(e.target.value) }}
                      placeholder="Broj vozačke..."
                    />
                    <datalist id="klijenti-list2">
                      {klijenti.map(k => <option key={k.vozacka} value={k.vozacka}>{k.ime} {k.prezime}</option>)}
                    </datalist>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div><label style={lbl}>Ime</label><input style={inp} value={form.ime2} readOnly placeholder="Auto" /></div>
                    <div><label style={lbl}>Prezime</label><input style={inp} value={form.prezime2} readOnly placeholder="Auto" /></div>
                  </div>
                </div>
              </div>

              {/* ── NAJAM ── */}
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#1D9E75', textTransform: 'uppercase', marginBottom: 12, paddingBottom: 6, borderBottom: '1px solid #f3f4f6' }}>
                  Najam & Obračun
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                  <div>
                    <label style={lbl}>Mjesto preuzimanja</label>
                    <select style={inp} value={LOKACIJE_PREUZIMANJA.includes(form.mjesto_preuzimanja) ? form.mjesto_preuzimanja : 'custom'}
                      onChange={e => setForm(f => ({ ...f, mjesto_preuzimanja: e.target.value === 'custom' ? '' : e.target.value }))}>
                      {LOKACIJE_PREUZIMANJA.map(l => <option key={l} value={l}>{l}</option>)}
                      <option value="custom">Unesi sam...</option>
                    </select>
                    {!LOKACIJE_PREUZIMANJA.includes(form.mjesto_preuzimanja) && (
                      <input style={{ ...inp, marginTop: 4 }} value={form.mjesto_preuzimanja} onChange={e => setForm(f => ({ ...f, mjesto_preuzimanja: e.target.value }))} placeholder="Unesi lokaciju..." />
                    )}
                  </div>
                  <div>
                    <label style={lbl}>Mjesto povratka</label>
                    <select style={inp} value={LOKACIJE_PREUZIMANJA.includes(form.mjesto_povratka) ? form.mjesto_povratka : 'custom'}
                      onChange={e => setForm(f => ({ ...f, mjesto_povratka: e.target.value === 'custom' ? '' : e.target.value }))}>
                      {LOKACIJE_PREUZIMANJA.map(l => <option key={l} value={l}>{l}</option>)}
                      <option value="custom">Unesi sam...</option>
                    </select>
                    {!LOKACIJE_PREUZIMANJA.includes(form.mjesto_povratka) && (
                      <input style={{ ...inp, marginTop: 4 }} value={form.mjesto_povratka} onChange={e => setForm(f => ({ ...f, mjesto_povratka: e.target.value }))} placeholder="Unesi lokaciju..." />
                    )}
                  </div>
                </div>

                <div style={{ marginBottom: 10 }}>
                  <label style={lbl}>Izvor rezervacije</label>
                  <select style={inp} value={IZVORI.includes(form.izvor_rezervacije) ? form.izvor_rezervacije : 'custom'}
                    onChange={e => setForm(f => ({ ...f, izvor_rezervacije: e.target.value === 'custom' ? '' : e.target.value }))}>
                    {IZVORI.map(i => <option key={i} value={i}>{i}</option>)}
                    <option value="custom">Unesi sam...</option>
                  </select>
                  {!IZVORI.includes(form.izvor_rezervacije) && (
                    <input style={{ ...inp, marginTop: 4 }} value={form.izvor_rezervacije} onChange={e => setForm(f => ({ ...f, izvor_rezervacije: e.target.value }))} placeholder="Naziv hotela/apartmana..." />
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                  <div><label style={lbl}>Cijena €/dan</label><input style={inp} type="number" value={form.cijena_dan || ''} onChange={e => setForm(f => ({ ...f, cijena_dan: parseFloat(e.target.value) || 0 }))} /></div>
                  <div><label style={lbl}>Depozit €</label><input style={inp} type="number" value={form.depozit || ''} onChange={e => setForm(f => ({ ...f, depozit: parseFloat(e.target.value) || 0 }))} /></div>
                </div>

                <div style={{ marginBottom: 8 }}>
                  <label style={lbl}>Način plaćanja</label>
                  <select style={inp} value={form.nacin_placanja} onChange={e => setForm(f => ({ ...f, nacin_placanja: e.target.value }))}>
                    {['Keš', 'Kartica', 'Renta kartica - depozit keš', 'Preko računa'].map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                  <div><label style={lbl}>Od datuma</label><input style={inp} type="date" value={form.od_datuma} onChange={e => setForm(f => ({ ...f, od_datuma: e.target.value }))} /></div>
                  <div><label style={lbl}>Sat izlaska</label><input style={inp} value={form.vreme_izdavanja} onChange={e => setForm(f => ({ ...f, vreme_izdavanja: e.target.value }))} /></div>
                  <div><label style={lbl}>Do datuma</label><input style={inp} type="date" value={form.do_datuma} onChange={e => setForm(f => ({ ...f, do_datuma: e.target.value }))} /></div>
                  <div><label style={lbl}>Sat povratka</label><input style={inp} value={form.vreme_povratka} onChange={e => setForm(f => ({ ...f, vreme_povratka: e.target.value }))} /></div>
                </div>

                {/* Dodaci toggle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '10px 0', borderTop: '1px solid #f3f4f6', paddingTop: 10 }}>
                  <input type="checkbox" id="cb-dodaci" checked={showDodaci} onChange={e => setShowDodaci(e.target.checked)} style={{ width: 16, height: 16, margin: 0 }} />
                  <label htmlFor="cb-dodaci" style={{ fontSize: 11, fontWeight: 700, color: '#185FA5', cursor: 'pointer', textTransform: 'uppercase' }}>Prikaži dodatke</label>
                </div>
                {showDodaci && (
                  <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 10, marginBottom: 10 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div><label style={lbl}>Van zemlje €</label><input style={inp} type="number" value={form.dozvola_van_zemlje || ''} onChange={e => setForm(f => ({ ...f, dozvola_van_zemlje: parseFloat(e.target.value) || 0 }))} /></div>
                      <div><label style={lbl}>Dostava €</label><input style={inp} type="number" value={form.dostava || ''} onChange={e => setForm(f => ({ ...f, dostava: parseFloat(e.target.value) || 0 }))} /></div>
                      <div><label style={lbl}>Bebi sic €/dan</label><input style={inp} type="number" value={form.bebi_sic || ''} onChange={e => setForm(f => ({ ...f, bebi_sic: parseFloat(e.target.value) || 0 }))} /></div>
                      <div><label style={lbl}>2. vozač €</label><input style={inp} type="number" value={form.dodatni_vozac || ''} onChange={e => setForm(f => ({ ...f, dodatni_vozac: parseFloat(e.target.value) || 0 }))} /></div>
                    </div>
                  </div>
                )}

                {/* SUMMARY */}
                <div style={{ background: '#f9fafb', border: '1px solid #1D9E75', borderRadius: 10, padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>Ukupno dana:</span>
                    <strong style={{ fontSize: 16 }}>{dana}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, borderBottom: '1px solid #e5e7eb', paddingBottom: 8 }}>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>Total za naplatu:</span>
                    <strong style={{ fontSize: 18, color: '#111' }}>{ukupno.toFixed(2)} €</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>Naplaćeno:</span>
                    <input type="number" value={form.naplaceno || 0}
                      onChange={e => setForm(f => ({ ...f, naplaceno: parseFloat(e.target.value) || 0 }))}
                      style={{ width: 90, textAlign: 'right', fontSize: 16, fontWeight: 700, color: '#1D9E75', background: 'transparent', border: 'none', borderBottom: '1px dashed #1D9E75', outline: 'none' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e5e7eb', paddingTop: 8 }}>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>Dug:</span>
                    <strong style={{ fontSize: 22, color: dug > 0 ? '#dc2626' : '#1D9E75' }}>{dug.toFixed(2)} €</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AGENT MODAL */}
      {showAgentModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, maxWidth: 400, width: '100%' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 700 }}>Ko izdaje vozilo?</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
              {AGENTI.map(a => (
                <button key={a} onClick={() => { setForm(f => ({ ...f, ko_je_izdao: a })); setShowAgentModal(false) }}
                  style={{ padding: '10px', border: '1px solid #e5e7eb', borderRadius: 8, background: form.ko_je_izdao === a ? '#E1F5EE' : '#fff', cursor: 'pointer', fontSize: 13, color: '#374151', fontWeight: form.ko_je_izdao === a ? 600 : 400 }}>
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

      {/* CANCEL MODAL */}
      {cancelModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, maxWidth: 420, width: '100%' }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Otkazivanje rezervacije</div>
            <label style={lbl}>Razlog *</label>
            <textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)}
              placeholder="Klijent otkazao, dupla rezervacija..."
              style={{ ...inp, minHeight: 80, resize: 'vertical' as const, marginBottom: 16 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleCancel} disabled={!cancelReason.trim()}
                style={{ flex: 2, padding: 10, background: !cancelReason.trim() ? '#9ca3af' : '#dc2626', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Otkaži rezervaciju
              </button>
              <button onClick={() => { setCancelModal(null); setCancelReason('') }}
                style={{ flex: 1, padding: 10, border: '1px solid #d1d5db', borderRadius: 8, background: 'transparent', fontSize: 13, cursor: 'pointer', color: '#374151' }}>
                Nazad
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
