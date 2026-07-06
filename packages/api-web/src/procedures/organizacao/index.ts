import aceitar from "./convites/aceitar";
import convitesLista from "./convites/lista";
import atualizar from "./atualizar";
import lista from "./lista";
import convidar from "./membros/convidar";
import atualizarPapel from "./membros/atualizar-papel";
import desativar from "./membros/desativar";
import membrosLista from "./membros/lista";
import obter from "./obter";
import trocar from "./trocar";

export default {
  lista,
  obter,
  atualizar,
  trocar,
  membros: {
    lista: membrosLista,
    convidar,
    atualizarPapel,
    desativar,
  },
  convites: {
    lista: convitesLista,
    aceitar,
  },
};
