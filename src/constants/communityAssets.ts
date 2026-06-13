import type { AssetType } from '../types/communityComplaint';

export interface AssetConfig {
  type: AssetType;
  label: string;
  emoji: string;
  defaultTitle: string;
  techSpecialization: string;
}

export const COMMUNITY_ASSETS: AssetConfig[] = [
  {
    type: 'lift',
    label: 'Lift / Elevator',
    emoji: '🛗',
    defaultTitle: 'Lift not working',
    techSpecialization: 'Lift',
  },
  {
    type: 'gym',
    label: 'Gym Equipment',
    emoji: '🏋️',
    defaultTitle: 'Gym equipment broken',
    techSpecialization: 'Carpentry',
  },
  {
    type: 'pool',
    label: 'Swimming Pool',
    emoji: '🏊',
    defaultTitle: 'Swimming pool issue',
    techSpecialization: 'Plumbing',
  },
  {
    type: 'generator',
    label: 'Generator / DG',
    emoji: '⚡',
    defaultTitle: 'Generator not working',
    techSpecialization: 'Electrical',
  },
  {
    type: 'corridor',
    label: 'Corridor / Common Area',
    emoji: '🚶',
    defaultTitle: 'Common area issue',
    techSpecialization: 'Housekeeping',
  },
  {
    type: 'parking',
    label: 'Parking Area',
    emoji: '🅿️',
    defaultTitle: 'Parking area issue',
    techSpecialization: 'Security',
  },
  {
    type: 'terrace',
    label: 'Terrace / Rooftop',
    emoji: '🏗️',
    defaultTitle: 'Terrace issue',
    techSpecialization: 'Other',
  },
  {
    type: 'water',
    label: 'Water Supply',
    emoji: '💧',
    defaultTitle: 'Water supply issue',
    techSpecialization: 'Plumbing',
  },
  {
    type: 'power',
    label: 'Power / Electricity',
    emoji: '🔌',
    defaultTitle: 'Power outage or issue',
    techSpecialization: 'Electrical',
  },
  {
    type: 'other',
    label: 'Other',
    emoji: '🔧',
    defaultTitle: 'Community issue',
    techSpecialization: 'Other',
  },
];

export const STATUS_CONFIG = {
  reported: {
    label: 'Reported',
    color: '#D97706',
    bg: '#FEF3C7',
    border: '#FCD34D',
    step: 1,
  },
  in_progress: {
    label: 'In Progress',
    color: '#2563eb',
    bg: '#EFF6FF',
    border: '#93c5fd',
    step: 2,
  },
  resolved: {
    label: 'Resolved',
    color: '#16a34a',
    bg: '#F0FDF4',
    border: '#86efac',
    step: 3,
  },
} as const;
