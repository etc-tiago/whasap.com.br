"use client";

import { mvpDefaults, type PlanoBillingId } from "@whasap/config";
import { Badge } from "@whasap/ui/components/badge";
import { Button } from "@whasap/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@whasap/ui/components/card";
import { Input } from "@whasap/ui/components/input";
import { Label } from "@whasap/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@whasap/ui/components/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@whasap/ui/components/table";
import { Calendar, MessageCircle, Minus, Plus, Video } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { montarUrlAgendamento, montarUrlWhatsapp, VENDAS_WHATSAPP } from "@/lib/contato-vendas";
import {
  calcularComparacaoMercado,
  PRECO_POR_ATENDENTE_CENTS,
  ROTULO_PLATAFORMA_POR_CONVERSA,
  ROTULO_PLATAFORMA_POR_USUARIO,
  type ComparacaoMercado,
} from "@/lib/comparacao-mercado";
import {
  calcularOrcamento,
  FAIXAS_CONTATOS,
  formatarPrecoBrl,
  type FaixaContatosId,
  type OrcamentoCalculado,
  type OrcamentoRegistro,
} from "@/lib/orcamento";
import { lerRefIndicacao } from "@/lib/ref-indicacao";

const { billing } = mvpDefaults;

const planoProfissional = billing.plans.find((p) => p.id === "profissional")!;

function Stepper({
  valor,
  min,
  max,
  onChange,
  id,
}: {
  valor: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  id: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-9 w-9 shrink-0"
        disabled={valor <= min}
        onClick={() => onChange(Math.max(min, valor - 1))}
        aria-label="Diminuir"
      >
        <Minus className="h-4 w-4" />
      </Button>
      <span
        id={id}
        className="flex h-9 min-w-12 flex-1 items-center justify-center rounded-md border border-input bg-background text-sm font-medium"
      >
        {valor}
      </span>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-9 w-9 shrink-0"
        disabled={valor >= max}
        onClick={() => onChange(Math.min(max, valor + 1))}
        aria-label="Aumentar"
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}

async function registrarOrcamento(registro: OrcamentoRegistro): Promise<void> {
  try {
    await fetch("/api/orcamento", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(registro),
    });
  } catch {
    // Não bloqueia UX se o registro falhar
  }
}

function montarRegistro(
  orcamento: OrcamentoCalculado,
  id: string,
  trilha?: "whatsapp" | "videoconferencia",
): OrcamentoRegistro {
  return {
    id,
    criadoEm: new Date().toISOString(),
    numerosWhatsapp: orcamento.conexoes,
    atendentes: orcamento.atendentes,
    faixaContatos: orcamento.faixaContatos,
    contatosEstimados: orcamento.contatosUnicos,
    planoId: orcamento.plano.id,
    planoNome: orcamento.plano.nome,
    totalCents: orcamento.totalCents,
    aPartirDe: orcamento.aPartirDe,
    trilha,
    referrer: typeof document !== "undefined" ? document.referrer : undefined,
    refIndicacao: lerRefIndicacao(),
  };
}

export function TabelaPrecosPlanos({ compact = false }: { compact?: boolean }) {
  return (
    <div className="space-y-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Plano</TableHead>
            <TableHead className="text-right">Mensal</TableHead>
            {!compact && <TableHead className="text-right">Contatos</TableHead>}
            {!compact && <TableHead className="text-right">Conexões</TableHead>}
            {!compact && <TableHead className="text-right">Extra/100</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {billing.plans.map((plano) => (
            <TableRow key={plano.id}>
              <TableCell className="font-medium">{plano.nome}</TableCell>
              <TableCell className="text-right text-sm">
                {formatarPrecoBrl(plano.priceCents)}
              </TableCell>
              {!compact && (
                <TableCell className="text-right text-sm">
                  {plano.contactsIncluded.toLocaleString("pt-BR")}
                </TableCell>
              )}
              {!compact && (
                <TableCell className="text-right text-sm">{plano.connectionsIncluded}</TableCell>
              )}
              {!compact && (
                <TableCell className="text-right text-sm">
                  {formatarPrecoBrl(plano.extraContactsPackPriceCents)}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <ul className="space-y-1 text-xs text-muted-foreground">
        <li>
          Conexão adicional: {formatarPrecoBrl(billing.extraConnectionPriceCents)}/mês por número
        </li>
        <li>
          Contatos extras: a cada {billing.contactsPerExtraPack} contatos únicos (preço no plano)
        </li>
        <li>Atendentes ilimitados · sem custo por usuário</li>
        <li>Teste de {billing.billingAfterUsageDays} dias · uso em paralelo permitido</li>
      </ul>
    </div>
  );
}

function ResultadoOrcamento({
  orcamento,
  orcamentoId,
  planoSugeridoId,
}: {
  orcamento: OrcamentoCalculado;
  orcamentoId: string;
  planoSugeridoId?: PlanoBillingId;
}) {
  const totalLabel = orcamento.aPartirDe
    ? `a partir de ${formatarPrecoBrl(orcamento.totalCents)}/mês`
    : `${formatarPrecoBrl(orcamento.totalCents)}/mês`;

  const planoDestaque =
    planoSugeridoId != null ? billing.plans.find((p) => p.id === planoSugeridoId) : undefined;

  const registrarTrilha = (trilha: "whatsapp" | "videoconferencia") => {
    void registrarOrcamento(montarRegistro(orcamento, orcamentoId, trilha));
  };

  return (
    <div className="space-y-6 border-t border-border pt-6">
      <div>
        <p className="text-sm font-medium text-wa-green-dark">Seu orçamento estimado</p>
        <p className="mt-1 text-3xl font-bold tracking-tight">{totalLabel}</p>
        <p className="mt-2 text-sm font-medium">Plano mais econômico: {orcamento.plano.nome}</p>
        {planoDestaque && planoDestaque.id !== orcamento.plano.id && (
          <p className="mt-1 text-sm text-muted-foreground">
            Sugestão fundadores: {planoDestaque.nome} ({formatarPrecoBrl(planoDestaque.priceCents)}
            /mês · {planoDestaque.contactsIncluded.toLocaleString("pt-BR")} contatos ·{" "}
            {planoDestaque.connectionsIncluded} conexão
            {planoDestaque.connectionsIncluded > 1 ? "ões" : ""})
          </p>
        )}
        <p className="mt-2 text-sm text-muted-foreground">
          {orcamento.conexoes} número{orcamento.conexoes > 1 ? "s" : ""} do WhatsApp ·{" "}
          {orcamento.atendentes} atendentes · {orcamento.faixaContatos}
        </p>
        {(orcamento.conexoesExtras > 0 || orcamento.pacotesContatosExtras > 0) && (
          <p className="mt-2 text-xs text-muted-foreground">
            {orcamento.conexoesExtras > 0 && (
              <span>
                +{orcamento.conexoesExtras} conexão(ões) ·{" "}
                {formatarPrecoBrl(orcamento.precoConexoesExtrasCents)}
              </span>
            )}
            {orcamento.conexoesExtras > 0 && orcamento.pacotesContatosExtras > 0 && " · "}
            {orcamento.pacotesContatosExtras > 0 && (
              <span>
                +{orcamento.pacotesContatosExtras} pacote(s) de contatos ·{" "}
                {formatarPrecoBrl(orcamento.precoContatosExtrasCents)}
              </span>
            )}
          </p>
        )}
        <p className="mt-3 text-sm text-muted-foreground">
          Esse valor é uma estimativa transparente. Para fechar o plano certo — sem pagar a mais —
          escolha como prefere falar com a gente:
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-wa-green/20 bg-wa-green/5">
          <CardHeader className="pb-2">
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-wa-green/20 text-wa-green-dark">
              <MessageCircle className="h-5 w-5" />
            </div>
            <CardTitle className="text-lg">Falar com a gente no WhatsApp</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>Conversa rápida com nossa equipe — sem robô, sem fila.</p>
            <p>Receba confirmação do plano e tire dúvidas em minutos.</p>
            <Button
              asChild
              className="w-full bg-wa-green text-white hover:bg-wa-green-dark"
              disabled={!VENDAS_WHATSAPP}
            >
              <a
                href={montarUrlWhatsapp(orcamento)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => registrarTrilha("whatsapp")}
              >
                Chamar no WhatsApp
              </a>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-foreground">
              <Video className="h-5 w-5" />
            </div>
            <CardTitle className="text-lg">Conversa ao vivo de 30 minutos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              Conte como sua equipe atende hoje — contabilidade, farmácia, distribuidora ou operação
              com vários atendentes.
            </p>
            <p>
              Quem agenda uma call consegue condições melhores: montamos um plano sob medida, com
              desconto para operações maiores.
            </p>
            <Button asChild variant="outline" className="w-full">
              <a
                href={montarUrlAgendamento(orcamento)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => registrarTrilha("videoconferencia")}
              >
                <Calendar className="mr-2 h-4 w-4" />
                Agendar conversa
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground italic">
        Cada operação é diferente. A simulação mostra o investimento base; na conversa ajustamos o
        que fizer sentido para o seu time.
      </p>
    </div>
  );
}

function ResultadoComparacao({
  comparacao,
  orcamentoId,
  planoSugeridoId,
}: {
  comparacao: ComparacaoMercado;
  orcamentoId: string;
  planoSugeridoId?: PlanoBillingId;
}) {
  const { orcamento } = comparacao;
  const economiaAtendentes = formatarPrecoBrl(comparacao.economiaAtendentesCents);
  const planoDestaque =
    planoSugeridoId != null ? billing.plans.find((p) => p.id === planoSugeridoId) : undefined;

  const registrarTrilha = (trilha: "whatsapp" | "videoconferencia") => {
    void registrarOrcamento(montarRegistro(orcamento, orcamentoId, trilha));
  };

  return (
    <div className="space-y-6 border-t border-border pt-6">
      <div>
        <p className="text-sm font-medium text-wa-green-dark">Comparativo estimado</p>
        <p className="mt-1 text-3xl font-bold tracking-tight">
          Whasap {formatarPrecoBrl(comparacao.whasapCents)}/mês
        </p>
        <p className="mt-2 text-sm font-medium">Plano mais econômico: {orcamento.plano.nome}</p>
        {planoDestaque && planoDestaque.id !== orcamento.plano.id && (
          <p className="mt-1 text-sm text-muted-foreground">
            Sugestão fundadores: {planoDestaque.nome} ({formatarPrecoBrl(planoDestaque.priceCents)}
            /mês · {planoDestaque.contactsIncluded.toLocaleString("pt-BR")} contatos)
          </p>
        )}
        <p className="mt-2 text-sm text-muted-foreground">
          Só em atendentes, plataformas por usuário costumam cobrar cerca de {economiaAtendentes}
          /mês ({orcamento.atendentes} × {formatarPrecoBrl(PRECO_POR_ATENDENTE_CENTS)}). No Whasap:
          atendentes ilimitados.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-wa-green/30 bg-wa-green/5 p-4">
          <p className="text-xs font-medium text-wa-green-dark">Whasap</p>
          <p className="mt-1 text-xl font-bold">{formatarPrecoBrl(comparacao.whasapCents)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            contato único · {orcamento.plano.nome}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">
            {ROTULO_PLATAFORMA_POR_USUARIO}
          </p>
          <p className="mt-1 text-xl font-bold">
            {formatarPrecoBrl(comparacao.plataformaPorUsuarioCents)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            economia ~{formatarPrecoBrl(comparacao.economiaVsUsuarioCents)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">
            {ROTULO_PLATAFORMA_POR_CONVERSA}
          </p>
          <p className="mt-1 text-xl font-bold">
            {formatarPrecoBrl(comparacao.plataformaPorConversaCents)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            economia ~{formatarPrecoBrl(comparacao.economiaVsConversaCents)}
          </p>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Valores de mercado são estimativas (média por usuário e por janela de conversa). Não
        representam preços oficiais de concorrentes. Ajuste os números para o seu escritório.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-wa-green/20 bg-wa-green/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Falar no WhatsApp</CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              asChild
              className="w-full bg-wa-green text-white hover:bg-wa-green-dark"
              disabled={!VENDAS_WHATSAPP}
            >
              <a
                href={montarUrlWhatsapp(orcamento)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => registrarTrilha("whatsapp")}
              >
                Chamar no WhatsApp
              </a>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Agendar conversa</CardTitle>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <a
                href={montarUrlAgendamento(orcamento)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => registrarTrilha("videoconferencia")}
              >
                <Calendar className="mr-2 h-4 w-4" />
                Agendar
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export type CalculadoraDefaults = {
  numerosWhatsapp?: number;
  atendentes?: number;
  contatosUnicos?: number;
  faixaId?: FaixaContatosId;
};

export function CalculadoraInvestimento({
  mostrarTabela = true,
  compactTable = true,
  defaults,
  modoComparacao = false,
  autoCalcular = false,
  planoSugeridoId,
}: {
  mostrarTabela?: boolean;
  compactTable?: boolean;
  defaults?: CalculadoraDefaults;
  modoComparacao?: boolean;
  autoCalcular?: boolean;
  /** Destaca pacote sugerido sem travar a customização. */
  planoSugeridoId?: PlanoBillingId;
}) {
  const usarContatosNumericos = modoComparacao || defaults?.contatosUnicos != null;

  const [numerosWhatsapp, setNumerosWhatsapp] = useState(defaults?.numerosWhatsapp ?? 1);
  const [atendentes, setAtendentes] = useState(defaults?.atendentes ?? 4);
  const [faixaId, setFaixaId] = useState<FaixaContatosId>(defaults?.faixaId ?? "500-1000");
  const [contatosUnicos, setContatosUnicos] = useState(defaults?.contatosUnicos ?? 800);
  const [orcamento, setOrcamento] = useState<OrcamentoCalculado | null>(null);
  const [comparacao, setComparacao] = useState<ComparacaoMercado | null>(null);
  const [orcamentoId, setOrcamentoId] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const autoFeito = useRef(false);

  const limparResultado = () => {
    setOrcamento(null);
    setComparacao(null);
    setOrcamentoId(null);
  };

  const verOrcamento = async () => {
    setCarregando(true);
    const id = crypto.randomUUID();

    if (modoComparacao || usarContatosNumericos) {
      const calc = calcularComparacaoMercado({
        numerosWhatsapp,
        atendentes,
        contatosUnicos,
      });
      setComparacao(calc);
      setOrcamento(calc.orcamento);
      setOrcamentoId(id);
      await registrarOrcamento(montarRegistro(calc.orcamento, id));
    } else {
      const calculado = calcularOrcamento({ numerosWhatsapp, atendentes, faixaId });
      setComparacao(null);
      setOrcamento(calculado);
      setOrcamentoId(id);
      await registrarOrcamento(montarRegistro(calculado, id));
    }

    setCarregando(false);
  };

  useEffect(() => {
    if (!autoCalcular || autoFeito.current) return;
    autoFeito.current = true;
    void verOrcamento();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só no mount com defaults
  }, [autoCalcular]);

  return (
    <Card className="border-border/80 shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl">
          {modoComparacao ? "Simule a economia" : "Simule seu investimento"}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Cobrança por contato único — cliente que conversa várias vezes no mês conta apenas 1×.
          {planoSugeridoId === "profissional" && (
            <>
              {" "}
              Pacote inicial sugerido: {planoProfissional.nome} (
              {formatarPrecoBrl(planoProfissional.priceCents)}/mês) — você pode customizar abaixo.
            </>
          )}
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {mostrarTabela && <TabelaPrecosPlanos compact={compactTable} />}

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="numeros-whatsapp">Quantos números do WhatsApp você usa?</Label>
            <Stepper
              id="numeros-whatsapp"
              valor={numerosWhatsapp}
              min={1}
              max={10}
              onChange={(v) => {
                setNumerosWhatsapp(v);
                limparResultado();
              }}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="atendentes">Quantos atendentes na equipe?</Label>
              <Badge variant="secondary" className="text-xs">
                sem custo extra
              </Badge>
            </div>
            <Stepper
              id="atendentes"
              valor={atendentes}
              min={1}
              max={50}
              onChange={(v) => {
                setAtendentes(v);
                limparResultado();
              }}
            />
            {atendentes >= 4 && (
              <p className="text-xs text-muted-foreground">
                Sua equipe de {atendentes} atendentes — sem custo adicional por usuário.
              </p>
            )}
          </div>

          {usarContatosNumericos ? (
            <div className="space-y-2">
              <Label htmlFor="contatos-unicos">Contatos únicos por mês</Label>
              <Input
                id="contatos-unicos"
                type="number"
                min={50}
                max={100_000}
                step={50}
                value={contatosUnicos}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (!Number.isFinite(n)) return;
                  setContatosUnicos(Math.max(50, Math.min(100_000, Math.floor(n))));
                  limparResultado();
                }}
              />
              <p className="text-xs text-muted-foreground">
                Contato único: quem interagiu no mês conta 1×, independentemente de quantas
                mensagens.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="faixa-contatos">Contatos únicos por mês</Label>
              <Select
                value={faixaId}
                onValueChange={(v) => {
                  setFaixaId(v as FaixaContatosId);
                  limparResultado();
                }}
              >
                <SelectTrigger id="faixa-contatos">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FAIXAS_CONTATOS.map((faixa) => (
                    <SelectItem key={faixa.id} value={faixa.id}>
                      {faixa.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Contato único: quem interagiu no mês conta 1×, independentemente de quantas
                mensagens.
              </p>
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Teste de {billing.billingAfterUsageDays} dias com uso em paralelo — sem desconectar sua
          plataforma atual. Meta cobra separadamente o uso da Cloud API.
        </p>

        <Button
          type="button"
          className="w-full bg-wa-green text-white hover:bg-wa-green-dark"
          size="lg"
          onClick={() => void verOrcamento()}
          disabled={carregando}
        >
          {carregando
            ? "Preparando..."
            : modoComparacao
              ? "Ver economia estimada"
              : "Ver meu orçamento"}
        </Button>

        {modoComparacao && comparacao && orcamentoId ? (
          <ResultadoComparacao
            comparacao={comparacao}
            orcamentoId={orcamentoId}
            planoSugeridoId={planoSugeridoId}
          />
        ) : (
          orcamento &&
          orcamentoId && (
            <ResultadoOrcamento
              orcamento={orcamento}
              orcamentoId={orcamentoId}
              planoSugeridoId={planoSugeridoId}
            />
          )
        )}
      </CardContent>
    </Card>
  );
}
