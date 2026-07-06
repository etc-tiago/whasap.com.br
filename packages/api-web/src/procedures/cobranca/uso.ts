import { cobrancaHandlers } from "../../handlers/instancia";
import { os } from "../../lib/os";

export default os.cobranca.uso.handler(({ context, input }) =>
  cobrancaHandlers.uso(context, input),
);
