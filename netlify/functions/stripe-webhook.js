// Bundly – Stripe Webhook Handler
// Lytter på Stripe-events og oppdaterer brukerens plan i Supabase
// Env vars required:
//   STRIPE_SECRET_KEY      – Stripe secret key
//   STRIPE_WEBHOOK_SECRET  – fra Stripe Dashboard → Webhooks → Signing secret
//   SUPABASE_URL           – Supabase project URL
//   SUPABASE_SERVICE_KEY   – Supabase service role key

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const SB_HEADERS = {
  'Content-Type':  'application/json',
  'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
  'apikey':        process.env.SUPABASE_SERVICE_KEY,
  'Prefer':        'return=representation',
};

async function upsertSubscription(userId, data) {
  const url = `${process.env.SUPABASE_URL}/rest/v1/subscriptions?user_id=eq.${userId}`;
  // Prøv update først
  const upd = await fetch(url, {
    method:  'PATCH',
    headers: SB_HEADERS,
    body:    JSON.stringify({ ...data, updated_at: new Date().toISOString() }),
  });
  const updData = await upd.json();
  // Hvis ingen rader ble oppdatert → insert
  if (Array.isArray(updData) && updData.length === 0) {
    await fetch(`${process.env.SUPABASE_URL}/rest/v1/subscriptions`, {
      method:  'POST',
      headers: SB_HEADERS,
      body:    JSON.stringify({ user_id: userId, ...data, updated_at: new Date().toISOString() }),
    });
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  // Verifiser at forespørselen faktisk kommer fra Stripe
  const sig = event.headers['stripe-signature'];
  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature feil:', err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  const data   = stripeEvent.data.object;
  const meta   = data.metadata || {};
  const userId = meta.user_id;

  console.log(`Stripe event: ${stripeEvent.type}, user_id: ${userId}`);

  try {
    switch (stripeEvent.type) {

      // ── Betaling gjennomført → aktiver abonnement
      case 'checkout.session.completed': {
        if (!userId) break;
        await upsertSubscription(userId, {
          plan:                    meta.plan    || 'starter',
          period:                  meta.period  || 'monthly',
          status:                  'active',
          stripe_customer_id:      data.customer,
          stripe_subscription_id:  data.subscription,
        });
        break;
      }

      // ── Fornyelse betalt → hold abonnementet aktivt
      case 'invoice.payment_succeeded': {
        const sub = await stripe.subscriptions.retrieve(data.subscription);
        const uid = sub.metadata?.user_id;
        if (!uid) break;
        await upsertSubscription(uid, {
          status:                 'active',
          stripe_customer_id:     data.customer,
          stripe_subscription_id: data.subscription,
        });
        break;
      }

      // ── Betaling feilet
      case 'invoice.payment_failed': {
        const sub = await stripe.subscriptions.retrieve(data.subscription);
        const uid = sub.metadata?.user_id;
        if (!uid) break;
        await upsertSubscription(uid, { status: 'past_due' });
        break;
      }

      // ── Abonnement avsluttet / kansellert
      case 'customer.subscription.deleted': {
        const uid = data.metadata?.user_id;
        if (!uid) break;
        await upsertSubscription(uid, {
          plan:   'gratis',
          status: 'cancelled',
          stripe_subscription_id: null,
        });
        break;
      }

      default:
        // Ignorer andre events
        break;
    }
  } catch (err) {
    console.error('Webhook handler error:', err);
    return { statusCode: 500, body: err.message };
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
