import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@whasap/ui/components/button";
import { Checkbox } from "@whasap/ui/components/checkbox";
import { Input } from "@whasap/ui/components/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@whasap/ui/components/input-otp";
import { Label } from "@whasap/ui/components/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@whasap/ui/components/tabs";
import { MessageCircle } from "lucide-react";
import { useCallback, useState } from "react";

import { TurnstileWidget } from "@/components/turnstile-widget";
import { getOrpcErrorMessage } from "@/lib/orpc-error";
import { orpc } from "@/lib/orpc";

export function AuthPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const sendOtp = useMutation(orpc.autenticacao.enviarOtp.mutationOptions());
  const login = useMutation(orpc.autenticacao.entrar.mutationOptions());
  const signup = useMutation(orpc.autenticacao.cadastrar.mutationOptions());

  const [tab, setTab] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [nome, setNome] = useState("");
  const [nomeOrganizacao, setNomeOrganizacao] = useState("");
  const [lgpdConsent, setLgpdConsent] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const resetTurnstile = useCallback(() => {
    setTurnstileToken(null);
    setTurnstileResetKey((k) => k + 1);
  }, []);

  const handleTurnstileToken = useCallback((token: string | null) => {
    setTurnstileToken(token);
  }, []);

  function requireTurnstile(): string | null {
    if (!turnstileToken) {
      setError("Conclua a verificação de segurança antes de continuar.");
      return null;
    }
    return turnstileToken;
  }

  async function handleSendOtp(proposito: "entrar" | "cadastrar") {
    const token = requireTurnstile();
    if (!token) return;

    setError(null);
    try {
      await sendOtp.mutateAsync({ email, proposito, turnstileToken: token });
      setOtpSent(true);
      resetTurnstile();
    } catch (err) {
      setError(getOrpcErrorMessage(err, "Não foi possível enviar o código. Tente novamente."));
      resetTurnstile();
    }
  }

  async function handleLogin() {
    const token = requireTurnstile();
    if (!token) return;

    setError(null);
    try {
      await login.mutateAsync({ email, otp, turnstileToken: token });
      await queryClient.invalidateQueries({ queryKey: orpc.autenticacao.eu.key() });
      await navigate({ to: "/" });
    } catch (err) {
      setError(getOrpcErrorMessage(err, "Código inválido ou expirado."));
      resetTurnstile();
    }
  }

  async function handleSignup() {
    if (!lgpdConsent) {
      setError("É necessário aceitar os termos e a política de privacidade.");
      return;
    }

    const token = requireTurnstile();
    if (!token) return;

    setError(null);
    try {
      await signup.mutateAsync({
        email,
        nome,
        nomeOrganizacao,
        otp,
        lgpdConsent: true,
        turnstileToken: token,
      });
      await queryClient.invalidateQueries({ queryKey: orpc.autenticacao.eu.key() });
      await navigate({ to: "/" });
    } catch (err) {
      setError(
        getOrpcErrorMessage(err, "Não foi possível concluir o cadastro. Verifique o código."),
      );
      resetTurnstile();
    }
  }

  function handleTabChange(value: string) {
    setTab(value as "login" | "signup");
    setOtpSent(false);
    setOtp("");
    setError(null);
    resetTurnstile();
  }

  const isBusy = sendOtp.isPending || login.isPending || signup.isPending;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-wa-green text-white">
            <MessageCircle className="h-6 w-6 fill-white" />
          </span>
          <h1 className="text-2xl font-semibold">Whasap</h1>
          <p className="text-sm text-muted-foreground">Painel do cliente — web.whasap.com.br</p>
        </div>

        <Tabs value={tab} onValueChange={handleTabChange}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Entrar</TabsTrigger>
            <TabsTrigger value="signup">Cadastrar</TabsTrigger>
          </TabsList>

          <TabsContent value="login" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login-email">Email</Label>
              <Input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@empresa.com.br"
              />
            </div>
            {!otpSent ? (
              <Button
                className="w-full"
                onClick={() => handleSendOtp("entrar")}
                disabled={!email || isBusy || !turnstileToken}
              >
                Enviar código
              </Button>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Código OTP</Label>
                  <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                    <InputOTPGroup>
                      {Array.from({ length: 6 }).map((_, i) => (
                        <InputOTPSlot key={`otp-login-${i}`} index={i} />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                <Button
                  className="w-full"
                  onClick={handleLogin}
                  disabled={otp.length < 6 || isBusy || !turnstileToken}
                >
                  Entrar
                </Button>
              </>
            )}
          </TabsContent>

          <TabsContent value="signup" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="signup-name">Seu nome</Label>
              <Input id="signup-name" value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-org">Nome da organização</Label>
              <Input
                id="signup-org"
                value={nomeOrganizacao}
                onChange={(e) => setNomeOrganizacao(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-email">Email</Label>
              <Input
                id="signup-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {!otpSent ? (
              <Button
                className="w-full"
                onClick={() => handleSendOtp("cadastrar")}
                disabled={!email || !nome || !nomeOrganizacao || isBusy || !turnstileToken}
              >
                Enviar código
              </Button>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Código OTP</Label>
                  <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                    <InputOTPGroup>
                      {Array.from({ length: 6 }).map((_, i) => (
                        <InputOTPSlot key={`otp-signup-${i}`} index={i} />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="lgpd"
                    checked={lgpdConsent}
                    onCheckedChange={(v) => setLgpdConsent(v === true)}
                  />
                  <Label htmlFor="lgpd" className="text-sm font-normal leading-snug">
                    Li e aceito os Termos de Uso e a Política de Privacidade (LGPD).
                  </Label>
                </div>
                <Button
                  className="w-full"
                  onClick={handleSignup}
                  disabled={otp.length < 6 || isBusy || !turnstileToken}
                >
                  Criar conta
                </Button>
              </>
            )}
          </TabsContent>
        </Tabs>

        <TurnstileWidget onTokenChange={handleTurnstileToken} resetKey={turnstileResetKey} />

        <p className="text-center text-xs text-muted-foreground">
          Limite de 3 tentativas de login ou cadastro por minuto.
        </p>

        {error && (
          <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-center text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
