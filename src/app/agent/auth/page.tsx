'use client'

import { useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function AgentAuthPage() {
  useEffect(() => {
    async function handleCallback() {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        window.location.href = '/admin/login'
        return
      }

      const { data: agent } = await supabase
        .from('agents')
        .select('*')
        .eq('email', session.user.email)
        .eq('is_active', true)
        .single()

      if (!agent) {
        await supabase.auth.signOut()
        window.location.href = '/admin/login'
        return
      }

      document.cookie = `avtorent-admin-token=${session.access_token}; path=/; max-age=86400`
      document.cookie = `avtorent-agent-name=${encodeURIComponent(agent.full_name || session.user.email)}; path=/; max-age=86400`
      window.location.href = '/agent'
    }

    handleCallback()
  }, [])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f3f4f6' }}>
      <div style={{ textAlign: 'center', color: '#6b7280', fontSize: 14 }}>
        Prijava u toku...
      </div>
    </div>
  )
}
