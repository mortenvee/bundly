// Bundly – Løs inn invitasjonskode
// Verifiserer kode + e-post, oppretter bruker, kobler til team

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type',
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
    const { email, code, password } = JSON.parse(event.body || '{}');
    if (!email || !code || !password) return json(400, { error: 'Mangler e-post, kode eller passord' });
    if (password.length < 6) return json(400, { error: 'Passordet må være minst 6 tegn' });

    const normalizedCode = code.trim().toUpperCase();

    // Slå opp invitasjonen
    const invRes = await fetch(
      `${SB}/rest/v1/team_members?member_email=eq.${encodeURIComponent(email)}&invite_code=eq.${normalizedCode}&status=eq.invited&select=id,owner_id`,
      { headers: { ...HDR, 'Prefer': 'return=representation' } }
    );
    const invites = invRes.ok ? await invRes.json() : [];
    if (!invites.length) return json(400, { error: 'Ugyldig kode eller e-postadresse' });

    const invite = invites[0];

    // Opprett bruker via Supabase Admin
    const createRes = await fetch(`${SB}/auth/v1/admin/users`, {
      method: 'POST',
      headers: HDR,
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,  // hopp over e-postbekreftelse
      }),
    });
    const createText = await createRes.text();
    let createData = {};
    try { createData = JSON.parse(createText); } catch(e) {}

    // Hvis brukeren allerede finnes, hent eksisterende ID
    let memberId = createData.id;
    if (!createRes.ok) {
      if (createData.message?.includes('already') || createData.code === 'email_exists') {
        // Finn eksisterende bruker
        const listRes  = await fetch(`${SB}/auth/v1/admin/users?page=1&per_page=1000`, { headers: HDR });
        const listData = listRes.ok ? await listRes.json() : {};
        const existing = (listData.users || []).find(u => u.email === email);
        if (existing) {
          memberId = existing.id;
          // Oppdater passordet
          await fetch(`${SB}/auth/v1/admin/users/${memberId}`, {
            method: 'PUT',
            headers: HDR,
            body: JSON.stringify({ password }),
          });
        } else {
          return json(400, { error: createData.message || 'Kunne ikke opprette bruker' });
        }
      } else {
        return json(400, { error: createData.message || 'Kunne ikke opprette bruker' });
      }
    }

    // Oppdater team_members: sett member_id og status=active
    await fetch(`${SB}/rest/v1/team_members?id=eq.${invite.id}`, {
      method: 'PATCH',
      headers: { ...HDR, 'Prefer': 'return=minimal' },
      body: JSON.stringify({ member_id: memberId, status: 'active' }),
    });

    // Logg inn brukeren og returner sesjon
    const signInRes = await fetch(`${SB}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { ...HDR, 'apikey': process.env.SUPABASE_ANON_KEY || KEY },
      body: JSON.stringify({ email, password }),
    });
    const signInData = signInRes.ok ? await signInRes.json() : {};

    return json(200, {
      ok: true,
      access_token:  signInData.access_token,
      refresh_token: signInData.refresh_token,
    });

  } catch (err) {
    console.error('redeem-invite error:', err);
    return json(500, { error: err.message });
  }
};
