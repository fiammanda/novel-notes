import { Hono } from "hono";
import { etag } from "hono/etag";
import { getCookie, setCookie } from "hono/cookie";
import { blob } from "#lib/blob.js";
import { redis } from "#lib/redis.js";
import { parse } from "#lib/sites.js";

const app = new Hono();

app.use("/*", async (c, next) => {
  const ref = c.req.header("referer");
  const cookie = getCookie(c, "admin") === process.env.ADMIN_COOKIE;
  const secret = c.req.header("authorization") === `Bearer ${process.env.CRON_SECRET}`;
  c.set("auth", cookie ? "cookie" : secret ? "secret" : false);
  c.set("same-site", URL.canParse(ref) && new URL(ref).origin === new URL(c.req.url).origin);
  await next();
});

app.get("/data.js", etag(), async (c) => {
  if (!c.get("same-site")) return c.notFound();
  const auth = c.get("auth");
  const data = await redis.get("data");
  c.header("Vary", "Cookie");
  c.header("Content-Type", "application/javascript; charset=UTF-8");
  auth
    ? c.header("Cache-Control", "private, max-age=60")
    : c.header("Cache-Control", "public, max-age=60, s-maxage=86400, stale-while-revalidate=86400");
  return c.body(`window.AUTH=${JSON.stringify(auth)};window.DATA=${JSON.stringify(Object.values(data).sort((a, b) => b.update.localeCompare(a.update)))};`);
});

app.get("/api/logs", async (c) => {
  if (!c.get("auth")) return c.notFound();
  const ua = c.req.header("user-agent") || "";
  const hash = await redis.get("logs");
  const logs = Object.entries(hash).reverse();

  c.header("Vary", "Cookie");
  c.header("Cache-Control", "public, max-age=60, s-maxage=36000, stale-while-revalidate=36000");

  if (/iP(hone|od|ad)/.test(ua)) {
    const html = `<!DOCTYPE html><html>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, interactive-widget=resizes-content" />
        <link rel="icon" href="/favicon.png" type="image/png" />
        <link rel="stylesheet" href="/style.css" />
        <style>
          :root { color-scheme: light dark; }
          body { font: .875rem/1 var(--font-mono); color: CanvasText; background: Canvas; }
          table { width: 100%; border-spacing: 0; }
          thead { position: sticky; top: 0; background: color-mix(in srgb, Canvas 20%, transparent); backdrop-filter: blur(.25rem); }
          th { font-weight: 400; text-align: left; }
          th, td { padding: .5em; border-bottom: 1px solid color-mix(in srgb, CanvasText 20%, transparent); }
        </style>
      </head>
      <body>
        <table>
          <thead><tr><th>timestamp</th><th>message</th></tr></thead>
          <tbody>${logs.map(([date, text]) => `<tr><td>${date}</td><td>${text}</td></tr>`).join("")}</tbody>
        </table>
      </body>
    </html>`;
    return c.html(html.replace(/\n\s+/g, ""));
  }

  return c.json(Object.fromEntries(logs));
});

app.get("/api/data/update", async (c) => {
  const auth = c.get("auth");
  if (!auth) return c.notFound();

  const offset = Number(c.req.query("offset") || 0);
  const hash = await redis.get("data");
  let list = Object.values(hash);
  let text = list.length;

  if (auth === "secret") {
    const date = new Date().getDate();
    const hour = new Date().getHours();
    list = list.filter(({ status, progress }) =>
      date === 5 && hour < 12 ||
      status === "连载" && progress === "观望" && date % 5 === 0 && hour < 12 ||
      status === "连载" && progress === "追读"
    );
  }

  text = list.length + " (" + text + ")"
  list = list.slice(offset, offset + 25);

  if (!list.length) {
    await redis.log(`updated: 0/${text}`);
    return c.json({ updated: `0/${text}` });
  }

  const resp = await parse(list.map(({ url }) => url), true);
  const data = resp.data.map(({ id, ...rest }) => [id, { ...hash[id], ...rest }]);
  await redis.set(data);

  const next = offset + 25;
  if (next < list.length) {
    const url = `${new URL(c.req.url).origin}/api/data/update?offset=${next}`;
    await fetch(`https://qstash-us-east-1.upstash.io/v2/publish/${encodeURIComponent(url)}`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.QSTASH_TOKEN}`,
        "Upstash-Forward-Authorization": `Bearer ${process.env.CRON_SECRET}`
      }
    });
  }

  await redis.log(`updated: ${list.length}/${text}`);
  return c.json({ updated: `${list.length}/${text}` });
});

app.post("/api/data/meta", async (c) => {
  if (!c.get("auth")) return c.json({ error: "Unauthorized" }, 401);
  const list = await c.req.json();
  return c.json(await parse(list));
});

app.post("/api/data", async (c) => {
  if (!c.get("auth")) return c.json({ error: "Unauthorized" }, 401);
  const list = await c.req.json();
  const novel = list.map(({ upload, ...book }) => [book.id, book]);
  const cover = list.filter(({ upload }) => upload).map(({ id, url, upload }) => ({ id, url, upload }));
  const error = [ await redis.set(novel) ];
  let data = error[0].msg
     ? "发生错误"
     : `${error.pop() ? "创建" : "更新"} ${list.length} 条记录`;
  if (cover.length && !error.length) {
    const res = await blob.put(cover);
    const len = cover.length - res.error.length;
    if (len) data += `　上传 ${len} 张封面`;
    if (res.error.length) error.push(...res.error);
  }
  return c.json({ data, errs: error });
});

app.post("/api/auth", async (c) => {
  const { passcode } = await c.req.json();
  if (passcode !== process.env.ADMIN_PASSCODE) return c.json({ success: false }, 401);
  setCookie(c, "admin", process.env.ADMIN_COOKIE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Lax",
    path: "/",
    maxAge: 31536000,
  });
  return c.json({ success: true });
});

export default app;