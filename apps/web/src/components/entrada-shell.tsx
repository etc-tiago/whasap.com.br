import type { ReactNode } from "react";
import { MessageCircle } from "lucide-react";

type EntradaShellProps = {
  title?: string;
  description?: string;
  children: ReactNode;
};

export function EntradaShell({ title, description, children }: EntradaShellProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-wa-green text-white">
            <MessageCircle className="h-6 w-6 fill-white" />
          </span>
          <h1 className="text-2xl font-semibold">{title ?? "Whasap"}</h1>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {children}
      </div>
    </div>
  );
}
