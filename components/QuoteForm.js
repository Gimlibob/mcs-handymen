"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Upload, X, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import {
  SERVICE_CITIES,
  PROPERTY_TYPES,
  SERVICES,
  CONTACT_METHODS,
  BUDGET_RANGES,
  FORM_ENDPOINT,
  BACKUP_EMAIL,
  MAILTO_HREF,
} from "@/lib/site-config";
import {
  SERVICE_INQUIRY_EVENT,
  SERVICE_INQUIRY_STORAGE_KEY,
  inquiryDescription,
} from "@/lib/service-inquiry";

const MAX_FILES = 6;
const MAX_FILE_SIZE_MB = 8;
const MAX_TOTAL_SIZE_MB = 20;
const ACCEPTED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/heic", "image/heif"];

const initialFields = {
  fullName: "",
  email: "",
  city: "",
  propertyType: "",
  projectType: "",
  description: "",
  contactMethod: "",
  preferredDate: "",
  budgetRange: "",
};

function formatBytes(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function QuoteForm() {
  const [fields, setFields] = useState(initialFields);
  const [files, setFiles] = useState([]);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState("idle"); // idle | submitting | success | error
  const fileInputRef = useRef(null);
  const formId = useId();

  // Prefill from service-card clicks (smooth-scrolled to this form)
  useEffect(() => {
    function applyServiceInquiry(serviceName) {
      if (!serviceName) return;
      const known = SERVICES.some((s) => s.name === serviceName);
      if (!known) return;

      setStatus("idle");
      setErrors({});
      setFields((prev) => ({
        ...prev,
        projectType: serviceName,
        description: inquiryDescription(serviceName),
      }));
    }

    function onInquiry(event) {
      applyServiceInquiry(event.detail?.serviceName);
    }

    window.addEventListener(SERVICE_INQUIRY_EVENT, onInquiry);

    try {
      const stored = window.sessionStorage.getItem(SERVICE_INQUIRY_STORAGE_KEY);
      if (stored) applyServiceInquiry(stored);
    } catch {
      // ignore
    }

    return () => window.removeEventListener(SERVICE_INQUIRY_EVENT, onInquiry);
  }, []);

  function updateField(name, value) {
    setFields((prev) => ({ ...prev, [name]: value }));
  }

  function handleFileChange(e) {
    const incoming = Array.from(e.target.files || []);
    if (incoming.length === 0) return;

    const combined = [...files, ...incoming];
    const fileErrors = [];

    if (combined.length > MAX_FILES) {
      fileErrors.push(`You can upload up to ${MAX_FILES} photos.`);
    }

    const invalidType = combined.find(
      (f) => f.type && !ACCEPTED_TYPES.includes(f.type) && !/\.heic$/i.test(f.name)
    );
    if (invalidType) {
      fileErrors.push("Only JPG, PNG, and HEIC photos are allowed.");
    }

    const tooBig = combined.find((f) => f.size > MAX_FILE_SIZE_MB * 1024 * 1024);
    if (tooBig) {
      fileErrors.push(`Each photo must be under ${MAX_FILE_SIZE_MB} MB.`);
    }

    const totalSize = combined.reduce((sum, f) => sum + f.size, 0);
    if (totalSize > MAX_TOTAL_SIZE_MB * 1024 * 1024) {
      fileErrors.push(`Total photo size must be under ${MAX_TOTAL_SIZE_MB} MB.`);
    }

    if (fileErrors.length > 0) {
      setErrors((prev) => ({ ...prev, photos: fileErrors[0] }));
    } else {
      setErrors((prev) => ({ ...prev, photos: undefined }));
      setFiles(combined.slice(0, MAX_FILES));
    }

    // Allow re-selecting the same file after removal.
    e.target.value = "";
  }

  function removeFile(index) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function validate() {
    const next = {};
    if (fields.fullName.trim().length < 2) next.fullName = "Please enter your full name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email))
      next.email = "Please enter a valid email address.";
    if (!fields.city) next.city = "Please select your city.";
    if (!fields.propertyType) next.propertyType = "Please select a property type.";
    if (!fields.projectType) next.projectType = "Please select a project type.";
    if (fields.description.trim().length < 10)
      next.description = "Please describe the project (at least 10 characters).";
    if (files.length === 0) next.photos = "Please upload at least one photo.";
    if (!fields.contactMethod) next.contactMethod = "Please choose a preferred contact method.";
    return next;
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const validationErrors = validate();
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    if (!FORM_ENDPOINT) {
      // Form backend not configured yet — see README.md.
      setStatus("error");
      return;
    }

    setStatus("submitting");

    try {
      const payload = new FormData();
      payload.append("fullName", fields.fullName);
      payload.append("email", fields.email);
      payload.append("city", fields.city);
      payload.append("propertyType", fields.propertyType);
      payload.append("projectType", fields.projectType);
      payload.append("description", fields.description);
      payload.append("contactMethod", fields.contactMethod);
      if (fields.preferredDate) payload.append("preferredDate", fields.preferredDate);
      if (fields.budgetRange) payload.append("budgetRange", fields.budgetRange);
      files.forEach((file) => payload.append("photos", file, file.name));

      const response = await fetch(FORM_ENDPOINT, {
        method: "POST",
        headers: { Accept: "application/json" },
        body: payload,
      });

      if (!response.ok) throw new Error("Submission failed");

      setStatus("success");
      setFields(initialFields);
      setFiles([]);
      setErrors({});
    } catch {
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div
        role="status"
        className="flex flex-col items-center gap-3 rounded-xl border border-gold bg-surface p-8 text-center"
      >
        <CheckCircle2 className="h-10 w-10 text-gold-bright" aria-hidden="true" />
        <h3 className="font-heading text-xl font-bold text-foreground">Thank you!</h3>
        <p className="text-sm text-muted">
          Your project request has been received. We&apos;ll review your photos and contact you
          soon.
        </p>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className="mt-2 text-sm font-medium text-gold-bright underline underline-offset-2"
        >
          Submit another request
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      {status === "error" && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-red-500/40 bg-red-950/30 p-4 text-sm text-red-200"
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <p>
            Sorry, we couldn&apos;t send your request right now. Please email your project
            description and photos directly to{" "}
            <a href={MAILTO_HREF} className="font-semibold underline">
              {BACKUP_EMAIL}
            </a>
            .
          </p>
        </div>
      )}

      <Field
        id={`${formId}-fullName`}
        label="Full Name"
        required
        error={errors.fullName}
      >
        <input
          id={`${formId}-fullName`}
          name="fullName"
          type="text"
          autoComplete="name"
          value={fields.fullName}
          onChange={(e) => updateField("fullName", e.target.value)}
          aria-invalid={!!errors.fullName}
          aria-describedby={errors.fullName ? `${formId}-fullName-error` : undefined}
          className={inputClass(errors.fullName)}
        />
      </Field>

      <Field id={`${formId}-email`} label="Email Address" required error={errors.email}>
        <input
          id={`${formId}-email`}
          name="email"
          type="email"
          autoComplete="email"
          value={fields.email}
          onChange={(e) => updateField("email", e.target.value)}
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? `${formId}-email-error` : undefined}
          className={inputClass(errors.email)}
        />
      </Field>

      <Field id={`${formId}-city`} label="City" required error={errors.city}>
        <select
          id={`${formId}-city`}
          name="city"
          value={fields.city}
          onChange={(e) => updateField("city", e.target.value)}
          aria-invalid={!!errors.city}
          aria-describedby={errors.city ? `${formId}-city-error` : undefined}
          className={inputClass(errors.city)}
        >
          <option value="">Select your city&hellip;</option>
          {SERVICE_CITIES.map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </select>
      </Field>

      <Field
        id={`${formId}-propertyType`}
        label="Property Type"
        required
        error={errors.propertyType}
      >
        <select
          id={`${formId}-propertyType`}
          name="propertyType"
          value={fields.propertyType}
          onChange={(e) => updateField("propertyType", e.target.value)}
          aria-invalid={!!errors.propertyType}
          aria-describedby={errors.propertyType ? `${formId}-propertyType-error` : undefined}
          className={inputClass(errors.propertyType)}
        >
          <option value="">Select property type&hellip;</option>
          {PROPERTY_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </Field>

      <Field id={`${formId}-projectType`} label="Project Type" required error={errors.projectType}>
        <select
          id={`${formId}-projectType`}
          name="projectType"
          value={fields.projectType}
          onChange={(e) => updateField("projectType", e.target.value)}
          aria-invalid={!!errors.projectType}
          aria-describedby={errors.projectType ? `${formId}-projectType-error` : undefined}
          className={inputClass(errors.projectType)}
        >
          <option value="">Select a service&hellip;</option>
          {SERVICES.map((service) => (
            <option key={service.id} value={service.name}>
              {service.name}
            </option>
          ))}
          <option value="Other">Other</option>
        </select>
      </Field>

      <Field
        id={`${formId}-description`}
        label="Project Description"
        required
        error={errors.description}
      >
        <textarea
          id={`${formId}-description`}
          name="description"
          rows={4}
          value={fields.description}
          onChange={(e) => updateField("description", e.target.value)}
          aria-invalid={!!errors.description}
          aria-describedby={errors.description ? `${formId}-description-error` : undefined}
          className={inputClass(errors.description)}
          placeholder="Tell us what needs to be done, where it's located, and any details that help."
        />
      </Field>

      <Field
        id={`${formId}-photos`}
        label="Photo Upload"
        required
        error={errors.photos}
        hint={`JPG, PNG, or HEIC. Up to ${MAX_FILES} photos, ${MAX_FILE_SIZE_MB} MB each.`}
      >
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex w-full min-h-[52px] items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border-soft bg-surface-2 px-4 text-sm font-medium text-gold-bright transition-colors hover:border-gold"
        >
          <Upload className="h-5 w-5" aria-hidden="true" />
          Add Photos
        </button>
        <input
          ref={fileInputRef}
          id={`${formId}-photos`}
          type="file"
          multiple
          accept="image/jpeg,image/jpg,image/png,image/heic,image/heif,.heic"
          onChange={handleFileChange}
          aria-invalid={!!errors.photos}
          aria-describedby={errors.photos ? `${formId}-photos-error` : undefined}
          className="sr-only"
        />

        {files.length > 0 && (
          <ul className="mt-3 flex flex-col gap-2">
            {files.map((file, index) => (
              <li
                key={`${file.name}-${index}`}
                className="flex items-center justify-between gap-3 rounded-lg bg-surface-2 px-3 py-2 text-sm text-foreground"
              >
                <span className="truncate">
                  {file.name} <span className="text-muted">({formatBytes(file.size)})</span>
                </span>
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  aria-label={`Remove ${file.name}`}
                  className="shrink-0 rounded-full p-1 text-muted hover:text-gold-bright"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Field>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-foreground">
          Preferred Contact Method <span className="text-gold-bright">*</span>
        </legend>
        <div className="flex gap-4">
          {CONTACT_METHODS.map((method) => (
            <label
              key={method}
              className="flex items-center gap-2 rounded-lg border border-border-soft bg-surface px-4 py-3 text-sm text-foreground"
            >
              <input
                type="radio"
                name="contactMethod"
                value={method}
                checked={fields.contactMethod === method}
                onChange={(e) => updateField("contactMethod", e.target.value)}
                className="h-4 w-4 accent-gold"
              />
              {method}
            </label>
          ))}
        </div>
        {errors.contactMethod && (
          <p className="mt-2 text-sm text-red-300">{errors.contactMethod}</p>
        )}
      </fieldset>

      <Field id={`${formId}-preferredDate`} label="Preferred Date" optional>
        <input
          id={`${formId}-preferredDate`}
          name="preferredDate"
          type="date"
          value={fields.preferredDate}
          onChange={(e) => updateField("preferredDate", e.target.value)}
          className={inputClass()}
        />
      </Field>

      <Field id={`${formId}-budgetRange`} label="Budget Range" optional>
        <select
          id={`${formId}-budgetRange`}
          name="budgetRange"
          value={fields.budgetRange}
          onChange={(e) => updateField("budgetRange", e.target.value)}
          className={inputClass()}
        >
          <option value="">Select a range&hellip;</option>
          {BUDGET_RANGES.map((range) => (
            <option key={range} value={range}>
              {range}
            </option>
          ))}
        </select>
      </Field>

      <button
        type="submit"
        disabled={status === "submitting"}
        className="mt-2 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-gold px-6 text-base font-semibold text-black transition-colors hover:bg-gold-bright disabled:cursor-not-allowed disabled:opacity-70"
      >
        {status === "submitting" && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
        Send My Project Request
      </button>
    </form>
  );
}

function Field({ id, label, required, optional, error, hint, children }) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-medium text-foreground">
        {label}{" "}
        {required && <span className="text-gold-bright">*</span>}
        {optional && <span className="text-muted">(optional)</span>}
      </label>
      {children}
      {hint && !error && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-sm text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}

function inputClass(error) {
  return `w-full rounded-lg border bg-surface px-4 py-3 text-base text-foreground placeholder:text-muted/60 focus:border-gold ${
    error ? "border-red-500/60" : "border-border-soft"
  }`;
}
