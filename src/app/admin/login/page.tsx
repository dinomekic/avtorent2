'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function AdminLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  useEffect(() => {
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        const { data: agent } = await supabase
          .from('agents')
          .select('*')
          .eq('email', session.user.email)
          .eq('is_active', true)
          .single()

        if (!agent) {
          await supabase.auth.signOut()
          setError('Vaš nalog nije odobren.')
          setGoogleLoading(false)
          return
        }

        document.cookie = `avtorent-admin-token=${session.access_token}; path=/; max-age=86400`
        document.cookie = `avtorent-agent-name=${encodeURIComponent(agent.full_name || session.user.email)}; path=/; max-age=86400`
        window.location.href = '/admin'
      }
    })
  }, [])

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password) { setError('Unesite email i lozinku.'); return }
    setLoading(true)
    setError('')
    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err || !data.session) {
      setError(err?.message || 'Pogrešan email ili lozinka.')
      setLoading(false)
      return
    }
    const { data: agent } = await supabase
      .from('agents')
      .select('*')
      .eq('email', email)
      .eq('is_active', true)
      .single()
    if (!agent) {
      await supabase.auth.signOut()
      setError('Vaš nalog nije odobren.')
      setLoading(false)
      return
    }
    document.cookie = `avtorent-admin-token=${data.session.access_token}; path=/; max-age=86400`
    document.cookie = `avtorent-agent-name=${encodeURIComponent(agent.full_name || email)}; path=/; max-age=86400`
    window.location.href = '/admin'
  }

  async function handleGoogleLogin() {
    setGoogleLoading(true)
    setError('')
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/admin/login`,
        queryParams: { prompt: 'select_account' }
      },
    })
    if (err) {
      setError('Greška pri Google prijavi.')
      setGoogleLoading(false)
    }
  }
