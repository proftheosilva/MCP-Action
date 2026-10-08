# MCP Action — A torre do RAG

Jogo educativo 2D, em português, com frontend de uma página e backend no Supabase. A arte da torre e os sprites foram gerados a partir da referência aprovada. Os PNGs originais e a referência foram preservados. A folha tem seis quadros; `assets/frames.json` define os recortes de origem usados pelo Canvas, sem alterar o PNG.

## Rodar localmente

Node.js instalado: `npm install` e `npm start`. Abra http://127.0.0.1:8766.
O jogo usa HTML, CSS e JavaScript nativos com Canvas; sem backend Python, Next.js ou chamadas reais à LLM. As dependências de desenvolvimento servem somente para testes.

## Instalar o ranking

Execute `supabase/schema.sql` no SQL Editor do projeto Supabase já usado pela turma. O SQL cria apenas tabelas e funções com prefixo `mcp_action_`. Nenhuma tabela do RAG ou do RAG Waze é alterada. A conta que executar precisa de permissão de criação de tabelas/funções.

`config.js` contém somente a URL do projeto e sua chave **publicável**. Nunca colocar `SUPABASE_SECRET_KEY`, `service_role`, senha ou `SUPABASE_ACCESS_TOKEN` no frontend. A chave publicável identifica o projeto; permissões e funções controlam os acessos.

O script `scripts/install_supabase.py` é apenas um auxiliar local do professor que lê o `.env` do RAG e instala o SQL pela Management API. Não é parte do site publicado.

As RPCs `mcp_action_start`, `mcp_action_step`, `mcp_action_pause` e `mcp_action_ranking` controlam as partidas. O navegador não insere diretamente nas tabelas. O servidor valida a sequência, estado, prazo e limites de moedas e calcula tempo/pontuação final. O modo **prática** funciona sem ranking quando as RPCs ainda não estão instaladas ou não há rede.

## Regras

Apelido de 2 a 20 caracteres. Setas/WASD movem; espaço salta; E confirma portas e portais; P pausa. Campo de apelido aceita as teclas de movimento sem interferência. Elevador à esquerda de cada setor; escada à direita. Subir/descer com ↑/↓. Ao concluir o setor, portal à direita do piso inferior abre. A fase seguinte começa com objetivos pendentes.

Toda rodada embaralha as portas, mantendo seis posições alcançáveis em cada setor. O mapa físico e a quantidade de moedas são iguais para a turma. Confirmar fora da ordem ou responder incorretamente ao contrato leva à fase 1, zera toda a rodada e exige novo início. Objetivos coletados desaparecem. Moedas são finitas: dez por setor, trinta no total. Uma moeda enfraquece drones por quatro segundos. Drones fortes atordoam por um segundo; o tempo continua contando.

São 12 etapas: Host → Servidor MCP → API RAG → Embedding → PGVector → Chunks recuperados → Prompt aumentado → LLM → Backend → Servidor MCP (retorno) → Host (retorno) → Usuário. A pergunta não é submetida a novo chunking neste exemplo. A tokenização interna faz parte do modelo de embeddings; o exemplo visual evita confundir a tokenização didática tiktoken do projeto com os tokens efetivos dos modelos.

100 pontos por etapa + 10 por moeda + bônus `max(0,600-segundos)`. O tempo de pausas explícitas é descontado. Etapas intermediárias somam pontos; o bônus entra ao concluir. Ranking guarda todas as partidas concluídas e exibe a melhor por apelido (use apelidos únicos). Ordem: pontos decrescentes, tempo crescente, data crescente. Atualização a cada dez segundos. O limite “Todos” exibe até mil jogadores.

## Hospedar na Vercel

Importe **esta pasta** como projeto. Framework preset: Other. Build: `npm run build`. Output: `dist`. O `vercel.json` já define isso. Não precisa publicar credenciais privadas nem hospedar Python. `dist/` recebe somente os arquivos públicos necessários ao jogo; SQL, scripts do professor e testes ficam fora. O ranking depende da instalação prévia do SQL no Supabase.

## Limites

Partidas são identificadas por apelido e token efêmero de sessão, sem login obrigatório. É um ranking didático: o servidor valida sequência e limites básicos, mas não prova todos os movimentos físicos de um navegador modificado. Não é uma plataforma de competição com prevenção completa de fraude.

A sala de aula pode usar a primeira rodada no modo prática e depois competição compartilhada. O jogo simula MCP/RAG; não instala MCP no projeto nem consome tokens do OpenRouter.
