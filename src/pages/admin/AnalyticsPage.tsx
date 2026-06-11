import { useState, useEffect, useCallback, useMemo } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { supabase } from '../../lib/supabase';
import AdminLayout from '../../components/AdminLayout';

interface Complaint {
  id: string;
  category: string;
  status: string;
  created_at: string;
  updated_at: string;
  sla_deadline: string;
}

const STATUS_COLORS: Record<string, string> = {
  open: '#3B82F6',        
  triaged: '#8B5CF6',     
  assigned: '#6366F1',    
  accepted: '#06B6D4',    
  in_progress: '#F59E0B', 
  on_hold: '#6B6560',     
  resolved: '#10B981',    
  verified: '#14B8A6',    
  closed: '#9C9894',      
  escalated: '#F43F5E',   
  reopened: '#F97316',    
};

export default function AnalyticsPage() {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase.from('users').select('society_id').eq('id', user.id).single();

      // Fetch all complaints for analytics (in a real app, you might want to paginate or filter by date range)
      let query = supabase
        .from('complaints')
        .select('id, category, status, created_at, updated_at, sla_deadline');

      if (profile?.society_id) {
        query = query.eq('society_id', profile.society_id);
      }

      const { data, error: e } = await query;

      if (e) throw new Error(e.message);
      setComplaints(data || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error loading analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const metrics = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let thisMonthCount = 0;
    let totalResolutionTime = 0;
    let resolvedCount = 0;
    let slaCompliantCount = 0;

    const categoryCounts: Record<string, number> = {};
    const statusCounts: Record<string, number> = {};

    complaints.forEach((c) => {
      // Current month check
      const createdDate = new Date(c.created_at);
      if (createdDate.getMonth() === currentMonth && createdDate.getFullYear() === currentYear) {
        thisMonthCount++;
      }

      // Resolution Time & SLA Check
      if (['closed', 'resolved', 'verified'].includes(c.status)) {
        resolvedCount++;
        const resolveTime = new Date(c.updated_at).getTime() - new Date(c.created_at).getTime();
        totalResolutionTime += resolveTime;

        if (new Date(c.updated_at).getTime() <= new Date(c.sla_deadline).getTime()) {
          slaCompliantCount++;
        }
      }

      // Category counts
      categoryCounts[c.category] = (categoryCounts[c.category] || 0) + 1;

      // Status counts
      statusCounts[c.status] = (statusCounts[c.status] || 0) + 1;
    });

    const avgResolutionHours = resolvedCount > 0 ? (totalResolutionTime / resolvedCount) / (1000 * 60 * 60) : 0;
    const slaComplianceRate = resolvedCount > 0 ? Math.round((slaCompliantCount / resolvedCount) * 100) : 0;

    // Top 5 Categories
    const topCategories = Object.entries(categoryCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Status Pie Data
    const statusData = Object.entries(statusCounts)
      .map(([name, value]) => ({
        name: name.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase()),
        rawStatus: name,
        value
      }))
      .sort((a, b) => b.value - a.value);

    return {
      thisMonthCount,
      avgResolutionHours: avgResolutionHours.toFixed(1),
      slaComplianceRate,
      topCategories,
      statusData
    };
  }, [complaints]);

  return (
    <AdminLayout>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '32px 0' }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 24, color: '#1C1917', margin: '0 0 4px' }}>Analytics</h1>
          <p style={{ fontFamily: 'Inter', fontSize: 15, color: '#6B6560', margin: 0 }}>Overview of complaint metrics and performance</p>
        </div>

        {/* TEMP: WhatsApp test button */}
        <button
          onClick={async () => {
            const { data, error } = await supabase.functions.invoke('send-whatsapp', {
              body: {
                technicianPhone: '+919886218304',
                technicianName: 'John',
                complaintTitle: 'Test complaint',
                complaintDescription: 'Test description',
                flatLocation: 'A-101',
                priority: 'high',
                slaDeadline: '2 Jun 10:00 AM'
              }
            })
            console.log('data:', JSON.stringify(data))
            console.log('error:', JSON.stringify(error))
            alert(JSON.stringify({ data, error }))
          }}
          style={{ background: '#BE123C', color: '#FFFFFF', padding: '8px 16px', borderRadius: 8, border: 'none', marginBottom: 24, cursor: 'pointer', fontFamily: 'Inter', fontSize: 13 }}
        >
          Test WhatsApp
        </button>

        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 16, background: '#FFF1F2', border: '1px solid #FCA5A5', borderRadius: 12, marginBottom: 24, fontFamily: 'Inter', fontSize: 14, color: '#BE123C' }}>
            <AlertCircle className="w-4 h-4" />{error}
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#1C1917' }} />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              <div style={{ background: '#FFFFFF', border: '1px solid #E0DDD9', borderRadius: 16, padding: 20 }}>
                <p style={{ fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 12, color: '#9C9894', textTransform: 'uppercase', letterSpacing: '0.8px', margin: '0 0 8px' }}>Total This Month</p>
                <p style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 32, color: '#1C1917', margin: 0 }}>{metrics.thisMonthCount}</p>
              </div>
              <div style={{ background: '#FFFFFF', border: '1px solid #E0DDD9', borderRadius: 16, padding: 20 }}>
                <p style={{ fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 12, color: '#9C9894', textTransform: 'uppercase', letterSpacing: '0.8px', margin: '0 0 8px' }}>Avg Resolution Time</p>
                <p style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 32, color: '#1C1917', margin: 0 }}>
                  {metrics.avgResolutionHours} <span style={{ fontSize: 18, color: '#9C9894' }}>hrs</span>
                </p>
              </div>
              <div style={{ background: '#FFFFFF', border: '1px solid #E0DDD9', borderRadius: 16, padding: 20 }}>
                <p style={{ fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 12, color: '#9C9894', textTransform: 'uppercase', letterSpacing: '0.8px', margin: '0 0 8px' }}>SLA Compliance</p>
                <p style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 32, color: metrics.slaComplianceRate >= 80 ? '#15803D' : '#D97706', margin: 0 }}>
                  {metrics.slaComplianceRate}%
                </p>
              </div>
            </div>

            {/* Charts */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24 }}>
              {/* Top Categories Bar Chart */}
              <div style={{ background: '#FFFFFF', border: '1px solid #E0DDD9', borderRadius: 16, padding: 24 }}>
                <h2 style={{ fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 15, color: '#1C1917', margin: '0 0 24px' }}>Top 5 Complaint Categories</h2>
                <div style={{ height: 288 }}>
                  {metrics.topCategories.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={metrics.topCategories} layout="vertical" margin={{ top: 0, right: 0, left: 20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E0DDD9" />
                        <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontFamily: 'Inter', fontSize: 12, fill: '#6B6560' }} />
                        <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontFamily: 'Inter', fontSize: 12, fill: '#1C1917' }} width={100} />
                        <RechartsTooltip 
                          cursor={{ fill: '#F5F3F0' }}
                          contentStyle={{ borderRadius: 8, border: '1px solid #E0DDD9', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', fontFamily: 'Inter', fontSize: 13 }}
                        />
                        <Bar dataKey="count" fill="#1C1917" radius={[0, 4, 4, 0]} barSize={32} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter', fontSize: 14, color: '#9C9894' }}>No data available</div>
                  )}
                </div>
              </div>

              {/* Status Pie Chart */}
              <div style={{ background: '#FFFFFF', border: '1px solid #E0DDD9', borderRadius: 16, padding: 24 }}>
                <h2 style={{ fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 15, color: '#1C1917', margin: '0 0 24px' }}>Complaints by Status</h2>
                <div style={{ height: 288 }}>
                  {metrics.statusData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={metrics.statusData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={90}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {metrics.statusData.map((entry) => (
                            <Cell key={entry.name} fill={STATUS_COLORS[entry.rawStatus] || '#E0DDD9'} stroke="none" />
                          ))}
                        </Pie>
                        <RechartsTooltip 
                          contentStyle={{ borderRadius: 8, border: '1px solid #E0DDD9', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', fontFamily: 'Inter', fontSize: 13 }}
                        />
                        <Legend iconType="circle" wrapperStyle={{ fontFamily: 'Inter', fontSize: 12, color: '#6B6560' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter', fontSize: 14, color: '#9C9894' }}>No data available</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
