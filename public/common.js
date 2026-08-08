const ref = {
  rtf: new Intl.RelativeTimeFormat("zh", { numeric: "auto" }),
  base: "https://xomzoomdglxmxgqxmnll.supabase.co/storage/v1/object/public/cover/",
  urls: Object.fromEntries(DATA.map(({ url, title }) => [url, title])),
  genres: [
    "衍生",
    "奇幻", "都市", "游戏",
    "系统", "穿越",
    "第四天灾", "灵气复苏",
    "言情", "双男主", "无女主", "单女主",
    "轻松"
  ],
  status: {
    "完结": 0,
    "连载": 1,
    "断更": 2
  },
  progress: [ "看完", "追读", "弃文" ]
};

const doc = {
  form: document.forms,
  list: document.querySelector(".list"),
  main: document.querySelector("main"),
  button: document.querySelector("button"),
  dialog: document.querySelector("dialog"),
  log: document.querySelector("[role=log]"),
};

function log(logs) {
  let html = logs.summary ? `<li class="log-summary">${logs.summary}${logs.error.length ? "; error list:" : ""}</li>` : ``;
  html += logs.error
    .map(({ url, error}) => `<li class="log-entry"><span>[${error}]</span> <span>${url}</span></li>`)
    .join("");
  doc.log.className = "hidden";
  setTimeout(() => {
    doc.log.innerHTML = html;
    doc.log.removeAttribute("class");
  }, 201);
}

const render = {
  list(data) {
    return data.map(({ id, url, title, cover, upload, author, status, words, genre, summary, update, latest, rating, review, progress, post, edit }) => {
      let star = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">`;
      star += progress === "弃文"
        ? `<path fill="currentColor" d="m8.85 16.825l3.15-1.9l3.15 1.925l-.825-3.6l2.775-2.4l-3.65-.325l-1.45-3.4l-1.45 3.375l-3.65.325l2.775 2.425zm3.15.45l-4.15 2.5q-.275.175-.575.15t-.525-.2t-.35-.437t-.05-.588l1.1-4.725L3.775 10.8q-.25-.225-.312-.513t.037-.562t.3-.45t.55-.225l4.85-.425l1.875-4.45q.125-.3.388-.45t.537-.15t.537.15t.388.45l1.875 4.45l4.85.425q.35.05.55.225t.3.45t.038.563t-.313.512l-3.675 3.175l1.1 4.725q.075.325-.05.588t-.35.437t-.525.2t-.575-.15zm0-5.025" />`
        : rating === 5
          ? `<path fill="currentColor" d="M19.713 14.7q.412 0 .712.3L22 16.6q.3.3.3.7t-.3.7t-.7.3t-.7-.3L19 16.425q-.3-.3-.3-.712T19 15t.713-.3M20.3 3.713q0 .412-.3.712L18.425 6q-.3.3-.712.3T17 6t-.3-.712t.3-.713L18.6 3q.3-.3.7-.3t.7.3t.3.712M4.713 2.7q.412 0 .712.3L7 4.6q.3.3.3.7T7 6t-.712.3t-.713-.3L4 4.425q-.3-.3-.3-.712T4 3t.713-.3M5.3 15.713q0 .412-.3.712L3.425 18q-.3.3-.712.3T2 18t-.3-.712t.3-.713L3.6 15q.3-.3.7-.3t.7.3t.3.713m6.7 1.562l-4.15 2.5q-.275.175-.575.15t-.525-.2t-.35-.437t-.05-.588l1.1-4.725L3.775 10.8q-.25-.225-.312-.513t.037-.562t.3-.45t.55-.225l4.85-.425l1.875-4.45q.125-.3.388-.45t.537-.15t.537.15t.388.45l1.875 4.45l4.85.425q.35.05.55.225t.3.45t.038.563t-.313.512l-3.675 3.175l1.1 4.725q.075.325-.05.588t-.35.437t-.525.2t-.575-.15z" />`
          : `<path fill="currentColor" d="m12 17.275l-4.15 2.5q-.275.175-.575.15t-.525-.2t-.35-.437t-.05-.588l1.1-4.725L3.775 10.8q-.25-.225-.312-.513t.037-.562t.3-.45t.55-.225l4.85-.425l1.875-4.45q.125-.3.388-.45t.537-.15t.537.15t.388.45l1.875 4.45l4.85.425q.35.05.55.225t.3.45t.038.563t-.313.512l-3.675 3.175l1.1 4.725q.075.325-.05.588t-.35.437t-.525.2t-.575-.15z" />`;
      star += `</svg>`;
      return `<li data-id=${id}>
        <span class="book-title">${title}</span>
        <span class="book-slash">/</span>
        <span class="book-author">${author}</span>
        <span class="book-rating book-rating-${rating}">${star.repeat(rating)}</span>
        <span class="book-update book-update-${ref.status[status]}">${new Date(update).toLocaleString("sv").slice(0, 16)}</span>
      </li>`;
    }).join("");
  },

  save(data, editable = true) {
    const html = ["", ""];
    data.forEach(({ id, url, title, cover, upload, author, status, words, genre, summary, update, latest, rating, review, progress, post, edit }, index) => {
      const date = post ? new Date(post) : new Date();
      const y = date.getFullYear();
      const m = `${date.getMonth() + 1}`.padStart(2, "0");
      const d = `${date.getDate()}`.padStart(2, "0");
      html[0] += `<article>
        <div class="book-cover">
          <figure>
            <img src="${cover || upload || `https://fly.webp.se/image?url=${ref.base}${id}.jpg`}" onload="requestAnimationFrame(()=>{this.removeAttribute('onload')})" />
          </figure>
          <a href="${url}" target="_blank" rel="noopener noreferrer">${new URL(url).hostname}</a>
          <input type="hidden" name="id" value="${id}" />
          <input type="hidden" name="url" value="${url}" />
          ${edit ? `<input type="hidden" name="edit" value="${new Date().toLocaleDateString("sv")}" />` : ``}
          ${cover ? `<input type="hidden" name="cover" value="${cover}" />` : ``}
          ${upload ? `<input type="hidden" name="upload" value="${upload}" />` : ``}
          <input type="hidden" name="update" value="${update}" />
        </div>
        <div class="book-info">
          <div contenteditable="${editable}" data-name="title">${title}</div>
          <div contenteditable="${editable}" data-name="author" spellcheck="false">${author}</div>
          <div class="select" role="combobox" tabindex="-1">
            <input type="hidden" name="genre" value="${genre.join(" ")}" />
            <ul role="textbox">
              <li contenteditable="${editable}"></li>
              ${genre.map((g) => `<li role="option">${g}</li>`).join("")}
            </ul>
            <ul role="listbox">
              ${ref.genres.filter(g => !genre.includes(g)).map((g) => `<li role="option">${g}</li>`).join("")}
            </ul>
          </div>
          <textarea${editable ? "" : " disabled"} name="summary">${summary}</textarea>
          <div class="book-meta">
            <div>
              <div class="select" tabindex="-1">
                <input readonly type="text" name="status" value="${status}" />
                <ul role="listbox">
                  ${Object.keys(ref.status).map((i) => `<li role="option">${i}</li>`).join("")}
                </ul>
              </div>
              <div contenteditable="${editable}" data-name="words">${words}</div>
            </div>
            <div>
              <div class="book-update">${new Date(update).toLocaleDateString("sv").split("-").map((part) => `<span>${part}</span>`).join("-")}</div>
              <div data-name="latest">${latest}</div>
            </div>
            <div>
              <div class="select" tabindex="-1">
                <input readonly type="text" name="progress" value="${progress || "追读"}" />
                <ul role="listbox">
                  ${ref.progress.map((i) => `<li role="option">${i}</li>`).join("")}
                </ul>
              </div>
              <div class="date">
                <input type="text" inputmode="numeric" data-value="${y}" value="${y}" />-
                <input type="text" inputmode="numeric" data-value="${m}" value="${m}" />-
                <input type="text" inputmode="numeric" data-value="${d}" value="${d}" />
                <label>
                  <input type="date" name="post" value="${date.toLocaleDateString("sv")}" />
                </label>
              </div>
              <div class="book-rating">
                ${[5, 4, 3, 2, 1].map((i) => `<label>
                  <input type="radio" name="rating-${index}" data-name="rating" value="${i}" ${rating === i ? "checked " : ""}/>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                    <path fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" d="M12.908 1.581a1 1 0 0 0-1.816 0l-2.87 6.22l-6.801.807a1 1 0 0 0-.562 1.727l5.03 4.65l-1.335 6.72a1 1 0 0 0 1.469 1.067L12 19.426l5.977 3.346a1 1 0 0 0 1.47-1.068l-1.335-6.718l5.029-4.651a1 1 0 0 0-.562-1.727L15.777 7.8z" />
                    </svg>
                </label>`).join("")}
              </div>
            </div>
          </div>
          <textarea${editable ? "" : " disabled"} name="review">${review || ""}</textarea>
        </div>
      </article>`;
      html[1] += `<figure data-nav="${index}">
        <img src="${cover || upload}" onload="requestAnimationFrame(()=>{this.removeAttribute('onload')})" />
      </figure>`;
    });
    return editable
      ? `<section>${html[0]}<button>确认导入</button></section><nav>${html[1]}</nav>`
      : html[0];
  }
}

function auth() {
  delete document.body.dataset.auth;
  doc.form.auth.passcode.blur();
  const button = doc.button;
  button.removeAttribute("command")
  button.removeAttribute("commandfor")
  button.className = "hidden";
  const line = button.querySelector("[command]");
  setTimeout(() => {
    doc.dialog.dispatchEvent(new Event("cancel"));
    button.firstElementChild.innerHTML = `
      <line x1="12" y1="5.5" x2="12" y2="18.5"/>
      <line x1="5.5" y1="12" x2="18.5" y2="12"/>
      <line x1="10.5" y1="12" x2="14" y2="12"/>
      <line x1="10.5" y1="12" x2="14" y2="12"/>
    `;
    const line = button.firstElementChild.children;
    button.removeAttribute("class");
    button.addEventListener("click", (e) => {
      if (document.body.dataset.mode) {
        delete document.body.dataset.mode;
        gsap.to(line[0], { duration: .2, attr: { x1: 12, x2: 12 }});
        gsap.to(line[1], { duration: .2, attr: { x1: 5.5, x2: 18.5 }});
        gsap.to(line[2], { duration: .2, attr: { y2: 12 }});
        gsap.to(line[3], { duration: .2, attr: { y2: 12 }});
        doc.form.view.className = "readonly";
      } else {
        document.body.dataset.mode = "save";
        gsap.to(line[0], { duration: .2, attr: { x1: 6.5, x2: 6.5 }});
        gsap.to(line[1], { duration: .2, attr: { x1: 10.5, x2: 21 }});
        gsap.to(line[2], { duration: .2, attr: { y2: 8 }});
        gsap.to(line[3], { duration: .2, attr: { y2: 16 }});
      }
    });
  }, 201);
}

function color(img) {
  const cvs = document.createElement("cvs");
  const ctx = cvs.getContext("2d");
  cvs.width = img.naturalWidth / 4;
  cvs.height = img.naturalHeight / 4;
  ctx.drawImage(img, 0, 0, cvs.width, cvs.height);
  const { data } = ctx.getImageData(0, 0, cvs.width, cvs.height);
  let r = 0, g = 0, b = 0;
  for (let i = 0; i < data.length; i += 4) {
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
  }
  const n = data.length / 4;
  const c = "#" + [r, g, b].map(x => Math.round(x / n).toString(16).padStart(2, "0")).join("");
  img.closest("article").setAttribute("--color", c);
  return c;
}

function relative(date) {
  const diff = date.getTime() - Date.now();
  if (diff > - 1000 * 60)
    return "刚刚";
  if (diff > - 1000 * 60 * 60)
    return ref.rtf.format(Math.ceil(diff / 60000), "minute");
  if (diff > - 1000 * 60 * 60 * 24)
    return ref.rtf.format(Math.ceil(diff / 3600000), "hour");
  if (diff > - 1000 * 60 * 60 * 24 * 7)
    return ref.rtf.format(Math.ceil(diff / 86400000), "day");
  if (diff > - 1000 * 60 * 60 * 24 * 30)
    return ref.rtf.format(Math.ceil(diff / 604800000), "week");
  return date.toLocaleDateString("sv");
}
