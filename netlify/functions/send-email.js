// Bundly – Send e-post via Resend
// Actions: welcome, trial_reminder, trial_expired, receipt

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const FROM = 'Bundly <hei@bundly.no>';

// Delt header og footer for alle maler
const emailHeader = (emoji, title, subtitle, headerBg = '#1e5b5e') => `
  <div style="background:${headerBg};padding:36px 32px;text-align:center">
    <div style="font-size:1.6rem;margin-bottom:10px;color:#fff">${emoji}</div>
    <h1 style="color:#fff;margin:0 0 6px;font-size:1.3rem;font-weight:800;letter-spacing:-0.02em">${title}</h1>
    <p style="color:rgba(255,255,255,0.75);margin:0;font-size:0.85rem">${subtitle}</p>
  </div>`;

const emailFooter = () => `
  <div style="padding:20px 32px 28px;text-align:center;border-top:1px solid #f0ece4">
    <p style="color:#9a9a96;font-size:0.78rem;margin:0">
      ✦ Bundly · For livets store prosjekter<br>
      <a href="https://bundly.no" style="color:#9a9a96;text-decoration:none">bundly.no</a>
    </p>
  </div>`;

const ctaButton = (text, url) => `
  <div style="text-align:center;margin:28px 0">
    <a href="${url}" style="background:#1e5b5e;color:#fff;padding:13px 30px;border-radius:10px;text-decoration:none;font-weight:700;font-size:0.92rem;display:inline-block">${text}</a>
  </div>`;

const infoBox = (content) => `
  <div style="background:#f5f2e8;border-radius:10px;padding:20px 22px;margin:22px 0">
    ${content}
  </div>`;

const templates = {
  welcome: (data) => ({
    subject: 'Velkommen til Bundly ✦',
    html: `
      <div style="font-family:Inter,system-ui,sans-serif;max-width:560px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e8e4d8">
        ${emailHeader('✦', 'Velkommen til Bundly!', 'For livets store prosjekter')}
        <div style="padding:32px">
          <p style="color:#374151;font-size:0.95rem;line-height:1.7;margin-top:0">Hei${data.name ? ' ' + data.name : ''}! 👋</p>
          <p style="color:#374151;font-size:0.95rem;line-height:1.7">Du har nå 7 dager gratis tilgang til Bundly. Ingen kredittkort nødvendig — bare logg inn og begynn å planlegge.</p>
          ${infoBox(`
            <p style="margin:0 0 10px;font-weight:700;color:#1a1a1a;font-size:0.9rem">Hva kan du gjøre med Bundly?</p>
            <p style="margin:4px 0;color:#3d3d3d;font-size:0.86rem">✓ Planlegg oppussing, bryllup, hytte og mer</p>
            <p style="margin:4px 0;color:#3d3d3d;font-size:0.86rem">✓ Hold oversikt over budsjett og fremdrift</p>
            <p style="margin:4px 0;color:#3d3d3d;font-size:0.86rem">✓ Del prosjektet med familie eller team</p>
            <p style="margin:4px 0;color:#3d3d3d;font-size:0.86rem">✓ Diskusjon, bilder og dokumentarkiv på ett sted</p>
          `)}
          ${ctaButton('Gå til appen →', 'https://bundly.no/app/')}
          <p style="color:#9a9a96;font-size:0.8rem;text-align:center;margin-bottom:0">Prøveperioden varer i 7 dager. Etter det kan du velge en plan fra 29 kr/mnd.</p>
        </div>
        ${emailFooter()}
      </div>`
  }),

  trial_reminder: (data) => ({
    subject: `⏰ ${data.daysLeft} dager igjen av prøveperioden din`,
    html: `
      <div style="font-family:Inter,system-ui,sans-serif;max-width:560px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e8e4d8">
        ${emailHeader('⏰', `${data.daysLeft} dager igjen!`, 'Prøveperioden din utløper snart', '#b45309')}
        <div style="padding:32px">
          <p style="color:#374151;font-size:0.95rem;line-height:1.7;margin-top:0">Hei! Du har ${data.daysLeft} dager igjen av din gratis prøveperiode på Bundly.</p>
          <p style="color:#374151;font-size:0.95rem;line-height:1.7">Ikke mist tilgangen til prosjektene dine — velg en plan og fortsett der du slapp.</p>
          ${infoBox(`
            <p style="margin:0 0 8px;font-weight:700;color:#1a1a1a;font-size:0.9rem">Velg den planen som passer deg:</p>
            <p style="margin:4px 0;color:#3d3d3d;font-size:0.86rem"><strong>Enkel</strong> — 29 kr/mnd · 1 planlegger, 2 brukere</p>
            <p style="margin:4px 0;color:#3d3d3d;font-size:0.86rem"><strong>Familie</strong> — 99 kr/mnd · Alle planleggere, 5 brukere</p>
          `)}
          ${ctaButton('Velg en plan →', 'https://bundly.no/app/')}
          <p style="color:#9a9a96;font-size:0.8rem;text-align:center;margin-bottom:0">Ingen bindingstid · Avbestill når som helst</p>
        </div>
        ${emailFooter()}
      </div>`
  }),

  trial_expired: (data) => ({
    subject: 'Prøveperioden din er over — ikke mist prosjektene dine',
    html: `
      <div style="font-family:Inter,system-ui,sans-serif;max-width:560px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e8e4d8">
        ${emailHeader('🔒', 'Prøveperioden er over', 'Oppgrader for å fortsette', '#dc2626')}
        <div style="padding:32px">
          <p style="color:#374151;font-size:0.95rem;line-height:1.7;margin-top:0">Din 7-dagers prøveperiode på Bundly er nå over.</p>
          <p style="color:#374151;font-size:0.95rem;line-height:1.7">Prosjektene dine er trygt lagret — du trenger bare å velge en plan for å få tilgang igjen.</p>
          ${infoBox(`
            <p style="margin:0 0 8px;font-weight:700;color:#1a1a1a;font-size:0.9rem">Kom i gang igjen fra:</p>
            <p style="margin:4px 0;color:#3d3d3d;font-size:0.86rem">✓ <strong>29 kr/mnd</strong> — Enkel plan</p>
            <p style="margin:4px 0;color:#3d3d3d;font-size:0.86rem">✓ <strong>99 kr/mnd</strong> — Familie (alle planleggere)</p>
            <p style="margin:6px 0 0;color:#9a9a96;font-size:0.8rem">Ingen bindingstid · Data beholdes</p>
          `)}
          ${ctaButton('Oppgrader nå →', 'https://bundly.no/app/')}
        </div>
        ${emailFooter()}
      </div>`
  }),

  receipt: (data) => ({
    subject: `Kvittering — Bundly ${data.plan}`,
    html: `
      <div style="font-family:Inter,system-ui,sans-serif;max-width:560px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e8e4d8">
        ${emailHeader('✓', 'Takk for kjøpet!', `Bundly ${data.plan}`, '#16a34a')}
        <div style="padding:32px">
          <p style="color:#374151;font-size:0.95rem;line-height:1.7;margin-top:0">Du har nå full tilgang til Bundly ${data.plan}. Her er en oppsummering av kjøpet:</p>
          ${infoBox(`
            <table style="width:100%;border-collapse:collapse">
              <tr>
                <td style="color:#6b6b6b;font-size:0.86rem;padding:5px 0">Plan</td>
                <td style="color:#1a1a1a;font-weight:700;font-size:0.86rem;text-align:right">Bundly ${data.plan}</td>
              </tr>
              <tr>
                <td style="color:#6b6b6b;font-size:0.86rem;padding:5px 0">Periode</td>
                <td style="color:#1a1a1a;font-weight:700;font-size:0.86rem;text-align:right">${data.period === 'yearly' ? 'Årlig' : 'Månedlig'}</td>
              </tr>
              <tr style="border-top:1px solid #e8e4d8">
                <td style="color:#6b6b6b;font-size:0.86rem;padding:8px 0 3px">Beløp</td>
                <td style="color:#1e5b5e;font-weight:800;font-size:1rem;text-align:right;padding:8px 0 3px">${data.amount || ''} kr</td>
              </tr>
            </table>
          `)}
          ${ctaButton('Gå til appen →', 'https://bundly.no/app/')}
          <p style="color:#9a9a96;font-size:0.8rem;text-align:center;margin-bottom:0">Spørsmål? Svar på denne e-posten eller kontakt oss på hei@bundly.no</p>
        </div>
        ${emailFooter()}
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
