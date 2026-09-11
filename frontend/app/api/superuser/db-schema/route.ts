import { NextResponse } from "next/server";
import { requireSuperUser } from "@/lib/auth";
import { client } from "@/lib/db";

export const dynamic = "force-dynamic";

interface ColumnInfo {
  name: string;
  type: string;
  notNull: number;
  pk: number;
  defaultValue: unknown;
}

interface TableInfo {
  name: string;
  count: number;
  columns: ColumnInfo[];
}

// GET /api/superuser/db-schema — elenco tabelle con conteggio record e colonne (PRAGMA table_info)
export async function GET() {
  try {
    await requireSuperUser();

    const tablesRes = await client.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    );
    const tableNames = tablesRes.rows.map((r) => String(r.name));

    const tables: TableInfo[] = await Promise.all(
      tableNames.map(async (name) => {
        const [countRes, colRes] = await Promise.all([
          client.execute(`SELECT COUNT(*) AS n FROM "${name}"`),
          client.execute(`PRAGMA table_info("${name}")`),
        ]);
        const count = Number(countRes.rows[0]?.n ?? 0);
        const columns: ColumnInfo[] = colRes.rows.map((r) => ({
          name: String(r.name),
          type: String(r.type),
          notNull: Number(r.notnull ?? 0),
          pk: Number(r.pk ?? 0),
          defaultValue: r.dflt_value ?? null,
        }));
        return { name, count, columns };
      })
    );

    const totalRecords = tables.reduce((sum, t) => sum + t.count, 0);

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      totalRecords,
      tables,
    });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }
    console.error("Error fetching db schema:", error);
    return NextResponse.json(
      { error: "Errore nel caricamento dello schema" },
      { status: 500 }
    );
  }
}
