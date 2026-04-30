'use client'

import { useState } from 'react'

type Lang = 'sr' | 'en' | 'de'

const content = {
  sr: {
    title: 'Kontakt',
    sub: 'Dostupni smo za vas 24/7. Pozovite nas ili pišite.',
    countries_title: 'Kontakti po državama',
    countries: [
      {
        country: 'Crna Gora',
        flag: '🇲🇪',
        numbers: [
          { label: 'Podgorica, Budva, Bar, Ulcinj, Tivat, Kotor, Herceg Novi, Bijelo Polje, Kolašin, Mojkovac, Rožaje, Plav, Berane, Nikšić, Plužine, Žabljak, Pljevlja', phone: '+382 69 810 805' },
        ],
      },
      {
        country: 'Albanija',
        flag: '🇦🇱',
        numbers: [
          { label: 'Tirana', phone: '+355 67 333 5333' },
          { label: 'Aerodrom', phone: '+355 67 333 5333' },
        ],
      },
      {
        country: 'Bosna i Hercegovina',
        flag: '🇧🇦',
        numbers: [
          { label: 'Sarajevo', phone: '+387 61 828 000' },
          { label: 'Aerodrom', phone: '+387 61 828 000' },
        ],
      },
      {
        country: 'Srbija',
        flag: '🇷🇸',
        numbers: [
          { label: 'Beograd', phone: '+381 65 802 9023' },
          { label: 'Aerodrom Nikola Tesla', phone: '+381 63 000 001' },
        ],
      },
    ],
    email_title: 'Email',
    email: 'info@rent-cars.me',
    hours_title: 'Radno vrijeme',
    hours: '24/7 — uvijek dostupni za vas',
    note: 'Za hitne slučajeve van radnog vremena, pozovite broj za vašu lokaciju.',
    back: 'Nazad',
  },
  en: {
    title: 'Contact',
    sub: 'We are available 24/7. Call us or write to us.',
    countries_title: 'Contact numbers by country',
    countries: [
      {
        country: 'Montenegro',
        flag: '🇲🇪',
        numbers: [
          { label: 'Podgorica, Budva, Bar, Ulcinj, Tivat, Kotor, Herceg Novi, Bijelo Polje, Kolašin, Mojkovac, Rožaje, Plav, Berane, Nikšić, Plužine, Žabljak, Pljevlja', phone: '+382 69 810 805' },
        ],
      },
      {
        country: 'Albania',
        flag: '🇦🇱',
        numbers: [
          { label: 'Tirana', phone: '+355 67 333 5333' },
          { label: 'Airport', phone: '+355 67 333 5333' },
        ],
      },
      {
        country: 'Bosnia & Herzegovina',
        flag: '🇧🇦',
        numbers: [
          { label: 'Sarajevo', phone: '+387 61 828 000' },
          { label: 'Airport', phone: '+387 61 828 000' },
        ],
      },
      {
        country: 'Serbia',
        flag: '🇷🇸',
        numbers: [
          { label: 'Belgrade', phone: '+381 65 802 9023' },
          { label: 'Nikola Tesla Airport', phone: '+381 63 000 001' },
        ],
      },
    ],
    email_title: 'Email',
    email: 'info@rent-cars.me',
    hours_title: 'Availability',
    hours: '24/7 — always here for you',
    note: 'For urgent matters outside office hours, call the number for your location.',
    back: 'Back',
  },
  de: {
    title: 'Kontakt',
    sub: 'Wir sind 24/7 für Sie erreichbar. Rufen Sie uns an oder schreiben Sie uns.',
    countries_title: 'Kontaktnummern nach Ländern',
    countries: [
      {
        country: 'Montenegro',
        flag: '🇲🇪',
        numbers: [
          { label: 'Podgorica, Budva, Bar, Ulcinj, Tivat, Kotor, Herceg Novi, Bijelo Polje, Kolašin, Mojkovac, Rožaje, Plav, Berane, Nikšić, Plužine, Žabljak, Pljevlja', phone: '+382 69 810 805' },
        ],
      },
      {
        country: 'Albanien',
        flag: '🇦🇱',
        numbers: [
          { label: 'Tirana', phone: '+355 67 333 5333' },
          { label: 'Flughafen', phone: '+355 67 333 5333' },
        ],
      },
      {
        country: 'Bosnien & Herzegowina',
        flag: '🇧🇦',
        numbers: [
          { label: 'Sarajevo', phone: '+387 61 828 000' },
          { label: 'Flughafen', phone: '+387 61 828 000' },
        ],
      },
      {
        country: 'Serbien',
        flag: '🇷🇸',
        numbers: [
          { label: 'Belgrad', phone: '+381 65 802 9023' },
          { label: 'Flughafen Nikola Tesla', phone: '+381 63 000 001' },
        ],
      },
    ],
    email_title: 'E-Mail',
    email: 'info@rent-cars.me',
    hours_title: 'Erreichbarkeit',
    hours: '24/7 — immer für Sie da',
    note: 'Für dringende Anfragen außerhalb der Bürozeiten rufen Sie bitte die Nummer für Ihren Standort an.',
    back: 'Zurück',
  },
}

const DS = {
  primary: '#1a56a0',
  primaryDark: '#0e2d5e',
  primaryLight: '#E6F1FB',
  primaryAccent: '#378ADD',
  textPrimary: '#111827',
  textSecondary: '#6b7280',
  border: '#e5e7eb',
  borderBlue: '#c5d9f5',
  bgPage: '#f9fafb',
  bgCard: '#ffffff',
}

const FLAG: Record<Lang, string> = { sr: 'SR', en: 'EN', de: 'DE' }

function PhoneIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.6 19.79 19.79 0 01.22 1a2 2 0 012-1.79h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.91a16 16 0 006.72 6.72l1.06-1.06a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
    </svg>
  )
}

function MailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={DS.primary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
      <polyline points="22,6 12,13 2,6"/>
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={DS.primary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12,6 12,12 16,14"/>
    </svg>
  )
}

export default function KontaktPage() {
  const [lang, setLang] = useState<Lang>('en')
  const t = content[lang]

  return (
    <div style={{ minHeight: '100vh', background: DS.bgPage, fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      <nav style={{ background: DS.bgCard, borderBottom: `1px solid ${DS.border}`, padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 }}>
        <a href="/" style={{ fontSize: 18, fontWeight: 700, color: DS.textPrimary, textDecoration: 'none' }}>
          ADRIA<span style={{ color: DS.primaryAccent, fontWeight: 300 }}>DRIVE</span>
        </a>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['sr', 'en', 'de'] as Lang[]).map(l => (
            <button key={l} onClick={() => setLang(l)} style={{ padding: '4px 10px', fontSize: 12, borderRadius: 20, border: '1px solid', borderColor: lang === l ? DS.primary : DS.border, background: lang === l ? DS.primaryLight : 'transparent', color: lang === l ? DS.primary : DS.textSecondary, cursor: 'pointer', fontWeight: lang === l ? 700 : 400 }}>
              {FLAG[l]}
            </button>
          ))}
        </div>
      </nav>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '40px 16px 60px' }}>

        <a href="/" style={{ fontSize: 13, color: DS.primary, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 28 }}>
          ← {t.back}
        </a>

        <div style={{ background: DS.primaryDark, borderRadius: 16, padding: '40px 36px', marginBottom: 24, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', right: -40, top: -40, width: 200, height: 200, borderRadius: '50%', background: DS.primary, opacity: 0.25 }} />
          <div style={{ position: 'absolute', right: 60, bottom: -60, width: 160, height: 160, borderRadius: '50%', background: DS.primaryAccent, opacity: 0.15 }} />
          <h1 style={{ fontSize: 34, fontWeight: 700, marginBottom: 10, color: '#fff', position: 'relative' }}>{t.title}</h1>
          <p style={{ fontSize: 16, color: '#B5D4F4', lineHeight: 1.65, maxWidth: 520, position: 'relative' }}>{t.sub}</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
          <div style={{ background: DS.bgCard, borderRadius: 12, border: `1px solid ${DS.border}`, padding: '20px 22px', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: DS.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <MailIcon />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: DS.primary, letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 6 }}>{t.email_title}</div>
              <a href={`mailto:${t.email}`} style={{ fontSize: 14, fontWeight: 600, color: DS.textPrimary, textDecoration: 'none' }}>{t.email}</a>
            </div>
          </div>
          <div style={{ background: DS.bgCard, borderRadius: 12, border: `1px solid ${DS.border}`, padding: '20px 22px', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: DS.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <ClockIcon />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: DS.primary, letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 6 }}>{t.hours_title}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: DS.textPrimary }}>{t.hours}</div>
            </div>
          </div>
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, color: DS.primary, letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 14 }}>
          {t.countries_title}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10, marginBottom: 24 }}>
          {t.countries.map(c => (
            <div key={c.country} style={{ background: DS.bgCard, borderRadius: 12, border: `1px solid ${DS.border}`, overflow: 'hidden' }}>
              <div style={{ background: DS.primaryLight, padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: `1px solid ${DS.borderBlue}` }}>
                <span style={{ fontSize: 20, lineHeight: '1' }}>{c.flag}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: DS.primary }}>{c.country}</span>
              </div>
              <div style={{ padding: '12px 18px', display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
                {c.numbers.map(n => (
                  <div key={n.phone + n.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <span style={{ fontSize: 12, color: DS.textSecondary, lineHeight: '1.5', flex: 1 }}>{n.label}</span>
                    <a
                      href={`tel:${n.phone.replace(/\s/g, '')}`}
                      style={{ fontSize: 14, fontWeight: 600, color: DS.primary, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
                    >
                      <PhoneIcon />
                      {n.phone}
                    </a>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div style={{ background: DS.primaryLight, borderRadius: 10, border: `1px solid ${DS.borderBlue}`, padding: '14px 18px', fontSize: 13, color: '#185FA5', textAlign: 'center' as const }}>
          {t.note}
        </div>

      </div>
    </div>
  )
}
