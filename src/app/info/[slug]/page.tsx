'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useParams } from 'next/navigation'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type InfoPage = {
  id: string
  partner_id: string
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

export default function GuestInfoPage() {
  const params = useParams()
  const slug = params?.slug as string
  const [page, setPage] = useState<InfoPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [wifiVisible, setWifiVisible] = useState(false)

  useEffect(() => {
    if (!slug) return
    fetchPage()
  }, [slug])

  async function fetchPage() {
    const { data } = await supabase
      .from('partner_info_pages')
      .select('*')
      .eq('slug', slug)
      .eq('is_published', true)
      .single()

    if (!data) { setNotFound(true); setLoading(false); return }

    if (data.is_redirect && data.redirect_url) {
      window.location.href = data.redirect_url
      return
    }

    setPage(data)
    setLoading(false)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafaf8' }}>
      <div style={{ width: 32, height: 32, border: '2px solid #e5e7eb', borderTop: '2px solid #1D9E75', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  if (notFound) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#fafaf8', padding: 24 }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🏠</div>
      <div style={{ fontSize: 20, fontWeight: 600, color: '#111', marginBottom: 8 }}>Stranica nije pronađena</div>
      <div style={{ fontSize: 14, color: '#9ca3af' }}>Provjerite da li je link ispravan.</div>
    </div>
  )

  if (!page) return null

  const sections = Array.isArray(page.custom_sections) ? page.custom_sections : []

  return (
    <div style={{ minHeight: '100vh', background: '#fafaf8', fontFamily: "'Georgia', serif" }}>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #0e2d5e 0%, #1a4a8a 100%)', padding: '32px 24px 48px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.05) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(74,144,217,0.15) 0%, transparent 40%)' }} />
        {page.logo_url && (
          <div style={{ marginBottom: 16, position: 'relative' }}>
            <img src={page.logo_url} alt="Logo" style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '3px solid rgba(255,255,255,0.3)', margin: '0 auto' }} />
          </div>
        )}
        <div style={{ fontSize: 26, fontWeight: 700, color: '#fff', marginBottom: 6, position: 'relative', letterSpacing: '-0.5px' }}>
          {page.property_name || 'Dobrodošli'}
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', letterSpacing: 2, textTransform: 'uppercase', position: 'relative' }}>
          Vodič za goste
        </div>
      </div>

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '0 16px 40px', marginTop: -20 }}>

        {/* Welcome card */}
        {page.welcome_message && (
          <div style={{ background: '#fff', borderRadius: 16, padding: '20px 22px', marginBottom: 16, boxShadow: '0 2px 20px rgba(0,0,0,0.06)', border: '1px solid #f0f0f0' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#1D9E75', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>Dobrodošlica</div>
            <div style={{ fontSize: 15, color: '#374151', lineHeight: 1.7, fontStyle: 'italic' }}>{page.welcome_message}</div>
          </div>
        )}

        {/* Check-in / Check-out */}
        {(page.checkin_time || page.checkout_time) && (
          <div style={{ background: '#fff', borderRadius: 16, padding: '20px 22px', marginBottom: 16, boxShadow: '0 2px 20px rgba(0,0,0,0.06)', border: '1px solid #f0f0f0' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#1D9E75', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14 }}>Dolazak & Odlazak</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {page.checkin_time && (
                <div style={{ background: '#f0fdf8', borderRadius: 10, padding: '14px', textAlign: 'center' }}>
                  <div style={{ fontSize: 22 }}>🔑</div>
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 6, marginBottom: 4 }}>Check-in</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#085041' }}>{page.checkin_time}</div>
                </div>
              )}
              {page.checkout_time && (
                <div style={{ background: '#fef9f0', borderRadius: 10, padding: '14px', textAlign: 'center' }}>
                  <div style={{ fontSize: 22 }}>🧳</div>
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 6, marginBottom: 4 }}>Check-out</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#854F0B' }}>{page.checkout_time}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* WiFi */}
        {(page.wifi_name || page.wifi_password) && (
          <div style={{ background: '#fff', borderRadius: 16, padding: '20px 22px', marginBottom: 16, boxShadow: '0 2px 20px rgba(0,0,0,0.06)', border: '1px solid #f0f0f0' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#1D9E75', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14 }}>WiFi</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {page.wifi_name && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: '#6b7280' }}>Mreža</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#111', fontFamily: 'monospace', background: '#f3f4f6', padding: '4px 10px', borderRadius: 6 }}>{page.wifi_name}</span>
                </div>
              )}
              {page.wifi_password && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: '#6b7280' }}>Lozinka</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#111', fontFamily: 'monospace', background: '#f3f4f6', padding: '4px 10px', borderRadius: 6, letterSpacing: wifiVisible ? 1 : 3 }}>
                      {wifiVisible ? page.wifi_password : '••••••••'}
                    </span>
                    <button onClick={() => setWifiVisible(!wifiVisible)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: 0 }}>
                      {wifiVisible ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Parking */}
        {page.parking_info && (
          <div style={{ background: '#fff', borderRadius: 16, padding: '20px 22px', marginBottom: 16, boxShadow: '0 2px 20px rgba(0,0,0,0.06)', border: '1px solid #f0f0f0' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#1D9E75', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>🚗 Parking</div>
            <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.7 }}>{page.parking_info}</div>
          </div>
        )}

        {/* Kontakt */}
        {(page.phone || page.email || page.address) && (
          <div style={{ background: '#fff', borderRadius: 16, padding: '20px 22px', marginBottom: 16, boxShadow: '0 2px 20px rgba(0,0,0,0.06)', border: '1px solid #f0f0f0' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#1D9E75', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14 }}>Kontakt</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {page.phone && (
                <a href={`tel:${page.phone}`} style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
                  <div style={{ width: 36, height: 36, background: '#f0fdf8', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>📞</div>
                  <span style={{ fontSize: 14, color: '#1a56a0', fontWeight: 500 }}>{page.phone}</span>
                </a>
              )}
              {page.email && (
                <a href={`mailto:${page.email}`} style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
                  <div style={{ width: 36, height: 36, background: '#f0fdf8', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>✉️</div>
                  <span style={{ fontSize: 14, color: '#1a56a0', fontWeight: 500 }}>{page.email}</span>
                </a>
              )}
              {page.address && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ width: 36, height: 36, background: '#f0fdf8', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>📍</div>
                  <span style={{ fontSize: 14, color: '#374151', lineHeight: 1.5, paddingTop: 8 }}>{page.address}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Custom sekcije */}
        {sections.map((s, i) => (
          <div key={i} style={{ background: '#fff', borderRadius: 16, padding: '20px 22px', marginBottom: 16, boxShadow: '0 2px 20px rgba(0,0,0,0.06)', border: '1px solid #f0f0f0' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#1D9E75', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>{s.title}</div>
            <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{s.content}</div>
          </div>
        ))}

        {/* AdriaDrive promo */}
        <div style={{ background: 'linear-gradient(135deg, #0e2d5e, #1a4a8a)', borderRadius: 16, padding: '20px 22px', marginTop: 8, textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>Ekskluzivni popust za goste</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 4 }}>Iznajmite auto uz poseban popust</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 16 }}>Bez depozita · Plaćanje pri preuzimanju</div>
          <a href="/" style={{ display: 'inline-block', padding: '10px 24px', background: '#1D9E75', color: '#fff', textDecoration: 'none', borderRadius: 8, fontWeight: 600, fontSize: 14 }}>
            Rezervišite vozilo →
          </a>
        </div>

      </div>
    </div>
  )
}
