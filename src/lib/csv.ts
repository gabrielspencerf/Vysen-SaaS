/**
 * Utilitários para gerar e parsear CSV (export/import de leads e contatos).
 * Encoding: UTF-8. Separador: vírgula.
 */

const SEP = ",";
const QUOTE = '"';
// Caracteres que Excel/Sheets/LibreOffice interpretam como início de fórmula.
// Prefixar com apóstrofo é o padrão aceito (OWASP CSV Injection).
const FORMULA_TRIGGERS = new Set(["=", "+", "-", "@", "\t", "\r"]);

/**
 * Neutraliza CSV injection: se o valor começa com =, +, -, @, tab ou CR, prefixa
 * com apóstrofo para que o app de planilha trate como texto, não fórmula.
 * Telefones como "+5511..." perdem o "+" exibido (vira `'+5511...`) — tradeoff
 * consciente: segurança > fidelidade visual no export. Use export JSON se a
 * fidelidade dos campos for crítica.
 */
function neutralizeFormulaPrefix(s: string): string {
  if (s.length === 0) return s;
  return FORMULA_TRIGGERS.has(s[0]!) ? `'${s}` : s;
}

/**
 * Escapa um valor para CSV: neutraliza prefixo de fórmula e, se contém vírgula,
 * quebra de linha ou aspas, envolve em aspas e duplica aspas internas.
 */
export function escapeCsvValue(value: string): string {
  const safe = neutralizeFormulaPrefix(String(value ?? ""));
  if (safe.includes(QUOTE) || safe.includes(SEP) || safe.includes("\n") || safe.includes("\r")) {
    return QUOTE + safe.replaceAll(QUOTE, QUOTE + QUOTE) + QUOTE;
  }
  return safe;
}

/**
 * Monta uma linha de CSV a partir de valores (cabeçalho ou linha de dados).
 */
export function buildCsvRow(values: (string | number | null | undefined)[]): string {
  return values.map((v) => escapeCsvValue(v == null ? "" : String(v))).join(SEP);
}

/**
 * Parse simples de uma linha CSV: suporta campos entre aspas (e vírgulas dentro).
 * Não trata quebras de linha dentro de aspas (uma linha = uma linha de dados).
 */
export function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let i = 0;
  const len = line.length;
  while (i < len) {
    if (line[i] === QUOTE) {
      let field = "";
      i += 1;
      while (i < len) {
        if (line[i] === QUOTE) {
          i += 1;
          if (line[i] === QUOTE) {
            field += QUOTE;
            i += 1;
          } else {
            break;
          }
        } else {
          field += line[i];
          i += 1;
        }
      }
      out.push(field);
      if (line[i] === SEP) i += 1;
    } else {
      let field = "";
      while (i < len && line[i] !== SEP) {
        field += line[i];
        i += 1;
      }
      out.push(field.trim());
      if (line[i] === SEP) i += 1;
    }
  }
  return out;
}

/**
 * Parse de um texto CSV completo: primeira linha = cabeçalho, demais = linhas de dados.
 * Retorna { headers, rows } com headers em minúsculas normalizados e rows como array de arrays.
 */
export function parseCsvText(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, ""));
  const rows: string[][] = [];
  for (let i = 1; i < lines.length; i++) {
    rows.push(parseCsvLine(lines[i]));
  }
  return { headers, rows };
}
