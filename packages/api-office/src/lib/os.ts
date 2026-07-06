import { implement } from "@orpc/server";
import { officeContract } from "@whasap/orpc/office";

import type { OfficeContext } from "../types";

export const os = implement(officeContract).$context<OfficeContext>();
