import test from "node:test";
import assert from "node:assert/strict";
import { FLOW, PHASES } from "../content.js";
import { makeLayout, acceptStep, scoreFor, compareRanks } from "../rules.js";
test("as portas mudam, mantendo todas as etapas acessíveis nos seis espaços", () => {
  for (let seed = 0; seed < 100; seed++) {
    const layout = makeLayout(seed);
    for (let phase = 0; phase < 3; phase++) {
      assert.equal(
        new Set(layout[phase].map((d) => d.slot)).size,
        layout[phase].length,
      );
      assert.ok(layout[phase].every((d) => d.slot >= 0 && d.slot < 6));
      for (const key of PHASES[phase].steps)
        assert.ok(layout[phase].some((d) => d.key === key));
    }
  }
  assert.notDeepEqual(makeLayout(1), makeLayout(2));
});
test("uma rodada correta percorre as 12 etapas; uma escolha fora da ordem reinicia", () => {
  let progress = 0;
  for (const key of FLOW) {
    const result = acceptStep(progress, key);
    assert.equal(result.ok, true);
    progress = result.progress;
  }
  assert.equal(progress, 12);
  const error = acceptStep(4, "PROMPT");
  assert.equal(error.ok, false);
  assert.equal(error.progress, 0);
  assert.equal(error.expected, "PGVECTOR");
});
test("pontuação recompensa etapas e moedas, e o bônus cai com o tempo", () => {
  assert.equal(scoreFor(12, 30, 60000), 2040);
  assert.equal(scoreFor(12, 30, 700000), 1500);
  assert.ok(scoreFor(12, 20, 60000) > scoreFor(12, 20, 120000));
});
test("empates são ordenados por menor tempo e depois data", () => {
  const rows = [
    { score: 1500, elapsed_ms: 60000, created_at: "2026-10-10" },
    { score: 1600, elapsed_ms: 90000, created_at: "2026-10-10" },
    { score: 1500, elapsed_ms: 50000, created_at: "2026-10-10" },
  ].sort(compareRanks);
  assert.deepEqual(
    rows.map((r) => r.elapsed_ms),
    [90000, 50000, 60000],
  );
});

test("drones saem das bordas nas três fases, mesmo com variação entre quadros", async () => {
  const { moveDrone } = await import('../rules.js');
  for (let phase = 0; phase < 3; phase++) {
    const left = phase * 480 + 80;
    const right = phase * 480 + 365;
    for (const [x, dir] of [[left - 3, -1], [right + 3, 1]]) {
      const drone = { phase, x, dir };
      moveDrone(drone, 142, 0.05);
      moveDrone(drone, 142, 0.001);
      assert.ok(drone.x > left && drone.x < right);
      let turns = 0;
      for (let frame = 0; frame < 3000; frame++) {
        const before = drone.dir;
        moveDrone(drone, 142, frame % 2 ? 0.001 : 0.05);
        if (before !== drone.dir) turns++;
        assert.ok(drone.x >= left && drone.x <= right);
      }
      assert.ok(turns >= 10, 'Drone deve continuar atravessando a patrulha');
    }
  }
});
