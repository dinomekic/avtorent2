'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const LOKACIJE = ['CRNA GORA', 'BiH', 'SRBIJA', 'ALBANIJA']
const LOK_FLAG: Record<string, string> = { 'CRNA GORA': '🇲🇪', 'BiH': '🇧🇦', 'SRBIJA': '🇷🇸', 'ALBANIJA': '🇦🇱' }

type Agent = {
  id: string; email: string; full_name: string
  role: string; is_active: boolean; created_at: string
  kalendar_lokacije: string[]; nfc_uid: string | null
}

export default function AdminAgentiPage() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ email: '', full_name: '', role: 'agent' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [editingLokId, setEditingLokId] = useState<string | null>(null)
  const [editingNfcId, setEditingNfcId] = useState<string | null>(null)
  const [nfcInput, setNfcInput] = useState('')

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const { data } = await supabase.from('agents').select('*').order('created_at', { ascending: false })
    setAgents((data || []).map((a: any) => ({
      ...a,
      kalendar_lokacije: a.kalendar_lokacije || ['CRNA GORA']
    })))
    setLoading(false)
  }

  async function addAgent() {
    if (!form.email) { setError('Email je obavezan.'); return }
    setSaving(true); setError('')
    const { error: err } = await supabase.from('agents').insert({
      email: form.email.toLowerCase().trim(),
      full_name: form.full_name,
      role: form.role,
      is_active: true,
      kalendar_lokacije: ['CRNA GORA'],
    })
    if (err) {
      setError(err.code === '23505' ? 'Agent sa tim emailom već postoji.' : 'Greška pri dodavanju agenta.')
      setSaving(false); return
    }
    setSaving(false); setShowForm(false)
    setForm({ email: '', full_name: '', role: 'agent' })
    fetchData()
  }

  async function toggleActive(id: string, current: boolean) {
    await supabase.from('agents').update({ is_active: !current }).eq('id', id)
    fetchData()
  }

  async function changeRole(id: string, role: string) {
    await supabase.from('agents').update({ role }).eq('id', id)
    fetchData()
  }

  const [editingAgentId, setEditingAgentId] = useState<string | null>(null)
  const [editAgentForm, setEditAgentForm] = useState({ full_name: '', email: '' })
  const [editAgentSaving, setEditAgentSaving] = useState(false)

  async function saveAgent(id: string) {
    setEditAgentSaving(true)
    await supabase.from('agents').update({
      full_name: editAgentForm.full_name.trim(),
      email: editAgentForm.email.toLowerCase().trim(),
    }).eq('id', id)
    setEditAgentSaving(false)
    setEditingAgentId(null)
    fetchData()
  }
    await supabase.from('agents').update({ nfc_uid: nfcInput.trim() || null }).eq('id', id)
    setEditingNfcId(null)
    setNfcInput('')
    fetchData()
  }

  async function saveLokacije(id: string, lokacije: string[]) {
    await supabase.from('agents').update({ kalendar_lokacije: lokacije }).eq('id', id)
    setAgents(prev => prev.map(a => a.id === id ? { ...a, kalendar_lokacije: lokacije } : a))
    setEditingLokId(null)
  }

  function toggleLokacija(agent: Agent, lok: string) {
    const current = agent.kalendar_lokacije || ['CRNA GORA']
    const updated = current.includes(lok)
      ? current.filter(l => l !== lok)
      : [...current, lok]
    // Mora bar jedna biti odabrana
    if (updated.length === 0) return
    setAgents(prev => prev.map(a => a.id === agent.id ? { ...a, kalendar_lokacije: updated } : a))
  }

  const inp: React.CSSProperties = { width: '100%', padding: '8px 12px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', color: '#111', boxSizing: 'border-box' as const }
  const lbl: React.CSSProperties = { fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#111' }}>Agenti</h1>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>Upravljaj ko ima pristup admin panelu</p>
        </div>
        <button onClick={() => { setShowForm(true); setError('') }}
          style={{ padding: '8px 16px', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          + Dodaj agenta
        </button>
      </div>

      <div style={{ background: '#E6F1FB', border: '1px solid #85B7EB', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: '#0C447C', marginBottom: 20 }}>
        Agenti se prijavljuju na <strong>/admin/login</strong> sa Google nalogom ili emailom/lozinkom. Kolona <strong>Kalendar</strong> određuje koje države agent vidi bez unosa lozinke.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: showForm ? '1fr 300px' : '1fr', gap: 16 }}>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Učitavanje...</div>
          ) : agents.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Nema agenata.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {['Agent', 'Email', 'Uloga', 'NFC', 'Kalendar', 'Status', 'Dodan', ''].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 500, fontSize: 12, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {agents.map(a => (
                  <tr key={a.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#E1F5EE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#0F6E56' }}>
                        {(a.full_name || a.email)[0].toUpperCase()}
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      {editingAgentId === a.id ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <input value={editAgentForm.full_name} onChange={e => setEditAgentForm(f => ({ ...f, full_name: e.target.value }))}
                            placeholder="Ime i prezime" autoFocus
                            style={{ ...inp, fontSize: 12, padding: '5px 8px' }} />
                          <input value={editAgentForm.email} onChange={e => setEditAgentForm(f => ({ ...f, email: e.target.value }))}
                            placeholder="Email" type="email"
                            style={{ ...inp, fontSize: 12, padding: '5px 8px' }} />
                          <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
                            <button onClick={() => saveAgent(a.id)} disabled={editAgentSaving}
                              style={{ flex: 1, padding: '4px', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                              {editAgentSaving ? '...' : '✓ Snimi'}
                            </button>
                            <button onClick={() => setEditingAgentId(null)}
                              style={{ flex: 1, padding: '4px', background: '#f3f4f6', color: '#6b7280', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>Otk.</button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div style={{ fontWeight: 500, color: '#111' }}>{a.full_name || '—'}</div>
                          <div style={{ fontSize: 11, color: '#9ca3af' }}>{a.email}</div>
                          <button onClick={() => { setEditingAgentId(a.id); setEditAgentForm({ full_name: a.full_name || '', email: a.email }) }}
                            style={{ marginTop: 4, padding: '2px 7px', fontSize: 10, border: '1px solid #e5e7eb', borderRadius: 6, background: '#f9fafb', color: '#6b7280', cursor: 'pointer' }}>
                            ✏️ Uredi
                          </button>
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <select value={a.role} onChange={e => changeRole(a.id, e.target.value)}
                        style={{ padding: '4px 8px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', color: '#374151', cursor: 'pointer' }}>
                        <option value="agent">Agent</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>

                    {/* NFC KOLONA */}
                    <td style={{ padding: '12px 14px' }}>
                      {editingNfcId === a.id ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <input
                            value={nfcInput}
                            onChange={e => setNfcInput(e.target.value)}
                            placeholder="Prisloni karticu..."
                            autoFocus
                            style={{ ...inp, fontSize: 12, padding: '5px 8px', fontFamily: 'monospace', width: 140 }}
                            onKeyDown={e => { if (e.key === 'Enter') saveNfcUid(a.id) }}
                          />
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button onClick={() => saveNfcUid(a.id)}
                              style={{ flex: 1, padding: '4px', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>✓</button>
                            <button onClick={() => { setEditingNfcId(null); setNfcInput('') }}
                              style={{ flex: 1, padding: '4px', background: '#f3f4f6', color: '#6b7280', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>✕</button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          {a.nfc_uid
                            ? <div style={{ fontSize: 11, fontFamily: 'monospace', background: '#E1F5EE', color: '#085041', padding: '2px 7px', borderRadius: 6, marginBottom: 4, fontWeight: 600 }}>💳 {a.nfc_uid}</div>
                            : <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>—</div>
                          }
                          <button onClick={() => { setEditingNfcId(a.id); setNfcInput(a.nfc_uid || '') }}
                            style={{ padding: '3px 8px', fontSize: 10, border: '1px solid #e5e7eb', borderRadius: 6, background: '#f9fafb', color: '#6b7280', cursor: 'pointer' }}>
                            ✏️ {a.nfc_uid ? 'Promijeni' : 'Dodaj'}
                          </button>
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      {editingLokId === a.id ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {LOKACIJE.map(lok => (
                            <label key={lok} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', userSelect: 'none' }}>
                              <input
                                type="checkbox"
                                checked={(a.kalendar_lokacije || ['CRNA GORA']).includes(lok)}
                                onChange={() => toggleLokacija(a, lok)}
                                style={{ width: 14, height: 14, accentColor: '#1D9E75', cursor: 'pointer' }}
                              />
                              <span>{LOK_FLAG[lok]} {lok}</span>
                            </label>
                          ))}
                          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                            <button onClick={() => saveLokacije(a.id, a.kalendar_lokacije)}
                              style={{ flex: 1, padding: '5px', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                              ✓ Snimi
                            </button>
                            <button onClick={() => { setEditingLokId(null); fetchData() }}
                              style={{ flex: 1, padding: '5px', background: '#f3f4f6', color: '#6b7280', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>
                              Odustani
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                            {(a.kalendar_lokacije || ['CRNA GORA']).map(lok => (
                              <span key={lok} style={{ fontSize: 11, background: '#E1F5EE', color: '#085041', padding: '2px 6px', borderRadius: 10, fontWeight: 600 }}>
                                {LOK_FLAG[lok]} {lok === 'CRNA GORA' ? 'CG' : lok}
                              </span>
                            ))}
                          </div>
                          <button onClick={() => setEditingLokId(a.id)}
                            style={{ marginTop: 4, padding: '3px 8px', fontSize: 10, border: '1px solid #e5e7eb', borderRadius: 6, background: '#f9fafb', color: '#6b7280', cursor: 'pointer', textAlign: 'left' as const }}>
                            ✏️ Uredi
                          </button>
                        </div>
                      )}
                    </td>

                    <td style={{ padding: '12px 14px' }}>
                      <button onClick={() => toggleActive(a.id, a.is_active)}
                        style={{ fontSize: 11, padding: '3px 8px', borderRadius: 20, border: 'none', cursor: 'pointer', fontWeight: 500, background: a.is_active ? '#E1F5EE' : '#f3f4f6', color: a.is_active ? '#085041' : '#9ca3af' }}>
                        {a.is_active ? 'Aktivan' : 'Blokiran'}
                      </button>
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: '#9ca3af' }}>
                      {new Date(a.created_at).toLocaleDateString('sr-RS')}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <button onClick={() => { if (confirm(`Obrisati agenta ${a.email}?`)) supabase.from('agents').delete().eq('id', a.id).then(() => fetchData()) }}
                        style={{ padding: '4px 10px', fontSize: 11, border: '1px solid #fecaca', borderRadius: 6, background: 'transparent', cursor: 'pointer', color: '#dc2626' }}>
                        Ukloni
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {showForm && (
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 20, background: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#111' }}>Novi agent</div>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#9ca3af' }}>✕</button>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Email adresa *</label>
              <input style={inp} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="agent@email.com" />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Ime i prezime</label>
              <input style={inp} value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Marko Petrović" />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={lbl}>Uloga</label>
              <select style={inp} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                <option value="agent">Agent</option>
                <option value="admin">Admin (puni pristup)</option>
              </select>
            </div>
            {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#dc2626', marginBottom: 16 }}>{error}</div>}
            <div style={{ background: '#f9fafb', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#6b7280', marginBottom: 16 }}>
              Agent se može prijaviti sa <strong>Google nalogom</strong> ili sa email/lozinkom. Kalendar lokacije se mogu podesiti nakon dodavanja.
            </div>
            <button onClick={addAgent} disabled={saving}
              style={{ width: '100%', padding: 10, background: saving ? '#5DCAA5' : '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Dodavanje...' : 'Dodaj agenta'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
