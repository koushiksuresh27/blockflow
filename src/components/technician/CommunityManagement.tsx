import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Building, ClipboardCheck } from 'iconoir-react';

interface Society {
  id: string;
  name: string;
  city: string;
  total_flats: number;
  total_towers: number;
}

interface TechnicianSociety {
  id: string;
  technician_id: string;
  society_id: string;
  status: 'pending' | 'active' | 'inactive';
  is_available: boolean;
  societies?: Society;
  openTasks?: number;
}

interface CommunityManagementProps {
  technicianId: string;
  currentUserId: string;
}

export default function CommunityManagement({ technicianId }: CommunityManagementProps) {
  const [communities, setCommunities] = useState<TechnicianSociety[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmLeaveId, setConfirmLeaveId] = useState<string | null>(null);

  const fetchCommunities = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('technician_societies')
        .select(`
          *,
          societies(
            id, name, city, 
            total_flats, total_towers
          )
        `)
        .eq('technician_id', technicianId)
        .order('joined_at', { ascending: false });

      if (error) throw error;

      if (data) {
        // Fetch open task counts for active communities
        const enhancedData = await Promise.all(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data.map(async (row: any) => {
            let openTasks = 0;
            if (row.status === 'active' && row.societies) {
              const { count } = await supabase
                .from('complaints')
                .select('*', { count: 'exact', head: true })
                .eq('society_id', row.societies.id)
                .eq('assigned_tech_id', technicianId)
                .not('status', 'in', '("resolved","closed")');
              
              openTasks = count || 0;
            }
            return { ...row, openTasks };
          })
        );
        setCommunities(enhancedData as TechnicianSociety[]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [technicianId]);

  useEffect(() => {
    fetchCommunities();

    const channel = supabase
      .channel('my-communities-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'technician_societies',
        filter: `technician_id=eq.${technicianId}`
      }, () => {
        fetchCommunities();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchCommunities, technicianId]);

  const handleToggleAvailability = async (societyId: string, newValue: boolean) => {
    // Optimistic update
    setCommunities(prev => prev.map(c => c.society_id === societyId ? { ...c, is_available: newValue } : c));
    try {
      await supabase
        .from('technician_societies')
        .update({ is_available: newValue })
        .eq('technician_id', technicianId)
        .eq('society_id', societyId);
    } catch (e) {
      console.error(e);
      // Revert on failure
      setCommunities(prev => prev.map(c => c.society_id === societyId ? { ...c, is_available: !newValue } : c));
    }
  };

  const handleLeave = async (societyId: string) => {
    try {
      await supabase
        .from('technician_societies')
        .update({ status: 'inactive' })
        .eq('technician_id', technicianId)
        .eq('society_id', societyId);
      setConfirmLeaveId(null);
      fetchCommunities();
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        </svg>
      </div>
    );
  }

  return (
    <div className="p-5 flex flex-col gap-4 font-inter">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-[20px] text-[#1C1917] tracking-tight font-['Recoleta',serif]">My Communities</h2>
      </div>

      {communities.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Building className="w-10 h-10 text-[#E0DDD9] mb-4" />
          <h3 className="font-semibold text-[#1C1917] text-base mb-1">No communities yet</h3>
          <p className="text-[#6B6560] text-sm mb-6 max-w-[250px]">Your society admin will add you to their list to start receiving tasks.</p>
        </div>
      ) : (
        communities.map(comm => (
          <div key={comm.id} className="bg-[#FFFFFF] border border-[#E0DDD9] rounded-[16px] p-4 mb-3 flex flex-col gap-4">
            <div className="flex justify-between items-start">
              <div className="flex gap-3 items-center">
                <div className="w-[36px] h-[36px] rounded-full bg-[#F5F3F0] flex items-center justify-center shrink-0">
                  <Building className="w-5 h-5 text-[#1C1917]" />
                </div>
                <div>
                  <h3 className="font-['Space_Grotesk'] font-semibold text-[15px] text-[#1C1917]">
                    {comm.societies?.name}
                  </h3>
                  <p className="font-inter font-normal text-[12px] text-[#9C9894]">
                    {comm.societies?.total_flats 
                      ? `${comm.societies.city} \u00B7 ${comm.societies.total_flats} flats`
                      : comm.societies?.city}
                  </p>
                </div>
              </div>
              <div className="shrink-0">
                {comm.status === 'active' && (
                  <span className="bg-[#F0FDF4] text-[#15803D] text-xs font-medium px-2 py-1 rounded-md">active</span>
                )}
                {comm.status === 'pending' && (
                  <span className="bg-[#FEF3C7] text-[#D97706] text-xs font-medium px-2 py-1 rounded-md">pending</span>
                )}
                {comm.status === 'inactive' && (
                  <span className="bg-[#F5F3F0] text-[#9C9894] text-xs font-medium px-2 py-1 rounded-md">inactive</span>
                )}
              </div>
            </div>

            {comm.status === 'active' && (
              <div className="flex items-center gap-1.5 border border-[#E0DDD9] rounded-md px-3 py-1.5 self-start bg-[#FAFAFA]">
                <ClipboardCheck className="w-[14px] h-[14px] text-[#6B6560]" />
                <span className="font-inter font-medium text-[12px] text-[#6B6560]">
                  {comm.openTasks === 0 ? 'All clear' : `${comm.openTasks} open tasks`}
                </span>
              </div>
            )}

            {comm.status === 'active' && (
              <div className="flex justify-between items-center mt-1">
                <div className="flex items-center gap-3">
                  <label className="font-inter text-sm text-[#1C1917] cursor-pointer flex items-center gap-2">
                    <span className="text-sm font-medium">Available here</span>
                    <div 
                      className={`w-10 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${comm.is_available ? 'bg-green-500' : 'bg-gray-300'}`}
                      onClick={() => handleToggleAvailability(comm.society_id, !comm.is_available)}
                    >
                      <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${comm.is_available ? 'translate-x-4' : ''}`} />
                    </div>
                  </label>
                </div>
                {confirmLeaveId === comm.society_id ? (
                  <div className="flex items-center gap-2">
                    <span className="font-inter text-[12px] text-[#6B6560]">Sure?</span>
                    <button
                      onClick={() => handleLeave(comm.society_id)}
                      className="bg-transparent text-[#DC2626] rounded-[8px] px-2 py-1 font-inter font-medium text-[12px] hover:bg-red-50 transition-colors"
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => setConfirmLeaveId(null)}
                      className="bg-transparent border border-[#E0DDD9] text-[#9C9894] rounded-[8px] px-2 py-1 font-inter font-medium text-[12px] hover:bg-gray-50 transition-colors"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmLeaveId(comm.society_id)}
                    className="bg-transparent border border-[#E0DDD9] text-[#9C9894] rounded-[8px] px-3 py-1.5 font-inter font-medium text-[12px] hover:bg-gray-50 transition-colors"
                  >
                    Leave
                  </button>
                )}
              </div>
            )}

            {comm.status === 'pending' && (
              <div className="flex justify-end mt-1">
                <span className="text-[#D97706] font-inter font-normal text-[12px]">Pending approval</span>
              </div>
            )}
          </div>
        ))
      )}

    </div>
  );
}
