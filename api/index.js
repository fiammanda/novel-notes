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
  const data = await redis.get();
  c.header("Vary", "Cookie");
  c.header("Content-Type", "application/javascript; charset=UTF-8");
  auth
    ? c.header("Cache-Control", "private, max-age=60")
    : c.header("Cache-Control", "public, max-age=60, s-maxage=86400, stale-while-revalidate=86400");
  return c.body(`window.AUTH=${JSON.stringify(auth)};window.DATA=${JSON.stringify(data.sort((a, b) => b.update.localeCompare(a.update)))};`);
});

app.get("/api/data/update", async (c) => {
  const auth = c.get("auth");
  if (!auth) return c.notFound();
  let full = await redis.get();
  let list = full;
  if (auth === "secret") {
    const date = new Date().getDate();
    const hour = new Date().getHours();
    list = full.filter(({ status, progress }) =>
      date === 5 && hour < 12 ||
      status === "连载" && progress === "观望" && date % 5 === 0 && hour < 12 ||
      status === "连载" && progress === "追读"
    );
  }
  if (!list.length) return c.json({ updated: `0/${full.length}` });
  const info = await parse(list.map(({ url }) => url), true);
  const book = new Map(list.map((item) => [item.url, item]));
  const data = info.data.map(({ url, ...rest }) => ({ ...book.get(url), ...rest }));
  await redis.set(data);
  console.log(`updated: ${list.length}/${full.length}`);
  return c.json({ updated: `${list.length}/${full.length}` });
});

app.post("/api/data/meta", async (c) => {
  if (!c.get("auth")) return c.json({ error: "Unauthorized" }, 401);
  const list = await c.req.json();
  return c.json(await parse(list));
});

app.post("/api/data", async (c) => {
  if (!c.get("auth")) return c.json({ error: "Unauthorized" }, 401);
  const list = await c.req.json();
  const novel = list.map(({ upload, ...book }) => book);
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