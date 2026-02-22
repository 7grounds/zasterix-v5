import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export default async function WoDashboard() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Daten parallel abrufen
  const [configRes, tasksRes] = await Promise.all([
    supabase.from('wo_config').select('value').eq('key', 'vision').single(),
    supabase.from('wo_tasks').select('*').order('created_at', { ascending: false })
  ]);

  const vision = configRes.data?.value || "Keine Vision definiert.";
  const tasks = tasksRes.data || [];

  return (
    <div style={{ padding: '40px', backgroundColor: '#050505', color: '#e0e0e0', minHeight: '100vh', fontFamily: 'monospace' }}>
      <header style={{ borderLeft: '4px solid #00ff00', paddingLeft: '20px', marginBottom: '40px' }}>
        <h1 style={{ fontSize: '2rem', letterSpacing: '-1px' }}>ZASTERIX-V5 // OPERATIONAL DATA</h1>
        <p style={{ color: '#00ff00', fontSize: '0.9rem' }}>STATUS: ONLINE // AGENT-FIRM-CORE</p>
        <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#111', borderRadius: '4px', border: '1px solid #222' }}>
          <span style={{ color: '#888' }}>MASTER_VISION:</span> {vision}
        </div>
      </header>

      <main>
        <h2 style={{ fontSize: '1.2rem', marginBottom: '20px', color: '#888' }}>&gt; INBOX_QUEUE</h2>
        
        <div style={{ display: 'grid', gap: '15px' }}>
          {tasks.length === 0 ? (
            <p style={{ color: '#444' }}>No tasks found in wo_tasks.</p>
          ) : (
            tasks.map((task) => (
              <div key={task.id} style={{ 
                padding: '15px', 
                backgroundColor: '#111', 
                border: '1px solid #222', 
                borderRadius: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>{task.title}</div>
                  <div style={{ fontSize: '0.85rem', color: '#666' }}>{task.description}</div>
                  <div style={{ fontSize: '0.7rem', color: '#444', marginTop: '5px' }}>ID: {task.id}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ 
                    display: 'inline-block',
                    padding: '4px 12px', 
                    borderRadius: '20px', 
                    fontSize: '0.75rem',
                    backgroundColor: task.status === 'pending' ? '#222' : '#004400',
                    color: task.status === 'pending' ? '#888' : '#00ff00',
                    border: `1px solid ${task.status === 'pending' ? '#333' : '#00ff00'}`
                  }}>
                    {task.status.toUpperCase()}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#444', marginTop: '8px' }}>
                    LVL: {task.impact_level}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
