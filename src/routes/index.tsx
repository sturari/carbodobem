import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Snowflake, Clock, MapPin } from "lucide-react";
import { Header } from "@/components/Header";
import { CarrinhoDrawer } from "@/components/CarrinhoDrawer";
import { ProdutoCard } from "@/components/ProdutoCard";
import { listarProdutos } from "@/lib/produtos.functions";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const fetchProdutos = useServerFn(listarProdutos);
  const { data, isLoading } = useQuery({
    queryKey: ["produtos"],
    queryFn: () => fetchProdutos(),
  });

  const produtos = data?.produtos ?? [];
  const categorias = useMemo(
    () => Array.from(new Set(produtos.map((p) => p.categoria))),
    [produtos],
  );
  const [cat, setCat] = useState<string | null>(null);
  const filtrados = cat ? produtos.filter((p) => p.categoria === cat) : produtos;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <CarrinhoDrawer />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/60 bg-gradient-to-br from-secondary via-background to-background">
        <div className="mx-auto max-w-6xl px-4 py-14 md:py-20">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Snowflake className="h-3.5 w-3.5" />
              Ultracongelamento artesanal
            </span>
            <h1 className="mt-4 font-display text-4xl font-extrabold tracking-tight text-foreground md:text-5xl">
              Comida de verdade,{" "}
              <span className="text-primary">no horário que você escolher.</span>
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              Refeições prontas ultracongeladas, feitas por chef, entregues em Brasília.
              Sem cadastro, sem enrolação — escolha, aqueça e pronto.
            </p>
            <div className="mt-6 flex flex-wrap gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-primary" /> Entregas em Brasília
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-primary" /> Agendamento por horário
              </div>
              <div className="flex items-center gap-1.5">
                <Snowflake className="h-4 w-4 text-cold" /> Sabor preservado
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Filtros */}
      <section className="mx-auto max-w-6xl px-4 pt-10">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setCat(null)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              cat === null
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-accent"
            }`}
          >
            Todos
          </button>
          {categorias.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                cat === c
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-accent"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </section>

      {/* Grid */}
      <section className="mx-auto max-w-6xl px-4 py-8 pb-24">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="aspect-[4/3] animate-pulse rounded-2xl bg-muted"
              />
            ))}
          </div>
        ) : filtrados.length === 0 ? (
          <p className="py-16 text-center text-muted-foreground">Nenhum produto por aqui ainda.</p>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtrados.map((p) => (
              <ProdutoCard
                key={p.id}
                p={{
                  id: p.id,
                  nome: p.nome,
                  descricao: p.descricao,
                  preco: Number(p.preco),
                  gramatura_g: p.gramatura_g,
                  categoria: p.categoria,
                  imagem_url: p.imagem_url,
                }}
              />
            ))}
          </div>
        )}
      </section>

      <footer className="border-t border-border/60 bg-card">
        <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-muted-foreground">
          © {new Date().getFullYear()} Carbo do Bem — comida congelada com carinho.
        </div>
      </footer>
    </div>
  );
}
