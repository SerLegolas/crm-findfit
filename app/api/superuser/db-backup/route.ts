import { NextResponse } from "next/server";
import { requireSuperUser } from "@/lib/auth";
import { client } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/superuser/db-backup — export JSON con tutti i dati di tutte le tabelle (file scaricabile datato)
export async function GET() {
  try {
    await requireSuperUser();

    const tablesRes = await client.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    );
    const tableNames = tablesRes.rows.map((r) => String(r.name));

    const data: Record<string, unknown[]> = {};
    await Promise.all(
      tableNames.map(async (name) => {
        const res = await client.execute(`SELECT * FROM "${name}"`);
        data[name] = res.rows as unknown[];
      })
    );

    const now = new Date();
    const payload = {
      app: "CRM FindFit",
      exportedAt: now.toISOString(),
      tables: data,
    };

    const pad = (n: number) => String(n).padStart(2, "0");
    const filename = `crm-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
      now.getDate()
    )}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}.json`;

    return new NextResponse(JSON.stringify(payload, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }
    console.error("Error creating db backup:", error);
    return NextResponse.json(
      { error: "Errore nella creazione del backup" },
      { status: 500 }
    );
  }
}
