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

    // Hvis brukeren allerede finnes (ubekreftet fra tidligere invitasjon), slett og start på nytt
    const listRes  = await fetch(`${SB}/auth/v1/admin/users?page=1&per_page=1000`, { headers: HDR });
    const listData = listRes.ok ? await listRes.json() : {};
    const existing_user = (listData.users || []).find(u => u.email === email);
    if (existing_user && !existing_user.email_confirmed_at) {
      // Slett ubekreftet bruker så vi kan re-invitere
      await fetch(`${SB}/auth/v1/admin/users/${existing_user.id}`, { method: 'DELETE', headers: HDR });
      // Slett eventuell gammel team_members-rad
      await fetch(`${SB}/rest/v1/team_members?member_email=eq.${encodeURIComponent(email)}&owner_id=eq.${userId}`, {
        method: 'DELETE', headers: HDR,
      });
    } else if (existing_user && existing_user.email_confirmed_at) {
      return json(400, { error: 'Denne e-postadressen er allerede registrert som bruker' });
    }

    // Generer invitasjonslenke via Supabase
    const linkRes  = await fetch(`${SB}/auth/v1/admin/generate_link`, {
      method: 'POST',
      headers: HDR,
      body: JSON.stringify({ type: 'invite', email, redirect_to: 'https://bundly.no/app/oppussing/' }),
    });
    const linkText = await linkRes.text();
    let linkData = {};
    try { linkData = JSON.parse(linkText); } catch(e) {}

    if (!linkRes.ok) {
      console.error('generate_link error:', linkRes.status, linkText);
      return json(400, { error: `Supabase (${linkRes.status}): ${linkData.message || linkData.error || linkData.msg || linkText || 'Ukjent feil'}` });
    }

    const inviteLink = linkData.action_link || linkData.properties?.action_link || 'https://bundly.no/app/';
    const memberId   = linkData.id || null;

    // Send e-post via Resend
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from:    'Bundly <hei@bundly.no>',
        to:      email,
        subject: 'Du er invitert til Bundly! 🏠',
        html: `
          <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;background:#0d1117;border-radius:12px;overflow:hidden;border:1px solid #1e2530">
            <div style="background:#06080f;padding:32px;text-align:center;border-bottom:1px solid #1e2530">
              <div style="font-size:2.2rem;margin-bottom:8px">🏠</div>
              <h1 style="color:#fff;margin:0 0 6px;font-size:1.4rem;font-weight:700">Du er invitert til Bundly!</h1>
              <p style="color:#6366f1;margin:0;font-size:0.88rem;font-weight:500">Din smarte planlegger for boligprosjekter</p>
            </div>
            <div style="padding:32px">
              <p style="color:#cbd5e1;font-size:0.95rem;line-height:1.7;margin-top:0">Hei! Du har blitt invitert til å bruke Bundly.</p>
              <p style="color:#cbd5e1;font-size:0.95rem;line-height:1.7">Klikk på knappen nedenfor for å sette opp passordet ditt og komme i gang:</p>
              <div style="text-align:center;margin:32px 0">
                <a href="${inviteLink}" style="background:#6366f1;color:#fff;padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:600;font-size:1rem;display:inline-block">Kom i gang →</a>
              </div>
              <p style="color:#475569;font-size:0.8rem;text-align:center;margin-bottom:0">Lenken er gyldig i 24 timer.</p>
            </div>
          </div>`,
      }),
    });

    // Lagre i team_members
    await fetch(`${SB}/rest/v1/team_members`, {
      method: 'POST',
      headers: { ...HDR, 'Prefer': 'return=minimal' },
      body: JSON.stringify({
        owner_id:     userId,
        member_email: email,
        member_id:    memberId,
        status:       'invited',
      }),
    });

    return json(200, { ok: true });

  } catch (err) {
    console.error('invite-user error:', err);
    return json(500, { error: err.message });
  }
};
