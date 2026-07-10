import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@whasap/ui/components/dropdown-menu";
import { LogOut } from "lucide-react";

import { useSession } from "@/lib/auth";
import { nomeExibicaoDoEmail } from "@/lib/inbox-utils";
import { orpc } from "@/lib/orpc";

export function WaRailProfile() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const email = session?.usuario?.email ?? "";
  const nome = email ? nomeExibicaoDoEmail(email) : "Conta";
  const inicial = nome.slice(0, 1).toUpperCase();

  const logout = useMutation(
    orpc.autenticacao.sair.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: orpc.autenticacao.eu.key() });
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
