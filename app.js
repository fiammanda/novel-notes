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
  const list = await db.list(false);
  const info = await parse(list.map(({ url }) => url));
  const book = new Map(list.map((item) => [item.id, item]));
  const data = info.data.map(({ id, words, status, update, latest }) => ({ ...book.get(id), update, latest, status, words }));
  return c.json(await db.upsert(data));
});

app.post("/api/data/meta", async (c) => {
  if (!c.get("auth")) c.json({ error: "Unauthorized" }, 401);
  const data = await c.req.json();
  return c.json(await parse(data));
});

app.post("/api/data", async (c) => {
  if (!c.get("auth")) c.json({ error: "Unauthorized" }, 401);
  const res = [];
  const data = await c.req.json();
  const novel = data.map(({ upload, ...book }) => book);
  const cover = data.filter(({ upload }) => upload).map(({ id, url, title, upload }) => ({ id, url, title, upload }));
  res[0] = await db.upsert(novel);
  let error = [];
  let summary = `${data.length} novel${data.length === 1 ? "" : "s"} ` + res[0].success
    ? `imported`
    : `failed (${res[0].error.message})`
  if (cover.length) {
    res[1] = await db.upload(cover);
    if (res[1].count) summary += `<br />${res[1].count} cover${res[1].count === 1 ? "" : "s"} uploaded`;
  }
  return c.json({ summary, error: res[1]?.error || [] });
});

export default app;