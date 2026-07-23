import { createFileRoute, Link } from "@tanstack/react-router";
import React, { useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { type ItemCarrinho, useCart } from "@/lib/cart-store";
import { formatBRL, formatCEP, formatCPF, formatTelefone } from "@/lib/format";
import { PagamentoMP } from "@/components/PagamentoMP";
import { supabase } from "@/integrations/supabase/client";
import { Campo } from "@/components/checkout/Campo";
import { Stepper, type EtapaCheckout } from "@/components/checkout/Stepper";
import { SeletorHorario } from "@/components/checkout/SeletorHorario";
import { useCheckoutForm } from "@/hooks/use-checkout-form";

export const Route = createFileRoute("/checkout")({
  component: CheckoutPage,
});

// Atalho de dev — somente em builds de desenvolvimento.
const SALMAO_DEV: ItemCarrinho | null = import.meta.env.DEV
  ? {
      id: "496ca897-c59a-4f2e-898f-a8c1779bf1da",
      nome: "Salmão ao Molho de Maracujá",
      preco: 49.9,
      imagem_url:
        "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=800&auto=format&fit=crop",
      gramatura_g: 350,
      quantidade: 1,
    }
  : null;

function CheckoutPage() {
  const { itens, limpar, adicionar } = useCart();

  const [hydrated, setHydrated] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [isDev, setIsDev] = useState(false);
  const [etapa, setEtapa] = useState<EtapaCheckout>(1);

  const form = useCheckoutForm();
  const {
    cliente,
    setCliente,
    cpfInput,
    setCpfInput,
    emailConfirm,
    setEmailConfirm,
    cepInput,
    setCepInput,
    taxaEntrega,
    setTaxaEntrega,
    endereco,
    setEndereco,
    horario,
    setHorario,
    obs,
    setObs,
    erro,
    carregando,
    validarEtapa1,
    executarEtapa2,
    validarEtapa3,
    validarEtapa4,
  } = form;

  const itensCheckout = isDev && itens.length === 0 && SALMAO_DEV ? [SALMAO_DEV] : itens;
  const total = itensCheckout.reduce((acc, item) => acc + item.preco * item.quantidade, 0);

  React.useEffect(() => {
    const dev =
      import.meta.env.DEV &&
      new URLSearchParams(window.location.search).get("dev") === "1";
    setIsDev(dev);
    setHydrated(true);
  }, []);

  // Pré-preenche e-mail se houver sessão. Guest checkout: nunca bloqueia.
  React.useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const session = data.session;
      if (!session) return;
      const email = session.user.email ?? "";
      setSignedIn(true);
      setCliente((p) => ({ ...p, email: p.email || email }));
      setEmailConfirm((prev) => prev || email);
    });
  }, [setCliente, setEmailConfirm]);

  // Atalho de dev: adiciona Salmão ao carrinho e pula para o horário.
  // Valores sensíveis vêm de VITE_DEV_* — nunca hard-coded.
  React.useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (!isDev || !SALMAO_DEV) return;
    if (!useCart.getState().itens.find((i) => i.id === SALMAO_DEV.id)) {
      adicionar(
        {
          id: SALMAO_DEV.id,
          nome: SALMAO_DEV.nome,
          preco: SALMAO_DEV.preco,
          imagem_url: SALMAO_DEV.imagem_url,
          gramatura_g: SALMAO_DEV.gramatura_g,
        },
        SALMAO_DEV.quantidade,
      );
    }
    useCart.setState({ aberto: false });
    const devEmail = (import.meta.env.VITE_DEV_EMAIL as string | undefined) ?? "";
    const devCpfRaw = (import.meta.env.VITE_DEV_CPF as string | undefined) ?? "";
    setCliente({
      nome: (import.meta.env.VITE_DEV_NOME as string | undefined) ?? "Teste Lovable",
      telefone: (import.meta.env.VITE_DEV_TELEFONE as string | undefined) ?? "(61) 99999-9999",
      email: devEmail,
      cpf: devCpfRaw.replace(/\D/g, ""),
    });
    setCpfInput(devCpfRaw ? formatCPF(devCpfRaw) : "");
    setEmailConfirm(devEmail);
    setCepInput("71503-505");
    setTaxaEntrega(15);
    setEndereco({
      cep: "71503505",
      rua: "Quadra CA 5",
      numero: "101",
      complemento: "Ed. Teste",
      bairro: "Setor de Habitações Individuais Norte",
      cidade: "Brasília",
      uf: "DF",
    });
    setEtapa(4);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDev]);

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  if (itensCheckout.length === 0 && etapa < 5 && !isDev) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <h1 className="font-display text-2xl font-bold">Carrinho vazio</h1>
        <p className="mt-2 text-muted-foreground">Adicione produtos antes de finalizar.</p>
        <Link to="/" className="mt-6 inline-block rounded-full bg-primary px-5 py-2.5 text-primary-foreground">
          Voltar à loja
        </Link>
      </div>
    );
  }

  const proximo = () => setEtapa((e) => Math.min(5, e + 1) as EtapaCheckout);
  const voltar = () => setEtapa((e) => Math.max(1, e - 1) as EtapaCheckout);

  async function handleContinuar() {
    if (etapa === 1) {
      // Exige "confirme o e-mail" quando o campo NÃO está pré-travado por sessão.
      if (validarEtapa1({ exigirConfirmacaoEmail: !signedIn })) proximo();
    } else if (etapa === 2) {
      if (await executarEtapa2()) proximo();
    } else if (etapa === 3) {
      if (validarEtapa3()) proximo();
    } else if (etapa === 4) {
      if (validarEtapa4()) proximo();
    }
  }

  const totalComFrete = total + (taxaEntrega ?? 0);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6 flex items-center gap-3">
          <Link to="/" className="rounded-full p-2 hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="font-display text-2xl font-bold">Finalizar pedido</h1>
        </div>

        <Stepper etapa={etapa} />

        <div className="mt-6 grid gap-6 md:grid-cols-[1fr_320px]">
          <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
            {etapa === 1 && (
              <div className="space-y-4">
                <h2 className="font-display text-lg font-bold">Seus dados</h2>
                {!signedIn && (
                  <p className="text-xs text-muted-foreground">
                    Não precisa criar conta para comprar. Se preferir acompanhar seus pedidos depois,{" "}
                    <Link to="/auth" className="text-primary underline">entrar / criar conta</Link>.
                  </p>
                )}
                <Campo label="NOME">
                  <input
                    className="input"
                    value={cliente.nome}
                    onChange={(e) => setCliente({ ...cliente, nome: e.target.value })}
                  />
                </Campo>
                <Campo label="Telefone (WhatsApp)">
                  <input
                    className="input"
                    inputMode="tel"
                    placeholder="(11) 99999-9999"
                    value={cliente.telefone}
                    onChange={(e) => setCliente({ ...cliente, telefone: formatTelefone(e.target.value) })}
                  />
                </Campo>
                <Campo label={signedIn ? "E-mail (da sua conta)" : "E-mail"}>
                  <input
                    className={`input ${signedIn ? "opacity-70" : ""}`}
                    type="email"
                    autoComplete="email"
                    value={cliente.email}
                    readOnly={signedIn}
                    disabled={signedIn}
                    onChange={(e) => setCliente({ ...cliente, email: e.target.value })}
                  />
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {signedIn
                      ? "E-mail da sua conta. Usaremos para o recibo e para acompanhar o pedido."
                      : "Usaremos para enviar o recibo e o link de acompanhamento do pedido."}
                  </span>
                </Campo>
                {!signedIn && (
                  <Campo label="Confirme o e-mail">
                    <input
                      className="input"
                      type="email"
                      autoComplete="off"
                      value={emailConfirm}
                      onChange={(e) => setEmailConfirm(e.target.value)}
                      onPaste={(e) => e.preventDefault()}
                    />
                  </Campo>
                )}
                <Campo label="CPF">
                  <input
                    className="input"
                    inputMode="numeric"
                    placeholder="000.000.000-00"
                    value={cpfInput}
                    onChange={(e) => setCpfInput(formatCPF(e.target.value))}
                  />
                  <span className="mt-1 block text-xs text-muted-foreground">
                    Necessário para gerar o Pix e emitir o recibo do Mercado Pago.
                  </span>
                </Campo>
              </div>
            )}

            {etapa === 2 && (
              <div className="space-y-4">
                <h2 className="font-display text-lg font-bold">Onde você quer receber?</h2>
                <p className="text-sm text-muted-foreground">
                  Vamos verificar se atendemos seu CEP.
                </p>
                <Campo label="CEP">
                  <input
                    className="input"
                    inputMode="numeric"
                    placeholder="00000-000"
                    value={cepInput}
                    onChange={(e) => setCepInput(formatCEP(e.target.value))}
                  />
                </Campo>
              </div>
            )}

            {etapa === 3 && (
              <div className="space-y-4">
                <h2 className="font-display text-lg font-bold">Endereço completo</h2>
                <div className="text-sm text-primary">
                  ✔ CEP {formatCEP(endereco.cep)} atendido — taxa {formatBRL(taxaEntrega ?? 0)}
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_120px]">
                  <Campo label="Rua">
                    <input className="input" value={endereco.rua}
                      onChange={(e) => setEndereco({ ...endereco, rua: e.target.value })} />
                  </Campo>
                  <Campo label="Número">
                    <input className="input" value={endereco.numero}
                      onChange={(e) => setEndereco({ ...endereco, numero: e.target.value })} />
                  </Campo>
                </div>
                <Campo label="Complemento (opcional)">
                  <input className="input" value={endereco.complemento}
                    onChange={(e) => setEndereco({ ...endereco, complemento: e.target.value })} />
                </Campo>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Campo label="Bairro">
                    <input className="input" value={endereco.bairro}
                      onChange={(e) => setEndereco({ ...endereco, bairro: e.target.value })} />
                  </Campo>
                  <Campo label="Cidade">
                    <input className="input" value={endereco.cidade}
                      onChange={(e) => setEndereco({ ...endereco, cidade: e.target.value })} />
                  </Campo>
                </div>
                <Campo label="UF">
                  <input className="input uppercase" maxLength={2} value={endereco.uf}
                    onChange={(e) => setEndereco({ ...endereco, uf: e.target.value.toUpperCase() })} />
                </Campo>
              </div>
            )}

            {etapa === 4 && (
              <div className="space-y-5">
                <div>
                  <h2 className="font-display text-lg font-bold">Quando entregar?</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Escolha o dia e o horário que preferir.
                  </p>
                </div>

                <SeletorHorario value={horario} onChange={setHorario} />

                <Campo label="Observações (opcional)">
                  <textarea
                    className="input min-h-24"
                    value={obs}
                    onChange={(e) => setObs(e.target.value)}
                    placeholder="Ex: interfone, deixar com porteiro..."
                  />
                </Campo>
              </div>
            )}

            {etapa === 5 && (
              <PagamentoMP
                dados={{
                  cliente,
                  endereco: {
                    ...endereco,
                    complemento: endereco.complemento || null,
                  },
                  horario_entrega: new Date(horario).toISOString(),
                  itens: itensCheckout.map((i) => ({
                    produto_id: i.id,
                    quantidade: i.quantidade,
                  })),
                  observacoes: obs || null,
                }}
                valorTotal={totalComFrete}
                onCriado={() => limpar()}
              />
            )}

            {erro && (
              <div className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {erro}
              </div>
            )}

            {etapa < 5 && (
              <div className="mt-6 flex items-center justify-between gap-2">
                <button
                  onClick={voltar}
                  disabled={etapa === 1 || carregando}
                  className="rounded-full border border-border px-4 py-2 text-sm font-medium disabled:opacity-40"
                >
                  Voltar
                </button>
                <button
                  onClick={handleContinuar}
                  disabled={carregando}
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 font-semibold text-primary-foreground disabled:opacity-60"
                >
                  {carregando && <Loader2 className="h-4 w-4 animate-spin" />}
                  Continuar
                </button>
              </div>
            )}

            {etapa === 5 && (
              <div className="mt-6">
                <button
                  onClick={voltar}
                  className="rounded-full border border-border px-4 py-2 text-sm font-medium"
                >
                  ← Voltar ao horário
                </button>
              </div>
            )}
          </div>

          <aside className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm h-fit">
            <h3 className="font-display font-bold">Resumo</h3>
            <ul className="mt-3 space-y-2 text-sm">
              {itensCheckout.map((i) => (
                <li key={i.id} className="flex justify-between gap-2">
                  <span className="text-muted-foreground">
                    {i.quantidade}× {i.nome}
                  </span>
                  <span className="font-medium">{formatBRL(i.preco * i.quantidade)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 space-y-1.5 border-t border-border/60 pt-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatBRL(total)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Entrega</span>
                <span>{taxaEntrega === null ? "—" : formatBRL(taxaEntrega)}</span>
              </div>
              <div className="flex justify-between pt-2 text-base font-bold">
                <span>Total</span>
                <span className="text-warm">{formatBRL(totalComFrete)}</span>
              </div>
            </div>
          </aside>
        </div>
      </div>

      <style>{`
        .input {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid var(--color-border);
          background: var(--color-background);
          padding: 0.65rem 0.85rem;
          font-size: 0.95rem;
          outline: none;
          transition: border-color .15s, box-shadow .15s;
        }
        .input:focus {
          border-color: var(--color-primary);
          box-shadow: 0 0 0 3px color-mix(in oklab, var(--color-primary) 20%, transparent);
        }
      `}</style>
    </div>
  );
}
