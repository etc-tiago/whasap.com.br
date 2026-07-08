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
  asaasIdCliente: true,
  demonstracaoIniciaEm: true,
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
  provedor: true,
  status: true,
  limiteConversas: true,
  asaasIdAssinatura: true,
  nuvemIdNumeroTelefone: true,
  trialTerminaEm: true,
  conectadoEm: true,
  criadoEm: true,
} as const;

/**
 * Instância com credenciais e campos de provisionamento — só uso server-side.
 * Nunca retornar estes campos diretamente na API.
 */
export const colunasInstanciaOperacao = {
  ...colunasInstanciaPublica,
  evolucaoNomeInstancia: true,
  evolucaoInstanceId: true,
  evolucaoToken: true,
  nuvemIdWaba: true,
  nuvemTokenAcesso: true,
  tentativasProvisionamento: true,
} as const;

/** Instância no worker de webhooks (Evolution / Meta / Asaas). */
export const colunasInstanciaWebhook = {
  id: true,
  uuid: true,
  organizacaoId: true,
  provedor: true,
  evolucaoNomeInstancia: true,
  evolucaoInstanceId: true,
  evolucaoToken: true,
  nuvemIdNumeroTelefone: true,
  nuvemTokenAcesso: true,
  nuvemIdWaba: true,
  asaasIdAssinatura: true,
  status: true,
  limiteConversas: true,
  trialTerminaEm: true,
} as const;

/** Instância para endpoint de uso mensal. */
export const colunasInstanciaUso = {
  id: true,
  uuid: true,
  organizacaoId: true,
  limiteConversas: true,
} as const;

/** Updates de status via webhook Asaas. */
export const colunasInstanciaAsaasStatus = {
  id: true,
  trialTerminaEm: true,
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

/** Contato na caixa de entrada. */
export const colunasContatoCaixaEntrada = {
  id: true,
  uuid: true,
  telefone: true,
  nome: true,
  instanciaId: true,
} as const;

/** Conversa na listagem da caixa de entrada. */
export const colunasConversaLista = {
  id: true,
  uuid: true,
  instanciaId: true,
  contatoId: true,
  atribuidoUsuarioId: true,
  status: true,
  nuvemJanelaExpiraEm: true,
  ultimaMensagemEm: true,
} as const;

/** Conversa com instância e contato — acesso por uuid. */
export const colunasConversaComRelacoes = {
  id: true,
  uuid: true,
  instanciaId: true,
  contatoId: true,
  atribuidoUsuarioId: true,
  status: true,
  nuvemJanelaExpiraEm: true,
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

/** OTP válido — só PK para marcar como usado. */
export const colunasCodigoOtpVerificacao = colunasSomenteId;

/** Uso mensal agregado por instância. */
export const colunasUsoMensal = {
  id: true,
  contatosUnicosContagem: true,
} as const;

/** Contato já contabilizado no mês. */
export const colunasUsoMensalContato = colunasSomenteId;

/** Addon de pacote de conversas. */
export const colunasInstanciaAddon = colunasSomenteId;

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

/** Inclui instância ativa com campos de operação. */
export const incluirInstanciaOperacao = {
  columns: colunasInstanciaOperacao,
  where: filtroNaoExcluido,
} as const;

/** Inclui contato ativo na conversa. */
export const incluirContatoCaixaEntrada = {
  columns: colunasContatoCaixaEntrada,
  where: filtroNaoExcluido,
} as const;
