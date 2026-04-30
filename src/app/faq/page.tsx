'use client'

import { useState } from 'react'

type Lang = 'sr' | 'en' | 'de'
type FAQ = { q: string; a: string }

const faqs: Record<Lang, FAQ[]> = {
  sr: [
    { q: 'Kako funkcioniše isporuka vozila?', a: 'Nakon što potvrdite rezervaciju, naš agent kontaktira vas i dogovaramo tačno mjesto i vrijeme isporuke. Vozilo donosimo direktno na adresu koju navedete — hotel, apartman, aerodrom ili bilo koja druga lokacija.' },
    { q: 'Mogu li preuzeti vozilo u jednoj državi a vratiti u drugoj?', a: 'Da! To je jedna od naših glavnih prednosti. Možete preuzeti vozilo npr. u Beogradu i vratiti ga u Budvi, Sarajevu ili Tirani. Naplaćujemo skromnu naknadu za transfer, koja se obračunava pri rezervaciji.' },
    { q: 'Koje dokumente trebam imati?', a: 'Potrebna vam je važeća vozačka dozvola (međunarodna ili EU) i pasoš ili lična karta. Za plaćanje kreditnom karticom, kartica mora biti na ime vozača.' },
    { q: 'Da li vozila imaju puno osiguranje?', a: 'Sva vozila su osigurana po zakonskom minimumu. Nudimo i puno kasko osiguranje (CDW) kao opcioni dodatak, što se može dodati pri rezervaciji ili na licu mjesta.' },
    { q: 'Koja je minimalna starost za iznajmljivanje?', a: 'Minimalna starost je 21 godina. Za vozače između 21 i 25 godina može se naplatiti mlađi vozač doplata, zavisno od kategorije vozila.' },
    { q: 'Mogu li putovati kroz sve četiri države jednim vozilom?', a: 'Da. Nudimo vozila registrovana u Crnoj Gori koja su odobrena za putovanje kroz Crnu Goru, Albaniju, Bosnu i Hercegovinu i Srbiju. Neke destinacije van ovog područja mogu zahtijevati posebnu dozvolu.' },
    { q: 'Šta ako se pokvari vozilo?', a: 'Dostupni smo 24/7. U slučaju kvara, naš tim dolazi na lice mjesta ili vam organizujemo zamjensko vozilo u najkraćem mogućem roku.' },
    { q: 'Kako otkazati rezervaciju?', a: 'Rezervaciju možete otkazati besplatno do 48 sati prije preuzimanja. Otkaz u kraćem roku može podrazumijevati administrativnu naknadu. Kontaktirajte nas putem emaila ili telefona.' },
    { q: 'Da li mogu dodati dodatnog vozača?', a: 'Da, dodatni vozač se može dodati pri rezervaciji ili na licu mjesta. Obavezna je provjera dokumentacije svakog vozača.' },
    { q: 'Prihvatate li gotovinu?', a: 'Da, prihvatamo gotovinu (eure), ali za preuzimanje vozila obično tražimo i kreditnu ili debitnu karticu kao garanciju za depozit.' },
  ],
  en: [
    { q: 'How does vehicle delivery work?', a: 'After your booking is confirmed, our agent contacts you to arrange the exact delivery location and time. We bring the car directly to your address — hotel, apartment, airport, or any other location.' },
    { q: 'Can I pick up in one country and return in another?', a: 'Yes! This is one of our key advantages. You can pick up in Belgrade and return in Budva, Sarajevo, or Tirana. A modest cross-border transfer fee applies and is calculated at booking.' },
    { q: 'What documents do I need?', a: 'You need a valid driving licence (international or EU) and a passport or national ID. For credit card payments, the card must be in the driver\'s name.' },
    { q: 'Do vehicles have full insurance?', a: 'All vehicles have the legal minimum insurance. We also offer full collision damage waiver (CDW) as an optional add-on, available at booking or at pick-up.' },
    { q: 'What is the minimum age to rent?', a: 'The minimum age is 21. A young driver surcharge may apply for drivers aged 21–25, depending on the vehicle category.' },
    { q: 'Can I drive through all four countries with one car?', a: 'Yes. Our vehicles are registered in Montenegro and approved for travel through Montenegro, Albania, Bosnia & Herzegovina, and Serbia. Destinations outside this area may require a special permit.' },
    { q: 'What if the car breaks down?', a: 'We are available 24/7. In case of a breakdown, our team comes to you or arranges a replacement vehicle as quickly as possible.' },
    { q: 'How do I cancel a reservation?', a: 'You can cancel free of charge up to 48 hours before pick-up. Cancellations within 48 hours may incur an administrative fee. Please contact us by email or phone.' },
    { q: 'Can I add an additional driver?', a: 'Yes, an additional driver can be added at booking or at pick-up. Documentation for each driver must be verified.' },
    { q: 'Do you accept cash?', a: 'Yes, we accept cash (euros), but a credit or debit card is usually required as a deposit guarantee when collecting the vehicle.' },
  ],
  de: [
    { q: 'Wie funktioniert die Fahrzeuglieferung?', a: 'Nach Bestätigung Ihrer Buchung kontaktiert unser Agent Sie, um den genauen Lieferort und -zeitpunkt zu vereinbaren. Wir bringen das Fahrzeug direkt zu Ihrer Adresse — Hotel, Apartment, Flughafen oder eine andere Adresse.' },
    { q: 'Kann ich in einem Land abholen und in einem anderen zurückgeben?', a: 'Ja! Das ist einer unserer wichtigsten Vorteile. Sie können in Belgrad abholen und in Budva, Sarajevo oder Tirana zurückgeben. Eine geringe Transfergebühr wird bei der Buchung berechnet.' },
    { q: 'Welche Dokumente benötige ich?', a: 'Sie benötigen einen gültigen Führerschein (international oder EU) sowie einen Reisepass oder Personalausweis. Bei Kreditkartenzahlung muss die Karte auf den Namen des Fahrers ausgestellt sein.' },
    { q: 'Haben die Fahrzeuge eine Vollkaskoversicherung?', a: 'Alle Fahrzeuge haben die gesetzlich vorgeschriebene Mindestversicherung. Wir bieten auch eine Vollkaskoversicherung (CDW) als optionale Zusatzleistung an.' },
    { q: 'Was ist das Mindestalter für die Anmietung?', a: 'Das Mindestalter beträgt 21 Jahre. Für Fahrer zwischen 21 und 25 Jahren kann je nach Fahrzeugkategorie ein Jungefahrerzuschlag anfallen.' },
    { q: 'Kann ich mit einem Fahrzeug durch alle vier Länder fahren?', a: 'Ja. Unsere Fahrzeuge sind in Montenegro zugelassen und für Reisen durch Montenegro, Albanien, Bosnien und Herzegowina sowie Serbien freigegeben.' },
    { q: 'Was passiert bei einer Panne?', a: 'Wir sind 24/7 erreichbar. Im Pannenfall kommt unser Team zu Ihnen oder organisiert so schnell wie möglich ein Ersatzfahrzeug.' },
    { q: 'Wie kann ich eine Reservierung stornieren?', a: 'Sie können bis zu 48 Stunden vor Abholung kostenlos stornieren. Bei späteren Stornierungen kann eine Verwaltungsgebühr anfallen. Bitte kontaktieren Sie uns per E-Mail oder Telefon.' },
    { q: 'Kann ich einen zusätzlichen Fahrer hinzufügen?', a: 'Ja, ein zusätzlicher Fahrer kann bei der Buchung oder bei der Abholung hinzugefügt werden. Die Dokumente jedes Fahrers müssen überprüft werden.' },
    { q: 'Akzeptieren Sie Bargeld?', a: 'Ja, wir akzeptieren Bargeld (Euro), aber für die Fahrzeugabholung wird in der Regel eine Kredit- oder Debitkarte als Kaution benötigt.' },
  ],
}

const labels = {
  sr: {
    back: 'Nazad na početnu',
    title: 'Česta pitanja',
    sub: 'Odgovori na najčešća pitanja naših gostiju.',
    no_answer: 'Niste našli odgovor?',
    cta: 'Rezervišite i pitajte nas →',
  },
  en: {
    back: 'Back to home',
    title: 'Frequently asked questions',
    sub: 'Answers to the most common questions from our guests.',
    no_answer: "Didn't find your answer?",
    cta: 'Book and ask us directly →',
  },
  de: {
    back: 'Zurück zur Startseite',
    title: 'Häufig gestellte Fragen',
    sub: 'Antworten auf die häufigsten Fragen unserer Gäste.',
    no_answer: 'Keine Antwort gefunden?',
    cta: 'Buchen und uns direkt fragen →',
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

export default function FAQPage() {
  const [lang, setLang] = useState<Lang>('en')
  const [open, setOpen] = useState<number | null>(null)
  const t = labels[lang]

  return (
    <div style={{ minHeight: '100vh', background: DS.bgPage, fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* Nav */}
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

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '40px 16px 60px' }}>

        {/* Nazad */}
        <a href="/" style={{ fontSize: 13, color: DS.primary, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 28 }}>
          ← {t.back}
        </a>

        {/* Hero */}
        <div style={{ background: DS.primaryDark, borderRadius: 16, padding: '40px 36px', marginBottom: 28, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', right: -40, top: -40, width: 200, height: 200, borderRadius: '50%', background: DS.primary, opacity: 0.25 }} />
          <div style={{ position: 'absolute', right: 60, bottom: -60, width: 160, height: 160, borderRadius: '50%', background: DS.primaryAccent, opacity: 0.15 }} />
          <h1 style={{ fontSize: 34, fontWeight: 700, marginBottom: 10, color: '#fff', position: 'relative' }}>{t.title}</h1>
          <p style={{ fontSize: 16, color: '#B5D4F4', lineHeight: 1.65, maxWidth: 480, position: 'relative' }}>{t.sub}</p>
        </div>

        {/* FAQ accordion */}
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8, marginBottom: 28 }}>
          {faqs[lang].map((faq, i) => (
            <div
              key={i}
              style={{
                background: DS.bgCard,
                borderRadius: 12,
                border: `1px solid ${open === i ? DS.borderBlue : DS.border}`,
                overflow: 'hidden',
                transition: 'border-color 0.2s',
              }}
            >
              <button
                onClick={() => setOpen(open === i ? null : i)}
                style={{
                  width: '100%',
                  padding: '16px 20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: open === i ? DS.primaryLight : 'none',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left' as const,
                  gap: 12,
                  transition: 'background 0.15s',
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 500, color: open === i ? DS.primary : DS.textPrimary, lineHeight: 1.4 }}>
                  {faq.q}
                </span>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 18 18"
                  fill="none"
                  style={{ flexShrink: 0, transform: open === i ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s' }}
                >
                  <path d="M9 3v12M3 9h12" stroke={open === i ? DS.primary : DS.textSecondary} strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
              {open === i && (
                <div style={{ padding: '0 20px 16px', borderTop: `1px solid ${DS.borderBlue}` }}>
                  <div style={{ paddingTop: 14, fontSize: 13, color: DS.textSecondary, lineHeight: 1.75 }}>
                    {faq.a}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* CTA */}
        <div style={{ background: DS.primaryLight, borderRadius: 12, border: `1px solid ${DS.borderBlue}`, padding: '24px', textAlign: 'center' as const }}>
          <div style={{ fontSize: 14, color: DS.primary, marginBottom: 14, fontWeight: 500 }}>
            {t.no_answer}
          </div>
          <a
            href="/"
            style={{ display: 'inline-block', padding: '10px 28px', background: DS.primary, color: '#fff', borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}
          >
            {t.cta}
          </a>
        </div>

      </div>
    </div>
  )
}
