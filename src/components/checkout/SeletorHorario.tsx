import React from "react";

const DIAS_SEMANA_CURTO = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MESES_CURTO = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const BUFFER_MIN_MESMO_DIA = 45;

const SLOTS_HORARIO: { minutosDoDia: number; label: string }[] = [
  { minutosDoDia: 9 * 60, label: "09h às 12h" },
  { minutosDoDia: 12 * 60, label: "12h às 15h" },
  { minutosDoDia: 15 * 60, label: "15h às 18h" },
];

function mesmoDia(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function SeletorHorario({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const dias = React.useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    return Array.from({ length: 8 }, (_, i) => {
      const d = new Date(hoje);
      d.setDate(hoje.getDate() + i);
      return d;
    });
  }, []);

  const [dataCustom, setDataCustom] = React.useState<Date | null>(null);
  const [mostrarCustom, setMostrarCustom] = React.useState(false);

  const diasDisponiveis = React.useMemo(() => {
    return dataCustom ? [...dias, dataCustom] : dias;
  }, [dias, dataCustom]);

  const selecao = React.useMemo(() => {
    if (!value) return { diaIdx: -1, minutos: -1 };
    const dt = new Date(value);
    const diaIdx = diasDisponiveis.findIndex((d) => mesmoDia(d, dt));
    return { diaIdx, minutos: dt.getHours() * 60 + dt.getMinutes() };
  }, [value, diasDisponiveis]);

  const [diaAtivo, setDiaAtivo] = React.useState<number>(
    selecao.diaIdx >= 0 ? selecao.diaIdx : 0,
  );

  React.useEffect(() => {
    if (selecao.diaIdx >= 0) setDiaAtivo(selecao.diaIdx);
  }, [selecao.diaIdx]);

  const minMinutosHoje = React.useMemo(() => {
    const agora = new Date();
    return agora.getHours() * 60 + agora.getMinutes() + BUFFER_MIN_MESMO_DIA;
  }, []);

  const diaSelecionado = diasDisponiveis[diaAtivo];
  const ehHoje = diaSelecionado ? mesmoDia(diaSelecionado, new Date()) : false;

  function escolher(diaIdx: number, minutos: number) {
    const base = diasDisponiveis[diaIdx];
    if (!base) return;
    const d = new Date(base);
    d.setHours(Math.floor(minutos / 60), minutos % 60, 0, 0);
    const pad = (n: number) => String(n).padStart(2, "0");
    const s = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    onChange(s);
    setDiaAtivo(diaIdx);
  }

  function aplicarDataCustom(iso: string) {
    if (!iso) return;
    const [y, m, day] = iso.split("-").map(Number);
    const d = new Date(y, m - 1, day, 0, 0, 0, 0);
    setDataCustom(d);
    setDiaAtivo(dias.length);
    setMostrarCustom(false);
  }

  const minCustomISO = React.useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + dias.length);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }, [dias.length]);

  return (
    <div className="space-y-4">
      <div>
        <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Escolha o dia
        </span>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {diasDisponiveis.map((d, i) => {
            const ativo = i === diaAtivo;
            const ehHojeBtn = mesmoDia(d, new Date());
            const isCustom = dataCustom && i === dias.length;
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
                  {ehHojeBtn ? "Hoje" : DIAS_SEMANA_CURTO[d.getDay()]}
                </span>
                <span className="text-lg font-bold leading-none">{d.getDate()}</span>
                <span className="text-[10px] opacity-70">
                  {MESES_CURTO[d.getMonth()]}
                  {isCustom ? " ✦" : ""}
                </span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setMostrarCustom((v) => !v)}
            className="flex min-w-[68px] flex-col items-center justify-center gap-0.5 rounded-2xl border border-dashed border-border px-3 py-2.5 text-xs font-medium text-muted-foreground hover:border-primary hover:text-primary transition"
          >
            <span className="text-lg leading-none">+</span>
            <span className="leading-tight text-center">Outra<br/>data</span>
          </button>
        </div>

        {mostrarCustom && (
          <div className="mt-3 rounded-xl border border-border/70 bg-muted/30 p-3">
            <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
              Escolha qualquer data
            </label>
            <input
              type="date"
              min={minCustomISO}
              className="input"
              onChange={(e) => aplicarDataCustom(e.target.value)}
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              Para os próximos 7 dias, use os botões acima.
            </p>
          </div>
        )}
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Escolha o turno
          </span>
          {ehHoje && (
            <span className="text-[10px] text-muted-foreground">
              Turnos com início a menos de {BUFFER_MIN_MESMO_DIA} min ficam indisponíveis
            </span>
          )}
        </div>
        <div className="rounded-xl border border-border/60 bg-background/40 p-2">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {SLOTS_HORARIO.map((slot) => {
              const indisponivel = ehHoje && slot.minutosDoDia < minMinutosHoje;
              const selecionado =
                selecao.diaIdx === diaAtivo && selecao.minutos === slot.minutosDoDia;
              return (
                <button
                  key={slot.minutosDoDia}
                  type="button"
                  disabled={indisponivel}
                  onClick={() => escolher(diaAtivo, slot.minutosDoDia)}
                  className={`rounded-lg border px-3 py-2.5 text-sm font-semibold transition ${
                    selecionado
                      ? "border-warm bg-warm text-white shadow"
                      : indisponivel
                        ? "border-border/40 bg-muted/40 text-muted-foreground/50 line-through cursor-not-allowed"
                        : "border-border/70 bg-card hover:border-warm/60 hover:bg-muted"
                  }`}
                >
                  {slot.label}
                </button>
              );
            })}
          </div>
        </div>
        {ehHoje && SLOTS_HORARIO.every((s) => s.minutosDoDia < minMinutosHoje) && (
          <p className="mt-2 text-xs text-destructive">
            Não há mais horários disponíveis hoje. Escolha outro dia.
          </p>
        )}
      </div>

      {value && (
        <div className="rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">
          ✔ Entrega agendada para{" "}
          <strong>
            {diasDisponiveis[diaAtivo]?.toLocaleDateString("pt-BR", {
              weekday: "long",
              day: "2-digit",
              month: "long",
            })}
          </strong>{" "}
          no turno{" "}
          <strong>
            {SLOTS_HORARIO.find((s) => s.minutosDoDia === selecao.minutos)?.label ??
              `${new Date(value).getHours().toString().padStart(2, "0")}h`}
          </strong>
        </div>
      )}
    </div>
  );
}
