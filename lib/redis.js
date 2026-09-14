import { Redis } from "@upstash/redis";

const upstash = Redis.fromEnv();

export const redis = {
  async exist(id) {
    return await upstash.hexists("novel-notes:data", id);
  },

  async get(type) {
    return await upstash.hgetall(`novel-notes:${type}`) || {};
  },

  async set(list) {
    try {
      return await upstash.hset("novel-notes:data", Object.fromEntries(list));
    } catch (e) {
      return { msg: e.message };
    }
  },

  async log(text) {
    const time = new Date().toLocaleString("sv-se", { timeZone: "asia/shanghai" });
    await upstash.hset("novel-notes:logs", { [time]: text });
    await upstash.hexpire("novel-notes:logs", time, 5184000);
  }
};
