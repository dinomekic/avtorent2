'use client'

import { usePathname } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'

const AGENT_NAV = [
  { href: '/agent', label: '📊 Pregled' },
  { href: '/agent/dan', label: '📅 Dnevni pregled' },
  { href: '/agent/rezervacije', label: '🚗 Rezervacije' },
  { href: '/agent/kalendar', label: '🗓 Kalendar' },
  { href: '/agent/finansije', label: '💰 Finansije' },
  { href: '/agent/moji-partneri', label: '🤝 Moji partneri' },
  { href: '/agent/pranje', label: '💦 Pranje vozila' },
  { href: '/agent/provjera', label: '🔍 Provjera vozila' },
  { href: '/agent/kvarovi', label: '⚠️ Kvarovi' },
  { href: '/agent/servis', label: '🔧 Servis' },
]

function getCookie(name: string): string {
  if (typeof document === 'undefined') return ''
  const match = document.cookie.match(new RegExp(`${name}=([^;]+)`))
  return match ? decodeURIComponent(match[1]) : ''
}

export default function AgentLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [agentName, setAgentName] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    const name = getCookie('avtorent-agent-name')
    if (!name) { window.location.href = '/admin/login'; return }
    setAgentName(name)

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // Log sesije
    supabase.from('agent_sessions').insert({ agent_name: name })
      .select().single().then(({ data: sess }) => {
        if (sess) {
          const logEnd = () => {
            const start = new Date(sess.logged_in_at).getTime()
            const minutes = Math.round((Date.now() - start) / 60000)
            navigator.sendBeacon('/api/session-end', JSON.stringify({ id: sess.id, minutes }))
          }
          window.addEventListener('beforeunload', logEnd)
        }
      })
  }, [])

  async function handleLogout() {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    await supabase.auth.signOut()
    document.cookie = 'avtorent-admin-token=; path=/; max-age=0'
    document.cookie = 'avtorent-agent-name=; path=/; max-age=0'
    window.location.href = '/admin/login'
  }

  // MOBILE LAYOUT
  if (isMobile) {
    return (
      <div style={{ minHeight: '100vh', background: '#f9fafb' }}>
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '0 16px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#111' }}>
            Avto<span style={{ color: '#1D9E75' }}>Rent</span>
            <span style={{ fontSize: 10, color: '#9ca3af', fontWeight: 400, marginLeft: 6 }}>agent</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {agentName && <span style={{ fontSize: 12, color: '#6b7280' }}>{agentName.split(' ')[0]}</span>}
            <button onClick={() => setMenuOpen(o => !o)}
              style={{ background: menuOpen ? '#f0fdf8' : 'none', border: menuOpen ? '1px solid #1D9E75' : '1px solid #e5e7eb', borderRadius: 8, padding: '6px 10px', fontSize: 18, cursor: 'pointer', color: menuOpen ? '#1D9E75' : '#374151', lineHeight: 1 }}>
              {menuOpen ? '✕' : '☰'}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setMenuOpen(false)}>
            <div style={{ position: 'absolute', top: 52, right: 0, width: 240, background: '#fff', borderLeft: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb', borderBottomLeftRadius: 12, boxShadow: '-4px 4px 20px rgba(0,0,0,0.1)', maxHeight: 'calc(100vh - 52px)', overflowY: 'auto' }}
              onClick={e => e.stopPropagation()}>
              <nav style={{ paddingTop: 8, paddingBottom: 8 }}>
                {AGENT_NAV.map(item => {
                  const isActive = item.href === '/agent' ? pathname === '/agent' : pathname.startsWith(item.href)
                  return (
                    <a key={item.href} href={item.href} onClick={() => setMenuOpen(false)}
                      style={{ display: 'block', padding: '11px 18px', fontSize: 14, textDecoration: 'none', color: isActive ? '#1D9E75' : '#374151', fontWeight: isActive ? 600 : 400, background: isActive ? '#f0fdf8' : 'transparent', borderLeft: isActive ? '3px solid #1D9E75' : '3px solid transparent' }}>
                      {item.label}
                    </a>
                  )
                })}
              </nav>
              <div style={{ padding: '12px 18px', borderTop: '1px solid #e5e7eb' }}>
                <button onClick={handleLogout} style={{ background: 'none', border: 'none', padding: 0, fontSize: 13, color: '#9ca3af', cursor: 'pointer', textDecoration: 'underline' }}>
                  Odjavi se
                </button>
              </div>
            </div>
          </div>
        )}

        <div style={{ paddingTop: 52, padding: '68px 12px 20px' }}>
          {children}
        </div>
      </div>
    )
  }

  // DESKTOP LAYOUT
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f9fafb' }}>
      <div style={{ width: 210, background: '#fff', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '20px 16px', borderBottom: '1px solid #e5e7eb', fontSize: 16, fontWeight: 700, color: '#111' }}>
          Avto<span style={{ color: '#1D9E75' }}>Rent</span>
          <span style={{ fontSize: 10, color: '#9ca3af', fontWeight: 400, marginLeft: 6 }}>agent</span>
        </div>
        <nav style={{ flex: 1, paddingTop: 8 }}>
          {AGENT_NAV.map(item => {
            const isActive = item.href === '/agent' ? pathname === '/agent' : pathname.startsWith(item.href)
            return (
              <a key={item.href} href={item.href}
                style={{ display: 'block', padding: '9px 16px', fontSize: 13, textDecoration: 'none', color: isActive ? '#1D9E75' : '#6b7280', fontWeight: isActive ? 600 : 400, background: isActive ? '#f0fdf8' : 'transparent', borderRight: isActive ? '2px solid #1D9E75' : '2px solid transparent' }}>
                {item.label}
              </a>
            )
          })}
        </nav>
        <div style={{ padding: '14px 16px', borderTop: '1px solid #e5e7eb' }}>
          {agentName && <div style={{ fontSize: 12, color: '#374151', fontWeight: 500, marginBottom: 4 }}>{agentName}</div>}
          <button onClick={handleLogout} style={{ background: 'none', border: 'none', padding: 0, fontSize: 12, color: '#9ca3af', cursor: 'pointer', textDecoration: 'underline' }}>
            Odjavi se
          </button>
        </div>
      </div>
      <div style={{ flex: 1, padding: 28, overflow: 'auto' }}>
        {children}
      </div>
    </div>
  )
}
