export async function confirmationResult(hash, search, config, request = fetch) {
  const values = new URLSearchParams(hash.replace(/^#/, ''));
  const query = new URLSearchParams(search);
  if (values.has('error') || values.has('error_code') || query.has('error') || query.has('error_code')) {
    return { ok: false, title: 'This link could not verify your email', message: 'The link may have expired or already been used. Try signing in to ClickCoach. If your email is still unverified, request a new confirmation link.' };
  }
  const token = values.get('access_token');
  if (!token || values.get('type') !== 'signup') return { ok: false, title: 'Open your confirmation email', message: 'Use the confirmation link sent by ClickCoach to verify your email, then return to the extension to sign in.' };
  try {
    const response = await request(`${config.url}/auth/v1/user`, { headers: { apikey: config.key, Authorization: `Bearer ${token}` }, cache: 'no-store', signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('Invalid confirmation');
    const user = await response.json();
    if (!user.email_confirmed_at) throw new Error('Unverified email');
    return { ok: true, title: 'You’re verified!', message: 'Your email is confirmed. Open the ClickCoach extension and sign in to start your first guide. You can close this tab.' };
  } catch {
    return { ok: false, title: 'We couldn’t check your verification', message: 'Your email may already be confirmed. Try signing in inside ClickCoach. If that fails, request a new confirmation email and use its latest link.' };
  }
}
