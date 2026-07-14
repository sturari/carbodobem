import { Plus, Snowflake } from "lucide-react";
import { useCart, type ProdutoBase } from "@/lib/cart-store";
import { formatBRL } from "@/lib/format";

export type ProdutoCardData = ProdutoBase & {
  descricao: string | null;
  categoria: string;
};

export function ProdutoCard({ p }: { p: ProdutoCardData }) {
  const adicionar = useCart((s) => s.adicionar);

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm transition hover:shadow-md">
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        {p.imagem_url ? (
          <img
            src={p.imagem_url}
            alt={p.nome}
            loading="lazy"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            sem imagem
          </div>
        )}
        <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-cold/90 px-2.5 py-1 text-[11px] font-semibold text-white shadow">
          <Snowflake className="h-3 w-3" /> congelado
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="font-display text-base font-bold leading-tight text-foreground">
            {p.nome}
          </h3>
          {p.gramatura_g && (
            <span className="shrink-0 text-xs text-muted-foreground">{p.gramatura_g}g</span>
          )}
        </div>
        {p.descricao && (
          <p className="line-clamp-2 text-sm text-muted-foreground">{p.descricao}</p>
        )}

        <div className="mt-auto flex items-center justify-between pt-3">
          <span className="font-display text-xl font-bold text-warm">{formatBRL(p.preco)}</span>
          <button
            type="button"
            onClick={() =>
              adicionar({
                id: p.id,
                nome: p.nome,
                preco: p.preco,
                imagem_url: p.imagem_url,
                gramatura_g: p.gramatura_g,
              })
            }
            className="inline-flex items-center gap-1 rounded-full bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground shadow transition hover:opacity-90 active:scale-95"
            aria-label={`Adicionar ${p.nome} ao carrinho`}
          >
            <Plus className="h-4 w-4" /> Adicionar
          </button>
        </div>
      </div>
    </article>
  );
}
