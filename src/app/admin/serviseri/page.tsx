'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Technician = {
  id: string; full_name: string; phone: string | null
  portal_email: string | null; is_active: boolean
  bonus_per_service: number; bonus_per_repair: number
  salary: number; notes: string | null; created_at: string
}

export default function ServiseriPage() {
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editTech, setEditTech] = useState<Technician | null>(null)
  const [saving, setSaving] = useState(false)

  const emptyForm = {
    full_name: '', phone: '', portal_email: '',
    is_active: true, bonus_per_service: '', bonus_per_repair: '', salary: '', notes: ''
  }
  const [form, setForm] = useState<any>(emptyForm)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const { data } = await supabase.from('technicians').select('*').order('full_name')
    setTechnicians(data || [])
    setLoading(false)
  }

  function openEdit(t: Technician) {
    setEditTech(t)
    setForm({
      full_name: t.full_name, phone: t.phone || '', portal_email: t.portal_email || '',
      is_active: t.is_active, bonus_per_service: t.bonus_per_service || '',
      bonus_per_repair: t.bonus_per_repair || '', salary: t.salary || '', notes: t.notes || ''
    })
    setShowForm(true)
  }

  async function handleSave() {
    if (!form.full_name) return
    setSaving(true)
    const payload = {
      full_name: form.full_name,
      phone: form.phone || null,
      portal_email: form.portal_email?.toLowerCase() || null,
      is_active: form.is_active,
      bonus_per_service: parseFloat(form.bonus_per_service || '0'),
      bonus_per_repair: parseFloat(form.bonus_per_repair || '0'),
      salary: parseFloat(form.salary || '0'),
      notes: form.notes || null,
    }
    if (editTech) {
      await supabase.from('technicians').update(payload).eq('id', editTech.id)
    } else {
      await supabase.from('technicians').insert(payload)
    }
    setSaving(false)
    setShowForm(false)
    setEditTech(null)
    setForm(emptyForm)
    fetchData()
  }

  async function toggleActive(id: string, current: boolean) {
    await supabase.from('technicians').update({ is_active: !current }).eq('id', id)
    fetchData()
  }

  const inp = { width: '100%', padding: '9px 12px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, color: '#111', background: '#fff', boxSizing: 'border-box' as const }
  const lbl = { fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 } as const

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: '#111' }}>Serviseri</h1>
        <button onClick={() => { setEditTech(null); setForm(emptyForm); setShowForm(true) }}
          style={{ padding: '8px 16px', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          + Dodaj servisera
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: showForm ? '1fr 360px' : '1fr', gap: 20 }}>
        {/* Lista */}
        <div>
          {loading ? <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>Učitavanje...</div> :
            technicians.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af', background: '#fff', borderRadius: 12, border: '1px dashed #e5e7eb' }}>
                Nema servisera. Dodaj prvog servisera.
              </div>
            ) : technicians.map(t => (
              <div key={t.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '16px 18px', marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15, color: '#111', display: 'flex', alignItems: 'center', gap: 8 }}>
                      {t.full_name}
                      <span style={{ fontSize: 11, background: t.is_active ? '#E1F5EE' : '#f3f4f6', color: t.is_active ? '#085041' : '#9ca3af', padding: '2px 8px', borderRadius: 20, fontWeight: 500 }}>
                        {t.is_active ? 'Aktivan' : 'Neaktivan'}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4, display: 'flex', gap: 12 }}>
                      {t.phone && <span>📞 {t.phone}</span>}
                      {t.portal_email && <span>✉ {t.portal_email}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => openEdit(t)}
                      style={{ padding: '5px 12px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, background: 'transparent', cursor: 'pointer', color: '#374151' }}>
                      Uredi
                    </button>
                    <button onClick={() => toggleActive(t.id, t.is_active)}
                      style={{ padding: '5px 12px', fontSize: 12, border: `1px solid ${t.is_active ? '#fecaca' : '#d1d5db'}`, borderRadius: 6, background: 'transparent', cursor: 'pointer', color: t.is_active ? '#dc2626' : '#6b7280' }}>
                      {t.is_active ? 'Deaktiviraj' : 'Aktiviraj'}
                    </button>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 14 }}>
                  {[
                    { label: 'Fiksna plata', value: `${t.salary || 0}€` },
                    { label: 'Bonus/servis', value: `${t.bonus_per_service || 0}€` },
                    { label: 'Bonus/popravka', value: `${t.bonus_per_repair || 0}€` },
                  ].map(m => (
                    <div key={m.label} style={{ background: '#f9fafb', borderRadius: 8, padding: '8px 12px' }}>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>{m.label}</div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: '#1D9E75' }}>{m.value}</div>
                    </div>
                  ))}
                </div>
                {t.notes && <div style={{ marginTop: 10, fontSize: 12, color: '#6b7280', fontStyle: 'italic' }}>{t.notes}</div>}
                {t.portal_email && (
                  <div style={{ marginTop: 10, fontSize: 12, color: '#185FA5' }}>
                    Portal: <a href="/serviser/login" target="_blank" style={{ color: '#185FA5' }}>rent-cars.me/serviser/login</a>
                  </div>
                )}
              </div>
            ))
          }
        </div>

        {/* Forma */}
        {showForm && (
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, alignSelf: 'start' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#111' }}>{editTech ? 'Uredi servisera' : 'Novi serviser'}</div>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#9ca3af' }}>✕</button>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Ime i prezime *</label>
              <input value={form.full_name} onChange={e => setForm((f: any) => ({ ...f, full_name: e.target.value }))} placeholder="Marko Marković" style={inp} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Telefon</label>
              <input value={form.phone} onChange={e => setForm((f: any) => ({ ...f, phone: e.target.value }))} placeholder="+382 69 123 456" style={inp} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={lbl}>Email za portal (prijava)</label>
              <input type="email" value={form.portal_email} onChange={e => setForm((f: any) => ({ ...f, portal_email: e.target.value }))} placeholder="serviser@email.com" style={inp} />
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>Na ovaj email će stizati link za prijavu na serviser portal</div>
            </div>

            <div style={{ background: '#f9fafb', borderRadius: 8, padding: '14px', marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 10 }}>Plata i bonusi</div>
              <div style={{ marginBottom: 10 }}>
                <label style={lbl}>Fiksna plata (€/mjesec)</label>
                <input type="number" step="0.01" value={form.salary} onChange={e => setForm((f: any) => ({ ...f, salary: e.target.value }))} placeholder="0.00" style={inp} />
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={lbl}>Bonus po servisu (€)</label>
                <input type="number" step="0.01" value={form.bonus_per_service} onChange={e => setForm((f: any) => ({ ...f, bonus_per_service: e.target.value }))} placeholder="0.00" style={inp} />
              </div>
              <div style={{ marginBottom: 0 }}>
                <label style={lbl}>Bonus po popravci (€)</label>
                <input type="number" step="0.01" value={form.bonus_per_repair} onChange={e => setForm((f: any) => ({ ...f, bonus_per_repair: e.target.value }))} placeholder="0.00" style={inp} />
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Napomene</label>
              <textarea value={form.notes} onChange={e => setForm((f: any) => ({ ...f, notes: e.target.value }))}
                placeholder="Opciono..." style={{ ...inp, minHeight: 60, resize: 'vertical' as const }} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
              <input type="checkbox" id="active" checked={form.is_active} onChange={e => setForm((f: any) => ({ ...f, is_active: e.target.checked }))} />
              <label htmlFor="active" style={{ fontSize: 13, cursor: 'pointer', color: '#374151' }}>Aktivan serviser</label>
            </div>

            <button onClick={handleSave} disabled={saving || !form.full_name}
              style={{ width: '100%', padding: '10px', background: !form.full_name ? '#9ca3af' : '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              {saving ? 'Snimanje...' : editTech ? 'Sačuvaj' : 'Dodaj servisera'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
