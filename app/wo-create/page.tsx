"use client";
import { useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function WoCreate() {
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [loading, setLoading] = useState(false);
  const supabase = createClientComponentClient();

  const createTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    await supabase.from('wo_tasks').insert({
      title,
      description: desc,
      status: 'pending'
    });

    setTitle('');
    setDesc('');
    setLoading(false);
    alert("Task im Briefkasten gelandet!");
  };

  return (
    <div style={{ padding: '40px', backgroundColor: '#050505', color: '#00ff00', fontFamily: 'monospace', minHeight: '100vh' }}>
      <h2>➕ NEUER AUFTRAG (v5)</h2>
      <form onSubmit={createTask} style={{ display: 'flex', flexDirection: 'column', gap: '15px', maxWidth: '400px' }}>
        <input 
          value={title} 
          onChange={e => setTitle(e.target.value)} 
          placeholder="Titel (z.B. Markt-Check)" 
          style={{ padding: '10px', background: '#111', color: '#00ff00', border: '1px solid #00ff00' }}
        />
        <textarea 
          value={desc} 
          onChange={e => setDesc(e.target.value)} 
          placeholder="Beschreibung..." 
          style={{ padding: '10px', background: '#111', color: '#00ff00', border: '1px solid #00ff00', minHeight: '100px' }}
        />
        <button type="submit" disabled={loading} style={{ padding: '10px', background: '#00ff00', color: '#000', cursor: 'pointer', fontWeight: 'bold' }}>
          {loading ? 'SENDE...' : 'IN DEN BRIEFKASTEN WERFEN'}
        </button>
      </form>
      <br />
      <a href="/wo-dashboard" style={{ color: '#888' }}> zurück zum Dashboard</a>
    </div>
  );
}
