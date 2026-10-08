-- MCP Action: apenas tabelas e funções próprias, sem alterar o RAG Waze.
BEGIN;
CREATE TABLE IF NOT EXISTS public.mcp_action_runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), token uuid NOT NULL DEFAULT gen_random_uuid(),
 nickname text NOT NULL CHECK (char_length(nickname) BETWEEN 2 AND 20),
 seed integer NOT NULL, progress integer NOT NULL DEFAULT 0 CHECK(progress BETWEEN 0 AND 12),
 coins integer NOT NULL DEFAULT 0 CHECK(coins BETWEEN 0 AND 30),
 status text NOT NULL DEFAULT 'playing' CHECK(status IN ('playing','failed','completed')),
 started_at timestamptz NOT NULL DEFAULT clock_timestamp(), last_step_at timestamptz,
 paused_at timestamptz, paused_ms bigint NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS public.mcp_action_leaderboard (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), run_id uuid UNIQUE NOT NULL REFERENCES public.mcp_action_runs(id),
 nickname text NOT NULL, score integer NOT NULL CHECK(score BETWEEN 0 AND 2100),
 elapsed_ms bigint NOT NULL CHECK(elapsed_ms >= 0), coins integer NOT NULL CHECK(coins BETWEEN 0 AND 30),
 steps integer NOT NULL CHECK(steps=12), map_version text NOT NULL DEFAULT 'mcp-action-v1',
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS mcp_action_score_idx ON public.mcp_action_leaderboard(score DESC,elapsed_ms,created_at);
ALTER TABLE public.mcp_action_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_action_leaderboard ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mcp_action_runs FROM anon,authenticated;
REVOKE ALL ON public.mcp_action_leaderboard FROM anon,authenticated;
-- As tabelas não recebem escrita direta do navegador. A leitura do placar passa pela RPC.
CREATE OR REPLACE FUNCTION public.mcp_action_start(p_nickname text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r public.mcp_action_runs; n text := btrim(p_nickname);
BEGIN
 IF n IS NULL OR n !~ '^[[:alnum:] _.-]{2,20}$' THEN RAISE EXCEPTION 'Use um apelido de 2 a 20 caracteres: letras, números, espaço, ponto, hífen ou sublinhado.'; END IF;
 INSERT INTO public.mcp_action_runs(nickname,seed) VALUES(n,floor(random()*2147483647)::integer) RETURNING * INTO r;
 RETURN jsonb_build_object('run_id',r.id,'token',r.token,'seed',r.seed,'started_at',r.started_at);
END; $$;
CREATE OR REPLACE FUNCTION public.mcp_action_pause(p_run_id uuid,p_token uuid,p_pause boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r public.mcp_action_runs; t timestamptz := clock_timestamp();
BEGIN
 SELECT * INTO r FROM public.mcp_action_runs WHERE id=p_run_id AND token=p_token FOR UPDATE;
 IF NOT FOUND OR r.status <> 'playing' OR t-r.started_at>interval '2 hours' THEN RAISE EXCEPTION 'Partida inválida ou expirada.'; END IF;
 IF p_pause AND r.paused_at IS NULL THEN UPDATE public.mcp_action_runs SET paused_at=t WHERE id=r.id;
 ELSIF NOT p_pause AND r.paused_at IS NOT NULL THEN UPDATE public.mcp_action_runs SET paused_ms=paused_ms+floor(extract(epoch FROM(t-r.paused_at))*1000)::bigint,paused_at=NULL WHERE id=r.id; END IF;
 RETURN jsonb_build_object('paused',p_pause);
END; $$;
CREATE OR REPLACE FUNCTION public.mcp_action_step(p_run_id uuid,p_token uuid,p_step text,p_coins integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
 r public.mcp_action_runs; t timestamptz := clock_timestamp(); elapsed bigint; points integer; new_progress integer;
 saved_points integer;
 flow text[] := ARRAY['HOST','SERVIDOR_MCP','API_RAG','EMBEDDING','PGVECTOR','CHUNKS','PROMPT','LLM','BACKEND','SERVIDOR_RETORNO','HOST_RETORNO','USUARIO'];
BEGIN
 SELECT * INTO r FROM public.mcp_action_runs WHERE id=p_run_id AND token=p_token FOR UPDATE;
 IF NOT FOUND OR r.paused_at IS NOT NULL OR t-r.started_at>interval '2 hours' THEN RAISE EXCEPTION 'Partida inválida, pausada ou expirada.'; END IF;
 -- Repetir o último checkpoint após uma perda de conexão não pune uma etapa já aceita.
 IF r.status IN ('playing','completed') AND r.progress>0 AND p_step=flow[r.progress] THEN
  elapsed := greatest(0,floor(extract(epoch FROM(coalesce(r.last_step_at,t)-r.started_at))*1000)::bigint-r.paused_ms);
  saved_points := r.progress*100+r.coins*10;
  IF r.status='completed' THEN SELECT l.score,l.elapsed_ms INTO saved_points,elapsed FROM public.mcp_action_leaderboard l WHERE l.run_id=r.id; END IF;
  RETURN jsonb_build_object('ok',true,'progress',r.progress,'completed',r.status='completed','score',saved_points,'elapsed_ms',elapsed);
 END IF;
 IF r.status <> 'playing' THEN RAISE EXCEPTION 'Partida encerrada.'; END IF;
 IF p_step IS DISTINCT FROM flow[r.progress+1] THEN
  UPDATE public.mcp_action_runs SET status='failed' WHERE id=r.id;
  RETURN jsonb_build_object('ok',false,'expected',flow[r.progress+1]);
 END IF;
 IF r.last_step_at IS NOT NULL AND t-r.last_step_at < interval '200 milliseconds' THEN RAISE EXCEPTION 'Aguarde antes da próxima etapa.'; END IF;
 IF p_coins IS NULL OR p_coins<r.coins OR p_coins>(CASE WHEN r.progress<3 THEN 10 WHEN r.progress<7 THEN 20 ELSE 30 END) THEN RAISE EXCEPTION 'Quantidade de moedas inválida.'; END IF;
 new_progress := r.progress+1;
 elapsed := greatest(0,floor(extract(epoch FROM(t-r.started_at))*1000)::bigint-r.paused_ms);
 UPDATE public.mcp_action_runs SET progress=new_progress,coins=p_coins,last_step_at=t,status=CASE WHEN new_progress=12 THEN 'completed' ELSE 'playing' END WHERE id=r.id;
 points := new_progress*100+p_coins*10;
 IF new_progress=12 THEN
  points := points+greatest(0,600-floor(elapsed/1000)::integer);
  INSERT INTO public.mcp_action_leaderboard(run_id,nickname,score,elapsed_ms,coins,steps) VALUES(r.id,r.nickname,points,elapsed,p_coins,12);
 END IF;
 RETURN jsonb_build_object('ok',true,'progress',new_progress,'completed',new_progress=12,'score',points,'elapsed_ms',elapsed);
END; $$;
CREATE OR REPLACE FUNCTION public.mcp_action_ranking(p_limit integer DEFAULT 10)
RETURNS TABLE(id uuid,nickname text,score integer,elapsed_ms bigint,coins integer,steps integer,created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT best.id,best.nickname,best.score,best.elapsed_ms,best.coins,best.steps,best.created_at
 FROM (SELECT DISTINCT ON(lower(l.nickname)) l.id,l.nickname,l.score,l.elapsed_ms,l.coins,l.steps,l.created_at
       FROM public.mcp_action_leaderboard l ORDER BY lower(l.nickname),l.score DESC,l.elapsed_ms,l.created_at) best
 ORDER BY best.score DESC,best.elapsed_ms,best.created_at LIMIT greatest(1,least(coalesce(p_limit,10),1000));
$$;
REVOKE ALL ON FUNCTION public.mcp_action_start(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_action_pause(uuid,uuid,boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_action_step(uuid,uuid,text,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_action_ranking(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mcp_action_start(text),public.mcp_action_pause(uuid,uuid,boolean),public.mcp_action_step(uuid,uuid,text,integer),public.mcp_action_ranking(integer) TO anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;

