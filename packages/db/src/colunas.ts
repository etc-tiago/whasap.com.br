import { filtroNaoExcluido } from "./filtros";

/** PK serial — uso interno em updates e FKs. Não expor na API. */
export const colunasSomenteId = { id: true } as const;

/** PK serial + uuid exportável — resolução de ids em lote. */
export const colunasIdUuid = { id: true, uuid: true } as const;

/**
 * Usuário para montar contexto de sessão (`WebUsuario` / `OfficeUsuario`).
 * Inclui `id` interno para FKs; expor ao cliente apenas `uuid` como `id`.
 */
export const colunasUsuarioSessao = {
  id: true,
  uuid: true,
  email: true,
  nome: true,
  emailVerificadoEm: true,
} as const;

/** Checagem de existência de usuário — retorna só PK interna. */
export const colunasUsuarioSomenteId = colunasSomenteId;

/**
 * Usuário em listagens de equipe / relatórios.
 * Sem `id` interno — apenas dados públicos.
 */
export const colunasUsuarioRelacao = {
  uuid: true,
  nome: true,
  email: true,
  ultimaAtividadeEm: true,
} as const;

/**
 * Organização para resposta pública (`toOrganizacaoOutput`).
 * Inclui `id` interno quando o handler precisa de FK.
 */
export const colunasOrganizacaoPublica = {
  id: true,
  uuid: true,
  nome: true,
  slug: true,
  documentoFiscal: true,
  tipoDocumento: true,
  razaoSocial: true,
  telefoneWhatsapp: true,
  aceiteAdesaoEm: true,
  aceiteAdesaoVersao: true,
  limiteConversas: true,
  horasAutoFecharInatividade: true,
  exibirNomeAtendenteMensagens: true,
  campanhaHabilitada: true,
  campanhaLimitePorMinuto: true,
  campanhaLimitePorHora: true,
  campanhaAlertaConsecutivos: true,
} as const;

/** Envio de campanha para listagem e relatório. */
export const colunasCampanhaEnvio = {
  id: true,
  uuid: true,
  organizacaoId: true,
  instanciaId: true,
  usuarioId: true,
  nomeDestinatario: true,
  telefone: true,
  corpo: true,
  templateNome: true,
  templateIdioma: true,
  templateVariaveis: true,
  status: true,
  erroMensagem: true,
  conversaUuid: true,
  criadoEm: true,
} as const;

/** Template memorizado de campanha (Cloud API). */
export const colunasCampanhaTemplateMemorizado = {
  id: true,
  uuid: true,
  organizacaoId: true,
  instanciaId: true,
  nome: true,
  templateNome: true,
  templateIdioma: true,
  variaveis: true,
  criadoEm: true,
  atualizadoEm: true,
} as const;

/** Checagem de slug / existência — retorna só PK interna. */
export const colunasOrganizacaoSomenteId = colunasSomenteId;

/**
 * Instância para listagem e detalhe no painel (`toInstanciaOutput`).
 * Inclui `organizacaoId` (FK interna) e `id` interno.
 */
export const colunasInstanciaPublica = {
  id: true,
  uuid: true,
  organizacaoId: true,
  nome: true,
  icone: true,
  provedor: true,
  status: true,
  limiteConversas: true,
  conectadoEm: true,
  sessaoRemotaLiberadaEm: true,
  criadoEm: true,
} as const;

export const colunasInstanciaEvo = {
  id: true,
  instanciaId: true,
  nomeInstancia: true,
  instanceId: true,
  token: true,
  historicoSincronizadoEm: true,
  historicoSincronizandoEm: true,
  historicoSyncStatus: true,
  historicoSyncProgress: true,
  historicoSyncErro: true,
} as const;

export const colunasInstanciaMetaCloud = {
  id: true,
  instanciaId: true,
  phoneNumberId: true,
  wabaId: true,
  accessToken: true,
} as const;

/**
 * Instância com credenciais e campos de provisionamento — só uso server-side.
 */
export const colunasInstanciaOperacao = {
  ...colunasInstanciaPublica,
  tentativasProvisionamento: true,
} as const;

/** Instância no worker de webhooks (evo / meta_cloud). */
export const colunasInstanciaWebhook = {
  id: true,
  uuid: true,
  organizacaoId: true,
  provedor: true,
  status: true,
  limiteConversas: true,
} as const;

/** Instância para endpoint de uso mensal. */
export const colunasInstanciaUso = {
  id: true,
  uuid: true,
  organizacaoId: true,
  limiteConversas: true,
} as const;

/** Membro de organização — auth, equipe e convites. */
export const colunasMembroOrganizacao = {
  id: true,
  uuid: true,
  papel: true,
  usuarioId: true,
  organizacaoId: true,
  ingressouEm: true,
} as const;

/** Só o papel do membro — resolução de permissão. */
export const colunasMembroPapel = { papel: true } as const;

/** Convite pendente ou aceito. */
export const colunasConviteOrganizacao = {
  id: true,
  uuid: true,
  email: true,
  nome: true,
  papel: true,
  token: true,
  expiraEm: true,
  aceitoEm: true,
  organizacaoId: true,
  criadoEm: true,
} as const;

/** Sessão web vinculada ao usuário. */
export const colunasSessaoWeb = {
  id: true,
  usuarioId: true,
  organizacaoId: true,
  token: true,
  expiraEm: true,
} as const;

/** Sessão do painel office. */
export const colunasSessaoOffice = {
  id: true,
  officeUsuarioId: true,
  token: true,
  expiraEm: true,
} as const;

/** Usuário office para contexto de sessão. */
export const colunasOfficeUsuarioSessao = {
  id: true,
  uuid: true,
  email: true,
  nome: true,
} as const;

/** Etiqueta de contato na organização. */
export const colunasContatoTag = {
  id: true,
  uuid: true,
  nome: true,
  cor: true,
  organizacaoId: true,
  idExterno: true,
} as const;

/** Atribuição de etiqueta a contato — só PK interna. */
export const colunasContatoTagAtribuicao = colunasSomenteId;

/** Contato na caixa de entrada (identidade org). */
export const colunasContatoCaixaEntrada = {
  id: true,
  uuid: true,
  organizacaoId: true,
  telefone: true,
  nome: true,
  idExterno: true,
} as const;

/** Vínculo contato ↔ instância (id externo da linha). */
export const colunasContatoInstancia = {
  id: true,
  contatoId: true,
  instanciaId: true,
  idExterno: true,
} as const;

/** Conversa na listagem da caixa de entrada. */
export const colunasConversaLista = {
  id: true,
  uuid: true,
  instanciaId: true,
  contatoId: true,
  atribuidoUsuarioId: true,
  status: true,
  metaCloudJanelaExpiraEm: true,
  ultimaMensagemEm: true,
  naoLidas: true,
  ultimaLeituraEm: true,
} as const;

/** Conversa com instância e contato — acesso por uuid. */
export const colunasConversaComRelacoes = {
  id: true,
  uuid: true,
  instanciaId: true,
  contatoId: true,
  atribuidoUsuarioId: true,
  status: true,
  metaCloudJanelaExpiraEm: true,
} as const;

/** Mensagem na listagem / envio. */
export const colunasMensagemLista = {
  id: true,
  uuid: true,
  direcao: true,
  tipo: true,
  corpo: true,
  midiaR2Chave: true,
  idExterno: true,
  status: true,
  templateNome: true,
  criadoEm: true,
  metadados: true,
} as const;

/** Preview da última mensagem em lista de conversas. */
export const colunasMensagemPreview = { corpo: true } as const;

/** Mensagem localizada por id externo (webhook). */
export const colunasMensagemWebhook = {
  id: true,
  conversaId: true,
} as const;

/** Template WhatsApp Cloud. */
export const colunasMensagemTemplate = {
  id: true,
  uuid: true,
  nome: true,
  idioma: true,
  categoria: true,
  status: true,
  componentes: true,
  idExterno: true,
  instanciaId: true,
} as const;

/** Anotação interna de conversa. */
export const colunasConversaAnotacao = {
  uuid: true,
  corpo: true,
  criadoEm: true,
} as const;

/** Resposta rápida (cabeçalho org-scoped). */
export const colunasRespostaRapida = {
  id: true,
  uuid: true,
  organizacaoId: true,
  titulo: true,
  criadoEm: true,
  atualizadoEm: true,
} as const;

/** Item de resposta rápida (texto / imagem / documento). */
export const colunasRespostaRapidaItem = {
  id: true,
  uuid: true,
  respostaRapidaId: true,
  ordem: true,
  tipo: true,
  corpo: true,
  midiaR2Chave: true,
  nomeArquivo: true,
} as const;

/** OTP válido — só PK para marcar como usado. */
export const colunasCodigoOtpVerificacao = colunasSomenteId;

/** Uso mensal agregado por instância. */
export const colunasUsoMensal = {
  id: true,
  contatosUnicosContagem: true,
} as const;

/** Contato já contabilizado no mês. */
export const colunasUsoMensalContato = colunasSomenteId;

/** Evento de webhook persistido — PK para marcar processado. */
export const colunasWebhookEvento = colunasSomenteId;

// --- Relações `with:` com soft-delete e colunas restritas ---

/** Inclui organização ativa com campos públicos. */
export const incluirOrganizacaoPublica = {
  columns: colunasOrganizacaoPublica,
  where: filtroNaoExcluido,
} as const;

/** Inclui usuário ativo com dados de exibição. */
export const incluirUsuarioRelacao = {
  columns: colunasUsuarioRelacao,
  where: filtroNaoExcluido,
} as const;

/** Inclui instância ativa com campos de operação + provedor. */
export const incluirInstanciaOperacao = {
  columns: colunasInstanciaOperacao,
  where: filtroNaoExcluido,
  with: {
    evo: { columns: colunasInstanciaEvo },
    metaCloud: { columns: colunasInstanciaMetaCloud },
  },
} as const;

/** Inclui instância webhook com evo/meta_cloud. */
export const incluirInstanciaWebhook = {
  columns: colunasInstanciaWebhook,
  where: filtroNaoExcluido,
  with: {
    evo: { columns: colunasInstanciaEvo },
    metaCloud: { columns: colunasInstanciaMetaCloud },
  },
} as const;

/** Inclui contato ativo na conversa. */
export const incluirContatoCaixaEntrada = {
  columns: colunasContatoCaixaEntrada,
  where: filtroNaoExcluido,
} as const;
