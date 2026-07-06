import { cobrancaHandlers } from "../../handlers/instancia";
import { os } from "../../lib/os";

export default os.cobranca.cancelarAssinatura.handler(({ context, input }) =>
  cobrancaHandlers.cancelarAssinatura(context, input),
);
