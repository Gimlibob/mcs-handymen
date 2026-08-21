import { NextResponse } from "next/server";
import { handleUpload } from "@vercel/blob/client";
import {
  ACCEPTED_IMAGE_TYPES,
  MAX_PHOTO_SIZE_BYTES,
  QUOTE_BLOB_PREFIX,
} from "@/lib/quote-limits";

export const runtime = "nodejs";

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (
          typeof pathname !== "string" ||
          !pathname.startsWith(QUOTE_BLOB_PREFIX) ||
          pathname.includes("..") ||
          pathname.length > 240
        ) {
          throw new Error("Invalid upload pathname.");
        }

        return {
          allowedContentTypes: ACCEPTED_IMAGE_TYPES,
          maximumSizeInBytes: MAX_PHOTO_SIZE_BYTES,
          addRandomSuffix: true,
          allowOverwrite: false,
          validUntil: Date.now() + 60 * 60 * 1000,
        };
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error("[blob/upload] token issue failed");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload authorization failed." },
      { status: 400 }
    );
  }
}
