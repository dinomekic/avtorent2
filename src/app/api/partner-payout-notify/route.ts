import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

export async function POST(req: NextRequest) {
  try {
    const { partnerName, partnerEmail, amount, note } = await req.json()
    const resend = new Resend(process.env.RESEND_API_KEY)
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

    await resend.emails.send({
      from: process.env.FROM_EMAIL!,
      to: partnerEmail,
      subject: `AdriaDrive — Zahtjev za isplatu provizije ${amount.toFixed(2)}€`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto">
          <div style="background:#0e2d5e;padding:24px;text-align:center">
            <div style="font-weight:800;font-size:22px;color:#fff;letter-spacing:1px">ADRIA<span style="font-weight:300;color:#4a90d9">DRIVE</span></div>
            <div style="font-size:10px;color:#4a90d9;letter-spacing:3px;margin-top:4px">BALKAN · RENT A CAR</div>
          </div>
          <div style="padding:28px 24px">
            <p>Poštovani/a <strong>${partnerName}</strong>,</p>
            <p>Administrator je pokrenuo zahtjev za isplatu vaše provizije.</p>
            <div style="background:#e8f0fb;border:1px solid #4a90d9;border-radius:10px;padding:20px;text-align:center;margin:20px 0">
              <div style="font-size:13px;color:#0e2d5e;margin-bottom:6px">Iznos isplate</div>
              <div style="font-size:32px;font-weight:700;color:#1a56a0">${amount.toFixed(2)}€</div>
              ${note ? `<div style="font-size:13px;color:#0e2d5e;margin-top:8px">${note}</div>` : ''}
            </div>
            <p style="font-size:14px;color:#374151">Prijavite se na vaš partner portal i potvrdite prijem sredstava:</p>
            <div style="text-align:center;margin:20px 0">
              <a href="${siteUrl}/partner" style="display:inline-block;padding:12px 28px;background:#1a56a0;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px">
                Potvrdi prijem na partner portalu
              </a>
            </div>
            <p style="font-size:12px;color:#9ca3af">Link na portal: ${siteUrl}/partner/login</p>
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
