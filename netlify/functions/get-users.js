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

    // Hent alle abonnementer og teammedlemmer parallelt
    const [subsRes, membersRes] = await Promise.all([
      fetch(`${SB}/rest/v1/subscriptions?select=*`, {
        headers: { ...HDR, 'Prefer': 'return=representation' }
      }),
      fetch(`${SB}/rest/v1/team_members?select=member_id,member_email,owner_email`, {
        headers: { ...HDR, 'Prefer': 'return=representation' }
      }),
    ]);
    const subs    = subsRes.ok    ? await subsRes.json()    : [];
    const members = membersRes.ok ? await membersRes.json() : [];

    // Slå sammen
    const subsMap    = {};
    subs.forEach(s => subsMap[s.user_id] = s);

    // Teammedlemmer: match på member_id eller member_email
    const memberMap = {}; // userId/email → owner_email
    members.forEach(m => {
      if (m.member_id)    memberMap[m.member_id]    = m.owner_email || 'ukjent eier';
      if (m.member_email) memberMap[m.member_email] = m.owner_email || 'ukjent eier';
    });

    const merged = users.map(u => {
      const ownerEmail = memberMap[u.id] || memberMap[u.email] || null;
      return {
        id:           u.id,
        email:        u.email,
        created_at:   u.created_at,
        last_sign_in: u.last_sign_in_at,
        plan:         ownerEmail ? 'team-member' : (subsMap[u.id]?.plan   || 'gratis'),
        status:       ownerEmail ? ownerEmail    : (subsMap[u.id]?.status || 'none'),
        period:       subsMap[u.id]?.period || null,
        teamOwner:    ownerEmail,
      };
    });

    return json(200, { users: merged, total: merged.length });

  } catch (err) {
    console.error('get-users error:', err);
    return json(500, { error: err.message });
  }
};
