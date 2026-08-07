gsap.registerPlugin(Flip);

if (document.body.dataset.auth === "true") auth();
delete document.body.dataset.auth;

doc.list.innerHTML = render.list(DATA);
ref.list = new Map([...doc.list.children].map((node, i) => [node, DATA[i]]));

doc.main.addEventListener("click", (e) => {
  if (e.target.closest(".list li")) {
    doc.form.view.scrollTop = 0;
    document.body.dataset.mode = "view";
    const line = doc.button.firstElementChild.children;
    gsap.to(line[0], { duration: .2, attr: { x1: 6.5, x2: 6.5 }});
    gsap.to(line[1], { duration: .2, attr: { x1: 10.5, x2: 21 }});
    gsap.to(line[2], { duration: .2, attr: { y2: 8 }});
    gsap.to(line[3], { duration: .2, attr: { y2: 16 }});
    doc.form.view.querySelector("article").outerHTML = render.save([ref.list.get(e.target.closest("li"))], false);
    doc.form.view.querySelectorAll("textarea").forEach((el) => {
      el.style.height = "0";
      el.style.height = `${el.scrollHeight}px`;
    });
    return;
  }

  if (e.target.closest(".select") && !e.target.closest(".readonly")) {
    const select = e.target.closest(".select");
    const option = e.target.closest("[role=option]");
    if (option) {
      const input = select.querySelector("input");
      if (!select.role) {
        input.value = option.textContent;
        select.blur();
      } else if (e.target.closest("button")) {
        const box = select.querySelector("[role=textbox]");
        const state = Flip.getState(option.parentElement.children);
        option.remove();
        Flip.from(state, { duration: .2 });
        input.value = [...box.children].map((el) => el.textContent).join(" ").trim();
      } else {
        const ul1 = select.querySelector("[role=textbox]");
        const ul2 = select.querySelector("[role=listbox]");
        const box = option.parentElement === ul1 ? ul2 : ul1;
        const state = Flip.getState(option);
        box.append(option);
        Flip.from(state, { duration: .2, nested: true });
        input.value = [...ul1.children].map((el) => el.textContent).join(" ").trim();
      }
    }
    select.role && select.querySelector("[contenteditable]").focus();
    return;
  }

  if (e.target.closest("[data-nav]")) {
    const nav = e.target.closest("[data-nav]");
    doc.form.save.firstElementChild.children[nav.dataset.nav].scrollIntoView({ behavior: "smooth" });
    return;
  }
});

doc.main.addEventListener("keydown", (e) => {
  if (e.target.closest("li[contenteditable=true]")) {
    if (e.key !== "Enter" || e.repeat) return;
    e.preventDefault();
    const li0 = e.target.closest("li[contenteditable=true]");
    const li1 = document.createElement("li");
    li1.role = "option";
    li1.innerHTML = li0.textContent.trim() + `<button type="button"></button>`;
    li0.parentElement.append(li1);
    li0.textContent = "";
    li0.focus();
    return;
  }

  if (e.target.closest(".date input[type=text]")) {
    const inputs = [...e.target.closest(".date").children];
    const i = inputs.indexOf(e.target.closest("input"));
    if (e.key === "ArrowLeft" && i > 0) {
      e.preventDefault();
      inputs[i - 1].focus();
      return;
    }
    if (["ArrowRight", "-", "/", "."].includes(e.key) && i < 2) {
      e.preventDefault();
      inputs[i + 1].focus();
      return;
    }
    if (!["ArrowUp", "ArrowDown"].includes(e.key)) return;
    e.preventDefault();
    const date = new Date(+inputs[0].value, +inputs[1].value - 1, +inputs[2].value);
    const step = e.key === "ArrowUp" ? 1 : -1;
    if (i === 0) date.setFullYear(date.getFullYear() + step);
    if (i === 1) date.setMonth(date.getMonth() + step);
    if (i === 2) date.setDate(date.getDate() + step);
    inputs[0].value = date.getFullYear();
    inputs[1].value = String(date.getMonth() + 1).padStart(2, "0");
    inputs[2].value = String(date.getDate()).padStart(2, "0");
  }
});

doc.main.addEventListener("beforeinput", (e) => {
  if (!e.target.closest(".date input")) return;
  e.preventDefault();
  if (!/^\d+$/.test(e.data)) return;
  const inputs = [...e.target.closest(".date").children];
  const input = e.target.closest("input");
  const index = inputs.indexOf(input);
  const max = index === 0
    ? 9999
    : index === 1
      ? 12
      : new Date(+inputs[0].value, +inputs[1].value, 0).getDate();
  const len = index === 0 ? 4 : 2;
  const val = input.dataset.value + e.data;
  input.dataset.value = max < val ? e.data : val;
  input.value = input.dataset.value.padStart(len, "0");
  if (index === 1 && input.dataset.value > 1 || index !== 2 && input.dataset.value.length === len) {
    inputs[index + 1].focus();
  }
});

doc.main.addEventListener("focusout", (e) => {
  if (!e.target.closest(".date input")) return;
  const input = e.target.closest(".date input");
  input.dataset.value = input.value;
});

doc.main.addEventListener("dblclick", (e) => {
  if (!e.target.closest(".date")) return;
  const inputs = e.target.closest(".date").children;
  const date = new Date();
  inputs[0].value = date.getFullYear();
  inputs[1].value = `${date.getMonth() + 1}`.padStart(2, "0");
  inputs[2].value = `${date.getDate()}`.padStart(2, "0");
});

doc.form.auth.addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = doc.form.auth;
  form.passcode.disabled = true;
  const res = await fetch("/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ passcode: form.passcode.value })
  })
  const { success } = await res.json();
  if (success) {
    auth();
  } else {
    form.passcode.removeAttribute("disabled");
    form.passcode.readOnly = true;
    setTimeout(() => {
      form.passcode.removeAttribute("readonly");
      form.passcode.select();
    }, 600);
  }
});

doc.form.filter.addEventListener("submit", (e) => {
  e.preventDefault();
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
  const time = performance.now();
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
  doc.form.import.button.removeAttribute("disabled");
  doc.form.save.innerHTML = render.save(json.data);
  json.error = (json.error || []).concat(logs.error || []);
  log(json);
  setTimeout(() => {
    doc.form.save.removeAttribute("class");
    doc.form.save.querySelectorAll("[name=summary]").forEach((el) => {
      el.style.height = "0";
      el.style.height = `${el.scrollHeight}px`;
    });
  }, 1);
});

doc.form.save.addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = [...doc.form.save.querySelectorAll("article")].map((article) => {
    article.querySelector("[type=date]").value
      = [...article.querySelectorAll(".date [type=text]")].map((input) => input.value).join("-");
    const book = Object.fromEntries([...article.querySelectorAll("[data-name], [name]")]
      .filter(el => el.type !== "radio" || el.checked)
      .map(el => [el.dataset.name || el.name, el.textContent || el.value])
    );
    book.genre = book.genre.split(" ");
    book.words = Number(book.words);
    book.rating = Number(book.rating);
    return book;
  });
  const resp = await fetch("/api/data", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(data)
  })
  const json = await resp.json();
  console.log(json)
});

doc.form.view.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (doc.form.view.className) {
    doc.form.view.removeAttribute("class");
    doc.form.view.querySelectorAll("textarea").forEach((el) => el.disabled = false);
    doc.form.view.querySelectorAll("[contenteditable]").forEach((el) => el.contentEditable = true);
  } else {
    doc.form.view.querySelector("[type=date]").value
      = [...doc.form.view.querySelectorAll(".date [type=text]")].map((input) => input.value).join("-");
    const book = Object.fromEntries([...doc.form.view.querySelectorAll("[data-name], [name]")]
      .filter(el => el.type !== "radio" || el.checked)
      .map(el => [el.dataset.name || el.name, el.textContent || el.value])
    );
    book.genre = book.genre.split(" ");
    book.words = Number(book.words);
    book.rating = Number(book.rating);
    console.log(book)
    const resp = await fetch("/api/data", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify([book])
    })
    const json = await resp.json();
    console.log(json)
    doc.form.view.className = "readonly";
    doc.form.view.querySelectorAll("textarea").forEach((el) => el.disabled = true);
    doc.form.view.querySelectorAll("[contenteditable]").forEach((el) => el.contentEditable = false);
  }
});

doc.form.view.querySelector("button").addEventListener("click", () => {
  const readonly = doc.form.view.classList.toggle("readonly");
  doc.form.view.querySelectorAll("textarea").forEach(el => el.disabled = readonly);
  doc.form.view.querySelectorAll("[contenteditable]").forEach(el => el.contentEditable = !readonly);
});

doc.dialog.addEventListener("toggle", () => {
  if (!doc.dialog.open) return;
  setTimeout(() => doc.form.auth.removeAttribute("class"), 1);
});
doc.dialog.addEventListener("cancel", (e) => {
  doc.form.auth.className = "hidden";
  setTimeout(() => doc.dialog.close(), 201);
});
doc.dialog.addEventListener("click", (e) => {
  if (e.target === doc.form.auth) doc.dialog.dispatchEvent(new Event("cancel"));
});

document.body.removeAttribute("class");
