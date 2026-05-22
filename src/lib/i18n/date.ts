/**
 * Helpers de formatação de data centrais — usar em todo lugar que renderiza
 * data/hora para o usuário.
 *
 * Por que centralizar: hoje há ~17 arquivos com `new Intl.DateTimeFormat("pt-BR", ...)`
 * inline. Centralizar permite:
 * - mudar locale por sessão no futuro (ex.: pt-PT, en-US)
 * - garantir consistência visual entre telas
 * - facilitar testes de timezone/locale
 *
 * Locale fixo `pt-BR` por enquanto; quando i18n entrar, parametrizar.
 */

type DateInput = Date | string | number;

const DEFAULT_LOCALE = "pt-BR";

function toDate(input: DateInput): Date {
  return input instanceof Date ? input : new Date(input);
}

/** "22/05/2026" */
export function formatDate(input: DateInput): string {
  return new Intl.DateTimeFormat(DEFAULT_LOCALE, {
    dateStyle: "short",
  }).format(toDate(input));
}

/** "22/05/2026, 14:30" */
export function formatDateTime(input: DateInput): string {
  return new Intl.DateTimeFormat(DEFAULT_LOCALE, {
    dateStyle: "short",
    timeStyle: "short",
  }).format(toDate(input));
}

/** "14:30" */
export function formatTime(input: DateInput): string {
  return new Intl.DateTimeFormat(DEFAULT_LOCALE, {
    timeStyle: "short",
  }).format(toDate(input));
}

/** "22 mai 2026" */
export function formatDateMedium(input: DateInput): string {
  return new Intl.DateTimeFormat(DEFAULT_LOCALE, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(toDate(input));
}

/**
 * Escape-hatch: aceita Intl.DateTimeFormatOptions custom mas força o locale
 * central. Use quando os helpers padrão (formatDate/Time/Medium/etc.) não
 * cobrem o caso (ex.: "22/05", "quinta-feira, 22 de maio").
 */
export function formatCustom(input: DateInput, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(DEFAULT_LOCALE, options).format(toDate(input));
}

/** Relativo curto: "há 3 min", "há 2 h", "ontem". Para timestamps no passado. */
export function formatRelative(input: DateInput, now: Date = new Date()): string {
  const date = toDate(input);
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diffSec < 60) return "agora";
  if (diffSec < 3600) return `há ${Math.floor(diffSec / 60)} min`;
  if (diffSec < 86400) return `há ${Math.floor(diffSec / 3600)} h`;
  if (diffSec < 172800) return "ontem";
  if (diffSec < 604800) return `há ${Math.floor(diffSec / 86400)} dias`;
  return formatDate(input);
}
