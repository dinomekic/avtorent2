'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Site = {
  id: string; domain: string; name: string; tagline: string
  primary_color: string; secondary_color: string; logo_text: string
  price_modifier: number; from_email: string | null; admin_email: string | null
  is_active: boolean; created_at: string
}

const inp: React.CSSProperties = { width: '100%', padding: '8px 12px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', color: '#111', boxSizing: 'border-box' as const }
const lbl: React.CSSProperties = { fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: 0.3 }

export default function AdminSajtovi() {
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<Partial<Site>>({})
  const [saving, setSaving] = useState(false)
  const [showNew, setShowNew] = useState(false)

  useEffect(() => { fetchSites() }, [])

  async function fetchSites() {
    setLoading(true)
    const { data } = await supabase.from('sites').select('*').order('created_at')
    setSites(data || [])
    setLoading(false)
  }

  function openEdit(s: Site) {
    setEditId(s.id)
    setForm({ ...s })
    setShowNew(false)
  }

  function openNew() {
    setEditId(null)
    setForm({ price_modifier: 1.00, is_active: true, primary_color: '#1a56a0', secondary_color: '#0e2d5e' })
    setShowNew(true)
  }

  async function save() {
    setSaving(true)
    if (editId) {
      await supabase.from('sites').update(form).eq('id', editId)
    } else {
      await supabase.from('sites').insert(form)
    }
    setSaving(false)
    setEditId(null)
    setShowNew(false)
    fetchSites()
  }

  async function toggleActive(id: string, current: boolean) {
    await supabase.from('sites').update({ is_active: !current }).eq('id', id)
    fetchSites()
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Učitavanje...</div>

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111', margin: 0 }}>Sajtovi</h1>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>Multi-domen platforma — upravljaj brendingom i cijenama po sajtu</p>
        </div>
        <button onClick={openNew} style={{ padding: '8px 16px', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>+ Novi sajt</button>
      </div>

      {/* Info banner */}
      <div style={{ background: '#E6F1FB', border: '1px solid #85B7EB', borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: '#0C447C' }}>
        <strong>Kako radi:</strong> Svaki sajt koristi iste bazične cijene iz <code>vozila_fleet</code>. Cijena na sajtu = bazična cijena × <strong>price_modifier</strong>. Npr. modifier <strong>1.15</strong> = cijene uvećane 15%.
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        {sites.map(s => {
          const isEditing = editId === s.id
          const modifier = parseFloat(String(s.price_modifier))
          const modifierLabel = modifier === 1.00 ? 'Bazična cijena' : modifier > 1 ? `+${Math.round((modifier - 1) * 100)}% provizija` : `-${Math.round((1 - modifier) * 100)}% popust`
          const modifierColor = modifier === 1.00 ? '#6b7280' : modifier > 1 ? '#dc2626' : '#1D9E75'
          const modifierBg = modifier === 1.00 ? '#f3f4f6' : modifier > 1 ? '#FCEBEB' : '#E1F5EE'

          return (
            <div key={s.id} style={{ background: '#fff', border: `1px solid ${isEditing ? '#1D9E75' : '#e5e7eb'}`, borderRadius: 12, overflow: 'hidden' }}>
              {/* Header */}
              <div style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: s.primary_color || '#1a56a0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#fff', fontWeight: 700 }}>
                    {(s.logo_text || s.name || '?')[0]}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: '#111' }}>{s.name || s.domain}</div>
                    <div style={{ fontSize: 12, color: '#9ca3af', fontFamily: 'monospace' }}>{s.domain}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, background: modifierBg, color: modifierColor, padding: '4px 12px', borderRadius: 20 }}>
                    {modifierLabel}
                  </span>
                  <button onClick={() => toggleActive(s.id, s.is_active)}
                    style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, border: 'none', cursor: 'pointer', fontWeight: 600, background: s.is_active ? '#E1F5EE' : '#f3f4f6', color: s.is_active ? '#085041' : '#9ca3af' }}>
                    {s.is_active ? '✓ Aktivan' : 'Neaktivan'}
                  </button>
                  <button onClick={() => isEditing ? setEditId(null) : openEdit(s)}
                    style={{ padding: '6px 14px', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 8, background: isEditing ? '#f3f4f6' : '#fff', cursor: 'pointer', color: '#374151' }}>
                    {isEditing ? 'Zatvori' : '✏️ Uredi'}
                  </button>
                </div>
              </div>

              {/* Quick stats */}
              {!isEditing && (
                <div style={{ padding: '0 16px 14px', display: 'flex', gap: 16, fontSize: 12, color: '#6b7280' }}>
                  {s.tagline && <span>"{s.tagline}"</span>}
                  {s.from_email && <span>✉️ {s.from_email}</span>}
                  <span style={{ color: s.primary_color }}>● {s.primary_color}</span>
                </div>
              )}

              {/* Edit forma */}
              {isEditing && (
                <div style={{ padding: '0 16px 16px', borderTop: '1px solid #f3f4f6' }}>
                  <div style={{ paddingTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={lbl}>Domen *</label>
                      <input style={inp} value={form.domain || ''} onChange={e => setForm(f => ({ ...f, domain: e.target.value }))} placeholder="rent-cars.me" />
                    </div>
                    <div>
                      <label style={lbl}>Naziv sajta</label>
                      <input style={inp} value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="AdriaDrive" />
                    </div>
                    <div>
                      <label style={lbl}>Logo tekst</label>
                      <input style={inp} value={form.logo_text || ''} onChange={e => setForm(f => ({ ...f, logo_text: e.target.value }))} placeholder="ADRIA DRIVE" />
                    </div>
                    <div>
                      <label style={lbl}>Tagline</label>
                      <input style={inp} value={form.tagline || ''} onChange={e => setForm(f => ({ ...f, tagline: e.target.value }))} placeholder="Feel the Balkans" />
                    </div>

                    {/* Price modifier — najvažnije polje */}
                    <div style={{ gridColumn: '1 / -1', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px' }}>
                      <label style={{ ...lbl, color: '#374151', fontSize: 12 }}>PRICE MODIFIER — Korekcija cijene</label>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
                        <input
                          type="number" step="0.01" min="0.5" max="3"
                          value={form.price_modifier || 1.00}
                          onChange={e => setForm(f => ({ ...f, price_modifier: parseFloat(e.target.value) || 1.00 }))}
                          style={{ ...inp, width: 120, fontSize: 18, fontWeight: 700, textAlign: 'center' as const }}
                        />
                        <div style={{ fontSize: 13, color: '#374151' }}>
                          {(() => {
                            const m = parseFloat(String(form.price_modifier || 1))
                            if (m === 1) return <span style={{ color: '#6b7280' }}>Bazična cijena (bez korekcije)</span>
                            if (m > 1) return <span style={{ color: '#dc2626', fontWeight: 700 }}>Cijene uvećane za <strong>+{Math.round((m - 1) * 100)}%</strong></span>
                            return <span style={{ color: '#1D9E75', fontWeight: 700 }}>Cijene umanjene za <strong>-{Math.round((1 - m) * 100)}%</strong></span>
                          })()}
                        </div>
                      </div>
                      {/* Brzi odabir */}
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
                        {[
                          { label: 'Bazično (1.00)', value: 1.00 },
                          { label: '+10% (1.10)', value: 1.10 },
                          { label: '+15% (1.15)', value: 1.15 },
                          { label: '+20% (1.20)', value: 1.20 },
                          { label: '+25% (1.25)', value: 1.25 },
                          { label: '-10% (0.90)', value: 0.90 },
                        ].map(opt => (
                          <button key={opt.value} onClick={() => setForm(f => ({ ...f, price_modifier: opt.value }))}
                            style={{ padding: '5px 12px', fontSize: 12, border: `1px solid ${form.price_modifier === opt.value ? '#1D9E75' : '#e5e7eb'}`, borderRadius: 20, background: form.price_modifier === opt.value ? '#E1F5EE' : '#fff', color: form.price_modifier === opt.value ? '#085041' : '#6b7280', cursor: 'pointer', fontWeight: form.price_modifier === opt.value ? 700 : 400 }}>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 8 }}>
                        Primjer: bazična cijena 50€ × {form.price_modifier || 1} = <strong>{Math.round(50 * parseFloat(String(form.price_modifier || 1)))}€</strong> na ovom sajtu
                      </div>
                    </div>

                    <div>
                      <label style={lbl}>Primarna boja</label>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input type="color" value={form.primary_color || '#1a56a0'} onChange={e => setForm(f => ({ ...f, primary_color: e.target.value }))}
                          style={{ width: 44, height: 36, padding: 2, border: '1px solid #d1d5db', borderRadius: 8, cursor: 'pointer' }} />
                        <input style={{ ...inp, fontFamily: 'monospace' }} value={form.primary_color || ''} onChange={e => setForm(f => ({ ...f, primary_color: e.target.value }))} placeholder="#1a56a0" />
                      </div>
                    </div>
                    <div>
                      <label style={lbl}>Sekundarna boja</label>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input type="color" value={form.secondary_color || '#0e2d5e'} onChange={e => setForm(f => ({ ...f, secondary_color: e.target.value }))}
                          style={{ width: 44, height: 36, padding: 2, border: '1px solid #d1d5db', borderRadius: 8, cursor: 'pointer' }} />
                        <input style={{ ...inp, fontFamily: 'monospace' }} value={form.secondary_color || ''} onChange={e => setForm(f => ({ ...f, secondary_color: e.target.value }))} placeholder="#0e2d5e" />
                      </div>
                    </div>
                    <div>
                      <label style={lbl}>Email za slanje</label>
                      <input style={inp} type="email" value={form.from_email || ''} onChange={e => setForm(f => ({ ...f, from_email: e.target.value }))} placeholder="info@rent-cars.me" />
                    </div>
                    <div>
                      <label style={lbl}>Admin email</label>
                      <input style={inp} type="email" value={form.admin_email || ''} onChange={e => setForm(f => ({ ...f, admin_email: e.target.value }))} placeholder="admin@rent-cars.me" />
                    </div>
                    <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <input type="checkbox" id={`active_${s.id}`} checked={form.is_active ?? true} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                        style={{ width: 16, height: 16, accentColor: '#1D9E75', cursor: 'pointer' }} />
                      <label htmlFor={`active_${s.id}`} style={{ fontSize: 13, color: '#374151', cursor: 'pointer' }}>Sajt aktivan</label>
                    </div>
                    <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8 }}>
                      <button onClick={save} disabled={saving}
                        style={{ flex: 2, padding: '10px', background: saving ? '#5DCAA5' : '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                        {saving ? '⏳ Snimanje...' : '💾 Sačuvaj'}
                      </button>
                      <button onClick={() => setEditId(null)}
                        style={{ flex: 1, padding: '10px', border: '1px solid #e5e7eb', borderRadius: 8, background: 'transparent', fontSize: 13, cursor: 'pointer', color: '#374151' }}>
                        Odustani
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {/* Nova forma */}
        {showNew && (
          <div style={{ background: '#fff', border: '2px solid #1D9E75', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#111', marginBottom: 14 }}>Novi sajt</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={lbl}>Domen *</label>
                <input style={inp} value={form.domain || ''} onChange={e => setForm(f => ({ ...f, domain: e.target.value }))} placeholder="novi-sajt.me" />
              </div>
              <div>
                <label style={lbl}>Naziv</label>
                <input style={inp} value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Naziv sajta" />
              </div>
              <div>
                <label style={lbl}>Logo tekst</label>
                <input style={inp} value={form.logo_text || ''} onChange={e => setForm(f => ({ ...f, logo_text: e.target.value }))} />
              </div>
              <div>
                <label style={lbl}>Tagline</label>
                <input style={inp} value={form.tagline || ''} onChange={e => setForm(f => ({ ...f, tagline: e.target.value }))} />
              </div>
              <div style={{ gridColumn: '1 / -1', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px' }}>
                <label style={{ ...lbl, color: '#374151', fontSize: 12 }}>PRICE MODIFIER</label>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
                  <input type="number" step="0.01" value={form.price_modifier || 1.00}
                    onChange={e => setForm(f => ({ ...f, price_modifier: parseFloat(e.target.value) || 1.00 }))}
                    style={{ ...inp, width: 120, fontSize: 18, fontWeight: 700, textAlign: 'center' as const }} />
                  <div style={{ fontSize: 13, color: '#374151' }}>
                    {(() => {
                      const m = parseFloat(String(form.price_modifier || 1))
                      if (m === 1) return <span style={{ color: '#6b7280' }}>Bazična cijena</span>
                      if (m > 1) return <span style={{ color: '#dc2626', fontWeight: 700 }}>+{Math.round((m - 1) * 100)}% provizija</span>
                      return <span style={{ color: '#1D9E75', fontWeight: 700 }}>-{Math.round((1 - m) * 100)}% popust</span>
                    })()}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
                  {[1.00, 1.10, 1.15, 1.20, 1.25, 0.90].map(v => (
                    <button key={v} onClick={() => setForm(f => ({ ...f, price_modifier: v }))}
                      style={{ padding: '4px 10px', fontSize: 11, border: `1px solid ${form.price_modifier === v ? '#1D9E75' : '#e5e7eb'}`, borderRadius: 16, background: form.price_modifier === v ? '#E1F5EE' : '#fff', color: form.price_modifier === v ? '#085041' : '#6b7280', cursor: 'pointer' }}>
                      {v === 1 ? 'Bazično' : v > 1 ? `+${Math.round((v - 1) * 100)}%` : `-${Math.round((1 - v) * 100)}%`}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={lbl}>Primarna boja</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="color" value={form.primary_color || '#1a56a0'} onChange={e => setForm(f => ({ ...f, primary_color: e.target.value }))}
                    style={{ width: 44, height: 36, padding: 2, border: '1px solid #d1d5db', borderRadius: 8, cursor: 'pointer' }} />
                  <input style={{ ...inp, fontFamily: 'monospace' }} value={form.primary_color || ''} onChange={e => setForm(f => ({ ...f, primary_color: e.target.value }))} />
                </div>
              </div>
              <div>
                <label style={lbl}>Sekundarna boja</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="color" value={form.secondary_color || '#0e2d5e'} onChange={e => setForm(f => ({ ...f, secondary_color: e.target.value }))}
                    style={{ width: 44, height: 36, padding: 2, border: '1px solid #d1d5db', borderRadius: 8, cursor: 'pointer' }} />
                  <input style={{ ...inp, fontFamily: 'monospace' }} value={form.secondary_color || ''} onChange={e => setForm(f => ({ ...f, secondary_color: e.target.value }))} />
                </div>
              </div>
              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8 }}>
                <button onClick={save} disabled={saving || !form.domain}
                  style={{ flex: 2, padding: '10px', background: !form.domain ? '#9ca3af' : '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                  {saving ? '⏳...' : '+ Kreiraj sajt'}
                </button>
                <button onClick={() => setShowNew(false)}
                  style={{ flex: 1, padding: '10px', border: '1px solid #e5e7eb', borderRadius: 8, background: 'transparent', fontSize: 13, cursor: 'pointer', color: '#374151' }}>
                  Odustani
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
