import { Redis } from "@upstash/redis";

const upstash = Redis.fromEnv();

export const redis = {
  async get() {
    const hash = await upstash.hgetall("novel-notes:data");
    return hash ? Object.values(hash) : [];
  },

  async set(list) {
    try {
      const hash = Object.fromEntries(list.map(item => [item.id, item]));
      return await upstash.hset("novel-notes:data", hash);
    } catch (e) {
      return { msg: e.message };
    }
  },

  async exist(id) {
    return await upstash.hexists("novel-notes:data", id);
  }
};
