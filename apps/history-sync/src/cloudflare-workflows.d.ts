/**
 * Tipos mínimos de Workflows até `bun run cf-typegen` regenerar worker-configuration.d.ts.
 * NonRetryableError vive em `cloudflare:workflows` (não em `cloudflare:workers`).
 */
declare module "cloudflare:workflows" {
  export class NonRetryableError extends Error {
    constructor(message: string, name?: string);
  }
}

declare module "cloudflare:workers" {
  export abstract class WorkflowEntrypoint<Env = unknown, Params = unknown> {
    protected ctx: ExecutionContext;
    protected env: Env;
    constructor(ctx: ExecutionContext, env: Env);
    run(event: WorkflowEvent<Params>, step: WorkflowStep): Promise<unknown>;
  }

  export type WorkflowEvent<T> = {
    payload: Readonly<T>;
    timestamp: Date;
    instanceId: string;
    workflowName: string;
  };

  export type WorkflowStepConfig = {
    retries?: {
      limit: number;
      delay: string | number;
      backoff?: "constant" | "linear" | "exponential";
    };
    timeout?: string | number;
  };

  export abstract class WorkflowStep {
    do<T>(name: string, callback: () => Promise<T>): Promise<T>;
    do<T>(name: string, config: WorkflowStepConfig, callback: () => Promise<T>): Promise<T>;
  }
}
