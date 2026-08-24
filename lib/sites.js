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
    const arr = [];
    for (const item of list) {
      const name = {
        "动漫衍生": "衍生",
        "女频衍生": "衍生",
        "同人": "衍生",
        "玄幻脑洞": "玄幻",
        "二次元": "衍生",
        "魂穿": "穿越",
        "都市高武": ["都市", "高武"],
        "都市异能": ["都市", "异能"],
        "搞笑轻松": "轻松",
        "抗战谍战": ["抗战", "谍战"],
        "克苏鲁": "克系",
      }[item];
      arr.push(name || item);
    }
    return [...new Set(arr.flat())];
  }  
}

const sites = [
  {
    name: "番茄",
    match(url) {
      return (
        url.startsWith("https://fanqienovel.com/page/") ||
        url.startsWith("https://fanqienovel.com/reader/") ||
        url.startsWith("https://changdunovel.com/t/") ||
        url.startsWith("https://changdunovel.com/ug/pages/book-share?")
      );
    },
    async parse({ url, update }) {
      let bid;
      if (url.startsWith("https://fanqienovel.com/reader/")) {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}`);
        const html = await resp.text();
        bid = html.match(/"bookId":"(\d+)"/)[1];
        url = `https://fanqienovel.com/page/${bid}`;
      }
      if (url.startsWith("https://changdunovel.com/t/")) {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}`);
        url = resp.url;
      }
      if (url.startsWith("https://changdunovel.com/ug/pages/book-share?")) {
        bid = new URL(url).searchParams.get("book_id");
        url = `https://fanqienovel.com/page/${bid}`;
      }
      bid ||= url.slice(29);

      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}`);

      const html = await resp.text();
      const $ = cheerio.load(html);
      const item = {
        url,
        status: normalize.status($(".info-label-yellow").text().trim()),
        update: $(".info-last-time").text().trim() + ":00+08",
        latest: $(".info-last-title").text().trim().slice(5)
      };

      if (!update) {
        const resp = await fetch(`https://api.fqnovel.com/novel_ug/share/landing_page?aid=1967&share_type=11&book_id=${bid}`);
        const { data: { book_data: book } } = await resp.json();
        Object.assign(item, {
          id: createHash("md5").update(url).digest("hex").slice(0, 10),
          title: book.title,
          upload: book.cover_url,
          author: book.author.name,
          genre: normalize.genre(book.category_tags),
          words: (book.word_count / 10000).toFixed(1),
          summary: book.intro
        });
      } else {
        item.words = Number($(".info-count-word .detail").text().trim());
      }
      if (item.status === "连载" && new Date(item.update) < Date.now() - 2592000000) {
        item.status = "停更";
      }
      return item;
    }
  }
];

export async function parse(urls, update = false) {
  const data = [];
  const errs = [];
  for (const url of urls) {
    try {
      const site = sites.find(s => s.match(url));
      if (!site) {
        throw new Error("URL not supported");
      }
      data.push(await site.parse({ url, update }));
      await sleep();
    } catch (e) {
      console.error(e);
      errs.push({ url, msg: e.message });
    }
  }
  return { data, errs };
}

function sleep(ms = 1000) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
