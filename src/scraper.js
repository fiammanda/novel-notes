import * as cheerio from "cheerio";
import { createHash } from "node:crypto";

const normalize = {
  status(text) {
    return {
      "已完结": "完结",
      "连载中": "连载",
      "断更": "停更"
    }[text];
  },
  genre(list) {
    const set = new Set();
    for (const g of list) {
      let n = {
        "动漫衍生": "衍生",
        "女频衍生": "衍生",
        "同人": "衍生",
        "玄幻脑洞": "玄幻",
        "二次元": "衍生",
        "搞笑轻松": "轻松",
        "抗战谍战": "谍战",
      }[g];
      set.add(n || g);
    }
    return [...set];
  }  
}

const resolvers = [
  {
    name: "番茄",
    match(url) {
      return (
        url.startsWith("https://changdunovel.com/t/") ||
        url.startsWith("https://changdunovel.com/ug/pages/book-share?")
      );
    },
    async resolve(url) {
      if (url.includes("/t/")) {
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`${res.status} ${res.statusText}`);
        }
        url = res.url;
      }
      const id = new URL(url).searchParams.get("book_id");
      return `https://fanqienovel.com/page/${id}`;
    }
  }
];

const parsers = [
  {
    name: "番茄",
    match(url) {
      return /^(https:\/\/)?fanqienovel\.com\/page\/\d+$/.test(url);
    },
    parse({ $, url }) {
      const meta = JSON.parse($("script[type='application/ld+json']").html());
      const data = {
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
      if (data.status === "连载" && new Date(data.update) < Date.now() - 2592000000) data.status = "停更";
      return data;
    }
  }
];

export async function scrape(urls) {
  const data = [];
  const error = [];
  for (let url of urls) {
    try {
      const resolver = resolvers.find(r => r.match(url));
      if (resolver) {
        url = await resolver.resolve(url);
      }

      const parser = parsers.find(p => p.match(url));
      if (!parser) {
        error.push({ url, error: "Website not supported" });
        continue;
      }

      const res = await fetch(url);
      if (!res.ok) {
        error.push({ url, error: `${res.status} ${res.statusText}` });
        continue;
      }

      const html = await res.text();
      const $ = cheerio.load(html);
      data.push(parser.parse({ $, url }));

      await sleep();
    } catch (e) {
      error.push({ url, error: e.message });
    }
  }
  return { data, error, summary: `${data.length} link${data.length === 1 ? "" : "s"} scraped` };
}

function sleep(ms = 1000) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
