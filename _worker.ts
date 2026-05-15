interface Env {
  WISHES_KV: KVNamespace;
  ASSETS: Fetcher;
}

interface WishRecord {
  id: string;
  text: string;
  hearts: number;
  createdAt: number;
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

async function getWishList(kv: KVNamespace): Promise<string[]> {
  const raw = await kv.get('wishlist');
  return raw ? JSON.parse(raw) : [];
}

async function saveWishList(kv: KVNamespace, list: string[]) {
  await kv.put('wishlist', JSON.stringify(list.slice(-100)));
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    // GET /api/wishes — 返回最近50条，按 hearts 降序
    if (pathname === '/api/wishes' && request.method === 'GET') {
      const list = await getWishList(env.WISHES_KV);
      const records = await Promise.all(
        list.map(id => env.WISHES_KV.get<WishRecord>(`wish:${id}`, 'json'))
      );
      const wishes = records
        .filter((w): w is WishRecord => w !== null)
        .sort((a, b) => b.hearts - a.hearts)
        .slice(0, 50);
      return json(wishes);
    }

    // POST /api/wishes — 创建愿望 { text }
    if (pathname === '/api/wishes' && request.method === 'POST') {
      let body: { text?: string };
      try { body = await request.json(); } catch { return json({ error: 'invalid json' }, 400); }
      const text = (body.text || '').trim().slice(0, 60);
      if (!text) return json({ error: 'text required' }, 400);

      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const wish: WishRecord = { id, text, hearts: 0, createdAt: Date.now() };
      await env.WISHES_KV.put(`wish:${id}`, JSON.stringify(wish));

      const list = await getWishList(env.WISHES_KV);
      list.push(id);
      await saveWishList(env.WISHES_KV, list);

      return json(wish, 201);
    }

    // POST /api/wishes/:id/heart — 爱心 +1
    const heartMatch = pathname.match(/^\/api\/wishes\/([^/]+)\/heart$/);
    if (heartMatch && request.method === 'POST') {
      const id = heartMatch[1];
      const wish = await env.WISHES_KV.get<WishRecord>(`wish:${id}`, 'json');
      if (!wish) return json({ error: 'not found' }, 404);
      wish.hearts += 1;
      await env.WISHES_KV.put(`wish:${id}`, JSON.stringify(wish));
      return json(wish);
    }

    // 其他请求 → 静态资源
    return env.ASSETS.fetch(request);
  },
};
