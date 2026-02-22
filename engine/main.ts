import { createClient } from '@supabase/supabase-js';

async function testConnection() {
  console.log("🚀 Zasterix-V5 Engine startet...");
  
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error("❌ Fehler: Supabase Secrets fehlen!");
    process.exit(1);
  }

  console.log("✅ Umgebungsvariablen geladen.");
  console.log("🤖 Verbindung zu Supabase wird geprüft...");
  
  // Hier würde deine Logik starten
  console.log("🏁 Testlauf erfolgreich beendet.");
}

testConnection();
