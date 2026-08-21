import { NextResponse } from "next/server";
import { head } from "@vercel/blob";
import { Resend } from "resend";
import {
  BACKUP_EMAIL,
  CONTACT_METHODS,
  PROPERTY_TYPES,
  SERVICE_CITIES,
  SERVICES,
  SITE_NAME,
} from "@/lib/site-config";
import {
  ACCEPTED_IMAGE_TYPES,
  isAllowedImageType,
  MAX_QUOTE_PHOTOS,
  MAX_PHOTO_SIZE_BYTES,
  MAX_TOTAL_PHOTO_SIZE_BYTES,
  QUOTE_BLOB_PREFIX,
} from "@/lib/quote-limits";
import { createPrivatePhotoAccessUrl } from "@/lib/quote-photo-access";

export const runtime = "nodejs";
export const maxDuration = 60;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const serviceNames = new Set(SERVICES.map((s) => s.name));

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function trimField(value, max) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function jsonError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function validatePayload(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "Malformed submission." };
  }

  const fullName = trimField(body.fullName, 120);
  const email = trimField(body.email, 200).toLowerCase();
  const city = trimField(body.city, 80);
  const citySelection = trimField(body.citySelection, 40);
  const propertyType = trimField(body.propertyType, 80);
  const projectType = trimField(body.projectType, 120);
  const projectTypeSelection = trimField(body.projectTypeSelection, 40);
  const description = trimField(body.description, 5000);
  const contactMethod = trimField(body.contactMethod, 40);
  const preferredDate = trimField(body.preferredDate, 40);
  const photos = Array.isArray(body.photos) ? body.photos : null;

  if (fullName.length < 2) return { error: "Please enter your full name." };
  if (!EMAIL_RE.test(email)) return { error: "Please enter a valid email address." };

  if (citySelection === "Other") {
    if (city.length < 2) return { error: "Please enter your city name." };
  } else if (!SERVICE_CITIES.includes(city) || city === "Other") {
    return { error: "Please select your city." };
  }

  if (!PROPERTY_TYPES.includes(propertyType)) {
    return { error: "Please select a property type." };
  }

  if (projectTypeSelection === "Other") {
    if (projectType.length < 2) return { error: "Please enter your custom service or task." };
  } else if (!serviceNames.has(projectType)) {
    return { error: "Please select a project type." };
  }

  if (description.length < 10) {
    return { error: "Please describe the project (at least 10 characters)." };
  }

  if (!CONTACT_METHODS.includes(contactMethod)) {
    return { error: "Please choose a preferred contact method." };
  }

  if (preferredDate && !/^\d{4}-\d{2}-\d{2}$/.test(preferredDate)) {
    return { error: "Preferred date format is invalid." };
  }

  if (!photos || photos.length === 0) {
    return { error: "Please upload at least one photo." };
  }
  if (photos.length > MAX_QUOTE_PHOTOS) {
    return { error: `You can upload up to ${MAX_QUOTE_PHOTOS} photos.` };
  }

  const normalizedPhotos = [];
  let totalSize = 0;

  for (const photo of photos) {
    if (!photo || typeof photo !== "object") {
      return { error: "Invalid photo metadata." };
    }

    const pathname = trimField(photo.pathname, 240);
    const contentType = trimField(photo.contentType, 80);
    const size = Number(photo.size);

    if (
      !pathname.startsWith(QUOTE_BLOB_PREFIX) ||
      pathname.includes("..") ||
      pathname.includes("//")
    ) {
      return { error: "Invalid photo reference." };
    }

    if (!isAllowedImageType(contentType, pathname)) {
      return { error: "Only JPG, PNG, and HEIC photos are allowed." };
    }

    if (!Number.isFinite(size) || size <= 0 || size > MAX_PHOTO_SIZE_BYTES) {
      return { error: `Each photo must be under ${MAX_PHOTO_SIZE_BYTES / (1024 * 1024)} MB.` };
    }

    totalSize += size;
    normalizedPhotos.push({ pathname, contentType, size });
  }

  if (totalSize > MAX_TOTAL_PHOTO_SIZE_BYTES) {
    return {
      error: `Total photo size must be under ${MAX_TOTAL_PHOTO_SIZE_BYTES / (1024 * 1024)} MB.`,
    };
  }

  return {
    data: {
      fullName,
      email,
      city,
      propertyType,
      projectType,
      description,
      contactMethod,
      preferredDate,
      photos: normalizedPhotos,
    },
  };
}

async function assertPrivatePhotosExist(photos) {
  for (const photo of photos) {
    const meta = await head(photo.pathname);
    if (!meta) {
      throw new Error("Uploaded photo could not be verified.");
    }
    if (meta.size > MAX_PHOTO_SIZE_BYTES) {
      throw new Error("Uploaded photo exceeds size limit.");
    }
    if (meta.contentType && !ACCEPTED_IMAGE_TYPES.includes(meta.contentType)) {
      // HEIC may be stored with a vendor content-type; pathname extension already validated.
      if (!isAllowedImageType(meta.contentType, photo.pathname)) {
        throw new Error("Uploaded file type is not allowed.");
      }
    }
  }
}

function buildEmailContent(data, photoLinks) {
  const lines = [
    `New quote request from ${SITE_NAME}`,
    "",
    `Name: ${data.fullName}`,
    `Email: ${data.email}`,
    `City: ${data.city}`,
    `Property type: ${data.propertyType}`,
    `Project type: ${data.projectType}`,
    `Preferred contact: ${data.contactMethod}`,
    `Preferred date: ${data.preferredDate || "Not specified"}`,
    "",
    "Project description:",
    data.description,
    "",
    "Private photo links (expire in 14 days):",
    ...photoLinks.map((link, i) => `${i + 1}. ${link}`),
  ];

  const text = lines.join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111;">
      <h2 style="margin: 0 0 16px;">New quote request</h2>
      <p><strong>Name:</strong> ${escapeHtml(data.fullName)}</p>
      <p><strong>Email:</strong> ${escapeHtml(data.email)}</p>
      <p><strong>City:</strong> ${escapeHtml(data.city)}</p>
      <p><strong>Property type:</strong> ${escapeHtml(data.propertyType)}</p>
      <p><strong>Project type:</strong> ${escapeHtml(data.projectType)}</p>
      <p><strong>Preferred contact:</strong> ${escapeHtml(data.contactMethod)}</p>
      <p><strong>Preferred date:</strong> ${escapeHtml(data.preferredDate || "Not specified")}</p>
      <p><strong>Project description:</strong></p>
      <p style="white-space: pre-wrap;">${escapeHtml(data.description)}</p>
      <p><strong>Private photo links</strong> (expire in 14 days):</p>
      <ol>
        ${photoLinks
          .map((link, i) => `<li><a href="${escapeHtml(link)}">View photo ${i + 1}</a></li>`)
          .join("")}
      </ol>
      <p style="color:#666;font-size:12px;">These links are temporary and are not public gallery URLs.</p>
    </div>
  `;

  return { text, html };
}

export async function POST(request) {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return jsonError("Unsupported content type.", 415);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError("Malformed submission.");
  }

  const validated = validatePayload(body);
  if (validated.error) return jsonError(validated.error);

  const { data } = validated;

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error("[quote] BLOB_READ_WRITE_TOKEN is not configured");
    return jsonError("Quote service is temporarily unavailable.", 503);
  }

  if (!process.env.RESEND_API_KEY) {
    console.error("[quote] RESEND_API_KEY is not configured");
    return jsonError("Quote service is temporarily unavailable.", 503);
  }

  try {
    await assertPrivatePhotosExist(data.photos);

    const photoLinks = data.photos.map((photo) =>
      createPrivatePhotoAccessUrl(photo.pathname)
    );

    const fromAddress =
      process.env.RESEND_FROM?.trim() || `MCS Handymen <${BACKUP_EMAIL}>`;
    const toAddress = process.env.QUOTE_NOTIFY_TO?.trim() || BACKUP_EMAIL;
    const { text, html } = buildEmailContent(data, photoLinks);

    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: fromAddress,
      to: [toAddress],
      replyTo: data.email,
      subject: `New Quote Request – ${data.fullName} – ${data.city}`,
      text,
      html,
    });

    if (error) {
      console.error("[quote] Resend send failed");
      return jsonError("Unable to send notification email.", 502);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[quote] submission failed");
    return jsonError("Unable to process quote request.", 500);
  }
}
