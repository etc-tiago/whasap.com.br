import { campanhaHandlers } from "../../../handlers/campanha";
import { os } from "../../../lib/os";

/** Remove (soft-delete) template memorizado. Admin only. */
export default os.campanha.templatesMemorizados.remover.handler(({ context, input }) =>
  campanhaHandlers.templatesMemorizados.remover(context, input),
);
