export const VERSION = "mcp-action-v1";
export const PHASES = [
  {
    title: "CHAMADA MCP",
    subtitle: "O Host pede uma capacidade ao servidor.",
    color: "#7ff1ba",
    steps: ["HOST", "SERVIDOR_MCP", "API_RAG"],
    decoys: ["SQL_DIRETO", "APAGAR"],
  },
  {
    title: "RECUPERAÇÃO",
    subtitle: "O RAG transforma a pergunta em contexto.",
    color: "#ffe16a",
    steps: ["EMBEDDING", "PGVECTOR", "CHUNKS", "PROMPT"],
    decoys: ["CHUNK_QUERY", "RESPOSTA_ANTES"],
  },
  {
    title: "RESPOSTA E RETORNO",
    subtitle: "A LLM gera; o resultado retorna ao usuário.",
    color: "#9befff",
    steps: ["LLM", "BACKEND", "SERVIDOR_RETORNO", "HOST_RETORNO", "USUARIO"],
    decoys: ["NOVA_LLM"],
  },
];
export const DOORS = {
  HOST: {
    name: "HOST",
    icon: "monitor",
    hint: "O Host usa seu cliente MCP para solicitar consultar_notas_fiscais.",
    detail:
      "Uma aplicação Host recebe a pergunta. Seu cliente MCP chama a ferramenta oferecida pelo servidor.",
  },
  SERVIDOR_MCP: {
    name: "SERVIDOR MCP",
    icon: "shield",
    hint: "O servidor confere ferramenta, parâmetros e permissão de consulta.",
    detail:
      "consultar_notas_fiscais · entrada: pergunta e top_k ≤ 5 · somente leitura.",
  },
  API_RAG: {
    name: "API RAG",
    icon: "gear",
    hint: "O servidor encaminha à API do backend RAG.",
    detail:
      "O servidor MCP chama POST /api/query no backend Python. Essa ligação é uma chamada REST.",
  },
  EMBEDDING: {
    name: "EMBEDDING",
    icon: "vector",
    hint: "O modelo transforma a pergunta em um vetor de busca.",
    detail:
      "A pergunta usa o mesmo modelo de embeddings e a mesma configuração da base já ingerida.",
  },
  PGVECTOR: {
    name: "SUPABASE · PGVECTOR",
    icon: "database",
    hint: "O vetor da pergunta busca candidatos por similaridade.",
    detail:
      "A comparação de vetores recupera trechos. Score de cosseno não é probabilidade de acerto.",
  },
  CHUNKS: {
    name: "CHUNKS RECUPERADOS",
    icon: "document",
    hint: "Os chunks encontrados fornecem texto, ID, metadados e score.",
    detail:
      "Estes trechos já foram preparados na ingestão. Selecionamos os candidatos relevantes para o contexto.",
  },
  PROMPT: {
    name: "PROMPT AUMENTADO",
    icon: "document",
    hint: "O backend reúne instruções, contexto recuperado e pergunta.",
    detail: "O algoritmo monta o prompt aumentado antes de chamar a LLM.",
  },
  LLM: {
    name: "OPENROUTER · LLM",
    icon: "brain",
    hint: "A LLM gera a resposta usando a pergunta e o contexto.",
    detail:
      "A geração é probabilística. A chamada OpenRouter ocorre dentro do backend RAG.",
  },
  BACKEND: {
    name: "BACKEND RAG",
    icon: "gear",
    hint: "O backend organiza a resposta e os trechos que a sustentam.",
    detail:
      "A API devolve resposta, candidatos, IDs, scores e métricas disponíveis.",
  },
  SERVIDOR_RETORNO: {
    name: "SERVIDOR MCP",
    icon: "shield",
    hint: "O servidor devolve o resultado da ferramenta pelo MCP.",
    detail:
      "A resposta do serviço RAG é empacotada como resultado da ferramenta.",
  },
  HOST_RETORNO: {
    name: "HOST",
    icon: "monitor",
    hint: "O Host recebe e apresenta o resultado ao usuário.",
    detail:
      "Neste desenho, a ferramenta já devolve a resposta do RAG. Não há nova chamada à LLM no Host.",
  },
  USUARIO: {
    name: "USUÁRIO",
    icon: "user",
    hint: "O usuário recebe a resposta e pode conferir as fontes.",
    detail:
      "Missão concluída: chamada MCP, recuperação e geração têm responsabilidades diferentes.",
  },
  SQL_DIRETO: {
    name: "SQL DIRETO NO HOST",
    icon: "danger",
    detail:
      "A ferramenta definida chama a API RAG. O Host não recebe acesso SQL irrestrito ao banco.",
  },
  APAGAR: {
    name: "APAGAR DOCUMENTOS",
    icon: "danger",
    detail:
      "O contrato permite somente consulta. Apagar documentos está fora do limite da ferramenta.",
  },
  CHUNK_QUERY: {
    name: "CHUNKING DA PERGUNTA",
    icon: "danger",
    detail:
      "Neste projeto, a pergunta curta é vetorizada diretamente. O chunking foi aplicado aos documentos na ingestão.",
  },
  RESPOSTA_ANTES: {
    name: "RESPOSTA SEM CONTEXTO",
    icon: "danger",
    detail:
      "O contexto deve ser recuperado e o prompt aumentado montado antes da geração.",
  },
  NOVA_LLM: {
    name: "NOVA LLM NO HOST",
    icon: "danger",
    detail:
      "Neste fluxo, a ferramenta devolve a resposta já gerada pelo RAG. Não é necessário gerar outra resposta no Host.",
  },
};
export const FLOW = PHASES.flatMap((p) => p.steps);
export const CONTRACT = [
  {
    question: "Qual é o nome claro da capacidade?",
    answer: "consultar_notas_fiscais",
    wrong: "executar_qualquer_comando",
    explanation:
      "O nome deve expressar a capacidade de consulta, sem sugerir permissões ilimitadas.",
  },
  {
    question: "Qual entrada a ferramenta recebe?",
    answer: "pergunta e top_k ≤ 5",
    wrong: "senha do Supabase e SQL livre",
    explanation:
      "Parâmetros descrevem a consulta. Segredos de serviço ficam no servidor.",
  },
  {
    question: "Qual serviço o servidor chama diretamente?",
    answer: "API do backend RAG",
    wrong: "LLM antes de recuperar contexto",
    explanation:
      "Neste projeto, a ferramenta chama a API RAG; o pipeline interno consulta Supabase e OpenRouter.",
  },
  {
    question: "Qual retorno a ferramenta oferece?",
    answer: "Resposta, trechos, IDs e scores",
    wrong: "Uma chave administrativa do banco",
    explanation:
      "O resultado traz resposta e evidências disponíveis, sem expor credenciais.",
  },
  {
    question: "Qual é o limite de permissão?",
    answer: "Somente consultar",
    wrong: "Apagar e alterar documentos",
    explanation:
      "A capacidade proposta é de leitura. Ingestão e exclusão não fazem parte desta ferramenta.",
  },
];
