import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function runSmallStep() {
  console.log("🚶 Kleiner Schritt: Engine startet...");

  // 1. Vision abrufen
  const { data: config, error: configErr } = await supabase
    .from('wo_config')
    .select('value')
    .eq('key', 'vision')
    .single();

  if (configErr) return console.error("❌ Vision nicht gefunden:", configErr.message);
  console.log("📖 Vision erkannt:", config.value);

  // 2. Nach dem ersten Task suchen
  const { data: task, error: taskErr } = await supabase
    .from('wo_tasks')
    .select('*')
    .eq('status', 'pending')
    .limit(1)
    .single();

  if (!task) {
    console.log("📭 Briefkasten ist leer. Keine Arbeit für heute.");
    return;
  }

  // 3. Nur einen Log-Eintrag schreiben (noch keine KI)
  await supabase.from('wo_logs').insert({
    task_id: task.id,
    message: `Postbote hat Task '${task.title}' gesehen. Bereit für KI-Anbindung.`
  });

  console.log(`✅ Task '${task.title}' erfolgreich im Log registriert.`);
}

runSmallStep();
