import { ORPCError } from "@orpc/server";

type RpcErrorCode = ConstructorParameters<typeof ORPCError>[0];

function throwRpcError(code: RpcErrorCode, message?: string): never {
  throw new ORPCError(code, message ? { message } : undefined);
}

export function rpcError(code: RpcErrorCode, message?: string): never {
  throwRpcError(code, message);
}

export function badRequest(message?: string): never {
  throwRpcError("BAD_REQUEST", message);
}

export function unauthorized(message?: string): never {
  throwRpcError("UNAUTHORIZED", message);
}

export function forbidden(message?: string): never {
  throwRpcError("FORBIDDEN", message);
}

export function notFound(message?: string): never {
  throwRpcError("NOT_FOUND", message);
}

export function conflict(message?: string): never {
  throwRpcError("CONFLICT", message);
}

export function preconditionFailed(message?: string): never {
  throwRpcError("PRECONDITION_FAILED", message);
}

export function tooManyRequests(message?: string): never {
  throwRpcError("TOO_MANY_REQUESTS", message);
}

export function internalServerError(message?: string): never {
  throwRpcError("INTERNAL_SERVER_ERROR", message);
}
