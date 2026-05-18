'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const LOGO_URL = 'https://planetrentacar.me/wp-content/uploads/2023/03/logo-1.png'

type LoginState = 'waiting' | 'reading' | 'success' | 'unknown'

export default function NfcLoginPage() {
  const [loginState, setLoginState] = useState<LoginState>('waiting')
  const [agentName, setAgentName] = useState('')
  const [agentRole, setAgentRole] = useState('')
  const [buffer, setBuffer] = useState('')
  const [lastUid, setLastUid] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const bufferRef = useRef('')

  // Uvijek drži fokus na hidden inputu
  useEffect(() => {
    inputRef.current?.focus()
    const keepFocus = () => inputRef.current?.focus()
    document.addEventListener('click', keepFocus)
    document.addEventListener('keydown', keepFocus)
    return () => {
      document.removeEventListener('click', keepFocus)
      document.removeEventListener('keydown', keepFocus)
    }
  }, [])

  async function handleNfcInput(uid: string) {
    if (!uid.trim()) return
    const cleanUid = uid.trim()
    setLastUid(cleanUid)
    setLoginState('reading')

    try {
      // Server API kreira magic link token
      const res = await fetch('/api/nfc-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: cleanUid }),
      })

      if (!res.ok) {
        setLoginState('unknown')
        resetAfter(4000)
        return
      }

      const { token, full_name, role } = await res.json()

      // Verifikuj token — dobijamo pravu Supabase sesiju
      const { data: authData, error: authErr } = await supabase.auth.verifyOtp({
        token_hash: token,
        type: 'magiclink',
      })

      if (authErr || !authData.session) {
        setLoginState('unknown')
        resetAfter(4000)
        return
      }

      setAgentName(full_name)
      setAgentRole(role)
      setLoginState('success')

      // Postavi cookije identično kao Google login
      document.cookie = `avtorent-admin-token=${authData.session.access_token}; path=/; max-age=86400`
      document.cookie = `avtorent-agent-name=${encodeURIComponent(full_name)}; path=/; max-age=86400`

      // Upiši sesiju
      await supabase.from('agent_sessions').insert({
        agent_name: full_name,
        logged_in_at: new Date().toISOString(),
      })

      setTimeout(() => { window.location.href = '/admin' }, 2000)

    } catch {
      setLoginState('unknown')
      resetAfter(3000)
    }
  }

  function resetAfter(ms: number) {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      setLoginState('waiting')
      setAgentName('')
      setLastUid('')
      bufferRef.current = ''
      setBuffer('')
      inputRef.current?.focus()
    }, ms)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      const uid = bufferRef.current.trim()
      bufferRef.current = ''
      setBuffer('')
      if (uid) handleNfcInput(uid)
    } else {
      bufferRef.current += e.key
      setBuffer(bufferRef.current)
    }
  }

  const isWaiting = loginState === 'waiting'
  const isReading = loginState === 'reading'
  const isSuccess = loginState === 'success'
  const isUnknown = loginState === 'unknown'

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 24, fontFamily: 'system-ui, sans-serif', userSelect: 'none',
    }}>
      {/* Hidden input koji uvijek hvata NFC unos */}
      <input
        ref={inputRef}
        onKeyDown={handleKeyDown}
        style={{ position: 'fixed', opacity: 0, top: -999, left: -999, width: 1, height: 1 }}
        readOnly={false}
        autoFocus
        tabIndex={0}
      />

      {/* Logo */}
      <img src={LOGO_URL} alt="Planet Rent a Car"
        style={{ height: 56, objectFit: 'contain', marginBottom: 48, filter: 'brightness(0) invert(1)', opacity: 0.85 }} />

      {/* Panel */}
      <div style={{
        background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 28, padding: '52px 44px', width: '100%', maxWidth: 400,
        textAlign: 'center', backdropFilter: 'blur(12px)',
        transition: 'all 0.3s ease',
      }}>

        {/* Ikonica */}
        <div style={{
          width: 110, height: 110, borderRadius: '50%', margin: '0 auto 28px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: isSuccess ? 'rgba(29,158,117,0.15)' : isUnknown ? 'rgba(220,38,38,0.15)' : isReading ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.04)',
          border: `2px solid ${isSuccess ? '#1D9E75' : isUnknown ? '#dc2626' : isReading ? '#f59e0b' : 'rgba(255,255,255,0.15)'}`,
          transition: 'all 0.4s ease',
          fontSize: 52,
        }}>
          {isSuccess ? '✅' : isUnknown ? '🚫' : isReading ? '⏳' : '💳'}
        </div>

        {/* Waiting */}
        {isWaiting && (<>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#fff', marginBottom: 10 }}>
            Priloži karticu
          </div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>
            Drži NFC karticu uz reader<br/>za prijavu na sistem
          </div>
          {/* Pulsing ring animacija */}
          <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center', gap: 6 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                width: 8, height: 8, borderRadius: '50%', background: '#1D9E75',
                animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
              }} />
            ))}
          </div>
        </>)}

        {/* Reading */}
        {isReading && (<>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#f59e0b', marginBottom: 8 }}>
            Provjera...
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace', marginTop: 8 }}>
            {lastUid}
          </div>
        </>)}

        {/* Success */}
        {isSuccess && (<>
          <div style={{ fontSize: 15, color: '#1D9E75', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>
            Dobrodošao
          </div>
          <div style={{ fontSize: 30, fontWeight: 800, color: '#fff', marginBottom: 8, lineHeight: 1.2 }}>
            {agentName}
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 20 }}>
            {agentRole === 'admin' ? '👑 Administrator' : '👤 Agent'}
          </div>
          <div style={{ fontSize: 13, color: '#1D9E75', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <span>⏳</span> Ulazim u panel...
          </div>
        </>)}

        {/* Unknown */}
        {isUnknown && (<>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#dc2626', marginBottom: 8 }}>
            Kartica nije prepoznata
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace', marginBottom: 8 }}>
            {lastUid}
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
            Kontaktiraj administratora
          </div>
        </>)}
      </div>

      {/* Gmail login link */}
      <div style={{ marginTop: 28, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ height: 1, width: 60, background: 'rgba(255,255,255,0.1)' }} />
        <a href="/admin/login" style={{
          fontSize: 13, color: 'rgba(255,255,255,0.4)', textDecoration: 'none',
          padding: '8px 16px', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 20, transition: 'all 0.2s',
        }}
          onMouseOver={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.7)')}
          onMouseOut={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}>
          Prijava putem Google →
        </a>
        <div style={{ height: 1, width: 60, background: 'rgba(255,255,255,0.1)' }} />
      </div>

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-8px); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
