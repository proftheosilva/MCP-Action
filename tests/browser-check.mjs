import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
const browser = await chromium.launch({
  headless: true,
  executablePath: resolve(".playwright/chromium-1248/chrome-win64/chrome.exe"),
});
const page = await browser.newPage({ viewport: { width: 1680, height: 1050 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://127.0.0.1:8766");
await page.locator("#nickname").waitFor();
await page.screenshot({ path: "artifacts/inicio.png", fullPage: true });
await page.locator("#nickname").fill("TheoWASD");
assert.equal(await page.locator("#nickname").inputValue(), "TheoWASD");
let progress = 0,
  seed = 17;
await page.route("**/rest/v1/rpc/**", async (route) => {
  const name = route.request().url().split("/").pop(),
    body = route.request().postDataJSON();
  let data;
  if (name === "mcp_action_start") {
    progress = 0;
    data = {
      run_id: "00000000-0000-4000-8000-000000000001",
      token: "00000000-0000-4000-8000-000000000002",
      seed: seed++,
    };
  } else if (name === "mcp_action_step") {
    const { FLOW } = await import("../content.js");
    const ok = body.p_step === FLOW[progress];
    if (ok) progress++;
    data = {
      ok,
      progress,
      expected: FLOW[progress],
      completed: progress === 12,
      score: progress * 100 + body.p_coins * 10 + 300,
      elapsed_ms: 65000,
    };
  } else if (name === "mcp_action_pause") data = { paused: body.p_pause };
  else data = [];
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(data),
  });
});
await page.evaluate(async () => {
  const m = await import("./game.js");
  window.inspectGame = m.inspectGame;
});
const state = () => page.evaluate(() => window.inspectGame());
async function hold(key, ms) {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
}
async function xTo(x) {
  for (let i = 0; i < 100; i++) {
    const s = await state(),
      d = x - s.player.x;
    if (Math.abs(d) < 7) return;
    await hold(
      d > 0 ? "ArrowRight" : "ArrowLeft",
      Math.min(150, (Math.abs(d) / 205) * 1000),
    );
  }
  throw Error("Não alcançou x " + x);
}
async function floorTo(y) {
  let s = await state();
  if (Math.abs(s.player.y - y) < 2) return;
  await xTo(s.phase * 480 + 407);
  // Subir um pouco além do piso intermediário e soltar para pousar nele.
  const target = y === 510 ? 503 : y;
  const ascending = s.player.y > target;
  for (let i = 0; i < 100; i++) {
    s = await state();
    const delta = target - s.player.y;
    if (ascending ? s.player.y <= target + 0.01 : s.player.y >= target - 0.01)
      break;
    await hold(
      delta < 0 ? "ArrowUp" : "ArrowDown",
      Math.max(25, Math.min(100, (Math.abs(delta) / 175) * 1000)),
    );
  }
  await page.waitForTimeout(400);
  s = await state();
  assert.ok(Math.abs(s.player.y - y) < 3, "piso " + y + " atual " + s.player.y);
}
await page.locator("#startButton").click();
await page.waitForTimeout(150);
assert.equal((await state()).mode, "playing");
await page.screenshot({ path: "artifacts/jogo.png", fullPage: true });
await page.locator("#pause").click();
const before = (await state()).elapsed;
await page.waitForTimeout(400);
assert.ok(Math.abs((await state()).elapsed - before) < 80);
await page.locator("#resume").click();
// Percorrer as portas de verdade, usando o teclado e os pisos do jogo.
const { FLOW, CONTRACT } = await import("../content.js");
for (let index = 0; index < FLOW.length; index++) {
  let s = await state();
  const door = s.layout[s.phase].find((d) => d.key === FLOW[index]);
  await floorTo(door.y);
  await xTo(door.x);
  await page.keyboard.press("KeyE");
  if (FLOW[index] === "SERVIDOR_MCP") {
    await page
      .getByRole("button", {
        name: CONTRACT[17 % CONTRACT.length].answer,
        exact: true,
      })
      .click();
  }
  await page.waitForFunction(
    (target) => window.inspectGame().progress === target,
    index + 1,
    { timeout: 5000 },
  );
  if (index === 2 || index === 6) {
    s = await state();
    await floorTo(710);
    await xTo(s.phase * 480 + 449);
    await page.keyboard.press("KeyE");
    await page
      .getByRole("button", { name: new RegExp("INICIAR FASE") })
      .click();
    s = await state();
    assert.equal(s.layout[s.phase].filter((d) => d.done).length, 0);
  }
  if (index === 3)
    await page.screenshot({ path: "artifacts/fase2.png", fullPage: true });
  if (index === 7)
    await page.screenshot({ path: "artifacts/fase3.png", fullPage: true });
  console.log("Etapa verificada:", index + 1, FLOW[index]);
}
assert.equal((await state()).mode, "won");
await page.screenshot({ path: "artifacts/concluido.png", fullPage: true });
await page.locator("#playAgain").click();
await page.locator("#startButton").click();
let s = await state();
const wrong = s.layout[0].find((d) => d.key !== "HOST");
await floorTo(wrong.y);
await xTo(wrong.x);
await page.keyboard.press("KeyE");
await page.waitForTimeout(200);
s = await state();
assert.equal(s.mode, "failed");
assert.equal(s.progress, 0);
assert.equal(s.score, 0);
assert.equal(s.coins, 0);
assert.equal(s.elapsed, 0);
await page.screenshot({ path: "artifacts/erro.png", fullPage: true });
await page.locator("#restart").click();
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({ path: "artifacts/mobile.png", fullPage: true });
assert.ok(
  await page.evaluate(
    () => document.documentElement.scrollWidth <= innerWidth + 1,
  ),
);
assert.deepEqual(errors, []);
console.log(
  "Navegação das três fases, pausa, objetivos pendentes, erro com reinício, apelido e layout móvel verificados. RPCs simuladas; Supabase real é verificado separadamente.",
);
await browser.close();
