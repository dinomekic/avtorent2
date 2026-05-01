import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabase'
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { data, error } = await supabaseAdmin
    .from('price_recommendations')
    .update({ is_applied: true, applied_at: new Date().toISOString() })
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
