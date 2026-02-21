/**
 * test-connection.ts — smoke-test for both external connections.
 *
 * Run with:  npx ts-node src/test-connection.ts
 *
 * What it verifies:
 *  1. Supabase — initialises the client using the Service Role Key and attempts
 *     to fetch one row from the `agent_tasks` table.
 *  2. Gemini  — initialises the @google/generative-ai SDK and asks the model
 *     to respond with "Zasterix-V5 Connection Verified."
 *
 * All configuration is read from engine/src/config.ts (and ultimately from
 * your .env file — copy .env.example and fill in real values before running).
 */

import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import config from './config';

async function testSupabase(): Promise<void> {
  console.log('\n── Supabase Connection Test ──────────────────────────────');

  const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from('agent_tasks')
    .select('*')
    .limit(1);

  if (error) {
    throw new Error(`Supabase error: ${error.message}`);
  }

  if (data && data.length > 0) {
    console.log('✓ Supabase connected. First agent_tasks row:');
    console.log(JSON.stringify(data[0], null, 2));
  } else {
    console.log('✓ Supabase connected. agent_tasks table is empty (no rows yet).');
  }
}

async function testGemini(): Promise<void> {
  console.log('\n── Gemini Connection Test ────────────────────────────────');

  const genAI = new GoogleGenerativeAI(config.geminiApiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const result = await model.generateContent(
    'Please respond with exactly the following phrase and nothing else: "Zasterix-V5 Connection Verified."'
  );

  const text = result.response.text().trim();
  console.log('✓ Gemini responded:', text);
}

async function main(): Promise<void> {
  console.log('=== Zasterix-V5 Connection Test ===');

  let supabaseOk = false;
  let geminiOk = false;

  try {
    await testSupabase();
    supabaseOk = true;
  } catch (err) {
    console.error('✗ Supabase test failed:', err instanceof Error ? err.message : err);
  }

  try {
    await testGemini();
    geminiOk = true;
  } catch (err) {
    console.error('✗ Gemini test failed:', err instanceof Error ? err.message : err);
  }

  console.log('\n── Summary ───────────────────────────────────────────────');
  console.log(`  Supabase : ${supabaseOk ? '✓ OK' : '✗ FAILED'}`);
  console.log(`  Gemini   : ${geminiOk   ? '✓ OK' : '✗ FAILED'}`);

  if (!supabaseOk || !geminiOk) {
    process.exit(1);
  }
}

main();
