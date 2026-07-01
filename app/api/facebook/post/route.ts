import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }
    if (authUser.role !== "admin") {
      return NextResponse.json({ error: "Accesso negato" }, { status: 403 });
    }

    const body = await request.json();
    const { content, mediaUrl, tags } = body;

    if (!content || !content.trim()) {
      return NextResponse.json(
        { error: "Il contenuto del post è obbligatorio" },
        { status: 400 }
      );
    }

    // TODO: integrazione con Facebook Graph API
    // Al momento simuliamo la pubblicazione con successo
    console.log("[FACEBOOK-POST] Post ricevuto:", {
      content,
      mediaUrl: mediaUrl || null,
      tags: tags || [],
      author: authUser.name,
    });

    return NextResponse.json({
      success: true,
      message: "Post pubblicato con successo su Facebook (simulazione)",
      post: {
        id: `fb_${Date.now()}`,
        content,
        mediaUrl: mediaUrl || null,
        tags: tags || [],
        publishedAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error("[FACEBOOK-POST] Error:", error);
    return NextResponse.json(
      { error: error.message || "Errore interno" },
      { status: 500 }
    );
  }
}
