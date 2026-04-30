export type SiteConfig = {
  id: string
  domain: string
  name: string
  tagline: string
  primaryColor: string
  secondaryColor: string
  logoText: string
  priceModifier: number
  fromEmail: string
  adminEmail: string
}

export const DEFAULT_SITE: SiteConfig = {
  id: '',
  domain: 'avtorent2-bvkv.vercel.app',
  name: 'AvtoRent',
  tagline: 'Rent a car in Montenegro',
  primaryColor: '#1D9E75',
  secondaryColor: '#185FA5',
  logoText: 'AvtoRent',
  priceModifier: 1.00,
  fromEmail: 'onboarding@resend.dev',
  adminEmail: '',
}

export const CORPORATE_SITE: SiteConfig = {
  id: '',
  domain: 'corporate',
  name: 'Montenegro Drive',
  tagline: 'Premium car rental experience',
  primaryColor: '#1a1a2e',
  secondaryColor: '#e94560',
  logoText: 'MonteDrive',
  priceModifier: 0.90,
  fromEmail: 'onboarding@resend.dev',
  adminEmail: '',
}
