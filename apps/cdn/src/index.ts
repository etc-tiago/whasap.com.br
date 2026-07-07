import { envolverWorkerFetch } from "@whasap/evlog/workers";

export type Env = {
  R2: R2Bucket;
};

export default envolverWorkerFetch<Env>("cdn", async (request, env, _ctx, log) => {
  const url = new URL(request.url);
  log.set({ rota: url.pathname, metodo: request.method });

  try {
    if (request.method !== "GET" && request.method !== "HEAD") {
      const response = new Response("Method not allowed", { status: 405 });
      log.emit({ status: response.status });
      return response;
    }

    const key = decodeURIComponent(url.pathname.replace(/^\//, ""));
    if (!key || key.includes("..")) {
      const response = new Response("Not found", { status: 404 });
      log.emit({ status: response.status });
      return response;
    }

    log.set({ cdn: { key } });
    const object = await env.R2.get(key);
    if (!object) {
      const response = new Response("Not found", { status: 404 });
      log.emit({ status: response.status });
      return response;
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    headers.set("cache-control", "public, max-age=31536000, immutable");

    if (request.method === "HEAD") {
      const response = new Response(null, { status: 200, headers });
      log.emit({ status: response.status });
      return response;
    }

    const response = new Response(object.body, { headers });
    log.emit({ status: response.status });
    return response;
  } catch (err) {
    log.error(err instanceof Error ? err : new Error(String(err)));
    log.emit({ status: 500 });
    throw err;
  }
});
