import { useState, useEffect, useCallback } from 'react';
import { Sparks, RefreshDouble } from 'iconoir-react';
import { supabase } from '../../lib/supabase';
import { generateDailyBriefing } from '../../lib/gemini';
import type { BriefingData } from '../../lib/gemini';

export default function AIDailyBriefing() {
  const [briefingText, setBriefingText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [timestamp, setTimestamp] = useState('');
  const [societyId, setSocietyId] = useState<string | null>(null);

  useEffect(() => {
    const fetchSociety = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase
        .from('users')
        .select('society_id')
        .eq('id', user.id)
        .single()
      setSocietyId(profile?.society_id || null)
    }
    fetchSociety()
  }, []);

  const load = useCallback(async () => {
    if (!societyId) return;
    setLoading(true);
    setError('');
    try {
      const [
        { count: totalComplaints },
        { count: pendingComplaints },
        { count: solvedComplaints },
        { count: slaBreaches },
        { data: categoriesRaw },
        { count: totalTechnicians },
        { count: availableTechnicians },
        { count: overdueMaintenances },
        { count: activeAlerts },
        { data: societyData },
        { count: totalVendors },
        { count: expiringVendors },
      ] = await Promise.all([
        supabase.from('complaints').select('*', { count: 'exact', head: true }),
        supabase.from('complaints').select('*', { count: 'exact', head: true }).eq('status', 'open'),
        supabase.from('complaints').select('*', { count: 'exact', head: true }).eq('status', 'resolved'),
        supabase.from('complaints').select('*', { count: 'exact', head: true }).lt('sla_deadline', new Date().toISOString()).not('status', 'in', '("resolved","closed","verified")'),
        supabase.from('complaints').select('category'),
        supabase.from('technicians').select('*', { count: 'exact', head: true }).eq('society_id', societyId),
        supabase.from('technicians').select('*', { count: 'exact', head: true }).eq('society_id', societyId).eq('is_available', true),
        supabase.from('maintenance_schedules').select('*', { count: 'exact', head: true }).lt('next_due_date', new Date().toISOString()),
        supabase.from('alerts').select('*', { count: 'exact', head: true }),
        supabase.from('societies').select('name').eq('id', societyId).single(),
        supabase.from('vendors').select('*', { count: 'exact', head: true }).eq('society_id', societyId).eq('status', 'active'),
        supabase.from('vendors').select('*', { count: 'exact', head: true }).eq('society_id', societyId).eq('status', 'active').lt('contract_end', new Date(Date.now() + 30*24*60*60*1000).toISOString()).gt('contract_end', new Date().toISOString())
      ]);

      let topCategory = 'None';
      if (categoriesRaw && categoriesRaw.length > 0) {
        const counts: Record<string, number> = {};
        categoriesRaw.forEach((c) => {
          if (c.category) {
            counts[c.category] = (counts[c.category] || 0) + 1;
          }
        });
        topCategory = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
      }

      const data: Record<string, unknown> = {
        totalComplaints: totalComplaints ?? 0,
        pendingComplaints: pendingComplaints ?? 0,
        solvedComplaints: solvedComplaints ?? 0,
        slaBreaches: slaBreaches ?? 0,
        topCategory,
        totalTechnicians: totalTechnicians ?? 0,
        availableTechnicians: availableTechnicians ?? 0,
        overdueMaintenances: overdueMaintenances ?? 0,
        activeAlerts: activeAlerts ?? 0,
        societyName: societyData?.name ?? 'the society',
        totalVendors: totalVendors ?? 0,
        expiringVendors: expiringVendors ?? 0,
      };

      const resultText = await generateDailyBriefing(data);
      setBriefingText(resultText);
      setTimestamp('Generated just now');
    } catch (e: unknown) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'Failed to generate briefing');
    } finally {
      setLoading(false);
    }
  }, [societyId]);

  useEffect(() => {
    if (societyId) {
      load();
    }
  }, [load, societyId]);

  // Parsing the briefing text
  const lines = briefingText.split('\n').map(l => l.trim()).filter(Boolean);
  let statusLine = '';
  let bulletPoints: string[] = [];
  let focusLine = '';

  if (lines.length > 0) {
    statusLine = lines[0];
    if (lines.length > 1) {
      focusLine = lines[lines.length - 1];
      bulletPoints = lines.slice(1, lines.length - 1);
    }
  }

  // Parse status color
  let statusColor = '#1C1917'; // default
  if (statusLine.toLowerCase().includes('good')) statusColor = '#16A34A';
  if (statusLine.toLowerCase().includes('needs attention')) statusColor = '#D97706';
  if (statusLine.toLowerCase().includes('critical')) statusColor = '#DC2626';

  return (
    <div style={{
      background: '#FFFFFF',
      borderRadius: 16,
      padding: 20,
      border: '1px solid #E0DDD9',
      borderLeft: '3px solid #D97706',
      width: '100%',
      marginBottom: 24,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparks width={20} height={20} style={{ color: '#D97706' }} />
            <h3 style={{ fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 16, color: '#1C1917', margin: 0 }}>
              AI Daily Briefing
            </h3>
          </div>
          {timestamp && !loading && !error && (
            <p style={{ fontFamily: 'Inter', fontSize: 11, color: '#9C9894', margin: '4px 0 0 28px' }}>
              {timestamp}
            </p>
          )}
        </div>
        <button
          onClick={load}
          disabled={loading}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'transparent',
            border: '1px solid #E0DDD9',
            borderRadius: 8,
            padding: '6px 12px',
            fontFamily: 'Inter', fontWeight: 500, fontSize: 12, color: '#1C1917',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.5 : 1
          }}
        >
          {loading ? (
            <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeDasharray="32" strokeLinecap="round" className="opacity-25"></circle>
              <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" fill="currentColor" className="opacity-75"></path>
            </svg>
          ) : (
            <RefreshDouble width={14} height={14} />
          )}
          Regenerate
        </button>
      </div>

      {/* Body */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0 4px 28px' }}>
          <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ color: '#D97706' }}>
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeDasharray="32" strokeLinecap="round" className="opacity-25"></circle>
            <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" fill="currentColor" className="opacity-75"></path>
          </svg>
          <span style={{ fontFamily: 'Inter', fontSize: 14, color: '#6B6560' }}>Generating your briefing…</span>
        </div>
      ) : error ? (
        <div style={{ padding: '0 0 0 28px' }}>
          <p style={{ fontFamily: 'Inter', fontSize: 14, color: '#DC2626', margin: '0 0 8px' }}>{error}</p>
          <button onClick={load} style={{ fontFamily: 'Inter', fontWeight: 500, fontSize: 13, color: '#DC2626', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', textDecoration: 'underline' }}>
            Try again
          </button>
        </div>
      ) : (
        <div style={{ padding: '0 0 0 28px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {statusLine && (
            <p style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 15, color: statusColor, margin: 0 }}>
              {statusLine.replace(/^[\d.]+\s*/, '')}
            </p>
          )}
          
          {bulletPoints.length > 0 && (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {bulletPoints.map((point, i) => {
                const cleanPoint = point.replace(/^[-*•\d.]+\s*/, '');
                return (
                  <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontFamily: 'Inter', fontSize: 14, color: '#1C1917', lineHeight: 1.5 }}>
                    <span style={{ color: '#D97706', fontSize: 18, lineHeight: '14px' }}>•</span>
                    <span>{cleanPoint}</span>
                  </li>
                );
              })}
            </ul>
          )}

          {focusLine && (
            <p style={{ fontFamily: 'Inter', fontStyle: 'italic', fontSize: 13, color: '#9C9894', margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: 6 }}>
              📌 Focus today: {focusLine.replace(/^[\d.]+\s*|📌\s*|Focus today:\s*/i, '')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
