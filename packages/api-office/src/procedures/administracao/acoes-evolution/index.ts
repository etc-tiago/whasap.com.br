import { acoesEvolutionHandlers } from "../../../handlers/acoes-evolution";
import { os } from "../../../lib/os";

export default {
  lista: os.administracao.acoesEvolution.lista.handler(({ context, input }) =>
    acoesEvolutionHandlers.lista(context, input),
  ),
  obter: os.administracao.acoesEvolution.obter.handler(({ context, input }) =>
    acoesEvolutionHandlers.obter(context, input),
  ),
};
