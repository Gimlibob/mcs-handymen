/** Shared quote-form upload limits and allowed image types. */

export const MAX_QUOTE_PHOTOS = 6;
export const MAX_PHOTO_SIZE_MB = 8;
export const MAX_PHOTO_SIZE_BYTES = MAX_PHOTO_SIZE_MB * 1024 * 1024;
export const MAX_TOTAL_PHOTO_SIZE_MB = 20;
export const MAX_TOTAL_PHOTO_SIZE_BYTES = MAX_TOTAL_PHOTO_SIZE_MB * 1024 * 1024;

export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/heic",
  "image/heif",
];

export const QUOTE_BLOB_PREFIX = "quote-requests/";

export function isAllowedImageType(type, fileName = "") {
  if (type && ACCEPTED_IMAGE_TYPES.includes(type)) return true;
  return /\.(jpe?g|png|heic|heif)$/i.test(fileName);
}

export function sanitizeUploadFileName(name) {
  const cleaned = String(name || "photo")
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .slice(0, 80);
  return cleaned || "photo.jpg";
}

export function guessImageContentType(file) {
  if (file?.type && ACCEPTED_IMAGE_TYPES.includes(file.type)) return file.type;
  const name = file?.name || "";
  if (/\.png$/i.test(name)) return "image/png";
  if (/\.heic$/i.test(name)) return "image/heic";
  if (/\.heif$/i.test(name)) return "image/heif";
  if (/\.jpe?g$/i.test(name)) return "image/jpeg";
  return file?.type || "image/jpeg";
}
