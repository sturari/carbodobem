import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Loader2, Copy, Check, ExternalLink, QrCode, CreditCard, Zap } from "lucide-react";
import {
  criarPagamentoPix,
  criarPagamentoCartao,
  iniciarCheckoutMercadoPago,
  confirmarPagamentoMercadoPago,
  obterMercadoPagoPublicKey,
} from "@/lib/mercadopago.functions";
import { formatBRL } from "@/lib/format";

type DadosPedido = {
  cliente: { nome: string; telefone: string; email: string; cpf: string };
  endereco: {
    cep: string;
    rua: string;
    numero: string;
    complemento: string | null;
    bairro: string;
    cidade: string;
    uf: string;
  };
  horario_entrega: string;
  itens: Array<{ produto_id: string; quantidade: number }>;
  observacoes: string | null;
};

type Props = {
  dados: DadosPedido;
  valorTotal: number;
  onCriado?: () => void;
};

type Metodo = "pix" | "cartao" | "redirect";

// SDK v2 do Mercado Pago injetado via <script>
type MpPaymentMethod = {
  id: string;
  name?: string;
  payment_type_id: string;
  thumbnail?: string;
  secure_thumbnail?: string;
  issuer?: { id: string };
};
type MpInstance = {
  createCardToken: (data: Record<string, string>) => Promise<{ id: string }>;
  getPaymentMethods: (data: { bin: string }) => Promise<{ results: MpPaymentMethod[] }>;
};
type MpConstructor = new (publicKey: string, opts?: { locale?: string }) => MpInstance;
declare global {
  interface Window {
    MercadoPago?: MpConstructor;
  }
}

function loadMercadoPagoSdk(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject(new Error("SSR"));
    if (window.MercadoPago) return resolve();
    const existing = document.querySelector('script[data-mp="v2"]') as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("MP SDK load error")));
      return;
    }
    const s = document.createElement("script");
    s.src = "https://sdk.mercadopago.com/js/v2";
    s.async = true;
    s.dataset.mp = "v2";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("MP SDK load error"));
    document.head.appendChild(s);
  });
}

export function PagamentoMP({ dados, valorTotal, onCriado }: Props) {
  const navigate = useNavigate();
  const [metodo, setMetodo] = useState<Metodo | null>(null);

  return (
    <div className="space-y-4">
      <h2 className="font-display text-lg font-bold">Pagamento</h2>

      {!metodo && (
        <>
          <p className="text-sm text-muted-foreground">Como você quer pagar?</p>
          <div className="grid gap-2">
            <MetodoBtn
              icon={<Zap className="h-5 w-5" />}
              titulo="Pix"
              descricao="QR code ou copia-e-cola. Aprovação na hora."
              onClick={() => setMetodo("pix")}
            />
            <MetodoBtn
              icon={<CreditCard className="h-5 w-5" />}
              titulo="Cartão de crédito"
              descricao="Preencha os dados aqui, sem redirecionamento."
              onClick={() => setMetodo("cartao")}
            />
            <MetodoBtn
              icon={<ExternalLink className="h-5 w-5" />}
              titulo="Outras opções (Mercado Pago)"
              descricao="Boleto, débito, saldo MP — abre no site do Mercado Pago."
              onClick={() => setMetodo("redirect")}
            />
          </div>
        </>
      )}

      {metodo === "pix" && (
        <FluxoPix
          dados={dados}
          valorTotal={valorTotal}
          onCriado={onCriado}
          onSucesso={(pedidoId) =>
            navigate({ to: "/checkout/sucesso", search: { pedido: pedidoId } as never })
          }
          onVoltar={() => setMetodo(null)}
        />
      )}

      {metodo === "cartao" && (
        <FluxoCartao
          dados={dados}
          valorTotal={valorTotal}
          onCriado={onCriado}
          onSucesso={(pedidoId) =>
            navigate({ to: "/checkout/sucesso", search: { pedido: pedidoId } as never })
          }
          onVoltar={() => setMetodo(null)}
        />
      )}

      {metodo === "redirect" && (
        <FluxoRedirect dados={dados} onCriado={onCriado} onVoltar={() => setMetodo(null)} />
      )}
    </div>
  );
}

function MetodoBtn({
  icon,
  titulo,
  descricao,
  onClick,
}: {
  icon: React.ReactNode;
  titulo: string;
  descricao: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 rounded-xl border border-border/70 bg-card p-4 text-left transition hover:border-primary hover:bg-muted"
    >
      <div className="text-primary">{icon}</div>
      <div className="flex-1">
        <div className="font-semibold">{titulo}</div>
        <div className="text-xs text-muted-foreground">{descricao}</div>
      </div>
    </button>
  );
}

/* ---------------- Pix ---------------- */

function FluxoPix({
  dados,
  valorTotal,
  onCriado,
  onSucesso,
  onVoltar,
}: {
  dados: DadosPedido;
  valorTotal: number;
  onCriado?: () => void;
  onSucesso: (pedidoId: string) => void;
  onVoltar: () => void;
}) {
  const fnCriar = useServerFn(criarPagamentoPix);
  const fnConsultar = useServerFn(confirmarPagamentoMercadoPago);

  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pix, setPix] = useState<{
    pedido_id: string;
    payment_id: string;
    qr_code: string;
    qr_code_base64: string | null;
    expires_at: string | null;
  } | null>(null);
  const [status, setStatus] = useState<string>("aguardando");
  const [copiado, setCopiado] = useState(false);
  const [agora, setAgora] = useState(() => Date.now());
  const [verificando, setVerificando] = useState(false);
  const submissaoRef = useRef(false);

  useEffect(() => {
    if (submissaoRef.current || pix) return;
    submissaoRef.current = true;
    (async () => {
      setCarregando(true);
      setErro(null);
      try {
        const r = await fnCriar({ data: dados });
        setPix({
          pedido_id: r.pedido_id,
          payment_id: r.payment_id,
          qr_code: r.qr_code,
          qr_code_base64: r.qr_code_base64,
          expires_at: r.expires_at,
        });
        setStatus(r.status);
        onCriado?.();
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Erro ao gerar Pix.");
        submissaoRef.current = false;
      } finally {
        setCarregando(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tick a cada 1s para o countdown
  useEffect(() => {
    if (!pix?.expires_at || status === "aprovado" || status === "recusado") return;
    const id = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(id);
  }, [pix?.expires_at, status]);

  // Polling do status enquanto não aprovado / recusado
  useEffect(() => {
    if (!pix) return;
    if (status === "aprovado") {
      const t = setTimeout(() => onSucesso(pix.pedido_id), 800);
      return () => clearTimeout(t);
    }
    if (status === "recusado") return;
    const id = setInterval(async () => {
      try {
        const r = await fnConsultar({
          data: { pedido_id: pix.pedido_id, payment_id: pix.payment_id },
        });
        setStatus(r.status);
      } catch {
        /* silencioso — tenta de novo */
      }
    }, 4000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pix, status]);

  async function copiar() {
    if (!pix) return;
    try {
      await navigator.clipboard.writeText(pix.qr_code);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* ignore */
    }
  }

  async function verificarAgora() {
    if (!pix || verificando) return;
    setVerificando(true);
    try {
      const r = await fnConsultar({
        data: { pedido_id: pix.pedido_id, payment_id: pix.payment_id },
      });
      setStatus(r.status);
    } catch {
      /* silencioso */
    } finally {
      setVerificando(false);
    }
  }

  // Countdown
  const expiraEm = pix?.expires_at ? new Date(pix.expires_at).getTime() : null;
  const restanteMs = expiraEm ? expiraEm - agora : null;
  const expirado = restanteMs !== null && restanteMs <= 0;
  const restanteLabel = (() => {
    if (restanteMs === null || restanteMs <= 0) return null;
    const totalSeg = Math.floor(restanteMs / 1000);
    const h = Math.floor(totalSeg / 3600);
    const m = Math.floor((totalSeg % 3600) / 60);
    const s = totalSeg % 60;
    const pad = (n: number) => String(n).padStart(2, "0");
    return h > 0 ? `${h}h ${pad(m)}min` : `${pad(m)}:${pad(s)}`;
  })();

  if (carregando && !pix) {
    return (
      <div className="rounded-xl border border-border/70 bg-muted/20 p-6 text-center text-sm">
        <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" />
        <p className="mt-2 text-muted-foreground">Gerando seu Pix…</p>
      </div>
    );
  }

  if (erro) {
    return (
      <div className="space-y-3">
        <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</div>
        <button onClick={onVoltar} className="text-sm text-primary underline">
          Escolher outro método
        </button>
      </div>
    );
  }

  if (!pix) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <QrCode className="h-4 w-4" />
        Pague <strong className="text-foreground">{formatBRL(valorTotal)}</strong> por Pix
      </div>

      {pix.qr_code_base64 && (
        <div className="flex justify-center">
          <img
            src={`data:image/png;base64,${pix.qr_code_base64}`}
            alt="QR Code Pix"
            className="h-56 w-56 rounded-lg border border-border/70 bg-white p-2"
          />
        </div>
      )}

      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Ou use o código copia-e-cola
        </label>
        <div className="flex gap-2">
          <textarea
            readOnly
            value={pix.qr_code}
            className="input flex-1 min-h-[72px] text-xs font-mono"
          />
          <button
            type="button"
            onClick={copiar}
            className="inline-flex items-center gap-1.5 self-start rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copiado ? "Copiado" : "Copiar"}
          </button>
        </div>
      </div>

      <div
        className={`rounded-lg px-3 py-2 text-sm ${
          status === "aprovado"
            ? "bg-primary/10 text-primary"
            : status === "recusado" || expirado
              ? "bg-destructive/10 text-destructive"
              : "bg-muted/60 text-muted-foreground"
        }`}
      >
        {status === "aprovado" && "✔ Pagamento confirmado! Redirecionando…"}
        {status === "recusado" && "Pagamento recusado. Escolha outro método."}
        {status !== "aprovado" && status !== "recusado" && expirado && (
          <span>Este Pix expirou. Volte e escolha outro método.</span>
        )}
        {status !== "aprovado" && status !== "recusado" && !expirado && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Aguardando pagamento…
              {restanteLabel && (
                <span className="text-xs opacity-80">expira em {restanteLabel}</span>
              )}
            </span>
            <button
              type="button"
              onClick={verificarAgora}
              disabled={verificando}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-60"
            >
              {verificando && <Loader2 className="h-3 w-3 animate-spin" />}
              {verificando ? "Verificando…" : "Já paguei"}
            </button>
          </div>
        )}
      </div>

      <button onClick={onVoltar} className="text-xs text-muted-foreground underline">
        Escolher outro método
      </button>
    </div>
  );
}

/* ---------------- Cartão ---------------- */

function FluxoCartao({
  dados,
  valorTotal,
  onCriado,
  onSucesso,
  onVoltar,
}: {
  dados: DadosPedido;
  valorTotal: number;
  onCriado?: () => void;
  onSucesso: (pedidoId: string) => void;
  onVoltar: () => void;
}) {
  const fnPublicKey = useServerFn(obterMercadoPagoPublicKey);
  const fnCriar = useServerFn(criarPagamentoCartao);

  const [mp, setMp] = useState<MpInstance | null>(null);
  const [carregandoSdk, setCarregandoSdk] = useState(true);
  const [erroSdk, setErroSdk] = useState<string | null>(null);

  const [numero, setNumero] = useState("");
  const [nome, setNome] = useState("");
  const [validade, setValidade] = useState(""); // MM/AA
  const [cvv, setCvv] = useState("");
  const [parcelas, setParcelas] = useState(1);

  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [bandeira, setBandeira] = useState<MpPaymentMethod | null>(null);

  // Detecta bandeira em tempo real via BIN (a partir de 6 dígitos)
  useEffect(() => {
    if (!mp) return;
    const digits = numero.replace(/\D/g, "");
    if (digits.length < 6) {
      setBandeira(null);
      return;
    }
    const bin = digits.slice(0, 8);
    let cancelado = false;
    const t = setTimeout(async () => {
      try {
        const pm = await mp.getPaymentMethods({ bin });
        if (!cancelado) setBandeira(pm.results[0] ?? null);
      } catch {
        if (!cancelado) setBandeira(null);
      }
    }, 250);
    return () => {
      cancelado = true;
      clearTimeout(t);
    };
  }, [numero, mp]);

  useEffect(() => {
    (async () => {
      try {
        await loadMercadoPagoSdk();
        const { publicKey } = await fnPublicKey();
        if (!window.MercadoPago) throw new Error("SDK do Mercado Pago não carregou.");
        setMp(new window.MercadoPago(publicKey, { locale: "pt-BR" }));
      } catch (e) {
        setErroSdk(e instanceof Error ? e.message : "Erro carregando pagamento.");
      } finally {
        setCarregandoSdk(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function formatarNumero(v: string) {
    const d = v.replace(/\D/g, "").slice(0, 19);
    return d.replace(/(.{4})/g, "$1 ").trim();
  }
  function formatarValidade(v: string) {
    const d = v.replace(/\D/g, "").slice(0, 4);
    if (d.length <= 2) return d;
    return `${d.slice(0, 2)}/${d.slice(2)}`;
  }

  async function pagar() {
    if (!mp) return;
    setErro(null);
    const numeroLimpo = numero.replace(/\s/g, "");
    const [mm, aa] = validade.split("/");
    if (numeroLimpo.length < 13 || !nome || !mm || !aa || cvv.length < 3) {
      setErro("Preencha todos os dados do cartão.");
      return;
    }
    setProcessando(true);
    try {
      // 1) Usa a bandeira já detectada, ou consulta na hora se ainda não veio
      let pm = bandeira;
      if (!pm) {
        const r = await mp.getPaymentMethods({ bin: numeroLimpo.slice(0, 8) });
        pm = r.results[0] ?? null;
      }
      if (!pm) throw new Error("Bandeira do cartão não reconhecida.");

      // 2) Tokeniza o cartão localmente
      const { id: token } = await mp.createCardToken({
        cardNumber: numeroLimpo,
        cardholderName: nome,
        cardExpirationMonth: mm,
        cardExpirationYear: aa.length === 2 ? `20${aa}` : aa,
        securityCode: cvv,
        identificationType: "CPF",
        identificationNumber: dados.cliente.cpf,
      });

      // 3) Envia ao servidor para criar pagamento
      const r = await fnCriar({
        data: {
          ...dados,
          cartao: {
            token,
            payment_method_id: pm.id,
            installments: parcelas,
            issuer_id: pm.issuer?.id ?? null,
          },
        },
      });
      onCriado?.();

      if (r.status === "aprovado" || r.status === "pendente") {
        onSucesso(r.pedido_id);
      } else {
        setErro("Pagamento recusado pela operadora. Tente outro cartão.");
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao processar cartão.");
    } finally {
      setProcessando(false);
    }
  }

  if (carregandoSdk) {
    return (
      <div className="rounded-xl border border-border/70 bg-muted/20 p-6 text-center text-sm">
        <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" />
        <p className="mt-2 text-muted-foreground">Carregando módulo seguro…</p>
      </div>
    );
  }

  if (erroSdk) {
    return (
      <div className="space-y-3">
        <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {erroSdk}
        </div>
        <button onClick={onVoltar} className="text-sm text-primary underline">
          Escolher outro método
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        🔒 Seus dados são enviados criptografados diretamente ao Mercado Pago. O servidor da loja não
        armazena o número do cartão.
      </p>

      <label className="block">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Número do cartão
        </span>
        <input
          className="input"
          inputMode="numeric"
          autoComplete="cc-number"
          placeholder="0000 0000 0000 0000"
          value={numero}
          onChange={(e) => setNumero(formatarNumero(e.target.value))}
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Nome impresso no cartão
        </span>
        <input
          className="input uppercase"
          autoComplete="cc-name"
          placeholder="COMO ESTÁ NO CARTÃO"
          value={nome}
          onChange={(e) => setNome(e.target.value.toUpperCase())}
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Validade
          </span>
          <input
            className="input"
            inputMode="numeric"
            autoComplete="cc-exp"
            placeholder="MM/AA"
            value={validade}
            onChange={(e) => setValidade(formatarValidade(e.target.value))}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            CVV
          </span>
          <input
            className="input"
            inputMode="numeric"
            autoComplete="cc-csc"
            placeholder="123"
            maxLength={4}
            value={cvv}
            onChange={(e) => setCvv(e.target.value.replace(/\D/g, ""))}
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Parcelas
        </span>
        <select
          className="input"
          value={parcelas}
          onChange={(e) => setParcelas(Number(e.target.value))}
        >
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <option key={n} value={n}>
              {n}x de {formatBRL(valorTotal / n)} {n === 1 ? "à vista" : "sem juros"}
            </option>
          ))}
        </select>
      </label>

      {erro && (
        <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {erro}
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={onVoltar}
          className="text-xs text-muted-foreground underline"
          disabled={processando}
        >
          ← Outro método
        </button>
        <button
          type="button"
          onClick={pagar}
          disabled={processando}
          className="inline-flex items-center gap-2 rounded-full bg-warm px-6 py-2.5 font-bold text-white shadow-lg disabled:opacity-60"
        >
          {processando && <Loader2 className="h-4 w-4 animate-spin" />}
          {processando ? "Processando…" : `Pagar ${formatBRL(valorTotal)}`}
        </button>
      </div>
    </div>
  );
}

/* ---------------- Redirect (Checkout Pro) ---------------- */

function FluxoRedirect({
  dados,
  onCriado,
  onVoltar,
}: {
  dados: DadosPedido;
  onCriado?: () => void;
  onVoltar: () => void;
}) {
  const fnIniciar = useServerFn(iniciarCheckoutMercadoPago);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const submissaoRef = useRef(false);

  async function abrir() {
    if (submissaoRef.current) return;
    submissaoRef.current = true;
    setCarregando(true);
    setErro(null);
    try {
      const r = await fnIniciar({ data: { ...dados, origin: window.location.origin } });
      onCriado?.();
      setUrl(r.checkout_url);
      try {
        if (window.top && window.top !== window.self) {
          window.top.location.href = r.checkout_url;
        } else {
          window.location.assign(r.checkout_url);
        }
      } catch {
        /* usuário clica no link */
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao iniciar pagamento.");
      submissaoRef.current = false;
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Você será levado ao site do Mercado Pago para escolher entre boleto, débito ou saldo MP.
      </p>
      {erro && (
        <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {erro}
        </div>
      )}
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-full bg-warm px-5 py-2.5 text-sm font-bold text-white shadow-lg"
        >
          <ExternalLink className="h-4 w-4" />
          Abrir Mercado Pago
        </a>
      )}
      <div className="flex items-center justify-between pt-2">
        <button onClick={onVoltar} className="text-xs text-muted-foreground underline">
          ← Outro método
        </button>
        <button
          type="button"
          onClick={abrir}
          disabled={carregando || !!url}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 font-semibold text-primary-foreground disabled:opacity-60"
        >
          {carregando && <Loader2 className="h-4 w-4 animate-spin" />}
          {url ? "Redirecionando…" : carregando ? "Iniciando…" : "Continuar"}
        </button>
      </div>
    </div>
  );
}
