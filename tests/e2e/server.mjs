// Local test server: static site + Netlify functions + a small Supabase stand-in
// (auth + PostgREST subset) backed by the real local Postgres with the real schema and RLS.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import pg from 'pg';

const REPO = new URL('../..', import.meta.url).pathname.replace(/\/$/, '');
const PORT = Number(process.env.PORT || 8788);
const ORIGIN = `http://127.0.0.1:${PORT}`;
const SERVICE = 'sb_secret_test';  // new-style key: sent only as apikey
const ANON = 'anon-key';

export const state = { storeOn: true, emails: [] };
const pool = new pg.Pool({ host: process.env.PGHOST, port: process.env.PGPORT, user: 'postgres', database: process.env.E2E_DB || 'siaram_e2e' });

process.env.SUPABASE_URL = `${ORIGIN}/sb`;
process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE;
process.env.RESEND_API_KEY = 'resend-test';
process.env.ORDER_NOTIFY_EMAIL = 'customerservice@siaramjewelry.com';
process.env.SITE_URL = ORIGIN;

const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  if (String(url).startsWith('https://api.resend.com/')) {
    state.emails.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ id: 'email' }), { status: 200 });
  }
  return realFetch(url, init);
};

const functions = {};
for (const f of fs.readdirSync(`${REPO}/netlify/functions`)) {
  const mod = await import(`${REPO}/netlify/functions/${f}`);
  if (mod.config?.path) functions[mod.config.path] = mod.default;
}

// ---------------------------------------------------------------- auth stand-in
const passwords = new Map(); // email -> password
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function issueSession(user) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: user.id, email: user.email, role: 'authenticated', aud: 'authenticated', exp })}.sig`;
  return { access_token: token, token_type: 'bearer', expires_in: 3600, expires_at: exp,
           refresh_token: crypto.randomUUID(), user };
}
const refreshTokens = new Map();
function tokenUser(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    return payload.exp > Date.now() / 1000 ? payload : null;
  } catch { return null; }
}
const userJson = (row) => ({ id: row.id, email: row.email, aud: 'authenticated', role: 'authenticated',
  user_metadata: row.raw_user_meta_data || {}, app_metadata: {}, created_at: row.created_at,
  email_confirmed_at: row.created_at, last_sign_in_at: row.last_sign_in_at });

async function auth(req, res, url, body) {
  const route = url.pathname.replace('/sb/auth/v1', '');
  const bearer = (req.headers.authorization || '').replace('Bearer ', '');
  const send = (status, obj) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(obj === undefined ? '' : JSON.stringify(obj)); };

  if (route === '/signup' && req.method === 'POST') {
    try {
      const { rows: [row] } = await pool.query(
        'insert into auth.users (email, raw_user_meta_data, last_sign_in_at) values ($1, $2, now()) returning *',
        [body.email.toLowerCase(), body.data || {}]);
      passwords.set(row.email, body.password);
      const s = issueSession(userJson(row));
      refreshTokens.set(s.refresh_token, row.id);
      return send(200, s);
    } catch (e) {
      return send(500, { code: 500, error_code: 'unexpected_failure', msg: 'Database error saving new user' });
    }
  }
  if (route === '/token' && req.method === 'POST') {
    let row;
    if (url.searchParams.get('grant_type') === 'password') {
      if (passwords.get(body.email.toLowerCase()) !== body.password) {
        return send(400, { error: 'invalid_grant', error_description: 'Invalid login credentials' });
      }
      ({ rows: [row] } = await pool.query('update auth.users set last_sign_in_at = now() where email = $1 returning *', [body.email.toLowerCase()]));
    } else {
      const id = refreshTokens.get(body.refresh_token);
      ({ rows: [row] } = await pool.query('select * from auth.users where id = $1', [id || null]));
    }
    if (!row) return send(400, { error: 'invalid_grant', error_description: 'Invalid Refresh Token' });
    const s = issueSession(userJson(row));
    refreshTokens.set(s.refresh_token, row.id);
    return send(200, s);
  }
  if (route === '/user') {
    const claims = tokenUser(bearer);
    const { rows: [row] } = await pool.query('select * from auth.users where id = $1', [claims?.sub || null]);
    if (!row) return send(401, { msg: 'invalid JWT' });
    if (req.method === 'PUT' && body.password) passwords.set(row.email, body.password);
    return send(200, userJson(row));
  }
  if (route === '/logout') return send(204);
  if (route === '/recover') return send(200, {});
  const m = route.match(/^\/admin\/users\/([0-9a-f-]+)$/);
  if (m && req.method === 'DELETE' && req.headers.apikey === SERVICE) {
    await pool.query('delete from auth.users where id = $1', [m[1]]);
    return send(200, {});
  }
  return send(404, { msg: `auth route ${route} not in test stand-in` });
}

// ---------------------------------------------------------------- PostgREST stand-in
const ident = (s) => { if (!/^[a-z_]+$/.test(s)) throw new Error(`bad identifier ${s}`); return s; };

function selectList(table, select) {
  const parts = (select || '*').match(/(\w+\([^)]*\)|[^,]+)/g).map((s) => s.trim());
  return parts.map((p) => {
    const embed = p.match(/^(\w+)\(([^)]*)\)$/);
    if (!embed) return p === '*' ? 't.*' : `t.${ident(p)}`;
    const child = ident(embed[1]);
    const fk = `${table.replace(/s$/, '')}_id`;
    const cols = embed[2].split(',').map((c) => ident(c.trim()));
    return `(select coalesce(json_agg(json_build_object(${cols.map((c) => `'${c}', c.${c}`).join(', ')})), '[]')
             from public.${child} c where c.${fk} = t.id) as ${child}`;
  }).join(', ');
}

function whereClause(params, values) {
  const conds = [];
  for (const [k, v] of params) {
    if (['select', 'order', 'limit', 'columns'].includes(k)) continue;
    const m = v.match(/^eq\.(.*)$/);
    if (!m) throw new Error(`filter ${k}=${v} not in test stand-in`);
    values.push(m[1]);
    conds.push(`t.${ident(k)} = $${values.length}`);
  }
  return conds.length ? `where ${conds.join(' and ')}` : '';
}

async function withRole(req, fn) {
  const bearer = (req.headers.authorization || '').replace('Bearer ', '');
  const isService = req.headers.apikey === SERVICE;
  const client = await pool.connect();
  try {
    await client.query('begin');
    if (!isService) {
      const claims = bearer === ANON ? null : tokenUser(bearer);
      await client.query(`set local role ${claims ? 'authenticated' : 'anon'}`);
      await client.query("select set_config('request.jwt.claim.sub', $1, true)", [claims ? claims.sub : '']);
    }
    const out = await fn(client);
    await client.query('commit');
    return out;
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }
}

async function rest(req, res, url, body) {
  const send = (status, obj) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(obj === undefined ? '' : JSON.stringify(obj)); };
  const name = url.pathname.replace('/sb/rest/v1/', '');
  try {
    if (name.startsWith('rpc/')) {
      const fn = ident(name.slice(4));
      const args = Object.keys(body || {});
      const out = await withRole(req, async (c) => {
        const { rows: [info] } = await c.query('select proretset from pg_proc where proname = $1', [fn]);
        const call = `public.${fn}(${args.map((a, i) => `${ident(a)} => $${i + 1}`).join(', ')})`;
        const sql = info?.proretset ? `select coalesce(json_agg(x), '[]') as r from ${call} x` : `select to_json(${call}) as r`;
        const { rows: [row] } = await c.query(sql, args.map((a) => (body[a] !== null && typeof body[a] === 'object' ? JSON.stringify(body[a]) : body[a])));
        return row.r;
      });
      return send(200, out);
    }
    const table = ident(name);
    const values = [];
    if (req.method === 'GET') {
      const where = whereClause(url.searchParams, values);
      const order = url.searchParams.get('order');
      const orderSql = order ? `order by ${order.split(',').map((o) => { const [c, d] = o.split('.'); return `t.${ident(c)} ${d === 'desc' ? 'desc' : 'asc'}`; }).join(', ')}` : '';
      const rows = await withRole(req, async (c) => (await c.query(
        `select coalesce(json_agg(r), '[]') as r from (select ${selectList(table, url.searchParams.get('select'))} from public.${table} t ${where} ${orderSql}) r`, values)).rows[0].r);
      if ((req.headers.accept || '').includes('vnd.pgrst.object')) {
        if (rows.length !== 1) return send(406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: `The result contains ${rows.length} rows` });
        return send(200, rows[0]);
      }
      return send(200, rows);
    }
    if (req.method === 'POST') {
      const list = Array.isArray(body) ? body : [body];
      await withRole(req, async (c) => {
        for (const row of list) {
          const cols = Object.keys(row).map(ident);
          await c.query(`insert into public.${table} (${cols.join(', ')}) values (${cols.map((_, i) => `$${i + 1}`).join(', ')})`, cols.map((k) => row[k]));
        }
      });
      return send(201);
    }
    if (req.method === 'PATCH') {
      const cols = Object.keys(body).map(ident);
      cols.forEach((k) => values.push(body[k]));
      const sets = cols.map((k, i) => `${k} = $${i + 1}`).join(', ');
      const where = whereClause(url.searchParams, values);
      await withRole(req, (c) => c.query(`update public.${table} t set ${sets} ${where}`, values));
      return send(204);
    }
    if (req.method === 'DELETE') {
      const where = whereClause(url.searchParams, values);
      await withRole(req, (c) => c.query(`delete from public.${table} t ${where}`, values));
      return send(204);
    }
  } catch (e) {
    const status = e.code === '42501' ? 403 : 400;
    return send(status, { code: e.code, message: e.message, details: null, hint: null });
  }
  return send(405, {});
}

// ---------------------------------------------------------------- static + functions
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg', '.png': 'image/png', '.xml': 'application/xml', '.txt': 'text/plain' };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, ORIGIN);
  const chunks = [];
  for await (const ch of req) chunks.push(ch);
  const raw = Buffer.concat(chunks).toString();
  const body = raw ? JSON.parse(raw) : null;

  if (url.pathname === '/__state') {
    if (req.method === 'POST') Object.assign(state, body);
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify(state));
  }
  if (url.pathname.startsWith('/sb/auth/v1/')) return auth(req, res, url, body);
  if (url.pathname.startsWith('/sb/rest/v1/')) return rest(req, res, url, body);
  if (functions[url.pathname]) {
    const r = await functions[url.pathname](new Request(`${ORIGIN}${req.url}`, {
      method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : raw }));
    res.writeHead(r.status, Object.fromEntries(r.headers));
    return res.end(await r.text());
  }
  if (url.pathname === '/js/store-config.js' && state.storeOn) {
    res.writeHead(200, { 'content-type': 'text/javascript' });
    return res.end(`window.SIARAM_STORE = { supabaseUrl: '${ORIGIN}/sb', supabaseAnonKey: '${ANON}' };`);
  }
  const file = path.join(REPO, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname));
  if (!file.startsWith(REPO) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); return res.end('not found');
  }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

server.listen(PORT, '127.0.0.1', () => console.log(`test server on ${ORIGIN}`));
