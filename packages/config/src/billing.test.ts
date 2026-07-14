import { describe, expect, it } from "vitest";

import { calcularInvestimentoMensal } from "./billing";
import { mvpDefaults } from "./mvp-defaults";

describe("calcularInvestimentoMensal", () => {
  it("escolhe Starter para volume baixo com 1 conexão", () => {
    const r = calcularInvestimentoMensal({ contatosUnicos: 400, conexoes: 1 });
    expect(r.plano.id).toBe("starter");
    expect(r.pacotesContatosExtras).toBe(0);
    expect(r.conexoesExtras).toBe(0);
    expect(r.totalCents).toBe(12_900);
  });

  it("cobra pacotes de 100 contatos no Starter", () => {
    const r = calcularInvestimentoMensal({ contatosUnicos: 700, conexoes: 1 });
    expect(r.plano.id).toBe("starter");
    expect(r.pacotesContatosExtras).toBe(1);
    expect(r.totalCents).toBe(12_900 + 1_500);
  });

  it("prefere plano superior quando extras do Starter encarecem", () => {
    const r = calcularInvestimentoMensal({ contatosUnicos: 1_500, conexoes: 1 });
    expect(r.plano.id).toBe("profissional");
    expect(r.pacotesContatosExtras).toBe(0);
    expect(r.totalCents).toBe(24_900);
  });

  it("cobra conexão adicional a R$39", () => {
    const r = calcularInvestimentoMensal({ contatosUnicos: 500, conexoes: 2 });
    expect(r.plano.id).toBe("starter");
    expect(r.conexoesExtras).toBe(1);
    expect(r.totalCents).toBe(12_900 + mvpDefaults.billing.extraConnectionPriceCents);
  });

  it("Enterprise usa pacote de contatos mais barato em volumes altos", () => {
    const r = calcularInvestimentoMensal({ contatosUnicos: 12_000, conexoes: 3 });
    expect(r.plano.id).toBe("enterprise");
    expect(r.pacotesContatosExtras).toBe(20);
    expect(r.conexoesExtras).toBe(0);
    expect(r.totalCents).toBe(59_900 + 20 * 1_200);
  });
});
