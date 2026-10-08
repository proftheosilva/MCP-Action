import { mkdir, copyFile, cp } from "node:fs/promises";
await mkdir("dist", { recursive: true });
for (const file of [
  "index.html",
  "style.css",
  "game.js",
  "music.js",
  "content.js",
  "rules.js",
  "backend.js",
  "config.js",
])
  await copyFile(file, "dist/" + file);
await cp("assets", "dist/assets", { recursive: true });
console.log("Frontend estático preparado em dist/.");

