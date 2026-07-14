import { Link } from "@tanstack/react-router";
import { Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { useCart } from "@/lib/cart-store";
import { formatBRL } from "@/lib/format";

export function CarrinhoDrawer() {
  const { itens, aberto, fechar, setQuantidade, remover, subtotal } = useCart();
  const total = subtotal();

  return (
    <>
      {aberto && (
        <div
          className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm animate-in fade-in"
          onClick={fechar}
        />
      )}
      <aside
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-background shadow-2xl transition-transform duration-300 ${
          aberto ? "translate-x-0" : "translate-x-full"
        }`}
        aria-hidden={!aberto}
      >
        <header className="flex items-center justify-between border-b border-border/70 px-5 py-4">
          <div className="flex items-center gap-2 font-display text-lg font-bold">
            <ShoppingBag className="h-5 w-5 text-primary" />
            Seu carrinho
          </div>
          <button
            onClick={fechar}
            className="rounded-full p-1.5 hover:bg-muted"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {itens.length === 0 ? (
            <div className="mt-16 text-center text-muted-foreground">
              <ShoppingBag className="mx-auto mb-3 h-10 w-10 opacity-40" />
              Seu carrinho está vazio.
            </div>
          ) : (
            <ul className="space-y-3">
              {itens.map((i) => (
                <li
                  key={i.id}
                  className="flex gap-3 rounded-xl border border-border/60 bg-card p-3"
                >
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                    {i.imagem_url && (
                      <img src={i.imagem_url} alt={i.nome} className="h-full w-full object-cover" />
                    )}
                  </div>
                  <div className="flex flex-1 flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold leading-tight">{i.nome}</p>
                      <button
                        onClick={() => remover(i.id)}
                        className="text-muted-foreground hover:text-destructive"
                        aria-label="Remover"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground">{formatBRL(i.preco)}</p>
                    <div className="mt-auto flex items-center justify-between">
                      <div className="flex items-center gap-2 rounded-full border border-border/70">
                        <button
                          onClick={() => setQuantidade(i.id, i.quantidade - 1)}
                          className="p-1.5 hover:bg-muted rounded-l-full"
                          aria-label="Diminuir"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="min-w-6 text-center text-sm font-semibold">
                          {i.quantidade}
                        </span>
                        <button
                          onClick={() => setQuantidade(i.id, i.quantidade + 1)}
                          className="p-1.5 hover:bg-muted rounded-r-full"
                          aria-label="Aumentar"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <span className="text-sm font-bold text-warm">
                        {formatBRL(i.preco * i.quantidade)}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {itens.length > 0 && (
          <footer className="border-t border-border/70 bg-card px-5 py-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-bold">{formatBRL(total)}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Taxa de entrega calculada após validar o CEP.
            </p>
            <Link
              to="/checkout"
              onClick={fechar}
              className="block w-full rounded-full bg-warm py-3 text-center text-sm font-bold text-white shadow-lg transition hover:opacity-90"
            >
              Finalizar pedido
            </Link>
          </footer>
        )}
      </aside>
    </>
  );
}
