import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

const cepSchema = z.object({
  cep: z.string().transform((v) => v.replace(/\D/g, "")).pipe(z.string().length(8)),
});

export const validarCEP = createServerFn({ method: "POST" })
  .inputValidator((raw) => cepSchema.parse(raw))
  .handler(async ({ data }) => {
    const url = process.env.SUPABASE_URL!;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
    const supa = createClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    });

    const { data: areas, error } = await supa
      .from("areas_cobertura")
      .select("id, descricao, cep_inicio, cep_fim, taxa_entrega")
      .eq("ativo", true);
    if (error) throw new Error(error.message);

    const match = (areas ?? []).find(
      (a) => data.cep >= a.cep_inicio && data.cep <= a.cep_fim,
    );

    if (!match) {
      return { atende: false as const, cep: data.cep };
    }

    // Consulta ViaCEP em paralelo para preencher endereço
    let endereco: {
      rua: string;
      bairro: string;
      cidade: string;
      uf: string;
    } | null = null;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${data.cep}/json/`);
      if (res.ok) {
        const j = (await res.json()) as {
          logradouro?: string;
          bairro?: string;
          localidade?: string;
          uf?: string;
          erro?: boolean;
        };
        if (!j.erro) {
          endereco = {
            rua: j.logradouro ?? "",
            bairro: j.bairro ?? "",
            cidade: j.localidade ?? "",
            uf: j.uf ?? "",
          };
        }
      }
    } catch {
      /* ignore — usuário digita manualmente */
    }

    return {
      atende: true as const,
      cep: data.cep,
      taxa_entrega: Number(match.taxa_entrega),
      area: match.descricao,
      endereco,
    };
  });
