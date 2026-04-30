'use client'

import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function ServiserLoginPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin() {
    if (!email.trim()) return
    setLoading(true)
    setError('')

    // Provjeri da li serviser postoji
    const { data: tech } = await supabase
      .from('technicians')
      .select('id, full_name, portal_email')
      .eq('portal_email', email.trim().toLowerCase())
      .eq('is_active', true)
      .single()

    if (!tech) {
      setError('Email nije pronađen. Kontaktirajte administratora.')
      setLoading(false)
      return
    }

    // Pošalji magic link
    const { error: authError } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: `${window.location.origin}/serviser/dashboard` }
    })

    if (authError) {
      setError('Greška pri slanju emaila. Pokušajte ponovo.')
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: '40px 36px', maxWidth: 400, width: '100%', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🔧</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#111' }}>Serviser portal</div>
          <div style={{ fontSize: 14, color: '#6b7280', marginTop: 6 }}>AvtoRent Montenegro</div>
        </div>

        {!sent ? (
          <>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, color: '#374151', display: 'block', marginBottom: 6 }}>Email adresa</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                placeholder="vasa@email.com"
                style={{ width: '100%', padding: '12px 14px', fontSize: 14, border: '1px solid #d1d5db', borderRadius: 10, color: '#111', boxSizing: 'border-box' as const }}
              />
            </div>

            {error && (
              <div style={{ background: '#FCEBEB', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#791F1F' }}>
                {error}
              </div>
            )}

            <button onClick={handleLogin} disabled={loading || !email.trim()}
              style={{ width: '100%', padding: '13px', background: loading || !email.trim() ? '#9ca3af' : '#1D9E75', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
              {loading ? 'Šaljem...' : 'Pošalji link za prijavu'}
            </button>
          </>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📧</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#111', marginBottom: 8 }}>Provjerite email</div>
            <div style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.6 }}>
              Poslali smo link za prijavu na <strong>{email}</strong>. Kliknite na link u emailu da biste pristupili portalu.
            </div>
            <button onClick={() => { setSent(false); setEmail('') }}
              style={{ marginTop: 24, fontSize: 13, color: '#1D9E75', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
              Pokušaj ponovo
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
