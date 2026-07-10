/** Helpers para mensagens interactive/flow do webhook Evolution GO. */

export type GoFlowButton = {
  name: string;
  params: Record<string, unknown> | null;
  rawParamsJSON: string | null;
};

export type GoFlowMessage = {
  body: string;
  buttons: GoFlowButton[];
  flowToken: string | null;
  flowId: string | null;
  flowName: string | null;
  flowCta: string | null;
};

export type GoFlowResponse = {
  body: string;
  flowToken: string | null;
  flowId: string | null;
  flowName: string | null;
  responseMessage: unknown | null;
  rawParamsJSON: string | null;
};

type NativeFlowMessage = {
  buttons?: Array<{ name?: string; buttonParamsJSON?: string }>;
  messageVersion?: number;
};

type InteractiveMessageWrapper = {
  InteractiveMessage?: {
    NativeFlowMessage?: NativeFlowMessage;
  };
  body?: { text?: string };
};

type NativeFlowResponseMessage = {
  name?: string;
  paramsJSON?: string;
  version?: number;
};

type InteractiveResponseWrapper = {
  InteractiveResponseMessage?: {
    NativeFlowResponseMessage?: NativeFlowResponseMessage;
  };
  body?: { text?: string };
};

/** Faz parse seguro de paramsJSON/buttonParamsJSON do GO. */
export function parseParamsJSON(raw: unknown): Record<string, unknown> | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** Extrai flow_token de params já parseados (top-level ou wa_flow_response_params). */
export function extrairFlowToken(params: Record<string, unknown> | null): string | null {
  if (!params) return null;

  const topLevel = params.flow_token;
  if (typeof topLevel === "string" && topLevel) return topLevel;

  const waFlow = params.wa_flow_response_params;
  if (waFlow && typeof waFlow === "object" && !Array.isArray(waFlow)) {
    const nested = (waFlow as Record<string, unknown>).flow_token;
    if (typeof nested === "string" && nested) return nested;
  }

  return null;
}

function extrairFlowId(params: Record<string, unknown> | null): string | null {
  if (!params) return null;
  const flowId = params.flow_id;
  return typeof flowId === "string" && flowId ? flowId : null;
}

function extrairFlowName(params: Record<string, unknown> | null): string | null {
  if (!params) return null;

  const topLevel = params.flow_name;
  if (typeof topLevel === "string" && topLevel) return topLevel;

  const waFlow = params.wa_flow_response_params;
  if (waFlow && typeof waFlow === "object" && !Array.isArray(waFlow)) {
    const nested = (waFlow as Record<string, unknown>).flow_name;
    if (typeof nested === "string" && nested) return nested;
  }

  return null;
}

function extrairFlowCta(params: Record<string, unknown> | null): string | null {
  if (!params) return null;
  const flowCta = params.flow_cta;
  return typeof flowCta === "string" && flowCta ? flowCta : null;
}

function extrairResponseMessage(params: Record<string, unknown> | null): unknown | null {
  if (!params) return null;

  const waFlow = params.wa_flow_response_params;
  if (waFlow && typeof waFlow === "object" && !Array.isArray(waFlow)) {
    const responseMessage = (waFlow as Record<string, unknown>).response_message;
    if (responseMessage === undefined || responseMessage === null) return null;
    if (typeof responseMessage === "string") {
      return parseParamsJSON(responseMessage) ?? responseMessage;
    }
    return responseMessage;
  }

  return null;
}

function parseButtons(nativeFlow: NativeFlowMessage | undefined): GoFlowButton[] {
  return (nativeFlow?.buttons ?? []).map((button) => {
    const rawParamsJSON =
      typeof button.buttonParamsJSON === "string" ? button.buttonParamsJSON : null;
    return {
      name: String(button.name ?? ""),
      params: parseParamsJSON(rawParamsJSON),
      rawParamsJSON,
    };
  });
}

/** Extrai metadados de interactiveMessage (outbound flow/payment). */
export function parseInteractiveMessage(messageObj: Record<string, unknown>): GoFlowMessage | null {
  const interactive = messageObj.interactiveMessage as InteractiveMessageWrapper | undefined;
  if (!interactive) return null;

  const nativeFlow = interactive.InteractiveMessage?.NativeFlowMessage;
  const buttons = parseButtons(nativeFlow);
  const primaryParams = buttons[0]?.params ?? null;

  return {
    body: interactive.body?.text?.trim() || extrairFlowCta(primaryParams) || "[interativo]",
    buttons,
    flowToken: extrairFlowToken(primaryParams),
    flowId: extrairFlowId(primaryParams),
    flowName: extrairFlowName(primaryParams),
    flowCta: extrairFlowCta(primaryParams),
  };
}

/** Extrai metadados de interactiveResponseMessage (resposta de flow). */
export function parseInteractiveResponseMessage(
  messageObj: Record<string, unknown>,
): GoFlowResponse | null {
  const interactive = messageObj.interactiveResponseMessage as
    | InteractiveResponseWrapper
    | undefined;
  if (!interactive) return null;

  const nativeResponse = interactive.InteractiveResponseMessage?.NativeFlowResponseMessage;
  const rawParamsJSON =
    typeof nativeResponse?.paramsJSON === "string" ? nativeResponse.paramsJSON : null;
  const params = parseParamsJSON(rawParamsJSON);

  return {
    body: interactive.body?.text?.trim() || "[resposta interativa]",
    flowToken: extrairFlowToken(params),
    flowId: extrairFlowId(params),
    flowName: extrairFlowName(params),
    responseMessage: extrairResponseMessage(params),
    rawParamsJSON,
  };
}

/** Texto de exibição para interactiveMessage. */
export function formatInteractiveBody(flow: GoFlowMessage): string {
  return flow.flowCta || flow.body || "[interativo]";
}

/** Texto de exibição para interactiveResponseMessage. */
export function formatInteractiveResponseBody(response: GoFlowResponse): string {
  return response.body || "[resposta interativa]";
}

/** Extrai flow response de extraData de ButtonClick. */
export function parseFlowResponseDeExtraData(
  extraData: Record<string, unknown> | null | undefined,
): GoFlowResponse | null {
  if (!extraData) return null;

  const rawParamsJSON = typeof extraData.paramsJSON === "string" ? extraData.paramsJSON : null;
  const params = parseParamsJSON(rawParamsJSON);

  return {
    body: "[resposta interativa]",
    flowToken: extrairFlowToken(params),
    flowId: extrairFlowId(params),
    flowName: extrairFlowName(params),
    responseMessage: extrairResponseMessage(params),
    rawParamsJSON,
  };
}
