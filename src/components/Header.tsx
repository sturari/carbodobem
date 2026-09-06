import { Link } from "@tanstack/react-router";
import { LogIn, LogOut, ShoppingBag, User } from "lucide-react";
import { useEffect, useState } from "react";
import { useCart } from "@/lib/cart-store";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/principal-verde.jpg.asset.json";

export function Header() {
  const total = useCart((s) => s.totalItens());
  const abrir = useCart((s) => s.abrir);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [montado, setMontado] = useState(false);

  useEffect(() => setMontado(true), []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setSignedIn(!!session);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function sair() {
    if (typeof window !== "undefined") {
      const ok = window.confirm("Tem certeza de que deseja sair?");
      if (!ok) return;
    }
    await supabase.auth.signOut();
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 group">
          <img
            src={logo.url}
            alt="Carbo do Bem"
            className="h-10 w-10 rounded-full object-cover"
          />
          <div className="leading-tight">
            <div className="font-display text-lg font-bold tracking-tight text-primary">
              Carbo do Bem
            </div>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          {signedIn ? (
            <>
              <Link
                to="/meus-pedidos"
                className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-border/70 px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
              >
                <User className="h-4 w-4" /> Meus pedidos
              </Link>
              <Link
                to="/meus-pedidos"
                className="sm:hidden rounded-full border border-border/70 p-2 hover:bg-muted"
                aria-label="Meus pedidos"
              >
                <User className="h-4 w-4" />
              </Link>
              <button
                type="button"
                onClick={sair}
                className="rounded-full border border-border/70 p-2 hover:bg-muted"
                aria-label="Sair"
                title="Sair"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </>
          ) : signedIn === false ? (
            <Link
              to="/auth"
              className="inline-flex items-center gap-1.5 rounded-full border border-border/70 px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
            >
              <LogIn className="h-4 w-4" />
              <span className="hidden sm:inline">Entrar</span>
            </Link>
          ) : null}

          <button
            type="button"
            onClick={abrir}
            className="relative flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            <ShoppingBag className="h-4 w-4" />
            <span className="hidden sm:inline">Carrinho</span>
            {montado && total > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-warm px-1 text-[11px] font-bold text-white">
                {total}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
