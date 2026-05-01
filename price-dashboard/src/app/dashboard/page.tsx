'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  TrendingUp, TrendingDown, Minus, RefreshCw, Plus,
  ChevronDown, ChevronUp, AlertTriangle, CheckCircle,
  BarChart3, Car, Edit3, Save, X, Clock, Zap
} from 'lucide-react'

// =============================================
// TYPES
// =============================================
type Category = { id: string; name_sr: string }
type MyPrice = {
  id: string; category_id: string; vehicle_model: string
  base_price: number; peak_price: number | null
  peak_start: string | null; peak_end: string | null
  updated_at: string
}
type CompPrice = {
  id: string; competitor_id: string; competitor_name: string
  category_id: string; vehicle_model: string; price_per_day: number
  scraped_at: string; is_manual: boolean
}
type Recommendation = {
  id: string; category_id: string; vehicle_model: string
  current_price: number; recommended_price: number
  avg_competitor_price: number; recommendation_type: 'increase' | 'decrease' | 'ok'
  reason: string; is_applied: boolean; created_at: string
}

const CATEGORIES: Category[] = [
  { id: 'economy',  name_sr: 'Ekonomska' },
  { id: 'compact',  name_sr: 'Kompaktna' },
  { id: 'suv',      name_sr: 'SUV' },
  { id: 'premium',  name_sr: 'Premium' },
  { id: 'electric', name_sr: 'Električna' },
  { id: 'van',      name_sr: 'Kombiji/Van' },
]

const COMPETITORS = [
  { id: 'meridian',  name: 'Meridian' },
  { id: 'sixt',      name: 'Sixt CG' },
  { id: 'europcar',  name: 'Europcar' },
  { id: 'budget',    name: 'Budget/Avis' },
{ id: 'localrent_agg', name: 'Localrent.com' },
{ id: 'rentalcars_agg', name: 'Rentalcars.com' },
{ id: 'discovercars_agg', name: 'Discovercars.com' },
{ id: 'discovercars_tivat',     name: 'Discovercars Tivat' },
{ id: 'discovercars_podgorica', name: 'Discovercars Podgorica' },
  { id: 'other',     name: 'Ostalo' },
]

// =============================================
// HELPER: Boja za razliku u cijeni
// =============================================
function diffColor(pct: number): string {
  if (pct > 10)  return '#22c55e' // zeleno — ja sam jeftiniji, može se podići
  if (pct < -10) return '#ef4444' // crveno — ja sam skuplji
  return '#f59e0b' // žuto — ok zona
}

function diffIcon(pct: number) {
  if (pct > 10)  return <TrendingUp size={14}  style={{ color: '#22c55e' }} />
  if (pct < -10) return <TrendingDown size={14} style={{ color: '#ef4444' }} />
  return <Minus size={14} style={{ color: '#f59e0b' }} />
}

// =============================================
// MAIN DASHBOARD
// =============================================
export default function PriceDashboard() {
  const [activeTab, setActiveTab] = useState<'overview' | 'competitors' | 'manual' | 'recommendations'>('overview')
  const [myPrices, setMyPrices] = useState<MyPrice[]>([])
  const [compPrices, setCompPrices] = useState<CompPrice[]>([])
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [scraping, setScraping] = useState(false)
  const [generatingRecs, setGeneratingRecs] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editVal, setEditVal] = useState<{base: string, peak: string}>({ base: '', peak: '' })
  const [manualForm, setManualForm] = useState({
    competitor_id: 'meridian', category_id: 'economy',
    vehicle_model: '', price_per_day: '', notes: ''
  })
  const [toast, setToast] = useState<{msg: string, type: 'ok'|'err'} | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  const showToast = (msg: string, type: 'ok'|'err' = 'ok') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [p, c, r] = await Promise.all([
        fetch('/api/prices').then(r => r.json()),
        fetch('/api/competitors?days=14').then(r => r.json()),
        fetch('/api/recommendations').then(r => r.json()),
      ])
      setMyPrices(Array.isArray(p) ? p : [])
      setCompPrices(Array.isArray(c) ? c : [])
      setRecommendations(Array.isArray(r) ? r : [])
    } catch {
      showToast('Greška pri učitavanju', 'err')
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // =============================================
  // Filtrirane cijene po kategoriji
  // =============================================
  const filteredMy = selectedCategory === 'all'
    ? myPrices
    : myPrices.filter(p => p.category_id === selectedCategory)

  // Prosijek konkurencije po kategoriji
  function avgComp(catId: string): number {
    const prices = compPrices.filter(p => p.category_id === catId)
    if (!prices.length) return 0
    return Math.round(prices.reduce((s, p) => s + p.price_per_day, 0) / prices.length)
  }

  function minComp(catId: string): number {
    const prices = compPrices.filter(p => p.category_id === catId)
    if (!prices.length) return 0
    return Math.min(...prices.map(p => p.price_per_day))
  }

  function maxComp(catId: string): number {
    const prices = compPrices.filter(p => p.category_id === catId)
    if (!prices.length) return 0
    return Math.max(...prices.map(p => p.price_per_day))
  }

  // =============================================
  // SAVE edited price
  // =============================================
  async function savePrice(id: string) {
    const res = await fetch('/api/prices', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        base_price: parseFloat(editVal.base),
        peak_price: editVal.peak ? parseFloat(editVal.peak) : null
      })
    })
    if (res.ok) {
      showToast('Cijena ažurirana ✓')
      setEditingId(null)
      fetchAll()
    } else {
      showToast('Greška pri čuvanju', 'err')
    }
  }

  // =============================================
  // MANUAL competitor price entry
  // =============================================
  async function submitManual(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/competitors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...manualForm,
        price_per_day: parseFloat(manualForm.price_per_day)
      })
    })
    if (res.ok) {
      showToast('Cijena konkurenta unesena ✓')
      setManualForm({ competitor_id: 'meridian', category_id: 'economy', vehicle_model: '', price_per_day: '', notes: '' })
      fetchAll()
    } else {
      showToast('Greška pri unosu', 'err')
    }
  }

  // =============================================
  // APPLY recommendation
  // =============================================
  async function applyRecommendation(rec: Recommendation) {
    const myP = myPrices.find(p =>
      p.category_id === rec.category_id &&
      (p.vehicle_model === rec.vehicle_model || !rec.vehicle_model)
    )
    if (!myP) return showToast('Vozilo nije pronađeno', 'err')

    const res = await fetch('/api/prices', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: myP.id,
        base_price: rec.recommended_price,
        reason: 'Automatska preporuka na osnovu konkurencije'
      })
    })

    if (res.ok) {
      // Označi preporuku kao primijenjenu
      await fetch(`/api/recommendations/${rec.id}`, { method: 'PATCH' })
      showToast(`Cijena ažurirana na ${rec.recommended_price}€ ✓`)
      fetchAll()
    } else {
      showToast('Greška', 'err')
    }
  }

  // =============================================
  // GENERATE RECOMMENDATIONS
  // =============================================
  async function generateRecommendations() {
    setGeneratingRecs(true)
    const res = await fetch('/api/recommendations/generate', { method: 'POST' })
    setGeneratingRecs(false)
    if (res.ok) {
      const d = await res.json()
      showToast(`Generisano ${d.generated} preporuka (↑${d.increase} povećanje, ↓${d.decrease} smanjenje)`)
      await new Promise(r => setTimeout(r, 800))
      await fetchAll()
    } else {
      showToast('Greška pri generisanju preporuka', 'err')
    }
  }

  // TRIGGER SCRAPER
  // =============================================
  async function triggerScraper() {
    setScraping(true)
    showToast('Scraping u toku... (može trajati do 2 min)')
    const res = await fetch('/api/scraper', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: process.env.NEXT_PUBLIC_SCRAPER_SECRET || '' })
    })
    setScraping(false)
    if (res.ok) {
      const d = await res.json()
      showToast(`Scraping završen. Nađeno ${d.totalPrices} cijena.`)
      fetchAll()
    } else {
      showToast('Scraping neuspješan — probaj manuelni unos', 'err')
    }
  }

  // =============================================
  // STATS za header
  // =============================================
  const pendingRecs = recommendations.filter(r => !r.is_applied)
  const increaseRecs = pendingRecs.filter(r => r.recommendation_type === 'increase').length
  const decreaseRecs = pendingRecs.filter(r => r.recommendation_type === 'decrease').length
  const lastScrape = compPrices.length > 0
    ? new Date(Math.max(...compPrices.map(p => new Date(p.scraped_at).getTime())))
    : null

  // =============================================
  // RENDER
  // =============================================
  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', color: '#e8e8f0', fontFamily: "'Outfit', 'Inter', sans-serif" }}>

      {/* Google Font */}
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap');`}</style>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          background: toast.type === 'ok' ? '#16a34a' : '#dc2626',
          color: '#fff', padding: '12px 20px', borderRadius: 10,
          fontSize: 14, fontWeight: 500, boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          animation: 'fadeIn .2s ease'
        }}>
          {toast.msg}
        </div>
      )}

      {/* HEADER */}
      <div style={{
        background: 'linear-gradient(135deg, #cc0000 0%, #8b0000 100%)',
        padding: '0 32px',
        boxShadow: '0 4px 30px rgba(204,0,0,0.3)'
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Car size={24} color="#fff" />
                <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.3px' }}>Planet</span>
                <span style={{ fontSize: 20, fontWeight: 300 }}>Price Intelligence</span>
              </div>
              <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>
                {lastScrape
                  ? `Zadnji podaci: ${lastScrape.toLocaleDateString('sr-Latn', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}`
                  : 'Nema podataka o konkurenciji'}
              </div>
            </div>

            {/* Stat pills */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {increaseRecs > 0 && (
                <div style={{ background: 'rgba(34,197,94,0.2)', border: '1px solid rgba(34,197,94,0.4)', padding: '6px 14px', borderRadius: 20, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <TrendingUp size={14} color="#22c55e" />
                  <span style={{ color: '#22c55e', fontWeight: 600 }}>{increaseRecs}</span>
                  <span style={{ color: 'rgba(255,255,255,0.7)' }}>možeš podići</span>
                </div>
              )}
              {decreaseRecs > 0 && (
                <div style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', padding: '6px 14px', borderRadius: 20, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <TrendingDown size={14} color="#ef4444" />
                  <span style={{ color: '#ef4444', fontWeight: 600 }}>{decreaseRecs}</span>
                  <span style={{ color: 'rgba(255,255,255,0.7)' }}>previsoko</span>
                </div>
              )}
              <button
                onClick={triggerScraper}
                disabled={scraping}
                style={{
                  background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)',
                  color: '#fff', padding: '6px 14px', borderRadius: 20, fontSize: 13,
                  cursor: scraping ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                  fontFamily: 'inherit'
                }}
              >
                <RefreshCw size={14} style={{ animation: scraping ? 'spin 1s linear infinite' : 'none' }} />
                {scraping ? 'Scrapujem...' : 'Osvježi podatke'}
              </button>
            </div>
          </div>

          {/* NAV TABS */}
          <div style={{ display: 'flex', gap: 4, marginTop: 20 }}>
            {[
              { id: 'overview',        label: 'Pregled',      icon: <BarChart3 size={14} /> },
              { id: 'competitors',     label: 'Konkurencija', icon: <Car size={14} /> },
              { id: 'manual',          label: 'Unos cijena',  icon: <Plus size={14} /> },
              { id: 'recommendations', label: `Preporuke (${pendingRecs.length})`, icon: <Zap size={14} /> },
            ].map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id as typeof activeTab)} style={{
                padding: '8px 16px', borderRadius: '8px 8px 0 0', fontSize: 13, fontWeight: 500,
                border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                background: activeTab === t.id ? '#0a0a0f' : 'rgba(0,0,0,0.3)',
                color: activeTab === t.id ? '#e8e8f0' : 'rgba(255,255,255,0.7)',
                fontFamily: 'inherit', transition: 'all .15s'
              }}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>

        {/* CATEGORY FILTER */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 28, flexWrap: 'wrap' }}>
          {[{ id: 'all', name_sr: 'Sve kategorije' }, ...CATEGORIES].map(c => (
            <button key={c.id} onClick={() => setSelectedCategory(c.id)} style={{
              padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500,
              border: `1px solid ${selectedCategory === c.id ? '#cc0000' : 'rgba(255,255,255,0.1)'}`,
              background: selectedCategory === c.id ? 'rgba(204,0,0,0.15)' : 'transparent',
              color: selectedCategory === c.id ? '#ff6666' : 'rgba(255,255,255,0.6)',
              cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s'
            }}>
              {c.name_sr}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 80, opacity: 0.4 }}>Učitavam...</div>
        ) : (
          <>
            {/* ========== TAB: OVERVIEW ========== */}
            {activeTab === 'overview' && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
                  {filteredMy.map(mp => {
                    const avg = avgComp(mp.category_id)
                    const mn = minComp(mp.category_id)
                    const mx = maxComp(mp.category_id)
                    const diff = avg > 0 ? Math.round((avg - mp.base_price) / avg * 100) : 0
                    const catName = CATEGORIES.find(c => c.id === mp.category_id)?.name_sr || mp.category_id
                    const isEditing = editingId === mp.id

                    return (
                      <div key={mp.id} style={{
                        background: '#13131a', border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 14, padding: 22, position: 'relative',
                        transition: 'border-color .2s',
                        borderLeft: `3px solid ${avg > 0 ? diffColor(diff) : '#333'}`
                      }}>
                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                          <div>
                            <div style={{ fontSize: 11, color: '#cc0000', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
                              {catName}
                            </div>
                            <div style={{ fontSize: 16, fontWeight: 600 }}>{mp.vehicle_model}</div>
                          </div>
                          {avg > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                              {diffIcon(diff)}
                              <span style={{ color: diffColor(diff), fontWeight: 600 }}>
                                {diff > 0 ? `+${diff}%` : `${diff}%`}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Moja cijena */}
                        <div style={{ marginBottom: 16 }}>
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>MOJA CIJENA / DAN</div>
                          {isEditing ? (
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              <div style={{ position: 'relative' }}>
                                <input
                                  type="number"
                                  value={editVal.base}
                                  onChange={e => setEditVal(v => ({ ...v, base: e.target.value }))}
                                  style={{
                                    background: '#1e1e2e', border: '1px solid #cc0000', borderRadius: 8,
                                    color: '#fff', padding: '8px 32px 8px 12px', width: 90, fontSize: 18, fontWeight: 600,
                                    fontFamily: 'inherit'
                                  }}
                                />
                                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>€</span>
                              </div>
                              <button onClick={() => savePrice(mp.id)} style={{ background: '#cc0000', border: 'none', borderRadius: 6, padding: '8px 12px', cursor: 'pointer', color: '#fff' }}>
                                <Save size={14} />
                              </button>
                              <button onClick={() => setEditingId(null)} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '8px 12px', cursor: 'pointer', color: 'rgba(255,255,255,0.5)' }}>
                                <X size={14} />
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span style={{ fontSize: 28, fontWeight: 700, color: '#fff' }}>{mp.base_price}€</span>
                              {mp.peak_price && (
                                <span style={{ fontSize: 13, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', padding: '2px 8px', borderRadius: 6 }}>
                                  Peak: {mp.peak_price}€
                                </span>
                              )}
                              <button onClick={() => { setEditingId(mp.id); setEditVal({ base: String(mp.base_price), peak: String(mp.peak_price || '') }) }}
                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', marginLeft: 'auto' }}>
                                <Edit3 size={14} />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Konkurencija */}
                        {avg > 0 ? (
                          <div style={{ background: '#0f0f18', borderRadius: 10, padding: '12px 14px' }}>
                            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 10 }}>KONKURENCIJA (zadnjih 14 dana)</div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                              {[
                                { label: 'Min', val: mn, color: '#22c55e' },
                                { label: 'Prosjek', val: avg, color: '#f59e0b' },
                                { label: 'Max', val: mx, color: '#ef4444' },
                              ].map(s => (
                                <div key={s.label} style={{ textAlign: 'center' }}>
                                  <div style={{ fontSize: 16, fontWeight: 600, color: s.color }}>{s.val}€</div>
                                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{s.label}</div>
                                </div>
                              ))}
                            </div>

                            {/* Bar visualizer */}
                            <div style={{ marginTop: 12, position: 'relative', height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3 }}>
                              <div style={{
                                position: 'absolute',
                                left: `${Math.max(0, Math.min(100, ((mp.base_price - mn * 0.8) / (mx * 1.2 - mn * 0.8)) * 100))}%`,
                                top: '50%', transform: 'translate(-50%, -50%)',
                                width: 12, height: 12, borderRadius: '50%',
                                background: diffColor(diff), border: '2px solid #0a0a0f',
                                zIndex: 2
                              }} title={`Tvoja cijena: ${mp.base_price}€`} />
                              {/* Min–Max range */}
                              <div style={{
                                position: 'absolute',
                                left: `${Math.max(0, ((mn - mn * 0.8) / (mx * 1.2 - mn * 0.8)) * 100)}%`,
                                right: `${Math.max(0, 100 - ((mx - mn * 0.8) / (mx * 1.2 - mn * 0.8)) * 100)}%`,
                                height: '100%', background: 'rgba(255,255,255,0.15)', borderRadius: 3
                              }} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>
                              <span>● Tvoja pozicija na skali</span>
                            </div>
                          </div>
                        ) : (
                          <div style={{ background: '#0f0f18', borderRadius: 10, padding: '14px', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>
                            Nema podataka o konkurenciji — unesi ručno
                          </div>
                        )}

                        {/* Footer */}
                        <div style={{ marginTop: 12, fontSize: 11, color: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Clock size={10} />
                          Ažurirano: {new Date(mp.updated_at).toLocaleDateString('sr-Latn')}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {filteredMy.length === 0 && (
                  <div style={{ textAlign: 'center', padding: 60, opacity: 0.4 }}>
                    Nema vozila za odabranu kategoriju. Dodaj ih u Supabase tabelu my_prices.
                  </div>
                )}
              </div>
            )}

            {/* ========== TAB: COMPETITORS ========== */}
            {activeTab === 'competitors' && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                  {COMPETITORS.map(comp => {
                    const prices = compPrices.filter(p => p.competitor_id === comp.id)
                    const filtered = selectedCategory === 'all' ? prices : prices.filter(p => p.category_id === selectedCategory)

                    return (
                      <div key={comp.id} style={{ background: '#13131a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 18 }}>
                        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 14 }}>{comp.name}</div>
                        {filtered.length === 0 ? (
                          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: 20 }}>
                            Nema podataka — idi na "Unos cijena"
                          </div>
                        ) : (
                          filtered.map(p => (
                            <div key={p.id} style={{
                              display: 'flex', justifyContent: 'space-between',
                              padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)',
                              fontSize: 13
                            }}>
                              <div>
                                <div style={{ fontWeight: 500 }}>{p.vehicle_model}</div>
                                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                                  {CATEGORIES.find(c => c.id === p.category_id)?.name_sr}
                                  {p.is_manual && <span style={{ marginLeft: 6, color: '#f59e0b' }}>✎ manuelno</span>}
                                </div>
                              </div>
                              <div style={{ fontWeight: 700, color: '#fff', fontSize: 16 }}>{p.price_per_day}€</div>
                            </div>
                          ))
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ========== TAB: MANUAL ENTRY ========== */}
            {activeTab === 'manual' && (
              <div style={{ maxWidth: 560 }}>
                <div style={{ background: '#13131a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 28 }}>
                  <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>Ručni unos cijena konkurencije</h2>
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 24 }}>
                    Unesi cijenu koju si vidio na sajtu ili rezervisao test
                  </p>

                  <form onSubmit={submitManual}>
                    <div style={{ display: 'grid', gap: 16 }}>
                      <div>
                        <label style={labelStyle}>Konkurent</label>
                        <select value={manualForm.competitor_id} onChange={e => setManualForm(f => ({ ...f, competitor_id: e.target.value }))} style={selectStyle}>
                          {COMPETITORS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>

                      <div>
                        <label style={labelStyle}>Kategorija vozila</label>
                        <select value={manualForm.category_id} onChange={e => setManualForm(f => ({ ...f, category_id: e.target.value }))} style={selectStyle}>
                          {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.name_sr}</option>)}
                        </select>
                      </div>

                      <div>
                        <label style={labelStyle}>Model vozila (opcionalno)</label>
                        <input
                          type="text" placeholder="npr. Renault Clio"
                          value={manualForm.vehicle_model}
                          onChange={e => setManualForm(f => ({ ...f, vehicle_model: e.target.value }))}
                          style={inputStyle}
                        />
                      </div>

                      <div>
                        <label style={labelStyle}>Cijena po danu (€) *</label>
                        <input
                          type="number" step="0.01" placeholder="45.00" required
                          value={manualForm.price_per_day}
                          onChange={e => setManualForm(f => ({ ...f, price_per_day: e.target.value }))}
                          style={inputStyle}
                        />
                      </div>

                      <div>
                        <label style={labelStyle}>Napomena</label>
                        <input
                          type="text" placeholder="npr. cijena za jul 2025, min 3 dana"
                          value={manualForm.notes}
                          onChange={e => setManualForm(f => ({ ...f, notes: e.target.value }))}
                          style={inputStyle}
                        />
                      </div>

                      <button type="submit" style={{
                        background: '#cc0000', border: 'none', borderRadius: 10,
                        color: '#fff', padding: '12px 24px', fontSize: 14, fontWeight: 600,
                        cursor: 'pointer', fontFamily: 'inherit', marginTop: 8,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                      }}>
                        <Plus size={16} /> Unesi cijenu
                      </button>
                    </div>
                  </form>
                </div>

                {/* Zadnji unosi */}
                {compPrices.filter(p => p.is_manual).length > 0 && (
                  <div style={{ marginTop: 24, background: '#13131a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 20 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 14, color: 'rgba(255,255,255,0.7)' }}>Zadnji manuelni unosi</h3>
                    {compPrices.filter(p => p.is_manual).slice(0, 8).map(p => (
                      <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 12 }}>
                        <span style={{ color: 'rgba(255,255,255,0.6)' }}>
                          {COMPETITORS.find(c => c.id === p.competitor_id)?.name} · {CATEGORIES.find(c => c.id === p.category_id)?.name_sr}
                          {p.vehicle_model && ` · ${p.vehicle_model}`}
                        </span>
                        <span style={{ fontWeight: 600 }}>{p.price_per_day}€</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ========== TAB: RECOMMENDATIONS ========== */}
            {activeTab === 'recommendations' && (
              <div>
                {/* Dugme za generisanje preporuka */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
                  <button onClick={generateRecommendations} disabled={generatingRecs} style={{
                    background: '#cc0000', border: 'none', borderRadius: 10,
                    color: '#fff', padding: '10px 20px', fontSize: 13, fontWeight: 600,
                    cursor: generatingRecs ? 'wait' : 'pointer',
                    display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'inherit'
                  }}>
                    <Zap size={14} style={{ animation: generatingRecs ? 'spin 1s linear infinite' : 'none' }} />
                    {generatingRecs ? 'Generiše...' : 'Generiši preporuke'}
                  </button>
                </div>
                {pendingRecs.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 60 }}>
                    <CheckCircle size={48} style={{ color: '#22c55e', margin: '0 auto 16px', display: 'block' }} />
                    <div style={{ fontSize: 16, fontWeight: 500 }}>Sve cijene su optimalne!</div>
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 8 }}>
                      Nema aktivnih preporuka. Klikni "Generiši preporuke" da analiziraš podatke.
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {pendingRecs.map(rec => {
                      const catName = CATEGORIES.find(c => c.id === rec.category_id)?.name_sr
                      const isUp = rec.recommendation_type === 'increase'

                      return (
                        <div key={rec.id} style={{
                          background: '#13131a',
                          border: `1px solid ${isUp ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
                          borderLeft: `4px solid ${isUp ? '#22c55e' : '#ef4444'}`,
                          borderRadius: 14, padding: 20,
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          flexWrap: 'wrap', gap: 16
                        }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                              {isUp
                                ? <TrendingUp size={16} color="#22c55e" />
                                : <TrendingDown size={16} color="#ef4444" />
                              }
                              <span style={{ fontWeight: 600 }}>{catName} {rec.vehicle_model && `— ${rec.vehicle_model}`}</span>
                            </div>
                            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 10 }}>{rec.reason}</div>
                            <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
                              <span>Trenutno: <strong>{rec.current_price}€</strong></span>
                              <span style={{ color: 'rgba(255,255,255,0.3)' }}>→</span>
                              <span>Preporučeno: <strong style={{ color: isUp ? '#22c55e' : '#ef4444' }}>{rec.recommended_price}€</strong></span>
                              <span style={{ color: 'rgba(255,255,255,0.4)' }}>Prosjek konk.: {rec.avg_competitor_price}€</span>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={() => applyRecommendation(rec)} style={{
                              background: isUp ? '#16a34a' : '#dc2626',
                              border: 'none', borderRadius: 8, color: '#fff',
                              padding: '10px 18px', fontSize: 13, fontWeight: 600,
                              cursor: 'pointer', fontFamily: 'inherit'
                            }}>
                              Primijeni
                            </button>
                            <button style={{
                              background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
                              borderRadius: 8, color: 'rgba(255,255,255,0.4)',
                              padding: '10px 18px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit'
                            }}>
                              Ignoriši
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-8px) } to { opacity: 1; transform: none } }
        * { box-sizing: border-box; }
        input:focus, select:focus { outline: 1px solid #cc0000; }
        button:hover { opacity: 0.88; }
      `}</style>
    </div>
  )
}

// =============================================
// SHARED STYLES
// =============================================
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.5)',
  marginBottom: 6, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: '#0f0f18', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8, color: '#e8e8f0', padding: '10px 14px', fontSize: 14,
  fontFamily: "'Outfit', inherit"
}

const selectStyle: React.CSSProperties = {
  ...inputStyle, cursor: 'pointer', appearance: 'none'
}
