// Bundly – Bruker-initiert invitasjon
// Verifiserer JWT, sjekker plan-grenser, lagrer i team_members med invitasjonskode

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const PLAN_LIMITS = { trial: 0, gratis: 0, starter: 0, familie: 4, team: 14 };

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // unngår 0/O og 1/I
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

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

    // Slett eventuell gammel invitasjon for samme e-post
    await fetch(`${SB}/rest/v1/team_members?member_email=eq.${encodeURIComponent(email)}&owner_id=eq.${userId}&status=eq.invited`, {
      method: 'DELETE', headers: HDR,
    });

    // Generer invitasjonskode
    const inviteCode = generateCode();

    // Lagre i team_members
    const insertRes = await fetch(`${SB}/rest/v1/team_members`, {
      method: 'POST',
      headers: { ...HDR, 'Prefer': 'return=minimal' },
      body: JSON.stringify({
        owner_id:     userId,
        owner_email:  userData.email,
        member_email: email,
        member_id:    null,
        status:       'invited',
        invite_code:  inviteCode,
      }),
    });
    if (!insertRes.ok) {
      const errText = await insertRes.text();
      return json(400, { error: 'Kunne ikke opprette invitasjon: ' + errText });
    }

    // Lag en pen visningsnavn for eier (bruk del før @ i e-posten)
    const ownerName = userData.email?.split('@')[0] || userData.email || 'en annen bruker';

    // Send e-post med koden via Resend
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from:    'Bundly <hei@bundly.no>',
        to:      email,
        subject: `${ownerName} har invitert deg til Bundly 🏠`,
        html: `
          <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;background:#0d1117;border-radius:12px;overflow:hidden;border:1px solid #1e2530">
            <div style="background:#06080f;padding:32px;text-align:center;border-bottom:1px solid #1e2530">
              <div style="font-size:2.2rem;margin-bottom:8px">🏠</div>
              <h1 style="color:#fff;margin:0 0 6px;font-size:1.4rem;font-weight:700">Du er invitert til Bundly!</h1>
              <p style="color:#6366f1;margin:0;font-size:0.88rem;font-weight:500">Din smarte planlegger for boligprosjekter</p>
            </div>
            <div style="padding:32px">
              <p style="color:#cbd5e1;font-size:0.95rem;line-height:1.7;margin-top:0">
                Hei! <strong style="color:#fff">${userData.email}</strong> har invitert deg til sitt team på Bundly.<br>
                Du får tilgang til deres prosjekter — ingen betaling nødvendig.
              </p>
              <p style="color:#cbd5e1;font-size:0.95rem;line-height:1.7">Bruk invitasjonskoden nedenfor for å opprette kontoen din:</p>
              <div style="text-align:center;margin:32px 0">
                <div style="background:#1e2530;border:2px dashed #6366f1;border-radius:12px;padding:24px;display:inline-block">
                  <div style="color:#94a3b8;font-size:0.78rem;font-weight:600;text-transform:uppercase;letter-spacing:.1em;margin-bottom:10px">Din invitasjonskode</div>
                  <div style="color:#fff;font-size:2.2rem;font-weight:800;letter-spacing:.3em;font-variant-numeric:tabular-nums">${inviteCode}</div>
                </div>
              </div>
              <p style="color:#cbd5e1;font-size:0.9rem;line-height:1.7;text-align:center">
                Gå til <a href="https://bundly.no/app/" style="color:#6366f1">bundly.no/app</a> og velg <strong style="color:#fff">«Invitasjonskode»</strong> for å aktivere kontoen.
              </p>
              <p style="color:#475569;font-size:0.8rem;text-align:center;margin-top:24px;margin-bottom:0">Koden utløper ikke — ta den i bruk når det passer deg.</p>
            </div>
          </div>`,
      }),
    });

    return json(200, { ok: true });

  } catch (err) {
    console.error('invite-user error:', err);
    return json(500, { error: err.message });
  }
};
