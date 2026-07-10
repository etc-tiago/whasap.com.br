import { caixaEntradaHandlers } from "../../../handlers/inbox";
import { os } from "../../../lib/os";

export default os.caixaEntrada.midia.upload.handler(({ context, input }) =>
  caixaEntradaHandlers.midia.upload(context, input),
);
