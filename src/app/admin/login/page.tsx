'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const LOGO_URL = 'https://planetrentacar.me/wp-content/uploads/2023/03/logo-1.png'

export default function AdminLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  useEffect(() => {
    const hash = window.location.hash
    if (!hash || !hash.includes('access_token')) return
    setGoogleLoading(true)
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { setGoogleLoading(false); return }
      await processLogin(session.user.email!, session.access_token)
    })
  }, [])

  async function processLogin(userEmail: string, accessToken: string) {
    const { data: agent } = await supabase
      .from('agents').select('*').eq('email', userEmail).eq('is_active', true).single()
    if (!agent) {
      await supabase.auth.signOut()
      setError('Vaš nalog nije odobren. Kontaktirajte administratora.')
      setGoogleLoading(false); setLoading(false); return
    }
    document.cookie = `avtorent-admin-token=${accessToken}; path=/; max-age=86400`
    document.cookie = `avtorent-agent-name=${encodeURIComponent(agent.full_name || userEmail)}; path=/; max-age=86400`
    window.location.href = `${window.location.origin}/admin`
  }

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password) { setError('Unesite email i lozinku.'); return }
    setLoading(true); setError('')
    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err || !data.session) {
      setError(err?.message || 'Pogrešan email ili lozinka.')
      setLoading(false); return
    }
    await processLogin(email, data.session.access_token)
  }

  async function handleGoogleLogin() {
    setGoogleLoading(true); setError('')
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/admin/login`, queryParams: { prompt: 'select_account' } },
    })
    if (err) { setError('Greška pri Google prijavi.'); setGoogleLoading(false) }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', padding: '36px 40px', borderRadius: 16, width: 380, border: '1px solid #e5e7eb', boxShadow: '0 4px 24px rgba(0,0,0,0.07)' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <img
            src={LOGO_URL}
            alt="Planet Rent a Car"
            style={{ height: 64, objectFit: 'contain', display: 'inline-block' }}
          />
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 8, letterSpacing: 1, textTransform: 'uppercase' }}>
            Admin panel
          </div>
        </div>

        {googleLoading && (
          <div style={{ background: '#E1F5EE', border: '1px solid #1D9E75', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#085041', marginBottom: 16, textAlign: 'center' }}>
            Prijava u toku...
          </div>
        )}

        <button onClick={handleGoogleLogin} disabled={googleLoading || loading}
          style={{ width: '100%', padding: '11px', background: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 16 }}>
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 002.38-5.88c0-.57-.05-.66-.15-1.18z"/>
            <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 01-7.18-2.54H1.83v2.07A8 8 0 008.98 17z"/>
            <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 010-3.04V5.41H1.83a8 8 0 000 7.18l2.67-2.07z"/>
            <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 001.83 5.4L4.5 7.49a4.77 4.77 0 014.48-3.3z"/>
          </svg>
          {googleLoading ? 'Prijava...' : 'Prijavi se sa Google'}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
          <span style={{ fontSize: 12, color: '#9ca3af' }}>ili</span>
          <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
        </div>

        <form onSubmit={handleEmailLogin}>
          <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Email</label>
          <input type="email" name="email" autoComplete="email" value={email}
            onChange={e => setEmail(e.target.value)}
            style={{ display: 'block', width: '100%', padding: '10px 12px', marginBottom: 14, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' as const }} />
          <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Lozinka</label>
          <input type="password" name="password" autoComplete="current-password" value={password}
            onChange={e => setPassword(e.target.value)}
            style={{ display: 'block', width: '100%', padding: '10px 12px', marginBottom: 18, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' as const }} />
          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#dc2626', marginBottom: 16 }}>
              {error}
            </div>
          )}
          <button type="submit" disabled={loading || googleLoading}
            style={{ display: 'block', width: '100%', padding: 11, background: loading ? '#e60012aa' : '#e60012', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer' }}>
            {loading ? 'Prijava...' : 'Prijavi se'}
          </button>
        </form>
      </div>
    </div>
  )
}
