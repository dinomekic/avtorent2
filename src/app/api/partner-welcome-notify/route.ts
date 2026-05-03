import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

export async function POST(req: NextRequest) {
  try {
    const { partnerName, partnerEmail, qrCode, portalEmail, isNewCode, qrLabel } = await req.json()
    const resend = new Resend(process.env.RESEND_API_KEY)
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

    const qrLink = `${siteUrl}/?ref=${qrCode}`

    const messageSuggestionEN = `As our guest, you have an exclusive benefit — a special discount on car rental with our trusted partner. Picking up your vehicle is quick and hassle-free:
✔️ No deposit required
✔️ Pay on pickup — cash or card
✔️ Fast and simple pick-up & drop-off, no waiting
Book in advance and secure your car at the exclusive guest rate:
👉 ${qrLink}`

    await resend.emails.send({
      from: process.env.FROM_EMAIL!,
      to: partnerEmail,
      subject: isNewCode ? `AdriaDrive — Novi QR kod: ${qrLabel || qrCode}` : `AdriaDrive — Dobrodošli u partnerski program`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto">
          <div style="background:#0e2d5e;padding:24px;text-align:center">
            <div style="font-weight:800;font-size:22px;color:#fff;letter-spacing:1px">ADRIA<span style="font-weight:300;color:#4a90d9">DRIVE</span></div>
            <div style="font-size:10px;color:#4a90d9;letter-spacing:3px;margin-top:4px">BALKAN · RENT A CAR</div>
          </div>

          <div style="padding:28px 24px">
            <p style="font-size:15px;color:#111">Poštovani/a <strong>${partnerName}</strong>,</p>
            <p style="font-size:14px;color:#374151">${isNewCode ? `Kreiran je novi QR kod <strong>${qrLabel || qrCode}</strong> za vaš partnerski nalog. Možete ga koristiti za praćenje konverzija iz novog kanala.` : `Vaš partnerski nalog na AdriaDrive platformi je kreiran. Od sada možete pratiti posjete, rezervacije i provizije na vašem partner portalu.`}</p>

            <!-- Portal pristup -->
            <div style="background:#e8f0fb;border:1px solid #4a90d9;border-radius:10px;padding:20px;margin:20px 0;text-align:center">
              <div style="font-size:14px;font-weight:600;color:#0e2d5e;margin-bottom:6px">Partner portal</div>
              <div style="font-size:13px;color:#374151;margin-bottom:14px">Prijavite se sa emailom: <strong>${portalEmail || partnerEmail}</strong></div>
              <a href="${siteUrl}/partner/login" style="display:inline-block;padding:11px 28px;background:#1a56a0;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px">
                Otvorite partner portal →
              </a>
              <div style="font-size:11px;color:#9ca3af;margin-top:10px">${siteUrl}/partner/login</div>
            </div>

            <!-- QR kod info -->
            <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:20px;margin:20px 0">
              <div style="font-size:14px;font-weight:600;color:#111;margin-bottom:8px">Vaš QR kod</div>
              <div style="font-size:13px;color:#374151;margin-bottom:12px">Svaki gost koji rezerviše vozilo putem vašeg linka dobija ekskluzivni popust, a vi zarađujete proviziju od svake rezervacije.</div>
              <div style="background:#FAEEDA;border-radius:8px;padding:12px;text-align:center;margin-bottom:12px">
                <div style="font-size:12px;color:#854F0B;margin-bottom:4px">Vaš referalni link</div>
                <a href="${qrLink}" style="font-size:13px;font-weight:600;color:#854F0B;word-break:break-all">${qrLink}</a>
              </div>
              <div style="text-align:center">
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(qrLink)}&format=png" width="160" height="160" alt="QR kod" style="display:block;margin:0 auto" />
              </div>
            </div>

            <!-- Predlog poruke -->
            <div style="background:#f0fdf8;border:1px solid #5DCAA5;border-radius:10px;padding:20px;margin:20px 0">
              <div style="font-size:14px;font-weight:600;color:#085041;margin-bottom:4px">💬 Predlog poruke za goste</div>
              <div style="font-size:12px;color:#6b7280;margin-bottom:12px">Pošaljite ovu poruku gostima putem WhatsApp-a, SMS-a ili emaila:</div>
              <div style="background:#fff;border-radius:8px;padding:16px;font-size:13px;color:#374151;line-height:1.7;border:1px solid #d1fae5;white-space:pre-line">As our guest, you have an exclusive benefit — a special discount on car rental with our trusted partner. Picking up your vehicle is quick and hassle-free:
✔️ No deposit required
✔️ Pay on pickup — cash or card
✔️ Fast and simple pick-up &amp; drop-off, no waiting
Book in advance and secure your car at the exclusive guest rate:
👉 <a href="${qrLink}" style="color:#1a56a0;font-weight:600">${qrLink}</a></div>
            </div>

            <p style="font-size:13px;color:#6b7280;margin-top:20px">Za sva pitanja slobodno nas kontaktirajte na <a href="mailto:info@rent-cars.me" style="color:#1a56a0">info@rent-cars.me</a>.</p>
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
        </div>
      `,
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Greška' }, { status: 500 })
  }
}
