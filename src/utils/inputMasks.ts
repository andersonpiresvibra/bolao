/**
 * Utilitários globais de máscaras de entrada, separadores automáticos de valores
 * e geração/compartilhamento de links de convite de bolão.
 */

/**
 * Converte um valor numérico (em reais, ex: 5000 ou 0) para string mascarada "R$ 5.000,00" / "R$ 0,00"
 */
export function numberToCurrencyMask(value: number): string {
  const safeVal = Number.isFinite(value) && value >= 0 ? value : 0;
  return safeVal.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Máscara bancária de entrada para moeda BRL:
 * Ao digitar dígitos, formata automaticamente em "R$ X.XXX,XX" (ou "R$ 0,00" quando zerado).
 */
export function maskCurrencyBRL(rawValue: string): string {
  const digits = String(rawValue || '').replace(/\D/g, '');
  if (!digits) return 'R$ 0,00';
  const cents = parseInt(digits, 10);
  if (Number.isNaN(cents) || cents <= 0) return 'R$ 0,00';
  const reais = cents / 100;
  return numberToCurrencyMask(reais);
}

/**
 * Extrai o número float (em reais) a partir de uma string mascarada "R$ 5.000,00" -> 5000
 */
export function parseCurrencyBRL(maskedValue: string | number): number {
  if (typeof maskedValue === 'number') {
    return Number.isFinite(maskedValue) ? maskedValue : 0;
  }
  const digits = String(maskedValue || '').replace(/\D/g, '');
  if (!digits) return 0;
  const cents = parseInt(digits, 10);
  if (Number.isNaN(cents)) return 0;
  return Number((cents / 100).toFixed(2));
}

/**
 * Máscara automática de CPF: 000.000.000-00
 */
export function maskCpfInput(rawValue: string): string {
  const digits = String(rawValue || '')
    .replace(/\D/g, '')
    .slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  }
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

/**
 * Máscara automática de WhatsApp / Telefone: (00) 00000-0000
 */
export function maskPhoneInput(rawValue: string): string {
  const digits = String(rawValue || '')
    .replace(/\D/g, '')
    .slice(0, 11);
  if (!digits) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

/**
 * Máscara inteligente para campos híbridos (Login por CPF/E-mail/Usuário ou Chave Pix):
 * Se contiver apenas dígitos e pontuação de CPF/telefone, aplica máscara de CPF/Celular automaticamente.
 */
export function maskSmartIdentifier(rawValue: string): string {
  const val = String(rawValue || '');
  if (/[a-zA-Z@]/.test(val)) {
    return val;
  }
  const digits = val.replace(/\D/g, '');
  if (!digits) return val;
  if (val.startsWith('(') && digits.length <= 11) {
    return maskPhoneInput(digits);
  }
  if (digits.length <= 11) {
    return maskCpfInput(digits);
  }
  return digits;
}

/**
 * Máscara para números inteiros com separador de milhar automático (ex: 1.250)
 */
export function maskIntegerWithSeparator(rawValue: string | number): string {
  const digits = String(rawValue ?? '').replace(/\D/g, '');
  if (!digits) return '';
  const num = parseInt(digits, 10);
  if (Number.isNaN(num)) return '';
  return num.toLocaleString('pt-BR');
}

export function parseIntegerWithSeparator(maskedValue: string | number): number {
  if (typeof maskedValue === 'number') return maskedValue;
  const digits = String(maskedValue || '').replace(/\D/g, '');
  if (!digits) return 0;
  return parseInt(digits, 10) || 0;
}

/**
 * Gera o link direto de convite e divulgação de um Bolão
 */
export function buildPoolShareUrl(companyId: string, poolId?: string): string {
  if (typeof window === 'undefined') return '';
  const baseUrl = `${window.location.origin}${window.location.pathname}`;
  const params = new URLSearchParams();
  params.set('bolao', companyId);
  if (poolId) {
    params.set('pool', poolId);
  }
  return `${baseUrl}?${params.toString()}`;
}

/**
 * Copia e/ou compartilha o link oficial do Bolão
 */
export async function shareOrCopyPoolLink(options: {
  companyId: string;
  poolId?: string;
  title: string;
  companyName: string;
  useNativeShare?: boolean;
}): Promise<string> {
  const url = buildPoolShareUrl(options.companyId, options.poolId);
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(url);
    }
  } catch {
    // ignore clipboard fallback
  }

  if (options.useNativeShare && typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({
        title: `Bolão: ${options.title}`,
        text: `Participe do bolão "${options.title}" (${options.companyName})! Acesse pelo link:`,
        url,
      });
    } catch {
      // user cancelled or share not allowed in iframe
    }
  }

  return url;
}
