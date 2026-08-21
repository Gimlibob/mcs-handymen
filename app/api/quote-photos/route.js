import { NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { verifyPrivatePhotoAccessToken } from "@/lib/quote-photo-access";

export const runtime = "nodejs";

export async function GET(request) {
  const token = request.nextUrl.searchParams.get("t");
  const pathname = verifyPrivatePhotoAccessToken(token);

  if (!pathname) {
    return NextResponse.json({ error: "Invalid or expired photo link." }, { status: 401 });
  }

  try {
    const result = await get(pathname, { access: "private" });

    if (!result || result.statusCode !== 200 || !result.stream) {
      return NextResponse.json({ error: "Photo not found." }, { status: 404 });
    }

    return new NextResponse(result.stream, {
      headers: {
        "Content-Type": result.blob.contentType || "application/octet-stream",
        "Content-Disposition": "inline",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[quote-photos] fetch failed");
    return NextResponse.json({ error: "Unable to load photo." }, { status: 500 });
  }
}
