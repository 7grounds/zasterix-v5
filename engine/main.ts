import { createClient } from '@supabase/supabase-js';

async function run() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log("--- DEBUG START ---");
  console.log("URL vorhanden:", !!url, url ? `(Länge: ${url.length})` : "");
  console.log("KEY vorhanden:", !!key, key ? `(Länge: ${key.length})` : "");
  console.log("--- DEBUG END ---");

  if (!url || !key || url === "" || key === "") {
    console.error("❌ ABBRUCH: Variablen sind leer oder fehlen.");
    return;
  }

  try {
    const supabase = createClient(url, key);
    const { data, error } = await supabase.from('wo_tasks').select('count').single();
    
    if (error) throw error;
    console.log("✅ Verbindung erfolgreich! Tasks gefunden.");
    
    // Hier setzen wir den Testlauf auf completed, falls er da ist
    await supabase.from('wo_tasks').update({ status: 'completed' }).eq('title', 'Testlauf');
    
  } catch (err: any) {
    console.error("❌ Fehler bei der Ausführung:", err.message);
  }
}

run();

    
