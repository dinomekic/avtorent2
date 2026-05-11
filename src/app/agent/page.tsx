'use client'

import { useEffect } from 'react'

export default function AgentPage() {
  useEffect(() => {
    window.location.replace('/agent/finansije')
  }, [])

  return (
    <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>
      Učitavanje...
    </div>
  )
}
