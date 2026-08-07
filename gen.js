import fs from "node:fs/promises";

const file = await fs.readFile("./public/test.html", "utf8");
const html = `export const page = (auth, data) => ${
  JSON.stringify(file
    .replace(/data-auth="true"/, `data-auth="__AUTH__"`)
    .replace(/window\.DATA =.+/, `window.DATA = __DATA__;`)
  )}.replace("__AUTH__", auth).replace("__DATA__", JSON.stringify(data));\n`;
await fs.writeFile("./src/page.js", html);

console.log("Generated src/page.js");