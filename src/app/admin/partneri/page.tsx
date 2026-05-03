'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Partner = {
  id: string; name: string; contact_name: string; email: string
  portal_email: string; phone: string
  commission_percent: number; client_discount_percent: number
  qr_code: string; is_active: boolean; is_draft: boolean
  reservation_count?: number; total_revenue?: number
  commission_earned?: number; commission_paid?: number; commission_remaining?: number
}

type Payout = {
  id: string; amount: number; note: string; status: string; created_at: string
}

type PartnerQrCode = {
  id: string; partner_id: string; qr_code: string; label: string; created_at: string
  scan_count?: number
}

const emptyForm = { name: '', contact_name: '', email: '', portal_email: '', phone: '', commission_percent: '10', client_discount_percent: '5', qr_code: '', country: '', city: '', google_maps_url: '', acquisition_channel: 'direct', acquired_by_agent: '', acquired_by_collaborator_id: '' }

export default function AdminPartneriPage() {
  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showBatchForm, setShowBatchForm] = useState(false)
  const [editPartner, setEditPartner] = useState<Partner | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null)
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [payoutAmount, setPayoutAmount] = useState('')
  const [payoutNote, setPayoutNote] = useState('')
  const [payoutSaving, setPayoutSaving] = useState(false)
  const [agentsList, setAgentsList] = useState<{id: string; full_name: string}[]>([])
  const [collaboratorsList, setCollaboratorsList] = useState<{id: string; full_name: string}[]>([])
  const [batchCount, setBatchCount] = useState('10')
  const [batchPrefix, setBatchPrefix] = useState('AP')
  const [batchGenerating, setBatchGenerating] = useState(false)
  const [showQR, setShowQR] = useState<{ qr_code: string; name: string; label?: string } | null>(null)
  const [filterMode, setFilterMode] = useState<'all' | 'active' | 'draft'>('all')
  const [partnerQrCodes, setPartnerQrCodes] = useState<PartnerQrCode[]>([])
  const [showQrPanel, setShowQrPanel] = useState<Partner | null>(null)
  const [newQrLabel, setNewQrLabel] = useState('')
  const [addingQr, setAddingQr] = useState(false)
  const [editingLabel, setEditingLabel] = useState<{ id: string; label: string } | null>(null)
  const qrRef = useRef<HTMLDivElement>(null)

  const siteUrl = typeof window !== 'undefined' ? window.location.origin : 'https://rent-cars.me'

  useEffect(() => {
    fetchData()
    supabase.from('agents').select('id, full_name').eq('is_active', true).then(({ data }) => setAgentsList(data || []))
    supabase.from('collaborators').select('id, full_name').eq('is_active', true).then(({ data }) => setCollaboratorsList(data || []))
  }, [])

  async function fetchData() {
    const { data: partnersData } = await supabase.from('partners').select('*').order('created_at')
    const { data: reservations } = await supabase.from('reservations').select('partner_id, total_price, commission_amount, status').neq('status', 'cancelled')
    const { data: payoutsData } = await supabase.from('partner_payouts').select('partner_id, amount, status')

    const enriched = (partnersData || []).map(p => {
      const pRes = (reservations || []).filter(r => r.partner_id === p.id)
      const completed = pRes.filter(r => r.status === 'completed' || r.status === 'closed' || r.status === 'issued')
      const commissionEarned = completed.reduce((s: number, r: any) => s + (r.commission_amount || 0), 0)
      const commissionPaid = (payoutsData || []).filter((p2: any) => p2.partner_id === p.id && p2.status === 'confirmed').reduce((s: number, p2: any) => s + p2.amount, 0)
      return { ...p, reservation_count: pRes.length, total_revenue: pRes.reduce((s: number, r: any) => s + (r.total_price || 0), 0), commission_earned: commissionEarned, commission_paid: commissionPaid, commission_remaining: commissionEarned - commissionPaid }
    })
    setPartners(enriched)
    setLoading(false)
  }

  async function fetchPayouts(partnerId: string) {
    const { data } = await supabase.from('partner_payouts').select('*').eq('partner_id', partnerId).order('created_at', { ascending: false })
    setPayouts(data || [])
  }

  async function fetchPartnerQrCodes(partnerId: string) {
    const { data: codes } = await supabase
      .from('partner_qr_codes')
      .select('*')
      .eq('partner_id', partnerId)
      .order('created_at')

    if (!codes) { setPartnerQrCodes([]); return }

    // Dodaj broj skeniranja za svaki kod
    const withScans = await Promise.all(codes.map(async (c) => {
      const { count } = await supabase
        .from('qr_scans')
        .select('id', { count: 'exact' })
        .eq('qr_code', c.qr_code)
      return { ...c, scan_count: count || 0 }
    }))

    setPartnerQrCodes(withScans)
  }

  async function addQrCode() {
    if (!showQrPanel || !newQrLabel.trim()) return
    setAddingQr(true)

    // Generiši novi jedinstveni kod
    const { data: existing } = await supabase.from('partner_qr_codes').select('qr_code').ilike('qr_code', `${batchPrefix}-%`)
    const { data: partnersCodes } = await supabase.from('partners').select('qr_code')
    const allCodes = [...(existing || []).map((c: any) => c.qr_code), ...(partnersCodes || []).map((p: any) => p.qr_code)]
    const maxNum = allCodes.reduce((max, code) => {
      const parts = code.split('-')
      const num = parseInt(parts[parts.length - 1] || '0')
      return num > max ? num : max
    }, 0)

    const newCode = `${batchPrefix}-${String(maxNum + 1).padStart(4, '0')}`

    await supabase.from('partner_qr_codes').insert({
      partner_id: showQrPanel.id,
      qr_code: newCode,
      label: newQrLabel.trim(),
    })

    setNewQrLabel('')
    setAddingQr(false)
    fetchPartnerQrCodes(showQrPanel.id)

    // Pošalji email sa novim kodom
    if (showQrPanel.portal_email || showQrPanel.email) {
      await fetch('/api/partner-welcome-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({
            partnerName: showQrPanel.name,
            partnerEmail: showQrPanel.portal_email || showQrPanel.email,
            portalEmail: showQrPanel.portal_email || showQrPanel.email,
            qrCode: newCode,
            isNewCode: true,
            qrLabel: newQrLabel.trim(),
          }),
      }).catch(() => {})
    }
  }

  async function updateQrLabel(id: string, label: string) {
    await supabase.from('partner_qr_codes').update({ label }).eq('id', id)
    setEditingLabel(null)
    if (showQrPanel) fetchPartnerQrCodes(showQrPanel.id)
  }

  function openQrPanel(p: Partner) {
    setShowQrPanel(p)
    setShowForm(false)
    setShowBatchForm(false)
    setSelectedPartner(null)
    fetchPartnerQrCodes(p.id)
  }

  function openEdit(p: Partner) {
    setEditPartner(p)
    setForm({ name: p.name || '', contact_name: p.contact_name || '', email: p.email || '', portal_email: p.portal_email || '', phone: p.phone || '', commission_percent: String(p.commission_percent), client_discount_percent: String(p.client_discount_percent || '0'), qr_code: p.qr_code, country: (p as any).country || '', city: (p as any).city || '', google_maps_url: (p as any).google_maps_url || '', acquisition_channel: (p as any).acquisition_channel || 'direct', acquired_by_agent: (p as any).acquired_by_agent || '', acquired_by_collaborator_id: (p as any).acquired_by_collaborator_id || '' })
    setShowForm(true)
    setSelectedPartner(null)
    setShowBatchForm(false)
    setShowQrPanel(null)
  }

  function openPayouts(p: Partner) {
    setSelectedPartner(p)
    setShowForm(false)
    setShowBatchForm(false)
    setShowQrPanel(null)
    fetchPayouts(p.id)
    setPayoutAmount('')
    setPayoutNote('')
  }

  async function savePartner() {
    if (!form.qr_code) return
    setSaving(true)
    const payload = {
      name: form.name, contact_name: form.contact_name, email: form.email,
      portal_email: form.portal_email, phone: form.phone,
      commission_percent: parseFloat(form.commission_percent),
      client_discount_percent: parseFloat(form.client_discount_percent || '0'),
      qr_code: form.qr_code,
      is_draft: !form.name,
      is_active: !!form.name,
      country: (form as any).country || null,
      city: (form as any).city || null,
      google_maps_url: (form as any).google_maps_url || null,
      acquisition_channel: (form as any).acquisition_channel || 'direct',
      acquired_by_agent: (form as any).acquired_by_agent || null,
      acquired_by_collaborator_id: (form as any).acquired_by_collaborator_id || null,
    }
    if (editPartner) {
      await supabase.from('partners').update(payload).eq('id', editPartner.id)
      // Ako je partner upravo aktiviran (bio draft), sinkronizuj label glavnog koda
      if (editPartner.is_draft && form.name) {
        await supabase.from('partner_qr_codes').update({ label: 'Glavni kod' }).eq('partner_id', editPartner.id).eq('qr_code', editPartner.qr_code)
      }
    } else {
      const { data: newPartner } = await supabase.from('partners').insert({ ...payload }).select().single()
      // Kreiraj početni QR kod u partner_qr_codes
      if (newPartner) {
        await supabase.from('partner_qr_codes').insert({
          partner_id: newPartner.id,
          qr_code: form.qr_code,
          label: 'Glavni kod',
        })
      }
    }
// Pošalji welcome email ako partner ima email i nije draft
// Pošalji welcome email sa nalogom u oba slučaja — novi partner ili aktivacija drafta
    const isActivation = !!(editPartner?.is_draft && form.name)
    const isNew = !editPartner
    if ((isNew || isActivation) && form.name && (form.portal_email || form.email)) {
      await fetch('/api/partner-create-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partnerName: form.name,
          partnerEmail: form.portal_email || form.email,
          qrCode: form.qr_code,
        }),
      }).catch(() => {})
    }
    setSaving(false); setShowForm(false); fetchData()
  }

  async function generateBatch() {
    const count = parseInt(batchCount)
    if (!count || count < 1 || count > 200) return
    setBatchGenerating(true)

    const existing = partners.filter(p => p.qr_code.startsWith(batchPrefix + '-'))
    const maxNum = existing.reduce((max, p) => {
      const num = parseInt(p.qr_code.split('-')[1] || '0')
      return num > max ? num : max
    }, 0)

    const toInsert = Array.from({ length: count }, (_, i) => ({
      name: '',
      qr_code: `${batchPrefix}-${String(maxNum + i + 1).padStart(4, '0')}`,
      commission_percent: 10,
      client_discount_percent: 5,
      is_active: false,
      is_draft: true,
    }))

    const { data: inserted } = await supabase.from('partners').insert(toInsert).select()

    // Kreiraj početne QR kodove u partner_qr_codes za svaki batch partner
    if (inserted) {
      const qrInsert = inserted.map((p: any) => ({
        partner_id: p.id,
        qr_code: p.qr_code,
        label: 'Glavni kod',
      }))
      await supabase.from('partner_qr_codes').insert(qrInsert)
    }

    setBatchGenerating(false)
    setShowBatchForm(false)
    fetchData()
  }

  async function sendPayout() {
    if (!selectedPartner || !payoutAmount) return
    setPayoutSaving(true)
    await supabase.from('partner_payouts').insert({
      partner_id: selectedPartner.id,
      amount: parseFloat(payoutAmount),
      note: payoutNote,
      status: 'pending',
    })
    if (selectedPartner.portal_email || selectedPartner.email) {
      await fetch('/api/partner-payout-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partnerName: selectedPartner.name,
          partnerEmail: selectedPartner.portal_email || selectedPartner.email,
          amount: parseFloat(payoutAmount),
          note: payoutNote,
        }),
      }).catch(() => {})
    }
    setPayoutAmount(''); setPayoutNote('')
    setPayoutSaving(false)
    fetchPayouts(selectedPartner.id)
    fetchData()
  }

async function deletePartner(p: Partner) {
    const label = p.is_draft ? `blanko kod ${p.qr_code}` : `partnera "${p.name}"`
    const msg = p.reservation_count && p.reservation_count > 0
      ? `Partner "${p.name}" ima ${p.reservation_count} rezervacija. Brisanjem se uklanja samo partner, rezervacije ostaju. Nastavi?`
      : `Da li sigurno želiš obrisati ${label}?`
    if (!window.confirm(msg)) return
    await fetch('/api/partner-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ partnerId: p.id }),
    })
    setSelectedPartner(null)
    setShowQrPanel(null)
    setShowForm(false)
    fetchData()
  }

  function downloadQR(qr_code: string, name: string) {
    const url = `${siteUrl}/?ref=${qr_code}`
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}&format=png`
    const a = document.createElement('a')
    a.href = qrUrl
    a.download = `QR-${qr_code}.png`
    a.target = '_blank'
    a.click()
  }

  function printQR(qr_code: string, name: string, label?: string) {
    const url = `${siteUrl}/?ref=${qr_code}`
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(url)}&format=png`
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`
      <html><head><title>QR - ${qr_code}</title>
      <style>body{font-family:Arial;text-align:center;padding:40px} .code{font-size:14px;color:#666;margin-top:10px} .name{font-size:20px;font-weight:bold;margin-top:8px} .label{font-size:14px;color:#1D9E75;margin-top:4px} .url{font-size:11px;color:#999;margin-top:6px}</style>
      </head><body>
      <img src="${qrUrl}" width="300" height="300" />
      <div class="code">${qr_code}</div>
      <div class="name">${name || 'AdriaDrive'}</div>
      ${label ? `<div class="label">${label}</div>` : ''}
      <div class="url">${url}</div>
      <script>window.onload=function(){window.print()}<\/script>
      </body></html>
    `)
  }

  function exportCSV() {
    const rows = [['Partner', 'QR', 'Rezerv.', 'Promet', 'Provizija', 'Isplaćeno', 'Preostalo', 'Status'],
      ...partners.map(p => [p.name || '(Draft)', p.qr_code, p.reservation_count, `${p.total_revenue?.toFixed(2)}EUR`, `${p.commission_earned?.toFixed(2)}EUR`, `${p.commission_paid?.toFixed(2)}EUR`, `${p.commission_remaining?.toFixed(2)}EUR`, p.is_draft ? 'Draft' : p.is_active ? 'Aktivan' : 'Neaktivan'])]
    const csv = rows.map(r => r.join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `partneri_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  const inp = { width: '100%', padding: '8px 12px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', color: '#111' }
  const lbl = { fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }

  const filtered = partners.filter(p => {
    if (filterMode === 'active') return !p.is_draft && p.is_active
    if (filterMode === 'draft') return p.is_draft
    return true
  })

  const draftCount = partners.filter(p => p.is_draft).length
  const activeCount = partners.filter(p => !p.is_draft && p.is_active).length
  const sideOpen = showForm || showBatchForm || !!selectedPartner || !!showQrPanel

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: '#111' }}>Partneri</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={exportCSV} style={{ padding: '8px 14px', border: '1px solid #d1d5db', borderRadius: 8, background: 'transparent', fontSize: 13, cursor: 'pointer', color: '#374151' }}>Izvoz CSV</button>
          <button onClick={() => { setShowBatchForm(!showBatchForm); setShowForm(false); setSelectedPartner(null); setShowQrPanel(null) }} style={{ padding: '8px 14px', border: '1px solid #185FA5', borderRadius: 8, background: '#E6F1FB', fontSize: 13, cursor: 'pointer', color: '#185FA5', fontWeight: 600 }}>
            Generiši QR batch
          </button>
          <button onClick={() => { setEditPartner(null); setForm({ ...emptyForm, qr_code: `${batchPrefix}-${String(Date.now()).slice(-4)}` }); setShowForm(true); setShowBatchForm(false); setSelectedPartner(null); setShowQrPanel(null) }} style={{ padding: '8px 14px', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            + Dodaj partnera
          </button>
        </div>
      </div>

      {/* Filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[['all', `Svi (${partners.length})`], ['active', `Aktivni (${activeCount})`], ['draft', `Draft / Blanko (${draftCount})`]].map(([val, label]) => (
          <button key={val} onClick={() => setFilterMode(val as any)} style={{ padding: '6px 14px', fontSize: 12, borderRadius: 20, border: '1px solid', borderColor: filterMode === val ? '#1D9E75' : '#e5e7eb', background: filterMode === val ? '#E1F5EE' : '#fff', color: filterMode === val ? '#085041' : '#6b7280', cursor: 'pointer', fontWeight: filterMode === val ? 600 : 400 }}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: sideOpen ? '1fr 360px' : '1fr', gap: 16 }}>
        {/* Tabela */}
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
          {loading ? <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Učitavanje...</div> : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {['Partner', 'QR kodovi', 'Popust', 'Rezerv.', 'Provizija', 'Preostalo', 'Status', ''].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 500, fontSize: 12, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid #f3f4f6', background: (selectedPartner?.id === p.id || showQrPanel?.id === p.id) ? '#f0fdf8' : p.is_draft ? '#fefce8' : 'transparent' }}>
                    <td style={{ padding: '12px 14px' }}>
                      {p.is_draft ? (
                        <div style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic' }}>Blanko QR kod</div>
                      ) : (
                        <>
                          <div style={{ fontWeight: 500, color: '#111' }}>{p.name}</div>
                          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{p.contact_name}{p.phone && ` · ${p.phone}`}</div>
                          {p.portal_email && <div style={{ fontSize: 11, color: '#1D9E75', marginTop: 1 }}>{p.portal_email}</div>}
                        </>
                      )}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <a href={`${siteUrl}/?ref=${p.qr_code}`} target="_blank" rel="noreferrer" style={{ fontSize: 12, fontFamily: 'monospace', color: '#854F0B', background: '#FAEEDA', padding: '3px 8px', borderRadius: 20, textDecoration: 'none' }}>{p.qr_code}</a>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ fontSize: 12, background: '#E1F5EE', color: '#085041', padding: '3px 8px', borderRadius: 20 }}>{p.client_discount_percent || 0}%</span>
                    </td>
                    <td style={{ padding: '12px 14px', color: '#374151' }}>{p.reservation_count}</td>
                    <td style={{ padding: '12px 14px', fontWeight: 600, color: '#1D9E75' }}>{p.commission_earned?.toFixed(2)}€</td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ fontWeight: 600, color: (p.commission_remaining || 0) > 0 ? '#BA7517' : '#9ca3af' }}>
                        {p.commission_remaining?.toFixed(2)}€
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      {p.is_draft
                        ? <span style={{ fontSize: 11, background: '#fef9c3', color: '#854d0e', padding: '3px 8px', borderRadius: 20, fontWeight: 500 }}>Blanko</span>
                        : <span style={{ fontSize: 11, background: p.is_active ? '#E1F5EE' : '#f3f4f6', color: p.is_active ? '#085041' : '#9ca3af', padding: '3px 8px', borderRadius: 20, fontWeight: 500 }}>{p.is_active ? 'Aktivan' : 'Neaktivan'}</span>
                      }
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => openEdit(p)} style={{ padding: '4px 8px', fontSize: 11, border: '1px solid #d1d5db', borderRadius: 6, background: 'transparent', cursor: 'pointer', color: '#6b7280' }}>
                          {p.is_draft ? 'Aktiviraj' : 'Uredi'}
                        </button>
                        {!p.is_draft && (
                          <button onClick={() => openQrPanel(p)} style={{ padding: '4px 8px', fontSize: 11, border: '1px solid #EF9F27', borderRadius: 6, background: showQrPanel?.id === p.id ? '#FAEEDA' : 'transparent', cursor: 'pointer', color: '#854F0B', fontWeight: showQrPanel?.id === p.id ? 600 : 400 }}>
                            QR kodovi
                          </button>
                        )}
                        {p.is_draft && (
                          <button onClick={() => setShowQR({ qr_code: p.qr_code, name: p.name })} style={{ padding: '4px 8px', fontSize: 11, border: '1px solid #EF9F27', borderRadius: 6, background: '#FAEEDA', cursor: 'pointer', color: '#854F0B' }}>QR</button>
                        )}
                        {!p.is_draft && <button onClick={() => openPayouts(p)} style={{ padding: '4px 8px', fontSize: 11, border: '1px solid #5DCAA5', borderRadius: 6, background: 'transparent', cursor: 'pointer', color: '#0F6E56' }}>Isplata</button>}
                        <button onClick={() => deletePartner(p)} style={{ padding: '4px 8px', fontSize: 11, border: '1px solid #fecaca', borderRadius: 6, background: 'transparent', cursor: 'pointer', color: '#dc2626' }}>Obriši</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Batch forma */}
        {showBatchForm && (
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 20, background: '#fff', alignSelf: 'start' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#111' }}>Generiši QR batch</div>
              <button onClick={() => setShowBatchForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#9ca3af' }}>✕</button>
            </div>
            <div style={{ background: '#E6F1FB', border: '1px solid #85B7EB', borderRadius: 8, padding: '10px 12px', marginBottom: 16, fontSize: 12, color: '#0C447C' }}>
              Kreira blanko QR kodove koje možeš štampati i nositi na teren. Kada sklopiš ugovor sa partnerom, popuniš podatke.
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Prefiks koda</label>
              <input style={inp} value={batchPrefix} onChange={e => setBatchPrefix(e.target.value.toUpperCase())} placeholder="AP" />
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>Kodovi će biti: {batchPrefix}-0001, {batchPrefix}-0002...</div>
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={lbl}>Broj kodova</label>
              <input style={inp} type="number" min="1" max="200" value={batchCount} onChange={e => setBatchCount(e.target.value)} />
            </div>
            <button onClick={generateBatch} disabled={batchGenerating} style={{ width: '100%', padding: 10, background: batchGenerating ? '#5DCAA5' : '#185FA5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              {batchGenerating ? 'Generisanje...' : `Generiši ${batchCount} QR kodova`}
            </button>
          </div>
        )}

        {/* QR Kodovi panel */}
        {showQrPanel && !showForm && !selectedPartner && (
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 20, background: '#fff', alignSelf: 'start' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#111' }}>QR kodovi — {showQrPanel.name}</div>
              <button onClick={() => setShowQrPanel(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#9ca3af' }}>✕</button>
            </div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 16 }}>Svaki kod možeš koristiti za različiti kanal (soba, poruka, flajer...)</div>

            {/* Lista kodova */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {partnerQrCodes.map(c => (
                <div key={c.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    {editingLabel?.id === c.id ? (
                      <div style={{ display: 'flex', gap: 6, flex: 1, marginRight: 8 }}>
                        <input
                          style={{ ...inp, padding: '4px 8px', fontSize: 12 }}
                          value={editingLabel.label}
                          onChange={e => setEditingLabel({ id: c.id, label: e.target.value })}
                          onKeyDown={e => { if (e.key === 'Enter') updateQrLabel(c.id, editingLabel.label); if (e.key === 'Escape') setEditingLabel(null) }}
                          autoFocus
                        />
                        <button onClick={() => updateQrLabel(c.id, editingLabel.label)} style={{ padding: '4px 8px', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>✓</button>
                        <button onClick={() => setEditingLabel(null)} style={{ padding: '4px 8px', background: 'transparent', color: '#9ca3af', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>✕</button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 500, color: '#111' }}>{c.label}</span>
                        <button onClick={() => setEditingLabel({ id: c.id, label: c.label })} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#9ca3af', padding: 0 }}>✏️</button>
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => setShowQR({ qr_code: c.qr_code, name: showQrPanel.name, label: c.label })} style={{ padding: '3px 8px', fontSize: 11, border: '1px solid #EF9F27', borderRadius: 6, background: '#FAEEDA', cursor: 'pointer', color: '#854F0B' }}>QR</button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#854F0B', background: '#FAEEDA', padding: '2px 7px', borderRadius: 12 }}>{c.qr_code}</span>
                    <span style={{ fontSize: 11, color: '#9ca3af' }}>{c.scan_count} skeniranja</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Dodaj novi kod */}
            <div style={{ background: '#f9fafb', borderRadius: 8, padding: 14, border: '1px dashed #d1d5db' }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 10 }}>+ Novi QR kod</div>
              <div style={{ marginBottom: 10 }}>
                <label style={lbl}>Naziv / namjena koda</label>
                <input
                  style={inp}
                  value={newQrLabel}
                  onChange={e => setNewQrLabel(e.target.value)}
                  placeholder="npr. Soba 1, Poruka gostima, Recepcija..."
                  onKeyDown={e => { if (e.key === 'Enter') addQrCode() }}
                />
              </div>
              <button
                onClick={addQrCode}
                disabled={addingQr || !newQrLabel.trim()}
                style={{ width: '100%', padding: '9px', background: !newQrLabel.trim() ? '#9ca3af' : addingQr ? '#5DCAA5' : '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: !newQrLabel.trim() ? 'not-allowed' : 'pointer' }}
              >
                {addingQr ? 'Kreiranje...' : 'Kreiraj QR kod'}
              </button>
            </div>
          </div>
        )}

        {/* Edit forma */}
        {showForm && (
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 20, background: '#fff', alignSelf: 'start' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#111' }}>{editPartner?.is_draft ? 'Aktiviraj partnera' : editPartner ? 'Uredi partnera' : 'Novi partner'}</div>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#9ca3af' }}>✕</button>
            </div>
            {editPartner?.is_draft && (
              <div style={{ background: '#fef9c3', border: '1px solid #fbbf24', borderRadius: 8, padding: '10px 12px', marginBottom: 14, fontSize: 12, color: '#713f12' }}>
                QR kod: <strong>{editPartner.qr_code}</strong> — popuni podatke da aktiviraš ovaj kod.
              </div>
            )}
            {[{ label: 'Naziv *', key: 'name', ph: 'Vila Jadran' }, { label: 'Kontakt osoba', key: 'contact_name', ph: 'Marko Petrović' }, { label: 'Email', key: 'email', ph: 'vlasnik@email.com' }, { label: 'Portal email (Google login)', key: 'portal_email', ph: 'marko@gmail.com' }, { label: 'Telefon', key: 'phone', ph: '+382 67 111 222' }, { label: 'QR kod *', key: 'qr_code', ph: 'AP-0001' }].map(f => (
              <div key={f.key} style={{ marginBottom: 12 }}>
                <label style={lbl}>{f.label}</label>
                <input style={inp} value={(form as any)[f.key]} onChange={e => setForm(fm => ({ ...fm, [f.key]: e.target.value }))} placeholder={f.ph} />
              </div>
            ))}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div>
                <label style={lbl}>Grad</label>
                <input style={inp} value={(form as any).city || ''} onChange={e => setForm(fm => ({ ...fm, city: e.target.value }))} placeholder="Budva" />
              </div>
              <div>
                <label style={lbl}>Država</label>
                <input style={inp} value={(form as any).country || ''} onChange={e => setForm(fm => ({ ...fm, country: e.target.value }))} placeholder="Crna Gora" />
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Google Maps link</label>
              <input style={inp} value={(form as any).google_maps_url || ''} onChange={e => setForm(fm => ({ ...fm, google_maps_url: e.target.value }))} placeholder="https://maps.google.com/..." />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Kanal akvizicije</label>
              <select style={inp} value={(form as any).acquisition_channel || 'direct'} onChange={e => setForm(fm => ({ ...fm, acquisition_channel: e.target.value }))}>
                <option value="direct">Direktno</option>
                <option value="agent">Interni agent</option>
                <option value="collaborator">Eksterni saradnik</option>
              </select>
            </div>
            {(form as any).acquisition_channel === 'agent' && (
              <div style={{ marginBottom: 12 }}>
                <label style={lbl}>Koji agent</label>
                <select style={inp} value={(form as any).acquired_by_agent || ''} onChange={e => setForm(fm => ({ ...fm, acquired_by_agent: e.target.value }))}>
                  <option value="">-- Odaberi agenta --</option>
                  {agentsList.map(a => <option key={a.id} value={a.full_name}>{a.full_name}</option>)}
                </select>
              </div>
            )}
            {(form as any).acquisition_channel === 'collaborator' && (
              <div style={{ marginBottom: 12 }}>
                <label style={lbl}>Koji saradnik</label>
                <select style={inp} value={(form as any).acquired_by_collaborator_id || ''} onChange={e => setForm(fm => ({ ...fm, acquired_by_collaborator_id: e.target.value }))}>
                  <option value="">-- Odaberi saradnika --</option>
                  {collaboratorsList.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                </select>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
              <div>
                <label style={lbl}>Provizija (%)</label>
                <input style={inp} type="number" min="0" max="100" step="0.5" value={form.commission_percent} onChange={e => setForm(fm => ({ ...fm, commission_percent: e.target.value }))} />
              </div>
              <div>
                <label style={lbl}>Popust klijentu (%)</label>
                <input style={inp} type="number" min="0" max="100" step="0.5" value={form.client_discount_percent} onChange={e => setForm(fm => ({ ...fm, client_discount_percent: e.target.value }))} />
              </div>
            </div>
            <button onClick={savePartner} disabled={saving || !form.name} style={{ width: '100%', padding: 10, background: !form.name ? '#9ca3af' : saving ? '#5DCAA5' : '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: !form.name ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Snimanje...' : editPartner?.is_draft ? 'Aktiviraj partnera' : editPartner ? 'Sačuvaj' : 'Dodaj partnera'}
            </button>
          </div>
        )}

        {/* Isplate panel */}
        {selectedPartner && !showForm && !showQrPanel && (
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 20, background: '#fff', alignSelf: 'start' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#111' }}>Isplate — {selectedPartner.name}</div>
              <button onClick={() => setSelectedPartner(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#9ca3af' }}>✕</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16, marginTop: 12 }}>
              <div style={{ background: '#f9fafb', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ fontSize: 11, color: '#9ca3af' }}>Ukupno zarađeno</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#1D9E75' }}>{selectedPartner.commission_earned?.toFixed(2)}€</div>
              </div>
              <div style={{ background: (selectedPartner.commission_remaining || 0) > 0 ? '#FAEEDA' : '#f9fafb', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ fontSize: 11, color: '#9ca3af' }}>Dug prema partneru</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: (selectedPartner.commission_remaining || 0) > 0 ? '#BA7517' : '#374151' }}>{selectedPartner.commission_remaining?.toFixed(2)}€</div>
              </div>
            </div>
            <div style={{ background: '#f9fafb', borderRadius: 8, padding: 14, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#111', marginBottom: 10 }}>Nova isplata</div>
              <div style={{ marginBottom: 8 }}>
                <label style={lbl}>Iznos (€)</label>
                <input style={inp} type="number" step="0.01" value={payoutAmount} onChange={e => setPayoutAmount(e.target.value)} placeholder={selectedPartner.commission_remaining?.toFixed(2)} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={lbl}>Napomena</label>
                <input style={inp} value={payoutNote} onChange={e => setPayoutNote(e.target.value)} placeholder="Isplata za april..." />
              </div>
              <button onClick={sendPayout} disabled={payoutSaving || !payoutAmount} style={{ width: '100%', padding: '9px', background: !payoutAmount ? '#9ca3af' : '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                {payoutSaving ? 'Slanje...' : 'Pošalji zahtjev za isplatu'}
              </button>
            </div>
            {payouts.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {payouts.map(p => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#f9fafb', borderRadius: 8, fontSize: 13 }}>
                    <div>
                      <span style={{ fontWeight: 600, color: '#1D9E75' }}>{p.amount.toFixed(2)}€</span>
                      {p.note && <span style={{ color: '#9ca3af', marginLeft: 8, fontSize: 12 }}>{p.note}</span>}
                    </div>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 500, background: p.status === 'confirmed' ? '#E1F5EE' : '#FAEEDA', color: p.status === 'confirmed' ? '#085041' : '#633806' }}>
                      {p.status === 'confirmed' ? 'Potvrđeno' : 'Čeka'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* QR Modal */}
      {showQR && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: '28px 24px', maxWidth: 380, width: '90%', textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#111', marginBottom: 4 }}>
              QR kod — {showQR.qr_code}
            </div>
            {showQR.label && <div style={{ fontSize: 12, color: '#1D9E75', fontWeight: 500, marginBottom: 4 }}>{showQR.label}</div>}
            {showQR.name && <div style={{ fontSize: 13, color: '#374151', marginBottom: 12 }}>{showQR.name}</div>}
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(`${siteUrl}/?ref=${showQR.qr_code}`)}&format=png`}
              alt="QR kod"
              style={{ width: 240, height: 240, margin: '0 auto 16px', display: 'block' }}
            />
            <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 20, wordBreak: 'break-all' }}>
              {siteUrl}/?ref={showQR.qr_code}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => downloadQR(showQR.qr_code, showQR.name)} style={{ flex: 1, padding: '9px', border: '1px solid #1D9E75', borderRadius: 8, background: '#E1F5EE', fontSize: 13, cursor: 'pointer', color: '#085041', fontWeight: 500 }}>
                Preuzmi PNG
              </button>
              <button onClick={() => printQR(showQR.qr_code, showQR.name, showQR.label)} style={{ flex: 1, padding: '9px', border: '1px solid #185FA5', borderRadius: 8, background: '#E6F1FB', fontSize: 13, cursor: 'pointer', color: '#185FA5', fontWeight: 500 }}>
                Štampaj
              </button>
              <button onClick={() => setShowQR(null)} style={{ padding: '9px 14px', border: '1px solid #e5e7eb', borderRadius: 8, background: 'transparent', fontSize: 13, cursor: 'pointer', color: '#6b7280' }}>
                Zatvori
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
