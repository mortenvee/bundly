// Bundly – Bruker-initiert invitasjon
// Verifiserer JWT, sjekker plan-grenser, lagrer i team_members

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
    const { email } = JSON.parse(event.body || '{}');
    if (!email) return json(400, { error: 'Mangler e-postadresse' });

    // Verifiser JWT
    const authHeader = event.headers['authorization'] || '';
    const userToken  = authHeader.replace('Bearer ', '');
    if (!userToken) return json(401, { error: 'Ikke innlogget' });

    const userRes  = await fetch(`${SB}/auth/v1/user`, {
      headers: { 'Authorization': `Bearer ${userToken}`, 'apikey': KEY },
    });
    const userText = await userRes.text();
    let userData = {};
    try { userData = JSON.parse(userText); } catch(e) {}
    if (!userRes.ok || !userData.id) return json(401, { error: 'Ugyldig sesjon' });
    const userId = userData.id;

    // Hent plan
    const subRes = await fetch(`${SB}/rest/v1/subscriptions?user_id=eq.${userId}&select=plan,status`, {
      headers: { ...HDR, 'Prefer': 'return=representation' },
    });
    const subs = await subRes.json();
    const sub  = subs?.[0];

    const created    = new Date(userData.created_at);
    const daysUsed   = Math.floor((Date.now() - created) / 86400000);
    const inTrial    = daysUsed < 7;
    const hasPlan    = sub && sub.status === 'active' && sub.plan !== 'gratis';
    const plan       = hasPlan ? sub.plan : (inTrial ? 'trial' : 'gratis');
    const maxMembers = PLAN_LIMITS[plan] ?? 0;

    if (maxMembers === 0) return json(403, {
      error: plan === 'trial' || plan === 'gratis' || plan === 'starter'
        ? 'Invitasjoner krever Familie- eller Team-plan'
        : 'Du har nådd grensen for antall medlemmer'
    });

    // Sjekk antall eksisterende medlemmer
    const existRes = await fetch(`${SB}/rest/v1/team_members?owner_id=eq.${userId}&select=id`, {
      headers: { ...HDR, 'Prefer': 'return=representation' },
    });
    const existing = existRes.ok ? await existRes.json() : [];
    if (existing.length >= maxMembers) return json(403, {
      error: `Du har nådd grensen på ${maxMembers} medlemmer for ${plan}-planen`
    });

    // Send invitasjon via Supabase Admin
    const inviteRes = await fetch(`${SB}/auth/v1/admin/users`, {
      method: 'POST',
      headers: HDR,
      body: JSON.stringify({ email, email_confirm: false }),
    });

    const inviteText = await inviteRes.text();
    let inviteData = {};
    try { inviteData = JSON.parse(inviteText); } catch(e) {}

    if (!inviteRes.ok) {
      return json(400, { error: inviteData.message || inviteData.error || 'Kunne ikke sende invitasjon' });
    }

    // Lagre i team_members
    await fetch(`${SB}/rest/v1/team_members`, {
      method: 'POST',
      headers: { ...HDR, 'Prefer': 'return=minimal' },
      body: JSON.stringify({
        owner_id:     userId,
        member_email: email,
        member_id:    inviteData.id || null,
        status:       'invited',
      }),
    });

    return json(200, { ok: true });

  } catch (err) {
    console.error('invite-user error:', err);
    return json(500, { error: err.message });
  }
};
