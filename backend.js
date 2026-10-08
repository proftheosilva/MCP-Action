const cfg = window.MCP_ACTION_CONFIG || {};
export async function rpc(name, parameters) {
  if (!cfg.url || !cfg.key)
    throw Error("A configuração pública do Supabase ainda não foi preenchida.");
  const response = await fetch(cfg.url + "/rest/v1/rpc/" + name, {
    method: "POST",
    headers: { apikey: cfg.key, "Content-Type": "application/json" },
    body: JSON.stringify(parameters),
    signal: AbortSignal.timeout(20000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 404 || data.code === "PGRST202")
      throw Error(
        "O ranking ainda precisa da instalação do schema.sql no Supabase.",
      );
    throw Error(data.message || "Falha de conexão com o Supabase.");
  }
  return data;
}
export async function loadRanking(limit = 10) {
  return rpc("mcp_action_ranking", { p_limit: limit });
}
export async function beginRun(nickname) {
  return rpc("mcp_action_start", { p_nickname: nickname });
}
export async function checkpoint(run, step, coins) {
  return rpc("mcp_action_step", {
    p_run_id: run.run_id,
    p_token: run.token,
    p_step: step,
    p_coins: coins,
  });
}
export async function pauseRun(run, paused) {
  return rpc("mcp_action_pause", {
    p_run_id: run.run_id,
    p_token: run.token,
    p_pause: paused,
  });
}
