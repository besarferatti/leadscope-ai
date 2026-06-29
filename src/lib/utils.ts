import { LeadStatus } from '../types';

export function getStatusColor(status: LeadStatus | string): string {
  switch (status) {
    case 'New': return 'bg-slate-700 text-slate-300';
    case 'Audited': return 'bg-blue-500/20 text-blue-400';
    case 'Message Generated': return 'bg-violet-500/20 text-violet-400';
    case 'Contacted': return 'bg-amber-500/20 text-amber-400';
    case 'Interested': return 'bg-emerald-500/20 text-emerald-400';
    case 'Not Interested': return 'bg-red-500/20 text-red-400';
    case 'Closed': return 'bg-green-500/20 text-green-400';
    default: return 'bg-slate-700 text-slate-300';
  }
}

export function getScoreColor(score: number): string {
  if (score >= 75) return 'text-emerald-400';
  if (score >= 50) return 'text-amber-400';
  if (score >= 25) return 'text-orange-400';
  return 'text-red-400';
}

export function getScoreBg(score: number): string {
  if (score >= 75) return 'bg-emerald-500';
  if (score >= 50) return 'bg-amber-500';
  if (score >= 25) return 'bg-orange-500';
  return 'bg-red-500';
}

export function getSearchStatusColor(status: string): string {
  switch (status) {
    case 'pending': return 'bg-slate-700 text-slate-300';
    case 'running': return 'bg-blue-500/20 text-blue-400';
    case 'completed': return 'bg-emerald-500/20 text-emerald-400';
    default: return 'bg-slate-700 text-slate-300';
  }
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function exportLeadsCSV(leads: Array<Record<string, unknown>>, filename = 'leads.csv') {
  if (!leads.length) return;
  const headers = Object.keys(leads[0]);
  const rows = leads.map(lead =>
    headers.map(h => {
      const val = lead[h];
      const s = val == null ? '' : String(val);
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    }).join(',')
  );
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const LEAD_STATUSES: LeadStatus[] = [
  'New',
  'Audited',
  'Message Generated',
  'Contacted',
  'Interested',
  'Not Interested',
  'Closed',
];

export const INDUSTRIES = [
  'Dental', 'Medical', 'Legal', 'Real Estate', 'Restaurant',
  'Retail', 'Fitness', 'Beauty & Spa', 'Automotive', 'Construction',
  'Plumbing', 'HVAC', 'Landscaping', 'Cleaning', 'Education',
  'Accounting', 'Insurance', 'Photography', 'Events', 'Other',
];

export const LANGUAGES = [
  'English', 'Spanish', 'French', 'German', 'Portuguese',
  'Italian', 'Dutch', 'Polish', 'Turkish', 'Arabic',
];

export const TONES = ['Professional', 'Friendly', 'Casual', 'Direct', 'Empathetic'];
