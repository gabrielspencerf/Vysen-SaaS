/**
 * POST /api/dashboard/contacts/import — importa contatos a partir de um CSV (multipart/form-data, campo "file").
 * Resposta: { created, skipped, errors: { line, message }[] }
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import {
  importContactsFromCsv,
  type CsvContactRow,
} from "@/server/dashboard";
import { parseCsvText } from "@/lib/csv";

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB
const MAX_ROWS = 2000;

function rowToCsvContact(headers: string[], values: string[]): CsvContactRow {
  const row: Record<string, string> = {};
  headers.forEach((h, i) => {
    row[h] = values[i] ?? "";
  });
  return {
    nome: row.nome ?? row.name,
    email: row.email,
    telefone: row.telefone ?? row.phone,
    origem: row.origem ?? row.source,
    observacoes: row.observacoes ?? row.observations,
  };
}

export async function POST(request: NextRequest) {
  let session;
  try {
    session = await requireAuth(request);
  } catch (err) {
    const e = err as Error & { status?: number };
    return NextResponse.json(
      { error: "Não autenticado" },
      { status: e.status ?? 401 }
    );
  }

  const tenantId = session.session.currentTenantId;
  if (!tenantId) {
    return NextResponse.json(
      { error: "Tenant não selecionado" },
      { status: 400 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Corpo da requisição inválido. Envie um arquivo CSV no campo 'file'." },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { error: "Nenhum arquivo enviado. Use o campo 'file' com um CSV." },
      { status: 400 }
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: `Arquivo muito grande. Máximo ${MAX_FILE_SIZE / 1024 / 1024} MB.` },
      { status: 400 }
    );
  }

  let text: string;
  try {
    text = await file.text();
  } catch {
    return NextResponse.json(
      { error: "Não foi possível ler o arquivo. Use encoding UTF-8." },
      { status: 400 }
    );
  }

  const { headers, rows } = parseCsvText(text);
  if (rows.length > MAX_ROWS) {
    return NextResponse.json(
      { error: `Máximo de ${MAX_ROWS} linhas por importação.` },
      { status: 400 }
    );
  }

  const csvRows: CsvContactRow[] = rows.map((values) =>
    rowToCsvContact(headers, values)
  );
  const result = await importContactsFromCsv(tenantId, csvRows);

  return NextResponse.json(result);
}
