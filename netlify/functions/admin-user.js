// Bundly – Admin User Management
// Actions: set_plan, reset_password, invite_user
// Env vars: SUPABASE_URL, SUPABASE_SERVICE_KEY, ADMIN_SECRET

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type, x-admin-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS };

  const json = (code, body) => ({
    statusCode: code,
    headers: { ...CORS, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const secret = event.headers['x-admin-secret'];
  if (!secret || secret !== process.env.ADMIN_SECRET) return json(401, { error: 'Unauthorized' });

  const SB  = process.env.SUPABASE_URL;
  const KEY = process.env.SUPABASE_SERVICE_KEY;
  const HDR = {
    'Authorization': `Bearer ${KEY}`,
    'apikey': KEY,
    'Content-Type': 'application/json',
  };

  try {
    const { action, userId, plan, status, email } = JSON.parse(event.body || '{}');

    // ── Endre plan / avslutt abonnement
    if (action === 'set_plan') {
      if (!userId || !plan) return json(400, { error: 'Mangler userId eller plan' });

      const newStatus = status || (plan === 'gratis' ? 'none' : 'active');

      // Upsert i subscriptions-tabellen
      const res = await fetch(`${SB}/rest/v1/subscriptions?user_id=eq.${userId}`, {
        method: 'PATCH',
        headers: { ...HDR, 'Prefer': 'return=minimal' },
        body: JSON.stringify({ plan, status: newStatus, updated_at: new Date().toISOString() }),
      });

      // Hvis ingen rad fantes, insert
      if (res.status === 404 || res.status === 204) {
        if (plan !== 'gratis') {
          await fetch(`${SB}/rest/v1/subscriptions`, {
            method: 'POST',
            headers: { ...HDR, 'Prefer': 'return=minimal' },
            body: JSON.stringify({ user_id: userId, plan, status: newStatus, period: 'monthly', updated_at: new Date().toISOString() }),
          });
        }
      }

      return json(200, { ok: true });
    }

    // ── Reset passord (send e-post via Supabase Admin)
    if (action === 'reset_password') {
      if (!userId) return json(400, { error: 'Mangler userId' });

      // Hent brukerens e-post
      const userRes = await fetch(`${SB}/auth/v1/admin/users/${userId}`, { headers: HDR });
      const userData = await userRes.json();
      const userEmail = userData.email;

      if (!userEmail) return json(404, { error: 'Bruker ikke funnet' });

      // Generer magic link / reset link
      const resetRes = await fetch(`${SB}/auth/v1/admin/users/${userId}/password`, {
        method: 'PUT',
        headers: HDR,
        body: JSON.stringify({ password: null }), // trigger reset
      });

      // Send reset e-post via Supabase recover
      const recoverRes = await fetch(`${SB}/auth/v1/recover`, {
        method: 'POST',
        headers: { ...HDR, 'apikey': KEY },
        body: JSON.stringify({ email: userEmail }),
      });

      return json(200, { ok: true, email: userEmail });
    }

    // ── Inviter ny bruker
    if (action === 'invite') {
      if (!email || !userId) return json(400, { error: 'Mangler email eller userId (inviterende bruker)' });

      // Hent inviterende brukers plan
      const subRes = await fetch(`${SB}/rest/v1/subscriptions?user_id=eq.${userId}&select=plan,status`, {
        headers: { ...HDR, 'Prefer': 'return=representation' },
      });
      const subs = await subRes.json();
      const sub = subs[0];

      if (!sub || sub.status !== 'active') return json(403, { error: 'Ingen aktiv plan' });

      // Antall eksisterende inviterte brukere
      // (forenklet: vi sjekker ikke dette her, frontend håndterer grensen)

      // Inviter via Supabase Admin
      const inviteRes = await fetch(`${SB}/auth/v1/admin/users`, {
        method: 'POST',
        headers: HDR,
        body: JSON.stringify({ email, email_confirm: true }),
      });

      if (!inviteRes.ok) {
        const err = await inviteRes.json();
        return json(400, { error: err.message || 'Kunne ikke invitere bruker' });
      }

      return json(200, { ok: true });
    }

    // ── Slett bruker
    if (action === 'delete_user') {
      if (!userId) return json(400, { error: 'Mangler userId' });

      // Slett alt relatert data først (foreign key-rekkefølge)
      await fetch(`${SB}/rest/v1/app_state?user_id=eq.${userId}`, {
        method: 'DELETE', headers: HDR,
      });
      await fetch(`${SB}/rest/v1/subscriptions?user_id=eq.${userId}`, {
        method: 'DELETE', headers: HDR,
      });

      // Slett auth-bruker til slutt
      const delRes = await fetch(`${SB}/auth/v1/admin/users/${userId}`, {
        method: 'DELETE', headers: HDR,
      });
      if (!delRes.ok && delRes.status !== 204) {
        const err = await delRes.json();
        return json(400, { error: err.message || 'Kunne ikke slette bruker' });
      }
      return json(200, { ok: true });
    }

    return json(400, { error: 'Ukjent action' });

  } catch (err) {
    console.error('admin-user error:', err);
    return json(500, { error: err.message });
  }
};
