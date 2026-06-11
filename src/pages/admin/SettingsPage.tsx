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
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
          <div>
            <h1 style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 24, color: '#1C1917', margin: '0 0 4px' }}>Settings</h1>
            <p style={{ fontFamily: 'Inter', fontSize: 15, color: '#6B6560', margin: 0 }}>Manage your society preferences</p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving || !settings}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '9px 20px',
              background: saving || !settings ? '#2C2925' : '#D97706',
              color: '#FFFFFF', borderRadius: 10, border: 'none',
              fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 14,
              cursor: saving || !settings ? 'not-allowed' : 'pointer'
            }}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </button>
        </div>

        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 16, background: '#FFF1F2', border: '1px solid #FCA5A5', borderRadius: 12, marginBottom: 24, fontFamily: 'Inter', fontSize: 14, color: '#BE123C' }}>
            <AlertCircle className="w-4 h-4" />{error}
          </div>
        )}

        {loading || !settings ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#1C1917' }} />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Society Profile */}
            <div style={{ background: '#FFFFFF', border: '1px solid #E0DDD9', borderRadius: 16, overflow: 'hidden' }}>
              <div style={{ padding: '16px 24px', borderBottom: '1px solid #E0DDD9', background: '#F5F3F0' }}>
                <h2 style={{ fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 15, color: '#1C1917', margin: 0 }}>Society Profile</h2>
              </div>
              <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ fontFamily: 'Inter', fontWeight: 500, fontSize: 13, color: '#6B6560', display: 'block', marginBottom: 6 }}>Society Name</label>
                  <input
                    type="text"
                    value={settings.name}
                    onChange={e => setSettings({ ...settings, name: e.target.value })}
                    style={{ width: '100%', padding: '9px 14px', fontFamily: 'Inter', fontSize: 14, border: '1px solid #E0DDD9', borderRadius: 8, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontFamily: 'Inter', fontWeight: 500, fontSize: 13, color: '#6B6560', display: 'block', marginBottom: 6 }}>Address</label>
                  <textarea
                    rows={2}
                    value={settings.address}
                    onChange={e => setSettings({ ...settings, address: e.target.value })}
                    style={{ width: '100%', padding: '9px 14px', fontFamily: 'Inter', fontSize: 14, border: '1px solid #E0DDD9', borderRadius: 8, outline: 'none', resize: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontFamily: 'Inter', fontWeight: 500, fontSize: 13, color: '#6B6560', display: 'block', marginBottom: 6 }}>City</label>
                  <input
                    type="text"
                    value={settings.city}
                    onChange={e => setSettings({ ...settings, city: e.target.value })}
                    style={{ width: '100%', maxWidth: 400, padding: '9px 14px', fontFamily: 'Inter', fontSize: 14, border: '1px solid #E0DDD9', borderRadius: 8, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
            </div>

            {/* SLA Defaults */}
            <div style={{ background: '#FFFFFF', border: '1px solid #E0DDD9', borderRadius: 16, overflow: 'hidden' }}>
              <div style={{ padding: '16px 24px', borderBottom: '1px solid #E0DDD9', background: '#F5F3F0' }}>
                <h2 style={{ fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 15, color: '#1C1917', margin: 0 }}>SLA Defaults (Hours)</h2>
                <p style={{ fontFamily: 'Inter', fontSize: 13, color: '#6B6560', margin: '2px 0 0' }}>Set the default resolution deadline per priority level.</p>
              </div>
              <div style={{ padding: 24, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                {[
                  { key: 'critical', label: 'Critical', bg: '#FFF1F2', color: '#BE123C', border: '#FCA5A5' },
                  { key: 'high', label: 'High', bg: '#FFF7ED', color: '#C2410C', border: '#FDBA74' },
                  { key: 'medium', label: 'Medium', bg: '#FEFCE8', color: '#A16207', border: '#FDE047' },
                  { key: 'low', label: 'Low', bg: '#F5F3F0', color: '#6B6560', border: '#E0DDD9' },
                ].map((item) => (
                  <div key={item.key}>
                    <label style={{ fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 11, color: '#6B6560', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>
                      {item.label}
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="number"
                        min="1"
                        value={settings.sla_defaults[item.key as keyof SlaDefaults]}
                        onChange={e => updateSla(item.key as keyof SlaDefaults, e.target.value)}
                        style={{
                          width: '100%', padding: '9px 14px', fontFamily: 'Inter', fontSize: 14, fontWeight: 500,
                          background: item.bg, color: item.color, border: `1px solid ${item.border}`, borderRadius: 8, outline: 'none', boxSizing: 'border-box'
                        }}
                      />
                      <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontFamily: 'Inter', fontSize: 12, fontWeight: 500, color: item.color, opacity: 0.6 }}>
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
