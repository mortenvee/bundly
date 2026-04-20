// Bundly – Hent teammedlemmer for innlogget bruker

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

const PLAN_LIMITS = { trial: 0, gratis: 0, starter: 0, familie: 4, team: 14 };

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS };

  const json = (code, body) => ({
    statusCode: code,
    headers: { ...CORS, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const SB  = process.env.SUPABASE_URL;
  const KEY = process.env.SUPABASE_SERVICE_KEY;
  const HDR = { 'Authorization': `Bearer ${KEY}`, 'apikey': KEY, 'Content-Type': 'application/json' };

  try {
    const authHeader = event.headers['authorization'] || '';
    const userToken  = authHeader.replace('Bearer ', '');
    if (!userToken) return json(401, { error: 'Ikke innlogget' });

    const userRes  = await fetch(`${SB}/auth/v1/user`, {
      headers: { 'Authorization': `Bearer ${userToken}`, 'apikey': KEY },
    });
    const userData = await userRes.json();
    if (!userRes.ok || !userData.id) return json(401, { error: 'Ugyldig sesjon' });
    const userId = userData.id;

    // Hent plan
    const subRes = await fetch(`${SB}/rest/v1/subscriptions?user_id=eq.${userId}&select=plan,status`, {
      headers: { ...HDR, 'Prefer': 'return=representation' },
    });
    const subs = await subRes.json();
    const sub  = subs?.[0];

    const created  = new Date(userData.created_at);
    const daysUsed = Math.floor((Date.now() - created) / 86400000);
    const inTrial  = daysUsed < 7;
    const plan     = (sub?.status === 'active' && sub?.plan !== 'gratis') ? sub.plan : (inTrial ? 'trial' : 'gratis');
    const maxMembers = PLAN_LIMITS[plan] ?? 0;

    // Hent teammedlemmer
    const membersRes = await fetch(`${SB}/rest/v1/team_members?owner_id=eq.${userId}&select=*&order=invited_at.asc`, {
      headers: { ...HDR, 'Prefer': 'return=representation' },
    });
    const members = membersRes.ok ? await membersRes.json() : [];

    return json(200, { members, plan, maxMembers, used: members.length });

  } catch (err) {
    console.error('get-team error:', err);
    return json(500, { error: err.message });
  }
};
