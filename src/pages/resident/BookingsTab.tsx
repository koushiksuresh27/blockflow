import { useState, useEffect } from 'react';
import { Building, Gym, Droplet, TennisBall, Leaf, Calendar } from 'iconoir-react';
import { supabase } from '../../lib/supabase';
import { format, parse, addMinutes, isAfter } from 'date-fns';

export default function BookingsTab() {
  const [activeTab, setActiveTab] = useState<'amenities' | 'parking'>('amenities');
  const [amenities, setAmenities] = useState<any[]>([]);
  const [myBookings, setMyBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [societyId, setSocietyId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setCurrentUserId(user.id);
        supabase.from('users').select('society_id').eq('id', user.id).single()
          .then(({ data }) => {
            if (data?.society_id) {
              setSocietyId(data.society_id);
            }
          });
      }
    });
  }, []);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAmenity, setSelectedAmenity] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [slots, setSlots] = useState<any[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  const [guestsCount, setGuestsCount] = useState(1);
  const [purpose, setPurpose] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null);

  useEffect(() => {
    if (activeTab === 'amenities' && societyId && currentUserId) {
      fetchAmenities(societyId);
      fetchMyBookings(currentUserId);
    }
  }, [activeTab, societyId, currentUserId]);

  useEffect(() => {
    if (selectedAmenity && selectedDate) {
      fetchExistingBookingsAndGenerateSlots(selectedAmenity, selectedDate);
    }
  }, [selectedAmenity, selectedDate]);

  const fetchAmenities = async (socId: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('amenities')
      .select('*')
      .eq('society_id', socId)
      .eq('status', 'active')
      .order('name');

    if (!error && data) {
      setAmenities(data);
    }
    setLoading(false);
  };

  const fetchMyBookings = async (userId: string) => {
    const { data, error } = await supabase
      .from('amenity_bookings')
      .select('*, amenities(name, type)')
      .eq('resident_id', userId)
      .order('booking_date', { ascending: true });

    if (!error && data) {
      setMyBookings(data);
    }
  };

  const fetchExistingBookingsAndGenerateSlots = async (amenity: any, date: string) => {
    const { data } = await supabase
      .from('amenity_bookings')
      .select('start_time, end_time')
      .eq('amenity_id', amenity.id)
      .eq('booking_date', date)
      .eq('status', 'confirmed');

    const bookings = data || [];

    // Fallbacks if not set in DB
    const startTime = amenity.available_start_time?.slice(0, 5) || '08:00';
    const endTime = amenity.available_end_time?.slice(0, 5) || '22:00';
    const durationMinutes = amenity.slot_duration_minutes || 60;

    if (amenity.booking_type === 'full_day') {
      const isBooked = bookings.length > 0;
      setSlots([{
        start: startTime,
        end: endTime,
        available: !isBooked,
        isFullDay: true
      }]);
      return;
    }

    const generatedSlots = generateSlots(startTime, endTime, durationMinutes, bookings);
    setSlots(generatedSlots);
  };

  const parseTime = (timeStr: string) => {
    return parse(timeStr.slice(0, 5), 'HH:mm', new Date());
  };

  const formatTime = (dateObj: Date) => {
    return format(dateObj, 'HH:mm');
  };

  const timeOverlaps = (startA: Date, endA: Date, startBStr: string, endBStr: string) => {
    const startB = parseTime(startBStr);
    const endB = parseTime(endBStr);
    // A overlaps B if (startA < endB) and (endA > startB)
    return isAfter(endB, startA) && isAfter(endA, startB);
  };

  const generateSlots = (startTime: string, endTime: string, durationMinutes: number, bookedRanges: any[]) => {
    const slots = [];
    let current = parseTime(startTime);
    const end = parseTime(endTime);

    while (current < end) {
      const slotEnd = addMinutes(current, durationMinutes);
      if (slotEnd > end) break;

      const isBooked = bookedRanges.some(b =>
        timeOverlaps(current, slotEnd, b.start_time, b.end_time)
      );

      slots.push({
        start: formatTime(current),
        end: formatTime(slotEnd),
        available: !isBooked
      });

      current = slotEnd;
    }
    return slots;
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'clubhouse': case 'party_hall': return <Building width={24} height={24} />;
      case 'gym': return <Gym width={24} height={24} />;
      case 'pool': return <Droplet width={24} height={24} />;
      case 'tennis_court': case 'badminton_court': return <TennisBall width={24} height={24} />;
      case 'garden': return <Leaf width={24} height={24} />;
      default: return <Calendar width={24} height={24} />;
    }
  };

  const openBookingModal = (amenity: any) => {
    setSelectedAmenity(amenity);
    setSelectedDate(format(new Date(), 'yyyy-MM-dd'));
    setSelectedSlot(null);
    setGuestsCount(1);
    setPurpose('');
    setMessage(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedAmenity(null);
    setSelectedSlot(null);
  };

  const confirmBooking = async () => {
    if (!selectedSlot) return;
    setBookingLoading(true);
    setMessage(null);

    const durationHours = (selectedAmenity.slot_duration_minutes || 60) / 60;
    const cost = selectedAmenity.booking_type === 'full_day'
      ? (selectedAmenity.hourly_rate || 0)
      : (selectedAmenity.hourly_rate || 0) * durationHours;

    const { error } = await supabase
      .from('amenity_bookings')
      .insert({
        amenity_id: selectedAmenity.id,
        society_id: societyId,
        resident_id: currentUserId,
        booking_date: selectedDate,
        start_time: selectedSlot.start,
        end_time: selectedSlot.end,
        guests_count: guestsCount,
        purpose: purpose,
        cost: cost,
        status: 'confirmed'
      });

    setBookingLoading(false);

    if (error) {
      setMessage({ type: 'error', text: 'Failed to book — slot may have just been taken' });
      return;
    }

    setMessage({ type: 'success', text: 'Booking confirmed!' });
    setTimeout(() => {
      closeModal();
      if (currentUserId) fetchMyBookings(currentUserId);
    }, 1500);
  };

  return (
    <div className="px-5 py-6 min-h-screen bg-[#F5F4F0]">
      <div className="bg-white px-4 py-4 border-b border-[#E0DDD9] -mx-5 -mt-6 mb-6">
        <h2 className="text-2xl font-display font-bold text-[#1C1917]">Bookings</h2>
        <p className="text-sm font-sans text-[#6B6560] mt-0.5">Reserve amenities & parking</p>
      </div>

      <div className="flex gap-2 p-1 bg-white rounded-full border border-[#E0DDD9] mb-6">
        <button
          onClick={() => setActiveTab('amenities')}
          className={`flex-1 py-2 text-sm font-medium rounded-full transition-colors ${activeTab === 'amenities' ? 'bg-[#1C1917] text-white' : 'text-[#78716C] hover:text-[#1C1917]'}`}
        >
          Amenities
        </button>
        <button
          onClick={() => setActiveTab('parking')}
          className={`flex-1 py-2 text-sm font-medium rounded-full transition-colors ${activeTab === 'parking' ? 'bg-[#1C1917] text-white' : 'text-[#78716C] hover:text-[#1C1917]'}`}
        >
          Parking
        </button>
      </div>

      {activeTab === 'parking' ? (
        <div className="text-center py-20 bg-white rounded-[24px] border border-[#E0DDD9]">
          <span className="text-4xl mb-4 block">🚧</span>
          <h2 className="text-lg font-medium text-[#1C1917]">Coming Soon</h2>
          <p className="text-[#78716C] mt-1 text-sm">Parking bookings will be available shortly.</p>
        </div>
      ) : (
        <div className="space-y-8">
          <section>
            <h2 className="text-sm font-semibold text-[#78716C] uppercase tracking-wider mb-4">Available Amenities</h2>
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="w-8 h-8 border-4 border-[#D97706] border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : amenities.length > 0 ? (
              <div className="grid grid-cols-1 gap-4">
                {amenities.map(amenity => (
                  <div key={amenity.id} className="bg-white p-5 rounded-[24px] border border-[#E0DDD9] flex items-center gap-[12px] w-full min-w-0 overflow-hidden">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="shrink-0 w-[40px] h-[40px] bg-[#F5F4F0] text-[#1C1917] rounded-full flex items-center justify-center">
                        {getIcon(amenity.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-[#1C1917] truncate">{amenity.name}</h3>
                        <p className="text-sm text-[#78716C] whitespace-nowrap">Max capacity: {amenity.capacity || '—'}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => openBookingModal(amenity)}
                      className="shrink-0 ml-auto px-4 py-2 bg-[#F5F4F0] text-[#1C1917] font-medium text-sm rounded-full hover:bg-[#E0DDD9] transition-colors"
                    >
                      Book
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[#78716C] text-sm">No amenities found for your society.</p>
            )}
          </section>

          <section>
            <h2 className="text-sm font-semibold text-[#78716C] uppercase tracking-wider mb-4">My Bookings</h2>
            {myBookings.length > 0 ? (
              <div className="space-y-3">
                {myBookings.map(booking => (
                  <div key={booking.id} className="bg-white p-4 rounded-[20px] border border-[#E0DDD9] flex items-center gap-4">
                    <div className="w-10 h-10 bg-[#F5F4F0] text-[#1C1917] rounded-full flex items-center justify-center">
                      {getIcon(booking.amenities?.type)}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-[#1C1917]">{booking.amenities?.name}</h4>
                      <p className="text-xs text-[#78716C]">
                        {format(parse(booking.booking_date, 'yyyy-MM-dd', new Date()), 'MMM d, yyyy')} • {booking.start_time} - {booking.end_time}
                      </p>
                    </div>
                    <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full capitalize">
                      {booking.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[#78716C] text-sm">You have no upcoming bookings.</p>
            )}
          </section>
        </div>
      )}

      {/* Booking Modal */}
      {isModalOpen && selectedAmenity && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 animate-in fade-in">
          <div className="bg-white w-full sm:w-[480px] sm:rounded-[32px] rounded-t-[32px] overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-[#E0DDD9] flex justify-between items-center bg-white sticky top-0 z-10">
              <div>
                <h3 className="text-xl font-semibold text-[#1C1917]">{selectedAmenity.name}</h3>
                <p className="text-sm text-[#78716C]">Book a slot</p>
              </div>
              <button onClick={closeModal} className="w-8 h-8 flex items-center justify-center bg-[#F5F4F0] rounded-full text-[#1C1917]">
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              {message && (
                <div className={`p-3 mb-4 rounded-xl text-sm font-medium ${message.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                  {message.text}
                </div>
              )}

              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-[#1C1917] mb-2">Select Date</label>
                  <input
                    type="date"
                    value={selectedDate}
                    min={format(new Date(), 'yyyy-MM-dd')}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full p-3 bg-[#F5F4F0] border-none rounded-xl text-[#1C1917] focus:ring-2 focus:ring-[#D97706] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#1C1917] mb-2">Available Slots</label>
                  <div className="grid grid-cols-3 gap-2">
                    {slots.map((slot, idx) => (
                      <button
                        key={idx}
                        disabled={!slot.available}
                        onClick={() => setSelectedSlot(slot)}
                        className={`py-2 text-sm font-medium rounded-xl transition-colors border ${!slot.available
                          ? 'bg-[#F5F4F0] text-[#D6D3D1] border-transparent cursor-not-allowed'
                          : selectedSlot === slot
                            ? 'bg-[#1C1917] text-white border-[#1C1917]'
                            : 'bg-white text-[#1C1917] border-[#E0DDD9] hover:border-[#1C1917]'
                          }`}
                      >
                        {slot.isFullDay ? 'Full Day' : slot.start}
                      </button>
                    ))}
                  </div>
                  {slots.length === 0 && <p className="text-sm text-[#78716C] mt-2">No slots available.</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[#1C1917] mb-2">Guests</label>
                    <input
                      type="number"
                      min="1"
                      max={selectedAmenity.max_capacity}
                      value={guestsCount}
                      onChange={(e) => setGuestsCount(parseInt(e.target.value))}
                      className="w-full p-3 bg-[#F5F4F0] border-none rounded-xl text-[#1C1917] focus:ring-2 focus:ring-[#D97706] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#1C1917] mb-2">Purpose (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Birthday"
                      value={purpose}
                      onChange={(e) => setPurpose(e.target.value)}
                      className="w-full p-3 bg-[#F5F4F0] border-none rounded-xl text-[#1C1917] focus:ring-2 focus:ring-[#D97706] outline-none"
                    />
                  </div>
                </div>

                <div className="p-4 bg-[#F5F4F0] rounded-xl flex justify-between items-center">
                  <span className="text-sm font-medium text-[#1C1917]">Total Amount</span>
                  <span className="text-lg font-bold text-[#1C1917]">
                    ₹{selectedAmenity.booking_type === 'full_day'
                      ? (selectedAmenity.hourly_rate || 0).toFixed(2)
                      : ((selectedAmenity.hourly_rate || 0) * ((selectedAmenity.slot_duration_minutes || 60) / 60)).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-[#E0DDD9] bg-white mt-auto">
              <button
                onClick={confirmBooking}
                disabled={!selectedSlot || bookingLoading}
                className="w-full py-4 bg-[#D97706] text-white font-medium rounded-full shadow-[0_2px_8px_rgba(217,119,6,0.25)] hover:bg-[#B45309] transition-colors disabled:opacity-50 flex justify-center items-center h-14"
              >
                {bookingLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  'Confirm Booking'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
