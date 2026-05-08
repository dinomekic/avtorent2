'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const SHEETS_API = 'https://script.google.com/macros/s/AKfycbwyCvobRS9l_19Kl45yYVspy4DZWEKXzIMM5vSAy_PLELYN7DSnRVug_K_XGfzzZSJ0/exec'

// ─── TIPOVI ───────────────────────────────────────────────
export type RezForm = {
  id?: number
  // Klijent
  br_vozacke: string; ime_prezime: string
  zemlja: string; datum_rodjenja: string
  telefon: string; email: string; adresa: string; istek_vozacke: string
  // Drugi vozač
  br_vozacke2: string; ime2: string; prezime2: string
  // Vozilo
  br_tablica: string; firma: string
  tip_osiguranja: string; kasko_cijena: number
  kasko_tip: string; kasko_ucesce: number
  granica: string; napomena: string; br_leta: string
  ko_je_izdao: string; ko_je_preuzeo: string
  daily_status: string
  // Najam
  od_datuma: string; do_datuma: string
  vreme_izdavanja: string; vreme_povratka: string
  cijena_dan: number; depozit: number; nacin_placanja: string
  mjesto_preuzimanja: string; mjesto_povratka: string
  izvor_rezervacije: string
  // Dodaci
  dozvola_van_zemlje_cijena: number
  dostava_cijena: number
  bebi_sic_cijena: number
  dodatni_vozac_cijena: number
  dodatni_vozac_vozacka: string
  // Obračun
  naplaceno: number
}

export type VoziloOption = {
  id: number
  license_plate: string | null
  marka: string | null
  model: string | null
  agregirani_2: string | null
  lokacija: string
}

export const EMPTY_REZ_FORM: RezForm = {
  br_vozacke: '', ime_prezime: '', zemlja: '', datum_rodjenja: '',
  telefon: '', email: '', adresa: '', istek_vozacke: '',
  br_vozacke2: '', ime2: '', prezime2: '',
  br_tablica: '', firma: 'Meriem d.o.o.',
  tip_osiguranja: 'Osnovno (AO)', kasko_cijena: 0,
  kasko_tip: 'FULL KASKO', kasko_ucesce: 0,
  granica: 'DOZVOLJENO VAN ZEMLJE', napomena: '', br_leta: '',
  ko_je_izdao: '', ko_je_preuzeo: '', daily_status: 'Na čekanju',
  od_datuma: '', do_datuma: '',
  vreme_izdavanja: '10:00', vreme_povratka: '10:00',
  cijena_dan: 0, depozit: 0, nacin_placanja: 'Keš',
  mjesto_preuzimanja: 'Bulevar Veljka Vlahovića 16',
  mjesto_povratka: 'Bulevar Veljka Vlahovića 16',
  izvor_rezervacije: 'Sajt',
  dozvola_van_zemlje_cijena: 0, dostava_cijena: 0,
  bebi_sic_cijena: 0, dodatni_vozac_cijena: 0,
  dodatni_vozac_vozacka: '', naplaceno: 0,
}

const FIRME = ['Meriem d.o.o.', 'Planet Rent a Car', '3G-COMPANY DOO']
const FIRM_DATA: Record<string, { pib: string; tel: string }> = {
  'Meriem d.o.o.': { pib: '02967367', tel: '+382 69 222 234' },
  'Planet Rent a Car': { pib: '03254129', tel: '+382 69 810 805' },
  '3G-COMPANY DOO': { pib: '03012548', tel: '+382 69 160 769' },
}
const AGENTI = ['Ranka Bulatovic', 'Ena Rondic', 'Esad Djokic', 'Kenan Kolic', 'Edmir Paljevic', 'Semira Pepic', 'Adis Nikaj', 'Besim Adzovic', 'Jasmin Skrijelj', 'Edin Suljevic', 'Dino Mekic']
const LOKACIJE_PREUZIMANJA = ['Bulevar Veljka Vlahovića 16', 'Podgorica aerodrom', 'Tivat aerodrom']
const IZVORI = ['Sajt', 'Google', 'Instagram', 'Facebook', 'Mert', 'Localrents', 'Rent a car Montenegro', 'Nissa', 'Preko Edina', 'Posrednici hoteli']

export function calcDana(f: Partial<RezForm>): number {
  if (!f.od_datuma || !f.do_datuma) return 0
  return Math.max(1, Math.ceil((new Date(f.do_datuma).getTime() - new Date(f.od_datuma).getTime()) / 86400000))
}

export function calcUkupno(f: Partial<RezForm>): number {
  const dana = calcDana(f)
  let tot = dana * (f.cijena_dan || 0)
  if (f.tip_osiguranja?.includes('Kasko')) tot += dana * (f.kasko_cijena || 0)
  tot += (f.bebi_sic_cijena || 0) * dana
  tot += (f.dozvola_van_zemlje_cijena || 0)
  tot += (f.dostava_cijena || 0)
  tot += (f.dodatni_vozac_cijena || 0)
  return tot
}

// ─── HOOK ZA KLIJENTE IZ SHEETS ──────────────────────────
export function useKlijenti() {
  const [klijenti, setKlijenti] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(SHEETS_API, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'getDatabase' })
    })
      .then(r => r.json())
      .then(data => {
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
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  return { klijenti, loading }
}

// ─── GENERIŠI UGOVOR ─────────────────────────────────────
export function generateUgovor(f: RezForm, vozila: VoziloOption[]) {
  const firma = f.firma || 'Meriem d.o.o.'
  const fd = FIRM_DATA[firma]
  const dana = calcDana(f)
  const ukupno = calcUkupno(f)
  const dug = ukupno - (f.naplaceno || 0)
  const isZabranjeno = f.granica?.includes('ZABRANJENO')
  const vozilo = vozila.find(v => v.license_plate === f.br_tablica)

  const html = `<html><head><style>
    @page { size: A4; margin: 5mm; }
    body { font-family: sans-serif; font-size: 9.5px; line-height: 1.15; color: #000; margin: 0; }
    .wrap { padding: 5mm; min-height: 100vh; display: flex; flex-direction: column; justify-content: space-between; }
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
        <div>
          <h2 style="margin:0;font-size:18px;">PLANET "RENT A CAR"</h2>
          <p style="margin:2px 0;">${firma}<br>PIB: ${fd?.pib || ''}</p>
        </div>
      </div>
      <div style="text-align:right">
        <p style="margin:0;font-weight:bold;font-size:11px;">PODRŠKA: ${fd?.tel || ''}</p>
        <p style="margin:0;font-weight:bold;font-size:11px;">+382 69 160 769</p>
        <p style="margin:4px 0;font-size:11px;">Br. ugovora: ${f.id || 'NOVO'}</p>
      </div>
    </div>
    <table>
      <tr>
        <td colspan="2" class="gray">1. KORISNIK / RENTER</td>
        <td colspan="3" class="gray">2. VOZILO / VEHICLE</td>
      </tr>
      <tr>
        <td width="18%">Korisnik:</td>
        <td width="32%" style="font-weight:bold">${f.ime_prezime}</td>
        <td width="18%">Vozilo:</td>
        <td colspan="2" style="font-weight:bold">${vozilo?.agregirani_2 || f.br_tablica}</td>
      </tr>
      <tr>
        <td>Adresa:</td>
        <td>${f.adresa || ''}</td>
        <td>Reg br:</td>
        <td colspan="2" style="font-weight:bold">${f.br_tablica}</td>
      </tr>
      <tr>
        <td>Datum Rođ.:</td>
        <td>${f.datum_rodjenja || ''} (${f.zemlja || ''})</td>
        <td rowspan="2">Preuzimanje:</td>
        <td>Datum / Mjesto:</td>
        <td>${f.od_datuma} / ${f.mjesto_preuzimanja}</td>
      </tr>
      <tr>
        <td>Vozačka/Istek:</td>
        <td>${f.br_vozacke} (${f.istek_vozacke || ''})</td>
        <td>Sat:</td>
        <td>${f.vreme_izdavanja}</td>
      </tr>
      <tr>
        <td>Email/Tel:</td>
        <td>${f.email || ''} / ${f.telefon || ''}</td>
        <td rowspan="2">Povratak:</td>
        <td>Datum / Mjesto:</td>
        <td>${f.do_datuma} / ${f.mjesto_povratka}</td>
      </tr>
      <tr>
        <td>Drugi vozač:</td>
        <td>${f.ime2 || ''} ${f.prezime2 || ''} (${f.br_vozacke2 || ''})</td>
        <td>Sat:</td>
        <td>${f.vreme_povratka}</td>
      </tr>
      <tr>
        <td colspan="5" style="background:#eee;text-align:center;font-weight:bold;font-size:11px;">
          IZDAO VOZILO: ${f.ko_je_izdao || '/'}
        </td>
      </tr>
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
        <div class="legal">
          Renter je odgovoran za saobraćajne prekršaje. U slučaju oštećenja vozila, kada je krivac korisnik, 
          potrebno je da nadoknadi štetu u potpunosti 100%. U slučaju da je krivica drugog vozača, pokriva se 
          iz osiguranja. Pročitao sam i slažem se sa uslovima sa obje strane ugovora.<br><br>
          Renter is liable for traffic violations. All charges are subject to final audit. In case of damage 
          in case of drivers fault driver is charged 100% of damage. In case of others fault, it is on insurance. 
          With this signature, renter agrees with terms and conditions on both sides of the agreement.
        </div>
      </div>
    </div>
    <table>
      <tr><td colspan="4" class="gray">3. OBRAČUN I DODACI</td></tr>
      <tr>
        <td width="20%">Dani:</td>
        <td width="30%">${dana} x ${f.cijena_dan}€</td>
        <td width="20%">Dozvola/Dostava:</td>
        <td width="30%">${f.dozvola_van_zemlje_cijena}€ / ${f.dostava_cijena}€</td>
      </tr>
      <tr>
        <td>Sic/2. Vozač:</td>
        <td>${(f.bebi_sic_cijena || 0) * dana}€ / ${f.dodatni_vozac_cijena}€</td>
        <td>Osiguranje:</td>
        <td>${f.tip_osiguranja?.includes('Kasko') ? f.kasko_tip + ' (' + f.kasko_ucesce + '€)' : 'AO (Standard)'}</td>
      </tr>
      <tr>
        <td>Plaćanje:</td>
        <td>${f.nacin_placanja}</td>
        <td>Depozit:</td>
        <td>${f.depozit}€</td>
      </tr>
      <tr style="background:#000;color:#fff;font-size:12px;">
        <td colspan="2" style="padding-left:10px;">UKUPNO ZA NAPLATU: ${ukupno.toFixed(2)} €</td>
        <td colspan="2" style="text-align:right;padding-right:15px;">
          NAPLAĆENO: ${(f.naplaceno || 0).toFixed(2)}€ &nbsp;|&nbsp; DUG: ${dug.toFixed(2)}€
        </td>
      </tr>
    </table>
    <p style="font-size:10px;margin:5px 0;"><b>NAPOMENA:</b> ${f.napomena || 'Bez oštećenja.'}</p>
    ${f.br_leta ? `<p style="font-size:10px;margin:5px 0;"><b>BROJ LETA:</b> ${f.br_leta}</p>` : ''}
    <div style="display:flex;justify-content:space-between;margin-top:30px;">
      <div style="border-top:1px solid #000;width:180px;text-align:center;font-weight:bold;">Za Planet</div>
      <div style="border-top:1px solid #000;width:180px;text-align:center;font-weight:bold;">Korisnik</div>
    </div>
  </div></body></html>`

  const win = window.open('', '_blank')
  if (win) {
    win.document.write(html)
    win.document.close()
    setTimeout(() => win.print(), 500)
  }
}

// ─── MODAL KOMPONENT ─────────────────────────────────────
interface RezervacijaModalProps {
  form: RezForm
  setForm: (f: RezForm) => void
  vozila: VoziloOption[]
  onSave: () => void
  onClose: () => void
  onDelete?: () => void
  saving: boolean
  isNew: boolean
  title?: string
  // Opciono: agent dugmad
  onIzdaj?: () => void
  onPreuzmi?: () => void
}

export function RezervacijaModal({
  form, setForm, vozila, onSave, onClose, onDelete,
  saving, isNew, title, onIzdaj, onPreuzmi
}: RezervacijaModalProps) {
  const { klijenti, loading: kLoading } = useKlijenti()
  const [showDodaci, setShowDodaci] = useState(false)
  const [showAgentModal, setShowAgentModal] = useState(false)

  const dana = calcDana(form)
  const ukupno = calcUkupno(form)
  const dug = ukupno - (form.naplaceno || 0)

  const marke = Array.from(new Set(vozila.map(v => v.marka).filter(Boolean))).sort() as string[]

  function findKlijent(vozacka: string) {
    const k = klijenti.find(k => k.vozacka === vozacka.trim())
    if (k) {
      setForm({
        ...form,
        ime_prezime: `${k.ime} ${k.prezime}`.trim(),
        adresa: k.adresa,
        datum_rodjenja: k.rodjenje,
        zemlja: k.zemlja,
        telefon: k.telefon,
        email: k.email,
        istek_vozacke: k.istek,
      })
    }
  }

  function findKlijent2(vozacka: string) {
    const k = klijenti.find(k => k.vozacka === vozacka.trim())
    if (k) setForm({ ...form, br_vozacke2: vozacka, ime2: k.ime, prezime2: k.prezime })
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '8px 10px', fontSize: 13,
    border: '1px solid #d1d5db', borderRadius: 8,
    background: '#fff', color: '#111', boxSizing: 'border-box',
  }
  const lbl: React.CSSProperties = {
    fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 3, fontWeight: 500
  }

  const isCustomLokPreuzimanja = !LOKACIJE_PREUZIMANJA.includes(form.mjesto_preuzimanja)
  const isCustomLokPovratka = !LOKACIJE_PREUZIMANJA.includes(form.mjesto_povratka)
  const isCustomIzvor = !IZVORI.includes(form.izvor_rezervacije)

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 }}>
        <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 1150, maxHeight: '96vh', overflowY: 'auto' }}>

          {/* ─── HEADER ─── */}
          <div style={{ padding: '16px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#fff', zIndex: 10 }}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#111' }}>
              {title || (isNew ? 'Nova rezervacija' : `REZ #${form.id}`)}
            </h2>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {!isNew && onDelete && (
                <button onClick={onDelete}
                  style={{ padding: '7px 14px', fontSize: 12, border: '1px solid #fecaca', borderRadius: 8, background: '#fff', cursor: 'pointer', color: '#dc2626' }}>
                  🗑️ Obriši
                </button>
              )}
              {!isNew && onIzdaj && !form.ko_je_izdao && (
                <button onClick={onIzdaj}
                  style={{ padding: '7px 14px', fontSize: 12, border: '1px solid #1D9E75', borderRadius: 8, background: '#E1F5EE', cursor: 'pointer', color: '#085041', fontWeight: 600 }}>
                  🚗 Izdaj
                </button>
              )}
              {!isNew && onPreuzmi && form.ko_je_izdao && !form.ko_je_preuzeo && (
                <button onClick={onPreuzmi}
                  style={{ padding: '7px 14px', fontSize: 12, border: '1px solid #185FA5', borderRadius: 8, background: '#E6F1FB', cursor: 'pointer', color: '#0C447C', fontWeight: 600 }}>
                  🔙 Preuzmi
                </button>
              )}
              <button onClick={() => generateUgovor(form, vozila)}
                style={{ padding: '7px 14px', fontSize: 12, background: '#FAEEDA', color: '#633806', border: '1px solid #EF9F27', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
                📄 Ugovor
              </button>
              <button onClick={onSave} disabled={saving}
                style={{ padding: '7px 16px', fontSize: 12, background: saving ? '#5DCAA5' : '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
                {saving ? '...' : '💾 Snimi'}
              </button>
              <button onClick={onClose}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#9ca3af' }}>✕</button>
            </div>
          </div>

          <div style={{ padding: 24, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>

            {/* ─── KLIJENT ─── */}
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#1D9E75', textTransform: 'uppercase', marginBottom: 12, paddingBottom: 6, borderBottom: '1px solid #f3f4f6' }}>
                Klijent informacije
              </div>

              {/* Pretraga po vozačkoj */}
              <div style={{ marginBottom: 10 }}>
                <label style={lbl}>Pretraga (Broj vozačke)</label>
                <input
                  list="rez-klijenti-list"
                  style={{ ...inp, color: '#f59e0b', fontWeight: 700 }}
                  value={form.br_vozacke}
                  onChange={e => {
                    setForm({ ...form, br_vozacke: e.target.value })
                    findKlijent(e.target.value)
                  }}
                  placeholder="Unesi broj vozačke..."
                />
                <datalist id="rez-klijenti-list">
                  {klijenti.map(k => (
                    <option key={k.vozacka} value={k.vozacka}>{k.ime} {k.prezime}</option>
                  ))}
                </datalist>
                {kLoading && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>Učitavam klijente...</div>}
                {form.istek_vozacke && (
                  <div style={{ marginTop: 4, background: '#f0fdf8', border: '1px solid #1D9E75', borderRadius: 6, padding: '4px 8px', fontSize: 11, color: '#085041' }}>
                    Istek vozačke: <strong>{form.istek_vozacke}</strong>
                  </div>
                )}
              </div>

              <div style={{ marginBottom: 8 }}>
                <label style={lbl}>Ime i Prezime *</label>
                <input style={inp} value={form.ime_prezime}
                  onChange={e => setForm({ ...form, ime_prezime: e.target.value })} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <div>
                  <label style={lbl}>Zemlja</label>
                  <input style={inp} value={form.zemlja}
                    onChange={e => setForm({ ...form, zemlja: e.target.value })} />
                </div>
                <div>
                  <label style={lbl}>Datum rođenja</label>
                  <input style={inp} value={form.datum_rodjenja}
                    onChange={e => setForm({ ...form, datum_rodjenja: e.target.value })} />
                </div>
              </div>

              <div style={{ marginBottom: 8 }}>
                <label style={lbl}>Telefon</label>
                <input style={inp} value={form.telefon}
                  onChange={e => setForm({ ...form, telefon: e.target.value })} />
              </div>
              <div style={{ marginBottom: 8 }}>
                <label style={lbl}>Email</label>
                <input style={inp} value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
              <div style={{ marginBottom: 8 }}>
                <label style={lbl}>Adresa stanovanja</label>
                <input style={inp} value={form.adresa}
                  onChange={e => setForm({ ...form, adresa: e.target.value })} />
              </div>

              <div style={{ marginBottom: 8 }}>
                <label style={lbl}>Status rezervacije</label>
                <select style={inp} value={form.daily_status}
                  onChange={e => setForm({ ...form, daily_status: e.target.value })}>
                  {['Na čekanju', 'Izdato', 'Nije izdato'].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>

              {form.ko_je_izdao && (
                <div style={{ background: '#f0fdf8', border: '1px solid #1D9E75', borderRadius: 6, padding: '6px 10px', fontSize: 11, color: '#085041', marginBottom: 6 }}>
                  🚗 Izdao: <strong>{form.ko_je_izdao}</strong>
                </div>
              )}
              {form.ko_je_preuzeo && (
                <div style={{ background: '#E6F1FB', border: '1px solid #85B7EB', borderRadius: 6, padding: '6px 10px', fontSize: 11, color: '#0C447C', marginBottom: 6 }}>
                  🔙 Preuzeo: <strong>{form.ko_je_preuzeo}</strong>
                </div>
              )}

              {/* Drugi vozač */}
              <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 10, marginTop: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Drugi vozač (opciono)</div>
                <div style={{ marginBottom: 8 }}>
                  <label style={lbl}>Vozačka 2. vozača</label>
                  <input
                    list="rez-klijenti-list2"
                    style={inp}
                    value={form.br_vozacke2}
                    onChange={e => {
                      setForm({ ...form, br_vozacke2: e.target.value })
                      findKlijent2(e.target.value)
                    }}
                    placeholder="Broj vozačke..."
                  />
                  <datalist id="rez-klijenti-list2">
                    {klijenti.map(k => <option key={k.vozacka} value={k.vozacka}>{k.ime} {k.prezime}</option>)}
                  </datalist>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <label style={lbl}>Ime</label>
                    <input style={{ ...inp, opacity: 0.8 }} value={form.ime2} readOnly placeholder="Auto" />
                  </div>
                  <div>
                    <label style={lbl}>Prezime</label>
                    <input style={{ ...inp, opacity: 0.8 }} value={form.prezime2} readOnly placeholder="Auto" />
                  </div>
                </div>
              </div>
            </div>

            {/* ─── VOZILO ─── */}
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#1D9E75', textTransform: 'uppercase', marginBottom: 12, paddingBottom: 6, borderBottom: '1px solid #f3f4f6' }}>
                Vozilo & Napomene
              </div>

              <div style={{ marginBottom: 10 }}>
                <label style={lbl}>Firma</label>
                <select style={inp} value={form.firma}
                  onChange={e => setForm({ ...form, firma: e.target.value })}>
                  {FIRME.map(fi => <option key={fi}>{fi}</option>)}
                </select>
              </div>

              <div style={{ marginBottom: 10 }}>
                <label style={lbl}>Tablice *</label>
                <select style={{ ...inp, color: '#f59e0b', fontWeight: 700 }}
                  value={form.br_tablica}
                  onChange={e => setForm({ ...form, br_tablica: e.target.value })}>
                  <option value="">-- Izaberi vozilo --</option>
                  {marke.map(m => (
                    <optgroup key={m} label={m}>
                      {vozila.filter(v => v.marka === m).map(v => (
                        <option key={v.id} value={v.license_plate || ''}>
                          {v.agregirani_2}
                        </option>
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
                  <select style={inp} value={form.tip_osiguranja}
                    onChange={e => setForm({ ...form, tip_osiguranja: e.target.value })}>
                    {['Osnovno (AO)', 'Full Kasko', 'Kasko sa učešćem'].map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Granica</label>
                  <select style={inp} value={form.granica}
                    onChange={e => setForm({ ...form, granica: e.target.value })}>
                    <option value="DOZVOLJENO VAN ZEMLJE">✅ Dozvoljeno</option>
                    <option value="ZABRANJENO VAN ZEMLJE">🚫 Zabranjeno</option>
                  </select>
                </div>
              </div>

              {form.tip_osiguranja.includes('Kasko') && (
                <div style={{ background: '#fffbeb', border: '1px solid #fbbf24', borderRadius: 8, padding: 10, marginBottom: 10 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                    <div>
                      <label style={lbl}>Tip kaska</label>
                      <select style={inp} value={form.kasko_tip}
                        onChange={e => setForm({ ...form, kasko_tip: e.target.value })}>
                        <option value="FULL KASKO">FULL KASKO</option>
                        <option value="SA UČEŠĆEM">SA UČEŠĆEM</option>
                      </select>
                    </div>
                    <div>
                      <label style={lbl}>Kasko €/dan</label>
                      <input style={inp} type="number" value={form.kasko_cijena || ''}
                        onChange={e => setForm({ ...form, kasko_cijena: parseFloat(e.target.value) || 0 })} />
                    </div>
                  </div>
                  {form.kasko_tip === 'SA UČEŠĆEM' && (
                    <div>
                      <label style={lbl}>Učešće €</label>
                      <input style={inp} type="number" value={form.kasko_ucesce || ''}
                        onChange={e => setForm({ ...form, kasko_ucesce: parseFloat(e.target.value) || 0 })} />
                    </div>
                  )}
                </div>
              )}

              <div style={{ marginBottom: 8 }}>
                <label style={{ ...lbl, color: '#dc2626' }}>Ko je izdao vozilo?</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input style={{ ...inp, flex: 1, opacity: 0.7 }} value={form.ko_je_izdao}
                    readOnly placeholder="Odaberi agenta..." />
                  <button onClick={() => setShowAgentModal(true)}
                    style={{ padding: '7px 10px', background: '#E1F5EE', border: '1px solid #1D9E75', borderRadius: 8, cursor: 'pointer', fontSize: 11, color: '#085041', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    Izaberi
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: 8 }}>
                <label style={lbl}>Broj leta</label>
                <input style={inp} value={form.br_leta}
                  onChange={e => setForm({ ...form, br_leta: e.target.value })}
                  placeholder="Npr. FR1234" />
              </div>

              <div style={{ marginBottom: 8 }}>
                <label style={lbl}>Napomena / Oštećenja</label>
                <textarea value={form.napomena}
                  onChange={e => setForm({ ...form, napomena: e.target.value })}
                  style={{ ...inp, minHeight: 80, resize: 'vertical' as const }} />
              </div>
            </div>

            {/* ─── NAJAM ─── */}
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#1D9E75', textTransform: 'uppercase', marginBottom: 12, paddingBottom: 6, borderBottom: '1px solid #f3f4f6' }}>
                Najam & Obračun
              </div>

              {/* Mjesta */}
              <div style={{ marginBottom: 10 }}>
                <label style={lbl}>Mjesto preuzimanja</label>
                <select style={inp}
                  value={isCustomLokPreuzimanja ? 'custom' : form.mjesto_preuzimanja}
                  onChange={e => setForm({ ...form, mjesto_preuzimanja: e.target.value === 'custom' ? '' : e.target.value })}>
                  {LOKACIJE_PREUZIMANJA.map(l => <option key={l} value={l}>{l}</option>)}
                  <option value="custom">Unesi sam...</option>
                </select>
                {isCustomLokPreuzimanja && (
                  <input style={{ ...inp, marginTop: 4 }} value={form.mjesto_preuzimanja}
                    onChange={e => setForm({ ...form, mjesto_preuzimanja: e.target.value })}
                    placeholder="Unesi lokaciju..." />
                )}
              </div>

              <div style={{ marginBottom: 10 }}>
                <label style={lbl}>Mjesto povratka</label>
                <select style={inp}
                  value={isCustomLokPovratka ? 'custom' : form.mjesto_povratka}
                  onChange={e => setForm({ ...form, mjesto_povratka: e.target.value === 'custom' ? '' : e.target.value })}>
                  {LOKACIJE_PREUZIMANJA.map(l => <option key={l} value={l}>{l}</option>)}
                  <option value="custom">Unesi sam...</option>
                </select>
                {isCustomLokPovratka && (
                  <input style={{ ...inp, marginTop: 4 }} value={form.mjesto_povratka}
                    onChange={e => setForm({ ...form, mjesto_povratka: e.target.value })}
                    placeholder="Unesi lokaciju..." />
                )}
              </div>

              <div style={{ marginBottom: 10 }}>
                <label style={lbl}>Izvor rezervacije</label>
                <select style={inp}
                  value={isCustomIzvor ? 'custom' : form.izvor_rezervacije}
                  onChange={e => setForm({ ...form, izvor_rezervacije: e.target.value === 'custom' ? '' : e.target.value })}>
                  {IZVORI.map(i => <option key={i} value={i}>{i}</option>)}
                  <option value="custom">Unesi sam (hotel/apartman)...</option>
                </select>
                {isCustomIzvor && (
                  <input style={{ ...inp, marginTop: 4 }} value={form.izvor_rezervacije}
                    onChange={e => setForm({ ...form, izvor_rezervacije: e.target.value })}
                    placeholder="Naziv hotela/apartmana..." />
                )}
              </div>

              {/* Datumi */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <div>
                  <label style={lbl}>Od datuma</label>
                  <input style={inp} type="date" value={form.od_datuma}
                    onChange={e => setForm({ ...form, od_datuma: e.target.value })} />
                </div>
                <div>
                  <label style={lbl}>Sat izlaska</label>
                  <input style={inp} value={form.vreme_izdavanja}
                    onChange={e => setForm({ ...form, vreme_izdavanja: e.target.value })} />
                </div>
                <div>
                  <label style={lbl}>Do datuma</label>
                  <input style={inp} type="date" value={form.do_datuma}
                    onChange={e => setForm({ ...form, do_datuma: e.target.value })} />
                </div>
                <div>
                  <label style={lbl}>Sat povratka</label>
                  <input style={inp} value={form.vreme_povratka}
                    onChange={e => setForm({ ...form, vreme_povratka: e.target.value })} />
                </div>
                <div>
                  <label style={lbl}>Cijena €/dan</label>
                  <input style={inp} type="number" value={form.cijena_dan || ''}
                    onChange={e => setForm({ ...form, cijena_dan: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <label style={lbl}>Depozit €</label>
                  <input style={inp} type="number" value={form.depozit || ''}
                    onChange={e => setForm({ ...form, depozit: parseFloat(e.target.value) || 0 })} />
                </div>
              </div>

              <div style={{ marginBottom: 10 }}>
                <label style={lbl}>Način plaćanja</label>
                <select style={inp} value={form.nacin_placanja}
                  onChange={e => setForm({ ...form, nacin_placanja: e.target.value })}>
                  {['Keš', 'Kartica', 'Renta kartica - depozit keš', 'Preko računa'].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>

              {/* Dodaci */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '10px 0', borderTop: '1px solid #f3f4f6', paddingTop: 10 }}>
                <input type="checkbox" id="cb-dodaci-modal" checked={showDodaci}
                  onChange={e => setShowDodaci(e.target.checked)}
                  style={{ width: 16, height: 16, margin: 0 }} />
                <label htmlFor="cb-dodaci-modal"
                  style={{ fontSize: 11, fontWeight: 700, color: '#185FA5', cursor: 'pointer', textTransform: 'uppercase' }}>
                  Prikaži dodatke
                </label>
              </div>
              {showDodaci && (
                <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 10, marginBottom: 10 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div>
                      <label style={lbl}>Van zemlje €</label>
                      <input style={inp} type="number" value={form.dozvola_van_zemlje_cijena || ''}
                        onChange={e => setForm({ ...form, dozvola_van_zemlje_cijena: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <div>
                      <label style={lbl}>Dostava €</label>
                      <input style={inp} type="number" value={form.dostava_cijena || ''}
                        onChange={e => setForm({ ...form, dostava_cijena: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <div>
                      <label style={lbl}>Bebi sic €/dan</label>
                      <input style={inp} type="number" value={form.bebi_sic_cijena || ''}
                        onChange={e => setForm({ ...form, bebi_sic_cijena: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <div>
                      <label style={lbl}>2. vozač €</label>
                      <input style={inp} type="number" value={form.dodatni_vozac_cijena || ''}
                        onChange={e => setForm({ ...form, dodatni_vozac_cijena: parseFloat(e.target.value) || 0 })} />
                    </div>
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
                  <input type="number"
                    value={form.naplaceno || 0}
                    onChange={e => setForm({ ...form, naplaceno: parseFloat(e.target.value) || 0 })}
                    style={{ width: 90, textAlign: 'right', fontSize: 16, fontWeight: 700, color: '#1D9E75', background: 'transparent', border: 'none', borderBottom: '1px dashed #1D9E75', outline: 'none' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e5e7eb', paddingTop: 8 }}>
                  <span style={{ fontSize: 12, color: '#6b7280' }}>Dug:</span>
                  <strong style={{ fontSize: 22, color: dug > 0 ? '#dc2626' : '#1D9E75' }}>
                    {dug.toFixed(2)} €
                  </strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── AGENT MODAL ─── */}
      {showAgentModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, maxWidth: 400, width: '100%' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 700 }}>Ko izdaje vozilo?</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
              {AGENTI.map(a => (
                <button key={a}
                  onClick={() => { setForm({ ...form, ko_je_izdao: a }); setShowAgentModal(false) }}
                  style={{ padding: '10px', border: `1px solid ${form.ko_je_izdao === a ? '#1D9E75' : '#e5e7eb'}`, borderRadius: 8, background: form.ko_je_izdao === a ? '#E1F5EE' : '#fff', cursor: 'pointer', fontSize: 13, color: '#374151', fontWeight: form.ko_je_izdao === a ? 600 : 400 }}>
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
    </>
  )
}
