export function guestEmail(d: {
  guestName: string; vehicleName: string; pickupDate: string; returnDate: string
  pickupLocation: string; pickupTime?: string; returnTime?: string
  totalPrice: number; refCode: string; lang: string
  isNewClient?: boolean; tempPassword?: string | null; siteUrl?: string
}) {
  const subject = d.lang === 'en' ? `Reservation ${d.refCode}` : d.lang === 'de' ? `Reservierung ${d.refCode}` : `Rezervacija ${d.refCode}`

  const accountSection = d.isNewClient && d.tempPassword ? `
    <div style="background:#e8f0fb;border:1px solid #4a90d9;border-radius:10px;padding:20px;margin:20px 0;text-align:center">
      <div style="font-size:15px;font-weight:bold;color:#0e2d5e;margin-bottom:8px">🎉 Vaš nalog je kreiran!</div>
      <div style="font-size:13px;color:#0e2d5e;margin-bottom:14px">Možete pratiti sve vaše rezervacije na jednom mjestu.</div>
      <div style="background:#fff;border-radius:8px;padding:12px;margin-bottom:14px;display:inline-block">
        <div style="font-size:12px;color:#9ca3af;margin-bottom:4px">Privremena lozinka</div>
        <div style="font-size:20px;font-weight:bold;font-family:monospace;color:#1a56a0;letter-spacing:2px">${d.tempPassword}</div>
      </div>
      <div style="margin-top:4px">
        <a href="${d.siteUrl}/moje/login" style="display:inline-block;padding:10px 22px;background:#1a56a0;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;font-size:13px">
          Prijavite se na vaš nalog →
        </a>
      </div>
      <div style="font-size:11px;color:#9ca3af;margin-top:10px">Preporučujemo da promijenite lozinku pri prvoj prijavi.</div>
    </div>
  ` : ''

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#333">
  <div style="background:#0e2d5e;padding:24px;text-align:center">
    <div style="font-weight:800;font-size:22px;color:#fff;letter-spacing:1px">ADRIA<span style="font-weight:300;color:#4a90d9">DRIVE</span></div>
    <div style="font-size:10px;color:#4a90d9;letter-spacing:3px;margin-top:4px">BALKAN · RENT A CAR</div>
  </div>
  <div style="padding:28px 24px">
    <p>Poštovani/a <strong>${d.guestName}</strong>,</p>
    <p>Vaša rezervacija je prihvaćena. Posjetite naš portal <a href="https://www.rent-cars.me/moje" style="color:#1a56a0">https://www.rent-cars.me/moje</a> kako biste pregledali rezervacije i unijeli potrebne podatke za pripremu ugovora.</p>

    <div style="background:#f5f5f5;border-radius:8px;padding:16px;text-align:center;margin:20px 0">
      <div style="font-size:13px;color:#666;margin-bottom:6px">Referentni broj</div>
      <div style="font-size:22px;font-weight:bold;font-family:monospace;color:#1a56a0">${d.refCode}</div>
    </div>

    <table style="width:100%;font-size:14px">
      <tr><td style="color:#666;padding:6px 0;border-bottom:1px solid #eee">Vozilo</td><td style="text-align:right;padding:6px 0;border-bottom:1px solid #eee">${d.vehicleName}</td></tr>
      <tr><td style="color:#666;padding:6px 0;border-bottom:1px solid #eee">Preuzimanje</td><td style="text-align:right;padding:6px 0;border-bottom:1px solid #eee">${d.pickupDate}${d.pickupTime ? ' u ' + d.pickupTime.slice(0,5) : ''}</td></tr>
      <tr><td style="color:#666;padding:6px 0;border-bottom:1px solid #eee">Vraćanje</td><td style="text-align:right;padding:6px 0;border-bottom:1px solid #eee">${d.returnDate}${d.returnTime ? ' u ' + d.returnTime.slice(0,5) : ''}</td></tr>
      <tr><td style="color:#666;padding:6px 0;border-bottom:1px solid #eee">Lokacija</td><td style="text-align:right;padding:6px 0;border-bottom:1px solid #eee">${d.pickupLocation}</td></tr>
      <tr><td style="font-weight:bold;padding:10px 0">Ukupno</td><td style="text-align:right;font-weight:bold;color:#1a56a0;padding:10px 0">${d.totalPrice}€</td></tr>
    </table>

    ${accountSection}

    <p style="font-size:13px;color:#666">Plaćanje se vrši gotovinom ili putem kartice pri preuzimanju vozila. Za plaćanje karticom, obračunava se dodatnih 3% bankarskih usluga.</p>
  </div>
  <div style="background:#0e2d5e;padding:20px 24px;text-align:center">
    <div style="font-weight:800;font-size:14px;color:#fff;letter-spacing:1px;margin-bottom:6px">ADRIA<span style="font-weight:300;color:#4a90d9">DRIVE</span></div>
    <div style="font-size:10px;color:#4a90d9;letter-spacing:2px;margin-bottom:10px">BALKAN · RENT A CAR</div>
    <div style="font-size:12px;color:#7ab8f5">
      <a href="mailto:info@rent-cars.me" style="color:#7ab8f5;text-decoration:none">info@rent-cars.me</a>
      &nbsp;·&nbsp;
      <a href="https://rent-cars.me" style="color:#7ab8f5;text-decoration:none">rent-cars.me</a>
    </div>
    <div style="font-size:11px;color:#4a90d9;margin-top:8px;font-style:italic;font-family:Georgia,serif">"Feel the Balkans. Own the road."</div>
  </div>
</body>
</html>`

  return { subject, html }
}

export function adminEmail(d: {
  refCode: string; guestName: string; guestEmail: string; guestPhone: string
  vehicleName: string; pickupDate: string; returnDate: string; pickupLocation: string
  totalPrice: number; partnerName?: string; commissionAmount?: number
  qrSource?: string; notes?: string
}) {
  const subject = `🚗 Nova rezervacija ${d.refCode} — ${d.guestName}`
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto">
  <div style="background:#0e2d5e;padding:20px">
    <div style="font-weight:800;font-size:16px;color:#fff;letter-spacing:1px;margin-bottom:4px">ADRIA<span style="font-weight:300;color:#4a90d9">DRIVE</span></div>
    <div style="font-size:13px;color:#7ab8f5">Nova rezervacija — ${d.refCode}</div>
  </div>
  <div style="padding:24px">
    <h3 style="margin:0 0 12px;color:#0e2d5e">Gost</h3>
    <table style="width:100%;font-size:14px">
      <tr><td style="color:#666;padding:5px 0;border-bottom:1px solid #eee">Ime</td><td style="text-align:right;padding:5px 0;border-bottom:1px solid #eee">${d.guestName}</td></tr>
      <tr><td style="color:#666;padding:5px 0;border-bottom:1px solid #eee">Email</td><td style="text-align:right;padding:5px 0;border-bottom:1px solid #eee">${d.guestEmail}</td></tr>
      <tr><td style="color:#666;padding:5px 0;border-bottom:1px solid #eee">Telefon</td><td style="text-align:right;padding:5px 0;border-bottom:1px solid #eee">${d.guestPhone}</td></tr>
    </table>
    <h3 style="margin:16px 0 12px;color:#0e2d5e">Rezervacija</h3>
    <table style="width:100%;font-size:14px">
      <tr><td style="color:#666;padding:5px 0;border-bottom:1px solid #eee">Vozilo</td><td style="text-align:right;padding:5px 0;border-bottom:1px solid #eee">${d.vehicleName}</td></tr>
      <tr><td style="color:#666;padding:5px 0;border-bottom:1px solid #eee">Preuzimanje</td><td style="text-align:right;padding:5px 0;border-bottom:1px solid #eee">${d.pickupDate}</td></tr>
      <tr><td style="color:#666;padding:5px 0;border-bottom:1px solid #eee">Vraćanje</td><td style="text-align:right;padding:5px 0;border-bottom:1px solid #eee">${d.returnDate}</td></tr>
      <tr><td style="color:#666;padding:5px 0;border-bottom:1px solid #eee">Lokacija</td><td style="text-align:right;padding:5px 0;border-bottom:1px solid #eee">${d.pickupLocation}</td></tr>
      <tr><td style="font-weight:bold;padding:10px 0">Ukupno</td><td style="text-align:right;font-weight:bold;color:#1a56a0;padding:10px 0">${d.totalPrice}€</td></tr>
    </table>
    ${d.partnerName ? `<div style="background:#FAEEDA;border:1px solid #EF9F27;border-radius:8px;padding:14px;margin-top:16px"><strong>Izvor (QR): ${d.partnerName}</strong><br><span style="font-size:13px">Provizija: ${d.commissionAmount?.toFixed(2)}€ · QR: ${d.qrSource}</span></div>` : ''}
    ${d.notes ? `<div style="margin-top:12px;padding:12px;background:#f5f5f5;border-radius:8px;font-size:13px"><strong>Napomena:</strong> ${d.notes}</div>` : ''}
  </div>
</body>
</html>`
  return { subject, html }
}
