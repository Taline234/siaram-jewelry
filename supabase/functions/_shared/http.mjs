// The website (siaramjewelry.com) calls these functions on supabase.co, so every response allows
// cross-origin requests. No cookies are used: signed-in customers send their token in a header.
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type, apikey, x-client-info',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-expose-headers': 'content-disposition',
};

export function withCors(handler) {
  return async (req) => {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    const res = await handler(req);
    const headers = new Headers(res.headers);
    for (const [k, v] of Object.entries(CORS)) headers.set(k, v);
    return new Response(res.body, { status: res.status, headers });
  };
}
