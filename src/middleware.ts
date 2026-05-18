import { NextRequest, NextResponse } from 'next/server'

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    const token = req.cookies.get('avtorent-admin-token')?.value
    if (!token) return NextResponse.redirect(new URL('/login-kartica', req.url))
  }
  if (pathname.startsWith('/partner') && pathname !== '/partner/login') {
    const token = req.cookies.get('avtorent-partner-token')?.value
    if (!token) return NextResponse.redirect(new URL('/partner/login', req.url))
  }
  if (pathname.startsWith('/pranje') && pathname !== '/pranje/login') {
    const token = req.cookies.get('avtorent-wash-token')?.value
    if (!token) return NextResponse.redirect(new URL('/pranje/login', req.url))
  }
  if (pathname.startsWith('/saradnik') && pathname !== '/saradnik/login') {
    const token = req.cookies.get('avtorent-collab-token')?.value
    if (!token) return NextResponse.redirect(new URL('/saradnik/login', req.url))
  }
  if (pathname.startsWith('/moje') && pathname !== '/moje/login') {
    const token = req.cookies.get('avtorent-client-token')?.value
    if (!token) return NextResponse.redirect(new URL('/moje/login', req.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/partner/:path*', '/moje/:path*', '/saradnik/:path*', '/pranje/:path*'],
}
