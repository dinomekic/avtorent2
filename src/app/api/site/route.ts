import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { searchParams } = new URL(req.url)
  const domain = searchParams.get('domain') || 'avtorent2-bvkv.vercel.app'

  const { data } = await supabase
    .from('sites')
    .select('*')
    .eq('domain', domain)
    .eq('is_active', true)
    .single()

  if (!data) {
    // Vrati default sajt
    const { data: defaultSite } = await supabase
      .from('sites')
      .select('*')
      .eq('is_active', true)
      .order('created_at')
      .limit(1)
      .single()
    return NextResponse.json(defaultSite || null)
  }

  return NextResponse.json(data)
}
