import { updateMusic } from "./music.js";
import { PHASES, DOORS, FLOW, CONTRACT, VERSION } from "./content.js";
import { makeLayout, random, shuffle, acceptStep, scoreFor, moveDrone } from "./rules.js";
import { loadRanking, beginRun, checkpoint, pauseRun } from "./backend.js";
const $ = (id) => document.getElementById(id);
const canvas = $("game"),
  ctx = canvas.getContext("2d");
const W = 1440,
  H = 810,
  FLOORS = [710, 510, 310];
const keys = new Set();
let phase = 0,
  progress = 0,
  coins = 0,
  score = 0,
  mode = "loading",
  practice = false,
  nickname = "",
  run = null;
let layout = [],
  collectibles = [],
  drones = [],
  player = { x: 52, y: 710, vy: 0, dir: 1 },
  lift = [710, 710, 710],
  liftTrip = null;
let elapsed = 0,
  frameTime = 0,
  anim = 0,
  stun = 0,
  invincible = 0,
  powerTime = 0,
  toastUntil = 0,
  finalData = null;
let audio = null,
  audioEnabled = true,
  rankingBusy = false,
  helpResume = false,
  winSaving = false;
let art = {},
  frames = [];
let lastChoice = 0;
const near = (a, b, d) => Math.abs(a - b) < d;
const activeClock = () => ["playing", "checking", "contract"].includes(mode);
function escapeHTML(value) {
  return String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}
function timeText(ms) {
  const secs = Math.floor(ms / 1000);
  return `${String(Math.floor(secs / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;
}
function playSound(type) {
  if (!audioEnabled) return;
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    audio.resume();
    const o = audio.createOscillator(),
      g = audio.createGain();
    o.type = "square";
    o.frequency.value =
      type === "coin"
        ? 880
        : type === "error"
          ? 130
          : type === "door"
            ? 570
            : 720;
    g.gain.setValueAtTime(0.04, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.13);
    o.connect(g);
    g.connect(audio.destination);
    o.start();
    o.stop(audio.currentTime + 0.14);
  } catch {}
}
function showToast(text, seconds = 3) {
  $("toast").textContent = text;
  $("toast").classList.add("show");
  toastUntil = performance.now() + seconds * 1000;
}
function showModal(html) {
  $("modalContent").innerHTML = html;
  $("overlay").classList.remove("hidden");
  keys.clear();
}
function hideModal() {
  $("overlay").classList.add("hidden");
  canvas.focus();
  keys.clear();
}
function updateHUD() {
  $("playerName").textContent = nickname || "—";
  $("clock").textContent = timeText(elapsed);
  $("coins").textContent = coins;
  $("score").textContent = score;
  $("stepCount").textContent = `${progress} / 12 etapas`;
  $("phases").innerHTML = PHASES.map(
    (p, i) =>
      `<div class="phase ${i === phase ? "active" : i < phase ? "done" : ""}"><strong>${i < phase ? "✓" : i === phase ? "➜" : "🔒"} ${i + 1} · ${p.title}</strong><small>${p.subtitle}</small></div>`,
  ).join("");
  $("pause").disabled = !["playing", "paused"].includes(mode);
  $("pause").textContent = mode === "paused" ? "Continuar" : "Pausar";
  if (mode === "won") {
    $("missionTitle").textContent = "Missão concluída!";
    $("missionText").textContent =
      "Você separou a chamada MCP, a recuperação e a geração da resposta.";
    return;
  }
  const end = [3, 7, 12][phase];
  if (progress >= end) {
    $("missionTitle").textContent = "Setor concluído · vá ao portal";
    $("missionText").textContent =
      "O portal fica à direita, no piso inferior. Use E para avançar.";
  } else {
    $("missionTitle").textContent =
      `Missão ${phase + 1} · Etapa ${progress + 1}`;
    $("missionText").textContent =
      "Pergunta: “Quais notebooks foram comprados?” · Identifique a próxima porta da sequência.";
  }
}
function intro(message = "") {
  mode = "intro";
  updateHUD();
  showModal(
    `<h1>MCP ACTION</h1><p>A torre do RAG</p><p>Leve a pergunta do Host até a resposta. As portas mudam de lugar a cada partida; a ordem dos conceitos permanece.</p><p><b>Escolher fora da ordem zera a rodada inteira.</b></p><label>Seu apelido<input id="nickname" maxlength="20" autocomplete="nickname" placeholder="Ex.: Theo" value="${escapeHTML(localStorage.getItem("mcp-action-nickname") || "")}"></label><p id="startError" class="error-text">${escapeHTML(message)}</p><div class="actions"><button class="primary" id="startButton">INICIAR COM RANKING</button><button id="practiceButton">Praticar sem ranking</button></div><p class="notice">Setas/WASD: mover · Espaço: saltar · E: escolher porta · P: pausar.</p>`,
  );
  $("startButton").onclick = () => start(false);
  $("practiceButton").onclick = () => start(true);
  $("nickname").addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Enter") start(false);
  });
  $("nickname").focus();
}
function prepareRound(seed) {
  phase = 0;
  progress = 0;
  coins = 0;
  score = 0;
  elapsed = 0;
  finalData = null;
  stun = 0;
  invincible = 0;
  powerTime = 0;
  liftTrip = null;
  lift = [710, 710, 710];
  layout = makeLayout(seed);
  const rng = random(seed + 71);
  collectibles = [];
  drones = [];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 10; j++) {
      const floor = FLOORS[j % 3];
      collectibles.push({
        phase: i,
        x: i * 480 + 85 + (j % 4) * 86,
        y: floor - 35 - (j % 2 ? 36 : 0),
        taken: false,
      });
    }
    for (let j = 0; j < 2; j++)
      drones.push({
        phase: i,
        row: j,
        y: FLOORS[j] - 52,
        x: i * 480 + 160 + rng() * 100,
        dir: rng() < 0.5 ? -1 : 1,
      });
  }
  player = { x: 52, y: 710, vy: 0, dir: 1 };
  keys.clear();
}
async function start(local) {
  playSound("door");
  nickname = $("nickname")?.value.trim() || nickname;
  if (!/^[\p{L}\p{N} _.-]{2,20}$/u.test(nickname)) {
    $("startError").textContent =
      "Use um apelido de 2 a 20 caracteres: letras, números, espaço, ponto, hífen ou sublinhado.";
    return;
  }
  localStorage.setItem("mcp-action-nickname", nickname);
  $("startButton")?.setAttribute("disabled", "");
  $("practiceButton")?.setAttribute("disabled", "");
  try {
    practice = local;
    run = local ? null : await beginRun(nickname);
    prepareRound(run?.seed ?? crypto.getRandomValues(new Uint32Array(1))[0]);
    mode = "playing";
    hideModal();
    updateHUD();
    showToast(
      practice
        ? "Modo prática: esta partida não entra no ranking."
        : "Rodada iniciada! Procure a primeira etapa.",
    );
  } catch (e) {
    intro(
      e.message +
        " Você pode usar o modo prática enquanto a conexão é preparada.",
    );
  }
}
function doorPosition(tower, slot) {
  return {
    x: tower * 480 + (slot % 2 ? 280 : 140),
    y: FLOORS[Math.floor(slot / 2)],
  };
}
function doorNear() {
  return layout[phase]?.find((d) => {
    const p = doorPosition(phase, d.slot);
    return !d.done && near(player.x, p.x, 44) && near(player.y, p.y, 14);
  });
}
function grounded() {
  return FLOORS.some((y) => near(player.y, y, 1)) && !liftTrip;
}
function fail(key, expected, explanation) {
  playSound("error");
  mode = "failed";
  coins = 0;
  score = 0;
  elapsed = 0;
  progress = 0;
  phase = 0;
  liftTrip = null;
  player = { x: 52, y: 710, vy: 0, dir: 1 };
  updateHUD();
  showModal(
    `<h2>FLUXO INTERROMPIDO</h2><p>Você escolheu <b>${escapeHTML(DOORS[key]?.name || key)}</b>.</p><p>A próxima etapa era <b>${escapeHTML(DOORS[expected]?.name || expected)}</b>.</p><p>${escapeHTML(explanation || DOORS[key]?.detail || "Retome a sequência do processo.")}</p><p>Pontos, moedas, tempo e progresso foram zerados.</p><div class="actions"><button class="primary" id="restart">COMEÇAR NOVA RODADA</button></div>`,
  );
  $("restart").onclick = () => intro();
}
function contractChallenge(key) {
  const question =
    CONTRACT[
      run
        ? Math.abs(run.seed) % CONTRACT.length
        : Math.floor(Math.random() * CONTRACT.length)
    ];
  mode = "contract";
  const choices = shuffle([question.answer, question.wrong]);
  showModal(
    `<h2>CONTRATO DA FERRAMENTA</h2><p>${escapeHTML(question.question)}</p><div class="actions">${choices.map((c, i) => `<button id="choice${i}">${escapeHTML(c)}</button>`).join("")}</div><p class="notice">A ferramenta só pode executar a capacidade e os limites definidos.</p>`,
  );
  choices.forEach((choice, i) => {
    $("choice" + i).onclick = () => {
      if (choice === question.answer) {
        hideModal();
        sendDoor(key);
      } else {
        if (!practice)
          checkpoint(run, "CONTRATO_INVALIDO", coins).catch(() => {});
        fail("APAGAR", key, question.explanation);
      }
    };
  });
}
async function sendDoor(key) {
  const result = acceptStep(progress, key);
  mode = "checking";
  keys.clear();
  try {
    const response = practice
      ? { ...result, completed: result.ok && result.progress === 12 }
      : await checkpoint(run, key, coins);
    if (!response.ok) {
      fail(key, response.expected || result.expected);
      return;
    }
    progress = response.progress;
    layout[phase].find((d) => d.key === key).done = true;
    score = progress * 100 + coins * 10;
    playSound("door");
    if (response.completed) {
      finalData = response;
      finish();
      return;
    }
    mode = "playing";
    updateHUD();
    showToast(DOORS[key].hint, 4);
  } catch (e) {
    mode = "playing";
    showToast("Não foi possível confirmar a etapa: " + e.message, 6);
    updateHUD();
  }
}
function interact() {
  if (mode !== "playing" || stun > 0 || performance.now() - lastChoice < 300)
    return;
  lastChoice = performance.now();
  const end = [3, 7, 12][phase];
  if (
    progress === end &&
    phase < 2 &&
    near(player.x, phase * 480 + 449, 30) &&
    near(player.y, 710, 16)
  ) {
    nextPhase();
    return;
  }
  const door = doorNear();
  if (!door) {
    showToast("Aproxime-se de uma porta e pressione E. Elevador: ↑ ou ↓.", 2);
    return;
  }
  if (door.key === "SERVIDOR_MCP" && FLOW[progress] === door.key) {
    contractChallenge(door.key);
    return;
  }
  sendDoor(door.key);
}
function nextPhase() {
  phase++;
  player = { x: phase * 480 + 52, y: 710, vy: 0, dir: 1 };
  mode = "phase";
  updateHUD();
  showModal(
    `<h2>FASE ${phase + 1} · ${PHASES[phase].title}</h2><p>${PHASES[phase].subtitle}</p><p>${phase === 1 ? "A base já foi ingerida. Agora leve a pergunta ao modelo de embeddings e siga até o contexto." : "O prompt está pronto. A LLM gera dentro do backend RAG, e a resposta percorre o caminho de volta."}</p><p>As portas desta fase estão embaralhadas.</p><div class="actions"><button class="primary" id="continuePhase">INICIAR FASE ${phase + 1}</button></div>`,
  );
  // O tempo inclui a transição entre fases. A pausa explícita é descontada pelo servidor.
  const phasePause = practice ? Promise.resolve() : pauseRun(run, true);
  phasePause.catch(() =>
    showToast(
      "Falha ao pausar no servidor. O tempo final pode incluir a transição.",
      5,
    ),
  );
  $("continuePhase").onclick = async () => {
    try {
      await phasePause;
      if (!practice) await pauseRun(run, false);
      mode = "playing";
      hideModal();
      updateHUD();
    } catch (e) {
      showToast(e.message, 5);
    }
  };
}
function finish() {
  mode = "won";
  score = practice ? scoreFor(progress, coins, elapsed) : finalData.score;
  if (!practice) elapsed = finalData.elapsed_ms;
  updateHUD();
  playSound("win");
  refreshRanking();
  showModal(
    `<h2>TORRE CONCLUÍDA!</h2><p>${escapeHTML(nickname)}, você levou a pergunta pelo MCP e pelo RAG até a resposta.</p><div class="summary"><span><strong>${score}</strong>pontos</span><span><strong>${timeText(elapsed)}</strong>tempo</span><span><strong>${coins}</strong>moedas</span></div><p>${practice ? "Partida de prática: não registrada no ranking." : "Seu resultado foi salvo no Supabase. O ranking mostra a melhor partida de cada apelido."}</p><p class="notice">100 por etapa + 10 por moeda + bônus de rapidez (até 600).</p><div class="actions"><button class="primary" id="playAgain">JOGAR NOVAMENTE</button></div>`,
  );
  $("playAgain").onclick = () => intro();
}
async function togglePause() {
  if (!["playing", "paused"].includes(mode)) return;
  const pause = mode === "playing";
  mode = "checking";
  keys.clear();
  try {
    if (!practice) await pauseRun(run, pause);
    mode = pause ? "paused" : "playing";
    if (pause) {
      showModal(
        '<h2>PAUSADO</h2><p>Movimento e cronômetro parados.</p><div class="actions"><button class="primary" id="resume">CONTINUAR</button></div>',
      );
      $("resume").onclick = togglePause;
    } else hideModal();
    updateHUD();
  } catch (e) {
    mode = pause ? "playing" : "paused";
    showToast(e.message, 5);
    updateHUD();
  }
}
async function showHelp() {
  helpResume = mode === "playing";
  if (helpResume) {
    try {
      if (!practice) await pauseRun(run, true);
    } catch (e) {
      showToast("Não foi possível pausar: " + e.message);
      return;
    }
    mode = "paused";
  }
  if (!["intro", "paused", "won", "failed"].includes(mode)) return;
  showModal(
    '<h2>COMO JOGAR</h2><ol><li>Use ← → ou A D para caminhar. Espaço salta.</li><li>À esquerda de cada setor há um elevador: fique sobre ele e use ↑ ou ↓.</li><li>À direita há uma escada: ↑ e ↓ mudam de piso.</li><li>Leia as portas. Chegue perto e use E para confirmar a próxima etapa.</li><li>Concluiu o setor? Vá ao portal no piso inferior, à direita, e pressione E.</li><li>Fluxo errado ou contrato inválido reinicia toda a rodada.</li><li>Moedas dão 10 pontos. Ao pegar uma, drones ficam fracos por 4 segundos.</li><li>Colisão com drone forte atordoa por 1 segundo; o tempo continua contando.</li><li>Ao concluir: 100 por etapa + moedas + bônus de tempo. Empate: menor tempo.</li></ol><p>Use apelidos diferentes: o ranking guarda a melhor partida de cada apelido.</p><div class="actions"><button class="primary" id="closeHelp">ENTENDI</button></div>',
  );
  $("closeHelp").onclick = () => {
    if (helpResume) {
      mode = "paused";
      togglePause();
    } else if (mode === "paused") {
      showModal(
        '<h2>PAUSADO</h2><p>Movimento e cronômetro parados.</p><div class="actions"><button class="primary" id="resume">CONTINUAR</button></div>',
      );
      $("resume").onclick = togglePause;
    } else intro();
  };
  updateHUD();
}
async function refreshRanking() {
  if (rankingBusy) return;
  rankingBusy = true;
  try {
    const rows = await loadRanking(Number($("rankLimit").value));
    $("ranking").replaceChildren();
    if (!rows.length) {
      const p = document.createElement("p");
      p.textContent = "A primeira missão concluída abre o placar.";
      $("ranking").append(p);
    }
    for (let i = 0; i < rows.length; i++) {
      const row = document.createElement("div");
      row.className = "rank-row";
      const pos = document.createElement("span");
      pos.className = "position";
      pos.textContent = i + 1;
      const name = document.createElement("span");
      name.className = "name";
      name.textContent = rows[i].nickname;
      const result = document.createElement("span");
      result.className = "result";
      result.textContent = rows[i].score;
      const time = document.createElement("small");
      time.textContent =
        timeText(rows[i].elapsed_ms) + " · " + rows[i].coins + " moedas";
      result.append(time);
      row.append(pos, name, result);
      $("ranking").append(row);
    }
    $("rankStatus").textContent =
      "Placar compartilhado · atualização a cada 10 s";
  } catch (e) {
    $("ranking").textContent = "Ranking indisponível no momento.";
    $("rankStatus").textContent = e.message;
  } finally {
    rankingBusy = false;
  }
}
function move(dt) {
  if (mode !== "playing") return;
  stun = Math.max(0, stun - dt);
  invincible = Math.max(0, invincible - dt);
  powerTime = Math.max(0, powerTime - dt);
  const left = keys.has("ArrowLeft") || keys.has("KeyA"),
    right = keys.has("ArrowRight") || keys.has("KeyD");
  const up = keys.has("ArrowUp") || keys.has("KeyW"),
    down = keys.has("ArrowDown") || keys.has("KeyS");
  const startX = phase * 480,
    ladderX = startX + 407,
    liftX = startX + 43;
  if (liftTrip) {
    const delta = liftTrip.target - player.y,
      step = Math.sign(delta) * Math.min(Math.abs(delta), 180 * dt);
    player.y += step;
    player.x = liftX;
    lift[phase] = player.y;
    if (Math.abs(delta) < 1) {
      player.y = liftTrip.target;
      lift[phase] = player.y;
      liftTrip = null;
    }
  } else if (stun <= 0) {
    const climbing = near(player.x, ladderX, 24) && (up || down);
    if (climbing) {
      player.x = ladderX;
      player.vy = 0;
      player.y = Math.max(
        310,
        Math.min(710, player.y + (down ? 1 : -1) * 175 * dt),
      );
    } else if (
      near(player.x, liftX, 28) &&
      near(player.y, lift[phase], 15) &&
      (up || down)
    ) {
      const index = FLOORS.reduce(
        (best, y, i) =>
          Math.abs(y - player.y) < Math.abs(FLOORS[best] - player.y) ? i : best,
        0,
      );
      const next = Math.max(0, Math.min(2, index + (up ? 1 : -1)));
      if (next !== index) liftTrip = { target: FLOORS[next] };
    } else {
      if (left || right) {
        player.dir = left ? -1 : 1;
        player.x += (left ? -1 : 1) * 205 * dt;
      }
      if (keys.has("Space") && grounded()) {
        player.vy = -460;
        keys.delete("Space");
      }
      const oldY = player.y;
      player.vy += 1400 * dt;
      player.y += player.vy * dt;
      if (player.vy >= 0) {
        const floor = [310, 510, 710].find(
          (y) => oldY <= y + 0.5 && player.y >= y,
        );
        if (floor !== undefined) {
          player.y = floor;
          player.vy = 0;
        }
      }
    }
  }
  player.x = Math.max(startX + 24, Math.min(startX + 456, player.x));
  if (player.y > 710) {
    player.y = 710;
    player.vy = 0;
  }
  for (const coin of collectibles) {
    if (
      coin.phase === phase &&
      !coin.taken &&
      near(player.x, coin.x, 25) &&
      near(player.y - 40, coin.y, 46)
    ) {
      coin.taken = true;
      coins++;
      score += 10;
      powerTime = 4;
      playSound("coin");
      updateHUD();
    }
  }
  for (const drone of drones) {
    if (drone.phase !== phase) continue;
    moveDrone(drone, 70 + progress * 6, dt);
    if (
      powerTime <= 0 &&
      invincible <= 0 &&
      stun <= 0 &&
      near(player.x, drone.x, 33) &&
      near(player.y - 45, drone.y, 32)
    ) {
      stun = 1;
      invincible = 2;
      playSound("error");
      showToast("Drone forte: atordoamento por 1 segundo.", 2);
      updateHUD();
    }
  }
}
function rect(x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}
function text(
  str,
  x,
  y,
  size = 15,
  color = "#ddf4ff",
  align = "left",
  maxWidth,
) {
  ctx.font = `700 ${size}px monospace`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.fillText(str, x, y, maxWidth);
}
function line(x, y, x2, y2, color, width = 2) {
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.moveTo(x, y);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}
function icon(type, x, y, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 3;
  if (type === "monitor") {
    ctx.strokeRect(x - 17, y - 14, 34, 25);
    ctx.fillRect(x - 2, y + 12, 4, 9);
    ctx.fillRect(x - 12, y + 21, 24, 3);
  } else if (type === "database") {
    ctx.beginPath();
    ctx.ellipse(x, y - 12, 17, 6, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 17, y - 12);
    ctx.lineTo(x - 17, y + 15);
    ctx.ellipse(x, y + 15, 17, 6, 0, 0, Math.PI);
    ctx.lineTo(x + 17, y - 12);
    ctx.stroke();
    line(x - 17, y, x + 17, y, color);
  } else if (type === "shield") {
    ctx.beginPath();
    ctx.moveTo(x, y - 20);
    ctx.lineTo(x + 18, y - 12);
    ctx.lineTo(x + 14, y + 12);
    ctx.lineTo(x, y + 24);
    ctx.lineTo(x - 14, y + 12);
    ctx.lineTo(x - 18, y - 12);
    ctx.closePath();
    ctx.stroke();
    line(x - 8, y, x - 1, y + 8, color);
    line(x - 1, y + 8, x + 10, y - 7, color);
  } else if (type === "document") {
    ctx.strokeRect(x - 14, y - 22, 28, 42);
    for (let j = 0; j < 4; j++) ctx.fillRect(x - 9, y - 11 + j * 8, 18, 3);
  } else if (type === "vector") {
    for (let j = 0; j < 4; j++)
      ctx.fillRect(x - 20 + j * 11, y + 16 - (j + 1) * 8, 6, (j + 1) * 8);
  } else if (type === "brain") {
    text("LLM", x, y + 5, 15, color, "center");
    ctx.strokeRect(x - 24, y - 24, 48, 48);
  } else if (type === "user") {
    ctx.beginPath();
    ctx.arc(x, y - 10, 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeRect(x - 13, y + 4, 26, 18);
  } else if (type === "danger") {
    text("?", x, y + 8, 32, color, "center");
  } else {
    text("⚙", x, y + 13, 35, color, "center");
  }
  ctx.restore();
}
function drawDoor(tower, door) {
  if (door.done) return;
  const pos = doorPosition(tower, door.slot),
    active = tower === phase,
    color = PHASES[tower].color;
  ctx.save();
  ctx.globalAlpha = active ? 1 : 0.45;
  const x = pos.x - 42,
    y = pos.y - 106;
  ctx.shadowColor = color;
  ctx.shadowBlur = active ? 14 : 0;
  rect(x - 5, y - 5, 94, 109, "#061126");
  rect(x, y, 84, 104, "#173251");
  rect(x + 4, y + 5, 76, 97, color);
  rect(x + 9, y + 9, 66, 93, "#062549");
  ctx.shadowBlur = 0;
  rect(x + 13, y + 14, 58, 84, "#0b3052");
  rect(x + 17, y + 16, 3, 74, color);
  rect(x + 64, y + 16, 3, 74, color);
  rect(x + 6, y + 93, 72, 5, "#fed952");
  icon(DOORS[door.key].icon, pos.x, y + 52, color);
  rect(pos.x - 66, y - 43, 132, 34, "#03152e");
  ctx.strokeStyle = color;
  ctx.strokeRect(pos.x - 66, y - 43, 132, 34);
  const words = DOORS[door.key].name.split(" "),
    lines = [""];
  for (const word of words) {
    const last = lines.length - 1;
    if ((lines[last] + " " + word).trim().length > 15 && lines[last])
      lines.push(word);
    else lines[last] = (lines[last] + " " + word).trim();
  }
  lines
    .slice(0, 2)
    .forEach((label, index) =>
      text(
        label,
        pos.x,
        y - (lines.length > 1 ? 29 : 20) + index * 13,
        12,
        "#f3fbff",
        "center",
        124,
      ),
    );
  if (active && doorNear() === door && mode === "playing") {
    text("E · ENTRAR", pos.x, y - 49, 12, "#ffeb7b", "center");
  }
  ctx.restore();
}
function drawPlatform(x, y, width) {
  rect(x, y, width, 18, "#143b63");
  rect(x, y, width, 4, "#7ecbe7");
  rect(x, y + 4, width, 3, "#e5ba47");
  rect(x, y + 15, width, 4, "#061126");
  for (let i = x; i < x + width; i += 32) {
    rect(i + 2, y + 8, 24, 6, "#27577e");
    rect(i + 4, y + 10, 3, 2, "#77a9c5");
  }
}
function drawDrone(drone) {
  const weak = powerTime > 0 && drone.phase === phase;
  ctx.save();
  ctx.shadowColor = weak ? "#73efc6" : "#ff764c";
  ctx.shadowBlur = weak ? 2 : 12;
  ctx.globalAlpha = weak ? 0.25 + 0.35 * (1 + Math.sin(anim * 18)) : 1;
  rect(drone.x - 23, drone.y - 6, 46, 12, "#102c4a");
  rect(drone.x - 35, drone.y - 14, 24, 4, "#427ca3");
  rect(drone.x + 11, drone.y - 14, 24, 4, "#427ca3");
  rect(drone.x - 30, drone.y - 17, 14, 2, "#b2ebfc");
  rect(drone.x + 16, drone.y - 17, 14, 2, "#b2ebfc");
  rect(drone.x - 15, drone.y - 10, 30, 20, "#407ba4");
  rect(drone.x - 26, drone.y - 10, 15, 3, "#93d9eb");
  rect(drone.x + 11, drone.y - 10, 15, 3, "#93d9eb");
  ctx.fillStyle = weak ? "#7affc5" : "#ff7450";
  ctx.beginPath();
  ctx.arc(drone.x, drone.y, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
function drawHero() {
  if (!art.hero || !frames.length) return;
  const walking =
    mode === "playing" &&
    (keys.has("ArrowLeft") ||
      keys.has("ArrowRight") ||
      keys.has("KeyA") ||
      keys.has("KeyD"));
  let frame =
    mode === "won"
      ? 5
      : liftTrip
        ? 0
        : near(player.x, phase * 480 + 407, 25) &&
            (keys.has("ArrowUp") || keys.has("ArrowDown"))
          ? 4
          : player.vy !== 0
            ? 3
            : walking
              ? 1 + (Math.floor(anim * 9) % 2)
              : 0;
  const f = frames[frame],
    scale = 0.2,
    width = f.w * scale,
    height = f.h * scale;
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.scale(player.dir, 1);
  if (stun > 0) ctx.globalAlpha = 0.35 + 0.65 * (Math.sin(anim * 30) > 0);
  ctx.drawImage(
    art.hero,
    f.x,
    f.y,
    f.w,
    f.h,
    -width / 2,
    -height,
    width,
    height,
  );
  ctx.restore();
}
function draw() {
  const narrow = innerWidth < 780;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  if (narrow) ctx.setTransform(3, 0, 0, 1, -phase * 480 * 3, 0);
  if (art.background) ctx.drawImage(art.background, 0, 0, W, H);
  rect(0, 0, W, H, "#00143230");
  for (let i = 0; i < 3; i++) {
    const x = i * 480;
    line(x + 2, 0, x + 2, H, "#45a7ce", 4);
    line(x + 477, 0, x + 477, H, "#0b335e", 4);
    rect(x + 15, 25, 450, 79, "#061b33e8");
    text(
      `${i + 1} · ${PHASES[i].title}`,
      x + 240,
      57,
      18,
      PHASES[i].color,
      "center",
      420,
    );
    text(
      i === phase ? "SETOR ATIVO" : i < phase ? "CONCLUÍDO" : "AGUARDANDO",
      x + 240,
      85,
      12,
      i === phase ? "#ffe16a" : "#8ba8c0",
      "center",
    );
    for (const y of FLOORS) drawPlatform(x + 12, y, 456);
    // Escada de circulação: sempre conecta os três pisos, independentemente do embaralhamento.
    for (let yy = 307; yy < 711; yy += 18) {
      rect(x + 395, yy, 24, 4, "#79accb");
    }
    rect(x + 394, 306, 4, 404, "#183655");
    rect(x + 417, 306, 4, 404, "#759cba");
    rect(x + 18, 288, 4, 423, "#467da1");
    rect(x + 63, 288, 4, 423, "#467da1");
    drawPlatform(x + 22, lift[i], 40);
    text("↑↓", x + 43, lift[i] - 9, 15, "#ffe16a", "center");
    for (const door of layout[i] || []) drawDoor(i, door);
    const done = progress >= [3, 7, 12][i];
    rect(x + 433, 630, 30, 80, done ? "#2c8a78" : "#172b43");
    rect(x + 437, 634, 22, 72, "#091d35");
    text(
      done ? "SAÍDA" : "🔒",
      x + 448,
      626,
      11,
      done ? "#ffe16a" : "#728ea9",
      "center",
    );
    if (i !== phase) {
      rect(x + 5, 110, 470, 625, i < phase ? "#04172e65" : "#04152e90");
    }
  }
  for (const coin of collectibles) {
    if (coin.taken) continue;
    ctx.save();
    ctx.globalAlpha = coin.phase === phase ? 1 : 0.3;
    const width = 5 + Math.abs(Math.sin(anim * 3 + coin.x)) * 7;
    ctx.shadowBlur = 12;
    ctx.shadowColor = "#ffda38";
    rect(coin.x - width, coin.y - 11, width * 2, 22, "#fbbb23");
    ctx.shadowBlur = 0;
    rect(
      coin.x - width + 3,
      coin.y - 8,
      Math.max(2, width * 2 - 6),
      16,
      "#fff077",
    );
    ctx.restore();
  }
  for (const drone of drones) drawDrone(drone);
  drawHero();
  rect(12, 758, W - 24, 38, "#05142ee8");
  text(
    "PERGUNTA: Quais notebooks foram comprados?",
    narrow ? phase * 480 + 18 : 27,
    782,
    narrow ? 11 : 16,
    "#ffed88",
  );
  if (!narrow)
    text(
      practice
        ? "PRÁTICA · SEM RANKING"
        : "MCP → API RAG → BUSCA → LLM → RETORNO",
      W - 27,
      782,
      12,
      practice ? "#ffbc93" : "#9debfa",
      "right",
    );
}
function tick(t) {
  updateMusic(audio, audioEnabled, activeClock() && !document.hidden);
  const realDt = (t - frameTime) / 1000 || 0;
  const dt = Math.min(realDt, 0.05);
  frameTime = t;
  anim += dt;
  if (activeClock()) elapsed += realDt * 1000;
  move(dt);
  draw();
  $("clock").textContent = timeText(elapsed);
  if (toastUntil && t > toastUntil) {
    $("toast").classList.remove("show");
    toastUntil = 0;
  }
  requestAnimationFrame(tick);
}
const relevant = [
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "KeyA",
  "KeyD",
  "KeyW",
  "KeyS",
  "Space",
  "KeyE",
  "KeyP",
];
window.addEventListener("keydown", (e) => {
  if (
    ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(
      document.activeElement?.tagName,
    )
  )
    return;
  if (!relevant.includes(e.code)) return;
  e.preventDefault();
  keys.add(e.code);
  if (e.code === "KeyE" && !e.repeat) interact();
  if (e.code === "KeyP" && !e.repeat) togglePause();
});
window.addEventListener("keyup", (e) => keys.delete(e.code));
window.addEventListener("blur", () => {
  keys.clear();
  if (mode === "playing") togglePause();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && mode === "playing") togglePause();
});
for (const button of document.querySelectorAll("[data-key]")) {
  button.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    button.setPointerCapture(e.pointerId);
    keys.add(button.dataset.key);
    if (button.dataset.key === "KeyE") interact();
  });
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"])
    button.addEventListener(type, () => keys.delete(button.dataset.key));
}
$("pause").onclick = togglePause;
$("help").onclick = showHelp;
$("sound").onclick = () => {
  audioEnabled = !audioEnabled;
  $("sound").textContent = "Som: " + (audioEnabled ? "ligado" : "desligado");
  $("sound").setAttribute("aria-pressed", audioEnabled);
  playSound("coin");
};
$("fullscreen").onclick = async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.querySelector(".app").requestFullscreen();
  } catch {
    showToast("Tela cheia não disponível neste navegador.");
  }
};
$("rankLimit").onchange = refreshRanking;
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(Error("Não foi possível carregar " + src));
    img.src = src;
  });
}
try {
  const [background, hero, frameData] = await Promise.all([
    loadImage("assets/torre.png"),
    loadImage("assets/personagem.png"),
    fetch("assets/frames.json").then((r) => r.json()),
  ]);
  art = { background, hero };
  frames = frameData;
  prepareRound(17);
  intro();
  requestAnimationFrame(tick);
  refreshRanking();
  setInterval(() => {
    if (!document.hidden) refreshRanking();
  }, 10000);
} catch (e) {
  showModal(
    `<h2>Falha ao carregar a arte</h2><p>${escapeHTML(e.message)}</p><p>Abra o jogo pelo servidor local ou pela Vercel.</p>`,
  );
}
// Snapshot somente de leitura para diagnóstico e testes de navegação; não expõe tokens da sessão.
export function inspectGame() {
  return {
    mode,
    phase,
    progress,
    coins,
    score,
    elapsed,
    player: { ...player },
    layout: layout.map((doors, tower) =>
      doors.map((d) => ({ ...d, ...doorPosition(tower, d.slot) })),
    ),
  };
}



