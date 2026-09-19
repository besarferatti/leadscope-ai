import { supabase } from './supabase';

export interface EmailDiscoveryProgress {
  completed: number;
  total: number;
  found: number;
  notFound: number;
  failed: number;
}

type DiscoveryResult = { status?: string; error?: string; email?: string };

export async function discoverLeadEmails(
  leadIds: string[],
  onProgress?: (progress: EmailDiscoveryProgress) => void,
  concurrency = 3,
) {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error('Please sign in again before finding emails.');

  const progress: EmailDiscoveryProgress = { completed: 0, total: leadIds.length, found: 0, notFound: 0, failed: 0 };
  onProgress?.({ ...progress });
  let cursor = 0;

  async function worker() {
    while (cursor < leadIds.length) {
      const leadId = leadIds[cursor++];
      try {
        const response = await fetch('/api/find-lead-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ leadId }),
        });
        const result = await response.json() as DiscoveryResult;
        if (!response.ok) progress.failed += 1;
        else if (result.status === 'found') progress.found += 1;
        else progress.notFound += 1;
      } catch {
        progress.failed += 1;
      }
      progress.completed += 1;
      onProgress?.({ ...progress });
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, leadIds.length) }, () => worker()));
  return progress;
}
