import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@whasap/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@whasap/ui/components/dialog";
import { Input } from "@whasap/ui/components/input";
import { Label } from "@whasap/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@whasap/ui/components/select";

import { getOrpcErrorMessage } from "@/lib/orpc-error";
import { orpc } from "@/lib/orpc";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instanciaId: string;
  instanciaNome: string;
};

export function ConfigurarPagamentoDialog({
  open,
  onOpenChange,
  instanciaId,
  instanciaNome,
}: Props) {
  const [documento, setDocumento] = useState("");
  const [tipoDocumento, setTipoDocumento] = useState<"cpf" | "cnpj">("cnpj");
  const [razaoSocial, setRazaoSocial] = useState("");
  const [error, setError] = useState<string | null>(null);

  const checkout = useMutation(orpc.instancia.criarCheckout.mutationOptions());

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const { urlCheckout } = await checkout.mutateAsync({
        instanciaId,
        documento,
        tipoDocumento,
        razaoSocial,
      });
      window.location.href = urlCheckout;
    } catch (err) {
      setError(getOrpcErrorMessage(err, "Não foi possível iniciar o pagamento."));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Configurar pagamento</DialogTitle>
          <DialogDescription>
            <strong>{instanciaNome}</strong> — cadastre PIX ou cartão via Asaas para continuar
            usando o Whasap após a demonstração.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo de documento</Label>
            <Select
              value={tipoDocumento}
              onValueChange={(v) => setTipoDocumento(v as "cpf" | "cnpj")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cnpj">CNPJ</SelectItem>
                <SelectItem value="cpf">CPF</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pagamento-documento">Documento</Label>
            <Input
              id="pagamento-documento"
              value={documento}
              onChange={(e) => setDocumento(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pagamento-razao">Razão social / Nome</Label>
            <Input
              id="pagamento-razao"
              value={razaoSocial}
              onChange={(e) => setRazaoSocial(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button
            type="submit"
            className="w-full"
            disabled={checkout.isPending || !documento || !razaoSocial}
          >
            {checkout.isPending ? "Redirecionando..." : "Ir para pagamento seguro"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
