'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const DEFAULT_PRILIV = [
  'Izdavanje vozila', 'Naplata Duga', 'Depozit', 'Bonus', 'MOJ bonus',
  'MOJA dnevnica', 'Renta', 'Uplata duga prema FIRMI', 'Neutralni novcani tokovi',
  'PREUZETO IZ SANDUCETA', 'Prodaja vozila', 'Razmjena novca',
  'Razmjena novca medju nama', 'Refundacija (u komentaru dodaj razlog)', 'Ostalo',
]

const DEFAULT_ODLIV = [
  'Gorivo (dodaj sliku racuna)', 'Gorivo', 'Djelovi (dodaj sliku racuna)', 'Djelovi',
  'Servisiranje vozila', 'Servis', 'Registracija vozila (dodaj sliku racuna)',
  'Pranje', 'Pranje Planet', 'Parking (dodaj sliku racuna)', 'Parking',
  'Kazne i prekrsaji', 'Doplata za kazne (dodaj sliku kazne)', 'Doplata za oštetu',
  'Doplata za gorivo', 'Doplata za pranje', 'Povrat Depozita',
  'Provizije posrednicima', 'Putni troškovi', 'Taksi', 'Kirija',
  'Komunalije', 'Telekomunikacije', 'Kancelarijski materijal', 'Plata', 'MOJA plata',
  'Slepanje vozila', 'Uplata duga za službeno vozilo', 'Rata za vozilo (dodaj sliku potvrde)',
  'Marketing i oglasavanje', 'Osiguranje', 'Transfer', 'OSTAVLJENO U SANDUCE',
  'Neutralni novcani tok', 'DUG PREMA FIRMI ( u komentaru upisi iznos preostalog duga)',
  'Pozajmica (u komenatru upisi preostali dug)', 'Ostalo',
]

export default function KategorijePage() {
  const [prilivKat, setPrilivKat] = useState<string[]>([])
  const [odlivKat, setOdlivKat] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [newPriliv, setNewPriliv] = useState('')
  const [newOdliv, setNewOdliv] = useState('')
  const [activeTab, setActiveTab] = useState<'priliv' | 'odliv'>('priliv')

  useEffect(() => { loadKategorije() }, [])

  async function loadKategorije() {
    setLoading(true)
    const { data } = await supabase
      .from('konfiguracija')
      .select('*')
      .eq('id', 'kategorije_transakcija')
      .single()

    if (data) {
      setPrilivKat(data.priliv || DEFAULT_PRILIV)
      setOdlivKat(data.odliv || DEFAULT_ODLIV)
    } else {
      // Nije još kreiran — koristi defaultne
      setPrilivKat(DEFAULT_PRILIV)
      setOdlivKat(DEFAULT_ODLIV)
    }
    setLoading(false)
  }

  async function saveKategorije() {
    setSaving(true)
    await supabase.from('konfiguracija').upsert({
      id: 'kategorije_transakcija',
      priliv: prilivKat,
      odliv: odlivKat,
      updated_at: new Date().toISOString(),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  async function resetToDefault() {
    if (!confirm('Resetovati na defaultne kategorije? Sve izmjene će biti izgubljene.')) return
    setPrilivKat(DEFAULT_PRILIV)
    setOdlivKat(DEFAULT_ODLIV)
  }

  function addKategorija(tip: 'priliv' | 'odliv') {
    const val = tip === 'priliv' ? newPriliv.trim() : newOdliv.trim()
    if (!val) return
    if (tip === 'priliv') {
      if (prilivKat.includes(val)) { alert('Kategorija već postoji!'); return }
      setPrilivKat(p => [...p, val])
      setNewPriliv('')
    } else {
      if (odlivKat.includes(val)) { alert('Kategorija već postoji!'); return }
      setOdlivKat(p => [...p, val])
      setNewOdliv('')
    }
  }

  function removeKategorija(tip: 'priliv' | 'odliv', index: number) {
    if (!confirm('Obrisati ovu kategoriju?')) return
    if (tip === 'priliv') {
      setPrilivKat(p => p.filter((_, i) => i !== index))
    } else {
      setOdlivKat(p => p.filter((_, i) => i !== index))
    }
  }

  function moveUp(tip: 'priliv' | 'odliv', index: number) {
    if (index === 0) return
    if (tip === 'priliv') {
      const arr = [...prilivKat]
      ;[arr[index - 1], arr[index]] = [arr[index], arr[index - 1]]
      setPrilivKat(arr)
    } else {
      const arr = [...odlivKat]
      ;[arr[index - 1], arr[index]] = [arr[index], arr[index - 1]]
      setOdlivKat(arr)
    }
  }

  function moveDown(tip: 'priliv' | 'odliv', index: number) {
    const arr = tip === 'priliv' ? prilivKat : odlivKat
    if (index === arr.length - 1) return
    const newArr = [...arr]
    ;[newArr[index], newArr[index + 1]] = [newArr[index + 1], newArr[index]]
    if (tip === 'priliv') setPrilivKat(newArr)
    else setOdlivKat(newArr)
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>Učitavanje...</div>

  const currentKat = activeTab === 'priliv' ? prilivKat : odlivKat

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#111', margin: 0 }}>Kategorije transakcija</h1>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4, margin: 0 }}>
            Upravljaj kategorijama prihoda i rashoda u agent panelu
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={resetToDefault}
            style={{ padding: '8px 16px', background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
            Resetuj na default
          </button>
          <button onClick={saveKategorije} disabled={saving}
            style={{ padding: '8px 20px', background: saving ? '#5DCAA5' : '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            {saving ? '⏳ Snimam...' : saved ? '✅ Snimljeno!' : '💾 Snimi izmjene'}
          </button>
        </div>
      </div>

      {saved && (
        <div style={{ background: '#E1F5EE', border: '1px solid #1D9E75', borderRadius: 8, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: '#085041', fontWeight: 600 }}>
          ✅ Kategorije su snimljene! Agent panel će koristiti nove kategorije.
        </div>
      )}

      {/* INFO */}
      <div style={{ background: '#E6F1FB', border: '1px solid #85B7EB', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: '#0C447C', marginBottom: 20 }}>
        Ove kategorije se prikazuju agentima u <strong>Finansije → Transakcije</strong> tabu. 
        Promjene se primjenjuju odmah nakon snimanja.
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 20, borderBottom: '1px solid #e5e7eb' }}>
        {(['priliv', 'odliv'] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            style={{ padding: '9px 20px', fontSize: 13, border: 'none', background: 'none', cursor: 'pointer', fontWeight: activeTab === t ? 600 : 400, color: activeTab === t ? (t === 'priliv' ? '#1D9E75' : '#dc2626') : '#6b7280', borderBottom: activeTab === t ? `2px solid ${t === 'priliv' ? '#1D9E75' : '#dc2626'}` : '2px solid transparent', marginBottom: -1 }}>
            {t === 'priliv' ? '↑ PRIHODI (Priliv)' : '↓ RASHODI (Odliv)'}
            <span style={{ marginLeft: 8, background: t === 'priliv' ? '#E1F5EE' : '#FCEBEB', color: t === 'priliv' ? '#085041' : '#791F1F', borderRadius: 20, fontSize: 11, padding: '1px 7px', fontWeight: 700 }}>
              {t === 'priliv' ? prilivKat.length : odlivKat.length}
            </span>
          </button>
        ))}
      </div>

      {/* DODAJ NOVU */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          value={activeTab === 'priliv' ? newPriliv : newOdliv}
          onChange={e => activeTab === 'priliv' ? setNewPriliv(e.target.value) : setNewOdliv(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addKategorija(activeTab)}
          placeholder={`Nova kategorija ${activeTab === 'priliv' ? 'prihoda' : 'rashoda'}...`}
          style={{ flex: 1, padding: '9px 14px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, color: '#111' }}
        />
        <button onClick={() => addKategorija(activeTab)}
          style={{ padding: '9px 20px', background: activeTab === 'priliv' ? '#1D9E75' : '#dc2626', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          + Dodaj
        </button>
      </div>

      {/* LISTA */}
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: '10px 16px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', fontSize: 12, color: '#6b7280', fontWeight: 500 }}>
          {activeTab === 'priliv' ? 'Kategorije prihoda' : 'Kategorije rashoda'} · Možeš mijenjati redoslijed strelicama
        </div>
        {currentKat.map((kat, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', borderBottom: i < currentKat.length - 1 ? '1px solid #f3f4f6' : 'none', background: '#fff', gap: 8 }}>
            {/* Redni broj */}
            <span style={{ fontSize: 11, color: '#9ca3af', width: 24, textAlign: 'right', flexShrink: 0 }}>{i + 1}.</span>

            {/* Naziv */}
            <span style={{ flex: 1, fontSize: 13, color: '#111' }}>{kat}</span>

            {/* Akcije */}
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
              <button onClick={() => moveUp(activeTab, i)} disabled={i === 0}
                style={{ width: 28, height: 28, border: '1px solid #e5e7eb', borderRadius: 6, background: i === 0 ? '#f9fafb' : '#fff', cursor: i === 0 ? 'not-allowed' : 'pointer', color: i === 0 ? '#d1d5db' : '#374151', fontSize: 12 }}>
                ↑
              </button>
              <button onClick={() => moveDown(activeTab, i)} disabled={i === currentKat.length - 1}
                style={{ width: 28, height: 28, border: '1px solid #e5e7eb', borderRadius: 6, background: i === currentKat.length - 1 ? '#f9fafb' : '#fff', cursor: i === currentKat.length - 1 ? 'not-allowed' : 'pointer', color: i === currentKat.length - 1 ? '#d1d5db' : '#374151', fontSize: 12 }}>
                ↓
              </button>
              <button onClick={() => removeKategorija(activeTab, i)}
                style={{ width: 28, height: 28, border: '1px solid #fecaca', borderRadius: 6, background: '#fff', cursor: 'pointer', color: '#dc2626', fontSize: 12 }}>
                ✕
              </button>
            </div>
          </div>
        ))}
        {currentKat.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
            Nema kategorija. Dodaj prvu kategoriju gore.
          </div>
        )}
      </div>
    </div>
  )
}
