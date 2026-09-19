import { NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { getOptionalOwner } from "@/lib/cc/auth/dal";
import { getLeadPhotoById } from "@/lib/cc/db/leads";
import { QUOTE_BLOB_PREFIX } from "@/lib/quote-limits";

export const runtime = "nodejs";

/**
 * Owner-only private photo stream for Command Center.
 * Does not create a public URL; requires authenticated session.
 * Uses getOptionalOwner so password_version invalidation matches requireOwner.
 */
export async function GET(_request, context) {
  const session = await getOptionalOwner();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { photoId } = await context.params;
  if (!photoId || typeof photoId !== "string") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  let photo;
  try {
    photo = await getLeadPhotoById(photoId);
  } catch {
    return NextResponse.json({ error: "Unable to load photo." }, { status: 500 });
  }

  if (!photo) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  if (
    !photo.blob_pathname?.startsWith(QUOTE_BLOB_PREFIX) ||
    photo.blob_pathname.includes("..")
  ) {
    return NextResponse.json({ error: "Invalid photo." }, { status: 400 });
  }

  try {
    const result = await get(photo.blob_pathname, { access: "private" });
    if (!result || result.statusCode !== 200 || !result.stream) {
      return NextResponse.json({ error: "Photo not found." }, { status: 404 });
    }

    return new NextResponse(result.stream, {
      headers: {
        "Content-Type": photo.content_type || result.blob.contentType || "application/octet-stream",
        "Content-Disposition": "inline",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    console.error("[cc/lead-photos] fetch failed");
    return NextResponse.json({ error: "Unable to load photo." }, { status: 500 });
  }
}
