import * as cheerio from "cheerio";
import { createHash } from "node:crypto";

const normalize = {
  status(text) {
    return {
      "已完结": "完结",
      "连载中": "连载"
    }[text];
  },
  genre(list) {
    const set = new Set();
    for (const g of list) {
      let n = {
        "动漫衍生": "衍生",
        "女频衍生": "衍生",
        "同人": "衍生",
        "二次元": "衍生",
        "搞笑轻松": "轻松",
      }[g];
      set.add(n || g);
    }
    return [...set];
  }  
}

const sites = [
  {
    name: "番茄",
    match(url) {
      return /^(https:\/\/)?fanqienovel\.com\/page\/\d+$/.test(url);
    },
    parse({ $, url }) {
      const meta = JSON.parse($("script[type='application/ld+json']").html());
      return {
        id: createHash("md5").update(url).digest("hex").slice(0, 10),
        url,
        title: $("h1").text().trim(),
        upload: meta.image[0],
        author: $(".author-name-text").text().trim(),
        status: normalize.status($(".info-label-yellow").text().trim()),
        genre: normalize.genre($(".info-label-grey").map((i, el) => $(el).text().trim()).get()),
        words: Number($(".info-count-word .detail").text().trim()),
        summary: $(".page-abstract-content").text().trim(),
        update: $(".info-last-time").text().trim() + ":00+08",
        latest: $(".info-last-title").text().trim().slice(5)
      };
    }
  }
];

export async function parse(urls) {
  const data = [];
  const error = [];
  for (const url of urls) {
    try {
      const site = sites.find(s => s.match(url));
      if (!site) {
        error.push({ url, error: "Website not supported" });
        continue;
      }

      const resp = await fetch(url);
      if (!resp.ok) {
        error.push({ url, error: `${resp.status} ${resp.statusText}` });
        continue;
      }

      const html = await resp.text();
      const $ = cheerio.load(html);
      data.push(site.parse({ $, url }));

      await sleep();
    } catch (e) {
      error.push({ url, error: e.message });
    }
  }
  return { data, error };
}

function sleep(ms = 1000) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
