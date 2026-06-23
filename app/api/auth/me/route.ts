import { NextResponse } from "next/server";
import { getAuthUser, destroySession } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ user: null });
    }
    return NextResponse.json({ user });
  } catch (error) {
    console.error("Me error:", error);
    return NextResponse.json({ user: null });
  }
}

export async function DELETE() {
  await destroySession();
  return NextResponse.json({ success: true });
}
