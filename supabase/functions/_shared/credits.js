/** @typedef {'lead_search' | 'website_analysis' | 'website_preview' | 'email_generation' | 'dm_generation' | 'email_send' | 'email_discovery'} CreditAction */

/**
 * @param {{rpc: (name: 'spend_credits', args: {p_user: string, p_action: CreditAction, p_operation: string}) => PromiseLike<{data: unknown, error: {message: string} | null}>}} client
 * @param {string} userId
 * @param {CreditAction} action
 */
export async function chargeCredits(client, userId, action) {
  const { data, error } = await client.rpc('spend_credits', {
    p_user: userId,
    p_action: action,
    p_operation: crypto.randomUUID(),
  });
  if (error) console.error('Credit debit failed:', error.message);
  switch (data) {
    case 'charged': return null;
    case 'inactive': return { status: 403, message: 'An active account is required.' };
    case 'insufficient': return { status: 402, message: 'Insufficient credits. Visit Billing to add credits.' };
    case 'duplicate': return { status: 409, message: 'This operation has already been charged.' };
    default: return { status: 503, message: 'Unable to check credits. Try again later.' };
  }
}
