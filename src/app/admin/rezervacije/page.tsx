'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import { RezervacijaModal, RezForm, VoziloOption, EMPTY_REZ_FORM, calcDana, calcUkupno } from './RezervacijaModal'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Rezervacija = {
  id: string; ref_code: string; guest_name: string; guest_email: string; guest_phone: string
  guest_nationality: string; pickup_date: string; return_date: string
  pickup_time: string; return_time: string; pickup_location: string; notes: string
  total_price: number; final_total: number | null
  status: string; payment_status: string
  amount_paid: number; amount_debt: number; amount_prepaid: number; surcharges_total: number
  payment_method: string | null; issued_at: string | null; issued_by: string | null
  closed_at: string | null; closed_by: string | null
  is_early_return: boolean; original_return_date: string | null
  agent_name: string | null; created_at: string
  vehicles: { name: string } | null
}

type SurchargeType = { id: string; name: string; is_active: boolean; sort_order: number }

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

export default function AdminReservationsPage() {
  const [rezervacije, setRezervacije] = useState<Rezervacija[]>([])
  const [vozila, setVozila] = useState<VoziloOption[]>([])
  const [surchargeTypes, setSurchargeTypes] = useState<SurchargeType[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Rezervacija | null>(null)

  // Nova/edit rezervacija (nova tabela)
  const [showRezModal, setShowRezModal] = useState(false)
  const [rezForm, setRezForm] = useState<RezForm>(EMPTY_REZ_FORM)
  const [isNewRez, setIsNewRez] = useState(false)
  const [saving, setSaving] = useState(false)

  // Otkaži
  const [cancelModal, setCancelModal] = useState<string | null>(null)
  const [cancelReason, setCancelReason] = useState('')

  const agentName = getCookie('avtorent-agent-name')

  const loadData = useCallback(async () => {
    setLoading(true)
    const [{ data: res }, { data: voz }, { data: st }] = await Promise.all([
      supabase.from('reservations').select('*, vehicles(name)').order('created_at', { ascending: false }),
      supabase.from('vozila_fleet').select('id, license_plate, marka, model, agregirani_2, fleet_status, lokacija').order('marka'),
      supabase.from('surcharge_types').select('*').eq('is_active', true).order('sort_order'),
    ])
    setRezervacije(res || [])
    setVozila(voz || [])
    setSurchargeTypes(st || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // Otvori modal za novu rezervaciju
  function openNova() {
    setRezForm(EMPTY_REZ_FORM)
    setIsNewRez(true)
    setShowRezModal(true)
  }

  // Snimi rezervaciju u NOVU tabelu (rezervacije)
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
      daily_status: rezForm.daily_status || 'Na čekanju',
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

    await supabase.from('rezervacije').insert([payload])
    await supabase.from('logovi').insert([{ akcija: `Kreirana rezervacija za ${rezForm.ime_prezime} (${rezForm.br_tablica})` }])

    setSaving(false)
    setShowRezModal(false)
    setRezForm(EMPTY_REZ_FORM)
    // Ne reload existing reservations tabela — nova rez je u drugoj tabeli
  }

  // Otkaži iz postojeće tabele
  async function handleCancel() {
    if (!cancelModal || !cancelReason.trim()) return
    await supabase.from('reservations').update({
      status: 'cancelled', closed_by: agentName || 'Agent',
      closed_at: new Date().toISOString(), notes: cancelReason.trim(),
    }).eq('id', cancelModal)
    setCancelModal(null); setCancelReason(''); loadData()
  }

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

  const inp: React.CSSProperties = { padding: '7px 10px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', color: '#111' }
  const lbl: React.CSSProperties = { fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 3 }

  return (
    <div>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: '#111', margin: 0 }}>Rezervacije</h1>
        <button onClick={openNova}
          style={{ padding: '9px 18px', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          + Nova rezervacija
        </button>
      </div>

      {/* FILTERI */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={inp}>
          <option value="all">Svi statusi</option>
          <option value="pending">Na čekanju</option>
          <option value="confirmed">Potvrđeno</option>
          <option value="issued">Izdato</option>
          <option value="closed">Zatvoreno</option>
          <option value="cancelled">Otkazano</option>
        </select>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Pretraži ime, ref, telefon..."
          style={{ ...inp, width: 240 }} />
        <span style={{ fontSize: 12, color: '#9ca3af', alignSelf: 'center' }}>{filtered.length} rezervacija</span>
      </div>

      {/* TABELA */}
      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 340px' : '1fr', gap: 16 }}>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
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
                      <td style={{ padding: '10px 12px', fontSize: 11, color: '#9ca3af', whiteSpace: 'nowrap' as const }}>
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
        {selected && (
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 20, background: '#fff', alignSelf: 'start' }}>
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
              ['Naplaćeno', selected.amount_paid ? `${selected.amount_paid}€` : '—'],
              ['Plaćanje', selected.payment_method || '—'],
              ['Doplate', selected.surcharges_total ? `${selected.surcharges_total}€` : '—'],
              ['Ukupno', `${selected.final_total || selected.total_price}€`],
              ['Izdao', selected.issued_by || '—'],
              ['Zatvorio', selected.closed_by || '—'],
            ].map(([l, v]) => (
              <div key={String(l)} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f3f4f6', fontSize: 12 }}>
                <span style={{ color: '#9ca3af' }}>{l}</span>
                <span style={{ color: l === 'Ukupno' ? '#1D9E75' : '#111', fontWeight: l === 'Ukupno' ? 600 : 400 }}>{v || '—'}</span>
              </div>
            ))}
            {selected.payment_status === 'debt' && (
              <div style={{ background: '#FCEBEB', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px', marginTop: 10, fontSize: 12, fontWeight: 600, color: '#791F1F' }}>
                DUG: {selected.amount_debt?.toFixed(2)}€
              </div>
            )}
          </div>
        )}
      </div>

      {/* REZERVACIJA MODAL (shared komponent) */}
      {showRezModal && (
        <RezervacijaModal
          form={rezForm}
          setForm={setRezForm}
          vozila={vozila}
          onSave={saveRezervacija}
          onClose={() => { setShowRezModal(false); setRezForm(EMPTY_REZ_FORM) }}
          saving={saving}
          isNew={isNewRez}
          title="Nova rezervacija"
        />
      )}

      {/* CANCEL MODAL */}
      {cancelModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, maxWidth: 420, width: '100%' }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Otkazivanje rezervacije</div>
            <label style={lbl}>Razlog *</label>
            <textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)}
              placeholder="Klijent otkazao, dupla rezervacija..."
              style={{ width: '100%', padding: '9px 12px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, minHeight: 80, resize: 'vertical' as const, color: '#111', boxSizing: 'border-box' as const, marginBottom: 16 }} />
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
