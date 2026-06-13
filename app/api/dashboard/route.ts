import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clients, tasks } from "@/lib/schema";
import { eq, sql, lte, desc, and, gte } from "drizzle-orm";

const priorityOrder = sql`CASE ${tasks.priority}
  WHEN 'high' THEN 1
  WHEN 'medium' THEN 2
  WHEN 'low' THEN 3
END`;

export const dynamic = "force-dynamic";

export async function GET() {
  console.log("[Dashboard API] Chiamata ricevuta");
  console.log("[Dashboard API] TURSO_DB_URL presente:", !!process.env.TURSO_DB_URL);
  console.log("[Dashboard API] TURSO_AUTH_TOKEN presente:", !!process.env.TURSO_AUTH_TOKEN);

  try {
    if (!process.env.TURSO_DB_URL) {
      console.error("[Dashboard API] TURSO_DB_URL mancante");
      return NextResponse.json(
        { error: "Database Turso non configurato. Imposta TURSO_DB_URL e TURSO_AUTH_TOKEN in .env.local" },
        { status: 500 }
      );
    }

    const now = new Date();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    // Count per status
    const statusCounts = await db
      .select({
        status: clients.status,
        count: sql<number>`count(*)`,
      })
      .from(clients)
      .groupBy(clients.status);

    const statusMap: Record<string, number> = {
      lead: 0,
      suspect: 0,
      won: 0,
      closed_lost: 0,
    };
    statusCounts.forEach((s) => {
      statusMap[s.status] = Number(s.count);
    });

    // Overdue tasks banner count
    const overdueCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(tasks)
      .where(
        and(
          lte(tasks.dueDate, now),
          sql`${tasks.status} IN ('todo', 'in_progress')`
        )
      );

    // Top 10 overdue tasks (due before today, not completed), ordered by priority
    const overdueTodayTasks = await db
      .select({
        id: tasks.id,
        title: tasks.title,
        priority: tasks.priority,
        dueDate: tasks.dueDate,
        clientId: tasks.clientId,
        clientName: clients.name,
        clientPhone: clients.phone,
      })
      .from(tasks)
      .leftJoin(clients, eq(tasks.clientId, clients.id))
      .where(
        and(
          lte(tasks.dueDate, startOfToday),
          sql`${tasks.status} IN ('todo', 'in_progress')`
        )
      )
      .orderBy(priorityOrder, desc(tasks.dueDate))
      .limit(10);

    // Top 10 tasks due today (not yet overdue), ordered by priority
    const dueTodayTasks = await db
      .select({
        id: tasks.id,
        title: tasks.title,
        priority: tasks.priority,
        dueDate: tasks.dueDate,
        clientId: tasks.clientId,
        clientName: clients.name,
        clientPhone: clients.phone,
      })
      .from(tasks)
      .leftJoin(clients, eq(tasks.clientId, clients.id))
      .where(
        and(
          gte(tasks.dueDate, startOfToday),
          lte(tasks.dueDate, endOfToday),
          sql`${tasks.status} IN ('todo', 'in_progress')`
        )
      )
      .orderBy(priorityOrder, desc(tasks.dueDate))
      .limit(10);

    // Trend: clients created in last 7 days
    const trendData = [];
    for (let i = 6; i >= 0; i--) {
      const day = new Date();
      day.setDate(day.getDate() - i);
      const dayStart = new Date(day);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(day);
      dayEnd.setHours(23, 59, 59, 999);

      const [countResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(clients)
        .where(
          and(gte(clients.createdAt, dayStart), lte(clients.createdAt, dayEnd))
        );

      trendData.push({
        date: day.toLocaleDateString("it-IT", {
          day: "2-digit",
          month: "2-digit",
        }),
        count: Number(countResult?.count || 0),
      });
    }

    return NextResponse.json({
      statusCounts: statusMap,
      overdueCount: Number(overdueCount[0]?.count || 0),
      overdueTasks: overdueTodayTasks.map((t) => ({
        ...t,
        dueDate: t.dueDate ? t.dueDate.getTime() : null,
      })),
      dueTodayTasks: dueTodayTasks.map((t) => ({
        ...t,
        dueDate: t.dueDate ? t.dueDate.getTime() : null,
      })),
      trendData,
    });
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    return NextResponse.json(
      { error: "Errore nel caricamento della dashboard" },
      { status: 500 }
    );
  }
}
