import { instanciaHandlers } from "../../handlers/instancia";
import { os } from "../../lib/os";

export default os.instancia.provisionar.handler(({ context, input }) =>
  instanciaHandlers.provisionar(context, input),
);
