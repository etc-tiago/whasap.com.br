import { instanciaHandlers } from "../../handlers/instancia";
import { os } from "../../lib/os";

export default os.instancia.configurarCloud.handler(({ context, input }) =>
  instanciaHandlers.configurarCloud(context, input),
);
