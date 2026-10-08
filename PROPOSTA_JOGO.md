# MCP Action — A torre do RAG
Proposta conceitual; sem implementação do jogo.

## Objetivo
Reconhecer a chamada MCP, a busca vetorial interna ao RAG e a geração pela LLM, usando o projeto de notas fiscais da turma.

## Cenário
Arcade 2D de plataformas e elevadores, com arte e personagens originais. O jogador transporta uma pergunta por uma torre de serviços. Uma tecla de interação confirma a entrada em portas, evitando reinício causado apenas por encostar nelas.

## Fases
1. Chamada MCP: Host (com cliente MCP) escolhe a tool consultar_notas_fiscais → Servidor MCP valida parâmetros e permissão → API RAG recebe a consulta. O cartão da ferramenta contém nome, entrada, fonte, saída e limite.
2. Recuperação: embedding da pergunta → busca de similaridade no Supabase pgvector → chunks recuperados → prompt aumentado. A base já está ingerida; não há novo chunking da pergunta.
3. Resposta e retorno: OpenRouter/LLM dentro do backend RAG gera a resposta → backend → servidor MCP → Host → usuário. A ligação backend/servidor é a API do projeto; a ligação servidor/cliente do Host é MCP. O Host apresenta a resposta já gerada, sem uma segunda chamada à LLM.

## Regras propostas
- Apelido antes de iniciar; cronômetro começa no botão INICIAR.
- Etapas devem ser confirmadas na ordem. Objetivo atual e progresso sempre visíveis.
- Escolher etapa errada reinicia a fase 1: pontos, moedas, cronômetro e objetivos são zerados.
- Pausa congela personagem e cronômetro.
- Moedas são opcionais, finitas e não reaparecem na mesma tentativa.
- Obstáculos móveis atrapalham deslocamento; não substituem o desafio de ordenar o conhecimento. Efeito de colisão a definir antes da implementação.
- Um erro mostra a sequência esperada e permite começar outra tentativa.
- Disposição pode variar entre rodadas, preservando distância e dificuldade equivalentes.
- Primeira experiência guiada usa a pergunta: Quais notebooks foram comprados?

## Pontuação inicial sugerida
100 pontos por etapa correta + 10 por moeda + bônus de tempo max(0, 600 - segundos da rodada concluída).
Quantidade de moedas e etapas limitada por mapa, sem geração ilimitada.
Os valores podem ser ajustados pelo professor antes da construção.
Ranking: maior pontuação final; empate por menor tempo; empate remanescente por registro mais antigo.
Somente partidas concluídas entram no ranking competitivo.
Registrar apelido, pontos, moedas, tempo, etapas concluídas e versão do mapa.
Ranking compartilhado depende de backend/banco, por exemplo Supabase, e não de armazenamento exclusivo do navegador.
Página do jogo mostra Top 10; painel do professor pode filtrar 10, 15, 20, 30 ou todos.
Persistência/validação no servidor e nenhum segredo privado no navegador.

## Limites da proposta
A imagem é uma visualização conceitual com dados ilustrativos. O jogo não fará consultas pagas ao OpenRouter por movimento; pode usar respostas didáticas previamente preparadas.
Não foi instalado MCP nem criado jogo funcional ou banco nesta etapa.

