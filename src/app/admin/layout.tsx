'use client'

import { usePathname } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'

const AGENT_NAV = [
  { href: '/admin', label: '📊 Pregled' },
  { href: '/admin/dan', label: '📅 Dnevni pregled' },
  { href: '/admin/rezervacije', label: '🚗 Rezervacije' },
  { href: '/admin/kalendar', label: '🗓 Kalendar' },
  { href: '/admin/finansije', label: '💰 Finansije' },
  { href: '/admin/moji-partneri', label: '🤝 Moji partneri' },
  { href: '/admin/flota', label: '🚗 Flota' },
  { href: '/admin/pranje', label: '💦 Pranje vozila' },
  { href: '/admin/servis', label: '🔧 Servis' },
]

const ADMIN_NAV = [
  { href: '/admin', label: '📊 Pregled' },
  { href: '/admin/dan', label: '📅 Dnevni pregled' },
  { href: '/admin/rezervacije', label: '🚗 Rezervacije' },
  { href: '/admin/kalendar', label: '🗓 Kalendar' },
  { href: '/admin/finansije', label: '💰 Finansije' },
  { href: '/admin/finansije-panel', label: '💸 Finansije panel' },
  { href: '/admin/koristenje', label: '🚘 Koristenje vozila' },
  { href: '/admin/partneri', label: '🤝 Partneri' },
  { href: '/admin/moji-partneri', label: '👥 Moji partneri' },
  { href: '/admin/vozila', label: '🚙 Vozila' },
  { href: '/admin/cijene', label: '💲 Cijene' },
  { href: '/admin/lokacije', label: '📍 Lokacije' },
  { href: '/admin/dodaci', label: '➕ Dodaci' },
  { href: '/admin/doplate', label: '📋 Doplate' },
  { href: '/admin/kuponi', label: '🎫 Kuponi' },
  { href: '/admin/agenti', label: '👤 Agenti' },
  { href: '/admin/saradnici', label: '🔗 Saradnici' },
  { href: '/admin/klijenti', label: '👥 Klijenti' },
  { href: '/admin/finansije-pregled', label: '📈 Finansije agenata' },
  { href: '/admin/reporting', label: '📉 Reporting' },
  { href: '/admin/kategorije-transakcija', label: '📝 Kategorije transakcija' },
  { href: '/admin/pranje', label: '💦 Pranje vozila' },
  { href: '/admin/sajtovi', label: '🌐 Sajtovi' },
  { href: '/admin/analitika', label: '📡 QR analitika' },
  { href: '/admin/performance', label: '🏆 Performanse' },
  { href: '/admin/flota', label: '🚗 Flota' },
  { href: '/admin/servis', label: '🔧 Servis' },
]

function getCookie(name: string): string {
  if (typeof document === 'undefined') return ''
  const match = document.cookie.match(new RegExp(`${name}=([^;]+)`))
  return match ? decodeURIComponent(match[1]) : ''
}

const LOGO_URL = 'https://planetrentacar.me/wp-content/uploads/2023/03/logo-1.png'

function Logo({ size = 'md' }: { size?: 'sm' | 'md' }) {
  return (
    <img src={LOGO_URL} alt="Planet Rent a Car"
      style={{ height: size === 'md' ? 36 : 28, objectFit: 'contain', display: 'block' }} />
  )
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [role, setRole] = useState<string | null>(null)
  const [agentName, setAgentName] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [origin, setOrigin] = useState('')

  useEffect(() => {
    setOrigin(window.location.origin)
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    const name = getCookie('avtorent-agent-name')
    setAgentName(name)
    if (name) {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      supabase.from('agents').select('role').eq('full_name', name).single()
        .then(({ data }) => setRole(data?.role || 'agent'))

      supabase.from('agent_sessions').insert({ agent_name: name })
        .select().single().then(({ data: sess }) => {
          if (sess) {
            const sessionId = sess.id

            // Heartbeat — svake 30s ažurira last_active (radi i na mobilnom)
            const heartbeat = () => {
              supabase.from('agent_sessions')
                .update({ last_active: new Date().toISOString() })
                .eq('id', sessionId)
                .then()
            }
            heartbeat() // odmah prvi put
            const heartbeatInterval = setInterval(heartbeat, 30000)

            // Desktop — precizno trajanje via beforeunload
            const logEnd = () => {
              clearInterval(heartbeatInterval)
              const start = new Date(sess.logged_in_at).getTime()
              const minutes = Math.round((Date.now() - start) / 60000)
              navigator.sendBeacon('/api/session-end', JSON.stringify({ id: sessionId, minutes }))
            }
            window.addEventListener('beforeunload', logEnd)

            // Cleanup kad se komponenta unmountuje
            return () => {
              clearInterval(heartbeatInterval)
              window.removeEventListener('beforeunload', logEnd)
            }
          }
        })
    }
  }, [])

  if (pathname === '/admin/login') return <>{children}</>
  if (pathname === '/login-kartica') return <>{children}</>

  const navItems = role === 'admin' ? ADMIN_NAV : AGENT_NAV

  async function handleLogout() {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    await supabase.auth.signOut()
    document.cookie = 'avtorent-admin-token=; path=/; max-age=0'
    document.cookie = 'avtorent-agent-name=; path=/; max-age=0'
    window.location.href = `${window.location.origin}/login-kartica`
  }

  // Linkovi sa punim origin-om da ostanu na istom domenu
  const link = (path: string) => `${origin}${path}`

  if (isMobile) {
    return (
      <div style={{ minHeight: '100vh', background: '#f9fafb' }}>
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '0 16px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <a href={link('/admin')} style={{ textDecoration: 'none' }}><Logo size="sm" /></a>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {agentName && <span style={{ fontSize: 12, color: '#6b7280' }}>{agentName.split(' ')[0]}</span>}
            <button onClick={handleLogout}
              style={{ fontSize: 11, color: '#9ca3af', background: 'none', border: '1px solid #e5e7eb', borderRadius: 8, padding: '5px 10px', cursor: 'pointer' }}>
              Odjavi
            </button>
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
                {navItems.map(item => {
                  const isActive = item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href)
                  return (
                    <a key={item.href} href={link(item.href)} onClick={() => setMenuOpen(false)}
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

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f9fafb' }}>
      <div style={{ width: 210, background: '#fff', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <a href={link('/admin')} style={{ textDecoration: 'none' }}><Logo size="md" /></a>
            <button onClick={handleLogout}
              style={{ fontSize: 11, color: '#9ca3af', background: 'none', border: '1px solid #e5e7eb', borderRadius: 7, padding: '4px 9px', cursor: 'pointer', whiteSpace: 'nowrap' as const }}>
              Odjavi se
            </button>
          </div>
          <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4 }}>
            {agentName && <span style={{ fontWeight: 500, color: '#374151' }}>{agentName} · </span>}
            {role === 'admin' ? 'admin' : 'agent'}
          </div>
        </div>
        <nav style={{ flex: 1, paddingTop: 8, overflowY: 'auto' }}>
          {navItems.map(item => {
            const isActive = item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href)
            return (
              <a key={item.href} href={link(item.href)}
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
