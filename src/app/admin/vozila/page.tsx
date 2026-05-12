'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Vehicle = {
  id: string; name: string; category: string; price_per_day: number
  seats: number; transmission: string; fuel_type: string; features: string[]
  is_available: boolean; year: number; image_url: string | null
  vin: string | null; license_plate: string | null; color: string | null
  engine_cc: number | null; purchase_date: string | null; purchase_price: number | null
  purchase_from: string | null; current_mileage: number | null
  fleet_status: string | null; fleet_notes: string | null
  model_group: string | null
  vehicle_locations?: { location_id: string }[]
}

type FleetVehicle = {
  id: number; license_plate: string | null; agregirani_2: string | null
  marka: string | null; model: string | null; fleet_status: string
  lokacija: string; model_group: string | null; vehicle_class: string | null
}

type LocationItem = { id: string; name: string; city: string; country: string }

const CLASS_ICONS: Record<string, string> = {
  'Hatchback': '🚗', 'Medium': '🚗', 'Sedan': '🚗', 'SUV': '🚙',
  'Station Wagon': '🚗', 'Luxury': '🏎️', 'Van': '🚐', 'Convertible': '🚘',
}

const VEHICLE_CLASSES = ['Hatchback', 'Medium', 'Sedan', 'SUV', 'Station Wagon', 'Luxury', 'Van', 'Convertible']

// Čisti naziv vozila za prikaz na sajtu
function cleanName(v: Vehicle): string {
  const trans = v.transmission === 'automatic' ? 'Automatik' : ''
  const fuel = v.fuel_type === 'diesel' ? 'TDI' : v.fuel_type === 'petrol' ? 'TSI' : v.fuel_type === 'electric' ? 'EV' : ''
  // Ako korisnik unese npr "Audi A4 2.0 TDI KARAVAN PGMR606 2008 MANUAL" — vraćamo clean naziv
  // Koristimo polje name direktno ali ga možemo i generisati
  return v.name
}

const empty = {
  name: '', category: 'Hatchback', price_per_day: '', seats: '5',
  transmission: 'manual', fuel_type: 'diesel', features: '',
  year: String(new Date().getFullYear()), is_available: true,
  image_url: '', selectedLocations: [] as string[],
  vin: '', license_plate: '', color: '', engine_cc: '',
  purchase_date: '', purchase_price: '', purchase_from: '',
  current_mileage: '', fleet_status: 'available', fleet_notes: '',
  model_group: '',
}

export default function AdminVozilaPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [fleetVehicles, setFleetVehicles] = useState<FleetVehicle[]>([])
  const [locationsList, setLocationsList] = useState<LocationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editVehicle, setEditVehicle] = useState<Vehicle | null>(null)
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  // Grupisanje modela — koji fleet auti su vezani za koji vehicle
  const [showGroupModal, setShowGroupModal] = useState(false)
  const [groupVehicle, setGroupVehicle] = useState<Vehicle | null>(null)
  const [groupSearch, setGroupSearch] = useState('')
  const [groupSaving, setGroupSaving] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [{ data: veh }, { data: fleet }] = await Promise.all([
      supabase.from('vehicles').select('*, vehicle_locations(location_id)').order('name'),
      supabase.from('vozila_fleet').select('id, license_plate, agregirani_2, marka, model, fleet_status, lokacija, model_group, vehicle_class').order('marka'),
    ])
    setVehicles(veh || [])
    setFleetVehicles(fleet || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData()
    fetch('/api/locations').then(r => r.json()).then(d => setLocationsList(d.locations || []))
  }, [fetchData])

  // Broji slobodna fleet vozila za dati model_group
  function countFleet(modelGroup: string | null) {
    if (!modelGroup) return { total: 0, slobodna: 0 }
    const grupa = fleetVehicles.filter(f => f.model_group === modelGroup)
    const slobodna = grupa.filter(f => f.fleet_status === 'available').length
    return { total: grupa.length, slobodna }
  }

  function openEdit(v: Vehicle) {
    setEditVehicle(v)
    const selectedLocations = (v.vehicle_locations || []).map(vl => vl.location_id)
    setForm({
      name: v.name, category: v.category, price_per_day: String(v.price_per_day),
      seats: String(v.seats), transmission: v.transmission, fuel_type: v.fuel_type,
      features: (v.features || []).join(', '), year: String(v.year || ''),
      is_available: v.is_available, image_url: v.image_url || '',
      selectedLocations, vin: v.vin || '', license_plate: v.license_plate || '',
      color: v.color || '', engine_cc: String(v.engine_cc || ''),
      purchase_date: v.purchase_date || '', purchase_price: String(v.purchase_price || ''),
      purchase_from: v.purchase_from || '', current_mileage: String(v.current_mileage || ''),
      fleet_status: v.fleet_status || 'available', fleet_notes: v.fleet_notes || '',
      model_group: v.model_group || '',
    })
    setShowForm(true)
  }

  function toggleLocation(locationId: string) {
    setForm(f => ({
      ...f,
      selectedLocations: f.selectedLocations.includes(locationId)
        ? f.selectedLocations.filter(id => id !== locationId)
        : [...f.selectedLocations, locationId]
    }))
  }

  async function uploadImage(file: File): Promise<string | null> {
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `vehicles/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('vehicle-images').upload(path, file, { upsert: true })
    if (error) { setUploading(false); return null }
    const { data } = supabase.storage.from('vehicle-images').getPublicUrl(path)
    setUploading(false)
    return data.publicUrl
  }

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const url = await uploadImage(file)
    if (url) setForm(f => ({ ...f, image_url: url }))
  }

  async function saveVehicle() {
    if (!form.name || !form.price_per_day) return
    setSaving(true)
    const payload = {
      name: form.name, category: form.category,
      price_per_day: parseFloat(form.price_per_day),
      seats: parseInt(form.seats), transmission: form.transmission,
      fuel_type: form.fuel_type,
      features: form.features.split(',').map(s => s.trim()).filter(Boolean),
      year: parseInt(form.year) || null, is_available: form.is_available,
      image_url: form.image_url || null,
      vin: form.vin || null, license_plate: form.license_plate || null,
      color: form.color || null,
      engine_cc: form.engine_cc ? parseInt(form.engine_cc) : null,
      purchase_date: form.purchase_date || null,
      purchase_price: form.purchase_price ? parseFloat(form.purchase_price) : null,
      purchase_from: form.purchase_from || null,
      current_mileage: form.current_mileage ? parseInt(form.current_mileage) : null,
      fleet_status: form.fleet_status || 'available',
      fleet_notes: form.fleet_notes || null,
      model_group: form.model_group || null,
    }

    let vehicleId = editVehicle?.id
    if (editVehicle) {
      await supabase.from('vehicles').update(payload).eq('id', editVehicle.id)
    } else {
      const { data } = await supabase.from('vehicles').insert(payload).select().single()
      vehicleId = data?.id
    }

    if (vehicleId) {
      await supabase.from('vehicle_locations').delete().eq('vehicle_id', vehicleId)
      if (form.selectedLocations.length > 0) {
        await supabase.from('vehicle_locations').insert(
          form.selectedLocations.map(lid => ({ vehicle_id: vehicleId, location_id: lid }))
        )
      }
    }

    setSaving(false); setShowForm(false); fetchData()
  }

  async function toggleAvail(id: string, cur: boolean) {
    await supabase.from('vehicles').update({ is_available: !cur }).eq('id', id)
    fetchData()
  }

  async function deleteVehicle(id: string) {
    if (!confirm('Obrisati ovo vozilo?')) return
    await supabase.from('vehicle_locations').delete().eq('vehicle_id', id)
    await supabase.from('vehicles').delete().eq('id', id)
    fetchData()
  }

  // Grupisanje — veži/otveži fleet vozilo
  async function toggleFleetGroup(fleetId: number, currentGroup: string | null, targetGroup: string) {
    setGroupSaving(true)
    if (currentGroup === targetGroup) {
      // Otveži
      await supabase.from('vozila_fleet').update({ model_group: null }).eq('id', fleetId)
    } else {
      // Veži
      await supabase.from('vozila_fleet').update({ model_group: targetGroup }).eq('id', fleetId)
    }
    // Optimistički update
    setFleetVehicles(prev => prev.map(f =>
      f.id === fleetId ? { ...f, model_group: currentGroup === targetGroup ? null : targetGroup } : f
    ))
    setGroupSaving(false)
  }

  function openGroupModal(v: Vehicle) {
    setGroupVehicle(v)
    setGroupSearch('')
    setShowGroupModal(true)
  }

  const inp: React.CSSProperties = { width: '100%', padding: '8px 12px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', color: '#111', boxSizing: 'border-box' }
  const lbl: React.CSSProperties = { fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }

  const filteredFleet = fleetVehicles.filter(f => {
    if (!groupSearch) return true
    const q = groupSearch.toLowerCase()
    return (f.agregirani_2 || '').toLowerCase().includes(q) ||
      (f.license_plate || '').toLowerCase().includes(q) ||
      (f.marka || '').toLowerCase().includes(q)
  })

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#111', margin: 0 }}>Vozila (Sajt)</h1>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
            Svaki unos predstavlja jedan model koji se prikazuje na sajtu. Slobodnost se računa iz flote.
          </p>
        </div>
        <button onClick={() => { setEditVehicle(null); setForm(empty); setShowForm(true) }}
          style={{ padding: '8px 16px', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          + Dodaj model
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: showForm ? '1fr 360px' : '1fr', gap: 16 }}>

        {/* LISTA VOZILA */}
        <div>
          {loading ? (
            <div style={{ padding: 24, color: '#9ca3af', fontSize: 13 }}>Učitavanje...</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14, alignContent: 'start' }}>
              {vehicles.map(v => {
                const { total, slobodna } = countFleet(v.model_group)
                const hasGroup = !!v.model_group
                const icon = CLASS_ICONS[v.category] || '🚗'

                return (
                  <div key={v.id} style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', background: '#fff', display: 'flex', flexDirection: 'column' }}>
                    {/* Slika */}
                    <div style={{ height: 150, background: '#f3f4f6', position: 'relative', overflow: 'hidden' }}>
                      {v.image_url ? (
                        <img src={v.image_url} alt={v.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48, color: '#d1d5db' }}>{icon}</div>
                      )}
                      {/* Dostupnost badge */}
                      <div style={{ position: 'absolute', top: 8, left: 8 }}>
                        {hasGroup ? (
                          slobodna > 0 ? (
                            <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 20, fontWeight: 700, background: '#E1F5EE', color: '#085041' }}>
                              ✓ {slobodna} slobodna
                            </span>
                          ) : (
                            <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 20, fontWeight: 700, background: '#FCEBEB', color: '#791F1F' }}>
                              Zauzeto
                            </span>
                          )
                        ) : (
                          <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 20, fontWeight: 700, background: '#FAEEDA', color: '#633806' }}>
                            ⚠️ Bez grupe
                          </span>
                        )}
                      </div>
                      <div style={{ position: 'absolute', top: 8, right: 8 }}>
                        <button onClick={() => toggleAvail(v.id, v.is_available)}
                          style={{ fontSize: 11, padding: '3px 8px', borderRadius: 20, border: 'none', cursor: 'pointer', fontWeight: 500, background: v.is_available ? 'rgba(29,158,117,0.9)' : 'rgba(107,114,128,0.9)', color: '#fff' }}>
                          {v.is_available ? 'Aktivan' : 'Sakriven'}
                        </button>
                      </div>
                    </div>

                    {/* Info */}
                    <div style={{ padding: '12px 14px', flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: '#111', marginBottom: 2 }}>{v.name}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 6, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <span>{v.category}</span>
                        {v.year && <span>· {v.year}</span>}
                        <span>· {v.transmission === 'automatic' ? 'Automatik' : 'Manual'}</span>
                        <span>· {v.fuel_type === 'diesel' ? 'Dizel' : v.fuel_type === 'petrol' ? 'Benzin' : v.fuel_type}</span>
                      </div>

                      {/* Fleet info */}
                      {hasGroup && (
                        <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, padding: '6px 10px', marginBottom: 8, fontSize: 12 }}>
                          <span style={{ color: '#6b7280' }}>Flota: </span>
                          <span style={{ fontWeight: 600, color: '#111' }}>{total} vozila</span>
                          <span style={{ color: '#6b7280' }}> · </span>
                          <span style={{ fontWeight: 600, color: slobodna > 0 ? '#1D9E75' : '#dc2626' }}>{slobodna} slobodnih</span>
                          <span style={{ fontSize: 10, color: '#9ca3af', marginLeft: 6 }}>({v.model_group})</span>
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                        <span style={{ fontSize: 17, fontWeight: 700, color: '#1D9E75' }}>
                          {v.price_per_day}€<span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 400 }}>/dan</span>
                        </span>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => openGroupModal(v)}
                            title="Poveži sa flotom"
                            style={{ padding: '5px 10px', fontSize: 11, border: `1px solid ${hasGroup ? '#1D9E75' : '#f59e0b'}`, borderRadius: 6, background: hasGroup ? '#E1F5EE' : '#FAEEDA', cursor: 'pointer', color: hasGroup ? '#085041' : '#633806', fontWeight: 600 }}>
                            🔗 {hasGroup ? `${total}` : 'Veži'}
                          </button>
                          <button onClick={() => openEdit(v)}
                            style={{ padding: '5px 10px', fontSize: 11, border: '1px solid #d1d5db', borderRadius: 6, background: 'transparent', cursor: 'pointer', color: '#6b7280' }}>
                            ✏️
                          </button>
                          <button onClick={() => deleteVehicle(v.id)}
                            style={{ padding: '5px 8px', fontSize: 11, border: '1px solid #fecaca', borderRadius: 6, background: 'transparent', cursor: 'pointer', color: '#dc2626' }}>
                            ✕
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}

              {vehicles.length === 0 && (
                <div style={{ gridColumn: '1 / -1', padding: 40, textAlign: 'center', color: '#9ca3af', border: '1px dashed #e5e7eb', borderRadius: 12 }}>
                  Nema vozila. Dodaj model koji će se prikazivati na sajtu.
                </div>
              )}
            </div>
          )}
        </div>

        {/* FORMA */}
        {showForm && (
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 20, background: '#fff', alignSelf: 'start', position: 'sticky', top: 20, maxHeight: 'calc(100vh - 80px)', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#111' }}>{editVehicle ? 'Uredi model' : 'Novi model'}</div>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#9ca3af' }}>✕</button>
            </div>

            {/* Slika */}
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Slika vozila</label>
              {form.image_url && (
                <div style={{ marginBottom: 8, borderRadius: 8, overflow: 'hidden', height: 100 }}>
                  <img src={form.image_url} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              )}
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px', border: '1px dashed #d1d5db', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: '#6b7280', background: '#f9fafb' }}>
                {uploading ? 'Uploaduje se...' : '+ Odaberi sliku'}
                <input type="file" accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} disabled={uploading} />
              </label>
              {form.image_url && <button type="button" onClick={() => setForm(f => ({ ...f, image_url: '' }))} style={{ marginTop: 4, fontSize: 11, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Ukloni</button>}
            </div>

            {/* Naziv */}
            <div style={{ marginBottom: 10 }}>
              <label style={lbl}>Naziv za prikaz na sajtu *</label>
              <input style={inp} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="npr. Audi A4 TDI 2008" />
              <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 3 }}>Kratko i jasno — bez tablica, bez "MANUAL"</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div>
                <label style={lbl}>Klasa (sajt filter)</label>
                <select style={inp} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {VEHICLE_CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Cijena/dan (€) *</label>
                <input style={inp} type="number" value={form.price_per_day} onChange={e => setForm(f => ({ ...f, price_per_day: e.target.value }))} placeholder="70" />
              </div>
              <div>
                <label style={lbl}>Transmisija</label>
                <select style={inp} value={form.transmission} onChange={e => setForm(f => ({ ...f, transmission: e.target.value }))}>
                  <option value="manual">Manual</option>
                  <option value="automatic">Automatik</option>
                </select>
              </div>
              <div>
                <label style={lbl}>Gorivo</label>
                <select style={inp} value={form.fuel_type} onChange={e => setForm(f => ({ ...f, fuel_type: e.target.value }))}>
                  <option value="diesel">Dizel</option>
                  <option value="petrol">Benzin</option>
                  <option value="electric">Električno</option>
                  <option value="hybrid">Hibrid</option>
                </select>
              </div>
              <div>
                <label style={lbl}>Mjesta</label>
                <input style={inp} type="number" value={form.seats} onChange={e => setForm(f => ({ ...f, seats: e.target.value }))} />
              </div>
              <div>
                <label style={lbl}>Godište</label>
                <input style={inp} type="number" value={form.year} onChange={e => setForm(f => ({ ...f, year: e.target.value }))} />
              </div>
            </div>

            <div style={{ marginBottom: 10 }}>
              <label style={lbl}>Oprema (zarezom)</label>
              <input style={inp} value={form.features} onChange={e => setForm(f => ({ ...f, features: e.target.value }))} placeholder="Klima, GPS, Bluetooth" />
            </div>

            {/* Model group */}
            <div style={{ marginBottom: 14, background: '#f0fdf8', border: '1px solid #5DCAA5', borderRadius: 8, padding: '10px 12px' }}>
              <label style={{ ...lbl, color: '#085041', fontWeight: 600 }}>🔗 Model ključ (grupa flote)</label>
              <input style={inp} value={form.model_group} onChange={e => setForm(f => ({ ...f, model_group: e.target.value }))} placeholder="npr. ford-fiesta, audi-a4-tdi" />
              <div style={{ fontSize: 10, color: '#0F6E56', marginTop: 3 }}>Unesite isti ključ u fleet vozilima za automatsko grupiranje</div>
            </div>

            {/* Lokacije */}
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Dostupne lokacije</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {locationsList.map(l => (
                  <label key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, padding: '5px 8px', border: `1px solid ${form.selectedLocations.includes(l.id) ? '#5DCAA5' : '#e5e7eb'}`, borderRadius: 8, background: form.selectedLocations.includes(l.id) ? '#f0fdf8' : '#fff' }}>
                    <input type="checkbox" checked={form.selectedLocations.includes(l.id)} onChange={() => toggleLocation(l.id)} style={{ accentColor: '#1D9E75' }} />
                    <span style={{ color: '#111' }}>{l.name}</span>
                    <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 'auto' }}>{l.country}</span>
                  </label>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <input type="checkbox" id="avail" checked={form.is_available} onChange={e => setForm(f => ({ ...f, is_available: e.target.checked }))} />
              <label htmlFor="avail" style={{ fontSize: 13, cursor: 'pointer', color: '#374151' }}>Prikazuj na sajtu</label>
            </div>

            <button onClick={saveVehicle} disabled={saving || uploading}
              style={{ width: '100%', padding: 10, background: saving ? '#5DCAA5' : '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Snimanje...' : editVehicle ? 'Sačuvaj izmjene' : 'Dodaj model'}
            </button>
          </div>
        )}
      </div>

      {/* MODAL ZA GRUPIRANJE */}
      {showGroupModal && groupVehicle && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 600, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>🔗 Poveži sa flotom</div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Model: <strong>{groupVehicle.name}</strong></div>
                {groupVehicle.model_group && (
                  <div style={{ fontSize: 11, color: '#1D9E75', marginTop: 2 }}>Ključ: <code style={{ background: '#f3f4f6', padding: '0 4px', borderRadius: 3 }}>{groupVehicle.model_group}</code></div>
                )}
              </div>
              <button onClick={() => setShowGroupModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#9ca3af' }}>✕</button>
            </div>

            {/* Info */}
            {!groupVehicle.model_group && (
              <div style={{ margin: '12px 20px 0', padding: '10px 12px', background: '#FAEEDA', border: '1px solid #f59e0b', borderRadius: 8, fontSize: 12, color: '#633806' }}>
                ⚠️ Ovaj model nema model ključ. Postavi ga u formi editovanja pa se ovde automatski prikazuju vezana vozila.
              </div>
            )}

            {/* Pretraga */}
            <div style={{ padding: '12px 20px' }}>
              <input value={groupSearch} onChange={e => setGroupSearch(e.target.value)}
                placeholder="Pretraži po tablicama, modelu..."
                style={{ width: '100%', padding: '8px 12px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, color: '#111', boxSizing: 'border-box' as const }} />
            </div>

            {/* Lista fleet vozila */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 20px' }}>
              {/* Vezana vozila */}
              {groupVehicle.model_group && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#1D9E75', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                    Vezana vozila ({fleetVehicles.filter(f => f.model_group === groupVehicle.model_group).length})
                  </div>
                  {fleetVehicles.filter(f => f.model_group === groupVehicle.model_group).map(f => (
                    <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', border: '1px solid #5DCAA5', borderRadius: 8, background: '#f0fdf8', marginBottom: 6 }}>
                      <div>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#111' }}>{f.agregirani_2 || `${f.marka} ${f.model}`}</span>
                        <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#6b7280', marginLeft: 8 }}>{f.license_plate}</span>
                        <span style={{ fontSize: 10, color: f.fleet_status === 'available' ? '#1D9E75' : '#9ca3af', marginLeft: 8 }}>{f.fleet_status === 'available' ? '✓ Slobodno' : f.fleet_status}</span>
                      </div>
                      <button onClick={() => toggleFleetGroup(f.id, f.model_group, groupVehicle.model_group!)} disabled={groupSaving}
                        style={{ padding: '4px 10px', fontSize: 11, border: '1px solid #fecaca', borderRadius: 6, background: '#FCEBEB', cursor: 'pointer', color: '#dc2626' }}>
                        Otveži
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Nevezana vozila */}
              <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                Ostala fleet vozila
              </div>
              {filteredFleet.filter(f => f.model_group !== groupVehicle.model_group).map(f => (
                <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 12px', border: '1px solid #f3f4f6', borderRadius: 8, background: '#fff', marginBottom: 4 }}>
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 500, color: '#374151' }}>{f.agregirani_2 || `${f.marka} ${f.model}`}</span>
                    <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#9ca3af', marginLeft: 8 }}>{f.license_plate}</span>
                    {f.model_group && <span style={{ fontSize: 10, color: '#f59e0b', marginLeft: 8 }}>→ {f.model_group}</span>}
                    <span style={{ fontSize: 10, color: '#9ca3af', marginLeft: 8 }}>📍 {f.lokacija}</span>
                  </div>
                  {groupVehicle.model_group && (
                    <button onClick={() => toggleFleetGroup(f.id, f.model_group, groupVehicle.model_group!)} disabled={groupSaving}
                      style={{ padding: '4px 10px', fontSize: 11, border: '1px solid #5DCAA5', borderRadius: 6, background: '#E1F5EE', cursor: 'pointer', color: '#085041' }}>
                      + Veži
                    </button>
                  )}
                </div>
              ))}
              {filteredFleet.filter(f => f.model_group !== groupVehicle.model_group).length === 0 && (
                <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Nema više vozila.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
