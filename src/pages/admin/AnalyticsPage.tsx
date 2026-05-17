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
  open: '#3b82f6',        // blue-500
  triaged: '#a855f7',     // purple-500
  assigned: '#6366f1',    // indigo-500
  accepted: '#06b6d4',    // cyan-500
  in_progress: '#f59e0b', // amber-500
  on_hold: '#6b7280',     // gray-500
  resolved: '#10b981',    // emerald-500
  verified: '#14b8a6',    // teal-500
  closed: '#9ca3af',      // gray-400
  escalated: '#f43f5e',   // rose-500
  reopened: '#f97316',    // orange-500
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
      <div className="px-8 py-8 max-w-screen-xl mx-auto">
        <div className="mb-8">
          <h1 className="text-xl font-bold text-gray-900">Analytics</h1>
          <p className="text-sm text-gray-500 mt-0.5">Overview of complaint metrics and performance</p>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 mb-6">
            <AlertCircle className="w-4 h-4" />{error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Total This Month</p>
                <p className="text-3xl font-bold text-gray-900">{metrics.thisMonthCount}</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Avg Resolution Time</p>
                <p className="text-3xl font-bold text-blue-600">{metrics.avgResolutionHours} <span className="text-lg font-medium text-gray-500">hrs</span></p>
              </div>
              <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">SLA Compliance</p>
                <p className={`text-3xl font-bold ${metrics.slaComplianceRate >= 80 ? 'text-green-600' : 'text-amber-500'}`}>
                  {metrics.slaComplianceRate}%
                </p>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Categories Bar Chart */}
              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
                <h2 className="text-sm font-bold text-gray-800 mb-6">Top 5 Complaint Categories</h2>
                <div className="h-72">
                  {metrics.topCategories.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={metrics.topCategories} layout="vertical" margin={{ top: 0, right: 0, left: 20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                        <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                        <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#374151' }} width={100} />
                        <RechartsTooltip 
                          cursor={{ fill: '#f3f4f6' }}
                          contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={32} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-sm text-gray-400">No data available</div>
                  )}
                </div>
              </div>

              {/* Status Pie Chart */}
              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
                <h2 className="text-sm font-bold text-gray-800 mb-6">Complaints by Status</h2>
                <div className="h-72">
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
                            <Cell key={entry.name} fill={STATUS_COLORS[entry.rawStatus] || '#9ca3af'} stroke="none" />
                          ))}
                        </Pie>
                        <RechartsTooltip 
                          contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-sm text-gray-400">No data available</div>
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
