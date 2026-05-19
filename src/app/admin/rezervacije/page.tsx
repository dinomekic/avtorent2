'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import { RezervacijaModal, RezForm, VoziloOption, EMPTY_REZ_FORM, calcDana, calcUkupno } from '@/lib/RezervacijaModal'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Rezervacija = {
  id: string; ref_code: string; guest_name: string; guest_email: string; guest_phone: string
  guest_nationality: string; pickup_date: string; return_date: string
  pickup_time: string; return_time: string; pickup_location: string; notes: string
  total_price: number; final_total: number | null
  status: string; payment_status: string; inquiry_status: string | null
  amount_paid: number; amount_debt: number; amount_prepaid: number; surcharges_total: number
  payment_method: string | null; issued_at: string | null; issued_by: string | null
  closed_at: string | null; closed_by: string | null
  is_early_return: boolean; original_return_date: string | null
  agent_name: string | null; agent_note: string | null; created_at: string
  vehicles: { name: string } | null
  qr_source: string | null; site_domain: string | null
  partners: { name: string } | null
  confirmation_token: string | null
  license_url: string | null
  assigned_vehicle_name: string | null
  assigned_vehicle_plate: string | null
  guest_dob: string | null; guest_license: string | null
  insurance: string | null; insurance_total: number | null
  border_crossing: string | null; flight_number: string | null
  extras_total: number | null; transfer_fee: number | null
  dropoff_location: string | null
  driver2_name: string | null; has_second_driver: boolean | null
}

const ST: Record<string, { bg: string; color: string; label: string }> = {
  pending:   { bg: '#FAEEDA', color: '#633806', label: 'Na čekanju' },
  confirmed: { bg: '#E1F5EE', color: '#085041', label: 'Potvrđeno' },
  issued:    { bg: '#E6F1FB', color: '#0C447C', label: 'Izdato' },
  closed:    { bg: '#f3f4f6', color: '#374151', label: 'Zatvoreno' },
  cancelled: { bg: '#FCEBEB', color: '#791F1F', label: 'Otkazano' },
}

const INQ_ST: Record<string, { bg: string; color: string; label: string }> = {
  new:       { bg: '#FCEBEB', color: '#791F1F', label: '🆕 Novi upit' },
  reviewing: { bg: '#FAEEDA', color: '#633806', label: '👀 U pregledu' },
  sent:      { bg: '#E6F1FB', color: '#0C447C', label: '📨 Link poslan' },
  confirmed: { bg: '#E1F5EE', color: '#085041', label: '✅ Potvrđeno' },
  rejected:  { bg: '#f3f4f6', color: '#6b7280', label: '❌ Odbijeno' },
}

function getCookie(name: string): string {
  if (typeof document === 'undefined') return ''
  const match = document.cookie.match(new RegExp(`${name}=([^;]+)`))
  return match ? decodeURIComponent(match[1]) : ''
}

function daysBetween(from: string, to: string): number {
  const d1 = new Date(from), d2 = new Date(to)
  return Math.max(1, Math.round((d2.getTime() - d1.getTime()) / 86400000))
}

function genToken(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export default function AdminReservationsPage() {
  const [activeTab, setActiveTab] = useState<'upiti' | 'rezervacije'>('upiti')
  const [rezervacije, setRezervacije] = useState<Rezervacija[]>([])
  const [vozila, setVozila] = useState<VoziloOption[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Rezervacija | null>(null)

  // Nova rezervacija
  const [showRezModal, setShowRezModal] = useState(false)
  const [rezForm, setRezForm] = useState<RezForm>(EMPTY_REZ_FORM)
  const [isNewRez, setIsNewRez] = useState(false)
  const [saving, setSaving] = useState(false)
  const [prebacujemId, setPrebacujemId] = useState<string | null>(null)

  // Otkaži
  const [cancelModal, setCancelModal] = useState<string | null>(null)
  const [cancelReason, setCancelReason] = useState('')

  // Upit panel
  const [upitModal, setUpitModal] = useState<Rezervacija | null>(null)
  const [assignVozilo, setAssignVozilo] = useState('')
  const [assignVoziloName, setAssignVoziloName] = useState('')
  const [agentNote, setAgentNote] = useState('')
  const [sendingLink, setSendingLink] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [generatedLink, setGeneratedLink] = useState('')

  const agentName = getCookie('avtorent-agent-name')

  const loadData = useCallback(async () => {
    setLoading(true)
    const [{ data: res }, { data: voz }] = await Promise.all([
      supabase.from('reservations').select('*, partners(name)').order('created_at', { ascending: false }),
      supabase.from('vozila_fleet').select('id, license_plate, marka, model, agregirani_2, fleet_status, lokacija').order('marka'),
    ])

    const rezervacije = res || []
    const enriched = rezervacije.map((r: any) => {
      const isNumeric = /^\d+$/.test(String(r.vehicle_id))
      if (isNumeric) {
        const v = (voz || []).find((v: any) => String(v.id) === String(r.vehicle_id))
        return { ...r, vehicles: v ? { name: v.agregirani_2 || `${v.marka} ${v.model}` } : null }
      }
      return { ...r, vehicles: r.vehicles || null }
    })

    setRezervacije(enriched)
    setVozila((voz || []).filter((v: any) => v.fleet_status === 'available'))
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // Upiti = reservations sa status pending/confirmed koje nisu issued
  const upiti = rezervacije.filter(r => r.status !== 'issued' && r.status !== 'closed')
  const kalendarRez = rezervacije.filter(r => r.status === 'issued' || r.status === 'closed' || r.status === 'cancelled')
  const noviUpiti = upiti.filter(r => !r.inquiry_status || r.inquiry_status === 'new').length

  function openNova() {
    setRezForm(EMPTY_REZ_FORM)
    setIsNewRez(true)
    setShowRezModal(true)
  }

  function openPrebaci(r: Rezervacija) {
    setPrebacujemId(r.id)
    const dana = daysBetween(r.pickup_date, r.return_date)
    const cijenaPoDay = dana > 0 ? Math.round((r.total_price || 0) / dana) : r.total_price || 0
    setRezForm({
      ...EMPTY_REZ_FORM,
      ime_prezime: r.guest_name || '',
      telefon: r.guest_phone || '',
      email: r.guest_email || '',
      zemlja: r.guest_nationality || '',
      od_datuma: r.pickup_date || '',
      do_datuma: r.return_date || '',
      vreme_izdavanja: r.pickup_time?.slice(0, 5) || '10:00',
      vreme_povratka: r.return_time?.slice(0, 5) || '10:00',
      cijena_dan: cijenaPoDay,
      naplaceno: r.amount_paid || 0,
      nacin_placanja: r.payment_method || 'Keš',
      mjesto_preuzimanja: r.pickup_location || '',
      mjesto_povratka: r.dropoff_location || r.pickup_location || '',
      napomena: [r.notes, `Sajt ref: ${r.ref_code}`, r.agent_name ? `Agent: ${r.agent_name}` : ''].filter(Boolean).join(' | '),
      izvor_rezervacije: 'Sajt',
      daily_status: 'Na čekanju',
      br_tablica: r.assigned_vehicle_plate || '',
    })
    setIsNewRez(true)
    setShowRezModal(true)
  }

  function openUpit(r: Rezervacija) {
    setUpitModal(r)
    setAssignVozilo(r.assigned_vehicle_plate || '')
    setAssignVoziloName(r.assigned_vehicle_name || '')
    setAgentNote(r.agent_note || '')
    setGeneratedLink(r.confirmation_token
      ? `${window.location.origin}/potvrda/${r.confirmation_token}`
      : '')
    // Označi kao reviewing
    if (!r.inquiry_status || r.inquiry_status === 'new') {
      supabase.from('reservations').update({ inquiry_status: 'reviewing' }).eq('id', r.id)
      setRezervacije(prev => prev.map(x => x.id === r.id ? { ...x, inquiry_status: 'reviewing' } : x))
    }
  }

  async function generateAndSendLink() {
    if (!upitModal) return
    setSendingLink(true)
    const token = genToken()
    const link = `${window.location.origin}/potvrda/${token}`

    // Nađi vozilo
    const voz = vozila.find(v => v.license_plate === assignVozilo)
    const vozName = assignVoziloName || (voz ? (voz as any).agregirani_2 || `${(voz as any).marka} ${(voz as any).model}` : assignVozilo)

    await supabase.from('reservations').update({
      confirmation_token: token,
      assigned_vehicle_plate: assignVozilo || null,
      assigned_vehicle_name: vozName || null,
      agent_note: agentNote || null,
      inquiry_status: 'sent',
    }).eq('id', upitModal.id)

    setGeneratedLink(link)
    setCopiedLink(false)
    setSendingLink(false)

    // Ažuriraj lokalni state
    setRezervacije(prev => prev.map(x => x.id === upitModal.id ? {
      ...x, confirmation_token: token, assigned_vehicle_plate: assignVozilo,
      assigned_vehicle_name: vozName, agent_note: agentNote, inquiry_status: 'sent'
    } : x))
    setUpitModal(prev => prev ? { ...prev, confirmation_token: token, inquiry_status: 'sent' } : prev)
  }

  async function saveRezervacija() {
    if (!rezForm.br_tablica || !rezForm.ime_prezime) {
      alert('Unesite tablice i ime!'); return
    }
    setSaving(true)
    const dana = calcDana(rezForm)
    const ukupno = calcUkupno(rezForm)
    const payload = {
      br_tablica: rezForm.br_tablica, ime_prezime: rezForm.ime_prezime,
      br_vozacke: rezForm.br_vozacke, daily_status: rezForm.daily_status || 'Na čekanju',
      od_datuma: rezForm.od_datuma, do_datuma: rezForm.do_datuma,
      vreme_izdavanja: rezForm.vreme_izdavanja, vreme_povratka: rezForm.vreme_povratka,
      cijena_dan: rezForm.cijena_dan, nacin_placanja: rezForm.nacin_placanja,
      firma: rezForm.firma, adresa: rezForm.adresa, telefon: rezForm.telefon,
      email: rezForm.email, zemlja: rezForm.zemlja, datum_rodjenja: rezForm.datum_rodjenja,
      tip_osiguranja: rezForm.tip_osiguranja, kasko_cijena: rezForm.kasko_cijena,
      kasko_tip: rezForm.kasko_tip, kasko_ucesce: rezForm.kasko_ucesce,
      granica: rezForm.granica, depozit: rezForm.depozit, napomena: rezForm.napomena,
      bebi_sic_cijena: rezForm.bebi_sic_cijena, dozvola_van_zemlje_cijena: rezForm.dozvola_van_zemlje_cijena,
      dostava_cijena: rezForm.dostava_cijena, dodatni_vozac_cijena: rezForm.dodatni_vozac_cijena,
      dodatni_vozac_vozacka: rezForm.br_vozacke2, br_leta: rezForm.br_leta,
      mjesto_preuzimanja: rezForm.mjesto_preuzimanja, mjesto_povratka: rezForm.mjesto_povratka,
      izvor_rezervacije: rezForm.izvor_rezervacije, ko_je_izdao: agentName || rezForm.ko_je_izdao,
      naplaceno: rezForm.naplaceno, ukupno_naplata: ukupno, broj_dana: dana,
    }
    await supabase.from('rezervacije').insert([payload])
    await supabase.from('logovi').insert([{ akcija: `Kreirana rezervacija za ${rezForm.ime_prezime} (${rezForm.br_tablica})` }])

    if (prebacujemId) {
      await supabase.from('reservations').update({
        status: 'issued', issued_by: agentName || 'Agent',
        issued_at: new Date().toISOString(), inquiry_status: 'confirmed',
      }).eq('id', prebacujemId)
      setPrebacujemId(null)
    }

    setSaving(false)
    setShowRezModal(false)
    setRezForm(EMPTY_REZ_FORM)
    loadData()
  }

  async function handleCancel() {
    if (!cancelModal || !cancelReason.trim()) return
    await supabase.from('reservations').update({
      status: 'cancelled', closed_by: agentName || 'Agent',
      closed_at: new Date().toISOString(), notes: cancelReason.trim(),
      inquiry_status: 'rejected',
    }).eq('id', cancelModal)
    setCancelModal(null); setCancelReason(''); loadData()
  }

  const filteredUpiti = upiti.filter(r => {
    if (filterStatus !== 'all' && r.inquiry_status !== filterStatus) return false
    if (search) {
      const q = search.toLowerCase()
      return r.guest_name?.toLowerCase().includes(q) || r.ref_code?.toLowerCase().includes(q) || r.guest_phone?.includes(q)
    }
    return true
  })

  const filteredRez = kalendarRez.filter(r => {
    if (filterStatus !== 'all' && r.status !== filterStatus) return false
    if (search) {
      const q = search.toLowerCase()
      return r.guest_name?.toLowerCase().includes(q) || r.ref_code?.toLowerCase().includes(q) || r.guest_phone?.includes(q)
    }
    return true
  })

  const inp: React.CSSProperties = { padding: '7px 10px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', color: '#111' }
  const lbl: React.CSSProperties = { fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 3 }
  const inpFull: React.CSSProperties = { ...inp, width: '100%', boxSizing: 'border-box' as const }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#111', margin: 0 }}>Rezervacije</h1>
        </div>
        <button onClick={openNova} style={{ padding: '9px 18px', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          + Nova rezervacija
        </button>
      </div>

      {/* TABOVI */}
      <div style={{ display: 'flex', borderBottom: '2px solid #f3f4f6', marginBottom: 16 }}>
        {([
          ['upiti', `📥 Upiti sa sajta${noviUpiti > 0 ? ` (${noviUpiti})` : ''}`],
          ['rezervacije', '📅 Kalendar rezervacije'],
        ] as const).map(([t, l]) => (
          <button key={t} onClick={() => { setActiveTab(t); setFilterStatus('all'); setSearch(''); setSelected(null) }}
            style={{ padding: '9px 20px', fontSize: 13, border: 'none', background: 'none', cursor: 'pointer', fontWeight: activeTab === t ? 700 : 400, color: activeTab === t ? '#1D9E75' : '#9ca3af', borderBottom: activeTab === t ? '2px solid #1D9E75' : '2px solid transparent', marginBottom: -2, position: 'relative' as const }}>
            {l}
            {t === 'upiti' && noviUpiti > 0 && (
              <span style={{ position: 'absolute' as const, top: 4, right: 4, width: 8, height: 8, borderRadius: '50%', background: '#dc2626' }} />
            )}
          </button>
        ))}
      </div>

      {/* FILTERI */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' as const }}>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={inp}>
          {activeTab === 'upiti' ? (<>
            <option value="all">Svi statusi</option>
            <option value="new">🆕 Novi</option>
            <option value="reviewing">👀 U pregledu</option>
            <option value="sent">📨 Link poslan</option>
            <option value="confirmed">✅ Potvrđeno</option>
            <option value="rejected">❌ Odbijeno</option>
          </>) : (<>
            <option value="all">Svi statusi</option>
            <option value="issued">Prebačeno</option>
            <option value="closed">Zatvoreno</option>
            <option value="cancelled">Otkazano</option>
          </>)}
        </select>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Pretraži ime, ref, telefon..."
          style={{ ...inp, width: 240 }} />
        <span style={{ fontSize: 12, color: '#9ca3af', alignSelf: 'center' }}>
          {activeTab === 'upiti' ? filteredUpiti.length : filteredRez.length} prikazano
        </span>
      </div>

      {/* ═══ TAB: UPITI ═══ */}
      {activeTab === 'upiti' && (
        <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 360px' : '1fr', gap: 16 }}>
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
            {loading ? (
              <div style={{ padding: 32, textAlign: 'center', color: '#9ca3af' }}>Učitavanje...</div>
            ) : filteredUpiti.length === 0 ? (
              <div style={{ padding: 48, textAlign: 'center', color: '#9ca3af' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📥</div>
                <div>Nema upita.</div>
              </div>
            ) : (
              <div>
                {filteredUpiti.map(r => {
                  const inqSt = INQ_ST[r.inquiry_status || 'new'] || INQ_ST.new
                  const isNew = !r.inquiry_status || r.inquiry_status === 'new'
                  return (
                    <div key={r.id}
                      onClick={() => { setSelected(selected?.id === r.id ? null : r); if (selected?.id !== r.id) openUpit(r) }}
                      style={{ padding: '14px 16px', borderBottom: '1px solid #f3f4f6', cursor: 'pointer', background: selected?.id === r.id ? '#f0fdf8' : isNew ? '#fffbeb' : '#fff', borderLeft: `3px solid ${isNew ? '#f59e0b' : selected?.id === r.id ? '#1D9E75' : 'transparent'}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14, color: '#111' }}>{r.guest_name}</div>
                          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>
                            {r.guest_phone} · {r.guest_email}
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'flex-end', gap: 4 }}>
                          <span style={{ fontSize: 11, background: inqSt.bg, color: inqSt.color, padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>{inqSt.label}</span>
                          <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#9ca3af' }}>{r.ref_code}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#374151' }}>
                        <span>📅 {r.pickup_date} → {r.return_date}</span>
                        <span>📍 {r.pickup_location}</span>
                        <span style={{ color: '#1D9E75', fontWeight: 600 }}>{r.total_price}€</span>
                      </div>
                      {r.assigned_vehicle_name && (
                        <div style={{ marginTop: 4, fontSize: 11, color: '#185FA5', fontWeight: 600 }}>
                          🚗 Dodijeljeno: {r.assigned_vehicle_name}
                        </div>
                      )}
                      {r.license_url && (
                        <div style={{ marginTop: 2, fontSize: 11, color: '#1D9E75' }}>📎 Vozačka dozvola uploadovana ✓</div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* UPIT DETAIL PANEL */}
          {selected && upitModal?.id === selected.id && (
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, background: '#fff', alignSelf: 'start', maxHeight: '85vh', overflowY: 'auto' as const }}>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky' as const, top: 0, background: '#fff', zIndex: 1 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{selected.guest_name}</div>
                  <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#9ca3af' }}>{selected.ref_code}</div>
                </div>
                <button onClick={() => { setSelected(null); setUpitModal(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#9ca3af' }}>✕</button>
              </div>

              <div style={{ padding: '14px 16px' }}>
                {/* Podaci klijenta */}
                <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 8, textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>Podaci klijenta</div>
                <div style={{ background: '#f9fafb', borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
                  {[
                    ['Ime', selected.guest_name],
                    ['Email', selected.guest_email],
                    ['Telefon', selected.guest_phone],
                    ['Nacionalnost', selected.guest_nationality],
                    ['Datum rođenja', selected.guest_dob],
                    ['Br. vozačke', selected.guest_license],
                    ['Drugi vozač', selected.has_second_driver ? selected.driver2_name || 'Da' : 'Ne'],
                  ].map(([l, v]) => v ? (
                    <div key={l as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 12, borderBottom: '1px solid #f3f4f6' }}>
                      <span style={{ color: '#9ca3af' }}>{l}</span>
                      <span style={{ color: '#111', fontWeight: 500 }}>{v}</span>
                    </div>
                  ) : null)}
                </div>

                {/* Detalji upita */}
                <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 8, textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>Detalji upita</div>
                <div style={{ background: '#f9fafb', borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
                  {[
                    ['Period', `${selected.pickup_date} → ${selected.return_date}`],
                    ['Dana', String(daysBetween(selected.pickup_date, selected.return_date))],
                    ['Preuzimanje', selected.pickup_location],
                    ['Vraćanje', selected.dropoff_location || selected.pickup_location],
                    ['Osiguranje', selected.insurance],
                    ['Granica', selected.border_crossing],
                    ['Broj leta', selected.flight_number],
                    ['Extras', selected.extras_total ? `${selected.extras_total}€` : null],
                    ['Transfer', selected.transfer_fee ? `${selected.transfer_fee}€` : null],
                    ['Cijena najma', `${selected.total_price}€`],
                    ['Napomena', selected.notes],
                  ].map(([l, v]) => v ? (
                    <div key={l as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 12, borderBottom: '1px solid #f3f4f6' }}>
                      <span style={{ color: '#9ca3af' }}>{l}</span>
                      <span style={{ color: '#111', fontWeight: 500, textAlign: 'right' as const, maxWidth: 180 }}>{v}</span>
                    </div>
                  ) : null)}
                </div>

                {/* Vozačka dozvola */}
                {selected.license_url && (
                  <div style={{ background: '#E1F5EE', border: '1px solid #1D9E75', borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#085041', marginBottom: 6 }}>📎 Vozačka dozvola</div>
                    <a href={selected.license_url} target="_blank" rel="noreferrer"
                      style={{ fontSize: 13, color: '#085041', fontWeight: 600, textDecoration: 'none', padding: '6px 14px', background: '#fff', borderRadius: 8, border: '1px solid #1D9E75', display: 'inline-block' }}>
                      📄 Otvori dokument →
                    </a>
                  </div>
                )}

                {/* Dodjeli vozilo */}
                <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 8, textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>Dodjeli vozilo</div>
                <div style={{ marginBottom: 10 }}>
                  <label style={lbl}>Vozilo *</label>
                  <select value={assignVozilo} onChange={e => {
                    setAssignVozilo(e.target.value)
                    const v = vozila.find((v: any) => v.license_plate === e.target.value) as any
                    setAssignVoziloName(v ? v.agregirani_2 || `${v.marka} ${v.model}` : '')
                  }} style={inpFull}>
                    <option value="">-- Odaberi vozilo --</option>
                    {vozila.map((v: any) => (
                      <option key={v.id} value={v.license_plate}>
                        {v.license_plate} — {v.agregirani_2 || `${v.marka} ${v.model}`} ({v.lokacija})
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={lbl}>Napomena agentu (vidljiva klijentu)</label>
                  <textarea value={agentNote} onChange={e => setAgentNote(e.target.value)}
                    placeholder="Npr: Vozilo čeka vas na aerodromu, terminal 1..."
                    rows={3} style={{ ...inpFull, resize: 'vertical' as const }} />
                </div>

                {/* Generiši link */}
                <button onClick={generateAndSendLink} disabled={sendingLink || !assignVozilo}
                  style={{ width: '100%', padding: '11px', background: !assignVozilo ? '#9ca3af' : '#185FA5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', marginBottom: 10 }}>
                  {sendingLink ? '⏳ Generišem...' : '🔗 Generiši link za potvrdu'}
                </button>

                {/* Generirani link */}
                {generatedLink && (
                  <div style={{ background: '#E6F1FB', border: '1px solid #85B7EB', borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#0C447C', marginBottom: 6 }}>📨 Link za potvrdu klijenta:</div>
                    <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#185FA5', wordBreak: 'break-all' as const, marginBottom: 8 }}>{generatedLink}</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => { navigator.clipboard.writeText(generatedLink); setCopiedLink(true) }}
                        style={{ flex: 1, padding: '7px', background: copiedLink ? '#1D9E75' : '#fff', color: copiedLink ? '#fff' : '#185FA5', border: '1px solid #85B7EB', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                        {copiedLink ? '✓ Kopirano' : '📋 Kopiraj'}
                      </button>
                      <a href={`https://wa.me/${selected.guest_phone?.replace(/\D/g, '')}?text=${encodeURIComponent(`Poštovani ${selected.guest_name},\n\nVaša rezervacija je pripremljena. Molimo Vas da potvrdite i dostavite vozačku dozvolu na linku:\n${generatedLink}`)}`}
                        target="_blank" rel="noreferrer"
                        style={{ flex: 1, padding: '7px', background: '#25D366', color: '#fff', borderRadius: 7, fontSize: 12, fontWeight: 600, textDecoration: 'none', textAlign: 'center' as const, display: 'block' }}>
                        💬 WhatsApp
                      </a>
                    </div>
                  </div>
                )}

                {/* Akcije */}
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  {selected.status !== 'cancelled' && (
                    <>
                      <button onClick={() => { openPrebaci(selected); setSelected(null); setUpitModal(null) }}
                        style={{ flex: 2, padding: '9px', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                        📅 Prebaci u kalendar
                      </button>
                      <button onClick={() => { setCancelModal(selected.id); setCancelReason('') }}
                        style={{ flex: 1, padding: '9px', border: '1px solid #fecaca', borderRadius: 8, background: 'transparent', fontSize: 12, cursor: 'pointer', color: '#dc2626' }}>
                        Otkaži
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ TAB: KALENDAR REZERVACIJE ═══ */}
      {activeTab === 'rezervacije' && (
        <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 340px' : '1fr', gap: 16 }}>
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
            {loading ? (
              <div style={{ padding: 32, textAlign: 'center', color: '#9ca3af' }}>Učitavanje...</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    {['Ref', 'Gost', 'Vozilo', 'Period', 'Iznos', 'Status', 'Izvor', 'Akcije'].map(h => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 500, fontSize: 12, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRez.map(r => {
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
                        <td style={{ padding: '10px 12px', fontSize: 12, color: '#374151' }}>{r.vehicles?.name || r.assigned_vehicle_name || '—'}</td>
                        <td style={{ padding: '10px 12px', fontSize: 11, color: '#9ca3af', whiteSpace: 'nowrap' as const }}>
                          {r.pickup_date}<br />{r.return_date}
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: 600, color: '#1D9E75' }}>{r.total_price}€</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ fontSize: 11, background: st.bg, color: st.color, padding: '3px 8px', borderRadius: 20, fontWeight: 500 }}>
                            {st.label}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          {r.qr_source
                            ? <span style={{ fontSize: 11, background: '#FAEEDA', color: '#854F0B', padding: '2px 7px', borderRadius: 20 }}>{r.partners?.name || r.qr_source}</span>
                            : <span style={{ fontSize: 11, color: '#9ca3af' }}>Direktno</span>}
                        </td>
                        <td style={{ padding: '10px 12px' }} onClick={e => e.stopPropagation()}>
                          {(r.status === 'confirmed' || r.status === 'pending') && (
                            <button onClick={() => { setCancelModal(r.id); setCancelReason('') }}
                              style={{ padding: '4px 8px', fontSize: 11, border: '1px solid #fecaca', borderRadius: 6, background: 'transparent', cursor: 'pointer', color: '#dc2626' }}>
                              Otkaži
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  {filteredRez.length === 0 && (
                    <tr><td colSpan={8} style={{ padding: 32, textAlign: 'center', color: '#9ca3af' }}>Nema rezervacija.</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>

          {selected && activeTab === 'rezervacije' && (
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 20, background: '#fff', alignSelf: 'start' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{selected.guest_name}</div>
                  <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#9ca3af' }}>{selected.ref_code}</div>
                </div>
                <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#9ca3af' }}>✕</button>
              </div>
              {([
                ['Vozilo', selected.vehicles?.name || selected.assigned_vehicle_name],
                ['Email', selected.guest_email],
                ['Telefon', selected.guest_phone],
                ['Preuzimanje', `${selected.pickup_date} ${selected.pickup_time?.slice(0, 5)}`],
                ['Vraćanje', `${selected.return_date} ${selected.return_time?.slice(0, 5)}`],
                ['Lokacija', selected.pickup_location],
                ['Iznos', `${selected.total_price}€`],
                ['Ukupno', `${selected.final_total || selected.total_price}€`],
                ['Izdao', selected.issued_by || '—'],
                ['Napomena', selected.notes || '—'],
              ] as [string, string | undefined][]).map(([l, v]) => (
                <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f3f4f6', fontSize: 12 }}>
                  <span style={{ color: '#9ca3af' }}>{l}</span>
                  <span style={{ color: l === 'Ukupno' ? '#1D9E75' : '#111', fontWeight: l === 'Ukupno' ? 600 : 400, maxWidth: 180, textAlign: 'right' as const }}>{v || '—'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* REZ MODAL */}
      {showRezModal && (
        <RezervacijaModal
          form={rezForm} setForm={setRezForm} vozila={vozila}
          onSave={saveRezervacija}
          onClose={() => { setShowRezModal(false); setRezForm(EMPTY_REZ_FORM); setPrebacujemId(null) }}
          saving={saving} isNew={isNewRez}
          title={prebacujemId ? '📅 Prebaci u kalendar' : 'Nova rezervacija'}
        />
      )}

      {/* CANCEL MODAL */}
      {cancelModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, maxWidth: 420, width: '100%' }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Otkazivanje</div>
            <label style={lbl}>Razlog *</label>
            <textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)}
              placeholder="Klijent otkazao..."
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
