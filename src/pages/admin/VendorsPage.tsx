import React, { useState, useEffect, useCallback } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { supabase } from '../../lib/supabase';
import type { Vendor } from '../../types/vendor';
import { VENDOR_SERVICE_TYPES, VENDOR_STATUS_COLORS } from '../../constants/vendorTypes';
import { Plus, EditPencil, Trash, CloudUpload } from 'iconoir-react';
import VendorImportModal from '../../components/admin/VendorImportModal';

const SOCIETY_ID = 'eafc59c7-4148-44ee-b66b-256a5338718b';

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filterExpiring, setFilterExpiring] = useState(false);
  const [modalState, setModalState] = useState<null | 'add' | { vendor: Vendor }>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);

  // Form state
  const [form, setForm] = useState<Partial<Vendor>>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const loadVendors = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .eq('society_id', SOCIETY_ID)
        .order('company_name', { ascending: true });
        
      if (error) throw error;
      setVendors(data as Vendor[] || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadVendors();
    setIsRefreshing(false);
  };

  useEffect(() => {
    loadVendors();
  }, [loadVendors]);

  // Derived metrics
  const now = new Date();
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  const isExpiringSoon = (endDateStr: string | null, status: string) => {
    if (status !== 'active' || !endDateStr) return false;
    const end = new Date(endDateStr);
    return end >= now && end <= thirtyDaysFromNow;
  };
  
  const isPast = (endDateStr: string | null) => {
    if (!endDateStr) return false;
    return new Date(endDateStr) < now;
  };

  const totalVendors = vendors.length;
  const activeVendors = vendors.filter(v => v.status === 'active').length;
  const expiringVendors = vendors.filter(v => isExpiringSoon(v.contract_end, v.status)).length;
  const monthlySpend = vendors.filter(v => v.status === 'active').reduce((sum, v) => sum + (v.monthly_cost || 0), 0);

  // Filtering
  const filteredVendors = vendors.filter(v => {
    if (filterExpiring && !isExpiringSoon(v.contract_end, v.status)) return false;
    if (search) {
      const q = search.toLowerCase();
      return v.company_name.toLowerCase().includes(q) || v.service_type.toLowerCase().includes(q);
    }
    return true;
  });

  // Actions
  const openAddModal = () => {
    setForm({
      company_name: '',
      service_type: VENDOR_SERVICE_TYPES[0],
      contact_person: '',
      phone: '',
      email: '',
      contract_start: '',
      contract_end: '',
      monthly_cost: 0,
      rating: null,
      status: 'active',
      notes: ''
    });
    setFormError('');
    setModalState('add');
  };

  const openEditModal = (vendor: Vendor) => {
    setForm({ ...vendor });
    setFormError('');
    setModalState({ vendor });
  };

  const closeModal = () => {
    setModalState(null);
    setForm({});
    setFormError('');
  };

  const saveVendor = async () => {
    if (!form.company_name?.trim() || !form.service_type) {
      setFormError('Company name and service type are required.');
      return;
    }
    
    setSaving(true);
    setFormError('');
    
    const payload = {
      society_id: SOCIETY_ID,
      company_name: form.company_name.trim(),
      service_type: form.service_type,
      contact_person: form.contact_person?.trim() || null,
      phone: form.phone?.trim() || null,
      email: form.email?.trim() || null,
      contract_start: form.contract_start || null,
      contract_end: form.contract_end || null,
      monthly_cost: Number(form.monthly_cost) || 0,
      rating: form.rating !== null && form.rating !== undefined ? Number(form.rating) : null,
      status: form.status || 'active',
      notes: form.notes?.trim() || null,
    };

    try {
      if (modalState === 'add') {
        const { error } = await supabase.from('vendors').insert([payload]);
        if (error) throw error;
      } else if (modalState !== null && typeof modalState === 'object') {
        const { error } = await supabase.from('vendors').update(payload).eq('id', modalState.vendor.id);
        if (error) throw error;
      }
      closeModal();
      loadVendors();
    } catch (e: any) {
      console.error(e);
      setFormError(e.message || 'Failed to save vendor');
    } finally {
      setSaving(false);
    }
  };

  const deleteVendor = async (id: string) => {
    try {
      const { error } = await supabase.from('vendors').delete().eq('id', id);
      if (error) throw error;
      setConfirmDeleteId(null);
      loadVendors();
    } catch (e: any) {
      console.error(e);
      alert('Failed to delete vendor: ' + e.message);
    }
  };

  const formatCost = (val: number | null | undefined) => `₹${(val || 0).toLocaleString('en-IN')}`;

  return (
    <AdminLayout onRefresh={handleRefresh} isRefreshing={isRefreshing}>
      
      {/* Expiry Banner */}
      {expiringVendors > 0 && (
        <div 
          onClick={() => setFilterExpiring(prev => !prev)}
          style={{
            background: '#FEF3C7',
            border: '1px solid #FCD34D',
            borderRadius: 16,
            padding: '12px 16px',
            marginBottom: 20,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            transition: 'background 0.2s'
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#FDE68A'}
          onMouseLeave={e => e.currentTarget.style.background = '#FEF3C7'}
        >
          <span style={{ fontSize: 18 }}>⚠️</span>
          <span style={{ fontFamily: 'Inter', fontWeight: 600, fontSize: 14, color: '#92400E' }}>
            {expiringVendors} vendor contract(s) expiring within 30 days — review and renew. {filterExpiring ? '(Click to clear filter)' : '(Click to view)'}
          </span>
        </div>
      )}

      {/* ── SECTION 1: Top Stats Row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total Vendors', value: totalVendors },
          { label: 'Active Vendors', value: activeVendors },
          { label: 'Expiring Soon', value: expiringVendors, accent: expiringVendors > 0 },
          { label: 'Monthly Spend', value: formatCost(monthlySpend) },
        ].map((stat, i) => (
          <div key={i} style={{ background: '#FFFFFF', border: '1px solid #E0DDD9', borderRadius: 16, padding: 20 }}>
            <p style={{ fontFamily: 'Inter', fontWeight: 500, fontSize: 12, color: '#9C9894', textTransform: 'uppercase', letterSpacing: '0.8px', margin: '0 0 8px' }}>
              {stat.label}
            </p>
            {loading ? (
              <div className="skeleton" style={{ height: 32, width: '60%', borderRadius: 8 }} />
            ) : (
              <p style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 32, color: stat.accent ? '#D97706' : '#1C1917', margin: 0, lineHeight: 1 }}>
                {stat.value}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* ── SECTION 2: Vendor Table ── */}
      <div style={{ background: '#FFFFFF', border: '1px solid #E0DDD9', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ padding: 20, borderBottom: '1px solid #E0DDD9' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 18, color: '#1C1917', margin: 0 }}>
              Vendors
            </h2>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <button
                onClick={() => setShowImportModal(true)}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #E0DDD9',
                  color: '#1C1917',
                  borderRadius: '10px',
                  padding: '10px 16px',
                  fontFamily: 'Space Grotesk',
                  fontWeight: '600',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  marginRight: '8px'
                }}
              >
                <CloudUpload width={16} height={16} strokeWidth={1.5} />
                Import from Document
              </button>
              <button 
                onClick={openAddModal}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: '#1C1917', color: '#FFFFFF',
                  border: 'none', borderRadius: 10,
                  padding: '8px 16px',
                  fontFamily: 'Inter', fontWeight: 500, fontSize: 13,
                  cursor: 'pointer'
                }}
              >
                <Plus width={18} height={18} strokeWidth={1.5} />
                Add Vendor
              </button>
            </div>
          </div>
          
          {/* Search */}
          <div style={{ maxWidth: 300 }}>
            <input 
              type="text"
              placeholder="Search company or service..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 10,
                border: '1px solid #E0DDD9',
                fontFamily: 'Inter', fontSize: 14,
                outline: 'none', boxSizing: 'border-box'
              }}
            />
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#F5F3F0' }}>
                <th style={{ padding: '12px 20px', fontFamily: 'Inter', fontWeight: 600, fontSize: 12, color: '#6B6560', textTransform: 'uppercase' }}>Company</th>
                <th style={{ padding: '12px 20px', fontFamily: 'Inter', fontWeight: 600, fontSize: 12, color: '#6B6560', textTransform: 'uppercase' }}>Service Type</th>
                <th style={{ padding: '12px 20px', fontFamily: 'Inter', fontWeight: 600, fontSize: 12, color: '#6B6560', textTransform: 'uppercase' }}>Contact</th>
                <th style={{ padding: '12px 20px', fontFamily: 'Inter', fontWeight: 600, fontSize: 12, color: '#6B6560', textTransform: 'uppercase' }}>Contract End</th>
                <th style={{ padding: '12px 20px', fontFamily: 'Inter', fontWeight: 600, fontSize: 12, color: '#6B6560', textTransform: 'uppercase' }}>Monthly Cost</th>
                <th style={{ padding: '12px 20px', fontFamily: 'Inter', fontWeight: 600, fontSize: 12, color: '#6B6560', textTransform: 'uppercase' }}>Rating</th>
                <th style={{ padding: '12px 20px', fontFamily: 'Inter', fontWeight: 600, fontSize: 12, color: '#6B6560', textTransform: 'uppercase' }}>Status</th>
                <th style={{ padding: '12px 20px', width: 100 }}></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: '#9C9894' }}>Loading...</td></tr>
              ) : filteredVendors.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: '#9C9894', fontFamily: 'Inter' }}>No vendors found.</td></tr>
              ) : (
                filteredVendors.map((vendor, idx) => {
                  const endPast = isPast(vendor.contract_end);
                  const endSoon = isExpiringSoon(vendor.contract_end, vendor.status);
                  const endColor = endPast ? '#dc2626' : endSoon ? '#D97706' : '#16a34a';
                  
                  return (
                    <tr key={vendor.id} style={{ borderBottom: '1px solid #E0DDD9', background: idx % 2 === 0 ? '#FFFFFF' : '#F5F3F0' }}>
                      <td style={{ padding: '16px 20px', fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 14, color: '#1C1917' }}>
                        {vendor.company_name}
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <span style={{ display: 'inline-block', padding: '4px 8px', background: '#E0DDD9', borderRadius: 6, fontFamily: 'Inter', fontWeight: 500, fontSize: 11, color: '#6B6560' }}>
                          {vendor.service_type}
                        </span>
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span style={{ fontFamily: 'Inter', fontWeight: 500, fontSize: 13, color: '#1C1917' }}>{vendor.contact_person || '—'}</span>
                          <span style={{ fontFamily: 'Inter', fontWeight: 400, fontSize: 12, color: '#6B6560' }}>{vendor.phone || '—'}</span>
                        </div>
                      </td>
                      <td style={{ padding: '16px 20px', fontFamily: 'Inter', fontWeight: 500, fontSize: 13, color: !vendor.contract_end ? '#9C9894' : endColor }}>
                        {vendor.contract_end ? new Date(vendor.contract_end).toLocaleDateString() : '—'}
                      </td>
                      <td style={{ padding: '16px 20px', fontFamily: 'Space Grotesk', fontWeight: 500, fontSize: 14, color: '#1C1917' }}>
                        {formatCost(vendor.monthly_cost)}
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        {vendor.rating === null ? (
                          <span style={{ color: '#E0DDD9', fontSize: 16 }}>☆☆☆☆☆</span>
                        ) : (
                          <span style={{ color: '#D97706', fontSize: 16 }}>
                            {'★'.repeat(vendor.rating)}{'☆'.repeat(5 - vendor.rating)}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        {(() => {
                          const conf = VENDOR_STATUS_COLORS[vendor.status as keyof typeof VENDOR_STATUS_COLORS];
                          return (
                            <span style={{
                              display: 'inline-block', padding: '4px 8px', borderRadius: 6,
                              background: conf.bg, color: conf.text, border: `1px solid ${conf.border}`,
                              fontFamily: 'Inter', fontWeight: 500, fontSize: 11
                            }}>
                              {conf.label}
                            </span>
                          );
                        })()}
                      </td>
                      <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                        {confirmDeleteId === vendor.id ? (
                          <button 
                            onClick={() => deleteVendor(vendor.id)}
                            style={{ background: '#DC2626', color: '#FFF', border: 'none', borderRadius: 6, padding: '6px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                          >
                            Are you sure? This cannot be undone
                          </button>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                            <button onClick={() => openEditModal(vendor)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#6B6560' }} title="Edit">
                              <EditPencil width={18} height={18} strokeWidth={1.5} />
                            </button>
                            <button onClick={() => setConfirmDeleteId(vendor.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#DC2626' }} title="Delete">
                              <Trash width={18} height={18} strokeWidth={1.5} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── SECTION 3: Add/Edit Modal ── */}
      {modalState && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 20
        }}>
          <div style={{
            background: '#FFFFFF', borderRadius: 16, width: '100%', maxWidth: 560,
            maxHeight: '90vh', display: 'flex', flexDirection: 'column'
          }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #E0DDD9' }}>
              <h3 style={{ margin: 0, fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 18, color: '#1C1917' }}>
                {modalState === 'add' ? 'Add Vendor' : 'Edit Vendor'}
              </h3>
            </div>
            
            <div style={{ padding: 24, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {formError && (
                <div style={{ padding: 12, background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#DC2626', borderRadius: 8, fontSize: 13, fontFamily: 'Inter' }}>
                  {formError}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6B6560', marginBottom: 6 }}>Company Name *</label>
                  <input type="text" value={form.company_name || ''} onChange={e => setForm({...form, company_name: e.target.value})} style={{ width: '100%', padding: '8px 12px', border: '1px solid #E0DDD9', borderRadius: 8, fontFamily: 'Inter', fontSize: 14, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6B6560', marginBottom: 6 }}>Service Type *</label>
                  <select value={form.service_type || ''} onChange={e => setForm({...form, service_type: e.target.value})} style={{ width: '100%', padding: '8px 12px', border: '1px solid #E0DDD9', borderRadius: 8, fontFamily: 'Inter', fontSize: 14, boxSizing: 'border-box' }}>
                    {VENDOR_SERVICE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6B6560', marginBottom: 6 }}>Contact Person</label>
                  <input type="text" value={form.contact_person || ''} onChange={e => setForm({...form, contact_person: e.target.value})} style={{ width: '100%', padding: '8px 12px', border: '1px solid #E0DDD9', borderRadius: 8, fontFamily: 'Inter', fontSize: 14, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6B6560', marginBottom: 6 }}>Phone</label>
                  <input type="text" value={form.phone || ''} onChange={e => setForm({...form, phone: e.target.value})} style={{ width: '100%', padding: '8px 12px', border: '1px solid #E0DDD9', borderRadius: 8, fontFamily: 'Inter', fontSize: 14, boxSizing: 'border-box' }} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6B6560', marginBottom: 6 }}>Email</label>
                  <input type="email" value={form.email || ''} onChange={e => setForm({...form, email: e.target.value})} style={{ width: '100%', padding: '8px 12px', border: '1px solid #E0DDD9', borderRadius: 8, fontFamily: 'Inter', fontSize: 14, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6B6560', marginBottom: 6 }}>Contract Start</label>
                  <input type="date" value={form.contract_start || ''} onChange={e => setForm({...form, contract_start: e.target.value})} style={{ width: '100%', padding: '8px 12px', border: '1px solid #E0DDD9', borderRadius: 8, fontFamily: 'Inter', fontSize: 14, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6B6560', marginBottom: 6 }}>Contract End</label>
                  <input type="date" value={form.contract_end || ''} onChange={e => setForm({...form, contract_end: e.target.value})} style={{ width: '100%', padding: '8px 12px', border: '1px solid #E0DDD9', borderRadius: 8, fontFamily: 'Inter', fontSize: 14, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6B6560', marginBottom: 6 }}>Monthly Cost (₹)</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 12, top: 9, color: '#9C9894', fontSize: 14 }}>₹</span>
                    <input type="number" min="0" value={form.monthly_cost || ''} onChange={e => setForm({...form, monthly_cost: Number(e.target.value)})} style={{ width: '100%', padding: '8px 12px 8px 24px', border: '1px solid #E0DDD9', borderRadius: 8, fontFamily: 'Inter', fontSize: 14, boxSizing: 'border-box' }} />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6B6560', marginBottom: 6 }}>Rating</label>
                  <div style={{ display: 'flex', gap: 4, height: 36, alignItems: 'center' }}>
                    {[1, 2, 3, 4, 5].map(star => (
                      <span 
                        key={star} 
                        onClick={() => setForm({...form, rating: star})}
                        style={{ cursor: 'pointer', fontSize: 24, color: (form.rating && form.rating >= star) ? '#D97706' : '#E0DDD9' }}
                      >
                        {(form.rating && form.rating >= star) ? '★' : '☆'}
                      </span>
                    ))}
                    {form.rating !== null && form.rating !== undefined && (
                      <span onClick={() => setForm({...form, rating: null})} style={{ marginLeft: 8, fontSize: 11, cursor: 'pointer', color: '#9C9894', textDecoration: 'underline' }}>Clear</span>
                    )}
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6B6560', marginBottom: 6 }}>Status</label>
                  <select value={form.status || 'active'} onChange={e => setForm({...form, status: e.target.value as any})} style={{ width: '100%', padding: '8px 12px', border: '1px solid #E0DDD9', borderRadius: 8, fontFamily: 'Inter', fontSize: 14, boxSizing: 'border-box' }}>
                    <option value="active">Active</option>
                    <option value="expired">Expired</option>
                    <option value="terminated">Terminated</option>
                  </select>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6B6560', marginBottom: 6 }}>Notes</label>
                  <textarea rows={3} value={form.notes || ''} onChange={e => setForm({...form, notes: e.target.value})} style={{ width: '100%', padding: '8px 12px', border: '1px solid #E0DDD9', borderRadius: 8, fontFamily: 'Inter', fontSize: 14, boxSizing: 'border-box', resize: 'vertical' }} />
                </div>
              </div>
            </div>

            <div style={{ padding: '16px 24px', borderTop: '1px solid #E0DDD9', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button 
                onClick={closeModal}
                disabled={saving}
                style={{
                  padding: '8px 16px', borderRadius: 10, border: '1px solid #E0DDD9',
                  background: '#FFFFFF', color: '#1C1917', fontFamily: 'Inter', fontWeight: 500, fontSize: 14,
                  cursor: saving ? 'not-allowed' : 'pointer'
                }}
              >
                Cancel
              </button>
              <button 
                onClick={saveVendor}
                disabled={saving}
                style={{
                  padding: '8px 16px', borderRadius: 10, border: 'none',
                  background: '#1C1917', color: '#FFFFFF', fontFamily: 'Inter', fontWeight: 500, fontSize: 14,
                  display: 'flex', alignItems: 'center', gap: 8,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.7 : 1
                }}
              >
                {saving && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{animation:'spin 1s linear infinite'}}>
                    <style>{'@keyframes spin{from{transform:rotate(0deg)} to{transform:rotate(360deg)}}'}</style>
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                  </svg>
                )}
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {showImportModal && (
        <VendorImportModal
          societyId={SOCIETY_ID}
          onClose={() => setShowImportModal(false)}
          onImportComplete={() => {
            alert('Vendors imported successfully!')
            loadVendors()
          }}
        />
      )}

    </AdminLayout>
  );
}
