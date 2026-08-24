import { put } from "@vercel/blob";

export const blob = {
  async put(list) {
    const sharp = (await import("sharp")).default;
    const error = [];
    for (const { id, url, upload } of list) {
      try {
        const source = await fetch(upload);
        const buffer = await source.arrayBuffer();
        const file = await sharp(buffer)
          .resize({ width: 480, height: 640, fit: "inside", withoutEnlargement: true })
          .webp({ quality: 80 })
          .toBuffer();
        await put(`${id}.webp`, file, {
          access: "public",
          contentType: "image/webp",
          cacheControlMaxAge: 31536000
        });
      } catch (e) {
        error.push({ url, msg: e.message });
      }
    }
    return { error };
  }
};
