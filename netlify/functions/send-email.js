// Bundly – Send e-post via Resend
// Actions: welcome, trial_reminder, trial_expired, receipt

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const FROM = 'Bundly <onboarding@resend.dev>'; // bytt til hei@bundly.no når domenet er verifisert i Resend

const templates = {
  welcome: (data) => ({
    subject: 'Velkommen til Bundly! 🏠',
    html: `
      <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
        <div style="background:#6366f1;padding:32px;text-align:center">
          <div style="font-size:2rem">🏠</div>
          <h1 style="color:#fff;margin:12px 0 4px;font-size:1.4rem">Velkommen til Bundly!</h1>
          <p style="color:rgba(255,255,255,0.8);margin:0;font-size:0.9rem">Din smarte planlegger for boligprosjekter</p>
        </div>
        <div style="padding:32px">
          <p style="color:#374151;font-size:0.95rem;line-height:1.6">Hei ${data.name || ''}! 👋</p>
          <p style="color:#374151;font-size:0.95rem;line-height:1.6">Du har nå 7 dager gratis tilgang til alle Bundly sine planleggere. Ingen kredittkort nødvendig.</p>
          <div style="background:#f5f7fc;border-radius:8px;padding:20px;margin:24px 0">
            <p style="margin:0 0 8px;font-weight:600;color:#1e1e2e">Hva kan du gjøre med Bundly?</p>
            <p style="margin:4px 0;color:#64748b;font-size:0.88rem">✅ Planlegg oppussing, hytte, bryllup og mer</p>
            <p style="margin:4px 0;color:#64748b;font-size:0.88rem">✅ Hold oversikt over budsjett og tidsplan</p>
            <p style="margin:4px 0;color:#64748b;font-size:0.88rem">✅ Del prosjektet med familie eller team</p>
          </div>
          <div style="text-align:center;margin:28px 0">
            <a href="https://bundly.no/app/" style="background:#6366f1;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:0.95rem">Gå til appen →</a>
          </div>
          <p style="color:#94a3b8;font-size:0.82rem;text-align:center">Prøveperioden varer i 7 dager. Etter det kan du velge en plan fra 29 kr/mnd.</p>
        </div>
      </div>`
  }),

  trial_reminder: (data) => ({
    subject: `⏰ ${data.daysLeft} dager igjen av prøveperioden din`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
        <div style="background:#f59e0b;padding:32px;text-align:center">
          <div style="font-size:2rem">⏰</div>
          <h1 style="color:#fff;margin:12px 0 4px;font-size:1.4rem">${data.daysLeft} dager igjen!</h1>
          <p style="color:rgba(255,255,255,0.9);margin:0;font-size:0.9rem">Prøveperioden din utløper snart</p>
        </div>
        <div style="padding:32px">
          <p style="color:#374151;font-size:0.95rem;line-height:1.6">Hei! Du har ${data.daysLeft} dager igjen av din gratis prøveperiode på Bundly.</p>
          <p style="color:#374151;font-size:0.95rem;line-height:1.6">Ikke mist tilgangen til prosjektene dine — velg en plan og fortsett der du slapp.</p>
          <div style="text-align:center;margin:28px 0">
            <a href="https://bundly.no/app/" style="background:#6366f1;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:0.95rem">Velg en plan →</a>
          </div>
          <p style="color:#94a3b8;font-size:0.82rem;text-align:center">Starter fra 29 kr/mnd · Ingen bindingstid</p>
        </div>
      </div>`
  }),

  trial_expired: (data) => ({
    subject: 'Prøveperioden din er over — ikke mist prosjektene dine',
    html: `
      <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
        <div style="background:#ef4444;padding:32px;text-align:center">
          <div style="font-size:2rem">🔒</div>
          <h1 style="color:#fff;margin:12px 0 4px;font-size:1.4rem">Prøveperioden er over</h1>
          <p style="color:rgba(255,255,255,0.9);margin:0;font-size:0.9rem">Oppgrader for å fortsette</p>
        </div>
        <div style="padding:32px">
          <p style="color:#374151;font-size:0.95rem;line-height:1.6">Din 7-dagers prøveperiode på Bundly er nå over. Prosjektene dine er trygt lagret — du trenger bare å velge en plan for å få tilgang igjen.</p>
          <div style="text-align:center;margin:28px 0">
            <a href="https://bundly.no/app/" style="background:#6366f1;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:0.95rem">Oppgrader nå →</a>
          </div>
          <p style="color:#94a3b8;font-size:0.82rem;text-align:center">Starter fra 29 kr/mnd · Ingen bindingstid · Data beholdes</p>
        </div>
      </div>`
  }),

  receipt: (data) => ({
    subject: `Kvittering — Bundly ${data.plan}`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
        <div style="background:#10b981;padding:32px;text-align:center">
          <div style="font-size:2rem">✅</div>
          <h1 style="color:#fff;margin:12px 0 4px;font-size:1.4rem">Takk for kjøpet!</h1>
          <p style="color:rgba(255,255,255,0.9);margin:0;font-size:0.9rem">Bundly ${data.plan}</p>
        </div>
        <div style="padding:32px">
          <p style="color:#374151;font-size:0.95rem;line-height:1.6">Du har nå tilgang til Bundly ${data.plan}. Her er en oppsummering:</p>
          <div style="background:#f5f7fc;border-radius:8px;padding:20px;margin:20px 0">
            <div style="display:flex;justify-content:space-between;margin-bottom:8px">
              <span style="color:#64748b;font-size:0.88rem">Plan</span>
              <span style="color:#1e1e2e;font-weight:600;font-size:0.88rem">Bundly ${data.plan}</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:8px">
              <span style="color:#64748b;font-size:0.88rem">Periode</span>
              <span style="color:#1e1e2e;font-weight:600;font-size:0.88rem">${data.period === 'yearly' ? 'Årlig' : 'Månedlig'}</span>
            </div>
            <div style="display:flex;justify-content:space-between">
              <span style="color:#64748b;font-size:0.88rem">Beløp</span>
              <span style="color:#1e1e2e;font-weight:600;font-size:0.88rem">${data.amount || ''} kr</span>
            </div>
          </div>
          <div style="text-align:center;margin:28px 0">
            <a href="https://bundly.no/app/" style="background:#6366f1;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:0.95rem">Gå til appen →</a>
          </div>
        </div>
      </div>`
  }),
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS };

  const json = (code, body) => ({
    statusCode: code,
    headers: { ...CORS, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  try {
    const { type, email, data = {} } = JSON.parse(event.body || '{}');
    if (!type || !email) return json(400, { error: 'Mangler type eller email' });

    const template = templates[type];
    if (!template) return json(400, { error: 'Ukjent e-posttype' });

    const { subject, html } = template(data);

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: FROM, to: email, subject, html }),
    });

    const result = await res.json();
    if (!res.ok) return json(400, { error: result.message || 'Feil ved sending' });
    return json(200, { ok: true, id: result.id });

  } catch (err) {
    console.error('send-email error:', err);
    return json(500, { error: err.message });
  }
};
