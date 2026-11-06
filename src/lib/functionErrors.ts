export async function functionErrorMessage(error: Error & { context?: unknown }): Promise<string> {
  if (error.context instanceof Response) {
    const body: { error?: unknown } | null = await error.context.json().catch(() => null);
    if (typeof body?.error === 'string') return body.error;
  }
  return error.message;
}
