import { createFileRoute, useNavigate, useSearch, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

const searchSchema = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: (raw) => searchSchema.parse(raw),
  head: () => ({
    meta: [
      { title: "Entrar — Carbo do Bem" },
      { name: "description", content: "Entre ou crie sua conta na Carbo do Bem para acompanhar seus pedidos." },
    ],
  }),
  component: AuthPage,
});

function sanitizeRedirect(raw: string | undefined): string {
  if (!raw) return "/";
  // Só permite paths internos (evita open-redirect).
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

function AuthPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/auth" });
  const destino = sanitizeRedirect(search.redirect);

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Se já estiver logado, manda direto pro destino.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        navigate({ to: destino });
      }
    });
  }, [navigate, destino]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) return setError(error.message);
      navigate({ to: destino });
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}${destino}` },
      });
      setLoading(false);
      if (error) return setError(error.message);
      if (data.session) {
        navigate({ to: destino });
      } else {
        setInfo("Conta criada! Verifique seu e-mail para confirmar o cadastro.");
      }
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm"
      >
        <div>
          <Link to="/" className="text-xs font-semibold text-primary">
            ← voltar à loja
          </Link>
          <h1 className="mt-2 font-display text-2xl font-bold">
            {mode === "signin" ? "Entrar" : "Criar conta"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {mode === "signin"
              ? "Entre para finalizar seu pedido e acompanhar o status."
              : "Crie sua conta em 30 segundos para pedir e acompanhar entregas."}
          </p>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="email">E-mail</label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="password">Senha</label>
          <input
            id="password"
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {info && <p className="text-sm text-primary">{info}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {loading ? "Enviando..." : mode === "signin" ? "Entrar" : "Cadastrar"}
        </button>
        <button
          type="button"
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError(null);
            setInfo(null);
          }}
          className="w-full text-sm text-muted-foreground hover:text-foreground"
        >
          {mode === "signin" ? "Não tem conta? Cadastre-se" : "Já tem conta? Entrar"}
        </button>
        <p className="pt-2 text-center text-[11px] text-muted-foreground">
          Ao continuar, você concorda com nossos{" "}
          <Link to="/termos" className="underline">Termos</Link> e{" "}
          <Link to="/privacidade" className="underline">Política de Privacidade</Link>.
        </p>
      </form>
    </div>
  );
}
