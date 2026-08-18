const CACHE = {
  IMAGE: "image",
  ASSET: "asset",
  DATA: "data",
};

self.addEventListener("fetch", e => {
  const req = e.request;
  const url = new URL(req.url);
  const samesite = url.origin === location.origin;

  const key = () => {
    if (url.pathname === "/data.js" && samesite)
      return "DATA";
    if (req.destination === "image" && samesite)
      return "IMAGE";
    if (req.destination === "font" || ["script", "style"].includes(req.destination) && !samesite)
      return "ASSET";
  };

  const KEY = key();
  if (!KEY) return;

  e.respondWith(
    caches.open(CACHE[KEY]).then(async (cache) => {
      const cached = await cache.match(req);
      if (cached) return cached;
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      if (KEY === "IMAGE") {
        const image = await cache.keys();
        if (image.length > 200) await cache.delete(image[0]);
      }
      return res;
    })
  );
});

self.addEventListener("message", async e => {
  if (e.data.startsWith("purge:")) {
    const KEY = e.data.split(":")[1].toUpperCase();
    CACHE[KEY] && await caches.delete(CACHE[KEY]);
  }
});