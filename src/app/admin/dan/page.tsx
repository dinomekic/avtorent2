'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Reservation = {
  id: string; ref_code: string; guest_name: string; guest_phone: string
  pickup_date: string; return_date: string; pickup_time: string; return_time: string
  pickup_location: string; total_price: number; final_total: number | null
  status: string; payment_status: string; agent_name: string | null
  amount_paid: number; amount_debt: number; amount_prepaid: number
  surcharges_total: number; payment_method: string | null
  cash_amount: number; card_amount: number; wire_amount: number
  issued_at: string | null; issued_by: string | null
  closed_at: string | null; closed_by: string | null
  is_early_return: boolean; original_return_date: string | null
  early_return_note: string | null
  vehicles: { name: string; category: string } | null
}

type SurchargeType = { id: string; name: string; is_active: boolean; sort_order: number }
type PaymentInput = { method: 'cash' | 'card' | 'wire' | 'split'; cashAmount: string; cardAmount: string; wireAmount: string }

const PM_LABELS: Record<string, string> = { cash: 'Keš', card: 'Kartica', wire: 'Virmanski', split: 'Podijeljeno' }

const STATUS_COLORS: Record<string, { bg: string; color: string; label: string }> = {
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

function PaymentMethodSelector({ total, value, onChange }: { total: number; value: PaymentInput; onChange: (v: PaymentInput) => void }) {
  const splitTotal = parseFloat(value.cashAmount || '0') + parseFloat(value.cardAmount || '0') + parseFloat(value.wireAmount || '0')
  const remaining = total - splitTotal
  return (
    <div>
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>Način plaćanja</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 10 }}>
        {(['cash', 'card', 'wire', 'split'] as const).map(m => (
          <button key={m} onClick={() => onChange({ ...value, method: m })}
            style={{ padding: '7px 4px', border: `1px solid ${value.method === m ? '#1D9E75' : '#e5e7eb'}`, borderRadius: 8, background: value.method === m ? '#E1F5EE' : '#fff', color: value.method === m ? '#085041' : '#6b7280', cursor: 'pointer', fontSize: 12, fontWeight: value.method === m ? 600 : 400 }}>
            {PM_LABELS[m]}
          </button>
        ))}
      </div>
      {value.method === 'split' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[['cash', 'Keš', value.cashAmount], ['card', 'Kartica', value.cardAmount], ['wire', 'Virmanski', value.wireAmount]].map(([key, label, val]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: '#6b7280', width: 70 }}>{label}</span>
              <input type="number" step="0.01" placeholder="0" value={val}
                onChange={e => onChange({ ...value, [`${key}Amount`]: e.target.value } as PaymentInput)}
                style={{ flex: 1, padding: '6px 10px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, color: '#111' }} />
              <span style={{ fontSize: 12, color: '#9ca3af' }}>€</span>
            </div>
          ))}
          <div style={{ padding: '7px 12px', borderRadius: 8, background: Math.abs(remaining) < 0.01 ? '#E1F5EE' : '#FAEEDA', fontSize: 12, color: Math.abs(remaining) < 0.01 ? '#085041' : '#633806' }}>
            {Math.abs(remaining) < 0.01 ? 'Iznosi se poklapaju' : `Preostalo: ${remaining.toFixed(2)}€`}
          </div>
        </div>
      )}
    </div>
  )
}

function getPaymentAmounts(payment: PaymentInput, total: number) {
  if (payment.method === 'cash') return { cash: total, card: 0, wire: 0 }
  if (payment.method === 'card') return { cash: 0, card: total, wire: 0 }
  if (payment.method === 'wire') return { cash: 0, card: 0, wire: total }
  return { cash: parseFloat(payment.cashAmount || '0'), card: parseFloat(payment.cardAmount || '0'), wire: parseFloat(payment.wireAmount || '0') }
}

export default function AdminDanPage() {
  const today = new Date().toISOString().split('T')[0]
  const [selectedDate, setSelectedDate] = useState(today)
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [surchargeTypes, setSurchargeTypes] = useState<SurchargeType[]>([])
  const [extras, setExtras] = useState<{id: string; name: string; price: number}[]>([])
  const [loading, setLoading] = useState(true)
  const [agentName] = useState(() => getCookie('avtorent-agent-name'))

  const [modal, setModal] = useState<'issue' | 'close' | 'charge' | null>(null)
  const [selected, setSelected] = useState<Reservation | null>(null)
  const [selectedCharges, setSelectedCharges] = useState<any[]>([])

  const [issueMode, setIssueMode] = useState<'quick' | 'full'>('quick')
  const [issuePaymentMode, setIssuePaymentMode] = useState<'full' | 'other'>('full')
  const [issueAmount, setIssueAmount] = useState('')
  const [issuePayment, setIssuePayment] = useState<PaymentInput>({ method: 'cash', cashAmount: '', cardAmount: '', wireAmount: '' })
  const [issueSaving, setIssueSaving] = useState(false)

  const [closeMode, setCloseMode] = useState<'quick' | 'full'>('quick')
  const [debtCollected, setDebtCollected] = useState<boolean | null>(null)
  const [debtPayment, setDebtPayment] = useState<PaymentInput>({ method: 'cash', cashAmount: '', cardAmount: '', wireAmount: '' })
  const [prepaidReturned, setPrepaidReturned] = useState<boolean | null>(null)
  const [hasSurcharges, setHasSurcharges] = useState<boolean | null>(null)
  const [surchargeAmounts, setSurchargeAmounts] = useState<Record<string, string>>({})
  const [surchargePayments, setSurchargePayments] = useState<Record<string, PaymentInput>>({})
  const [customSurcharge, setCustomSurcharge] = useState('')
  const [customSurchargeAmount, setCustomSurchargeAmount] = useState('')
  const [earlyReturnNote, setEarlyReturnNote] = useState('')
  const [closeSaving, setCloseSaving] = useState(false)

  const [chargeType, setChargeType] = useState<'extra' | 'surcharge' | 'custom'>('surcharge')
  const [chargeItemId, setChargeItemId] = useState('')
  const [chargeItemName, setChargeItemName] = useState('')
  const [chargeAmount, setChargeAmount] = useState('')
  const [chargePayment, setChargePayment] = useState<PaymentInput>({ method: 'cash', cashAmount: '', cardAmount: '', wireAmount: '' })
  const [chargeComment, setChargeComment] = useState('')
  const [chargeSaving, setChargeSaving] = useState(false)

  const [showWashModal, setShowWashModal] = useState(false)
  const [washReservation, setWashReservation] = useState<Reservation | null>(null)
  const [washType, setWashType] = useState('')
  const [washAssignedTo, setWashAssignedTo] = useState<'partner' | 'agent'>('partner')
  const [washCustomPrice, setWashCustomPrice] = useState('')
  const [washNotes, setWashNotes] = useState('')
  const [washSaving, setWashSaving] = useState(false)
  const [washPartnerId, setWashPartnerId] = useState<string | null>(null)

  const WASH_TYPES = [
    { key: 'quick', label: 'Brzo pranje', price: 5 },
    { key: 'detailed', label: 'Detaljno pranje', price: 10 },
    { key: 'deep_quick', label: 'Dubinsko brzo', price: 40 },
    { key: 'deep_detailed', label: 'Dubinsko detaljno', price: 80 },
    { key: 'specific', label: 'Specifično pranje', price: 0 },
  ]

  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const [newResAlert, setNewResAlert] = useState<string | null>(null)
  const [showDone, setShowDone] = useState(false)
  const [cancelModal, setCancelModal] = useState<string | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelSaving, setCancelSaving] = useState(false)
  const [locations, setLocations] = useState<{id: string; name: string}[]>([])
  const [selectedLocations, setSelectedLocations] = useState<string[]>([])
  const [showLocationFilter, setShowLocationFilter] = useState(false)
  const [vehiclesByLocation, setVehiclesByLocation] = useState<Record<string, string[]>>({})
  const [reservationExtras, setReservationExtras] = useState<Record<string, {name: string; days: number; total_price: number}[]>>({})
  const [overdueReservations, setOverdueReservations] = useState<Reservation[]>([])

  const fetchData = useCallback(async () => {
    setLoading(true)
    supabase.from('wash_partners').select('id').eq('is_active', true).single().then(({ data: wp }) => {
      if (wp) setWashPartnerId(wp.id)
    })
    const [{ data }, { data: st }, { data: ex }] = await Promise.all([
      supabase.from('reservations').select('*, vehicles(name, category)').neq('status', 'cancelled')
        .or(`pickup_date.eq.${selectedDate},return_date.eq.${selectedDate},and(pickup_date.lt.${selectedDate},return_date.gt.${selectedDate})`)
        .order('pickup_time', { ascending: true }),
      supabase.from('surcharge_types').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('extras').select('id, name, price').eq('is_active', true),
    ])
    const resData = data || []
    setReservations(resData)
    setSurchargeTypes(st || [])
    setExtras(ex || [])

    // Fetch extras for all reservations
    if (resData.length > 0) {
      const ids = resData.map((r: any) => r.id)
      const { data: extrasData } = await supabase
        .from('reservation_extras')
        .select('reservation_id, extra_name, days, total_price')
        .in('reservation_id', ids)
      if (extrasData) {
        const grouped: Record<string, any[]> = {}
        extrasData.forEach((e: any) => {
          if (!grouped[e.reservation_id]) grouped[e.reservation_id] = []
          grouped[e.reservation_id].push({ name: e.extra_name, days: e.days, total_price: e.total_price })
        })
        setReservationExtras(grouped)
      }
    }
    const { data: overdue } = await supabase
      .from('reservations')
      .select('*, vehicles(name, category)')
      .neq('status', 'cancelled')
      .neq('status', 'closed')
      .or(`and(status.eq.confirmed,pickup_date.lt.${selectedDate}),and(status.eq.issued,return_date.lt.${selectedDate})`)
      .order('pickup_date', { ascending: false })
    setOverdueReservations(overdue || [])

    setLoading(false)
  }, [selectedDate])

  useEffect(() => {
    fetchData()

    const channel = supabase
      .channel('dan-reservations')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'reservations',
      }, (payload) => {
        const r = payload.new as any
        const isForToday = r.pickup_date === selectedDate || r.return_date === selectedDate
        if (isForToday) {
          setNewResAlert(`Nova rezervacija: ${r.guest_name} — ${r.pickup_date}`)
          setTimeout(() => setNewResAlert(null), 8000)
        }
        if (!modal) fetchData()
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'reservations',
      }, () => {
        if (!modal) fetchData()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchData, selectedDate, modal])

  function hasDebtOrPrepaid(r: Reservation) {
    return r.payment_status === 'debt' || r.payment_status === 'prepaid'
  }

  function openIssue(r: Reservation) {
    setSelected(r); setIssueMode('quick'); setIssuePaymentMode('full')
    setIssueAmount(String(r.total_price))
    setIssuePayment({ method: 'cash', cashAmount: '', cardAmount: '', wireAmount: '' })
    setModal('issue')
  }

  function openClose(r: Reservation) {
    setSelected(r); setCloseMode('quick')
    setDebtCollected(null); setPrepaidReturned(null)
    setDebtPayment({ method: 'cash', cashAmount: '', cardAmount: '', wireAmount: '' })
    setHasSurcharges(null); setSurchargeAmounts({}); setSurchargePayments({})
    setCustomSurcharge(''); setCustomSurchargeAmount(''); setEarlyReturnNote('')
    setModal('close')
  }

  function openCharge(r: Reservation) {
    setSelected(r)
    supabase.from('reservation_charges').select('*').eq('reservation_id', r.id).order('created_at', { ascending: false }).then(({ data }) => setSelectedCharges(data || []))
    setChargeType('surcharge'); setChargeItemId(''); setChargeItemName(''); setChargeAmount(''); setChargeComment('')
    setChargePayment({ method: 'cash', cashAmount: '', cardAmount: '', wireAmount: '' })
    setModal('charge')
  }

  async function handleWashOrder(skip: boolean) {
    setShowWashModal(false)
    if (skip || !washReservation || !washType) return
    setWashSaving(true)
    const wt = WASH_TYPES.find(w => w.key === washType)
    const price = washType === 'specific' ? parseFloat(washCustomPrice || '0') : (wt?.price || 0)
    await supabase.from('wash_orders').insert({
      reservation_id: washReservation.id,
      vehicle_name: washReservation.vehicles?.name || 'Nepoznato',
      wash_type: washType, wash_type_label: wt?.label || washType,
      price, status: 'pending', assigned_to: washAssignedTo,
      agent_name: washAssignedTo === 'agent' ? (agentName || 'Agent') : null,
      wash_partner_id: washAssignedTo === 'partner' ? washPartnerId : null,
      notes: washNotes || null,
      payout_status: washAssignedTo === 'partner' ? 'unpaid' : null,
      payout_amount: washAssignedTo === 'partner' ? price : null,
    })
    setWashSaving(false)
    setWashReservation(null); setWashType(''); setWashCustomPrice(''); setWashNotes('')
  }

  function triggerWash(r: Reservation) {
    setWashReservation(r); setWashType(''); setWashAssignedTo('partner')
    setWashCustomPrice(''); setWashNotes(''); setShowWashModal(true)
  }

  async function handleCancel() {
    if (!cancelModal || !cancelReason.trim()) return
    setCancelSaving(true)
    await supabase.from('reservations').update({
      status: 'cancelled',
      closed_by: agentName || 'Agent',
      closed_at: new Date().toISOString(),
      notes: cancelReason.trim(),
    }).eq('id', cancelModal)
    setCancelSaving(false)
    setCancelModal(null)
    setCancelReason('')
    fetchData()
  }

  async function handleQuickIssue() {
    if (!selected) return
    setIssueSaving(true)
    const amounts = getPaymentAmounts(issuePayment, selected.total_price)
    await supabase.from('reservations').update({
      status: 'issued', payment_status: 'paid', amount_paid: selected.total_price,
      payment_method: issuePayment.method, cash_amount: amounts.cash, card_amount: amounts.card, wire_amount: amounts.wire,
      issued_at: new Date().toISOString(), issued_by: agentName || 'Agent',
    }).eq('id', selected.id)
    await supabase.from('agent_collections').insert({
      reservation_id: selected.id, agent_name: agentName || 'Agent',
      amount: selected.total_price, collection_type: 'rental',
      payment_method: issuePayment.method, cash_amount: amounts.cash, card_amount: amounts.card, wire_amount: amounts.wire,
      note: `Brzo izdavanje. Ref: ${selected.ref_code}`,
    })
    setIssueSaving(false); setModal(null); fetchData()
  }

  async function handleFullIssue() {
    if (!selected) return
    setIssueSaving(true)
    const paid = issuePaymentMode === 'full' ? selected.total_price : parseFloat(issueAmount || '0')
    const diff = paid - selected.total_price
    const paymentStatus = Math.abs(diff) < 0.01 ? 'paid' : diff < 0 ? 'debt' : 'prepaid'
    const amounts = getPaymentAmounts(issuePayment, paid)
    await supabase.from('reservations').update({
      status: 'issued', payment_status: paymentStatus,
      amount_paid: paid, amount_debt: diff < 0 ? Math.abs(diff) : 0, amount_prepaid: diff > 0 ? diff : 0,
      payment_method: issuePayment.method, cash_amount: amounts.cash, card_amount: amounts.card, wire_amount: amounts.wire,
      issued_at: new Date().toISOString(), issued_by: agentName || 'Agent',
    }).eq('id', selected.id)
    await supabase.from('agent_collections').insert({
      reservation_id: selected.id, agent_name: agentName || 'Agent',
      amount: paid, collection_type: 'rental',
      payment_method: issuePayment.method, cash_amount: amounts.cash, card_amount: amounts.card, wire_amount: amounts.wire,
      note: `Ref: ${selected.ref_code}`,
    })
    setIssueSaving(false); setModal(null); fetchData()
  }

  async function handleQuickClose() {
    if (!selected) return
    setCloseSaving(true)
    const now = new Date()
    const updateData: any = {
      status: 'closed', final_total: selected.total_price,
      closed_at: now.toISOString(), closed_by: agentName || 'Agent',
    }
    if (selected.return_date > selectedDate) {
      updateData.is_early_return = true; updateData.early_return_at = now.toISOString()
      updateData.early_return_note = earlyReturnNote || 'Brzo preuzimanje'
      updateData.original_return_date = selected.return_date; updateData.return_date = selectedDate
    }
    const r = selected
    await supabase.from('reservations').update(updateData).eq('id', selected.id)
    setCloseSaving(false); setModal(null)
    triggerWash(r)
    fetchData()
  }

  async function handleFullClose() {
    if (!selected) return
    setCloseSaving(true)
    const surcharges = surchargeTypes
      .filter(st => surchargeAmounts[st.id] && parseFloat(surchargeAmounts[st.id]) > 0)
      .map(st => ({ reservation_id: selected.id, name: st.name, amount: parseFloat(surchargeAmounts[st.id]) }))
    if (customSurcharge && customSurchargeAmount && parseFloat(customSurchargeAmount) > 0)
      surcharges.push({ reservation_id: selected.id, name: customSurcharge, amount: parseFloat(customSurchargeAmount) })
    const surchargesTotal = surcharges.reduce((s, c) => s + c.amount, 0)
    if (surcharges.length > 0) {
      await supabase.from('reservation_surcharges').insert(surcharges)
      for (const s of surcharges) {
        const sp = surchargePayments[s.name] || { method: 'cash', cashAmount: '', cardAmount: '', wireAmount: '' }
        const amounts = getPaymentAmounts(sp, s.amount)
        await supabase.from('agent_collections').insert({
          reservation_id: selected.id, agent_name: agentName || 'Agent',
          amount: s.amount, collection_type: 'surcharge',
          payment_method: sp.method, cash_amount: amounts.cash, card_amount: amounts.card, wire_amount: amounts.wire, note: s.name,
        })
      }
    }
    if (selected.payment_status === 'debt' && debtCollected) {
      const amounts = getPaymentAmounts(debtPayment, selected.amount_debt)
      await supabase.from('agent_collections').insert({
        reservation_id: selected.id, agent_name: agentName || 'Agent',
        amount: selected.amount_debt, collection_type: 'debt_collected',
        payment_method: debtPayment.method, cash_amount: amounts.cash, card_amount: amounts.card, wire_amount: amounts.wire,
        note: 'Naplata duga pri preuzimanju',
      })
    }
    if (selected.payment_status === 'prepaid' && prepaidReturned) {
      await supabase.from('agent_collections').insert({
        reservation_id: selected.id, agent_name: agentName || 'Agent',
        amount: -selected.amount_prepaid, collection_type: 'prepaid_returned',
        payment_method: 'cash', cash_amount: -selected.amount_prepaid, card_amount: 0, wire_amount: 0,
        note: 'Povrat pretplate klijentu',
      })
    }
    const finalTotal = (selected.final_total || selected.total_price) + surchargesTotal
    const now = new Date()
    const updateData: any = {
      status: 'closed', surcharges_total: surchargesTotal, final_total: finalTotal,
      closed_at: now.toISOString(), closed_by: agentName || 'Agent',
    }
    if (selected.return_date > selectedDate) {
      updateData.is_early_return = true; updateData.early_return_at = now.toISOString()
      updateData.early_return_note = earlyReturnNote || 'Vozilo vraćeno prije isteka'
      updateData.original_return_date = selected.return_date; updateData.original_return_time = selected.return_time
      updateData.return_date = selectedDate; updateData.return_time = now.toTimeString().slice(0, 5)
    }
    const r = selected
    await supabase.from('reservations').update(updateData).eq('id', selected.id)
    setCloseSaving(false); setModal(null)
    triggerWash(r)
    fetchData()
  }

  async function handleCharge() {
    if (!selected || !chargeAmount || parseFloat(chargeAmount) <= 0) return
    setChargeSaving(true)
    const amount = parseFloat(chargeAmount)
    const pm = chargePayment.method
    const cashAmt = pm === 'cash' ? amount : pm === 'split' ? parseFloat(chargePayment.cashAmount || '0') : 0
    const cardAmt = pm === 'card' ? amount : pm === 'split' ? parseFloat(chargePayment.cardAmount || '0') : 0
    const wireAmt = pm === 'wire' ? amount : pm === 'split' ? parseFloat(chargePayment.wireAmount || '0') : 0
    const { data: charge } = await supabase.from('reservation_charges').insert({
      reservation_id: selected.id, agent_name: agentName || 'Agent',
      charge_type: chargeType, item_id: chargeItemId || null, item_name: chargeItemName,
      amount, payment_method: pm, cash_amount: cashAmt, card_amount: cardAmt, wire_amount: wireAmt,
      comment: chargeComment || null,
    }).select().single()
    await supabase.from('agent_collections').insert({
      reservation_id: selected.id, agent_name: agentName || 'Agent',
      amount, collection_type: chargeType === 'extra' ? 'rental' : 'surcharge',
      payment_method: pm, cash_amount: cashAmt, card_amount: cardAmt, wire_amount: wireAmt,
      note: chargeItemName, charge_id: charge?.id || null,
    })
    setChargeSaving(false); setModal(null); fetchData()
  }

  const locationFilter = (r: Reservation) => {
    if (selectedLocations.length === 0) return true
    const vehicleName = r.vehicles?.name || ''
    return selectedLocations.some(locId => (vehiclesByLocation[locId] || []).includes(vehicleName))
  }

  const pickups = reservations.filter(r => r.pickup_date === selectedDate && locationFilter(r))
  const returns = reservations.filter(r => r.return_date === selectedDate && locationFilter(r))
  const pendingCount = pickups.filter(r => r.status !== 'issued' && r.status !== 'closed').length
    + returns.filter(r => r.status !== 'closed').length
  const totalCount = pickups.length + returns.length
  const doneCount = totalCount - pendingCount

  const isEarlyReturn = selected && selected.return_date > selectedDate && selected.status === 'issued'
  const surchargesSum = surchargeTypes.reduce((s, st) => s + (parseFloat(surchargeAmounts[st.id] || '0') || 0), 0) + (parseFloat(customSurchargeAmount || '0') || 0)
  const fullIssueAmount = issuePaymentMode === 'full' ? (selected?.total_price || 0) : parseFloat(issueAmount || '0')
  const issueDiff = selected ? fullIssueAmount - selected.total_price : 0

useEffect(() => {
    async function loadLocations() {
      const [locRes, vlRes, vRes] = await Promise.all([
        fetch('/api/locations').then(r => r.json()),
        supabase.from('vehicle_locations').select('vehicle_id, location_id'),
        supabase.from('vehicles').select('id, name'),
      ])
      const locs = locRes.locations || []
      setLocations(locs)
      const vehicles = vRes.data || []
      const vl = vlRes.data || []
      const map: Record<string, string[]> = {}
      vl.forEach((row: any) => {
        if (!map[row.location_id]) map[row.location_id] = []
        const vehicle = vehicles.find((v: any) => v.id === row.vehicle_id)
        if (vehicle?.name) map[row.location_id].push(vehicle.name)
      })
      setVehiclesByLocation(map)
      try {
        const saved = localStorage.getItem('avtorent-agent-locations')
        if (saved) setSelectedLocations(JSON.parse(saved))
      } catch {}
    }
    loadLocations()
  }, [])
function toggleLocation(id: string) {
    setSelectedLocations(prev => {
      const next = prev.includes(id) ? prev.filter(l => l !== id) : [...prev, id]
      localStorage.setItem('avtorent-agent-locations', JSON.stringify(next))
      return next
    })
  }
  function formatTime(t: string | null) { return t ? t.slice(0, 5) : '10:00' }
  function formatDate(d: string) { return new Date(d).toLocaleDateString('sr-RS', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) }
  function isToday() { return selectedDate === today }
  function isFuture() { return selectedDate > today }
  function prevDay() { const d = new Date(selectedDate); d.setDate(d.getDate() - 1); setSelectedDate(d.toISOString().split('T')[0]) }
  function nextDay() { const d = new Date(selectedDate); d.setDate(d.getDate() + 1); setSelectedDate(d.toISOString().split('T')[0]) }

  const ReservationCard = ({ r, type }: { r: Reservation; type: 'pickup' | 'return' }) => {
    const st = STATUS_COLORS[r.status] || STATUS_COLORS.pending
    const timeLabel = type === 'pickup' ? formatTime(r.pickup_time) : formatTime(r.return_time)
    return (
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 16px', background: '#fff', borderLeft: `3px solid ${type === 'pickup' ? '#1D9E75' : '#185FA5'}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15, color: '#111' }}>{r.guest_name}</div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{r.guest_phone}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ background: type === 'pickup' ? '#E1F5EE' : '#E6F1FB', color: type === 'pickup' ? '#085041' : '#0C447C', padding: '4px 10px', borderRadius: 20, fontSize: 13, fontWeight: 700 }}>
              {timeLabel}
            </div>
            <span style={{ fontSize: 11, background: st.bg, color: st.color, padding: '3px 8px', borderRadius: 20, fontWeight: 500 }}>{st.label}</span>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
          <div style={{ background: '#f9fafb', borderRadius: 6, padding: '8px 10px' }}>
            <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>Vozilo</div>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#111' }}>{r.vehicles?.name || '—'}</div>
          </div>
          <div style={{ background: '#f9fafb', borderRadius: 6, padding: '8px 10px' }}>
            <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>Lokacija</div>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#111' }}>{r.pickup_location}</div>
          </div>
        </div>
        {reservationExtras[r.id] && reservationExtras[r.id].length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
            {reservationExtras[r.id].map((e, i) => (
              <span key={i} style={{ fontSize: 11, background: '#E6F1FB', color: '#0C447C', padding: '2px 8px', borderRadius: 20, fontWeight: 500 }}>
                {e.name}{e.days > 1 ? ` ×${e.days}` : ''} · {e.total_price}€
              </span>
            ))}
          </div>
        )}
        {r.payment_status === 'debt' && (
          <div style={{ background: '#FCEBEB', borderRadius: 6, padding: '6px 10px', marginBottom: 8, fontSize: 12, fontWeight: 600, color: '#791F1F' }}>
            DUG: {r.amount_debt?.toFixed(2)}€
          </div>
        )}
        {r.payment_status === 'prepaid' && (
          <div style={{ background: '#E6F1FB', borderRadius: 6, padding: '6px 10px', marginBottom: 8, fontSize: 12, fontWeight: 600, color: '#0C447C' }}>
            PRETPLATA: {r.amount_prepaid?.toFixed(2)}€
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#9ca3af' }}>{r.ref_code}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#1D9E75' }}>{r.total_price}€</span>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {(r.status === 'confirmed' || r.status === 'pending') && type === 'pickup' && (
              <>
                <button onClick={() => openIssue(r)}
                  style={{ padding: '8px 14px', fontSize: 13, border: '1px solid #185FA5', borderRadius: 8, background: '#E6F1FB', color: '#185FA5', cursor: 'pointer', fontWeight: 600 }}>
                  Izdaj i naplati
                </button>
                <button onClick={() => { setCancelModal(r.id); setCancelReason('') }}
                  style={{ padding: '8px 12px', fontSize: 13, border: '1px solid #fecaca', borderRadius: 8, background: 'transparent', color: '#dc2626', cursor: 'pointer' }}>
                  Otkaži
                </button>
              </>
            )}
            {r.status === 'issued' && (
              <>
                <button onClick={() => openCharge(r)}
                  style={{ padding: '8px 14px', fontSize: 13, border: '1px solid #EF9F27', borderRadius: 8, background: '#FAEEDA', color: '#633806', cursor: 'pointer', fontWeight: 500 }}>
                  + Naplati
                </button>
                {type === 'return' && (
                  <button onClick={() => openClose(r)}
                    style={{ padding: '8px 14px', fontSize: 13, border: '1px solid #1D9E75', borderRadius: 8, background: '#E1F5EE', color: '#085041', cursor: 'pointer', fontWeight: 600 }}>
                    Preuzmi vozilo
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isMobile ? 12 : 0 }}>
          <div>
            <h1 style={{ fontSize: isMobile ? 17 : 20, fontWeight: 600, color: '#111' }}>Dnevni pregled</h1>
            {!isMobile && (
              <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2, textTransform: 'capitalize' }}>
                {formatDate(selectedDate)}
                {isToday() && <span style={{ marginLeft: 8, background: '#E1F5EE', color: '#0F6E56', fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>Danas</span>}
                {isFuture() && <span style={{ marginLeft: 8, background: '#E6F1FB', color: '#0C447C', fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>Predstojeći</span>}
              </div>
            )}
          </div>
          {!isMobile && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button onClick={prevDay} style={{ padding: '8px 14px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 16, color: '#374151' }}>←</button>
              <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
                style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, color: '#111', background: '#fff' }} />
              <button onClick={() => setSelectedDate(today)} style={{ padding: '8px 14px', border: '1px solid #1D9E75', borderRadius: 8, background: '#E1F5EE', cursor: 'pointer', fontSize: 12, color: '#0F6E56', fontWeight: 600 }}>Danas</button>
              <button onClick={nextDay} style={{ padding: '8px 14px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 16, color: '#374151' }}>→</button>
            </div>
          )}
        </div>
        {isMobile && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button onClick={prevDay} style={{ padding: '10px 16px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 18, color: '#374151' }}>←</button>
            <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
              style={{ flex: 1, padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, color: '#111', background: '#fff' }} />
            <button onClick={() => setSelectedDate(today)} style={{ padding: '10px 14px', border: '1px solid #1D9E75', borderRadius: 8, background: '#E1F5EE', cursor: 'pointer', fontSize: 12, color: '#0F6E56', fontWeight: 600 }}>Danas</button>
            <button onClick={nextDay} style={{ padding: '10px 16px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 18, color: '#374151' }}>→</button>
          </div>
        )}
        {isMobile && (
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6, textTransform: 'capitalize' }}>
            {formatDate(selectedDate)}
            {isToday() && <span style={{ marginLeft: 6, background: '#E1F5EE', color: '#0F6E56', fontSize: 10, padding: '2px 6px', borderRadius: 20, fontWeight: 600 }}>Danas</span>}
          </div>
        )}
      </div>

      {/* Metrike */}
      {/* Location filter */}
      <div style={{ position: 'relative', marginBottom: 12 }}>
        <button onClick={() => setShowLocationFilter(o => !o)}
          style={{ padding: '7px 14px', fontSize: 13, border: `1px solid ${selectedLocations.length > 0 ? '#1D9E75' : '#e5e7eb'}`, borderRadius: 20, background: selectedLocations.length > 0 ? '#E1F5EE' : '#fff', color: selectedLocations.length > 0 ? '#085041' : '#6b7280', cursor: 'pointer', fontWeight: selectedLocations.length > 0 ? 600 : 400, display: 'flex', alignItems: 'center', gap: 6 }}>
          📍 {selectedLocations.length === 0 ? 'Sve lokacije' : selectedLocations.map(id => locations.find(l => l.id === id)?.name).filter(Boolean).join(', ')}
          <span style={{ fontSize: 10 }}>▼</span>
        </button>
        {showLocationFilter && (
          <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 50, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', minWidth: 200, marginTop: 4, padding: 8 }}>
            <div style={{ fontSize: 11, color: '#9ca3af', padding: '4px 8px', marginBottom: 4 }}>Odaberi lokacije</div>
            {locations.map(loc => {
              const vCount = (vehiclesByLocation[loc.id] || []).length
              const isSelected = selectedLocations.includes(loc.id)
              return (
                <div key={loc.id} onClick={() => toggleLocation(loc.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 6, cursor: 'pointer', background: isSelected ? '#f0fdf8' : 'transparent' }}>
                  <div style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${isSelected ? '#1D9E75' : '#d1d5db'}`, background: isSelected ? '#1D9E75' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff', flexShrink: 0 }}>
                    {isSelected ? '✓' : ''}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, color: '#374151' }}>{loc.name}</div>
                    {vCount > 0 && <div style={{ fontSize: 10, color: '#9ca3af' }}>{vCount} vozila</div>}
                  </div>
                </div>
              )
            })}
            {selectedLocations.length > 0 && (
              <div style={{ borderTop: '1px solid #f3f4f6', marginTop: 6, paddingTop: 6 }}>
                <button onClick={() => { setSelectedLocations([]); localStorage.removeItem('avtorent-agent-locations') }}
                  style={{ width: '100%', padding: '6px', fontSize: 12, border: 'none', background: 'transparent', color: '#9ca3af', cursor: 'pointer', textAlign: 'left' as const }}>
                  Poništi filter
                </button>
              </div>
            )}
          </div>
        )}
        {showLocationFilter && <div style={{ position: 'fixed', inset: 0, zIndex: 49 }} onClick={() => setShowLocationFilter(false)} />}
      </div>

      {newResAlert && (
        <div style={{ background: '#E1F5EE', border: '1px solid #1D9E75', borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', animation: 'pulse 1s ease-in-out' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>🔔</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#085041' }}>NOVA REZERVACIJA!</div>
              <div style={{ fontSize: 12, color: '#0F6E56' }}>{newResAlert}</div>
            </div>
          </div>
          <button onClick={() => setNewResAlert(null)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#085041' }}>✕</button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(3, minmax(0,1fr))' : 'repeat(3, minmax(0,1fr))', gap: isMobile ? 8 : 12, marginBottom: isMobile ? 16 : 20 }}>
        {[
          { label: 'Izdavanja', value: `${pickups.filter(r => r.status === 'issued' || r.status === 'closed').length}/${pickups.length}`, color: '#1D9E75', bg: '#E1F5EE', sub: 'završeno/ukupno' },
          { label: 'Preuzimanja', value: `${returns.filter(r => r.status === 'closed').length}/${returns.length}`, color: '#185FA5', bg: '#E6F1FB', sub: 'završeno/ukupno' },
          { label: 'Preostale obaveze', value: pendingCount, color: pendingCount === 0 ? '#085041' : '#BA7517', bg: pendingCount === 0 ? '#E1F5EE' : '#FAEEDA', sub: pendingCount === 0 ? 'sve završeno!' : 'čeka na akciju' },
        ].map(m => (
          <div key={m.label} style={{ background: m.bg, borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>{m.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: m.color }}>{m.value}</div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{m.sub}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af', fontSize: 13 }}>Učitavanje...</div>
      ) : reservations.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af', fontSize: 14, border: '1px dashed #e5e7eb', borderRadius: 12 }}>Nema rezervacija za ovaj dan.</div>
      ) : (
        <>
          {/* Status banner */}
          <div style={{ background: pendingCount === 0 ? '#E1F5EE' : '#f9fafb', border: `1px solid ${pendingCount === 0 ? '#5DCAA5' : '#e5e7eb'}`, borderRadius: 10, padding: '14px 20px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: pendingCount === 0 ? '#085041' : '#374151' }}>
              {pendingCount === 0 ? '✓ NEMA OBAVEZA NA ČEKANJU' : `Obaveze: ${doneCount}/${totalCount} završeno`}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {pendingCount > 0 && (
                <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
                  <span style={{ color: '#1D9E75' }}>✓ {doneCount} završeno</span>
                  <span style={{ color: '#BA7517' }}>⏳ {pendingCount} preostalo</span>
                </div>
              )}
              {doneCount > 0 && (
                <button onClick={() => setShowDone(s => !s)}
                  style={{ fontSize: 11, padding: '3px 10px', border: '1px solid #d1d5db', borderRadius: 20, background: '#fff', cursor: 'pointer', color: '#6b7280', whiteSpace: 'nowrap' as const }}>
                  {showDone ? 'Sakrij završene' : 'Prikaži završene'}
                </button>
              )}
            </div>
          </div>

          {/* Kolone */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? 20 : 24 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#1D9E75' }} />
                <div style={{ fontSize: 15, fontWeight: 600, color: '#111' }}>Preuzimanja danas</div>
                <div style={{ background: '#E1F5EE', color: '#085041', fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>{pickups.length}</div>
              </div>
              {pickups.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af', fontSize: 13, border: '1px dashed #e5e7eb', borderRadius: 10 }}>Nema preuzimanja</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[...pickups].sort((a, b) => {
                  const aDone = a.status === 'issued' || a.status === 'closed'
                  const bDone = b.status === 'issued' || b.status === 'closed'
                  if (aDone !== bDone) return aDone ? 1 : -1
                  return (a.pickup_time || '').localeCompare(b.pickup_time || '')
                }).filter(r => showDone || !(r.status === 'issued' || r.status === 'closed')).map((r, i, arr) => {
                  const prevDone = i > 0 && (arr[i-1].status === 'issued' || arr[i-1].status === 'closed')
                  const currDone = r.status === 'issued' || r.status === 'closed'
                  return (
                    <div key={r.id}>
                      {showDone && !prevDone && currDone && i > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '12px 0 8px', color: '#9ca3af', fontSize: 11 }}>
                          <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
                          <span>Završeno</span>
                          <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
                        </div>
                      )}
                      <ReservationCard r={r} type="pickup" />
                    </div>
                  )
                })}
                </div>
              )}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#185FA5' }} />
                <div style={{ fontSize: 15, fontWeight: 600, color: '#111' }}>Vraćanja danas</div>
                <div style={{ background: '#E6F1FB', color: '#0C447C', fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>{returns.length}</div>
              </div>
              {returns.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af', fontSize: 13, border: '1px dashed #e5e7eb', borderRadius: 10 }}>Nema vraćanja</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[...returns].sort((a, b) => {
                  const aDone = a.status === 'closed'
                  const bDone = b.status === 'closed'
                  if (aDone !== bDone) return aDone ? 1 : -1
                  return (a.return_time || '').localeCompare(b.return_time || '')
                }).filter(r => showDone || r.status !== 'closed').map((r, i, arr) => {
                  const prevDone = i > 0 && arr[i-1].status === 'closed'
                  const currDone = r.status === 'closed'
                  return (
                    <div key={r.id}>
                      {showDone && !prevDone && currDone && i > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '12px 0 8px', color: '#9ca3af', fontSize: 11 }}>
                          <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
                          <span>Završeno</span>
                          <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
                        </div>
                      )}
                      <ReservationCard r={r} type="return" />
                    </div>
                  )
                })}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Neizmirene obaveze iz prethodnih dana */}
      {overdueReservations.filter(locationFilter).length > 0 && (
        <div style={{ marginTop: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#dc2626' }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: '#111' }}>Neizmirene obaveze</div>
            <div style={{ background: '#FCEBEB', color: '#791F1F', fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>{overdueReservations.filter(locationFilter).length}</div>
            <div style={{ fontSize: 12, color: '#9ca3af' }}>iz prethodnih dana</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {overdueReservations.filter(locationFilter).map(r => {
              const st = STATUS_COLORS[r.status] || STATUS_COLORS.pending
              const isOverduePickup = r.status === 'confirmed' || r.status === 'pending'
              return (
                <div key={r.id} style={{ border: '1px solid #fecaca', borderRadius: 10, padding: '14px 16px', background: '#fff', borderLeft: '3px solid #dc2626' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 15, color: '#111' }}>{r.guest_name}</div>
                      <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{r.guest_phone}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, background: '#FCEBEB', color: '#791F1F', padding: '3px 8px', borderRadius: 20, fontWeight: 600 }}>
                        {isOverduePickup ? 'Nije preuzeto' : 'Nije vraćeno'}
                      </span>
                      <span style={{ fontSize: 11, background: st.bg, color: st.color, padding: '3px 8px', borderRadius: 20, fontWeight: 500 }}>{st.label}</span>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
                    <div style={{ background: '#f9fafb', borderRadius: 6, padding: '7px 10px' }}>
                      <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 1 }}>Vozilo</div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: '#111' }}>{r.vehicles?.name || '—'}</div>
                    </div>
                    <div style={{ background: '#f9fafb', borderRadius: 6, padding: '7px 10px' }}>
                      <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 1 }}>{isOverduePickup ? 'Trebalo preuzimanje' : 'Trebalo vraćanje'}</div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: '#dc2626' }}>{isOverduePickup ? r.pickup_date : r.return_date}</div>
                    </div>
                    <div style={{ background: '#f9fafb', borderRadius: 6, padding: '7px 10px' }}>
                      <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 1 }}>Iznos</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#1D9E75' }}>{r.total_price}€</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#9ca3af' }}>{r.ref_code}</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {isOverduePickup && (
                        <>
                          <button onClick={() => openIssue(r)}
                            style={{ padding: '6px 12px', fontSize: 12, border: '1px solid #185FA5', borderRadius: 8, background: '#E6F1FB', color: '#185FA5', cursor: 'pointer', fontWeight: 600 }}>
                            Izdaj i naplati
                          </button>
                          <button onClick={() => { setCancelModal(r.id); setCancelReason('') }}
                            style={{ padding: '6px 12px', fontSize: 12, border: '1px solid #fecaca', borderRadius: 8, background: 'transparent', color: '#dc2626', cursor: 'pointer' }}>
                            Otkaži
                          </button>
                        </>
                      )}
                      {!isOverduePickup && (
                        <button onClick={() => openClose(r)}
                          style={{ padding: '6px 12px', fontSize: 12, border: '1px solid #1D9E75', borderRadius: 8, background: '#E1F5EE', color: '#085041', cursor: 'pointer', fontWeight: 600 }}>
                          Preuzmi vozilo
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* MODALI */}
      {modal && selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 }}>

          {modal === 'issue' && (
            <div style={{ background: '#fff', borderRadius: 12, padding: '28px 24px', maxWidth: 460, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#111', marginBottom: 4 }}>Izdaj vozilo</div>
              <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>{selected.ref_code} — {selected.guest_name} — {selected.vehicles?.name}</div>
              <div style={{ background: '#f9fafb', borderRadius: 8, padding: '10px 16px', marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: '#6b7280' }}>Ukupno za naplatu</span>
                <span style={{ fontSize: 18, fontWeight: 700, color: '#1D9E75' }}>{selected.total_price}€</span>
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                <button onClick={() => setIssueMode('quick')} style={{ flex: 1, padding: '10px', border: `2px solid ${issueMode === 'quick' ? '#1D9E75' : '#e5e7eb'}`, borderRadius: 8, background: issueMode === 'quick' ? '#E1F5EE' : '#fff', color: issueMode === 'quick' ? '#085041' : '#6b7280', cursor: 'pointer', fontSize: 13, fontWeight: issueMode === 'quick' ? 600 : 400 }}>Brzo izdavanje</button>
                <button onClick={() => setIssueMode('full')} style={{ flex: 1, padding: '10px', border: `2px solid ${issueMode === 'full' ? '#185FA5' : '#e5e7eb'}`, borderRadius: 8, background: issueMode === 'full' ? '#E6F1FB' : '#fff', color: issueMode === 'full' ? '#0C447C' : '#6b7280', cursor: 'pointer', fontSize: 13, fontWeight: issueMode === 'full' ? 600 : 400 }}>Prilagođeno</button>
              </div>
              {issueMode === 'quick' && (
                <>
                  <div style={{ background: '#E1F5EE', border: '1px solid #5DCAA5', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#085041' }}>
                    Pun iznos naplaćen ({selected.total_price}€). Odaberi način plaćanja.
                  </div>
                  <PaymentMethodSelector total={selected.total_price} value={issuePayment} onChange={setIssuePayment} />
                </>
              )}
              {issueMode === 'full' && (
                <div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                    <button onClick={() => { setIssuePaymentMode('full'); setIssueAmount(String(selected.total_price)) }}
                      style={{ flex: 1, padding: '9px', border: `1px solid ${issuePaymentMode === 'full' ? '#1D9E75' : '#e5e7eb'}`, borderRadius: 8, background: issuePaymentMode === 'full' ? '#E1F5EE' : '#fff', color: issuePaymentMode === 'full' ? '#085041' : '#6b7280', cursor: 'pointer', fontSize: 12 }}>
                      Pun iznos ({selected.total_price}€)
                    </button>
                    <button onClick={() => { setIssuePaymentMode('other'); setIssueAmount('') }}
                      style={{ flex: 1, padding: '9px', border: `1px solid ${issuePaymentMode === 'other' ? '#1D9E75' : '#e5e7eb'}`, borderRadius: 8, background: issuePaymentMode === 'other' ? '#E1F5EE' : '#fff', color: issuePaymentMode === 'other' ? '#085041' : '#6b7280', cursor: 'pointer', fontSize: 12 }}>
                      Drugi iznos
                    </button>
                  </div>
                  {issuePaymentMode === 'other' && (
                    <input type="number" step="0.01" value={issueAmount} onChange={e => setIssueAmount(e.target.value)} placeholder="Naplaćeni iznos"
                      style={{ width: '100%', padding: '9px 12px', fontSize: 14, border: '1px solid #d1d5db', borderRadius: 8, boxSizing: 'border-box' as const, color: '#111', marginBottom: 8 }} />
                  )}
                  {issuePaymentMode === 'other' && issueAmount && Math.abs(issueDiff) > 0.01 && (
                    <div style={{ padding: '8px 12px', borderRadius: 8, marginBottom: 10, background: issueDiff < 0 ? '#FCEBEB' : '#E6F1FB', fontSize: 13, fontWeight: 500, color: issueDiff < 0 ? '#791F1F' : '#0C447C' }}>
                      {issueDiff < 0 ? `DUG: ${Math.abs(issueDiff).toFixed(2)}€` : `PRETPLATA: ${issueDiff.toFixed(2)}€`}
                    </div>
                  )}
                  <PaymentMethodSelector total={fullIssueAmount} value={issuePayment} onChange={setIssuePayment} />
                </div>
              )}
              <div style={{ background: '#E6F1FB', border: '1px solid #85B7EB', borderRadius: 8, padding: '8px 12px', margin: '16px 0', fontSize: 12, color: '#0C447C' }}>
                Agent <strong>{agentName || 'Agent'}</strong> se zadužuje za naplaćeni iznos.
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setModal(null)} style={{ flex: 1, padding: '10px', border: '1px solid #d1d5db', borderRadius: 8, background: 'transparent', fontSize: 13, cursor: 'pointer', color: '#374151' }}>Odustani</button>
                <button onClick={issueMode === 'quick' ? handleQuickIssue : handleFullIssue} disabled={issueSaving}
                  style={{ flex: 2, padding: '10px', background: issueSaving ? '#5DCAA5' : '#185FA5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  {issueSaving ? '...' : 'Potvrdi i izdaj vozilo'}
                </button>
              </div>
            </div>
          )}

          {modal === 'close' && (
            <div style={{ background: '#fff', borderRadius: 12, padding: '28px 24px', maxWidth: 500, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#111', marginBottom: 4 }}>Preuzmi vozilo</div>
              <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>{selected.ref_code} — {selected.guest_name}</div>
              {isEarlyReturn && (
                <div style={{ background: '#fef9c3', border: '1px solid #fbbf24', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#713f12' }}>
                  Vozilo se vraća prije isteka roka ({selected.return_date}).
                </div>
              )}
              {!hasDebtOrPrepaid(selected) && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                  <button onClick={() => setCloseMode('quick')} style={{ flex: 1, padding: '10px', border: `2px solid ${closeMode === 'quick' ? '#1D9E75' : '#e5e7eb'}`, borderRadius: 8, background: closeMode === 'quick' ? '#E1F5EE' : '#fff', color: closeMode === 'quick' ? '#085041' : '#6b7280', cursor: 'pointer', fontSize: 13, fontWeight: closeMode === 'quick' ? 600 : 400 }}>Brzo preuzimanje</button>
                  <button onClick={() => setCloseMode('full')} style={{ flex: 1, padding: '10px', border: `2px solid ${closeMode === 'full' ? '#185FA5' : '#e5e7eb'}`, borderRadius: 8, background: closeMode === 'full' ? '#E6F1FB' : '#fff', color: closeMode === 'full' ? '#0C447C' : '#6b7280', cursor: 'pointer', fontSize: 13, fontWeight: closeMode === 'full' ? 600 : 400 }}>Sa dopuni</button>
                </div>
              )}
              {closeMode === 'quick' && !hasDebtOrPrepaid(selected) && (
                <div>
                  <div style={{ background: '#E1F5EE', border: '1px solid #5DCAA5', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#085041' }}>
                    Nema duga, pretplate ni doplata. Vozilo se zatvara odmah.
                  </div>
                  {isEarlyReturn && (
                    <div style={{ marginBottom: 14 }}>
                      <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Razlog prijevremenog povratka *</label>
                      <textarea value={earlyReturnNote} onChange={e => setEarlyReturnNote(e.target.value)} placeholder="Unesite razlog..."
                        style={{ width: '100%', padding: '8px 12px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, minHeight: 60, resize: 'vertical' as const, boxSizing: 'border-box' as const, color: '#111' }} />
                    </div>
                  )}
                </div>
              )}
              {(closeMode === 'full' || hasDebtOrPrepaid(selected)) && (
                <div>
                  {selected.payment_status === 'debt' && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ background: '#FCEBEB', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 10 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#791F1F' }}>DUG: {selected.amount_debt?.toFixed(2)}€</div>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Da li je dug naplaćen?</div>
                      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                        <button onClick={() => setDebtCollected(true)} style={{ flex: 1, padding: '9px', border: `1px solid ${debtCollected === true ? '#1D9E75' : '#e5e7eb'}`, borderRadius: 8, background: debtCollected === true ? '#E1F5EE' : '#fff', cursor: 'pointer', fontSize: 13 }}>Da</button>
                        <button onClick={() => setDebtCollected(false)} style={{ flex: 1, padding: '9px', border: `1px solid ${debtCollected === false ? '#dc2626' : '#e5e7eb'}`, borderRadius: 8, background: debtCollected === false ? '#FCEBEB' : '#fff', cursor: 'pointer', fontSize: 13 }}>Ne</button>
                      </div>
                      {debtCollected === true && <PaymentMethodSelector total={selected.amount_debt} value={debtPayment} onChange={setDebtPayment} />}
                    </div>
                  )}
                  {selected.payment_status === 'prepaid' && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ background: '#E6F1FB', border: '1px solid #85B7EB', borderRadius: 8, padding: '10px 14px', marginBottom: 10 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#0C447C' }}>PRETPLATA: {selected.amount_prepaid?.toFixed(2)}€</div>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Da li je pretplata vraćena?</div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => setPrepaidReturned(true)} style={{ flex: 1, padding: '9px', border: `1px solid ${prepaidReturned === true ? '#1D9E75' : '#e5e7eb'}`, borderRadius: 8, background: prepaidReturned === true ? '#E1F5EE' : '#fff', cursor: 'pointer', fontSize: 13 }}>Da</button>
                        <button onClick={() => setPrepaidReturned(false)} style={{ flex: 1, padding: '9px', border: `1px solid ${prepaidReturned === false ? '#dc2626' : '#e5e7eb'}`, borderRadius: 8, background: prepaidReturned === false ? '#FCEBEB' : '#fff', cursor: 'pointer', fontSize: 13 }}>Ne</button>
                      </div>
                    </div>
                  )}
                  {isEarlyReturn && (
                    <div style={{ marginBottom: 14 }}>
                      <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Razlog prijevremenog povratka *</label>
                      <textarea value={earlyReturnNote} onChange={e => setEarlyReturnNote(e.target.value)} placeholder="Unesite razlog..."
                        style={{ width: '100%', padding: '8px 12px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, minHeight: 60, resize: 'vertical' as const, boxSizing: 'border-box' as const, color: '#111' }} />
                    </div>
                  )}
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Da li postoje doplate?</div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                    <button onClick={() => setHasSurcharges(true)} style={{ flex: 1, padding: '9px', border: `1px solid ${hasSurcharges === true ? '#1D9E75' : '#e5e7eb'}`, borderRadius: 8, background: hasSurcharges === true ? '#E1F5EE' : '#fff', cursor: 'pointer', fontSize: 13 }}>Da</button>
                    <button onClick={() => setHasSurcharges(false)} style={{ flex: 1, padding: '9px', border: `1px solid ${hasSurcharges === false ? '#1D9E75' : '#e5e7eb'}`, borderRadius: 8, background: hasSurcharges === false ? '#E1F5EE' : '#fff', cursor: 'pointer', fontSize: 13 }}>Ne</button>
                  </div>
                  {hasSurcharges === true && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
                      {surchargeTypes.map(st => (
                        <div key={st.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: surchargeAmounts[st.id] && parseFloat(surchargeAmounts[st.id]) > 0 ? 8 : 0 }}>
                            <span style={{ flex: 1, fontSize: 13, color: '#374151' }}>{st.name}</span>
                            <input type="number" step="0.01" placeholder="0" value={surchargeAmounts[st.id] || ''}
                              onChange={e => setSurchargeAmounts(s => ({ ...s, [st.id]: e.target.value }))}
                              style={{ width: 80, padding: '5px 8px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 6, textAlign: 'right' as const, color: '#111' }} />
                            <span style={{ fontSize: 12, color: '#9ca3af' }}>€</span>
                          </div>
                          {surchargeAmounts[st.id] && parseFloat(surchargeAmounts[st.id]) > 0 && (
                            <PaymentMethodSelector
                              total={parseFloat(surchargeAmounts[st.id])}
                              value={surchargePayments[st.name] || { method: 'cash', cashAmount: '', cardAmount: '', wireAmount: '' }}
                              onChange={v => setSurchargePayments(s => ({ ...s, [st.name]: v }))}
                            />
                          )}
                        </div>
                      ))}
                      <div style={{ border: '1px dashed #d1d5db', borderRadius: 8, padding: '10px 12px' }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: customSurchargeAmount && parseFloat(customSurchargeAmount) > 0 ? 8 : 0 }}>
                          <input placeholder="Naziv doplate" value={customSurcharge} onChange={e => setCustomSurcharge(e.target.value)}
                            style={{ flex: 1, padding: '5px 8px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 6, color: '#111' }} />
                          <input type="number" step="0.01" placeholder="0" value={customSurchargeAmount} onChange={e => setCustomSurchargeAmount(e.target.value)}
                            style={{ width: 80, padding: '5px 8px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 6, textAlign: 'right' as const, color: '#111' }} />
                          <span style={{ fontSize: 12, color: '#9ca3af' }}>€</span>
                        </div>
                        {customSurchargeAmount && parseFloat(customSurchargeAmount) > 0 && (
                          <PaymentMethodSelector
                            total={parseFloat(customSurchargeAmount)}
                            value={surchargePayments['custom'] || { method: 'cash', cashAmount: '', cardAmount: '', wireAmount: '' }}
                            onChange={v => setSurchargePayments(s => ({ ...s, custom: v }))}
                          />
                        )}
                      </div>
                      {surchargesSum > 0 && (
                        <div style={{ background: '#FAEEDA', border: '1px solid #EF9F27', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#633806', fontWeight: 500 }}>
                          Ukupno doplate: {surchargesSum.toFixed(2)}€
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button onClick={() => setModal(null)} style={{ flex: 1, padding: '10px', border: '1px solid #d1d5db', borderRadius: 8, background: 'transparent', fontSize: 13, cursor: 'pointer', color: '#374151' }}>Odustani</button>
                <button
                  onClick={closeMode === 'quick' && !hasDebtOrPrepaid(selected) ? handleQuickClose : handleFullClose}
                  disabled={closeSaving || ((closeMode === 'full' || hasDebtOrPrepaid(selected)) && hasSurcharges === null)}
                  style={{ flex: 2, padding: '10px', background: closeSaving ? '#5DCAA5' : '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  {closeSaving ? '...' : 'Zatvori rezervaciju'}
                </button>
              </div>
            </div>
          )}

          {modal === 'charge' && (
            <div style={{ background: '#fff', borderRadius: 12, padding: '24px', width: '100%', maxWidth: 460, maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: '#111' }}>Dodaj naplatu</div>
                  <div style={{ fontSize: 12, color: '#9ca3af' }}>{selected.ref_code} — {selected.guest_name}</div>
                </div>
                <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9ca3af' }}>✕</button>
              </div>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Tip naplate</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[['extra', 'Dodatak'], ['surcharge', 'Doplata'], ['custom', 'Slobodan unos']].map(([val, lbl]) => (
                    <button key={val} onClick={() => { setChargeType(val as any); setChargeItemId(''); setChargeItemName(''); setChargeAmount('') }}
                      style={{ flex: 1, padding: '7px', fontSize: 12, border: `1px solid ${chargeType === val ? '#1D9E75' : '#e5e7eb'}`, borderRadius: 8, background: chargeType === val ? '#E1F5EE' : '#fff', color: chargeType === val ? '#085041' : '#6b7280', cursor: 'pointer', fontWeight: chargeType === val ? 600 : 400 }}>
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
              {chargeType === 'extra' && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Odaberi dodatak</div>
                  <select value={chargeItemId} onChange={e => {
                    const ex = extras.find(x => x.id === e.target.value)
                    setChargeItemId(e.target.value); setChargeItemName(ex?.name || ''); setChargeAmount(ex ? String(ex.price) : '')
                  }} style={{ width: '100%', padding: '8px 12px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', color: '#111' }}>
                    <option value="">-- Odaberi --</option>
                    {extras.map(ex => <option key={ex.id} value={ex.id}>{ex.name} — {ex.price}€</option>)}
                  </select>
                </div>
              )}
              {chargeType === 'surcharge' && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Odaberi doplatu</div>
                  <select value={chargeItemId} onChange={e => {
                    const st = surchargeTypes.find(x => x.id === e.target.value)
                    setChargeItemId(e.target.value); setChargeItemName(st?.name || '')
                  }} style={{ width: '100%', padding: '8px 12px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', color: '#111' }}>
                    <option value="">-- Odaberi --</option>
                    {surchargeTypes.map(st => <option key={st.id} value={st.id}>{st.name}</option>)}
                  </select>
                </div>
              )}
              {chargeType === 'custom' && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Naziv stavke</div>
                  <input value={chargeItemName} onChange={e => setChargeItemName(e.target.value)} placeholder="npr. Dječija sjedalica"
                    style={{ width: '100%', padding: '8px 12px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, color: '#111' }} />
                </div>
              )}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Iznos (€)</div>
                <input type="number" step="0.01" value={chargeAmount} onChange={e => setChargeAmount(e.target.value)} placeholder="0.00"
                  style={{ width: '100%', padding: '8px 12px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, color: '#111' }} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <PaymentMethodSelector total={parseFloat(chargeAmount || '0')} value={chargePayment} onChange={setChargePayment} />
              </div>
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Komentar (opciono)</div>
                <input value={chargeComment} onChange={e => setChargeComment(e.target.value)} placeholder="Napomena..."
                  style={{ width: '100%', padding: '8px 12px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, color: '#111' }} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={handleCharge} disabled={chargeSaving || !chargeItemName || !chargeAmount}
                  style={{ flex: 2, padding: '10px', background: chargeSaving || !chargeItemName || !chargeAmount ? '#9ca3af' : '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                  {chargeSaving ? 'Snimanje...' : 'Naplati'}
                </button>
                <button onClick={() => setModal(null)} style={{ flex: 1, padding: '10px', border: '1px solid #d1d5db', borderRadius: 8, background: 'transparent', fontSize: 13, cursor: 'pointer', color: '#374151' }}>
                  Odustani
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CANCEL MODAL */}
      {cancelModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: '24px', maxWidth: 420, width: '100%' }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#111', marginBottom: 4 }}>Otkazivanje rezervacije</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 18 }}>Unesite razlog otkazivanja</div>
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Razlog *</label>
              <textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)}
                placeholder="npr. Klijent otkazao, dupla rezervacija..."
                style={{ width: '100%', padding: '10px 12px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, minHeight: 80, resize: 'vertical' as const, color: '#111', boxSizing: 'border-box' as const }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleCancel} disabled={cancelSaving || !cancelReason.trim()}
                style={{ flex: 2, padding: '10px', background: !cancelReason.trim() ? '#9ca3af' : '#dc2626', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                {cancelSaving ? '...' : 'Otkaži rezervaciju'}
              </button>
              <button onClick={() => { setCancelModal(null); setCancelReason('') }}
                style={{ flex: 1, padding: '10px', border: '1px solid #d1d5db', borderRadius: 8, background: 'transparent', fontSize: 13, cursor: 'pointer', color: '#374151' }}>
                Odustani
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WASH MODAL */}
      {showWashModal && washReservation && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: '28px 24px', maxWidth: 460, width: '100%' }}>
            <div style={{ fontSize: 20, marginBottom: 8, textAlign: 'center' }}>🚗💦</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#111', marginBottom: 4, textAlign: 'center' }}>Potrebno pranje vozila?</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 20, textAlign: 'center' }}>{washReservation.vehicles?.name}</div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>Tip pranja</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {WASH_TYPES.map(w => (
                  <button key={w.key} onClick={() => setWashType(w.key)}
                    style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', border: `1px solid ${washType === w.key ? '#1D9E75' : '#e5e7eb'}`, borderRadius: 8, background: washType === w.key ? '#E1F5EE' : '#fff', cursor: 'pointer', fontSize: 13, color: washType === w.key ? '#085041' : '#374151', fontWeight: washType === w.key ? 600 : 400, textAlign: 'left' as const }}>
                    <span>{w.label}</span>
                    <span style={{ color: washType === w.key ? '#1D9E75' : '#9ca3af', fontWeight: 600 }}>{w.price > 0 ? `${w.price}€` : 'unesi cijenu'}</span>
                  </button>
                ))}
              </div>
            </div>
            {washType === 'specific' && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Cijena (€)</div>
                <input type="number" step="0.01" value={washCustomPrice} onChange={e => setWashCustomPrice(e.target.value)} placeholder="0.00"
                  style={{ width: '100%', padding: '9px 12px', fontSize: 14, border: '1px solid #d1d5db', borderRadius: 8, color: '#111', boxSizing: 'border-box' as const }} />
              </div>
            )}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Ko pere?</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setWashAssignedTo('partner')}
                  style={{ flex: 1, padding: '9px', border: `1px solid ${washAssignedTo === 'partner' ? '#1D9E75' : '#e5e7eb'}`, borderRadius: 8, background: washAssignedTo === 'partner' ? '#E1F5EE' : '#fff', color: washAssignedTo === 'partner' ? '#085041' : '#374151', cursor: 'pointer', fontSize: 13, fontWeight: washAssignedTo === 'partner' ? 600 : 400 }}>
                  Praonica
                </button>
                <button onClick={() => setWashAssignedTo('agent')}
                  style={{ flex: 1, padding: '9px', border: `1px solid ${washAssignedTo === 'agent' ? '#1D9E75' : '#e5e7eb'}`, borderRadius: 8, background: washAssignedTo === 'agent' ? '#E1F5EE' : '#fff', color: washAssignedTo === 'agent' ? '#085041' : '#374151', cursor: 'pointer', fontSize: 13, fontWeight: washAssignedTo === 'agent' ? 600 : 400 }}>
                  Agent sam
                </button>
              </div>
            </div>
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Napomena (opciono)</div>
              <input value={washNotes} onChange={e => setWashNotes(e.target.value)} placeholder="Posebne napomene..."
                style={{ width: '100%', padding: '9px 12px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, color: '#111', boxSizing: 'border-box' as const }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => handleWashOrder(false)} disabled={!washType || washSaving || (washType === 'specific' && !washCustomPrice)}
                style={{ flex: 2, padding: '11px', background: !washType ? '#9ca3af' : '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                {washSaving ? '...' : 'Naruči pranje'}
              </button>
              <button onClick={() => handleWashOrder(true)}
                style={{ flex: 1, padding: '11px', border: '1px solid #d1d5db', borderRadius: 8, background: 'transparent', fontSize: 13, cursor: 'pointer', color: '#6b7280' }}>
                Preskoči
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
