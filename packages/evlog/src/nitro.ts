import type { NitroConfig } from "nitro/types";
import evlog from "evlog/nitro/v3";

import type { ServicoEvlog } from "./servicos";
import { SERVICOS } from "./servicos";

type ModuloNitro = NonNullable<NitroConfig["modules"]>[number];

/** Config Nitro v3 com evlog e async context para `useLogger()` / `useRequest()`. */
export function criarConfigNitro(servico: ServicoEvlog): NitroConfig {
  return {
    experimental: {
      asyncContext: true,
    },
    modules: [
      evlog({
        env: { service: SERVICOS[servico] },
        exclude: ["/assets/**", "/favicon.ico"],
      }) as unknown as ModuloNitro,
    ],
  };
}

export { evlogErrorHandler } from "evlog/nitro/v3";
