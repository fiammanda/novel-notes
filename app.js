import { Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { serveStatic } from "@hono/node-server/serve-static";
import { db } from "#src/supabase.js";
import { page } from "#src/page.js";
import { scrape } from "#src/scraper.js";

const app = new Hono();

const handler = async (c) => {
  return c.html(page(c.get("auth"), await db.list()), {
    headers: {
      "Cache-Control": "maxage=300, s-maxage=300, stale-while-revalidate=1800",
    },
  });
};

app.use("/*", async (c, next) => {
  const cookie = getCookie(c, "admin") === process.env.ADMIN_COOKIE;
  const secret = c.req.header("authorization") === `Bearer ${process.env.CRON_SECRET}`;
  c.set("auth", cookie || secret);
  await next();
});

app.get("/", handler);
app.get("/import", handler);
app.get("/:id{[0-9a-z]{10}}", handler);

app.get("/api/data/update", async (c) => {
  if (!c.get("auth")) return c.notFound();
  const list = await db.list(false);
  const info = await scrape(list.map(({ url }) => url));
  const book = new Map(list.map((item) => [item.id, item]));
  const data = info.data.map(({ id, words, status, update, latest }) => ({ ...book.get(id), update, latest, status, words }));
  return c.json(await db.upsert(data));
});

app.post("/api/data/meta", async (c) => {
  if (!c.get("auth")) c.json({ error: "Unauthorized" }, 401);
  const data = await c.req.json();
  return c.json(await scrape(data));
});

app.post("/api/data", async (c) => {
  if (!c.get("auth")) c.json({ error: "Unauthorized" }, 401);
  const res = [];
  const data = await c.req.json();
  const novel = data.map(({ upload, ...book }) => book);
  const cover = data.filter(({ upload }) => upload).map(({ id, url, upload }) => ({ id, url, upload }));
  const error = [];
  const summary = [];
  res[0] = await db.upsert(novel);
  res[0].success
    ? summary.push(`${data.length} novel${data.length === 1 ? "" : "s"} ${res[0].status === 200 ? "updated" : "imported"}`)
    : error.push({ error: res[0].error.message });
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