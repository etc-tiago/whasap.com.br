import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@whasap/ui/components/button";

import { EntradaShell } from "@/components/entrada-shell";
import { AGENDAMENTO_URL, urlWhatsappSuporte } from "@/lib/contato-suporte";

export const Route = createFileRoute("/~/email/$emailHash/bloqueado")({
  component: EntradaBloqueadoPage,
});

function EntradaBloqueadoPage() {
  const whatsapp = urlWhatsappSuporte();

  return (
    <EntradaShell
      title="Acesso temporariamente bloqueado"
      description="Por segurança, limitamos novas tentativas neste e-mail. Fale com nossa equipe para continuar."
    >
      <div className="space-y-3">
        {whatsapp ? (
          <Button asChild className="w-full">
            <a href={whatsapp} target="_blank" rel="noopener noreferrer">
              Falar no WhatsApp
            </a>
          </Button>
        ) : null}
        <Button asChild variant={whatsapp ? "outline" : "default"} className="w-full">
          <a href={AGENDAMENTO_URL} target="_blank" rel="noopener noreferrer">
            Agendar conversa
          </a>
        </Button>
        <Button asChild variant="outline" className="w-full">
          <Link to="/~">Voltar ao início</Link>
        </Button>
      </div>
    </EntradaShell>
  );
}
