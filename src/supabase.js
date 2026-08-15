import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const db = {
  async list(full = true) {
    if (full) {
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
        const img = await fetch(upload);
        const bfr = await img.arrayBuffer();
        const res = await supabase.storage
          .from("cover")
          .upload(`${id}.jpg`, bfr, { contentType: "image/jpeg", cacheControl: "2592000" });
      } catch (e) {
        error.push({ url, error: e.message });
      }
    }
    return { error };
  }
};
