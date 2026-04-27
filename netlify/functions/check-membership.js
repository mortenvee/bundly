// Bundly – Sjekk om innlogget bruker er teammedlem
// Bruker service key for å omgå RLS

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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
    // Verifiser brukerens JWT
    const userToken = (event.headers['authorization'] || '').replace('Bearer ', '');
    if (!userToken) return json(401, { error: 'Ikke innlogget' });

    const userRes = await fetch(`${SB}/auth/v1/user`, {
      headers: { 'Authorization': `Bearer ${userToken}`, 'apikey': KEY },
    });
    const userData = userRes.ok ? await userRes.json() : {};
    if (!userData.id) return json(401, { error: 'Ugyldig sesjon' });

    const userId = userData.id;
    const email  = userData.email;

    // Slå opp i team_members med service key (bypasser RLS)
    const res = await fetch(
      `${SB}/rest/v1/team_members?select=owner_id&or=(member_id.eq.${userId},member_email.eq.${encodeURIComponent(email)})&limit=1`,
      { headers: { ...HDR, 'Prefer': 'return=representation' } }
    );
    const rows = res.ok ? await res.json() : [];
    const ownerId = rows[0]?.owner_id || null;

    if (!ownerId) return json(200, { isMember: false });

    // Hent eierens plan
    const subRes = await fetch(
      `${SB}/rest/v1/subscriptions?user_id=eq.${ownerId}&select=plan,status&limit=1`,
      { headers: { ...HDR, 'Prefer': 'return=representation' } }
    );
    const subs = subRes.ok ? await subRes.json() : [];
    const sub  = subs[0];
    const plan = (sub?.status === 'active' && sub?.plan !== 'gratis') ? sub.plan : 'familie';

    return json(200, { isMember: true, ownerId, plan });

  } catch (err) {
    console.error('check-membership error:', err);
    return json(500, { error: err.message });
  }
};
