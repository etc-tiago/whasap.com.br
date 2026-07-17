import { describe, expect, it } from "vitest";

import { calcularInvestimentoMensal } from "./billing";
import { mvpDefaults } from "./mvp-defaults";

describe("calcularInvestimentoMensal", () => {
  it("escolhe Starter para volume baixo com 1 conexão", () => {
    const r = calcularInvestimentoMensal({ contatosUnicos: 800, conexoes: 1 });
    expect(r.plano.id).toBe("starter");
    expect(r.pacotesContatosExtras).toBe(0);
    expect(r.conexoesExtras).toBe(0);
    expect(r.totalCents).toBe(24_900);
  });

  it("cobra pacotes de 100 contatos no Starter", () => {
    const r = calcularInvestimentoMensal({ contatosUnicos: 2_100, conexoes: 1 });
    expect(r.plano.id).toBe("starter");
    expect(r.pacotesContatosExtras).toBe(1);
    expect(r.totalCents).toBe(24_900 + 2_000);
  });

  it("prefere plano superior quando extras do Starter encarecem", () => {
    const r = calcularInvestimentoMensal({ contatosUnicos: 5_000, conexoes: 1 });
    expect(r.plano.id).toBe("profissional");
    expect(r.pacotesContatosExtras).toBe(0);
    expect(r.totalCents).toBe(44_900);
  });

  it("cobra conexão adicional a R$49", () => {
    const r = calcularInvestimentoMensal({ contatosUnicos: 500, conexoes: 2 });
    expect(r.plano.id).toBe("starter");
    expect(r.conexoesExtras).toBe(1);
    expect(r.totalCents).toBe(24_900 + mvpDefaults.billing.extraConnectionPriceCents);
  });

  it("Enterprise usa pacote de contatos mais barato em volumes altos", () => {
    const r = calcularInvestimentoMensal({ contatosUnicos: 45_000, conexoes: 5 });
    expect(r.plano.id).toBe("enterprise");
    expect(r.pacotesContatosExtras).toBe(50);
    expect(r.conexoesExtras).toBe(0);
    expect(r.totalCents).toBe(129_900 + 50 * 1_200);
  });
});
