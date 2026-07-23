import { Check } from "lucide-react";

export type EtapaCheckout = 1 | 2 | 3 | 4 | 5;

const PASSOS = ["Você", "CEP", "Endereço", "Horário", "Pagamento"];

export function Stepper({ etapa }: { etapa: EtapaCheckout }) {
  return (
    <ol className="flex flex-wrap items-center gap-2 text-xs">
      {PASSOS.map((label, i) => {
        const n = (i + 1) as EtapaCheckout;
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
            {i < PASSOS.length - 1 && <span className="text-muted-foreground">›</span>}
          </li>
        );
      })}
    </ol>
  );
}
