import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ProdutoBase = {
  id: string;
  nome: string;
  preco: number;
  imagem_url: string | null;
  gramatura_g: number | null;
};

export type ItemCarrinho = ProdutoBase & { quantidade: number };

type CartState = {
  itens: ItemCarrinho[];
  aberto: boolean;
  abrir: () => void;
  fechar: () => void;
  adicionar: (p: ProdutoBase, qtd?: number) => void;
  remover: (id: string) => void;
  setQuantidade: (id: string, q: number) => void;
  limpar: () => void;
  subtotal: () => number;
  totalItens: () => number;
};

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      itens: [],
      aberto: false,
      abrir: () => set({ aberto: true }),
      fechar: () => set({ aberto: false }),
      adicionar: (p, qtd = 1) =>
        set((s) => {
          const existente = s.itens.find((i) => i.id === p.id);
          if (existente) {
            return {
              itens: s.itens.map((i) =>
                i.id === p.id ? { ...i, quantidade: i.quantidade + qtd } : i,
              ),
              aberto: true,
            };
          }
          return { itens: [...s.itens, { ...p, quantidade: qtd }], aberto: true };
        }),
      remover: (id) => set((s) => ({ itens: s.itens.filter((i) => i.id !== id) })),
      setQuantidade: (id, q) =>
        set((s) => ({
          itens:
            q <= 0
              ? s.itens.filter((i) => i.id !== id)
              : s.itens.map((i) => (i.id === id ? { ...i, quantidade: q } : i)),
        })),
      limpar: () => set({ itens: [] }),
      subtotal: () => get().itens.reduce((acc, i) => acc + i.preco * i.quantidade, 0),
      totalItens: () => get().itens.reduce((acc, i) => acc + i.quantidade, 0),
    }),
    { name: "carbo-do-bem-cart" },
  ),
);
