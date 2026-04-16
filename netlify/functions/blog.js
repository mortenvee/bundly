// Bundly – Blog API
// Runs server-side on Netlify. Uses SUPABASE_SERVICE_KEY (never exposed to browser).
// Env vars required in Netlify dashboard:
//   SUPABASE_URL         – e.g. https://xxxx.supabase.co
//   SUPABASE_SERVICE_KEY – service_role key (Settings → API)
//   ADMIN_SECRET         – same value as your admin panel password

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type, x-admin-secret',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

exports.handler = async (event) => {
  // ── Preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS };
  }

  const json = (statusCode, body) => ({
    statusCode,
    headers: { ...CORS, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  // ── Auth
  const secret = event.headers['x-admin-secret'];
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return json(401, { error: 'Unauthorized' });
  }

  // ── Supabase config
  const BASE = `${process.env.SUPABASE_URL}/rest/v1/blog_posts`;
  const SB   = {
    'Content-Type':  'application/json',
    'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
    'apikey':        process.env.SUPABASE_SERVICE_KEY,
    'Prefer':        'return=representation',
  };

  try {
    // ── GET – list all posts (admin sees drafts too)
    if (event.httpMethod === 'GET') {
      const res  = await fetch(`${BASE}?select=*&order=date.desc,created_at.desc`, { headers: SB });
      const data = await res.json();
      return json(res.ok ? 200 : res.status, data);
    }

    // ── POST – create new post
    if (event.httpMethod === 'POST') {
      const { id, created_at, ...post } = JSON.parse(event.body || '{}');
      const res  = await fetch(BASE, { method: 'POST', headers: SB, body: JSON.stringify(post) });
      const data = await res.json();
      return json(res.ok ? 201 : res.status, data);
    }

    // ── PUT – update existing post
    if (event.httpMethod === 'PUT') {
      const { id, created_at, ...post } = JSON.parse(event.body || '{}');
      if (!id) return json(400, { error: 'Missing id' });
      const res  = await fetch(`${BASE}?id=eq.${id}`, { method: 'PATCH', headers: SB, body: JSON.stringify(post) });
      const data = await res.json();
      return json(res.ok ? 200 : res.status, data);
    }

    // ── DELETE – remove post
    if (event.httpMethod === 'DELETE') {
      const id = (event.queryStringParameters || {}).id;
      if (!id) return json(400, { error: 'Missing id' });
      const res = await fetch(`${BASE}?id=eq.${id}`, { method: 'DELETE', headers: SB });
      return { statusCode: 204, headers: CORS, body: '' };
    }

    return json(405, { error: 'Method not allowed' });

  } catch (err) {
    console.error('Blog function error:', err);
    return json(500, { error: err.message });
  }
};
