// Bundly – Get Users (admin only)
// Henter brukere fra auth.users + subscriptions via service role
// Env vars: SUPABASE_URL, SUPABASE_SERVICE_KEY, ADMIN_SECRET

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type, x-admin-secret',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS };

  const json = (code, body) => ({
    statusCode: code,
    headers: { ...CORS, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  // Auth
  const secret = event.headers['x-admin-secret'];
  if (!secret || secret !== process.env.ADMIN_SECRET) return json(401, { error: 'Unauthorized' });

  const SB  = `${process.env.SUPABASE_URL}`;
  const KEY = process.env.SUPABASE_SERVICE_KEY;
  const HDR = {
    'Authorization': `Bearer ${KEY}`,
    'apikey': KEY,
    'Content-Type': 'application/json',
  };

  try {
    // Hent alle brukere fra auth.users
    const usersRes = await fetch(`${SB}/auth/v1/admin/users?per_page=1000`, { headers: HDR });
    const usersData = await usersRes.json();
    const users = usersData.users || [];

    // Hent alle abonnementer
    const subsRes = await fetch(`${SB}/rest/v1/subscriptions?select=*`, {
      headers: { ...HDR, 'Prefer': 'return=representation' }
    });
    const subs = subsRes.ok ? await subsRes.json() : [];

    // Slå sammen
    const subsMap = {};
    subs.forEach(s => subsMap[s.user_id] = s);

    const merged = users.map(u => ({
      id:         u.id,
      email:      u.email,
      created_at: u.created_at,
      last_sign_in: u.last_sign_in_at,
      plan:       subsMap[u.id]?.plan   || 'gratis',
      status:     subsMap[u.id]?.status || 'none',
      period:     subsMap[u.id]?.period || null,
    }));

    return json(200, { users: merged, total: merged.length });

  } catch (err) {
    console.error('get-users error:', err);
    return json(500, { error: err.message });
  }
};
