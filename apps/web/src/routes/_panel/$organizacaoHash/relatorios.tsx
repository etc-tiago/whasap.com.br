/**
 * Relatórios da organização — visão geral em uma página.
 * Filtros: período, atendente e número (instância).
 * RBAC: bloqueado para papel `usuario` (admin/analista).
 */
import { createFileRoute } from "@tanstack/react-router";
import { skipToken, useQuery } from "@tanstack/react-query";
import { rotuloProvedor } from "@whasap/config";
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
import { useState } from "react";

import { orgInput } from "@/lib/org-input";
import { orpc, type RelatorioVisaoGeral } from "@/lib/orpc";
import { useOrganizacaoHash } from "@/lib/use-organizacao-hash";

export const Route = createFileRoute("/_panel/$organizacaoHash/relatorios")({
  component: ReportsPage,
});

const TODOS = "__todos__";

type PeriodoPreset = "7" | "30" | "90" | "custom";

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
      <div className="h-full overflow-auto p-6">
        <p className="text-sm text-muted-foreground">Relatórios não disponíveis para seu perfil.</p>
      </div>
    );
  }

  const data = report.data;
  const dist = data?.distribuicaoTempoResposta;
  const totalDist =
    (dist?.ate5Min ?? 0) +
    (dist?.de5a15Min ?? 0) +
    (dist?.de15a60Min ?? 0) +
    (dist?.acima60Min ?? 0) +
    (dist?.semResposta ?? 0);

  return (
    <div className="h-full space-y-6 overflow-auto p-6">
      <div>
        <h1 className="text-2xl font-semibold">Relatórios</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Visão geral de atendimento, tempo de resposta e itens de interesse no período.
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
            <div className="flex items-end">
              <p className="pb-2 text-sm text-muted-foreground">
                {de.toLocaleDateString("pt-BR")} — {ate.toLocaleDateString("pt-BR")}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {report.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : report.isError ? (
        <p className="text-sm text-destructive">Não foi possível carregar os relatórios.</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard title="Contatos" value={data?.totalContatos ?? 0} />
            <MetricCard
              title="Conversas"
              value={data?.totalConversas ?? 0}
              hint={`${data?.conversasAbertas ?? 0} abertas · ${data?.conversasFechadas ?? 0} fechadas`}
            />
            <MetricCard
              title="Itens de interesse"
              value={data?.itensInteresse ?? 0}
              hint="Etiquetas aplicadas no período"
            />
            <MetricCard
              title="1ª resposta (média)"
              value={formatarMinutos(data?.tempoMedioPrimeiraRespostaMinutos)}
              hint={
                data?.conversasComResposta
                  ? `${data.conversasComResposta} conversas com resposta`
                  : "Sem respostas no período"
              }
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Análise de tempo de resposta</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <StatMini
                    label="Média"
                    value={formatarMinutos(data?.tempoMedioPrimeiraRespostaMinutos)}
                  />
                  <StatMini
                    label="Mediana"
                    value={formatarMinutos(data?.tempoMedianoPrimeiraRespostaMinutos)}
                  />
                  <StatMini label="Com resposta" value={String(data?.conversasComResposta ?? 0)} />
                  <StatMini label="Sem resposta" value={String(dist?.semResposta ?? 0)} />
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Distribuição da 1ª resposta</p>
                  {totalDist === 0 ? (
                    <p className="text-sm text-muted-foreground">Sem conversas no período.</p>
                  ) : (
                    <ul className="space-y-2">
                      <FaixaBar
                        label="Até 5 min"
                        count={dist?.ate5Min ?? 0}
                        total={totalDist}
                        className="bg-emerald-500"
                      />
                      <FaixaBar
                        label="5–15 min"
                        count={dist?.de5a15Min ?? 0}
                        total={totalDist}
                        className="bg-lime-500"
                      />
                      <FaixaBar
                        label="15–60 min"
                        count={dist?.de15a60Min ?? 0}
                        total={totalDist}
                        className="bg-amber-500"
                      />
                      <FaixaBar
                        label="Acima de 60 min"
                        count={dist?.acima60Min ?? 0}
                        total={totalDist}
                        className="bg-orange-500"
                      />
                      <FaixaBar
                        label="Sem resposta"
                        count={dist?.semResposta ?? 0}
                        total={totalDist}
                        className="bg-muted-foreground/40"
                      />
                    </ul>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 border-t pt-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Mensagens enviadas</p>
                    <p className="font-semibold">{data?.mensagensEnviadas ?? 0}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Mensagens recebidas</p>
                    <p className="font-semibold">{data?.mensagensRecebidas ?? 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Itens de interesse</CardTitle>
              </CardHeader>
              <CardContent>
                {(data?.porItemInteresse?.length ?? 0) === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhuma etiqueta aplicada aos contatos do período.
                  </p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {data!.porItemInteresse.map((item) => (
                      <li key={item.id} className="flex items-center justify-between gap-3">
                        <span className="flex min-w-0 items-center gap-2">
                          <span
                            className="size-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: item.cor ?? "var(--muted-foreground)" }}
                          />
                          <span className="truncate">{item.nome}</span>
                        </span>
                        <span className="shrink-0 text-muted-foreground">{item.total}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Por atendente</CardTitle>
              </CardHeader>
              <CardContent>
                {(data?.porAgente?.length ?? 0) === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem atividade no período.</p>
                ) : (
                  <ul className="space-y-3 text-sm">
                    {data!.porAgente.map((a: RelatorioVisaoGeral["porAgente"][number]) => (
                      <li key={a.usuarioId} className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{a.nome}</p>
                          <p className="text-muted-foreground">
                            {a.conversasAtribuidas} conversas · {a.mensagensEnviadas} enviadas
                          </p>
                        </div>
                        <span className="shrink-0 text-muted-foreground">
                          {formatarMinutos(a.tempoMedioPrimeiraRespostaMinutos)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Por número</CardTitle>
              </CardHeader>
              <CardContent>
                {(data?.porInstancia?.length ?? 0) === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum número no período.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {data!.porInstancia.map((i) => (
                      <li key={i.instanciaId} className="flex justify-between gap-3">
                        <span className="truncate">{i.nome}</span>
                        <span className="shrink-0 text-muted-foreground">
                          {i.conversas} conversas
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
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
        <p className="text-2xl font-semibold">{value}</p>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

function StatMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}

function FaixaBar({
  label,
  count,
  total,
  className,
}: {
  label: string;
  count: number;
  total: number;
  className: string;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <li className="space-y-1">
      <div className="flex justify-between text-xs">
        <span>{label}</span>
        <span className="text-muted-foreground">
          {count} · {pct}%
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${className}`} style={{ width: `${pct}%` }} />
      </div>
    </li>
  );
}
