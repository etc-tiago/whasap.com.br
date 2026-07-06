import { implement } from "@orpc/server";
import { webContract } from "@whasap/orpc/web";

import type { WebContext } from "../types";

export const os = implement(webContract).$context<WebContext>();
