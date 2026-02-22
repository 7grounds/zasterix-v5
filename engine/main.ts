import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from "@google/generative-ai";

async function runEngine() {
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  // 1. Task holen
  const { data: task } = await supabase.from('wo_tasks').select('*').eq('status', 'pending').limit(1).single();
  if (!task) return console.log("📭 Keine Tasks.");

  console.log(`🧠 Gemini analysiert: ${task.title}`);
  await supabase.from('wo_tasks').update({ status: 'in_progress' }).eq('id', task.id);

  try {
    // 2. Gemini fragen
    const prompt = `Du bist der Strategie-Agent der Firma Zasterix V5. 
    Analysiere diesen Auftrag: "${task.title}". 
    Beschreibung: "${task.description}".
    Gib eine ultrakurze Empfehlung (max 2 Sätze), wie wir das angehen sollten.`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // 3. Ergebnis in die Logs und den Task schreiben
    await supabase.from('wo_logs').insert({
      task_id: task.id,
      message: `Gemini-Analyse: ${responseText}`
    });

    await supabase.from('wo_tasks').update({ 
      status: 'completed',
      output_data: { ai_analysis: responseText }
    }).eq('id', task.id);

    console.log("✅ Analyse abgeschlossen.");

  } catch (err: any) {
    console.error("💥 Gemini Fehler:", err.message);
    await supabase.from('wo_tasks').update({ status: 'failed' }).eq('id', task.id);
  }
}

runEngine();


    
