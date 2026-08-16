import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const db = {
  async list(update = false) {
    if (!update) {
      const { data, error } = await supabase
        .from("novel")
        .select("*")
        .order("post", { ascending: false });
      if (error) console.error(error);
      return data;
    } else {
      const { data, error } = await supabase
        .from("novel")
        .select("*")
        .eq("status", "连载");
      return data;
    }
  },

  async delete(id) {
    return supabase
      .from("novel")
      .delete()
      .eq("id", id);
    if (error) console.error(error);
  },

  async upsert(list) {
    const result = await supabase
      .from("novel")
      .upsert(list, { onConflict: "id" });
    return result;
  },

  async upload(list) {
    const error = [];
    for (const { id, url, upload } of list) {
      try {
        const source = await fetch(upload);
        const buffer = await source.arrayBuffer();
        const file = await sharp(buffer)
          .resize({ width: 400, height: 600, fit: "inside", withoutEnlargement: true })
          .webp({ quality: 80 })
          .toBuffer();
        const { error: e } = await supabase.storage
          .from("cover")
          .upload(`${id}.webp`, file, { contentType: "image/webp", cacheControl: "2592000" });
        e && error.push({ url, error: e.message });
      } catch (e) {
        error.push({ url, error: e.message });
      }
    }
    return { error };
  }
};
