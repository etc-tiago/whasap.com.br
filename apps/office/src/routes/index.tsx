import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@whasap/ui/components/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [{ title: "Whasap Office" }],
  }),
  component: OfficeHome,
});

function OfficeHome() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-8">
      <h1 className="text-3xl font-semibold text-foreground">Whasap Office</h1>
      <p className="text-muted-foreground">Painel interno de administração</p>
      <div className="flex gap-2">
        <Button asChild>
          <Link to="/administracao/webhooks">Webhooks Evolution</Link>
        </Button>
      </div>
    </div>
  );
}
