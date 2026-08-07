import { Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { serveStatic } from "@hono/node-server/serve-static";
import { db } from "#src/supabase.js";
import { page } from "#src/page.js";
import { parse } from "#src/parser.js";

const app = new Hono();

app.use("/*", async (c, next) => {
  const cookie = getCookie(c, "admin") === process.env.ADMIN_COOKIE;
  const secret = c.req.header("authorization") === `Bearer ${process.env.CRON_SECRET}`;
  c.set("auth", cookie || secret);
  await next();
});

app.get("/", async (c) => {
  return c.html(page(c.get("auth"), await db.list()), {
    headers: {
      "Cache-Control": "s-maxage=60, stale-while-revalidate=300",
    },
  });
});

app.post("/api/auth", async (c) => {
  const { passcode } = await c.req.json();
  if (passcode !== process.env.ADMIN_PASSCODE) return c.json({ success: false }, 401);
  setCookie(c, "admin", process.env.ADMIN_COOKIE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Strict",
    path: "/",
    maxAge: 31536000,
  });
  return c.json({ success: true });
});

app.post("/api/data/update", async (c) => {
  const urls = await db.list(false);
  const info = await parse(urls.map(({ url }) => url));
  const data = info.map(({ id, words, status, update, latest }) => ({ id, update, latest, status, words }));
  await db.upsert(data);
});

app.post("/api/data/meta", async (c) => {
  if (!c.get("auth")) c.json({ error: "Unauthorized" }, 401);
  const data = await c.req.json();
  return c.json(await parse(data));
});

app.post("/api/data", async (c) => {
  if (!c.get("auth")) c.json({ error: "Unauthorized" }, 401);
  const data = await c.req.json();
  const novel = data.map(({ upload, ...book }) => book);
  const cover = data.filter(({ upload }) => upload).map(({ id, url, title, upload }) => ({ id, url, title, upload }));
  const result = [];
  result[0] = await db.upsert(novel);
  if (cover.length) result[1] = await db.upload(cover);
  return c.json(result);
});

export default app;