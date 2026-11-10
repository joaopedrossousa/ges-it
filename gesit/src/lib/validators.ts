import { z } from "zod";

import { STATUS_EDITAVEIS } from "./types";

// ===========================================================================
// Utilitários
// ===========================================================================

/** Remove tudo que não for dígito. */
export function somenteDigitos(valor: string): string {
  return valor.replace(/\D/g, "");
}

// ===========================================================================
// CPF
// ===========================================================================

/**
 * Valida CPF pelos dois dígitos verificadores. Aceita com ou sem máscara.
 * Rejeita sequências de dígitos repetidos (ex.: 111.111.111-11).
 */
export function validarCPF(valor: string): boolean {
  const cpf = somenteDigitos(valor);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  const digitos = cpf.split("").map(Number);

  const calcularDV = (quantidade: number) => {
    let soma = 0;
    for (let i = 0; i < quantidade; i++) {
      soma += digitos[i] * (quantidade + 1 - i);
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  return calcularDV(9) === digitos[9] && calcularDV(10) === digitos[10];
}

/**
 * Formata como 000.000.000-00. Se não houver exatamente 11 dígitos,
 * devolve o valor original sem alteração.
 */
export function formatarCPF(valor: string): string {
  const cpf = somenteDigitos(valor);
  if (cpf.length !== 11) return valor;
  return cpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
}

/**
 * Máscara de privacidade para listagens: ***.456.789-**.
 * Se não houver exatamente 11 dígitos, devolve "***.***.***-**".
 */
export function mascararCPF(valor: string): string {
  const cpf = somenteDigitos(valor);
  if (cpf.length !== 11) return "***.***.***-**";
  return `***.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-**`;
}

/**
 * Formata enquanto o usuário digita (aceita CPF incompleto).
 * Ex.: "5299822" → "529.982.2"; limita a 11 dígitos.
 */
export function formatarCPFDigitando(valor: string): string {
  const cpf = somenteDigitos(valor).slice(0, 11);
  return cpf
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
}

// ===========================================================================
// IMEI
// ===========================================================================

/**
 * Valida IMEI: exatamente 15 dígitos e dígito verificador pelo algoritmo
 * de Luhn. Aceita com ou sem máscara.
 */
export function validarIMEI(valor: string): boolean {
  const imei = somenteDigitos(valor);
  if (imei.length !== 15) return false;

  let soma = 0;
  for (let i = 0; i < 15; i++) {
    let digito = Number(imei[i]);
    // Da direita para a esquerda, dobra um dígito sim, outro não,
    // começando pelo penúltimo (posições ímpares a partir da esquerda).
    if (i % 2 === 1) {
      digito *= 2;
      if (digito > 9) digito -= 9;
    }
    soma += digito;
  }
  return soma % 10 === 0;
}

/**
 * Formata como AA-BBBBBB-CCCCCC-D (TAC, número de série, dígito verificador).
 * Se não houver exatamente 15 dígitos, devolve o valor original sem alteração.
 */
export function formatarIMEI(valor: string): string {
  const imei = somenteDigitos(valor);
  if (imei.length !== 15) return valor;
  return imei.replace(/^(\d{2})(\d{6})(\d{6})(\d)$/, "$1-$2-$3-$4");
}

/**
 * Formata enquanto o usuário digita (aceita IMEI incompleto).
 * Ex.: "35209900" → "35-209900"; limita a 15 dígitos.
 */
export function formatarIMEIDigitando(valor: string): string {
  const imei = somenteDigitos(valor).slice(0, 15);
  const partes = [imei.slice(0, 2), imei.slice(2, 8), imei.slice(8, 14), imei.slice(14)];
  return partes.filter(Boolean).join("-");
}

// ===========================================================================
// Campos reutilizáveis
// ===========================================================================

/** Texto obrigatório, sem espaços nas pontas. */
const textoObrigatorio = (campo: string, max: number) =>
  z
    .string({ error: `Informe ${campo}.` })
    .trim()
    .min(1, `Informe ${campo}.`)
    .max(max, `Use no máximo ${max} caracteres.`);

/** Texto opcional: string vazia, undefined ou null viram null. */
const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use no máximo ${max} caracteres.`)
    .nullish()
    .transform((v) => v || null);

const idObrigatorio = (mensagem: string) =>
  z.string({ error: mensagem }).min(1, mensagem).pipe(z.uuid(mensagem));

const imeiObrigatorio = z
  .string({ error: "Informe o IMEI." })
  .trim()
  .min(1, "Informe o IMEI.")
  .transform(somenteDigitos)
  .refine((v) => v.length === 15, "O IMEI deve ter 15 dígitos.")
  .refine(validarIMEI, "IMEI inválido.");

const imeiOpcional = z
  .string()
  .nullish()
  .transform((v) => (v ? somenteDigitos(v) : "") || null)
  .refine((v) => v === null || v.length === 15, "O IMEI deve ter 15 dígitos.")
  .refine((v) => v === null || validarIMEI(v), "IMEI inválido.");

/**
 * Status escolhível em formulário. "em_uso" fica de fora: só é definido
 * pela função SQL vincular_dispositivo.
 */
const statusEditavel = z
  .enum(STATUS_EDITAVEIS, { error: "Status inválido." })
  .default("disponivel");

// ===========================================================================
// Schemas
// ===========================================================================

export const lojaSchema = z.object({
  nome: textoObrigatorio("o nome da loja", 100),
  cidade: textoOpcional(100),
  ativo: z.boolean().default(true),
});

export const colaboradorSchema = z.object({
  nome: textoObrigatorio("o nome", 150),
  loja_id: idObrigatorio("Selecione a loja."),
  /** Entra com ou sem máscara; sai só com dígitos. */
  cpf: z
    .string({ error: "Informe o CPF." })
    .trim()
    .min(1, "Informe o CPF.")
    .transform(somenteDigitos)
    .refine((v) => v.length === 11, "O CPF deve ter 11 dígitos.")
    .refine(validarCPF, "CPF inválido."),
  email: z
    .string({ error: "Informe o e-mail." })
    .trim()
    .toLowerCase()
    .min(1, "Informe o e-mail.")
    .pipe(z.email("Informe um e-mail válido.")),
  ativo: z.boolean().default(true),
});

export const notebookSchema = z.object({
  tipo: z.literal("notebook"),
  marca: textoObrigatorio("a marca", 60),
  modelo: textoObrigatorio("o modelo", 100),
  serial_number: textoObrigatorio("o número de série", 100),
  status: statusEditavel,
  observacao: textoOpcional(1000),
});

export const telefoneSchema = z
  .object({
    tipo: z.literal("telefone"),
    marca: textoObrigatorio("a marca", 60),
    modelo: textoObrigatorio("o modelo", 100),
    serial_number: textoOpcional(100),
    /** Entra com ou sem máscara; sai só com dígitos. */
    imei1: imeiObrigatorio,
    imei2: imeiOpcional,
    status: statusEditavel,
    observacao: textoOpcional(1000),
  })
  .refine((d) => d.imei2 === null || d.imei2 !== d.imei1, {
    message: "O IMEI 2 deve ser diferente do IMEI 1.",
    path: ["imei2"],
  });

/** Notebook ou telefone, escolhido pelo campo `tipo`. */
export const dispositivoSchema = z.discriminatedUnion("tipo", [
  notebookSchema,
  telefoneSchema,
]);

/** Argumentos de vincular_dispositivo. O PDF já deve estar no bucket "termos". */
export const vinculoSchema = z.object({
  dispositivo_id: idObrigatorio("Selecione o dispositivo."),
  colaborador_id: idObrigatorio("Selecione o usuário."),
  termo_path: textoOpcional(500),
  observacao: textoOpcional(1000),
});

/** Argumentos de devolver_dispositivo. */
export const devolucaoSchema = z.object({
  dispositivo_id: idObrigatorio("Dispositivo inválido."),
  observacao: textoOpcional(1000),
  novo_status: statusEditavel,
});

// Tipos de entrada (formulário) e saída (já normalizada para o banco).
export type LojaFormInput = z.input<typeof lojaSchema>;
export type LojaFormData = z.output<typeof lojaSchema>;
export type ColaboradorFormInput = z.input<typeof colaboradorSchema>;
export type ColaboradorFormData = z.output<typeof colaboradorSchema>;
export type NotebookFormInput = z.input<typeof notebookSchema>;
export type NotebookFormData = z.output<typeof notebookSchema>;
export type TelefoneFormInput = z.input<typeof telefoneSchema>;
export type TelefoneFormData = z.output<typeof telefoneSchema>;
export type DispositivoFormInput = z.input<typeof dispositivoSchema>;
export type DispositivoFormData = z.output<typeof dispositivoSchema>;
export type VinculoFormInput = z.input<typeof vinculoSchema>;
export type VinculoFormData = z.output<typeof vinculoSchema>;
export type DevolucaoFormInput = z.input<typeof devolucaoSchema>;
export type DevolucaoFormData = z.output<typeof devolucaoSchema>;

/* ===========================================================================
 * Testes simples (exemplos conferidos manualmente)
 * ===========================================================================
 *
 * somenteDigitos("529.982.247-25")        // "52998224725"
 * somenteDigitos("35-209900-176148-1")    // "352099001761481"
 *
 * --- CPF ---
 * validarCPF("529.982.247-25")            // true  (com máscara)
 * validarCPF("52998224725")               // true  (só dígitos)
 * validarCPF("111.444.777-35")            // true
 * validarCPF("529.982.247-24")            // false (dígito verificador errado)
 * validarCPF("111.111.111-11")            // false (dígitos repetidos)
 * validarCPF("1234567890")                // false (10 dígitos)
 * validarCPF("")                          // false
 *
 * formatarCPF("52998224725")              // "529.982.247-25"
 * formatarCPF("529.982.247-25")           // "529.982.247-25"
 * formatarCPF("123")                      // "123" (inalterado)
 *
 * mascararCPF("12345678909")              // "***.456.789-**"
 * mascararCPF("123")                      // "***.***.***-**"
 *
 * formatarCPFDigitando("529")             // "529"
 * formatarCPFDigitando("5299822")         // "529.982.2"
 * formatarCPFDigitando("529982247251234") // "529.982.247-25" (corta em 11)
 *
 * --- IMEI ---
 * validarIMEI("490154203237518")          // true
 * validarIMEI("35-209900-176148-1")       // true  (com máscara)
 * validarIMEI("490154203237519")          // false (Luhn falha)
 * validarIMEI("49015420323751")           // false (14 dígitos)
 * validarIMEI("4901542032375180")         // false (16 dígitos)
 *
 * formatarIMEI("352099001761481")         // "35-209900-176148-1"
 * formatarIMEI("12345")                   // "12345" (inalterado)
 *
 * formatarIMEIDigitando("35")             // "35"
 * formatarIMEIDigitando("35209900")       // "35-209900"
 * formatarIMEIDigitando("3520990017614819") // "35-209900-176148-1" (corta em 15)
 *
 * --- Schemas ---
 * lojaSchema.parse({ nome: " Filial Gurupi ", cidade: "" })
 *   // { nome: "Filial Gurupi", cidade: null, ativo: true }
 * lojaSchema.safeParse({ nome: "" }).success                    // false
 *
 * colaboradorSchema.parse({
 *   nome: "Maria Souza", loja_id: "0b6e7c1a-2f3d-4e5f-8a9b-1c2d3e4f5a6b",
 *   cpf: "529.982.247-25", email: " Maria@Empresa.com ",
 * })
 *   // { ..., cpf: "52998224725", email: "maria@empresa.com", ativo: true }
 * colaboradorSchema.safeParse({ ...mesmo, cpf: "111.111.111-11" }).success  // false
 * colaboradorSchema.safeParse({ ...mesmo, email: "maria@" }).success        // false
 *
 * notebookSchema.parse({ tipo: "notebook", marca: "Dell", modelo: "Latitude 5440", serial_number: "ABC123" })
 *   // { ..., status: "disponivel", observacao: null }
 * notebookSchema.safeParse({ tipo: "notebook", marca: "Dell", modelo: "X", serial_number: "" }).success  // false
 * notebookSchema.safeParse({ ...valido, status: "em_uso" }).success        // false
 *
 * telefoneSchema.parse({ tipo: "telefone", marca: "Samsung", modelo: "A15", imei1: "35-209900-176148-1", imei2: "" })
 *   // { ..., imei1: "352099001761481", imei2: null, serial_number: null }
 * telefoneSchema.safeParse({ ...valido, imei1: "490154203237519" }).success           // false (Luhn)
 * telefoneSchema.safeParse({ ...valido, imei2: "352099001761481" }).success           // false (igual ao IMEI 1)
 *
 * vinculoSchema.parse({ dispositivo_id: "<uuid>", colaborador_id: "<uuid>" })
 *   // { ..., termo_path: null, observacao: null }
 * vinculoSchema.safeParse({ dispositivo_id: "", colaborador_id: "<uuid>" }).success   // false
 */
