import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@whasap/ui/components/dropdown-menu";
import { LogOut, Settings } from "lucide-react";

import { searchAbrirAjustes } from "@/lib/abrir-ajustes";
import { useSession } from "@/lib/auth";
import { nomeExibicaoDoEmail } from "@/lib/inbox-utils";
import { orpc } from "@/lib/orpc";
import { limparEstadoClienteSessao } from "@/lib/sessao-cliente";

export function WaRailProfile() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const email = session?.usuario?.email ?? "";
  const nome = email ? nomeExibicaoDoEmail(email) : "Conta";
  const inicial = nome.slice(0, 1).toUpperCase();

  const logout = useMutation(
    orpc.autenticacao.sair.mutationOptions({
      onSuccess: () => {
        void limparEstadoClienteSessao(queryClient);
      },
    }),
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="mt-2 flex h-8 w-8 items-center justify-center rounded-full bg-cover bg-center text-xs font-semibold text-white outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-wa-green bg-green-700"
          aria-label={`Conta: ${nome}`}
        >
          {inicial}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium text-foreground">{nome}</p>
          {email ? (
            <p className="truncate text-xs font-normal text-muted-foreground">{email}</p>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="gap-2 md:hidden"
          onSelect={() =>
            void navigate({
              to: ".",
              search: searchAbrirAjustes("geral"),
              replace: true,
            })
          }
        >
          <Settings className="h-4 w-4" />
          Ajustes
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={logout.isPending}
          onSelect={() => logout.mutate({})}
          className="gap-2"
        >
          <LogOut className="h-4 w-4" />
          Sair da conta
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
