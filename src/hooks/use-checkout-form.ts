import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { isCPFValido, onlyDigits } from "@/lib/format";
import { validarCEP } from "@/lib/cep.functions";

export interface ClienteState {
  nome: string;
  telefone: string;
  email: string;
  cpf: string;
}

export interface EnderecoState {
  cep: string;
  rua: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
}

const enderecoVazio: EnderecoState = {
  cep: "",
  rua: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  uf: "",
};

/**
 * Concentra o estado e as validações de cada etapa do checkout.
 * Retorna `true` quando a etapa está válida (chamador avança), `false`
 * quando a validação falhou (a mensagem é gravada em `erro`).
 */
export function useCheckoutForm() {
  const [cliente, setCliente] = useState<ClienteState>({
    nome: "",
    telefone: "",
    email: "",
    cpf: "",
  });
  const [cpfInput, setCpfInput] = useState("");
  const [emailConfirm, setEmailConfirm] = useState("");
  const [cepInput, setCepInput] = useState("");
  const [taxaEntrega, setTaxaEntrega] = useState<number | null>(null);
  const [endereco, setEndereco] = useState<EnderecoState>(enderecoVazio);
  const [horario, setHorario] = useState("");
  const [obs, setObs] = useState("");

  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  const fnValidarCEP = useServerFn(validarCEP);

  function validarEtapa1({ exigirConfirmacaoEmail }: { exigirConfirmacaoEmail: boolean }): boolean {
    setErro(null);
    if (!cliente.nome || cliente.telefone.length < 14 || !/\S+@\S+/.test(cliente.email)) {
      setErro("Preencha nome, telefone válido e e-mail.");
      return false;
    }
    if (exigirConfirmacaoEmail && cliente.email.trim() !== emailConfirm.trim()) {
      setErro("Os e-mails informados não coincidem.");
      return false;
    }
    if (!isCPFValido(cpfInput)) {
      setErro("Informe um CPF válido — é exigido pelo Mercado Pago para gerar o Pix.");
      return false;
    }
    setCliente((p) => ({ ...p, cpf: onlyDigits(cpfInput) }));
    return true;
  }

  async function executarEtapa2(): Promise<boolean> {
    setErro(null);
    setCarregando(true);
    try {
      const cepDigits = onlyDigits(cepInput);
      const res = await fnValidarCEP({ data: { cep: cepDigits } });
      if (!res.atende) {
        setErro("Puxa! Ainda não entregamos nesse CEP.");
        return false;
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
      return true;
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Erro ao validar CEP.");
      return false;
    } finally {
      setCarregando(false);
    }
  }

  function validarEtapa3(): boolean {
    setErro(null);
    if (
      !endereco.rua ||
      !endereco.numero ||
      !endereco.bairro ||
      !endereco.cidade ||
      endereco.uf.length !== 2
    ) {
      setErro("Preencha o endereço completo.");
      return false;
    }
    return true;
  }

  function validarEtapa4(): boolean {
    setErro(null);
    if (!horario) {
      setErro("Escolha um horário de entrega.");
      return false;
    }
    return true;
  }

  return {
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
    setErro,
    carregando,
    validarEtapa1,
    executarEtapa2,
    validarEtapa3,
    validarEtapa4,
  };
}
