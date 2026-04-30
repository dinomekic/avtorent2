'use client'
import { Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { translations, type Lang } from '@/lib/i18n'

const DS = {
  primary: '#1a56a0',
  primaryDark: '#0e2d5e',
  primaryLight: '#E6F1FB',
  primaryAccent: '#378ADD',
  primaryMid: '#185FA5',
  textPrimary: '#111827',
  textSecondary: '#6b7280',
  textMuted: '#9ca3af',
  border: '#e5e7eb',
  borderBlue: '#c5d9f5',
  bgPage: '#f9fafb',
  bgCard: '#ffffff',
}

function ConfirmPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const lang = (searchParams.get('lang') as Lang) || 'sr'
  const refCode = searchParams.get('ref') || ''
  const partnerName = searchParams.get('partnerName') || ''
  const partnerDiscount = parseFloat(searchParams.get('partnerDiscount') || '0')
  const isNewClient = searchParams.get('isNewClient') === 'true'
  const tr = translations[lang]

  const title = lang === 'de' ? 'Buchung erfolgreich!' : lang === 'en' ? 'Booking confirmed!' : 'Uspješna rezervacija!'
  const subtitle = lang === 'de'
    ? 'Ihre Buchungsbestätigung wird per E-Mail zugesendet.'
    : lang === 'en'
    ? 'Your booking confirmation will be sent to your email address.'
    : 'Potvrdu rezervacije ćete dobiti putem email-a.'
  const refLabel = lang === 'de' ? 'Buchungsnummer' : lang === 'en' ? 'Booking reference' : 'Broj rezervacije'
  const profileTitle = lang === 'de' ? 'Bitte vervollständigen Sie Ihr Profil' : lang === 'en' ? 'Please complete your profile' : 'Dopunite vaš profil'
  const profileDesc = lang === 'de'
    ? 'Bitte besuchen Sie Ihr Konto und geben Sie die Daten aus Ihrem Führerschein ein.'
    : lang === 'en'
    ? 'Please visit your account and enter your driving licence details.'
    : 'Posjetite vaš nalog i unesite podatke sa vozačke dozvole. Ovi podaci su potrebni za pripremu ugovora o najmu.'
  const accountLabel = lang === 'de' ? 'Mein Konto →' : lang === 'en' ? 'My account →' : 'Moj nalog →'

  return (
    <div style={{ minHeight: '100vh', background: DS.bgPage, fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* Nav */}
      <nav style={{ background: DS.bgCard, borderBottom: `1px solid ${DS.border}`, padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <a href="/" style={{ fontSize: 18, fontWeight: 700, color: DS.textPrimary, textDecoration: 'none' }}>
          ADRIA<span style={{ color: DS.primaryAccent, fontWeight: 300 }}>DRIVE</span>
        </a>
        <button onClick={() => router.push('/')} style={{ fontSize: 13, color: DS.primary, background: 'none', border: 'none', cursor: 'pointer' }}>
          ← {tr.backHome}
        </button>
      </nav>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 16px' }}>
        <div style={{ background: DS.bgCard, border: `1px solid ${DS.border}`, borderRadius: 16, padding: '40px 32px', maxWidth: 480, width: '100%', textAlign: 'center' as const }}>

          {/* Success ikona */}
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: DS.primaryLight, border: `2px solid ${DS.borderBlue}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M5 13l4 4L19 7" stroke={DS.primary} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>

          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 10, color: DS.primaryDark }}>{title}</h1>
          <p style={{ fontSize: 14, color: DS.textSecondary, lineHeight: 1.7, marginBottom: 28 }}>{subtitle}</p>

          {/* Ref code */}
          <div style={{ background: DS.primaryLight, borderRadius: 10, padding: '16px 20px', marginBottom: 20, border: `1px solid ${DS.borderBlue}` }}>
            <div style={{ fontSize: 11, color: DS.primaryMid, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 8 }}>{refLabel}</div>
            <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'monospace', color: DS.primary, letterSpacing: 3 }}>{refCode}</div>
          </div>

          {/* Partner popust */}
          {partnerName && partnerDiscount > 0 && (
            <div style={{ background: DS.primaryLight, border: `1px solid ${DS.borderBlue}`, borderRadius: 10, padding: '16px 18px', marginBottom: 16, textAlign: 'left' as const }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: DS.primaryDark, marginBottom: 6 }}>
                Kao korisnik <span style={{ color: DS.primary }}>{partnerName}</span> ste ostvarili popust!
              </div>
              <div style={{ fontSize: 13, color: DS.primaryMid }}>
                Uštedili ste <strong>{partnerDiscount}%</strong> na cijenu najma.
              </div>
            </div>
          )}

          {/* Novi klijent */}
          {isNewClient && (
            <div style={{ background: DS.primaryLight, border: `1px solid ${DS.borderBlue}`, borderRadius: 10, padding: '16px 18px', marginBottom: 16, textAlign: 'left' as const }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: DS.primaryDark, marginBottom: 6 }}>Provjerite email</div>
              <div style={{ fontSize: 13, color: DS.primaryMid, lineHeight: 1.6 }}>
                Poslali smo vam email sa potvrdom rezervacije i privremenom lozinkom za vaš novi nalog. Prijavite se na <strong>/moje/login</strong> da pratite rezervacije.
              </div>
              <button
                onClick={() => router.push('/moje/login')}
                style={{ marginTop: 12, padding: '8px 16px', background: DS.primary, color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
              >
                Prijavi se na nalog →
              </button>
            </div>
          )}

          {/* Dopuni profil */}
          <div style={{ background: DS.bgPage, border: `1px solid ${DS.border}`, borderRadius: 10, padding: '16px 18px', marginBottom: 28, textAlign: 'left' as const }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: DS.textPrimary, marginBottom: 6 }}>{profileTitle}</div>
            <div style={{ fontSize: 12, color: DS.textSecondary, lineHeight: 1.6 }}>{profileDesc}</div>
          </div>

          {/* Akcije */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            {!isNewClient && (
              <button
                onClick={() => router.push('/moje')}
                style={{ padding: '10px 22px', background: DS.primary, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                {accountLabel}
              </button>
            )}
            <button
              onClick={() => router.push('/')}
              style={{ padding: '10px 22px', background: 'transparent', border: `1px solid ${DS.border}`, borderRadius: 8, fontSize: 13, cursor: 'pointer', color: DS.textSecondary }}
            >
              {tr.backHome}
            </button>
          </div>

          {/* Tagline */}
          <div style={{ marginTop: 28, paddingTop: 20, borderTop: `1px solid ${DS.border}`, fontSize: 12, color: DS.textMuted, fontStyle: 'italic', fontFamily: 'Georgia, serif' }}>
            "Feel the Balkans. Own the road."
          </div>

        </div>
      </div>

      {/* Footer */}
      <footer style={{ background: DS.primaryDark, padding: '24px', textAlign: 'center' as const }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: '#fff' }}>
          ADRIA<span style={{ fontWeight: 300, color: '#7ab8f5' }}>DRIVE</span>
        </div>
        <div style={{ fontSize: 10, color: '#4a90d9', letterSpacing: 3, marginTop: 4 }}>BALKAN · RENT A CAR</div>
        <div style={{ fontSize: 11, color: '#4a90d9', marginTop: 8 }}>© 2025 AdriaDrive · rent-cars.me</div>
      </footer>

    </div>
  )
}

export default function ConfirmPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>Učitavanje...</div>}>
      <ConfirmPageContent />
    </Suspense>
  )
}
