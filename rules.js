import { FLOW, PHASES } from "./content.js";
export function random(seed) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function shuffle(items, rng = Math.random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export function makeLayout(seed) {
  const rng = random(seed);
  return PHASES.map((p) =>
    shuffle([...p.steps, ...p.decoys], rng).map((key, index) => ({
      key,
      slot: index,
      done: false,
    })),
  );
}
export function scoreFor(steps, coins, elapsedMs) {
  return (
    steps * 100 + coins * 10 + Math.max(0, 600 - Math.floor(elapsedMs / 1000))
  );
}
export function acceptStep(progress, key) {
  return key === FLOW[progress]
    ? { ok: true, progress: progress + 1 }
    : { ok: false, progress: 0, expected: FLOW[progress] };
}
export function compareRanks(a, b) {
  return (
    b.score - a.score ||
    a.elapsed_ms - b.elapsed_ms ||
    new Date(a.created_at) - new Date(b.created_at)
  );
}
// Ao alcançar uma borda, reposiciona o drone e aponta para dentro da patrulha.
export function moveDrone(drone, speed, dt) {
  const left = drone.phase * 480 + 80;
  const right = drone.phase * 480 + 365;
  drone.x += drone.dir * speed * dt;
  if (drone.x <= left) {
    drone.x = left;
    drone.dir = 1;
  } else if (drone.x >= right) {
    drone.x = right;
    drone.dir = -1;
  }
}
