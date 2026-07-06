import { cobrancaHandlers } from "../../handlers/instancia";
import { os } from "../../lib/os";

export default os.cobranca.assinaturas.handler(({ context, input }) =>
  cobrancaHandlers.assinaturas(context, input),
);
