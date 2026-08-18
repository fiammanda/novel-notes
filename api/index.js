import { Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { scrape } from "#src/scraper.js";
import { db } from "#src/supabase.js";

const app = new Hono();

app.use("/*", async (c, next) => {
  const ref = c.req.header("referer");
  const cookie = getCookie(c, "admin") === process.env.ADMIN_COOKIE;
  const secret = c.req.header("authorization") === `Bearer ${process.env.CRON_SECRET}`;
  c.set("auth", cookie ? "cookie" : secret ? "secret" : null);
  c.set("same-site", URL.canParse(ref) && new URL(ref).origin === new URL(c.req.url).origin);
  await next();
});

app.get("/data.js", async (c) => {
  if (!c.get("same-site")) return c.notFound();
  const data = await db.list();
  const auth = c.get("auth");
  return c.body(`window.AUTH=${JSON.stringify(auth)};window.DATA=${JSON.stringify(data)};`, 200, {
    "Content-Type": "application/javascript; charset=UTF-8",
    "Cache-Control": "public, max-age=600, s-maxage=300, stale-while-revalidate=3600"
  });
});

app.get("/img/:id", async (c) => {
  if (!c.get("same-site")) return c.notFound();
  const url = `${process.env.SUPABASE_URL}/storage/v1/object/public/cover/${c.req.param("id")}.webp`;
  const res = await fetch(url);
  if (!res.ok) return c.notFound();
  return new Response(res.body, {
    status: 200,
    headers: {
      "Content-Type": res.headers.get("Content-Type") || "image/webp",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
});

app.get("/api/data/update", async (c) => {
  if (!c.get("auth")) return c.notFound();
  const list = await db.list(true);
  const info = await scrape(list.map(({ url }) => url), true);
  const book = new Map(list.map((item) => [item.url, item]));
  const data = info.data.map(({ url, ...meta }) => ({ ...book.get(url), ...meta }));
  return c.json(await db.upsert(data));
});

app.post("/api/data/meta", async (c) => {
  if (!c.get("auth")) return c.json({ error: "Unauthorized" }, 401);
  const data = await c.req.json();
  return c.json(await scrape(data));
});

app.post("/api/data", async (c) => {
  if (!c.get("auth")) return c.json({ error: "Unauthorized" }, 401);
  const res = [];
  const data = await c.req.json();
  const novel = data.map(({ upload, ...book }) => book);
  const cover = data.filter(({ upload }) => upload).map(({ id, url, upload }) => ({ id, url, upload }));
  const error = [];
  const summary = [];
  res[0] = await db.upsert(novel);
  res[0].success
    ? summary.push(`${data.length} novel${data.length === 1 ? "" : "s"} ${res[0].status === 200 ? "updated" : "imported"}`)
    : error.push({ msg: res[0].error.message });
  if (cover.length) {
    res[1] = await db.upload(cover);
    const count = cover.length - res[1].error.length;
    summary.push(`${count} cover${count === 1 ? "" : "s"} uploaded`);
  }
  return c.json({
    summary: summary.join(", "),
    error: error.concat(res[1]?.error || [])
  });
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