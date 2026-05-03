'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

type InfoPage = {
  id: string
  slug: string
  is_redirect: boolean
  redirect_url: string | null
  logo_url: string | null
  property_name: string | null
  welcome_message: string | null
  wifi_name: string | null
  wifi_password: string | null
  checkin_time: string | null
  checkout_time: string | null
  parking_info: string | null
  address: string | null
  phone: string | null
  email: string | null
  custom_sections: { title: string; content: string }[]
  is_published: boolean
}

function getCookie(name: string): string {
  if (typeof document === 'undefined') return ''
  const match = document.cookie.match(new RegExp(`${name}=([^;]+)`))
  return match ? decodeURIComponent(match[1]) : ''
}

export default function PartnerInfoEditor() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const [partnerId, setPartnerId] = useState('')
  const [page, setPage] = useState<InfoPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState<Partial<InfoPage>>({})
  const [customSections, setCustomSections] = useState<{ title: string; content: string }[]>([])

  const siteUrl = typeof window !== 'undefined' ? window.location.origin : 'https://rent-cars.me'

  useEffect(() => {
    const pid = getCookie('avtorent-partner-id')
    if (!pid) { window.location.href = '/partner/login'; return }
    setPartnerId(pid)
    fetchPage(pid)
  }, [])

  async function fetchPage(pid: string) {
    const { data } = await supabase
      .from('partner_info_pages')
      .select('*')
      .eq('partner_id', pid)
      .single()

    if (data) {
      setPage(data)
      setForm(data)
      setCustomSections(Array.isArray(data.custom_sections) ? data.custom_sections : [])
    }
    setLoading(false)
  }

  async function savePage() {
    if (!page) return
    setSaving(true)
    await supabase.from('partner_info_pages').update({
      ...form,
      custom_sections: customSections,
      updated_at: new Date().toISOString(),
    }).eq('id', page.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  function addSection() {
    setCustomSections([...customSections, { title: '', content: '' }])
  }

  function updateSection(i: number, field: 'title' | 'content', value: string) {
    const updated = [...customSections]
    updated[i][field] = value
    setCustomSections(updated)
  }

  function removeSection(i: number) {
    setCustomSections(customSections.filter((_, idx) => idx !== i))
  }

  const inp = { width: '100%', padding: '9px 12px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', color: '#111', boxSizing: 'border-box' as const }
  const lbl = { fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }
  const section = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '20px', marginBottom: 16 }

  if (loading) return (
    <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Učitavanje...</div>
  )

  if (!page) return (
    <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>
      Info stranica nije pronađena. Kontaktirajte administratora.
    </div>
  )

  const pageUrl = `${siteUrl}/info/${page.slug}`

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 0 40px' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#111' }}>Moja info stranica</div>
          <a href={pageUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#1D9E75', textDecoration: 'none' }}>{pageUrl} ↗</a>
      </div>
      {/* QR kod za info stranicu */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 16px', marginBottom: 20 }}>
        <img
          src={`https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=${encodeURIComponent(pageUrl)}&format=png`}
          alt="QR kod info stranice"
          style={{ width: 70, height: 70, flexShrink: 0 }}
        />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#111', marginBottom: 4 }}>QR kod vaše info stranice</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 10 }}>Stavite ovaj kod na flajer — gosti ga skeniraju i odmah vide sve informacije.</div>
          <div style={{ display: 'flex', gap: 8 }}>
            
              href={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(pageUrl)}&format=png`}
              download={`QR-info-${page.slug}.png`}
              target="_blank"
              rel="noreferrer"
              style={{ padding: '6px 14px', border: '1px solid #1D9E75', borderRadius: 6, background: '#E1F5EE', fontSize: 12, color: '#085041', fontWeight: 500, textDecoration: 'none' }}
            >
              Preuzmi PNG
            </a>
            <button
              onClick={() => {
                const win = window.open('', '_blank')
                if (!win) return
                win.document.write(`<html><head><title>QR - Info stranica</title><style>body{font-family:Arial;text-align:center;padding:40px}.name{font-size:18px;font-weight:bold;margin-top:12px}.url{font-size:11px;color:#999;margin-top:6px}</style></head><body><img src="https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(pageUrl)}&format=png" width="300" height="300" /><div class="name">${page.property_name || 'Info stranica'}</div><div class="url">${pageUrl}</div><script>window.onload=function(){window.print()}<\/script></body></html>`)
              }}
              style={{ padding: '6px 14px', border: '1px solid #185FA5', borderRadius: 6, background: '#E6F1FB', fontSize: 12, color: '#185FA5', fontWeight: 500, cursor: 'pointer' }}
            >
              Štampaj
            </button>
          </div>
        </div>
        </div>
        <button
          onClick={savePage}
          disabled={saving}
          style={{ padding: '9px 20px', background: saved ? '#1D9E75' : saving ? '#5DCAA5' : '#0e2d5e', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          {saved ? '✓ Sačuvano' : saving ? 'Snimanje...' : 'Sačuvaj'}
        </button>
      </div>

      {/* Redirect opcija */}
      <div style={{ ...section, background: form.is_redirect ? '#fef9f0' : '#fff', border: `1px solid ${form.is_redirect ? '#EF9F27' : '#e5e7eb'}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: form.is_redirect ? 14 : 0 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>Preusmjeri na drugu stranicu</div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>Ako imate vlastitu stranicu za goste, aktivirajte ovu opciju</div>
          </div>
          <button
            onClick={() => setForm(f => ({ ...f, is_redirect: !f.is_redirect }))}
            style={{
              width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
              background: form.is_redirect ? '#1D9E75' : '#d1d5db',
              position: 'relative', transition: 'background 0.2s', flexShrink: 0
            }}
          >
            <div style={{
              width: 18, height: 18, borderRadius: '50%', background: '#fff',
              position: 'absolute', top: 3, transition: 'left 0.2s',
              left: form.is_redirect ? 23 : 3,
            }} />
          </button>
        </div>
        {form.is_redirect && (
          <div>
            <label style={lbl}>URL vaše stranice</label>
            <input style={inp} value={form.redirect_url || ''} onChange={e => setForm(f => ({ ...f, redirect_url: e.target.value }))} placeholder="https://vasa-stranica.com/gosti" />
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>Gosti koji skeniraju QR kod će biti automatski preusmjereni na ovaj link.</div>
          </div>
        )}
      </div>

      {/* Osnovno */}
      {!form.is_redirect && (
        <>
          <div style={section}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 14 }}>Osnovno</div>
            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Naziv smještaja</label>
              <input style={inp} value={form.property_name || ''} onChange={e => setForm(f => ({ ...f, property_name: e.target.value }))} placeholder="Vila Jadran" />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Logo URL</label>
              <input style={inp} value={form.logo_url || ''} onChange={e => setForm(f => ({ ...f, logo_url: e.target.value }))} placeholder="https://link-do-vašeg-loga.com/logo.png" />
              {form.logo_url && (
                <img src={form.logo_url} alt="Logo preview" style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 8, marginTop: 8, border: '1px solid #e5e7eb' }} onError={e => (e.currentTarget.style.display = 'none')} />
              )}
            </div>
            <div>
              <label style={lbl}>Poruka dobrodošlice</label>
              <textarea style={{ ...inp, height: 80, resize: 'vertical' }} value={form.welcome_message || ''} onChange={e => setForm(f => ({ ...f, welcome_message: e.target.value }))} placeholder="Dragi gosti, dobrodošli u našu vilu..." />
            </div>
          </div>

          {/* Check-in/out */}
          <div style={section}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 14 }}>Dolazak & Odlazak</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={lbl}>Check-in od</label>
                <input style={inp} value={form.checkin_time || ''} onChange={e => setForm(f => ({ ...f, checkin_time: e.target.value }))} placeholder="14:00" />
              </div>
              <div>
                <label style={lbl}>Check-out do</label>
                <input style={inp} value={form.checkout_time || ''} onChange={e => setForm(f => ({ ...f, checkout_time: e.target.value }))} placeholder="11:00" />
              </div>
            </div>
          </div>

          {/* WiFi */}
          <div style={section}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 14 }}>WiFi</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={lbl}>Naziv mreže</label>
                <input style={inp} value={form.wifi_name || ''} onChange={e => setForm(f => ({ ...f, wifi_name: e.target.value }))} placeholder="Vila_Jadran_WiFi" />
              </div>
              <div>
                <label style={lbl}>Lozinka</label>
                <input style={inp} value={form.wifi_password || ''} onChange={e => setForm(f => ({ ...f, wifi_password: e.target.value }))} placeholder="lozinka123" />
              </div>
            </div>
          </div>

          {/* Parking */}
          <div style={section}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 14 }}>Parking</div>
            <textarea style={{ ...inp, height: 70, resize: 'vertical' }} value={form.parking_info || ''} onChange={e => setForm(f => ({ ...f, parking_info: e.target.value }))} placeholder="Slobodan parking ispred objekta. Kapija se otvara automatski." />
          </div>

          {/* Kontakt */}
          <div style={section}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 14 }}>Kontakt</div>
            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Telefon</label>
              <input style={inp} value={form.phone || ''} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+382 67 111 222" />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Email</label>
              <input style={inp} value={form.email || ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="info@vila-jadran.com" />
            </div>
            <div>
              <label style={lbl}>Adresa</label>
              <input style={inp} value={form.address || ''} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Ul. Mediteranska 5, Budva" />
            </div>
          </div>

          {/* Custom sekcije */}
          <div style={section}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Dodatne sekcije</div>
              <button onClick={addSection} style={{ padding: '5px 12px', fontSize: 12, background: '#E1F5EE', color: '#085041', border: '1px solid #5DCAA5', borderRadius: 6, cursor: 'pointer', fontWeight: 500 }}>
                + Dodaj sekciju
              </button>
            </div>
            {customSections.length === 0 && (
              <div style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', padding: '16px 0' }}>
                Dodajte vlastite sekcije — preporuke restorana, plaže, pravila kuće, i sl.
              </div>
            )}
            {customSections.map((s, i) => (
              <div key={i} style={{ background: '#f9fafb', borderRadius: 8, padding: 14, marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <input
                    style={{ ...inp, fontWeight: 600, fontSize: 13 }}
                    value={s.title}
                    onChange={e => updateSection(i, 'title', e.target.value)}
                    placeholder="Naziv sekcije (npr. Preporuke restorana)"
                  />
                  <button onClick={() => removeSection(i)} style={{ marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 18, flexShrink: 0 }}>✕</button>
                </div>
                <textarea
                  style={{ ...inp, height: 90, resize: 'vertical' }}
                  value={s.content}
                  onChange={e => updateSection(i, 'content', e.target.value)}
                  placeholder="Sadržaj sekcije..."
                />
              </div>
            ))}
          </div>

          {/* Objavi / Sakrij */}
          <div style={{ ...section, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>Stranica je {form.is_published ? 'objavljena' : 'skrivena'}</div>
              <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{form.is_published ? 'Gosti mogu pristupiti vašoj stranici' : 'Stranica nije vidljiva gostima'}</div>
            </div>
            <button
              onClick={() => setForm(f => ({ ...f, is_published: !f.is_published }))}
              style={{
                width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                background: form.is_published ? '#1D9E75' : '#d1d5db',
                position: 'relative', transition: 'background 0.2s',
              }}
            >
              <div style={{
                width: 18, height: 18, borderRadius: '50%', background: '#fff',
                position: 'absolute', top: 3, transition: 'left 0.2s',
                left: form.is_published ? 23 : 3,
              }} />
            </button>
          </div>
        </>
      )}

      {/* Dugme sačuvaj dno */}
      <button
        onClick={savePage}
        disabled={saving}
        style={{ width: '100%', padding: 12, background: saved ? '#1D9E75' : saving ? '#5DCAA5' : '#0e2d5e', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
      >
        {saved ? '✓ Sačuvano' : saving ? 'Snimanje...' : 'Sačuvaj izmjene'}
      </button>
    </div>
  )
}
