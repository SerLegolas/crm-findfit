import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tasks, clients } from "@/lib/schema";
import { taskSchema } from "@/types";
import { eq, desc, and, lte, gte, or, sql } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "";
    const clientId = searchParams.get("clientId") || "";
    const upcomingDays = parseInt(searchParams.get("upcomingDays") || "7");

    const conditions = [];

    if (status) {
      conditions.push(eq(tasks.status, status as any));
    }

    if (clientId) {
      conditions.push(eq(tasks.clientId, clientId));
    }

    // Default: show overdue or due within upcomingDays
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + upcomingDays);

    if (!status && !clientId) {
      conditions.push(
        or(
          and(
            lte(tasks.dueDate, futureDate),
            sql`${tasks.status} IN ('todo', 'in_progress')`
          ),
          eq(tasks.status, "todo"),
          eq(tasks.status, "in_progress")
        )
      );
    }

    const data = await db
      .select({
        id: tasks.id,
        title: tasks.title,
        description: tasks.description,
        dueDate: tasks.dueDate,
        status: tasks.status,
        priority: tasks.priority,
        completedAt: tasks.completedAt,
        clientId: tasks.clientId,
        createdAt: tasks.createdAt,
        updatedAt: tasks.updatedAt,
        clientName: clients.name,
      })
      .from(tasks)
      .leftJoin(clients, eq(tasks.clientId, clients.id))
      .where(
        conditions.length > 0 ? and(...conditions) : undefined
      )
      .orderBy(desc(tasks.priority), desc(tasks.dueDate));

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching tasks:", error);
    return NextResponse.json(
      { error: "Errore nel caricamento dei task" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = taskSchema.parse(body);

    const [task] = await db
      .insert(tasks)
      .values({
        clientId: body.clientId,
        title: parsed.title,
        description: parsed.description || null,
        dueDate: parsed.dueDate ? new Date(parsed.dueDate) : null,
        status: parsed.status,
        priority: parsed.priority,
      })
      .returning();

    return NextResponse.json(task, { status: 201 });
  } catch (error: any) {
    if (error?.issues) {
      return NextResponse.json(
        { error: "Dati non validi", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error creating task:", error);
    return NextResponse.json(
      { error: "Errore nella creazione del task" },
      { status: 500 }
    );
  }
}
