'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams } from 'next/navigation'

export default function OutdoorPage() {
  const params = useParams()
  const slug = params?.slug as string
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!slug) return
    fetchPage()
  }, [slug])

  async function fetchPage() {
    const { data } = await supabase
      .from('partner_outdoor_pages')
      .select('*')
      .eq('slug', slug)
      .single()

    if (!data) { setNotFound(true); setLoading(false); return }

    if (data.redirect_url) {
      let url = data.redirect_url
      if (!url.startsWith('http')) url = 'https://' + url
      window.location.href = url
      return
    }

    setLoading(false)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a1628' }}>
      <div style={{ width: 32, height: 32, border: '2px solid #1a4a8a', borderTop: '2px solid #1D9E75', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  if (notFound) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0a1628', padding: 24 }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🏔️</div>
      <div style={{ fontSize: 20, fontWeight: 600, color: '#fff', marginBottom: 8 }}>Stranica nije pronađena</div>
      <div style={{ fontSize: 14, color: '#9ca3af' }}>Provjerite da li je link ispravan.</div>
    </div>
  )

  const activities = [
    { emoji: '🏄', title: 'Surfanje & Jet ski', desc: 'Ada Bojana, Velika plaža — najduže pješčane plaže na Jadranu, idealne za vodene sportove.' },
    { emoji: '🚵', title: 'MTB & Biciklizam', desc: 'Staze kroz Durmitor, Bjelasicu i Prokletije za sve nivoe — od laganih vožnji do ekstremnih spustova.' },
    { emoji: '🧗', title: 'Penjanje', desc: 'Kanjon Tare i Morača nude izvanredne stijene za sportsko i alpinističko penjanje.' },
    { emoji: '🛶', title: 'Kajak & Rafting', desc: 'Rijeka Tara — najduži kanjon u Evropi. Rafting rute od divljine do laganih obiteljskih tura.' },
    { emoji: '🥾', title: 'Planinarenje', desc: 'Durmitor, Lovćen, Prokletije — stotine markisanih staza s pogledom koji oduzima dah.' },
    { emoji: '🪂', title: 'Paraglajding', desc: 'Let iznad Budve i Kotorskog zaljeva — nezaboravno iskustvo s pogledom na cijelu obalu.' },
    { emoji: '🐬', title: 'Ronjenje', desc: 'Bogat podvodni svijet Jadrana — olupine, grebeni, špilje i raznolik morski život.' },
    { emoji: '🏇', title: 'Jahanje', desc: 'Jahanje kroz crnogorsko primorje i planinske livade — dostupno za početnike i iskusne jahače.' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#0a1628', fontFamily: 'Arial, sans-serif' }}>

      {/* Hero */}
      <div style={{ background: 'linear-gradient(160deg, #0a1628 0%, #0e2d5e 50%, #1a4a8a 100%)', padding: '40px 24px 32px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle at 80% 20%, rgba(29,158,117,0.15) 0%, transparent 50%), radial-gradient(circle at 20% 80%, rgba(74,144,217,0.1) 0%, transparent 40%)' }} />
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🏔️</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#fff', marginBottom: 6, letterSpacing: '-0.5px' }}>
            Outdoor Crna Gora
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}>
            Avantura na svakom koraku
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
            {['Planine', 'More', 'Rijeke', 'Kanjoni'].map(t => (
              <span key={t} style={{ fontSize: 12, background: 'rgba(29,158,117,0.2)', color: '#5DCAA5', padding: '4px 12px', borderRadius: 20, border: '1px solid rgba(29,158,117,0.3)' }}>{t}</span>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '20px 16px 40px' }}>

        {/* Intro */}
        <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: '18px 20px', marginBottom: 20, border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', lineHeight: 1.7, fontStyle: 'italic' }}>
            Crna Gora — zemlja koja na svega nekoliko sati vožnje nudi i kristalno more i snijegom pokrivene planinske vrhove. Idealna destinacija za outdoor entuzijaste.
          </div>
        </div>

        {/* Aktivnosti */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
          {activities.map((a, i) => (
            <div key={i} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '14px', border: '1px solid rgba(255,255,255,0.07)', transition: 'all 0.2s' }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>{a.emoji}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 6 }}>{a.title}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>{a.desc}</div>
            </div>
          ))}
        </div>

        {/* Sezona */}
        <div style={{ background: 'rgba(29,158,117,0.1)', borderRadius: 16, padding: '18px 20px', marginBottom: 20, border: '1px solid rgba(29,158,117,0.2)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#5DCAA5', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>Sezona aktivnosti</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {[
              { s: 'Proljeće', m: 'Mar–Maj', act: 'Pješačenje, Biciklizam', c: '#5DCAA5' },
              { s: 'Ljeto', m: 'Jun–Avg', act: 'Vodni sportovi, Penjanje', c: '#4a90d9' },
              { s: 'Jesen', m: 'Sep–Nov', act: 'Rafting, Jahanje', c: '#EF9F27' },
              { s: 'Zima', m: 'Dec–Feb', act: 'Skijanje, Snježni походи', c: '#a8c8f0' },
            ].map((s, i) => (
              <div key={i} style={{ textAlign: 'center', background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '10px 6px' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: s.c, marginBottom: 3 }}>{s.s}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>{s.m}</div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', lineHeight: 1.4 }}>{s.act}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Rent a car promo */}
        <div style={{ background: 'linear-gradient(135deg, #0e2d5e, #1a4a8a)', borderRadius: 16, padding: '20px 22px', textAlign: 'center', border: '1px solid rgba(74,144,217,0.3)' }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 6 }}>Istražite sve bez granica</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 4 }}>Iznajmite auto uz poseban popust</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 16 }}>Dostava na vašu adresu · Bez depozita · Povrat na bilo koju lokaciju</div>
          <a href="/" style={{ display: 'inline-block', padding: '10px 24px', background: '#1D9E75', color: '#fff', textDecoration: 'none', borderRadius: 8, fontWeight: 600, fontSize: 14 }}>
            Rezervišite vozilo
          </a>
        </div>

      </div>
    </div>
  )
}
