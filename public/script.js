gsap.registerPlugin(Flip);

const ref = {
  rtf: new Intl.RelativeTimeFormat("zh", { numeric: "auto" }),
  urls: Object.fromEntries(DATA.map(({ url, title }) => [url, title])),
  list: new Map(DATA.map((item) => [item.id, item])),
  genres: [
    "衍生",
    "奇幻", "都市", "游戏",
    "系统", "穿越",
    "第四天灾", "灵气复苏",
    "言情", "双男主", "无女主", "单女主",
    "轻松"
  ],
  status: [ "完结", "连载", "停更" ],
  progress: [ "看完", "追读", "弃文" ]
};

const doc = {
  form: document.forms,
  list: document.querySelector(".list"),
  main: document.querySelector("main"),
  link: document.querySelector("header a"),
  button: document.querySelector("header button"),
  dialog: document.querySelector("dialog"),
  log: document.querySelector("[role=log]")
};
doc.form.filter.querySelectorAll("[data-name]").forEach((el) => doc.form.filter[el.dataset.name] = el);
doc.form.filter.option = doc.form.filter.querySelectorAll("fieldset [role=option]");

if (document.body.dataset.auth === "true") auth();

doc.list.innerHTML = render(DATA, "list");

document.body.addEventListener("click", (e) => {
  if (document.body.ariaDisabled) {
    e.preventDefault();
    document.body.removeAttribute("aria-disabled");
    return;
  }

  if (e.target.closest("a:not([target])")) {
    e.preventDefault();
    history.pushState(null, "",  e.target.closest("a").href);
    navigate();
    return;
  }

  if (e.target.closest("[data-nav]")) {
    const nav = e.target.closest("[data-nav]");
    doc.form.save.set.children[nav.dataset.nav].scrollIntoView({ behavior: "smooth" });
    return;
  }

  if (e.target.closest(".select[tabindex]")) {
    const select = e.target.closest(".select");
    const option = e.target.closest("[role=option]");
    const button = select.querySelector("[role=combobox]");
    if (option) {
      if (!select.tabIndex) {
        if (button.ariaLabel) {
          button.ariaLabel = option.textContent;
          button.dataset.key = option.dataset.key;
          button.dataset.dir = option.dataset.dir;
        } else {
          button.textContent = option.textContent;
        }
        button.dispatchEvent(new Event("input", { bubbles: true }));
        select.blur();
        select.querySelector("[aria-selected=true]").ariaSelected = "false";
        option.ariaSelected = "true";
      } else if (e.target.closest("button")) {
        const box = select.querySelector("[role=textbox]");
        const state = Flip.getState(option.parentElement.children);
        option.remove();
        Flip.from(state, { duration: .2 });
      } else {
        const selected = option.ariaSelected === "true";
        const state = Flip.getState(option);
        const ul = select.children;
        option.ariaSelected = !selected;
        (selected ? ul[1] : ul[0]).append(option);
        Flip.from(state, { duration: .2, nested: true });
      }
    }
    if (select.tabIndex) button.focus();
    return;
  }

  if (e.target.matches(".date:has([contenteditable=true])")) {
    e.target.firstElementChild.focus();
  }
});

document.body.addEventListener("mousedown", (e) => {
  const select = e.target.closest(".select");
  if (!select && document.activeElement.className === "select" && window.matchMedia("(hover: none) and (pointer: coarse)").matches) {
    document.body.ariaDisabled = "true";
    return;
  }
  if (!select) return;
  if (e.target.closest("span[role=combobox]") && select === document.activeElement) {
    e.preventDefault();
    select.blur();
  }
});

document.body.addEventListener("keydown", (e) => {
  if (doc.dialog.open && e.key === "Escape") {
    e.preventDefault();
    doc.dialog.requestClose();
  }

  if (location.pathname !== "/" && e.key === "Escape") {
    history.pushState(null, "",  "/");
    navigate();
    return;
  }

  if (e.target.matches("[name=filter] input") && e.key === "Escape") {
    doc.form.filter.reset();
    e.target.blur()
  }

  if (e.target.matches("li[contenteditable=true]") && e.key === "Backspace") {
    const sel = getSelection();
    const list = e.target.parentElement;
    if (list.children.length > 1 && sel.isCollapsed && sel.anchorOffset === 0) {
      const last = list.lastElementChild;
      const state = Flip.getState([e.target, last]);
      last.remove();
      Flip.from(state, { duration: .2 });
    }
    return;
  }

  if (e.target.matches(".select li[contenteditable]") && e.key === "Enter") {
    e.preventDefault();
    freeze(e.target);
    e.target.focus();
    return;
  }

  if (e.target.matches(".date span")) {
    const array = [...e.target.parentElement.children].slice(0, -1);
    const index = array.indexOf(e.target);
    if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      array[index - 1].focus();
      return;
    }
    if (["ArrowRight", "-", "/", "."].includes(e.key) && index < 2) {
      e.preventDefault();
      array[index + 1].focus();
      return;
    }
    if (!["ArrowUp", "ArrowDown"].includes(e.key)) return;
    e.preventDefault();
    const date = new Date(+array[0].textContent, +array[1].textContent - 1, +array[2].textContent);
    const step = e.key === "ArrowUp" ? 1 : -1;
    if (index === 0) date.setFullYear(date.getFullYear() + step);
    if (index === 1) date.setMonth(date.getMonth() + step);
    if (index === 2) date.setDate(date.getDate() + step);
    array[0].textContent = date.getFullYear();
    array[1].textContent = String(date.getMonth() + 1).padStart(2, "0");
    array[2].textContent = String(date.getDate()).padStart(2, "0");
  }
});

doc.dialog.addEventListener("toggle", (e) => {
  if (!doc.dialog.open) return;
  setTimeout(() => doc.form.auth.removeAttribute("class"), 0);
});

doc.dialog.addEventListener("cancel", (e) => {
  e.preventDefault();
  doc.form.auth.className = "hidden";
  setTimeout(() => doc.dialog.close(), 200);
});

doc.dialog.addEventListener("click", (e) => {
  if (e.target === doc.form.auth) doc.dialog.dispatchEvent(new Event("cancel"));
});

doc.main.addEventListener("beforeinput", (e) => {
  if (!e.target.closest(".date span")) return;
  e.preventDefault();
  if (!/^\d+$/.test(e.data)) return;
  const array = [...e.target.closest(".date").children].slice(0, -1);
  const input = e.target.closest("span");
  const index = array.indexOf(input);
  const max = index === 0
    ? 9999
    : index === 1
      ? 12
      : new Date(+array[0].textContent, +array[1].textContent, 0).getDate();
  const len = index === 0 ? 4 : 2;
  const val = input.dataset.value + e.data;
  input.dataset.value = max < val ? e.data : val;
  input.textContent = input.dataset.value.padStart(len, "0");
  if (index === 1 && input.dataset.value > 1 || index !== 2 && input.dataset.value.length === len) {
    array[index + 1].focus();
  }
});

doc.main.addEventListener("focusout", (e) => {
  if (e.target.matches(".select li[contenteditable]") && e.target.textContent.trim()) {
    freeze(e.target);
    return;
  }

  if (e.target.matches(".date span")) {
    e.target.dataset.value = e.target.textContent;
    return;
  }
});

doc.main.addEventListener("dblclick", (e) => {
  if (!e.target.closest(".date")) return;
  const array = e.target.closest(".date").children;
  const date = new Date();
  array[0].textContent = date.getFullYear();
  array[1].textContent = `${date.getMonth() + 1}`.padStart(2, "0");
  array[2].textContent = `${date.getDate()}`.padStart(2, "0");
});

doc.main.addEventListener("change", (e) => {
  if (e.target.type !== "date") return;
  const array = e.target.closest(".date").children;
  const value = e.target.value.split("-");
  array[0].textContent = value[0];
  array[1].textContent = value[1];
  array[2].textContent = value[2];
});

doc.form.auth.addEventListener("submit", async (e) => {
  e.preventDefault();
  const pass = doc.form.auth.passcode;
  pass.disabled = true;
  const resp = await fetch("/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ passcode: pass.value })
  })
  const { success } = await resp.json();
  if (success) {
    auth();
  } else {
    pass.disabled = false;
    pass.readOnly = true;
    setTimeout(() => {
      pass.readOnly = false;
      pass.select();
    }, 600);
  }
});

doc.form.filter.search.addEventListener("compositionstart", () => {
  doc.form.filter.composing = true;
});

doc.form.filter.search.addEventListener("compositionend", () => {
  doc.form.filter.composing = false;
  doc.form.filter.dispatchEvent(new Event("input"));
});

doc.form.filter.addEventListener("input", (e) => {
  if (e.target.name === "search") {
    if (doc.form.filter.composing) return;
    clearTimeout(doc.form.filter.debounce);
    doc.form.filter.debounce = setTimeout(() => filter(), 100);
  } else if (e.target.dataset.name === "sort") {
    filter("sort");
  } else {
    filter();
  }
});

doc.form.filter.addEventListener("reset", () => {
  doc.form.filter.option.forEach((el) => (el.ariaSelected = el.ariaLabel ? true : false));
  doc.form.filter.status.textContent = "";
  doc.form.filter.progress.textContent = "";
  filter("reset");
});

doc.form.filter.addEventListener("submit", (e) => {
  e.preventDefault();
  filter();
});

doc.form.import.addEventListener("submit", async (e) => {
  e.preventDefault();
  const urls = [];
  const logs = { error: [] };

  doc.form.import.urls.value.split("\n").forEach((url) => {
    if (!url.trim() || !url.includes("http")) return;
    try {
      const u = new URL(url);
      u.hash = "";
      u.search = "";
      ref.urls[u.href]
        ? logs.error.push({ url: u.href, error: "URL already exists" })
        : urls.push(u.href);
      return u.href;
    } catch (e) {
      error.push({ url, error: e.message });
    }
  });

  if (!urls.length) {
    logs.summary = "No valid URL";
    log(logs);
    return;
  }

  doc.form.save.className = "hidden";
  doc.form.import.button.disabled = true;
  const spin = gsap.to(doc.form.import.button.querySelector("path"), {
    transformOrigin: "50%",
    rotation: "+=360",
    ease: "none",
    repeat: -1,
    duration: 2
  });
  const resp = fetch("/api/data/meta", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(urls)
  }).then(res => res.json());
  const [json] = await Promise.all([
    resp,
    new Promise(res => setTimeout(res, 200))
  ]);
  spin.repeat(0);
  spin.kill();
  json.error = (json.error || []).concat(logs.error || []);
  log(json);
  doc.form.import.button.removeAttribute("disabled");
  doc.form.save.firstElementChild.innerHTML = render(json.data, "save");
  setTimeout(() => {
    doc.form.save.removeAttribute("class");
    doc.form.save.querySelectorAll("[name=summary]").forEach((el) => {
      el.style.height = "0";
      el.style.height = `${el.scrollHeight}px`;
    });
  }, 1);
});

doc.form.save.addEventListener("reset", (e) => {
  doc.form.save.className = "hidden";
  setTimeout(() => {
    doc.form.save.firstElementChild.replaceChildren();
    doc.form.save.removeAttribute("class");
  }, 200);
});

doc.form.save.addEventListener("submit", async (e) => {
  e.preventDefault();
  doc.form.save.submit.disabled = true;
  const data = [...doc.form.save.set.querySelectorAll("article")].map((article) => collect(article));
  const resp = await fetch("/api/data", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(data)
  });
  const json = await resp.json();
  if (!json.error.length) {
    DATA.push(...data);
    data.forEach(item => ref.list.set(item.id, item));
    doc.list.insertAdjacentHTML("beforeend", render(data, "list"));
    doc.form.save.className = "hidden";
    doc.form.import.urls.className = "hidden";
    setTimeout(() => {
      doc.form.save.firstElementChild.replaceChildren();
      doc.form.save.removeAttribute("class");
      doc.form.import.urls.value = "";
      doc.form.import.urls.removeAttribute("class");
    }, 200);
  }
  doc.form.save.submit.disabled = false;
  log(json);
});

doc.form.view.addEventListener("reset", (e) => {
  const disabled = !doc.form.view.set.disabled;
  doc.form.view.set.disabled = disabled;
  doc.form.view.querySelectorAll("[contenteditable]").forEach((el) => el.contentEditable = !disabled);
  doc.form.view.querySelectorAll(".select").forEach((el) => disabled ? el.removeAttribute("tabindex") : (el.tabIndex = el.dataset.tab));
});

doc.form.view.addEventListener("submit", async (e) => {
  e.preventDefault();
  doc.form.view.submit.disabled = true;
  const item = collect(doc.form.view.set);
  const resp = await fetch("/api/data", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify([item])
  });
  const json = await resp.json();
  if (!json.error.length) {
    DATA[DATA.findIndex(({ id }) => id === item.id)] = item;
    ref.list.set(item.id, item);
    doc.form.view.set.disabled = true;
    doc.form.view.querySelectorAll("[contenteditable]").forEach((el) => el.contentEditable = false);
  }
  doc.form.view.submit.disabled = false;
});

window.addEventListener("popstate", () => navigate());

navigate();

setTimeout(() => document.body.removeAttribute("class"), 1);

function log(logs) {
  let html = logs.summary ? `<li class="log-summary">${logs.summary}${logs.error.length ? ":" : ""}</li>` : ``;
  html += logs.error
    .map(({ error, url }) => `<li class="log-entry"><span>${error}</span> <span>${url || ""}</span></li>`)
    .join("");
  doc.log.className = "hidden";
  setTimeout(() => {
    doc.log.innerHTML = html;
    doc.log.removeAttribute("class");
  }, 200);
}

function auth() {
  delete document.body.dataset.auth;
  const line = doc.link.firstElementChild.children;
  line[0].setAttribute("x1", 12);
  line[0].setAttribute("x2", 12);
  line[1].setAttribute("x1", 5.5);
  line[1].setAttribute("x2", 18.5);
  line[2].setAttribute("y2", 12);
  line[3].setAttribute("y2", 12);
  doc.link.href = "/import";
  doc.form.auth.passcode.blur();
  doc.dialog.dispatchEvent(new Event("cancel"));
}

function filter(type) {
  const list = [...doc.list.children];
  if (type === "sort") {
    const state = Flip.getState(list);
    const { key, dir } = doc.form.filter.sort.dataset;
    list.sort((a, b) => {
      const va = ref.list.get(a.dataset.id)[key];
      const vb = ref.list.get(b.dataset.id)[key];
      if (va == null) return 1;
      if (vb == null) return -1;
      let diff = va < vb ? -1 : va > vb ? 1 : 0;
      return dir === "asc" ? diff : -diff;
    });
    list.forEach((li) => doc.list.append(li));
    Flip.from(state, { duration: .2 });
  } else {
    [...doc.list.children].forEach((li) => {
      if (type === "reset") {
        requestAnimationFrame(() => { li.removeAttribute("class") });
        return;
      }
      const conditions = [
        ["progress", doc.form.filter.progress.textContent],
        ["status",   doc.form.filter.status.textContent],
        ["search",   doc.form.filter.search.value]
      ];
      const item = ref.list.get(li.dataset.id);
      const hide = !conditions.every(([key, val]) => {
        if (!val) return true;
        if (key === "search") return [item.title, item.author, item.summary].some((v) => v?.includes(val));
        return item[key] == val;
      });
      li.classList.toggle("hidden", hide)
    });
  }
}

function render(data, type) {
  if (type === "list") {
    return data.map(({ id, url, title, cover, upload, author, status, words, genre, summary, update, latest, rating, review, progress, post, edit }) => {
      let star = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">`;
      star += progress === "弃文"
        ? `<path d="m8.85 16.825l3.15-1.9l3.15 1.925l-.825-3.6l2.775-2.4l-3.65-.325l-1.45-3.4l-1.45 3.375l-3.65.325l2.775 2.425zm3.15.45l-4.15 2.5q-.275.175-.575.15t-.525-.2t-.35-.437t-.05-.588l1.1-4.725L3.775 10.8q-.25-.225-.312-.513t.037-.562t.3-.45t.55-.225l4.85-.425l1.875-4.45q.125-.3.388-.45t.537-.15t.537.15t.388.45l1.875 4.45l4.85.425q.35.05.55.225t.3.45t.038.563t-.313.512l-3.675 3.175l1.1 4.725q.075.325-.05.588t-.35.437t-.525.2t-.575-.15zm0-5.025" />`
        : rating === 5
          ? `<path d="M19.713 14.7q.412 0 .712.3L22 16.6q.3.3.3.7t-.3.7t-.7.3t-.7-.3L19 16.425q-.3-.3-.3-.712T19 15t.713-.3M20.3 3.713q0 .412-.3.712L18.425 6q-.3.3-.712.3T17 6t-.3-.712t.3-.713L18.6 3q.3-.3.7-.3t.7.3t.3.712M4.713 2.7q.412 0 .712.3L7 4.6q.3.3.3.7T7 6t-.712.3t-.713-.3L4 4.425q-.3-.3-.3-.712T4 3t.713-.3M5.3 15.713q0 .412-.3.712L3.425 18q-.3.3-.712.3T2 18t-.3-.712t.3-.713L3.6 15q.3-.3.7-.3t.7.3t.3.713m6.7 1.562l-4.15 2.5q-.275.175-.575.15t-.525-.2t-.35-.437t-.05-.588l1.1-4.725L3.775 10.8q-.25-.225-.312-.513t.037-.562t.3-.45t.55-.225l4.85-.425l1.875-4.45q.125-.3.388-.45t.537-.15t.537.15t.388.45l1.875 4.45l4.85.425q.35.05.55.225t.3.45t.038.563t-.313.512l-3.675 3.175l1.1 4.725q.075.325-.05.588t-.35.437t-.525.2t-.575-.15z" />`
          : `<path d="m12 17.275l-4.15 2.5q-.275.175-.575.15t-.525-.2t-.35-.437t-.05-.588l1.1-4.725L3.775 10.8q-.25-.225-.312-.513t.037-.562t.3-.45t.55-.225l4.85-.425l1.875-4.45q.125-.3.388-.45t.537-.15t.537.15t.388.45l1.875 4.45l4.85.425q.35.05.55.225t.3.45t.038.563t-.313.512l-3.675 3.175l1.1 4.725q.075.325-.05.588t-.35.437t-.525.2t-.575-.15z" />`;
      star += `</svg>`;
      return `<li data-id="${id}">
        <a href="/${id}">
          <span class="book-title">${title}</span>
          <span class="book-slash">/</span>
          <span class="book-author">${author}</span>
          <span class="book-rating" data-rating="${rating ?? 0}" ${progress === "弃文" ? `data-progress="false"` : ``}>${star.repeat(rating ?? 0)}</span>
          <span class="book-update">${new Date(update).toLocaleString("sv").slice(0, -3).replace(/(-|:)/g, "<span>$1</span>")}</span>
        </a>
      </li>`;
    }).join("");
  } else {
    const html = ["", ""];
    const editable = type === "save";
    data.forEach(({ id, url, title, cover, upload, author, status, words, genre, summary, update, latest, rating, review, progress, post, edit }, index) => {
      const date = post ? new Date(post) : new Date();
      const y = date.getFullYear();
      const m = `${date.getMonth() + 1}`.padStart(2, "0");
      const d = `${date.getDate()}`.padStart(2, "0");
      html[0] += `<article>
        <div class="book-cover">
          <figure>
            <img src="${cover ? `https://fly.webp.se/image?url=${cover}` : upload || `/img/${id}`}" onload="requestAnimationFrame(()=>{this.removeAttribute('onload')})" />
          </figure>
          <a data-name="url" href="${url}" target="_blank" rel="noopener noreferrer">${new URL(url).hostname}</a>
          <input type="hidden" name="id" value="${id}" />
          ${edit ? `<input type="hidden" name="edit" value="${new Date().toLocaleDateString("sv")}" />` : ``}
          ${cover ? `<input type="hidden" name="cover" value="${cover}" />` : ``}
          ${upload ? `<input type="hidden" name="upload" value="${upload}" />` : ``}
          <input type="hidden" name="update" value="${update}" />
        </div>
        <div class="book-info">
          <div contenteditable="${editable}" data-name="title">${title}</div>
          <div contenteditable="${editable}" data-name="author" spellcheck="false">${author}</div>
          <div class="select" data-tab="-1" ${editable ? `tabindex="-1"` : ``}>
            <ul role="listbox" data-name="genre">
              <li role="combobox" contenteditable="${editable}"></li>
              ${genre.map((g) => `<li role="option" aria-selected="true">${g}</li>`).join("")}
            </ul>
            <ul role="listbox">
              ${ref.genres.filter(g => !genre.includes(g)).map((g) => `<li role="option" aria-selected="false">${g}</li>`).join("")}
            </ul>
          </div>
          <textarea name="summary">${summary}</textarea>
          <div class="book-meta">
            <div>
              <div class="select" data-tab="0" ${editable ? `tabindex="0"` : ``}>
                <span data-name="status" role="combobox" aria-placeholder="状态">${status}</span>
                <ul role="listbox">
                  ${ref.status.map((i) => `<li role="option" aria-selected="${i === status ? "true" : "false"}">${i}</li>`).join("")}
                </ul>
              </div>
              <div contenteditable="${editable}" inputmode="numeric" data-name="words">${words}</div>
              <div></div>
            </div>
            <div>
              <div class="book-update">${new Date(update).toLocaleDateString("sv").split("-").map((part) => `<span>${part}</span>`).join("-")}</div>
              <div data-name="latest">${latest}</div>
            </div>
            <div>
              <div class="select" data-tab="0" ${editable ? `tabindex="0"` : ``}>
                <span data-name="progress" role="combobox" aria-placeholder="进度">${progress || ""}</span>
                <ul role="listbox">
                  ${ref.progress.map((i) => `<li role="option" aria-selected="${i === progress ? "true" : "false"}">${i}</li>`).join("")}
                </ul>
              </div>
              <div class="date" data-name="post">
                <span contenteditable="${editable}" inputmode="numeric" data-value="${y}">${y}</span>-
                <span contenteditable="${editable}" inputmode="numeric" data-value="${m}">${m}</span>-
                <span contenteditable="${editable}" inputmode="numeric" data-value="${d}">${d}</span>
                <label>
                  <input type="date" value="${date.toLocaleDateString("sv")}" />
                </label>
              </div>
              <div class="book-rating">
                ${[5, 4, 3, 2, 1].map((i) => `<label>
                  <input type="radio" name="rating-${index}" data-name="rating" value="${i}" ${rating === i ? "checked" : ""} />
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                    <path fill-rule="evenodd" clip-rule="evenodd" d="M12.908 1.581a1 1 0 0 0-1.816 0l-2.87 6.22l-6.801.807a1 1 0 0 0-.562 1.727l5.03 4.65l-1.335 6.72a1 1 0 0 0 1.469 1.067L12 19.426l5.977 3.346a1 1 0 0 0 1.47-1.068l-1.335-6.718l5.029-4.651a1 1 0 0 0-.562-1.727L15.777 7.8z" />
                  </svg>
                </label>`).join("")}
              </div>
            </div>
          </div>
          <textarea name="review">${review || ""}</textarea>
        </div>
      </article>`;
      html[1] += `<figure data-nav="${index}">
        <img src="${cover || upload}" onload="requestAnimationFrame(()=>{this.removeAttribute('onload')})" />
      </figure>`;
    });
    return editable
      ? `${html[0]}<nav>${html[1]}</nav>`
      : html[0];
  }
}

function freeze(target) {
  const li = document.createElement("li");
  li.role = "option";
  li.ariaSelected = "true";
  li.innerHTML = target.textContent.trim() + `<button type="button"></button>`;
  target.parentElement.append(li);
  target.textContent = "";
}

function collect(container) {
  const item = {};
  for (const el of container.querySelectorAll("[data-name], [name]")) {
    if (el.type === "radio" && !el.checked) continue;
    item[el.dataset.name || el.name] = el.href || el.value || el.textContent;
  }
  item.post = item.post.replace(/\s+/g, "");
  item.genre = [...container.querySelector("[data-name=genre]").children]
    .map(el => el.textContent.trim())
    .filter(Boolean);
  item.words = Number(item.words);
  item.rating = Number(item.rating) || null;
  return item;
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

function navigate(path = location.pathname) {
  const line = doc.link.firstElementChild.children;
  const item = ref.list.get(path.slice(1));
  if (item) {
    document.body.dataset.mode = "view";
    doc.form.view.scrollTop = 0;
    doc.link.href = "/";
    const line = doc.link.firstElementChild.children;
    gsap.to(line[0], { duration: .2, attr: { x1: 6.5, x2: 6.5 }});
    gsap.to(line[1], { duration: .2, attr: { x1: 10.5, x2: 21 }});
    gsap.to(line[2], { duration: .2, attr: { y2: 8 }});
    gsap.to(line[3], { duration: .2, attr: { y2: 16 }});
    doc.form.view.firstElementChild.innerHTML = render([item], "view");
    doc.form.view.querySelectorAll("textarea").forEach((el) => {
      el.style.height = "0";
      el.style.height = `${el.scrollHeight}px`;
    });
  } else if (path === "/import") {
    document.body.dataset.mode = "save";
    doc.link.href = "/";
    gsap.to(line[0], { duration: .2, attr: { x1: 6.5, x2: 6.5 }});
    gsap.to(line[1], { duration: .2, attr: { x1: 10.5, x2: 21 }});
    gsap.to(line[2], { duration: .2, attr: { y2: 8 }});
    gsap.to(line[3], { duration: .2, attr: { y2: 16 }});
  } else {
    if (!item && path !== "/page") history.replaceState(null, "", "/");
    delete document.body.dataset.mode;
    if (!document.body.dataset.auth) {
      doc.form.view.set.disabled = true;
      doc.link.href = "/import";
      gsap.to(line[0], { duration: .2, attr: { x1: 12, x2: 12 }});
      gsap.to(line[1], { duration: .2, attr: { x1: 5.5, x2: 18.5 }});
      gsap.to(line[2], { duration: .2, attr: { y2: 12 }});
      gsap.to(line[3], { duration: .2, attr: { y2: 12 }});
    }
  }
}
