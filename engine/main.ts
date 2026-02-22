import { createClient } from '@supabase/supabase-js';

// 1. Umgebungs-Check (Detektiv-Modus)
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log("🚀 Engine Start-Sequenz...");
console.log("DEBUG: SUPABASE_URL vorhanden?", !!url);
console.log("DEBUG: SUPABASE_SERVICE_ROLE_KEY vorhanden?", !!key);

if (!url || !key) {
  console.error("❌ FEHLER: Umgebungsvariablen fehlen!");
  process.exit(1); // Beendet den Prozess sofort mit Fehler
}

const supabase = createClient(url, key);

async function runEngine() {
  try {
    // 2. Vision aus wo_config laden
    const { data: config, error: configErr } = await supabase
      .from('wo_config')
      .select('value')
      .eq('key', 'vision')
      .single();

    if (configErr) {
      console.error("❌ Fehler beim Laden der Vision:", configErr.message);
    } else {
      console.log("📖 Aktuelle Vision:", config.value);
    }

    // 3. Nach Aufgaben suchen
    const { data: task, error: taskErr } = await supabase
      .from('wo_tasks')
      .select('*')
      .eq('status', 'pending')
      .limit(1)
      .single();

    if (taskErr || !task) {
      console.log("📭 Keine neuen Aufgaben gefunden.");
      return;
    }

    console.log(`✉️ Bearbeite Task: ${task.title}`);

    // 4. Status auf in_progress setzen
    await supabase.from('wo_tasks').update({ status: 'in_progress' }).eq('id', task.id);

    // 5. Ein Log-Eintrag zur Bestätigung schreiben
    await supabase.from('wo_logs').insert({
      task_id: task.id,
      message: `Postbote hat den Task '${task.title}' erfolgreich gestartet.`,
      level: 'info'
    });

    // 6. Task als erledigt markieren (für diesen kleinen Testschritt)
    await supabase.from('wo_tasks').update({ status: 'completed' }).eq('id', task.id);
    
    console.log("✅ Task erfolgreich verarbeitet.");

  } catch (err: any) {
    console.error("💥 Kritischer Engine-Fehler:", err.message);
  }
}

runEngine
