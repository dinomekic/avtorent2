'use client'

import { useState } from 'react'

type Lang = 'sr' | 'en' | 'de'

const content = {
  sr: {
    nav: 'Nazad na početnu',
    title: 'O nama',
    sub: 'Vaš pouzdani rent-a-car partner na Balkanu od 2014. godine.',
    story_title: 'Naša priča',
    story: 'Počeli smo 2014. godine sa skromnom flotom i velikom željom da promijenimo način na koji turisti doživljavaju slobodu kretanja na Balkanu. Danas, više od desetljeća kasnije, ponosimo se flotom od preko 200 vozila i mrežom koja pokriva četiri države.',
    mission_title: 'Naša misija',
    mission: 'Vjerujemo da odmor počinje od trenutka kada sletite — ne od trenutka kada nađete prevoz. Zato vozilo donosimo direktno do vas, bilo da ste u centru Podgorice, na plaži u Budvi, ili na aerodromu u Tirani.',
    numbers_title: 'U brojevima',
    numbers: [
      { value: '2014', label: 'Godina osnivanja' },
      { value: '200+', label: 'Vozila u floti' },
      { value: '4', label: 'Države' },
      { value: '10+', label: 'Godina iskustva' },
    ],
    coverage_title: 'Pokrivenost',
    coverage: [
      { country: 'Crna Gora', detail: 'Svi gradovi — Podgorica, Budva, Bar, Kotor, Tivat, Herceg Novi i ostali' },
      { country: 'Albanija', detail: 'Tirana i aerodrom Nënë Tereza. Dostava na zahtjev u ostalim gradovima.' },
      { country: 'Bosna i Hercegovina', detail: 'Sarajevo — aerodrom i centar. Dostava na zahtjev.' },
      { country: 'Srbija', detail: 'Beograd — grad i aerodrom Nikola Tesla.' },
    ],
    why_title: 'Zašto mi?',
    why: [
      { title: 'Isporuka na adresu', desc: 'Vozilo vam donosimo tamo gdje ste vi. Bez taksija do iznajmljivača.' },
      { title: 'Jedna karta — četiri države', desc: 'Preuzmite u Beogradu, vratite u Budvi. Balkanska sloboda kretanja.' },
      { title: 'Fleksibilnost', desc: 'Prilagođavamo se vašim potrebama. Posebni zahtjevi su dobrodošli.' },
      { title: 'Transparentne cijene', desc: 'Bez skrivenih troškova. Sve dogovaramo unaprijed.' },
    ],
    faq_link: 'Imate pitanja? Pogledajte FAQ →',
  },
  en: {
    nav: 'Back to home',
    title: 'About us',
    sub: 'Your reliable rent-a-car partner in the Balkans since 2014.',
    story_title: 'Our story',
    story: 'We started in 2014 with a modest fleet and a big ambition — to change how tourists experience freedom of movement across the Balkans. Today, more than a decade later, we are proud of a fleet of over 200 vehicles and a network spanning four countries.',
    mission_title: 'Our mission',
    mission: 'We believe your holiday starts the moment you land — not when you find a ride. That is why we deliver the car directly to you, whether you are in the centre of Podgorica, on the beach in Budva, or at Tirana airport.',
    numbers_title: 'By the numbers',
    numbers: [
      { value: '2014', label: 'Founded' },
      { value: '200+', label: 'Vehicles' },
      { value: '4', label: 'Countries' },
      { value: '10+', label: 'Years of experience' },
    ],
    coverage_title: 'Coverage',
    coverage: [
      { country: 'Montenegro', detail: 'All cities — Podgorica, Budva, Bar, Kotor, Tivat, Herceg Novi and more.' },
      { country: 'Albania', detail: 'Tirana and Nënë Tereza airport. Delivery on request in other cities.' },
      { country: 'Bosnia & Herzegovina', detail: 'Sarajevo — airport and city centre. Delivery on request.' },
      { country: 'Serbia', detail: 'Belgrade — city and Nikola Tesla airport.' },
    ],
    why_title: 'Why us?',
    why: [
      { title: 'Delivered to your door', desc: 'We bring the car to you. No taxi to a rental office.' },
      { title: 'One trip — four countries', desc: 'Pick up in Belgrade, return in Budva. True Balkan freedom.' },
      { title: 'Flexibility', desc: 'We adapt to your needs. Special requests are always welcome.' },
      { title: 'Transparent pricing', desc: 'No hidden fees. Everything agreed upfront.' },
    ],
    faq_link: 'Have questions? Check our FAQ →',
  },
  de: {
    nav: 'Zurück zur Startseite',
    title: 'Über uns',
    sub: 'Ihr zuverlässiger Mietwagenpartner auf dem Balkan seit 2014.',
    story_title: 'Unsere Geschichte',
    story: 'Wir begannen 2014 mit einer bescheidenen Flotte und dem Ziel, die Art und Weise zu verändern, wie Touristen die Reisefreiheit auf dem Balkan erleben. Heute, mehr als ein Jahrzehnt später, sind wir stolz auf eine Flotte von über 200 Fahrzeugen in vier Ländern.',
    mission_title: 'Unsere Mission',
    mission: 'Wir glauben, dass Ihr Urlaub in dem Moment beginnt, in dem Sie landen — nicht erst, wenn Sie ein Fahrzeug gefunden haben. Deshalb liefern wir das Auto direkt zu Ihnen, egal ob Sie im Zentrum von Podgorica, am Strand in Budva oder am Flughafen Tirana sind.',
    numbers_title: 'Zahlen & Fakten',
    numbers: [
      { value: '2014', label: 'Gegründet' },
      { value: '200+', label: 'Fahrzeuge' },
      { value: '4', label: 'Länder' },
      { value: '10+', label: 'Jahre Erfahrung' },
    ],
    coverage_title: 'Abdeckung',
    coverage: [
      { country: 'Montenegro', detail: 'Alle Städte — Podgorica, Budva, Bar, Kotor, Tivat, Herceg Novi u.v.m.' },
      { country: 'Albanien', detail: 'Tirana und Flughafen Nënë Tereza. Lieferung auf Anfrage in anderen Städten.' },
      { country: 'Bosnien & Herzegowina', detail: 'Sarajevo — Flughafen und Stadtzentrum. Lieferung auf Anfrage.' },
      { country: 'Serbien', detail: 'Belgrad — Stadt und Flughafen Nikola Tesla.' },
    ],
    why_title: 'Warum wir?',
    why: [
      { title: 'Lieferung zu Ihrer Adresse', desc: 'Wir bringen das Fahrzeug zu Ihnen. Kein Taxi zur Vermietung.' },
      { title: 'Eine Reise — vier Länder', desc: 'Abholung in Belgrad, Rückgabe in Budva. Echte Balkanfreiheit.' },
      { title: 'Flexibilität', desc: 'Wir passen uns Ihren Bedürfnissen an. Sonderwünsche sind willkommen.' },
      { title: 'Transparente Preise', desc: 'Keine versteckten Kosten. Alles wird vorab vereinbart.' },
    ],
    faq_link: 'Haben Sie Fragen? Besuchen Sie unsere FAQ →',
  },
}

// Design system konstante
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
  bgSubtle: '#f3f4f6',
}

const FLAG: Record<Lang, string> = { sr: 'SR', en: 'EN', de: 'DE' }

// Ikone kao SVG komponente
function IconTruck() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M1 4h11v9H1V4z" stroke={DS.primary} strokeWidth="1.4" strokeLinejoin="round"/>
      <path d="M12 7h4l2 3v3h-6V7z" stroke={DS.primary} strokeWidth="1.4" strokeLinejoin="round"/>
      <circle cx="4.5" cy="14.5" r="1.5" stroke={DS.primary} strokeWidth="1.4"/>
      <circle cx="15.5" cy="14.5" r="1.5" stroke={DS.primary} strokeWidth="1.4"/>
    </svg>
  )
}

function IconGlobe() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="8" stroke={DS.primary} strokeWidth="1.4"/>
      <path d="M10 2c-2.5 2-4 4.8-4 8s1.5 6 4 8M10 2c2.5 2 4 4.8 4 8s-1.5 6-4 8M2 10h16" stroke={DS.primary} strokeWidth="1.4"/>
    </svg>
  )
}

function IconStar() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M10 2l2.5 5 5.5.8-4 3.9.9 5.5L10 14.5l-4.9 2.7.9-5.5L2 7.8l5.5-.8L10 2z" stroke={DS.primary} strokeWidth="1.4" strokeLinejoin="round"/>
    </svg>
  )
}

function IconShield() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M10 2L3 5v5c0 4.4 3 8 7 9 4-1 7-4.6 7-9V5l-7-3z" stroke={DS.primary} strokeWidth="1.4" strokeLinejoin="round"/>
      <path d="M7 10l2 2 4-4" stroke={DS.primary} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

const WHY_ICONS = [IconTruck, IconGlobe, IconStar, IconShield]

export default function ONamaPage() {
  const [lang, setLang] = useState<Lang>('en')
  const t = content[lang]

  return (
    <div style={{ minHeight: '100vh', background: DS.bgPage, fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* Nav */}
      <nav style={{
        background: DS.bgCard,
        borderBottom: `1px solid ${DS.border}`,
        padding: '14px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}>
        <a href="/" style={{ fontSize: 18, fontWeight: 700, color: DS.textPrimary, textDecoration: 'none' }}>
          ADRIA<span style={{ color: DS.primaryAccent, fontWeight: 300 }}>DRIVE</span>
        </a>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['sr', 'en', 'de'] as Lang[]).map(l => (
            <button
              key={l}
              onClick={() => setLang(l)}
              style={{
                padding: '4px 10px',
                fontSize: 12,
                borderRadius: 20,
                border: '1px solid',
                borderColor: lang === l ? DS.primary : DS.border,
                background: lang === l ? DS.primaryLight : 'transparent',
                color: lang === l ? DS.primary : DS.textSecondary,
                cursor: 'pointer',
                fontWeight: lang === l ? 700 : 400,
                transition: 'all 0.15s',
              }}
            >
              {FLAG[l]}
            </button>
          ))}
        </div>
      </nav>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '40px 16px 60px' }}>

        {/* Nazad link */}
        <a href="/" style={{ fontSize: 13, color: DS.primary, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 28 }}>
          ← {t.nav}
        </a>

        {/* Hero banner */}
        <div style={{
          background: DS.primaryDark,
          borderRadius: 16,
          padding: '40px 36px',
          marginBottom: 24,
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Dekorativni krug u pozadini */}
          <div style={{
            position: 'absolute', right: -40, top: -40,
            width: 200, height: 200,
            borderRadius: '50%',
            background: DS.primary,
            opacity: 0.25,
          }} />
          <div style={{
            position: 'absolute', right: 60, bottom: -60,
            width: 160, height: 160,
            borderRadius: '50%',
            background: DS.primaryAccent,
            opacity: 0.15,
          }} />
          <h1 style={{ fontSize: 34, fontWeight: 700, marginBottom: 10, color: '#fff', position: 'relative' }}>
            {t.title}
          </h1>
          <p style={{ fontSize: 16, color: '#B5D4F4', lineHeight: 1.65, maxWidth: 520, position: 'relative' }}>
            {t.sub}
          </p>
        </div>

        {/* Priča + Misija */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
          {[{ title: t.story_title, text: t.story }, { title: t.mission_title, text: t.mission }].map(s => (
            <div key={s.title} style={{
              background: DS.bgCard,
              borderRadius: 12,
              padding: '22px 24px',
              border: `1px solid ${DS.border}`,
            }}>
              <div style={{
                fontSize: 11,
                fontWeight: 700,
                color: DS.primary,
                letterSpacing: '0.08em',
                textTransform: 'uppercase' as const,
                marginBottom: 10,
              }}>
                {s.title}
              </div>
              <p style={{ fontSize: 13, color: DS.textSecondary, lineHeight: 1.75, margin: 0 }}>{s.text}</p>
            </div>
          ))}
        </div>

        {/* Brojevi */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
          {t.numbers.map(n => (
            <div key={n.label} style={{
              background: DS.primaryLight,
              borderRadius: 12,
              padding: '20px 12px',
              textAlign: 'center' as const,
              border: `1px solid ${DS.borderBlue}`,
            }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: DS.primary, marginBottom: 4 }}>{n.value}</div>
              <div style={{ fontSize: 11, color: '#185FA5', fontWeight: 500 }}>{n.label}</div>
            </div>
          ))}
        </div>

        {/* Pokrivenost */}
        <div style={{
          background: DS.bgCard,
          borderRadius: 12,
          border: `1px solid ${DS.border}`,
          padding: '22px 24px',
          marginBottom: 20,
        }}>
          <div style={{
            fontSize: 11,
            fontWeight: 700,
            color: DS.primary,
            letterSpacing: '0.08em',
            textTransform: 'uppercase' as const,
            marginBottom: 16,
          }}>
            {t.coverage_title}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 14 }}>
            {t.coverage.map((c, i) => (
              <div key={c.country} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <div style={{
                  width: 28, height: 28,
                  borderRadius: 8,
                  background: DS.primaryLight,
                  border: `1px solid ${DS.borderBlue}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                  fontSize: 11,
                  fontWeight: 700,
                  color: DS.primary,
                }}>
                  {i + 1}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: DS.textPrimary, marginBottom: 2 }}>{c.country}</div>
                  <div style={{ fontSize: 12, color: DS.textSecondary, lineHeight: 1.6 }}>{c.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Zašto mi */}
        <div style={{
          background: DS.bgCard,
          borderRadius: 12,
          border: `1px solid ${DS.border}`,
          padding: '22px 24px',
          marginBottom: 20,
        }}>
          <div style={{
            fontSize: 11,
            fontWeight: 700,
            color: DS.primary,
            letterSpacing: '0.08em',
            textTransform: 'uppercase' as const,
            marginBottom: 16,
          }}>
            {t.why_title}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {t.why.map((w, i) => {
              const Icon = WHY_ICONS[i]
              return (
                <div key={w.title} style={{
                  background: DS.bgPage,
                  borderRadius: 10,
                  padding: '16px',
                  border: `1px solid ${DS.border}`,
                  display: 'flex',
                  gap: 12,
                  alignItems: 'flex-start',
                }}>
                  <div style={{
                    width: 36, height: 36,
                    borderRadius: 8,
                    background: DS.primaryLight,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Icon />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: DS.textPrimary, marginBottom: 4 }}>{w.title}</div>
                    <div style={{ fontSize: 12, color: DS.textSecondary, lineHeight: 1.6 }}>{w.desc}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* FAQ link */}
        <a href="/faq" style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          padding: '14px 24px',
          background: DS.primaryLight,
          borderRadius: 10,
          border: `1px solid ${DS.borderBlue}`,
          color: DS.primary,
          fontSize: 14,
          fontWeight: 600,
          textDecoration: 'none',
          transition: 'background 0.15s',
        }}>
          {t.faq_link}
        </a>

      </div>
    </div>
  )
}
