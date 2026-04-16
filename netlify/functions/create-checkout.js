// Bundly – Create Stripe Checkout Session
// Env vars required:
//   STRIPE_SECRET_KEY   – Stripe secret key (sk_live_... eller sk_test_...)
//   SUPABASE_URL        – Supabase project URL
//   SUPABASE_SERVICE_KEY – Supabase service role key

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// ── Pris-IDer fra Stripe Dashboard (Products → priser)
// Bytt ut disse med dine egne price_xxx IDer
const PRICES = {
  starter: {
    monthly: process.env.PRICE_STARTER_MONTHLY,
    yearly:  process.env.PRICE_STARTER_YEARLY,
  },
  familie: {
    monthly: process.env.PRICE_FAMILIE_MONTHLY,
    yearly:  process.env.PRICE_FAMILIE_YEARLY,
  },
  team: {
    monthly: process.env.PRICE_TEAM_MONTHLY,
    yearly:  process.env.PRICE_TEAM_YEARLY,
  },
};

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const json = (code, body) => ({
    statusCode: code,
    headers: { ...CORS, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  try {
    const { plan, period, userId, email } = JSON.parse(event.body || '{}');

    if (!plan || !period) return json(400, { error: 'Mangler plan eller periode' });
    if (!PRICES[plan]?.[period]) return json(400, { error: `Ukjent plan/periode: ${plan}/${period}` });

    const priceId = PRICES[plan][period];
    const siteUrl = 'https://bundly.no';

    const session = await stripe.checkout.sessions.create({
      mode:       'subscription',
      line_items: [{ price: priceId, quantity: 1 }],

      // Knytt Supabase-brukeren til Stripe via metadata
      metadata:             { user_id: userId || '', plan, period },
      subscription_data:    { metadata: { user_id: userId || '', plan, period } },

      // Forhåndsutfyll e-post hvis vi har den
      ...(email ? { customer_email: email } : {}),

      // Valuta og lokale innstillinger
      locale: 'nb',

      success_url: `${siteUrl}/app/?checkout=success&plan=${plan}`,
      cancel_url:  `${siteUrl}/#pris`,
    });

    return json(200, { url: session.url });

  } catch (err) {
    console.error('Checkout error:', err);
    return json(500, { error: err.message });
  }
};
