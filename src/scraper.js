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
      return url.startsWith("https://fanqienovel.com/page/");
    },
    async parse({ $, url, update }) {
      const data = {
        url,
        status: normalize.status($(".info-label-yellow").text().trim()),
        update: $(".info-last-time").text().trim() + ":00+08",
        latest: $(".info-last-title").text().trim().slice(5)
      };
      if (!update) {
        const resp = await fetch(`https://api.fqnovel.com/novel_ug/share/landing_page?aid=1967&share_type=11&book_id=${url.slice(29)}`);
        const { data: { book_data: book } } = await resp.json();
        Object.assign(data, {
          id: createHash("md5").update(url).digest("hex").slice(0, 10),
          title: book.title,
          upload: book.cover_url,
          author: book.author.name,
          genre: normalize.genre(book.category_tags),
          words: (book.word_count / 10000).toFixed(1),
          summary: book.intro
        });
      } else {
        data.words = Number($(".info-count-word .detail").text().trim());
      }
      if (data.status === "连载" && new Date(data.update) < Date.now() - 2592000000) {
        data.status = "停更";
      }
      return data;
    }
  }
];

export async function scrape(urls, update = false) {
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

      const resp = await fetch(url);
      if (!resp.ok) {
        error.push({ url, error: `${resp.status} ${resp.statusText}` });
        continue;
      }

      const html = await resp.text();
      const $ = cheerio.load(html);
      data.push(await parser.parse({ $, url, update }));

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
