import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const resend = new Resend(process.env.RESEND_API_KEY)
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

    const { partnerName, partnerEmail } = await req.json()
    if (!partnerEmail) return NextResponse.json({ error: 'Email je obavezan' }, { status: 400 })

    // Pronađi korisnika
    const { data: existingUsers } = await supabase.auth.admin.listUsers()
    const user = existingUsers?.users?.find(u => u.email === partnerEmail)

    if (!user) {
      return NextResponse.json({ error: 'Korisnik nije pronađen' }, { status: 404 })
    }

    // Postavi novu privremenu lozinku
    const tempPassword = generateTempPassword()
    const { error } = await supabase.auth.admin.updateUserById(user.id, { password: tempPassword })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Pošalji email
    await resend.emails.send({
      from: process.env.FROM_EMAIL!,
      to: partnerEmail,
      subject: `AdriaDrive — Reset lozinke`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto">
          <div style="background:#0e2d5e;padding:24px;text-align:center">
            <div style="font-weight:800;font-size:22px;color:#fff;letter-spacing:1px">ADRIA<span style="font-weight:300;color:#4a90d9">DRIVE</span></div>
            <div style="font-size:10px;color:#4a90d9;letter-spacing:3px;margin-top:4px">BALKAN · RENT A CAR</div>
          </div>
          <div style="padding:28px 24px">
            <p style="font-size:15px;color:#111">Poštovani/a <strong>${partnerName}</strong>,</p>
            <p style="font-size:14px;color:#374151">Administrator je resetovao vašu lozinku. Ispod su vaši novi podaci za prijavu.</p>
            <div style="background:#e8f0fb;border:1px solid #4a90d9;border-radius:10px;padding:20px;margin:20px 0;text-align:center">
              <div style="font-size:14px;font-weight:600;color:#0e2d5e;margin-bottom:8px">Novi podaci za prijavu</div>
              <div style="font-size:13px;color:#374151;margin-bottom:10px">Email: <strong>${partnerEmail}</strong></div>
              <div style="background:#fff;border-radius:8px;padding:12px;margin-bottom:14px;display:inline-block">
                <div style="font-size:12px;color:#9ca3af;margin-bottom:4px">Nova privremena lozinka</div>
                <div style="font-size:24px;font-weight:bold;font-family:monospace;color:#1a56a0;letter-spacing:2px">${tempPassword}</div>
              </div>
              <div style="font-size:11px;color:#9ca3af;margin-bottom:14px">Preporučujemo da promijenite lozinku nakon prijave.</div>
              <a href="${siteUrl}/partner/login" style="display:inline-block;padding:11px 28px;background:#1a56a0;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px">
                Prijavite se na partner portal
              </a>
            </div>
          </div>
          <div style="background:#0e2d5e;padding:20px 24px;text-align:center">
            <div style="font-weight:800;font-size:14px;color:#fff;letter-spacing:1px;margin-bottom:6px">ADRIA<span style="font-weight:300;color:#4a90d9">DRIVE</span></div>
            <div style="font-size:12px;color:#7ab8f5;margin-top:8px">
              <a href="mailto:info@rent-cars.me" style="color:#7ab8f5;text-decoration:none">info@rent-cars.me</a>
              &nbsp;·&nbsp;
              <a href="https://rent-cars.me" style="color:#7ab8f5;text-decoration:none">rent-cars.me</a>
            </div>
          </div>
        </div>
      `,
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Greška servera' }, { status: 500 })
  }
}
