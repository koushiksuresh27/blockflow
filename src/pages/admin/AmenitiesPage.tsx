import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import AdminLayout from '../../components/AdminLayout';
import { useToast } from '../../components/Toast';
import { Building, Gym, Swimming, Trophy, Leaf, Calendar, Trash, X } from 'iconoir-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Amenity {
  id: string;
  name: string;
  type: string;
  description: string | null;
  capacity: number | null;
  hourly_rate: number;
  available_start_time: string;
  available_end_time: string;
  slot_duration_minutes: number;
  advance_booking_days: number;
  status: 'active' | 'inactive';
  booking_type: 'slot' | 'full_day';
}

interface Booking {
  id: string;
  amenity_id: string;
  resident_id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: 'confirmed' | 'cancelled' | 'completed' | 'no_show';
  total_cost: number;
  number_of_guests: number;
  amenities?: { name: string; type: string };
  users?: { name: string };
}

const TABS = [
  { key: 'amenities', label: 'Amenities' },
  { key: 'bookings', label: 'Bookings' }
] as const;

type TabKey = typeof TABS[number]['key'];
type BookingFilter = 'All' | 'Upcoming' | 'Today' | 'Completed' | 'No-show';
const BOOKING_FILTERS: BookingFilter[] = ['All', 'Upcoming', 'Today', 'Completed', 'No-show'];

const AMENITY_TYPES = [
  'Clubhouse', 'Party Hall', 'Gym', 'Pool',
  'Tennis Court', 'Badminton Court', 'Garden', 'Other'
];


const DEFAULT_FORM = {
  name: '',
  type: 'Clubhouse',
  description: '',
  capacity: '' as number | '',
  hourly_rate: 0 as number | '',
  available_start_time: '06:00',
  available_end_time: '22:00',
  slot_duration_minutes: 60,
  advance_booking_days: 7,
  status: 'active' as 'active' | 'inactive',
  booking_type: 'slot' as 'slot' | 'full_day'
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getAmenityIcon(type: string) {
  const t = type.toLowerCase().replace(' ', '_');
  if (['clubhouse', 'party_hall'].includes(t)) return Building;
  if (t === 'gym') return Gym;
  if (t === 'pool') return Swimming;
  if (['tennis_court', 'badminton_court'].includes(t)) return Trophy;
  if (t === 'garden') return Leaf;
  return Calendar;
}

function formatTime(timeStr: string) {
  // Converts "14:00:00" or "14:00" to "2:00 PM"
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':');
  const d = new Date();
  d.setHours(parseInt(h, 10));
  d.setMinutes(parseInt(m, 10));
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function formatDate(dateStr: string) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AmenitiesPage() {
  const toast = useToast();
  const [tab, setTab] = useState<TabKey>('amenities');
  const [adminSocietyId, setAdminSocietyId] = useState<string | null>(null);
  
  // Amenities State
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [loadingAmenities, setLoadingAmenities] = useState(true);
  
  // Bookings State
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [bookingFilter, setBookingFilter] = useState<BookingFilter>('All');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAmenity, setEditingAmenity] = useState<Amenity | null>(null);
  const [formData, setFormData] = useState(DEFAULT_FORM);

  // Delete Confirm State
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmCancelBookingId, setConfirmCancelBookingId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase.from('users').select('society_id').eq('id', user.id).single()
          .then(({ data }) => {
            if (data?.society_id) {
              setAdminSocietyId(data.society_id);
            }
          });
      }
    });
  }, []);

  const fetchAmenities = useCallback(async () => {
    if (!adminSocietyId) return;
    setLoadingAmenities(true);
    const { data, error } = await supabase
      .from('amenities')
      .select('*')
      .eq('society_id', adminSocietyId)
      .order('created_at', { ascending: false });
      
    if (error) {
      toast('error', 'Error fetching amenities', error.message);
    } else {
      setAmenities(data || []);
    }
    setLoadingAmenities(false);
  }, [adminSocietyId, toast]);

  const fetchBookings = useCallback(async () => {
    if (!adminSocietyId) return;
    setLoadingBookings(true);
    const { data, error } = await supabase
      .from('amenity_bookings')
      .select(`
        *,
        amenities(name, type),
        users:resident_id(name)
      `)
      .eq('society_id', adminSocietyId)
      .order('booking_date', { ascending: false });

    if (error) {
      toast('error', 'Error fetching bookings', error.message);
    } else {
      setBookings(data || []);
    }
    setLoadingBookings(false);
  }, [adminSocietyId, toast]);

  useEffect(() => {
    if (adminSocietyId) {
      if (tab === 'amenities') {
        fetchAmenities();
      } else {
        fetchBookings();
      }
    }
  }, [adminSocietyId, tab, fetchAmenities, fetchBookings]);

  // ─── Handlers ───────────────────────────────────────────────────────────────

  const handleOpenModal = (amenity?: Amenity) => {
    if (amenity) {
      setEditingAmenity(amenity);
      setFormData({
        name: amenity.name,
        type: amenity.type,
        description: amenity.description || '',
        capacity: amenity.capacity || 0,
        hourly_rate: amenity.hourly_rate,
        available_start_time: amenity.available_start_time.slice(0, 5),
        available_end_time: amenity.available_end_time.slice(0, 5),
        slot_duration_minutes: amenity.slot_duration_minutes,
        advance_booking_days: amenity.advance_booking_days,
        status: amenity.status,
        booking_type: amenity.booking_type || 'slot'
      });
    } else {
      setEditingAmenity(null);
      setFormData(DEFAULT_FORM);
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingAmenity(null);
    setFormData(DEFAULT_FORM);
  };

  const handleSaveAmenity = async () => {
    if (!formData.name.trim()) {
      toast('error', 'Validation Error', 'Name is required');
      return;
    }
    
    // Convert times back to time format if necessary, though HH:mm is usually fine for Supabase time columns
    const payload = {
      ...formData,
      society_id: adminSocietyId,
      available_start_time: formData.available_start_time.length === 5 ? `${formData.available_start_time}:00` : formData.available_start_time,
      available_end_time: formData.available_end_time.length === 5 ? `${formData.available_end_time}:00` : formData.available_end_time,
    };

    if (editingAmenity) {
      const { error } = await supabase
        .from('amenities')
        .update(payload)
        .eq('id', editingAmenity.id);
      
      if (error) {
        toast('error', 'Error updating amenity', error.message);
      } else {
        toast('success', 'Success', 'Amenity saved');
        handleCloseModal();
        fetchAmenities();
      }
    } else {
      const { error } = await supabase
        .from('amenities')
        .insert(payload);
        
      if (error) {
        toast('error', 'Error creating amenity', error.message);
      } else {
        toast('success', 'Success', 'Amenity saved');
        handleCloseModal();
        fetchAmenities();
      }
    }
  };

  const handleDeleteAmenity = async (id: string) => {
    const { error } = await supabase
      .from('amenities')
      .delete()
      .eq('id', id);
      
    if (error) {
      toast('error', 'Error deleting amenity', error.message);
    } else {
      toast('success', 'Deleted', 'Amenity removed');
      fetchAmenities();
    }
    setConfirmDeleteId(null);
  };

  const handleUpdateBookingStatus = async (id: string, status: string) => {
    const { error } = await supabase
      .from('amenity_bookings')
      .update({ status })
      .eq('id', id);
      
    if (error) {
      toast('error', 'Error updating status', error.message);
    } else {
      toast('success', 'Success', `Booking marked as ${status}`);
      fetchBookings();
    }
    setConfirmCancelBookingId(null);
  };

  // ─── Filter Bookings ────────────────────────────────────────────────────────
  
  const filteredBookings = bookings.filter(b => {
    if (bookingFilter === 'All') return true;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const bookingDate = new Date(b.booking_date);
    bookingDate.setHours(0, 0, 0, 0);
    
    if (bookingFilter === 'Today') {
      return bookingDate.getTime() === today.getTime();
    }
    if (bookingFilter === 'Upcoming') {
      return bookingDate.getTime() > today.getTime() && b.status === 'confirmed';
    }
    if (bookingFilter === 'Completed') return b.status === 'completed';
    if (bookingFilter === 'No-show') return b.status === 'no_show';
    return true;
  });

  return (
    <AdminLayout>
      <style>{`
        input[type="number"]::-webkit-inner-spin-button,
        input[type="number"]::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
      `}</style>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        
        {/* Header Row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          {/* Tab Bar */}
          <div style={{ display: 'flex', gap: 4, background: '#FFFFFF', border: '1px solid #E0DDD9', borderRadius: 10, padding: 4, width: 'fit-content' }}>
            {TABS.map(({ key, label }) => {
              const isActive = tab === key;
              return (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  style={{
                    padding: '7px 16px',
                    borderRadius: 8,
                    fontFamily: 'Space Grotesk', fontWeight: 500, fontSize: 13,
                    color: isActive ? '#FFFFFF' : '#6B6560',
                    border: 'none',
                    background: isActive ? '#1C1917' : 'transparent',
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6,
                    transition: 'all 0.15s',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Action Button */}
          {tab === 'amenities' && (
            <button
              onClick={() => handleOpenModal()}
              style={{
                background: '#D97706', color: '#FFFFFF', border: 'none',
                borderRadius: 10, padding: '10px 20px',
                fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 14,
                cursor: 'pointer'
              }}
            >
              Add Amenity
            </button>
          )}
        </div>

        {/* ─── TAB 1: AMENITIES ────────────────────────────────────────────── */}
        {tab === 'amenities' && (
          loadingAmenities ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} style={{ background: '#FFFFFF', border: '1px solid #E0DDD9', borderRadius: 16, height: 250 }} />
              ))}
            </div>
          ) : amenities.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>
              <div style={{ width: 64, height: 64, background: '#F5F3F0', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <Building width={40} height={40} color="#E0DDD9" />
              </div>
              <h3 style={{ fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 18, color: '#1C1917', margin: '0 0 8px' }}>No amenities yet</h3>
              <p style={{ fontFamily: 'Inter', fontSize: 14, color: '#9C9894', margin: 0 }}>
                Add your first amenity to let residents start booking
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              {amenities.map(amenity => {
                const Icon = getAmenityIcon(amenity.type);
                return (
                  <div key={amenity.id} style={{ background: '#FFFFFF', border: '1px solid #E0DDD9', borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column' }}>
                    
                    {/* Top Row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                      <div style={{ width: 40, height: 40, background: '#F5F3F0', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1C1917' }}>
                        <Icon width={20} height={20} strokeWidth={1.5} />
                      </div>
                      <span style={{
                        background: amenity.status === 'active' ? '#F0FDF4' : '#F5F3F0',
                        color: amenity.status === 'active' ? '#15803D' : '#9C9894',
                        fontFamily: 'Inter', fontWeight: 500, fontSize: 12,
                        padding: '3px 10px', borderRadius: 6
                      }}>
                        {amenity.status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    {/* Title */}
                    <h3 style={{ fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 16, color: '#1C1917', margin: '0 0 8px' }}>
                      {amenity.name}
                    </h3>
                    <div>
                      <span style={{ background: '#F5F3F0', color: '#6B6560', fontFamily: 'Inter', fontWeight: 500, fontSize: 11, borderRadius: 6, padding: '2px 8px', display: 'inline-block' }}>
                        {amenity.type}
                      </span>
                    </div>

                    <div style={{ height: 1, background: '#E0DDD9', margin: '16px 0' }} />

                    {/* Info Rows */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontFamily: 'Inter', fontSize: 12, color: '#9C9894' }}>Capacity</span>
                        <span style={{ fontFamily: 'Space Grotesk', fontWeight: 500, fontSize: 13, color: '#1C1917' }}>{amenity.capacity || '—'} people</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontFamily: 'Inter', fontSize: 12, color: '#9C9894' }}>Rate</span>
                        <span style={{ fontFamily: 'Space Grotesk', fontWeight: 500, fontSize: 13, color: '#1C1917' }}>{amenity.hourly_rate > 0 ? `₹${amenity.hourly_rate}/hr` : 'Free'}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontFamily: 'Inter', fontSize: 12, color: '#9C9894' }}>Hours</span>
                        <span style={{ fontFamily: 'Space Grotesk', fontWeight: 500, fontSize: 13, color: '#1C1917' }}>{amenity.booking_type === 'full_day' ? 'All Day' : `${formatTime(amenity.available_start_time)} - ${formatTime(amenity.available_end_time)}`}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontFamily: 'Inter', fontSize: 12, color: '#9C9894' }}>Slot duration</span>
                        <span style={{ fontFamily: 'Space Grotesk', fontWeight: 500, fontSize: 13, color: '#1C1917' }}>
                          {amenity.booking_type === 'full_day' ? 'Full day booking' : (
                            amenity.slot_duration_minutes < 60 ? `${amenity.slot_duration_minutes} min` : 
                            amenity.slot_duration_minutes === 1440 ? 'Full day' : 
                            `${amenity.slot_duration_minutes / 60} hrs`
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Bottom Row */}
                    <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                      {confirmDeleteId === amenity.id ? (
                        <div style={{ display: 'flex', flex: 1, gap: 8, alignItems: 'center', background: '#FEF2F2', padding: '4px 8px', borderRadius: 8, border: '1px solid #FCA5A5' }}>
                          <span style={{ fontFamily: 'Inter', fontSize: 12, color: '#BE123C', flex: 1, textAlign: 'center' }}>Delete this amenity?</span>
                          <button onClick={() => handleDeleteAmenity(amenity.id)} style={{ background: '#DC2626', color: '#FFF', border: 'none', borderRadius: 6, padding: '4px 8px', fontSize: 11, cursor: 'pointer' }}>Yes</button>
                          <button onClick={() => setConfirmDeleteId(null)} style={{ background: 'transparent', color: '#6B6560', border: 'none', fontSize: 11, cursor: 'pointer' }}>Cancel</button>
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => handleOpenModal(amenity)}
                            style={{ flex: 1, background: '#F5F3F0', color: '#1C1917', border: 'none', borderRadius: 8, fontFamily: 'Space Grotesk', fontWeight: 500, fontSize: 13, padding: '8px 14px', cursor: 'pointer' }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(amenity.id)}
                            style={{ width: 36, height: 36, border: '1px solid #E0DDD9', borderRadius: 8, color: '#9C9894', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.15s' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#DC2626'; (e.currentTarget as HTMLButtonElement).style.color = '#DC2626'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#E0DDD9'; (e.currentTarget as HTMLButtonElement).style.color = '#9C9894'; }}
                          >
                            <Trash width={16} height={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* ─── TAB 2: BOOKINGS ─────────────────────────────────────────────── */}
        {tab === 'bookings' && (
          <>
            {/* Filter Chips */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              {BOOKING_FILTERS.map(filter => (
                <button
                  key={filter}
                  onClick={() => setBookingFilter(filter)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 20,
                    fontFamily: 'Inter', fontWeight: 500, fontSize: 13,
                    border: bookingFilter === filter ? '1px solid #1C1917' : '1px solid #E0DDD9',
                    background: bookingFilter === filter ? '#1C1917' : '#FFFFFF',
                    color: bookingFilter === filter ? '#FFFFFF' : '#6B6560',
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                >
                  {filter}
                </button>
              ))}
            </div>

            {loadingBookings ? (
               <div style={{ background: '#FFFFFF', border: '1px solid #E0DDD9', borderRadius: 16, height: 300 }} />
            ) : filteredBookings.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 0' }}>
                <p style={{ fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 16, color: '#9C9894', margin: 0 }}>
                  No bookings found
                </p>
              </div>
            ) : (
              <div style={{ background: '#FFFFFF', border: '1px solid #E0DDD9', borderRadius: 16, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#F5F3F0', borderBottom: '1px solid #E0DDD9' }}>
                        {['Amenity', 'Resident', 'Date', 'Time', 'Guests', 'Cost', 'Status', 'Actions'].map(h => (
                          <th key={h} style={{ padding: '12px 20px', textAlign: 'left', fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 12, color: '#9C9894', textTransform: 'uppercase', letterSpacing: '0.8px', whiteSpace: 'nowrap' }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredBookings.map((b, i) => {
                        const bookingDate = new Date(b.booking_date);
                        bookingDate.setHours(0, 0, 0, 0);
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const isPastOrToday = bookingDate.getTime() <= today.getTime();

                        return (
                          <tr key={b.id} style={{ borderBottom: i < filteredBookings.length - 1 ? '1px solid #F0EDE9' : 'none', fontFamily: 'Inter', fontSize: 14 }}>
                            <td style={{ padding: '14px 20px', color: '#1C1917' }}>{b.amenities?.name || '—'}</td>
                            <td style={{ padding: '14px 20px', color: '#1C1917' }}>{b.users?.name || '—'}</td>
                            <td style={{ padding: '14px 20px', color: '#6B6560' }}>{formatDate(b.booking_date)}</td>
                            <td style={{ padding: '14px 20px', color: '#6B6560' }}>{formatTime(b.start_time)} - {formatTime(b.end_time)}</td>
                            <td style={{ padding: '14px 20px', color: '#6B6560' }}>{b.number_of_guests}</td>
                            <td style={{ padding: '14px 20px', color: '#1C1917' }}>{b.total_cost > 0 ? `₹${b.total_cost}` : 'Free'}</td>
                            <td style={{ padding: '14px 20px' }}>
                              <span style={{
                                fontFamily: 'Inter', fontWeight: 500, fontSize: 12,
                                background: b.status === 'confirmed' ? '#EFF6FF' : b.status === 'completed' ? '#F0FDF4' : b.status === 'no_show' ? '#FFF1F2' : '#F5F3F0',
                                color: b.status === 'confirmed' ? '#1D4ED8' : b.status === 'completed' ? '#15803D' : b.status === 'no_show' ? '#BE123C' : '#9C9894',
                                borderRadius: 6, padding: '3px 10px',
                                textTransform: 'capitalize'
                              }}>
                                {b.status.replace('_', '-')}
                              </span>
                            </td>
                            <td style={{ padding: '14px 20px' }}>
                              {b.status === 'confirmed' ? (
                                isPastOrToday ? (
                                  <div style={{ display: 'flex', gap: 6 }}>
                                    <button onClick={() => handleUpdateBookingStatus(b.id, 'completed')} style={{ background: '#F0FDF4', color: '#15803D', border: 'none', borderRadius: 6, padding: '4px 8px', fontFamily: 'Inter', fontWeight: 500, fontSize: 11, cursor: 'pointer' }}>✓ Completed</button>
                                    <button onClick={() => handleUpdateBookingStatus(b.id, 'no_show')} style={{ background: '#FFF1F2', color: '#BE123C', border: 'none', borderRadius: 6, padding: '4px 8px', fontFamily: 'Inter', fontWeight: 500, fontSize: 11, cursor: 'pointer' }}>✗ No-show</button>
                                  </div>
                                ) : (
                                  confirmCancelBookingId === b.id ? (
                                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                      <button onClick={() => handleUpdateBookingStatus(b.id, 'cancelled')} style={{ background: '#DC2626', color: '#FFF', border: 'none', borderRadius: 6, padding: '4px 8px', fontFamily: 'Inter', fontWeight: 500, fontSize: 11, cursor: 'pointer' }}>Confirm</button>
                                      <button onClick={() => setConfirmCancelBookingId(null)} style={{ background: '#F5F3F0', color: '#6B6560', border: 'none', borderRadius: 6, padding: '4px 8px', fontFamily: 'Inter', fontWeight: 500, fontSize: 11, cursor: 'pointer' }}>Back</button>
                                    </div>
                                  ) : (
                                    <button onClick={() => setConfirmCancelBookingId(b.id)} style={{ background: 'transparent', color: '#9C9894', border: '1px solid #E0DDD9', borderRadius: 6, padding: '4px 10px', fontFamily: 'Inter', fontWeight: 500, fontSize: 11, cursor: 'pointer' }}>Cancel</button>
                                  )
                                )
                              ) : (
                                <span style={{ color: '#9C9894' }}>—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

      </div>

      {/* ─── ADD / EDIT MODAL ──────────────────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div style={{ background: '#FFFFFF', borderRadius: 20, width: '100%', maxWidth: 480, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #E0DDD9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 18, color: '#1C1917', margin: 0 }}>
                {editingAmenity ? 'Edit Amenity' : 'Add Amenity'}
              </h3>
              <button onClick={handleCloseModal} style={{ background: 'transparent', border: 'none', color: '#9C9894', cursor: 'pointer' }}>
                <X width={20} height={20} />
              </button>
            </div>
            
            {/* Modal Body */}
            <div style={{ padding: '24px', maxHeight: '70vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
              
              <div>
                <label style={{ display: 'block', fontFamily: 'Space Grotesk', fontWeight: 500, fontSize: 13, color: '#6B6560', marginBottom: 6 }}>Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  style={{ width: '100%', background: '#F5F3F0', border: '1px solid #E0DDD9', borderRadius: 10, padding: '10px 14px', fontFamily: 'Inter', fontSize: 14, boxSizing: 'border-box' }}
                  placeholder="e.g. Main Clubhouse"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontFamily: 'Space Grotesk', fontWeight: 500, fontSize: 13, color: '#6B6560', marginBottom: 6 }}>Type</label>
                <select
                  value={formData.type}
                  onChange={e => setFormData({ ...formData, type: e.target.value })}
                  style={{ width: '100%', background: '#F5F3F0', border: '1px solid #E0DDD9', borderRadius: 10, padding: '10px 14px', fontFamily: 'Inter', fontSize: 14, boxSizing: 'border-box' }}
                >
                  {AMENITY_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontFamily: 'Space Grotesk', fontWeight: 500, fontSize: 13, color: '#6B6560', marginBottom: 6 }}>Description (Optional)</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  style={{ width: '100%', background: '#F5F3F0', border: '1px solid #E0DDD9', borderRadius: 10, padding: '10px 14px', fontFamily: 'Inter', fontSize: 14, minHeight: 80, resize: 'vertical', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontFamily: 'Space Grotesk', fontWeight: 500, fontSize: 13, color: '#6B6560', marginBottom: 6 }}>Capacity</label>
                  <input
                    type="number"
                    value={formData.capacity}
                    onChange={e => setFormData({ ...formData, capacity: e.target.value === '' ? '' : Number(e.target.value) })}
                    style={{ width: '100%', background: '#F5F3F0', border: '1px solid #E0DDD9', borderRadius: 10, padding: '10px 14px', fontFamily: 'Inter', fontSize: 14, boxSizing: 'border-box', MozAppearance: 'textfield' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontFamily: 'Space Grotesk', fontWeight: 500, fontSize: 13, color: '#6B6560', marginBottom: 6 }}>Hourly Rate ₹</label>
                  <input
                    type="number"
                    value={formData.hourly_rate}
                    onChange={e => setFormData({ ...formData, hourly_rate: e.target.value === '' ? '' : Number(e.target.value) })}
                    style={{ width: '100%', background: '#F5F3F0', border: '1px solid #E0DDD9', borderRadius: 10, padding: '10px 14px', fontFamily: 'Inter', fontSize: 14, boxSizing: 'border-box', MozAppearance: 'textfield' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontFamily: 'Space Grotesk', fontWeight: 500, fontSize: 13, color: '#6B6560', marginBottom: 6 }}>Booking Type</label>
                <select
                  value={formData.booking_type}
                  onChange={e => setFormData({ ...formData, booking_type: e.target.value as 'slot' | 'full_day' })}
                  style={{ width: '100%', background: '#F5F3F0', border: '1px solid #E0DDD9', borderRadius: 10, padding: '10px 14px', fontFamily: 'Inter', fontSize: 14, boxSizing: 'border-box' }}
                >
                  <option value="slot">Time slot booking</option>
                  <option value="full_day">Full day booking</option>
                </select>
              </div>

              {formData.booking_type === 'slot' ? (
                <>
                  <div style={{ display: 'flex', gap: 16 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontFamily: 'Space Grotesk', fontWeight: 500, fontSize: 13, color: '#6B6560', marginBottom: 6 }}>Available Start</label>
                      <input
                        type="time"
                        value={formData.available_start_time}
                        onChange={e => setFormData({ ...formData, available_start_time: e.target.value })}
                        style={{ width: '100%', background: '#F5F3F0', border: '1px solid #E0DDD9', borderRadius: 10, padding: '10px 14px', fontFamily: 'Inter', fontSize: 14, boxSizing: 'border-box' }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontFamily: 'Space Grotesk', fontWeight: 500, fontSize: 13, color: '#6B6560', marginBottom: 6 }}>Available End</label>
                      <input
                        type="time"
                        value={formData.available_end_time}
                        onChange={e => setFormData({ ...formData, available_end_time: e.target.value })}
                        style={{ width: '100%', background: '#F5F3F0', border: '1px solid #E0DDD9', borderRadius: 10, padding: '10px 14px', fontFamily: 'Inter', fontSize: 14, boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 16 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontFamily: 'Space Grotesk', fontWeight: 500, fontSize: 13, color: '#6B6560', marginBottom: 6 }}>Slot Duration</label>
                      <select
                        value={formData.slot_duration_minutes}
                        onChange={e => setFormData({ ...formData, slot_duration_minutes: parseInt(e.target.value) || 60 })}
                        style={{ width: '100%', background: '#F5F3F0', border: '1px solid #E0DDD9', borderRadius: 10, padding: '10px 14px', fontFamily: 'Inter', fontSize: 14, boxSizing: 'border-box' }}
                      >
                        <option value={30}>30 minutes</option>
                        <option value={60}>1 hour</option>
                        <option value={90}>1.5 hours</option>
                        <option value={120}>2 hours</option>
                        <option value={180}>3 hours</option>
                        <option value={240}>4 hours</option>
                        <option value={360}>Half day (6 hrs)</option>
                        <option value={720}>Full day (12 hrs)</option>
                        <option value={1440}>Full day (24 hrs)</option>
                      </select>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontFamily: 'Space Grotesk', fontWeight: 500, fontSize: 13, color: '#6B6560', marginBottom: 6 }}>Adv. Booking (Days)</label>
                      <input
                        type="number"
                        value={formData.advance_booking_days}
                        onChange={e => setFormData({ ...formData, advance_booking_days: e.target.value === '' ? 0 : parseInt(e.target.value) })}
                        style={{ width: '100%', background: '#F5F3F0', border: '1px solid #E0DDD9', borderRadius: 10, padding: '10px 14px', fontFamily: 'Inter', fontSize: 14, boxSizing: 'border-box', MozAppearance: 'textfield' }}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontFamily: 'Inter', fontWeight: 400, fontSize: 13, color: '#6B6560', padding: 12, background: '#F5F3F0', borderRadius: 10, margin: 0 }}>
                      Residents will book this amenity for an entire day, not specific time slots.
                    </p>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontFamily: 'Space Grotesk', fontWeight: 500, fontSize: 13, color: '#6B6560', marginBottom: 6 }}>Adv. Booking (Days)</label>
                    <input
                      type="number"
                      value={formData.advance_booking_days}
                      onChange={e => setFormData({ ...formData, advance_booking_days: e.target.value === '' ? 0 : parseInt(e.target.value) })}
                      style={{ width: '100%', background: '#F5F3F0', border: '1px solid #E0DDD9', borderRadius: 10, padding: '10px 14px', fontFamily: 'Inter', fontSize: 14, boxSizing: 'border-box', MozAppearance: 'textfield' }}
                    />
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
                <span style={{ fontFamily: 'Space Grotesk', fontWeight: 500, fontSize: 13, color: '#6B6560' }}>Status</span>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formData.status === 'active'}
                    onChange={e => setFormData({ ...formData, status: e.target.checked ? 'active' : 'inactive' })}
                    style={{ width: 16, height: 16, cursor: 'pointer' }}
                  />
                  <span style={{ fontFamily: 'Inter', fontSize: 14, color: '#1C1917' }}>Active</span>
                </label>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '20px 24px', borderTop: '1px solid #E0DDD9' }}>
              <button
                onClick={handleSaveAmenity}
                style={{ width: '100%', background: '#1C1917', color: '#FFFFFF', border: 'none', borderRadius: 10, padding: '12px', fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
              >
                Save Amenity
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
