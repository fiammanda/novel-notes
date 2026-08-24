import { Redis } from "@upstash/redis";

const upstash = Redis.fromEnv();

export const redis = {
  async get() {
    const list = await upstash.hgetall("novel-notes:data");
    return list ? Object.values(list) : [];
  },

  async set(list) {
    try {
      const hash = Object.fromEntries(list.map(item => [item.id, item]));
      return await upstash.hset("novel-notes:data", hash);
    } catch (e) {
      return { msg: e.message };
    }
  }
};
