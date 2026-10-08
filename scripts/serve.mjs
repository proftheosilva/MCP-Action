import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
const root = resolve(process.cwd());
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".json": "application/json",
};
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    const pathname = decodeURIComponent(url.pathname);
    const file = resolve(
      root,
      "." + (pathname === "/" ? "/index.html" : pathname),
    );
    if (
      !file.startsWith(root + sep) ||
      pathname.split("/").some((part) => part.startsWith(".")) ||
      pathname.startsWith("/supabase/") ||
      pathname.startsWith("/scripts/")
    ) {
      res.writeHead(403).end();
      return;
    }
    if (!(await stat(file)).isFile()) throw Error();
    res.writeHead(200, {
      "Content-Type": mime[extname(file)] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404).end("Não encontrado");
  }
}).listen(8766, "127.0.0.1", () =>
  console.log("MCP Action: http://127.0.0.1:8766"),
);
