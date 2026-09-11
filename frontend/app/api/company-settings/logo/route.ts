import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ error: "Logo non disponibile" }, { status: 404 });
}

export async function PATCH() {
  return NextResponse.json({ error: "Logo non disponibile" }, { status: 404 });
}
