'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Site = {
  id: string; domain: string; name: string; tagline: string
  primary_color: string; logo_text: string; price_modifier: number
  from_email: string; admin_email: string; is_active: boolean
}

export default function AdminSajtovePage() {
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)
  const [editSite, setEditSite] = useState<Site | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const { data } = await supabase.from('sites').select('*').order('created_at')
    setSites(data || [])
    setLoading(false)
  }

  async function saveSite() {
    if (!editSite) return
    setSaving(true)
    await supabase.from('sites').update({
      name: editSite.name, tagline: editSite.tagline,
      primary_color: editSite.primary_color, logo_text: editSite.logo_text,
      price_modifier: editSite.price_modifier,
      from_email: editSite.from_email, admin_email: editSite.admin_email,
    }).eq('id', editSite.id)
    setSaving(false)
    setEditSite(null)
    fetchData()
  }

  const inp = { width: '100%', padding: '8px 12px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', color: '#111', boxSizing: 'border-box' as const }
  const lbl = { fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 600, color: '#111', marginBottom: 8 }}>Sajtovi</h1>
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 24 }}>Upravljaj brendovima i konfiguracijama po sajtu</p>

      <div style={{ display: 'grid', gridTemplateColumns: editSite ? '1fr 360px' : '1fr', gap: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {loading ? <div style={{ color: '#9ca3af', fontSize: 13 }}>Učitavanje...</div> : sites.map(s => (
            <div key={s.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '20px 24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 8, background: s.primary_color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff' }}>
                    {s.logo_text?.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#111' }}>{s.name}</div>
                    <div style={{ fontSize: 12, color: '#9ca3af' }}>{s.tagline}</div>
                    <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#6b7280', marginTop: 2 }}>{s.domain}</div>
                  </div>
                </div>
                <button onClick={() => setEditSite(s)} style={{ padding: '6px 16px', border: '1px solid #d1d5db', borderRadius: 8, background: 'transparent', fontSize: 13, cursor: 'pointer', color: '#374151' }}>
                  Uredi
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 16 }}>
                <div style={{ background: '#f9fafb', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>Modifikator cijene</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: s.price_modifier < 1 ? '#1D9E75' : '#374151' }}>
                    {s.price_modifier < 1 ? `-${Math.round((1 - s.price_modifier) * 100)}%` : 'Standardno'}
                  </div>
                </div>
                <div style={{ background: '#f9fafb', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>Primarna boja</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 16, height: 16, borderRadius: 4, background: s.primary_color, border: '1px solid #e5e7eb' }} />
                    <span style={{ fontSize: 12, fontFamily: 'monospace', color: '#374151' }}>{s.primary_color}</span>
                  </div>
                </div>
                <div style={{ background: '#f9fafb', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>Test URL</div>
                  <a href={`/?site=${s.domain}`} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#185FA5', textDecoration: 'none' }}>
                    Otvori →
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>

        {editSite && (
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, alignSelf: 'start' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#111' }}>Uredi sajt</div>
              <button onClick={() => setEditSite(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#9ca3af' }}>✕</button>
            </div>

            <div style={{ marginBottom: 10 }}><label style={lbl}>Naziv sajta</label><input style={inp} value={editSite.name} onChange={e => setEditSite(s => s ? { ...s, name: e.target.value } : null)} /></div>
            <div style={{ marginBottom: 10 }}><label style={lbl}>Logo tekst</label><input style={inp} value={editSite.logo_text} onChange={e => setEditSite(s => s ? { ...s, logo_text: e.target.value } : null)} /></div>
            <div style={{ marginBottom: 10 }}><label style={lbl}>Tagline</label><input style={inp} value={editSite.tagline} onChange={e => setEditSite(s => s ? { ...s, tagline: e.target.value } : null)} /></div>
            <div style={{ marginBottom: 10 }}>
              <label style={lbl}>Primarna boja</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="color" value={editSite.primary_color} onChange={e => setEditSite(s => s ? { ...s, primary_color: e.target.value } : null)} style={{ width: 44, height: 36, borderRadius: 8, border: '1px solid #d1d5db', cursor: 'pointer', padding: 2 }} />
                <input style={{ ...inp, flex: 1 }} value={editSite.primary_color} onChange={e => setEditSite(s => s ? { ...s, primary_color: e.target.value } : null)} placeholder="#1D9E75" />
              </div>
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={lbl}>Modifikator cijene</label>
              <input type="number" step="0.01" min="0.1" max="2" style={inp} value={editSite.price_modifier} onChange={e => setEditSite(s => s ? { ...s, price_modifier: parseFloat(e.target.value) } : null)} />
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>0.90 = -10% · 1.00 = standardno · 1.10 = +10%</div>
            </div>
            <div style={{ marginBottom: 10 }}><label style={lbl}>From email</label><input style={inp} value={editSite.from_email} onChange={e => setEditSite(s => s ? { ...s, from_email: e.target.value } : null)} /></div>
            <div style={{ marginBottom: 18 }}><label style={lbl}>Admin email</label><input style={inp} value={editSite.admin_email} onChange={e => setEditSite(s => s ? { ...s, admin_email: e.target.value } : null)} /></div>

            <button onClick={saveSite} disabled={saving} style={{ width: '100%', padding: 10, background: saving ? '#5DCAA5' : '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              {saving ? 'Snimanje...' : 'Sačuvaj'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
