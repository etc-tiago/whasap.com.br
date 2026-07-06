import { relatoriosHandlers } from "../../handlers/reports";
import { os } from "../../lib/os";

export default os.relatorios.visaoGeral.handler(({ context, input }) =>
  relatoriosHandlers.visaoGeral(context, input),
);
