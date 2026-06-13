export const VENDOR_SERVICE_TYPES = [
  'Lift Maintenance',
  'Pest Control',
  'Landscaping & Gardening',
  'Security Agency',
  'Waste Management',
  'Generator & DG Service',
  'Water Tank Cleaning',
  'CCTV & Intercom',
  'Plumbing (External)',
  'Electrical (External)',
  'Painting & Civil Works',
  'Housekeeping Agency',
  'Fire Safety & Equipment',
  'Swimming Pool Maintenance',
  'Other',
] as const;

export type VendorServiceType = 
  typeof VENDOR_SERVICE_TYPES[number];

export const VENDOR_STATUS_COLORS = {
  active: {
    bg: '#F0FDF4',
    text: '#16a34a',
    border: '#86efac',
    label: 'Active',
  },
  expired: {
    bg: '#FEF3C7',
    text: '#D97706',
    border: '#FCD34D',
    label: 'Expired',
  },
  terminated: {
    bg: '#FEF2F2',
    text: '#dc2626',
    border: '#FCA5A5',
    label: 'Terminated',
  },
} as const;
