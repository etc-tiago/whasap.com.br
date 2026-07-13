/**
 * Relatórios da organização — dashboard de atendimento.
 * Filtros: período, atendente e número (instância).
 * RBAC: bloqueado para papel `usuario` (admin/analista).
 */
import { createFileRoute } from "@tanstack/react-router";
import { skipToken, useQuery } from "@tanstack/react-query";
import { rotuloProvedor } from "@whasap/config";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@whasap/ui/components/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@whasap/ui/components/chart";
import { Input } from "@whasap/ui/components/input";
import { Label } from "@whasap/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@whasap/ui/components/select";
import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";

import { orgInput } from "@/lib/org-input";
import { orpc, type RelatorioVisaoGeral } from "@/lib/orpc";
import { useOrganizacaoHash } from "@/lib/use-organizacao-hash";

export const Route = createFileRoute("/_panel/$organizacaoHash/relatorios")({
  component: ReportsPage,
});

const TODOS = "__todos__";

type PeriodoPreset = "7" | "30" | "90" | "custom";

const CORES_CHART = [
  "oklch(0.55 0.15 155)",
  "oklch(0.62 0.13 230)",
  "oklch(0.7 0.14 85)",
  "oklch(0.65 0.16 40)",
  "oklch(0.6 0.12 300)",
  "oklch(0.55 0.1 200)",
] as const;

const ROTULOS_TIPO: Record<string, string> = {
  text: "Texto",
  image: "Imagem",
  audio: "Áudio",
  video: "Vídeo",
  document: "Documento",
  sticker: "Figurinha",
  template: "Template",
  reaction: "Reação",
  location: "Localização",
  contact: "Contato",
};

function inicioDoDia(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function fimDoDia(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function dataInputValue(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDataInput(value: string, fim = false) {
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return fim ? fimDoDia(new Date()) : inicioDoDia(new Date());
  const date = new Date(y, m - 1, d);
  return fim ? fimDoDia(date) : inicioDoDia(date);
}

function intervaloPreset(preset: Exclude<PeriodoPreset, "custom">) {
  const ate = fimDoDia(new Date());
  const de = inicioDoDia(new Date());
  de.setDate(de.getDate() - Number(preset) + 1);
  return { de, ate };
}

function formatarMinutos(minutos: number | null | undefined) {
  if (minutos == null) return "—";
  if (minutos < 1) return "< 1 min";
  if (minutos < 60) return `${Math.round(minutos)} min`;
  const h = Math.floor(minutos / 60);
  const m = Math.round(minutos % 60);
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

function formatarNumero(n: number) {
  return n.toLocaleString("pt-BR");
}

function formatarDiaCurto(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}

function ReportsPage() {
  const organizacaoHash = useOrganizacaoHash();

  const [periodoPreset, setPeriodoPreset] = useState<PeriodoPreset>("30");
  const inicial = intervaloPreset("30");
  const [deInput, setDeInput] = useState(dataInputValue(inicial.de));
  const [ateInput, setAteInput] = useState(dataInputValue(inicial.ate));
  const [atendenteId, setAtendenteId] = useState(TODOS);
  const [instanciaId, setInstanciaId] = useState(TODOS);

  const org = useQuery(
    orpc.organizacao.obter.queryOptions({
      input: orgInput(organizacaoHash),
    }),
  );

  const membros = useQuery(
    orpc.organizacao.membros.lista.queryOptions({
      input: orgInput(organizacaoHash),
    }),
  );

  const instancias = useQuery(
    orpc.instancia.lista.queryOptions({
      input: orgInput(organizacaoHash),
    }),
  );

  const canViewReports = Boolean(organizacaoHash) && org.data?.meuPapel !== "usuario";

  const { de, ate } =
    periodoPreset === "custom"
      ? { de: parseDataInput(deInput), ate: parseDataInput(ateInput, true) }
      : intervaloPreset(periodoPreset);

  const report = useQuery(
    orpc.relatorios.visaoGeral.queryOptions({
      input: canViewReports
        ? {
            organizacaoHash: organizacaoHash!,
            de: de.toISOString(),
            ate: ate.toISOString(),
            instanciaId: instanciaId === TODOS ? undefined : instanciaId,
            usuarioId: atendenteId === TODOS ? undefined : atendenteId,
          }
        : skipToken,
    }),
  );

  if (org.data?.meuPapel === "usuario") {
    return (
      <div className="flex h-full items-center justify-center overflow-auto p-6">
        <p className="text-sm text-muted-foreground">Relatórios não disponíveis para seu perfil.</p>
      </div>
    );
  }

  const data = report.data;
  const dist = data?.distribuicaoTempoResposta;
  const totalMensagens = (data?.mensagensEnviadas ?? 0) + (data?.mensagensRecebidas ?? 0);

  const tempoRespostaData = [
    { faixa: "ate5", label: "≤ 5 min", total: dist?.ate5Min ?? 0, fill: "var(--color-ate5)" },
    {
      faixa: "de5a15",
      label: "5–15 min",
      total: dist?.de5a15Min ?? 0,
      fill: "var(--color-de5a15)",
    },
    {
      faixa: "de15a60",
      label: "15–60 min",
      total: dist?.de15a60Min ?? 0,
      fill: "var(--color-de15a60)",
    },
    {
      faixa: "acima60",
      label: "> 60 min",
      total: dist?.acima60Min ?? 0,
      fill: "var(--color-acima60)",
    },
    {
      faixa: "semResposta",
      label: "Sem resposta",
      total: dist?.semResposta ?? 0,
      fill: "var(--color-semResposta)",
    },
  ];

  const tempoRespostaConfig = {
    total: { label: "Conversas" },
    ate5: { label: "≤ 5 min", color: "oklch(0.62 0.14 155)" },
    de5a15: { label: "5–15 min", color: "oklch(0.7 0.14 130)" },
    de15a60: { label: "15–60 min", color: "oklch(0.75 0.14 85)" },
    acima60: { label: "> 60 min", color: "oklch(0.68 0.16 45)" },
    semResposta: { label: "Sem resposta", color: "oklch(0.72 0.02 155)" },
  } satisfies ChartConfig;

  const serieConfig = {
    conversas: { label: "Conversas", color: "oklch(0.55 0.15 155)" },
    enviadas: { label: "Enviadas", color: "oklch(0.62 0.13 230)" },
    recebidas: { label: "Recebidas", color: "oklch(0.7 0.14 85)" },
  } satisfies ChartConfig;

  const serieData =
    data?.serieDiaria.map((d) => ({
      ...d,
      label: formatarDiaCurto(d.data),
    })) ?? [];

  const statusData = [
    {
      id: "abertas",
      nome: "Abertas",
      total: data?.conversasAbertas ?? 0,
      fill: "oklch(0.62 0.13 230)",
    },
    {
      id: "fechadas",
      nome: "Fechadas",
      total: data?.conversasFechadas ?? 0,
      fill: "oklch(0.55 0.15 155)",
    },
  ];

  const statusConfig = {
    total: { label: "Conversas" },
    abertas: { label: "Abertas", color: "oklch(0.62 0.13 230)" },
    fechadas: { label: "Fechadas", color: "oklch(0.55 0.15 155)" },
  } satisfies ChartConfig;

  const tiposData =
    data?.porTipoMensagem.map((item, i) => ({
      id: item.tipo,
      nome: ROTULOS_TIPO[item.tipo] ?? item.tipo,
      total: item.total,
      fill: CORES_CHART[i % CORES_CHART.length]!,
    })) ?? [];

  const tiposConfig = {
    total: { label: "Mensagens" },
    ...Object.fromEntries(
      tiposData.map((item) => [item.id, { label: item.nome, color: item.fill }]),
    ),
  } satisfies ChartConfig;

  const itensData =
    data?.porItemInteresse.map((item, i) => ({
      id: item.id,
      nome: item.nome,
      total: item.total,
      fill: item.cor ?? CORES_CHART[i % CORES_CHART.length]!,
    })) ?? [];

  const itensConfig = {
    total: { label: "Aplicações" },
    ...Object.fromEntries(
      itensData.map((item) => [item.id, { label: item.nome, color: item.fill }]),
    ),
  } satisfies ChartConfig;

  const agentesData =
    data?.porAgente.map((a) => ({
      nome: a.nome.split(" ")[0] ?? a.nome,
      nomeCompleto: a.nome,
      conversas: a.conversasAtribuidas,
      fechadas: a.conversasFechadas,
      enviadas: a.mensagensEnviadas,
      tempo: a.tempoMedioPrimeiraRespostaMinutos,
    })) ?? [];

  const agentesConfig = {
    conversas: { label: "Conversas", color: "oklch(0.55 0.15 155)" },
    fechadas: { label: "Fechadas", color: "oklch(0.7 0.14 85)" },
    enviadas: { label: "Enviadas", color: "oklch(0.62 0.13 230)" },
  } satisfies ChartConfig;

  const numerosData =
    data?.porInstancia.map((i) => ({
      nome: i.nome,
      conversas: i.conversas,
      abertas: i.conversasAbertas,
      fechadas: i.conversasFechadas,
      enviadas: i.mensagensEnviadas,
      recebidas: i.mensagensRecebidas,
    })) ?? [];

  const numerosConfig = {
    abertas: { label: "Abertas", color: "oklch(0.62 0.13 230)" },
    fechadas: { label: "Fechadas", color: "oklch(0.55 0.15 155)" },
  } satisfies ChartConfig;

  const temDistribuicao = tempoRespostaData.some((d) => d.total > 0);
  const temSerie = serieData.some((d) => d.conversas + d.enviadas + d.recebidas > 0);
  const temStatus = statusData.some((d) => d.total > 0);

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Relatórios</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Dashboard de volume, tempo de resposta e desempenho da equipe.
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            {de.toLocaleDateString("pt-BR")} — {ate.toLocaleDateString("pt-BR")}
          </p>
        </div>

        <Card>
          <CardContent className="grid gap-4 pt-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>Período</Label>
              <Select
                value={periodoPreset}
                onValueChange={(v) => {
                  const preset = v as PeriodoPreset;
                  setPeriodoPreset(preset);
                  if (preset !== "custom") {
                    const intervalo = intervaloPreset(preset);
                    setDeInput(dataInputValue(intervalo.de));
                    setAteInput(dataInputValue(intervalo.ate));
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Últimos 7 dias</SelectItem>
                  <SelectItem value="30">Últimos 30 dias</SelectItem>
                  <SelectItem value="90">Últimos 90 dias</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Atendente</Label>
              <Select value={atendenteId} onValueChange={setAtendenteId}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS}>Todos</SelectItem>
                  {(membros.data ?? []).map((m) => (
                    <SelectItem key={m.usuarioId} value={m.usuarioId}>
                      {m.usuarioNome ?? m.usuarioEmail ?? m.usuarioId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Número</Label>
              <Select value={instanciaId} onValueChange={setInstanciaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS}>Todos</SelectItem>
                  {(instancias.data ?? []).map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.nome}
                      {i.cloudPhoneNumberId
                        ? ` · ${i.cloudPhoneNumberId}`
                        : ` · ${rotuloProvedor(i.provider)}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {periodoPreset === "custom" ? (
              <div className="grid grid-cols-2 gap-2 sm:col-span-2 lg:col-span-1">
                <div className="space-y-2">
                  <Label htmlFor="relatorio-de">De</Label>
                  <Input
                    id="relatorio-de"
                    type="date"
                    value={deInput}
                    max={ateInput}
                    onChange={(e) => setDeInput(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="relatorio-ate">Até</Label>
                  <Input
                    id="relatorio-ate"
                    type="date"
                    value={ateInput}
                    min={deInput}
                    onChange={(e) => setAteInput(e.target.value)}
                  />
                </div>
              </div>
            ) : (
              <div className="hidden lg:block" />
            )}
          </CardContent>
        </Card>

        {report.isLoading ? (
          <p className="text-center text-sm text-muted-foreground">Carregando…</p>
        ) : report.isError ? (
          <p className="text-center text-sm text-destructive">
            Não foi possível carregar os relatórios.
          </p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <MetricCard
                title="Conversas"
                value={formatarNumero(data?.totalConversas ?? 0)}
                hint={`${data?.conversasAbertas ?? 0} abertas · ${data?.conversasFechadas ?? 0} fechadas`}
              />
              <MetricCard
                title="Taxa de fechamento"
                value={`${data?.taxaFechamento ?? 0}%`}
                hint={
                  data?.tempoMedioAteFechamentoMinutos != null
                    ? `Média até fechar ${formatarMinutos(data.tempoMedioAteFechamentoMinutos)}`
                    : "Sem fechamentos no período"
                }
              />
              <MetricCard
                title="Contatos"
                value={formatarNumero(data?.totalContatos ?? 0)}
                hint="Únicos no período"
              />
              <MetricCard
                title="Mensagens"
                value={formatarNumero(totalMensagens)}
                hint={`${formatarNumero(data?.mensagensEnviadas ?? 0)} env. · ${formatarNumero(data?.mensagensRecebidas ?? 0)} rec.`}
              />
              <MetricCard
                title="1ª resposta"
                value={formatarMinutos(data?.tempoMedioPrimeiraRespostaMinutos)}
                hint={
                  data?.conversasComResposta
                    ? `Média · mediana ${formatarMinutos(data.tempoMedianoPrimeiraRespostaMinutos)}`
                    : "Sem respostas no período"
                }
              />
              <MetricCard
                title="Sem atribuição"
                value={formatarNumero(data?.conversasSemAtribuicao ?? 0)}
                hint={
                  data?.mediaMensagensPorConversa != null
                    ? `${data.mediaMensagensPorConversa} msgs/conversa`
                    : "Média de msgs indisponível"
                }
              />
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Volume diário</CardTitle>
                <CardDescription>
                  Conversas criadas e mensagens enviadas/recebidas por dia
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!temSerie ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    Sem movimento no período.
                  </p>
                ) : (
                  <ChartContainer
                    config={serieConfig}
                    className="aspect-video min-h-[220px] w-full"
                  >
                    <AreaChart accessibilityLayer data={serieData}>
                      <CartesianGrid vertical={false} />
                      <XAxis
                        dataKey="label"
                        tickLine={false}
                        tickMargin={8}
                        axisLine={false}
                        minTickGap={24}
                        tick={{ fontSize: 11 }}
                      />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
                      <ChartTooltip
                        content={
                          <ChartTooltipContent
                            labelFormatter={(_, payload) =>
                              String(payload?.[0]?.payload?.data ?? "")
                            }
                          />
                        }
                      />
                      <ChartLegend content={<ChartLegendContent />} />
                      <Area
                        type="monotone"
                        dataKey="conversas"
                        stroke="var(--color-conversas)"
                        fill="var(--color-conversas)"
                        fillOpacity={0.15}
                        strokeWidth={2}
                      />
                      <Area
                        type="monotone"
                        dataKey="enviadas"
                        stroke="var(--color-enviadas)"
                        fill="var(--color-enviadas)"
                        fillOpacity={0.1}
                        strokeWidth={2}
                      />
                      <Area
                        type="monotone"
                        dataKey="recebidas"
                        stroke="var(--color-recebidas)"
                        fill="var(--color-recebidas)"
                        fillOpacity={0.1}
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Status</CardTitle>
                  <CardDescription>Abertas vs fechadas</CardDescription>
                </CardHeader>
                <CardContent>
                  {!temStatus ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      Sem conversas no período.
                    </p>
                  ) : (
                    <ChartContainer
                      config={statusConfig}
                      className="mx-auto aspect-square max-h-[240px] w-full"
                    >
                      <PieChart>
                        <ChartTooltip content={<ChartTooltipContent nameKey="id" hideLabel />} />
                        <Pie
                          data={statusData}
                          dataKey="total"
                          nameKey="id"
                          innerRadius={50}
                          strokeWidth={2}
                        >
                          {statusData.map((item) => (
                            <Cell key={item.id} fill={item.fill} />
                          ))}
                        </Pie>
                        <ChartLegend
                          content={<ChartLegendContent nameKey="id" />}
                          className="-translate-y-1 flex-wrap gap-2 *:basis-1/2 *:justify-center"
                        />
                      </PieChart>
                    </ChartContainer>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Tempo de resposta</CardTitle>
                  <CardDescription>
                    1ª resposta · média {formatarMinutos(data?.tempoMedioPrimeiraRespostaMinutos)}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!temDistribuicao ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      Sem conversas no período.
                    </p>
                  ) : (
                    <ChartContainer config={tempoRespostaConfig} className="aspect-4/3 w-full">
                      <BarChart accessibilityLayer data={tempoRespostaData}>
                        <CartesianGrid vertical={false} />
                        <XAxis
                          dataKey="label"
                          tickLine={false}
                          tickMargin={8}
                          axisLine={false}
                          tick={{ fontSize: 10 }}
                        />
                        <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} />
                        <ChartTooltip
                          cursor={false}
                          content={<ChartTooltipContent hideLabel nameKey="faixa" />}
                        />
                        <Bar dataKey="total" radius={4}>
                          {tempoRespostaData.map((item) => (
                            <Cell key={item.faixa} fill={item.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ChartContainer>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Tipos de mensagem</CardTitle>
                  <CardDescription>Composição do volume no período</CardDescription>
                </CardHeader>
                <CardContent>
                  {tiposData.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      Sem mensagens no período.
                    </p>
                  ) : (
                    <ChartContainer
                      config={tiposConfig}
                      className="mx-auto aspect-square max-h-[240px] w-full"
                    >
                      <PieChart>
                        <ChartTooltip content={<ChartTooltipContent nameKey="id" hideLabel />} />
                        <Pie
                          data={tiposData}
                          dataKey="total"
                          nameKey="id"
                          innerRadius={50}
                          strokeWidth={2}
                        >
                          {tiposData.map((item) => (
                            <Cell key={item.id} fill={item.fill} />
                          ))}
                        </Pie>
                        <ChartLegend
                          content={<ChartLegendContent nameKey="id" />}
                          className="-translate-y-1 flex-wrap gap-2 *:basis-1/3 *:justify-center"
                        />
                      </PieChart>
                    </ChartContainer>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Itens de interesse</CardTitle>
                  <CardDescription>
                    {data?.itensInteresse
                      ? `${formatarNumero(data.itensInteresse)} etiquetas aplicadas`
                      : "Etiquetas aplicadas no período"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {itensData.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      Nenhuma etiqueta aplicada aos contatos do período.
                    </p>
                  ) : (
                    <ChartContainer
                      config={itensConfig}
                      className="mx-auto aspect-square max-h-[280px] w-full"
                    >
                      <PieChart>
                        <ChartTooltip content={<ChartTooltipContent nameKey="id" hideLabel />} />
                        <Pie
                          data={itensData}
                          dataKey="total"
                          nameKey="id"
                          innerRadius={55}
                          strokeWidth={2}
                        >
                          {itensData.map((item) => (
                            <Cell key={item.id} fill={item.fill} />
                          ))}
                        </Pie>
                        <ChartLegend
                          content={<ChartLegendContent nameKey="id" />}
                          className="-translate-y-1 flex-wrap gap-2 *:basis-1/3 *:justify-center"
                        />
                      </PieChart>
                    </ChartContainer>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Por número</CardTitle>
                  <CardDescription>Conversas abertas e fechadas por conexão</CardDescription>
                </CardHeader>
                <CardContent>
                  {numerosData.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      Nenhum número no período.
                    </p>
                  ) : (
                    <ChartContainer config={numerosConfig} className="aspect-4/3 w-full">
                      <BarChart accessibilityLayer data={numerosData}>
                        <CartesianGrid vertical={false} />
                        <XAxis
                          dataKey="nome"
                          tickLine={false}
                          tickMargin={8}
                          axisLine={false}
                          tick={{ fontSize: 11 }}
                        />
                        <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <ChartLegend content={<ChartLegendContent />} />
                        <Bar
                          dataKey="abertas"
                          stackId="status"
                          fill="var(--color-abertas)"
                          radius={[0, 0, 0, 0]}
                        />
                        <Bar
                          dataKey="fechadas"
                          stackId="status"
                          fill="var(--color-fechadas)"
                          radius={[4, 4, 0, 0]}
                        >
                          <LabelList
                            dataKey="conversas"
                            position="top"
                            className="fill-foreground"
                            fontSize={11}
                          />
                        </Bar>
                      </BarChart>
                    </ChartContainer>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Por atendente</CardTitle>
                <CardDescription>
                  Conversas atribuídas, fechamentos e mensagens enviadas
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {agentesData.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Sem atividade no período.
                  </p>
                ) : (
                  <>
                    <ChartContainer
                      config={agentesConfig}
                      className="aspect-16/7 min-h-[220px] w-full"
                    >
                      <BarChart accessibilityLayer data={agentesData}>
                        <CartesianGrid vertical={false} />
                        <XAxis
                          dataKey="nome"
                          tickLine={false}
                          tickMargin={8}
                          axisLine={false}
                          tick={{ fontSize: 11 }}
                        />
                        <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
                        <ChartTooltip
                          content={
                            <ChartTooltipContent
                              labelFormatter={(_, payload) =>
                                String(payload?.[0]?.payload?.nomeCompleto ?? "")
                              }
                            />
                          }
                        />
                        <ChartLegend content={<ChartLegendContent />} />
                        <Bar dataKey="conversas" fill="var(--color-conversas)" radius={4} />
                        <Bar dataKey="fechadas" fill="var(--color-fechadas)" radius={4} />
                        <Bar dataKey="enviadas" fill="var(--color-enviadas)" radius={4} />
                      </BarChart>
                    </ChartContainer>

                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left text-muted-foreground">
                            <th className="pb-2 font-medium">Atendente</th>
                            <th className="pb-2 text-right font-medium">Conversas</th>
                            <th className="pb-2 text-right font-medium">Fechadas</th>
                            <th className="pb-2 text-right font-medium">Enviadas</th>
                            <th className="pb-2 text-right font-medium">1ª resposta</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {data!.porAgente.map((a: RelatorioVisaoGeral["porAgente"][number]) => (
                            <tr key={a.usuarioId}>
                              <td className="py-2.5 font-medium">{a.nome}</td>
                              <td className="py-2.5 text-right tabular-nums">
                                {formatarNumero(a.conversasAtribuidas)}
                              </td>
                              <td className="py-2.5 text-right tabular-nums">
                                {formatarNumero(a.conversasFechadas)}
                              </td>
                              <td className="py-2.5 text-right tabular-nums">
                                {formatarNumero(a.mensagensEnviadas)}
                              </td>
                              <td className="py-2.5 text-right tabular-nums text-muted-foreground">
                                {formatarMinutos(a.tempoMedioPrimeiraRespostaMinutos)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  hint,
}: {
  title: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}
