'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Vehicle = { id: string; name: string; category: string }
type Reservation = {
  id: string; ref_code: string; guest_name: string
  guest_email: string; guest_phone: string; pickup_location: string; notes: string
  pickup_date: string; return_date: string; pickup_time: string; return_time: string
  status: string; vehicle_id: string; total_price: number
  vehicles: { name: string } | null
}

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  pending:   { bg: '#FAEEDA', text: '#633806', border: '#EF9F27' },
  confirmed: { bg: '#E1F5EE', text: '#085041', border: '#1D9E75' },
  issued:    { bg: '#E6F1FB', text: '#0C447C', border: '#378ADD' },
  closed:    { bg: '#f3f4f6', text: '#374151', border: '#9ca3af' },
  cancelled: { bg: '#FCEBEB', text: '#791F1F', border: '#fecaca' },
}

const MONTHS = ['Januar', 'Februar', 'Mart', 'April', 'Maj', 'Juni', 'Juli', 'August', 'Septembar', 'Oktobar', 'Novembar', 'Decembar']
const DAYS = ['Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub', 'Ned']

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number) {
  const day = new Date(year, month, 1).getDay()
  return day === 0 ? 6 : day - 1
}

function dateStr(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function isDateInRange(date: string, start: string, end: string) {
  return date >= start && date <= end
}

export default function AdminKalendarPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'by-vehicle' | 'by-date'>('by-vehicle')
  const [selectedRes, setSelectedRes] = useState<Reservation | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [editForm, setEditForm] = useState<Partial<Reservation>>({})
  const [editSaving, setEditSaving] = useState(false)
  const [hoveredRes, setHoveredRes] = useState<string | null>(null)

  useEffect(() => { fetchData() }, [year, month])
async function saveEdit() {
    if (!selectedRes) return
    setEditSaving(true)
    await supabase.from('reservations').update(editForm).eq('id', selectedRes.id)
    setEditSaving(false)
    setEditMode(false)
    fetchData()
    setSelectedRes({ ...selectedRes, ...editForm } as Reservation)
  }
  async function fetchData() {
    setLoading(true)
    const startDate = dateStr(year, month, 1)
    const endDate = dateStr(year, month, getDaysInMonth(year, month))

    const [{ data: v }, { data: r }] = await Promise.all([
      supabase.from('vehicles').select('id, name, category').eq('is_available', true).order('name'),
      supabase.from('reservations').select('*, vehicles(name)')
  .neq('status', 'cancelled')
  .lte('pickup_date', endDate)
  .gte('return_date', startDate)
  .order('pickup_date'),
    ])

    setVehicles(v || [])
    setReservations(r || [])
    setLoading(false)
  }

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }

  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)
  const today = new Date().toISOString().split('T')[0]

  // Prikaz po vozilu — svaki red je jedno vozilo, kolone su dani
  function renderByVehicle() {
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)

    return (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 12, minWidth: '100%' }}>
          <thead>
            <tr>
              <th style={{ padding: '8px 12px', textAlign: 'left', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', fontSize: 12, color: '#6b7280', fontWeight: 500, minWidth: 140, position: 'sticky', left: 0, zIndex: 2 }}>
                Vozilo
              </th>
              {days.map(day => {
                const ds = dateStr(year, month, day)
                const isToday = ds === today
                const dayOfWeek = new Date(year, month, day).getDay()
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
                return (
                  <th key={day} style={{ padding: '4px', textAlign: 'center', background: isToday ? '#E1F5EE' : '#f9fafb', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #f3f4f6', minWidth: 32, color: isToday ? '#085041' : isWeekend ? '#9ca3af' : '#374151', fontWeight: isToday ? 700 : 400 }}>
                    <div style={{ fontSize: 10, color: isToday ? '#085041' : '#9ca3af' }}>{DAYS[dayOfWeek === 0 ? 6 : dayOfWeek - 1]}</div>
                    <div>{day}</div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {vehicles.map(v => {
              const vRes = reservations.filter(r => r.vehicle_id === v.id)
              return (
                <tr key={v.id}>
                  <td style={{ padding: '8px 12px', borderBottom: '1px solid #f3f4f6', borderRight: '1px solid #e5e7eb', fontWeight: 500, color: '#111', fontSize: 12, background: '#fff', position: 'sticky', left: 0, zIndex: 1, whiteSpace: 'nowrap' }}>
                    {v.name}
                  </td>
                  {days.map(day => {
                    const ds = dateStr(year, month, day)
                    const isToday = ds === today
                    const res = vRes.find(r => isDateInRange(ds, r.pickup_date, r.return_date))
                    const isStart = res && res.pickup_date === ds
                    const isEnd = res && res.return_date === ds
                    const sc = res ? STATUS_COLORS[res.status] : null
                    const isHovered = res && hoveredRes === res.id

                    return (
                      <td key={day}
                        onClick={() => res && setSelectedRes(res)}
                        onMouseEnter={() => res && setHoveredRes(res.id)}
                        onMouseLeave={() => setHoveredRes(null)}
                        style={{
                          padding: '2px 1px',
                          borderBottom: '1px solid #f3f4f6',
                          borderRight: '1px solid #f3f4f6',
                          background: isToday ? '#f0fdf8' : '#fff',
                          cursor: res ? 'pointer' : 'default',
                          height: 36,
                        }}
                      >
                        {res && sc && (
                          <div style={{
                            height: 28,
                            background: isHovered ? sc.border : sc.bg,
                            borderTop: `2px solid ${sc.border}`,
                            borderBottom: `2px solid ${sc.border}`,
                            borderLeft: isStart ? `2px solid ${sc.border}` : 'none',
                            borderRight: isEnd ? `2px solid ${sc.border}` : 'none',
                            borderRadius: isStart && isEnd ? 4 : isStart ? '4px 0 0 4px' : isEnd ? '0 4px 4px 0' : 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'background .1s',
                            overflow: 'hidden',
                          }}>
                            {isStart && (
                              <span style={{ fontSize: 10, color: isHovered ? '#fff' : sc.text, whiteSpace: 'nowrap', paddingLeft: 4, overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 80 }}>
                                {res.guest_name.split(' ')[0]}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  // Prikaz po datumu — klasični mjesečni kalendar
  function renderByDate() {
    const totalCells = firstDay + daysInMonth
    const totalRows = Math.ceil(totalCells / 7)

    return (
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, background: '#e5e7eb', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
          {DAYS.map(d => (
            <div key={d} style={{ background: '#f9fafb', padding: '8px 4px', textAlign: 'center', fontSize: 12, fontWeight: 500, color: '#6b7280' }}>{d}</div>
          ))}
          {Array.from({ length: firstDay }, (_, i) => (
            <div key={`empty-${i}`} style={{ background: '#fff', minHeight: 100 }} />
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1
            const ds = dateStr(year, month, day)
            const isToday = ds === today
            const dayRes = reservations.filter(r => isDateInRange(ds, r.pickup_date, r.return_date))
            const pickups = reservations.filter(r => r.pickup_date === ds)
            const returns = reservations.filter(r => r.return_date === ds)

            return (
              <div key={day} style={{ background: isToday ? '#f0fdf8' : '#fff', minHeight: 100, padding: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: isToday ? 700 : 400, width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: isToday ? '#1D9E75' : 'transparent', color: isToday ? '#fff' : '#374151' }}>{day}</span>
                  {dayRes.length > 0 && (
                    <span style={{ fontSize: 10, background: '#E1F5EE', color: '#085041', padding: '1px 5px', borderRadius: 10 }}>{dayRes.length}</span>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {pickups.map(r => {
                    const sc = STATUS_COLORS[r.status]
                    return (
                      <div key={`p-${r.id}`} onClick={() => setSelectedRes(r)} style={{ fontSize: 10, padding: '2px 5px', background: sc.bg, color: sc.text, borderRadius: 3, cursor: 'pointer', borderLeft: `2px solid ${sc.border}`, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        ↑ {r.vehicles?.name?.split(' ').slice(-1)[0]} — {r.guest_name.split(' ')[0]}
                      </div>
                    )
                  })}
                  {returns.filter(r => r.pickup_date !== ds).map(r => {
                    const sc = STATUS_COLORS[r.status]
                    return (
                      <div key={`r-${r.id}`} onClick={() => setSelectedRes(r)} style={{ fontSize: 10, padding: '2px 5px', background: '#f3f4f6', color: '#6b7280', borderRadius: 3, cursor: 'pointer', borderLeft: '2px solid #d1d5db', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        ↓ {r.vehicles?.name?.split(' ').slice(-1)[0]} — {r.guest_name.split(' ')[0]}
                      </div>
                    )
                  })}
                  {dayRes.filter(r => r.pickup_date !== ds && r.return_date !== ds).slice(0, 2).map(r => {
                    const sc = STATUS_COLORS[r.status]
                    return (
                      <div key={`a-${r.id}`} onClick={() => setSelectedRes(r)} style={{ fontSize: 10, padding: '2px 5px', background: sc.bg, color: sc.text, borderRadius: 3, cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        · {r.vehicles?.name?.split(' ').slice(-1)[0]}
                      </div>
                    )
                  })}
                  {dayRes.filter(r => r.pickup_date !== ds && r.return_date !== ds).length > 2 && (
                    <div style={{ fontSize: 10, color: '#9ca3af' }}>+{dayRes.filter(r => r.pickup_date !== ds && r.return_date !== ds).length - 2} više</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: '#111' }}>Kalendar zauzetosti</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ display: 'flex', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
            <button onClick={() => setView('by-vehicle')} style={{ padding: '7px 14px', fontSize: 12, border: 'none', background: view === 'by-vehicle' ? '#1D9E75' : '#fff', color: view === 'by-vehicle' ? '#fff' : '#6b7280', cursor: 'pointer', fontWeight: view === 'by-vehicle' ? 600 : 400 }}>Po vozilu</button>
            <button onClick={() => setView('by-date')} style={{ padding: '7px 14px', fontSize: 12, border: 'none', borderLeft: '1px solid #e5e7eb', background: view === 'by-date' ? '#1D9E75' : '#fff', color: view === 'by-date' ? '#fff' : '#6b7280', cursor: 'pointer', fontWeight: view === 'by-date' ? 600 : 400 }}>Po datumu</button>
          </div>
        </div>
      </div>

      {/* Navigacija mjesecom */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        <button onClick={prevMonth} style={{ padding: '7px 14px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 16, color: '#374151' }}>←</button>
        <div style={{ fontSize: 18, fontWeight: 600, color: '#111', minWidth: 180, textAlign: 'center' }}>
          {MONTHS[month]} {year}
        </div>
        <button onClick={nextMonth} style={{ padding: '7px 14px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 16, color: '#374151' }}>→</button>
        <button onClick={() => { setYear(now.getFullYear()); setMonth(now.getMonth()) }} style={{ padding: '7px 14px', border: '1px solid #1D9E75', borderRadius: 8, background: '#E1F5EE', cursor: 'pointer', fontSize: 12, color: '#0F6E56', fontWeight: 600 }}>Danas</button>
      </div>

      {/* Legenda */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        {[['pending', 'Na čekanju'], ['confirmed', 'Potvrđeno'], ['issued', 'Izdato'], ['closed', 'Zatvoreno']].map(([status, label]) => {
          const sc = STATUS_COLORS[status]
          return (
            <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#6b7280' }}>
              <div style={{ width: 12, height: 12, borderRadius: 2, background: sc.bg, border: `1.5px solid ${sc.border}` }} />
              {label}
            </div>
          )
        })}
        {view === 'by-date' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#6b7280' }}>
              <span>↑</span> Preuzimanje
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#6b7280' }}>
              <span>↓</span> Vraćanje
            </div>
          </>
        )}
      </div>

      {/* Kalendar */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af', fontSize: 13 }}>Učitavanje...</div>
        ) : view === 'by-vehicle' ? renderByVehicle() : renderByDate()}
      </div>

      {/* Detalji rezervacije (modal) */}
      {selectedRes && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: '24px', maxWidth: 520, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 17, color: '#111' }}>{selectedRes.guest_name}</div>
                <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{selectedRes.ref_code}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {!editMode && (
                  <button onClick={() => { setEditMode(true); setEditForm({ guest_name: selectedRes.guest_name, guest_email: selectedRes.guest_email, guest_phone: selectedRes.guest_phone, pickup_date: selectedRes.pickup_date, return_date: selectedRes.return_date, pickup_time: selectedRes.pickup_time, return_time: selectedRes.return_time, pickup_location: selectedRes.pickup_location, notes: selectedRes.notes, total_price: selectedRes.total_price }) }}
                    style={{ padding: '5px 12px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', cursor: 'pointer', color: '#374151' }}>
                    Uredi
                  </button>
                )}
                <button onClick={() => { setSelectedRes(null); setEditMode(false) }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#9ca3af' }}>✕</button>
              </div>
            </div>

            {!editMode ? (
              <>
                {[
                  ['Vozilo', selectedRes.vehicles?.name],
                  ['Email', selectedRes.guest_email],
                  ['Telefon', selectedRes.guest_phone],
                  ['Preuzimanje', `${selectedRes.pickup_date} u ${selectedRes.pickup_time?.slice(0,5) || '10:00'}`],
                  ['Vraćanje', `${selectedRes.return_date} u ${selectedRes.return_time?.slice(0,5) || '10:00'}`],
                  ['Lokacija', selectedRes.pickup_location],
                  ['Iznos', `${selectedRes.total_price}€`],
                  ['Status', selectedRes.status],
                  ['Napomena', selectedRes.notes],
                ].filter(([, v]) => v).map(([l, v]) => (
                  <div key={l as string} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
                    <span style={{ color: '#9ca3af' }}>{l}</span>
                    <span style={{ color: '#111', fontWeight: 500, textAlign: 'right', maxWidth: 280 }}>{v}</span>
                  </div>
                ))}
              </>
            ) : (
              <div>
                {[
                  { label: 'Ime gosta', key: 'guest_name', type: 'text' },
                  { label: 'Email', key: 'guest_email', type: 'email' },
                  { label: 'Telefon', key: 'guest_phone', type: 'text' },
                  { label: 'Datum preuzimanja', key: 'pickup_date', type: 'date' },
                  { label: 'Vrijeme preuzimanja', key: 'pickup_time', type: 'time' },
                  { label: 'Datum vraćanja', key: 'return_date', type: 'date' },
                  { label: 'Vrijeme vraćanja', key: 'return_time', type: 'time' },
                  { label: 'Lokacija', key: 'pickup_location', type: 'text' },
                  { label: 'Ukupan iznos (€)', key: 'total_price', type: 'number' },
                ].map(f => (
                  <div key={f.key} style={{ marginBottom: 10 }}>
                    <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 3 }}>{f.label}</label>
                    <input type={f.type} value={String((editForm as any)[f.key] || '')}
                      onChange={e => setEditForm(ef => ({ ...ef, [f.key]: f.type === 'number' ? parseFloat(e.target.value) : e.target.value }))}
                      style={{ width: '100%', padding: '8px 12px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, color: '#111', boxSizing: 'border-box' as const }} />
                  </div>
                ))}
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 3 }}>Napomena</label>
                  <textarea value={String(editForm.notes || '')} onChange={e => setEditForm(ef => ({ ...ef, notes: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, minHeight: 60, resize: 'vertical' as const, color: '#111', boxSizing: 'border-box' as const }} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={saveEdit} disabled={editSaving}
                    style={{ flex: 2, padding: '10px', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                    {editSaving ? '...' : 'Sačuvaj izmjene'}
                  </button>
                  <button onClick={() => setEditMode(false)} style={{ flex: 1, padding: '10px', border: '1px solid #d1d5db', borderRadius: 8, background: 'transparent', fontSize: 13, cursor: 'pointer', color: '#374151' }}>
                    Odustani
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
