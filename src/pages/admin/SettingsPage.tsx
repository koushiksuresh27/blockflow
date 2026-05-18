import { useState, useEffect, useCallback } from 'react';
import { Loader2, AlertCircle, Save } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import AdminLayout from '../../components/AdminLayout';
import { useToast } from '../../components/Toast';

interface SlaDefaults {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

interface SocietySettings {
  id: string;
  name: string;
  address: string;
  city: string;
  sla_defaults: SlaDefaults;
}

export default function SettingsPage() {
  const toast = useToast();
  const [settings, setSettings] = useState<SocietySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase.from('users').select('society_id').eq('id', user.id).single();
      if (!profile?.society_id) throw new Error('Society not found');

      const { data, error: e } = await supabase
        .from('societies')
        .select('id, name, address, city, sla_defaults')
        .eq('id', profile.society_id)
        .single();

      if (e) throw new Error(e.message);
      
      // Provide fallback defaults if null
      const defaults = data.sla_defaults || { critical: 4, high: 24, medium: 72, low: 168 };

      setSettings({
        id: data.id,
        name: data.name,
        address: data.address,
        city: data.city,
        sla_defaults: defaults as SlaDefaults,
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error loading settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const { error: e } = await supabase
        .from('societies')
        .update({
          name: settings.name,
          address: settings.address,
          city: settings.city,
          sla_defaults: settings.sla_defaults,
        })
        .eq('id', settings.id);

      if (e) throw new Error(e.message);
      toast('success', 'Settings saved', 'Your society settings have been updated.');
    } catch (e: unknown) {
      toast('error', 'Failed to save', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  const updateSla = (priority: keyof SlaDefaults, val: string) => {
    const num = parseInt(val, 10);
    if (isNaN(num) || num < 1) return;
    setSettings(s => s ? { ...s, sla_defaults: { ...s.sla_defaults, [priority]: num } } : null);
  };

  return (
    <AdminLayout>
      <div className="px-8 py-8 max-w-screen-md mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Settings</h1>
            <p className="text-sm text-gray-500 mt-0.5">Manage your society preferences</p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving || !settings}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 rounded-lg transition"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 mb-6">
            <AlertCircle className="w-4 h-4" />{error}
          </div>
        )}

        {loading || !settings ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Society Profile */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                <h2 className="text-sm font-bold text-gray-800">Society Profile</h2>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Society Name</label>
                  <input
                    type="text"
                    value={settings.name}
                    onChange={e => setSettings({ ...settings, name: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm border border-gray-300 rounded-lg bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                  <textarea
                    rows={2}
                    value={settings.address}
                    onChange={e => setSettings({ ...settings, address: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm border border-gray-300 rounded-lg bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                  <input
                    type="text"
                    value={settings.city}
                    onChange={e => setSettings({ ...settings, city: e.target.value })}
                    className="w-full md:w-1/2 px-3.5 py-2 text-sm border border-gray-300 rounded-lg bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                  />
                </div>
              </div>
            </div>

            {/* SLA Defaults */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                <h2 className="text-sm font-bold text-gray-800">SLA Defaults (Hours)</h2>
                <p className="text-xs text-gray-500 mt-0.5">Set the default resolution deadline per priority level.</p>
              </div>
              <div className="p-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { key: 'critical', label: 'Critical', color: 'border-red-200 bg-red-50 text-red-700' },
                  { key: 'high', label: 'High', color: 'border-orange-200 bg-orange-50 text-orange-700' },
                  { key: 'medium', label: 'Medium', color: 'border-yellow-200 bg-yellow-50 text-yellow-700' },
                  { key: 'low', label: 'Low', color: 'border-gray-200 bg-gray-50 text-gray-700' },
                ].map((item) => (
                  <div key={item.key}>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">
                      {item.label}
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        value={settings.sla_defaults[item.key as keyof SlaDefaults]}
                        onChange={e => updateSla(item.key as keyof SlaDefaults, e.target.value)}
                        className={`w-full px-3.5 py-2 text-sm font-medium border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${item.color}`}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium opacity-60">
                        hrs
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
