import { createFileRoute } from "@tanstack/react-router";

import { handleRpcRequest } from "@/lib/rpc-handler";

export const Route = createFileRoute("/rpc/$")({
  server: {
    handlers: {
      GET: ({ request }) => handleRpcRequest(request),
      POST: ({ request }) => handleRpcRequest(request),
      PUT: ({ request }) => handleRpcRequest(request),
      PATCH: ({ request }) => handleRpcRequest(request),
      DELETE: ({ request }) => handleRpcRequest(request),
    },
  },
});
