import { createClient } from '@supabase/supabase-js';

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase.from('agent_tasks').select('count').limit(1);

  if (error) return new Response(JSON.stringify({ status: '❌ Fehler', error }), { status: 500 });
  return new Response(JSON.stringify({ status: '✅ Verbindung steht!', data }), { status: 200 });
}
