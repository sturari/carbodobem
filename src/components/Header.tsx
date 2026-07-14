import { Link } from "@tanstack/react-router";
import { ShoppingBag } from "lucide-react";
import { useCart } from "@/lib/cart-store";
import logo from "@/assets/principal-verde.jpg.asset.json";

export function Header() {
  const total = useCart((s) => s.totalItens());
  const abrir = useCart((s) => s.abrir);

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

        <button
          type="button"
          onClick={abrir}
          className="relative flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
        >
          <ShoppingBag className="h-4 w-4" />
          <span>Carrinho</span>
          {total > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-warm px-1 text-[11px] font-bold text-white">
              {total}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}
