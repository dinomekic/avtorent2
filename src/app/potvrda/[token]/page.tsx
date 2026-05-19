'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useParams } from 'next/navigation'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const LOGO_URL = 'https://planetrentacar.me/wp-content/uploads/2023/03/logo-1.png'
const UPLOAD_FOLDER = '1gFiCAgolZu9fAn5d-Ngmsx9qp3hWdIkN'

type Reservation = {
  id: string; ref_code: string; guest_name: string; guest_email: string
  guest_phone: string; pickup_date: string; return_date: string
  pickup_time: string; return_time: string; pickup_location: string
  dropoff_location: string | null; total_price: number; final_total: number | null
  insurance: string | null; insurance_total: number | null
  extras_total: number | null; transfer_fee: number | null
  assigned_vehicle_name: string | null; assigned_vehicle_plate: string | null
  agent_note: string | null; license_url: string | null
  inquiry_status: string | null; notes: string | null
  flight_number: string | null; border_crossing: string | null
}

export default function PotvrdastranicaPage() {
  const params = useParams()
  const token = params?.token as string

  const [rez, setRez] = useState<Reservation | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  const [uploading, setUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState('')
  const [licenseUrl, setLicenseUrl] = useState('')
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    if (!token) return
    supabase.from('reservations')
      .select('*')
      .eq('confirmation_token', token)
      .single()
      .then(({ data, error }) => {
        if (error || !data) { setNotFound(true); setLoading(false); return }
        setRez(data)
        setLicenseUrl(data.license_url || '')
        setConfirmed(data.inquiry_status === 'confirmed')
        setLoading(false)
      })
  }, [token])

  async function uploadLicense(file: File): Promise<string | null> {
    setUploading(true)
    setUploadStatus('⏳ Uploading...')
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1]
        try {
          const res = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ base64, contentType: file.type, name: `VOZACKA_${rez?.ref_code}_${Date.now()}`, folderId: UPLOAD_FOLDER })
          })
          const json = await res.json()
          setUploading(false)
          if (json.status === 'success') {
            setUploadStatus('✅ Dokument uploadovan')
            resolve(json.url)
          } else {
            setUploadStatus('❌ Greška pri uploadu')
            resolve(null)
          }
        } catch {
          setUploading(false)
          setUploadStatus('❌ Greška')
          resolve(null)
        }
      }
    })
  }

  async function handleConfirm() {
    if (!rez) return
    if (!licenseUrl) { alert('Molimo uploadujte vozačku dozvolu!'); return }
    setConfirming(true)
    await supabase.from('reservations').update({
      license_url: licenseUrl,
      inquiry_status: 'confirmed',
      status: 'confirmed',
    }).eq('id', rez.id)
    setConfirmed(true)
    setConfirming(false)
  }

  function daysBetween(from: string, to: string): number {
    return Math.max(1, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000))
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb' }}>
      <div style={{ color: '#9ca3af', fontSize: 14 }}>Učitavanje...</div>
    </div>
  )

  if (notFound) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f9fafb', padding: 24 }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#111', marginBottom: 8 }}>Link nije validan</div>
      <div style={{ fontSize: 14, color: '#6b7280' }}>Ovaj link za potvrdu ne postoji ili je istekao.</div>
    </div>
  )

  if (confirmed) return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', padding: 24 }}>
      <div style={{ maxWidth: 560, margin: '40px auto', background: '#fff', borderRadius: 16, padding: 32, border: '1px solid #e5e7eb', textAlign: 'center' }}>
        <img src={LOGO_URL} alt="Planet Rent a Car" style={{ height: 48, objectFit: 'contain', marginBottom: 24 }} />
        <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#085041', marginBottom: 8 }}>Rezervacija potvrđena!</div>
        <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 24 }}>
          Hvala {rez?.guest_name}! Vaša rezervacija <strong>{rez?.ref_code}</strong> je potvrđena.
          Kontaktiraćemo vas uskoro sa svim detaljima.
        </div>
        <div style={{ background: '#E1F5EE', border: '1px solid #1D9E75', borderRadius: 10, padding: '14px 16px', textAlign: 'left' }}>
          {rez?.assigned_vehicle_name && (
            <div style={{ fontSize: 13, marginBottom: 6 }}>🚗 <strong>{rez.assigned_vehicle_name}</strong></div>
          )}
          <div style={{ fontSize: 13, marginBottom: 4 }}>📅 {rez?.pickup_date} → {rez?.return_date}</div>
          <div style={{ fontSize: 13, marginBottom: 4 }}>📍 {rez?.pickup_location}</div>
          {rez?.agent_note && <div style={{ fontSize: 13, color: '#085041', marginTop: 8, fontStyle: 'italic' }}>💬 {rez.agent_note}</div>}
        </div>
      </div>
    </div>
  )

  if (!rez) return null

  const days = daysBetween(rez.pickup_date, rez.return_date)
  const total = rez.final_total || rez.total_price

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', padding: 16 }}>
      <div style={{ maxWidth: 560, margin: '0 auto', paddingBottom: 40 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', padding: '24px 0 16px' }}>
          <img src={LOGO_URL} alt="Planet Rent a Car" style={{ height: 44, objectFit: 'contain', marginBottom: 8 }} />
          <div style={{ fontSize: 13, color: '#9ca3af' }}>Potvrda rezervacije</div>
        </div>

        {/* Ref */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '14px 16px', marginBottom: 12, textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>Broj upita</div>
          <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'monospace', color: '#111' }}>{rez.ref_code}</div>
        </div>

        {/* Vozilo */}
        {rez.assigned_vehicle_name && (
          <div style={{ background: '#E1F5EE', border: '1px solid #1D9E75', borderRadius: 12, padding: '14px 16px', marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: '#085041', fontWeight: 700, marginBottom: 4 }}>DODIJELJENO VOZILO</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#085041' }}>🚗 {rez.assigned_vehicle_name}</div>
          </div>
        )}

        {/* Detalji rezervacije */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '14px 16px', marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#111', marginBottom: 10 }}>Detalji rezervacije</div>
          {[
            ['Klijent', rez.guest_name],
            ['Period', `${rez.pickup_date} → ${rez.return_date}`],
            ['Trajanje', `${days} dan${days > 1 ? 'a' : ''}`],
            ['Preuzimanje', `${rez.pickup_location} u ${rez.pickup_time?.slice(0, 5)}`],
            ['Vraćanje', `${rez.dropoff_location || rez.pickup_location} u ${rez.return_time?.slice(0, 5)}`],
            rez.flight_number ? ['Broj leta', rez.flight_number] : null,
            rez.border_crossing !== 'Zabranjeno' ? ['Vožnja van granice', rez.border_crossing || 'Dozvoljeno'] : null,
            rez.insurance ? ['Osiguranje', rez.insurance] : null,
            rez.notes ? ['Napomena', rez.notes] : null,
          ].filter(Boolean).map((item) => { const [l, v] = item as [string, string]; return (
            <div key={l as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f3f4f6', fontSize: 13 }}>
              <span style={{ color: '#6b7280' }}>{l}</span>
              <span style={{ color: '#111', fontWeight: 500, maxWidth: 240, textAlign: 'right' as const }}>{v}</span>
            </div>
          )})}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0 0', fontSize: 15, fontWeight: 700 }}>
            <span>Ukupno</span>
            <span style={{ color: '#1D9E75' }}>{total}€</span>
          </div>
        </div>

        {/* Napomena agenta */}
        {rez.agent_note && (
          <div style={{ background: '#E6F1FB', border: '1px solid #85B7EB', borderRadius: 12, padding: '12px 16px', marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#0C447C', marginBottom: 4 }}>💬 Napomena od nas</div>
            <div style={{ fontSize: 13, color: '#0C447C' }}>{rez.agent_note}</div>
          </div>
        )}

        {/* Upload vozačke */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '16px', marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#111', marginBottom: 4 }}>📎 Vozačka dozvola</div>
          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
            Molimo uploadujte fotografiju vaše vozačke dozvole (prednja strana).
          </div>

          {licenseUrl ? (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: '#1D9E75', fontWeight: 600, marginBottom: 6 }}>✅ Dokument uploadovan</div>
              <a href={licenseUrl} target="_blank" rel="noreferrer"
                style={{ fontSize: 13, color: '#185FA5', textDecoration: 'none' }}>
                📄 Pregledaj dokument →
              </a>
            </div>
          ) : null}

          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <label style={{ flex: 1, padding: '11px', background: '#E1F5EE', border: '1px solid #1D9E75', borderRadius: 10, textAlign: 'center' as const, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#085041' }}>
              📷 Slikaj
              <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} disabled={uploading}
                onChange={async e => {
                  const file = e.target.files?.[0]; if (!file) return
                  const url = await uploadLicense(file)
                  if (url) setLicenseUrl(url)
                }} />
            </label>
            <label style={{ flex: 1, padding: '11px', background: '#E1F5EE', border: '1px solid #1D9E75', borderRadius: 10, textAlign: 'center' as const, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#085041' }}>
              🖼️ Iz galerije
              <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }} disabled={uploading}
                onChange={async e => {
                  const file = e.target.files?.[0]; if (!file) return
                  const url = await uploadLicense(file)
                  if (url) setLicenseUrl(url)
                }} />
            </label>
          </div>
          {uploadStatus && (
            <div style={{ fontSize: 12, color: uploadStatus.includes('✅') ? '#1D9E75' : '#dc2626', fontWeight: 600 }}>
              {uploadStatus}
            </div>
          )}
        </div>

        {/* Potvrdi dugme */}
        <button onClick={handleConfirm} disabled={confirming || !licenseUrl || uploading}
          style={{ width: '100%', padding: '14px', background: (!licenseUrl || uploading) ? '#9ca3af' : '#1D9E75', color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
          {confirming ? '⏳ Potvrđujem...' : !licenseUrl ? '⚠️ Uploadujte vozačku da nastavite' : '✓ Potvrdi rezervaciju'}
        </button>

        <div style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center' as const, marginTop: 16 }}>
          Potvrdom rezervacije prihvatate uslove iznajmljivanja Planet Rent a Car.
        </div>
      </div>
    </div>
  )
}
