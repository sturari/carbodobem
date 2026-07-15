import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { useCart } from "@/lib/cart-store";
import { formatBRL, formatCEP, formatTelefone, onlyDigits } from "@/lib/format";
import { validarCEP } from "@/lib/cep.functions";
import { criarPedido } from "@/lib/pedidos.functions";
import { criarPreferenciaMP } from "@/lib/mercadopago.functions";

export const Route = createFileRoute("/checkout")({
  component: CheckoutPage,
});

type Etapa = 1 | 2 | 3 | 4 | 5;

function CheckoutPage() {
  const navigate = useNavigate();
  const { itens, subtotal, limpar } = useCart();
  const total = subtotal();

  const [etapa, setEtapa] = useState<Etapa>(1);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  const [cliente, setCliente] = useState({ nome: "", telefone: "", email: "" });
  const [cepInput, setCepInput] = useState("");
  const [taxaEntrega, setTaxaEntrega] = useState<number | null>(null);
  const [endereco, setEndereco] = useState({
    cep: "",
    rua: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    uf: "",
  });
  const [horario, setHorario] = useState("");
  const [obs, setObs] = useState("");

  const fnValidarCEP = useServerFn(validarCEP);
  const fnCriarPedido = useServerFn(criarPedido);
  const fnCriarMP = useServerFn(criarPreferenciaMP);

  if (itens.length === 0 && etapa < 5) {
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

  const proximo = () => setEtapa((e) => Math.min(5, e + 1) as Etapa);
  const voltar = () => setEtapa((e) => Math.max(1, e - 1) as Etapa);

  async function acaoEtapa1() {
    setErro(null);
    if (!cliente.nome || cliente.telefone.length < 14 || !/\S+@\S+/.test(cliente.email)) {
      setErro("Preencha nome, telefone válido e e-mail.");
      return;
    }
    proximo();
  }

  async function acaoEtapa2() {
    setErro(null);
    setCarregando(true);
    try {
      const cepDigits = onlyDigits(cepInput);
      const res = await fnValidarCEP({ data: { cep: cepDigits } });
      if (!res.atende) {
        setErro("Puxa! Ainda não entregamos nesse CEP.");
        return;
      }
      setTaxaEntrega(res.taxa_entrega);
      setEndereco((p) => ({
        ...p,
        cep: res.cep,
        rua: res.endereco?.rua ?? "",
        bairro: res.endereco?.bairro ?? "",
        cidade: res.endereco?.cidade ?? "",
        uf: res.endereco?.uf ?? "",
      }));
      proximo();
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Erro ao validar CEP.");
    } finally {
      setCarregando(false);
    }
  }

  function acaoEtapa3() {
    setErro(null);
    if (!endereco.rua || !endereco.numero || !endereco.bairro || !endereco.cidade || endereco.uf.length !== 2) {
      setErro("Preencha o endereço completo.");
      return;
    }
    proximo();
  }

  function acaoEtapa4() {
    setErro(null);
    if (!horario) {
      setErro("Escolha um horário de entrega.");
      return;
    }
    proximo();
  }

  async function finalizarPagamento() {
    setErro(null);
    setCarregando(true);
    try {
      const pedido = await fnCriarPedido({
        data: {
          cliente,
          endereco: {
            ...endereco,
            complemento: endereco.complemento || null,
          },
          horario_entrega: new Date(horario).toISOString(),
          itens: itens.map((i) => ({ produto_id: i.id, quantidade: i.quantidade })),
          observacoes: obs || null,
        },
      });

      const pref = await fnCriarMP({
        data: {
          pedido_id: pedido.pedido_id,
          items: itens.map((i) => ({
            id: i.id,
            title: i.nome,
            quantity: i.quantidade,
            unit_price: i.preco,
          })),
          payer: { name: cliente.nome, email: cliente.email, phone: cliente.telefone },
        },
      });

      limpar();
      // Redireciona ao Checkout Pro do Mercado Pago
      window.location.href = pref.init_point;

    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Erro ao processar pedido.");
    } finally {
      setCarregando(false);
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
                <Campo label="Nome completo">
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
                <Campo label="E-mail">
                  <input
                    className="input"
                    type="email"
                    value={cliente.email}
                    onChange={(e) => setCliente({ ...cliente, email: e.target.value })}
                  />
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
              <div className="space-y-4">
                <h2 className="font-display text-lg font-bold">Pagamento</h2>
                <p className="text-sm text-muted-foreground">
                  Você será redirecionado ao Mercado Pago para pagar com PIX, cartão ou boleto.
                </p>
                <div className="rounded-lg bg-cold/10 p-3 text-xs text-muted-foreground">
                  <strong>Modo desenvolvimento:</strong> Mercado Pago está mockado. Ao confirmar,
                  simulamos aprovação e mostramos a tela de sucesso.
                </div>
              </div>
            )}

            {erro && (
              <div className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {erro}
              </div>
            )}

            <div className="mt-6 flex items-center justify-between gap-2">
              <button
                onClick={voltar}
                disabled={etapa === 1 || carregando}
                className="rounded-full border border-border px-4 py-2 text-sm font-medium disabled:opacity-40"
              >
                Voltar
              </button>
              {etapa === 5 ? (
                <button
                  onClick={finalizarPagamento}
                  disabled={carregando}
                  className="inline-flex items-center gap-2 rounded-full bg-warm px-6 py-2.5 font-bold text-white shadow-lg disabled:opacity-60"
                >
                  {carregando && <Loader2 className="h-4 w-4 animate-spin" />}
                  Pagar {formatBRL(totalComFrete)}
                </button>
              ) : (
                <button
                  onClick={
                    etapa === 1 ? acaoEtapa1
                      : etapa === 2 ? acaoEtapa2
                      : etapa === 3 ? acaoEtapa3
                      : acaoEtapa4
                  }
                  disabled={carregando}
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 font-semibold text-primary-foreground disabled:opacity-60"
                >
                  {carregando && <Loader2 className="h-4 w-4 animate-spin" />}
                  Continuar
                </button>
              )}
            </div>
          </div>

          <aside className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm h-fit">
            <h3 className="font-display font-bold">Resumo</h3>
            <ul className="mt-3 space-y-2 text-sm">
              {itens.map((i) => (
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

function Stepper({ etapa }: { etapa: Etapa }) {
  const passos = ["Você", "CEP", "Endereço", "Horário", "Pagamento"];
  return (
    <ol className="flex flex-wrap items-center gap-2 text-xs">
      {passos.map((label, i) => {
        const n = (i + 1) as Etapa;
        const done = etapa > n;
        const active = etapa === n;
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold ${
                done
                  ? "bg-primary text-primary-foreground"
                  : active
                    ? "bg-warm text-white"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {done ? <Check className="h-3.5 w-3.5" /> : n}
            </span>
            <span className={active ? "font-semibold" : "text-muted-foreground"}>{label}</span>
            {i < passos.length - 1 && <span className="text-muted-foreground">›</span>}
          </li>
        );
      })}
    </ol>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

// ============ Seletor de horário amigável ============
const DIAS_SEMANA_CURTO = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MESES_CURTO = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

// Slots de entrega disponíveis (24h de antecedência é aplicada por dia)
const SLOTS_HORARIO = [
  { hora: 9, label: "09:00" },
  { hora: 11, label: "11:00" },
  { hora: 14, label: "14:00" },
  { hora: 16, label: "16:00" },
  { hora: 18, label: "18:00" },
];

function SeletorHorario({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  // Gera os próximos 7 dias a partir de amanhã
  const dias = React.useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(hoje);
      d.setDate(hoje.getDate() + i + 1);
      return d;
    });
  }, []);

  // Reconstitui seleção a partir do valor atual (datetime-local string)
  const selecao = React.useMemo(() => {
    if (!value) return { diaIdx: -1, hora: -1 };
    const dt = new Date(value);
    const diaIdx = dias.findIndex(
      (d) =>
        d.getFullYear() === dt.getFullYear() &&
        d.getMonth() === dt.getMonth() &&
        d.getDate() === dt.getDate(),
    );
    return { diaIdx, hora: dt.getHours() };
  }, [value, dias]);

  const [diaAtivo, setDiaAtivo] = React.useState<number>(
    selecao.diaIdx >= 0 ? selecao.diaIdx : 0,
  );

  React.useEffect(() => {
    if (selecao.diaIdx >= 0) setDiaAtivo(selecao.diaIdx);
  }, [selecao.diaIdx]);

  function escolher(diaIdx: number, hora: number) {
    const d = new Date(dias[diaIdx]);
    d.setHours(hora, 0, 0, 0);
    // formato datetime-local (YYYY-MM-DDTHH:mm) para compatibilidade com o resto do fluxo
    const pad = (n: number) => String(n).padStart(2, "0");
    const s = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    onChange(s);
    setDiaAtivo(diaIdx);
  }

  return (
    <div className="space-y-4">
      {/* Dias */}
      <div>
        <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Escolha o dia
        </span>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {dias.map((d, i) => {
            const ativo = i === diaAtivo;
            return (
              <button
                key={i}
                type="button"
                onClick={() => setDiaAtivo(i)}
                className={`flex min-w-[68px] flex-col items-center gap-0.5 rounded-2xl border px-3 py-2.5 text-sm transition ${
                  ativo
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "border-border/70 bg-card hover:border-primary/50 hover:bg-muted"
                }`}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wide opacity-80">
                  {DIAS_SEMANA_CURTO[d.getDay()]}
                </span>
                <span className="text-lg font-bold leading-none">{d.getDate()}</span>
                <span className="text-[10px] opacity-70">{MESES_CURTO[d.getMonth()]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Slots de horário */}
      <div>
        <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Escolha o horário
        </span>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {SLOTS_HORARIO.map((slot) => {
            const selecionado =
              selecao.diaIdx === diaAtivo && selecao.hora === slot.hora;
            return (
              <button
                key={slot.hora}
                type="button"
                onClick={() => escolher(diaAtivo, slot.hora)}
                className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
                  selecionado
                    ? "border-warm bg-warm text-white shadow"
                    : "border-border/70 bg-card hover:border-warm/60 hover:bg-muted"
                }`}
              >
                {slot.label}
              </button>
            );
          })}
        </div>
      </div>

      {value && (
        <div className="rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">
          ✔ Entrega agendada para{" "}
          <strong>
            {dias[diaAtivo]?.toLocaleDateString("pt-BR", {
              weekday: "long",
              day: "2-digit",
              month: "long",
            })}
          </strong>{" "}
          às <strong>{new Date(value).getHours().toString().padStart(2, "0")}:00</strong>
        </div>
      )}
    </div>
  );
}

