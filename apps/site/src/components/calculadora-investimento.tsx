"use client";

import { mvpDefaults } from "@whasap/config";
import { Badge } from "@whasap/ui/components/badge";
import { Button } from "@whasap/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@whasap/ui/components/card";
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
import { useState } from "react";

import { montarUrlAgendamento, montarUrlWhatsapp, VENDAS_WHATSAPP } from "@/lib/contato-vendas";
import {
  calcularOrcamento,
  FAIXAS_CONVERSAS,
  formatarPrecoBrl,
  type FaixaConversasId,
  type OrcamentoCalculado,
  type OrcamentoRegistro,
} from "@/lib/orcamento";

const { billing } = mvpDefaults;

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

function TabelaPrecos() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Item</TableHead>
          <TableHead className="text-right">Valor</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell className="text-muted-foreground">Plano base da organização</TableCell>
          <TableCell className="text-right text-sm">
            {formatarPrecoBrl(billing.orgBasePriceCents)}/mês ·{" "}
            {billing.conversationsIncludedBase.toLocaleString("pt-BR")} conversas incluídas
          </TableCell>
        </TableRow>
        <TableRow>
          <TableCell className="text-muted-foreground">Conexão WhatsApp</TableCell>
          <TableCell className="text-right text-sm">
            {formatarPrecoBrl(billing.connectionPriceCents)}/mês por número
          </TableCell>
        </TableRow>
        <TableRow>
          <TableCell className="text-muted-foreground">Pacote de conversas</TableCell>
          <TableCell className="text-right text-sm">
            {formatarPrecoBrl(billing.conversationPackPriceCents)}/mês · +
            {billing.conversationsPerPack.toLocaleString("pt-BR")} conversas
          </TableCell>
        </TableRow>
        <TableRow>
          <TableCell className="text-muted-foreground">Atendentes</TableCell>
          <TableCell className="text-right text-sm">Ilimitados · sem custo</TableCell>
        </TableRow>
        <TableRow>
          <TableCell className="text-muted-foreground">Cobrança</TableCell>
          <TableCell className="text-right text-sm">
            Boleto por uso após {billing.billingAfterUsageDays} dias
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}

function ResultadoOrcamento({
  orcamento,
  orcamentoId,
}: {
  orcamento: OrcamentoCalculado;
  orcamentoId: string;
}) {
  const totalLabel = orcamento.aPartirDe
    ? `a partir de ${formatarPrecoBrl(orcamento.totalCents)}/mês`
    : `${formatarPrecoBrl(orcamento.totalCents)}/mês`;

  const registrarTrilha = (trilha: "whatsapp" | "videoconferencia") => {
    const registro: OrcamentoRegistro = {
      id: orcamentoId,
      criadoEm: new Date().toISOString(),
      numerosWhatsapp: orcamento.numerosWhatsapp,
      atendentes: orcamento.atendentes,
      faixaConversas: orcamento.faixaConversas,
      conversasEstimadas: orcamento.conversasEstimadas,
      totalCents: orcamento.totalCents,
      aPartirDe: orcamento.aPartirDe,
      trilha,
      referrer: typeof document !== "undefined" ? document.referrer : undefined,
    };
    void registrarOrcamento(registro);
  };

  return (
    <div className="space-y-6 border-t border-border pt-6">
      <div>
        <p className="text-sm font-medium text-wa-green-dark">Seu orçamento estimado</p>
        <p className="mt-1 text-3xl font-bold tracking-tight">{totalLabel}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {orcamento.numerosWhatsapp} número{orcamento.numerosWhatsapp > 1 ? "s" : ""} do WhatsApp ·{" "}
          {orcamento.atendentes} atendentes · {orcamento.faixaConversas}
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          Esse valor é uma estimativa transparente. Para fechar o plano certo — sem pagar a mais —
          escolha como prefere falar com a gente:
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-wa-green/20 bg-wa-green/5">
          <CardHeader className="pb-2">
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-wa-green/15 text-wa-green-dark">
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

export function CalculadoraInvestimento() {
  const [numerosWhatsapp, setNumerosWhatsapp] = useState(1);
  const [atendentes, setAtendentes] = useState(3);
  const [faixaId, setFaixaId] = useState<FaixaConversasId>("500-1000");
  const [orcamento, setOrcamento] = useState<OrcamentoCalculado | null>(null);
  const [orcamentoId, setOrcamentoId] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  const verOrcamento = async () => {
    setCarregando(true);
    const calculado = calcularOrcamento({ numerosWhatsapp, atendentes, faixaId });
    const id = crypto.randomUUID();
    setOrcamento(calculado);
    setOrcamentoId(id);

    await registrarOrcamento({
      id,
      criadoEm: new Date().toISOString(),
      numerosWhatsapp: calculado.numerosWhatsapp,
      atendentes: calculado.atendentes,
      faixaConversas: calculado.faixaConversas,
      conversasEstimadas: calculado.conversasEstimadas,
      totalCents: calculado.totalCents,
      aPartirDe: calculado.aPartirDe,
      referrer: typeof document !== "undefined" ? document.referrer : undefined,
    });

    setCarregando(false);
  };

  return (
    <Card className="border-border/80 shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl">Simule seu investimento</CardTitle>
        <p className="text-sm text-muted-foreground">
          Veja quanto custa operar com transparência — sem surpresas na fatura.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <TabelaPrecos />

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
                setOrcamento(null);
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
                setOrcamento(null);
              }}
            />
            {atendentes >= 3 && (
              <p className="text-xs text-muted-foreground">
                Sua equipe de {atendentes} atendentes — sem custo adicional por usuário.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="faixa-conversas">Conversas por mês</Label>
            <Select
              value={faixaId}
              onValueChange={(v) => {
                setFaixaId(v as FaixaConversasId);
                setOrcamento(null);
              }}
            >
              <SelectTrigger id="faixa-conversas">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FAIXAS_CONVERSAS.map((faixa) => (
                  <SelectItem key={faixa.id} value={faixa.id}>
                    {faixa.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Pacotes extras são contratados por número do WhatsApp conforme a necessidade. Meta cobra
          separadamente o uso da Cloud API.
        </p>

        <Button
          type="button"
          className="w-full bg-wa-green text-white hover:bg-wa-green-dark"
          size="lg"
          onClick={() => void verOrcamento()}
          disabled={carregando}
        >
          {carregando ? "Preparando..." : "Ver meu orçamento"}
        </Button>

        {orcamento && orcamentoId && (
          <ResultadoOrcamento orcamento={orcamento} orcamentoId={orcamentoId} />
        )}
      </CardContent>
    </Card>
  );
}
