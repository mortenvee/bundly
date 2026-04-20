// Bundly – Fjern teammedlem

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
    const authHeader = event.headers['authorization'] || '';
    const userToken  = authHeader.replace('Bearer ', '');
    if (!userToken) return json(401, { error: 'Ikke innlogget' });

    const userRes  = await fetch(`${SB}/auth/v1/user`, {
      headers: { 'Authorization': `Bearer ${userToken}`, 'apikey': KEY },
    });
    const userData = await userRes.json();
    if (!userRes.ok || !userData.id) return json(401, { error: 'Ugyldig sesjon' });
    const ownerId = userData.id;

    const { memberId } = JSON.parse(event.body || '{}');
    if (!memberId) return json(400, { error: 'Mangler memberId' });

    // Slett kun hvis eier
    const delRes = await fetch(`${SB}/rest/v1/team_members?id=eq.${memberId}&owner_id=eq.${ownerId}`, {
      method: 'DELETE',
      headers: HDR,
    });

    if (!delRes.ok && delRes.status !== 204) return json(400, { error: 'Kunne ikke fjerne medlem' });
    return json(200, { ok: true });

  } catch (err) {
    console.error('remove-member error:', err);
    return json(500, { error: err.message });
  }
};
