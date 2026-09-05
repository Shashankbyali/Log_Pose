"use client";

import { useState } from "react";
import { LocationPicker } from "./LocationPicker";
import {
  EMPTY_APPLICATION,
  validateApplication,
  type SafeHavenApplicationInput,
  type ValidationErrors,
} from "@/lib/safeHavenApplication";
import { ASSISTANCE_OPTIONS, SAFE_HAVEN_TYPES } from "@/lib/types";

type BooleanField = {
  [K in keyof SafeHavenApplicationInput]: SafeHavenApplicationInput[K] extends boolean
    ? K
    : never;
}[keyof SafeHavenApplicationInput];

const FACILITY_FIELDS: Array<{ field: BooleanField; label: string }> = [
  { field: "safeRoom", label: "Private or safe room" },
  { field: "waitingArea", label: "Waiting area" },
  { field: "seating", label: "Seating" },
  { field: "restroom", label: "Restroom" },
  { field: "temporaryShelter", label: "Temporary shelter" },
  { field: "staffAssistance", label: "Staff can assist" },
];

const EMERGENCY_FIELDS: Array<{ field: BooleanField; label: string }> = [
  { field: "firstAid", label: "First aid kit" },
  { field: "cctv", label: "CCTV" },
  { field: "emergencyExit", label: "Emergency exit" },
  { field: "fireExtinguisher", label: "Fire extinguisher" },
  { field: "emergencyAlarm", label: "Emergency alarm" },
];

const ACCESSIBILITY_FIELDS: Array<{ field: BooleanField; label: string }> = [
  { field: "wheelchairAccessible", label: "Wheelchair accessible" },
  { field: "accessibleEntrance", label: "Accessible entrance" },
  { field: "accessibleRestroom", label: "Accessible restroom" },
  { field: "elevator", label: "Elevator" },
];

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="lp-card p-5">
      <h2 className="text-sm font-semibold text-white">{title}</h2>
      {description && (
        <p className="mt-1 text-xs leading-relaxed text-zinc-500">{description}</p>
      )}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="mt-1 text-xs text-orange-300" role="alert">
      {message}
    </p>
  );
}

const inputClass =
  "w-full rounded-xl border border-white/10 bg-zinc-950/60 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-teal-400/50 focus:outline-none focus:ring-2 focus:ring-teal-400/20";

const labelClass = "block text-xs font-medium text-zinc-300";

export function SafeHavenRegistrationForm() {
  const [form, setForm] = useState<SafeHavenApplicationInput>(EMPTY_APPLICATION);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const update = <K extends keyof SafeHavenApplicationInput>(
    key: K,
    value: SafeHavenApplicationInput[K],
  ) => {
    setForm((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => ({ ...previous, [key]: undefined }));
  };

  const toggle = (field: BooleanField) => {
    setForm((previous) => ({ ...previous, [field]: !previous[field] }));
  };

  const toggleAssistance = (option: string) => {
    setForm((previous) => ({
      ...previous,
      assistanceOptions: previous.assistanceOptions.includes(option)
        ? previous.assistanceOptions.filter((value) => value !== option)
        : [...previous.assistanceOptions, option],
    }));
    setErrors((previous) => ({ ...previous, assistanceOptions: undefined }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const validation = validateApplication(form);
    setErrors(validation);
    if (Object.keys(validation).length > 0) {
      setSubmitError("Please correct the highlighted fields.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch("/api/safe-havens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await response.json()) as {
        error?: string;
        fieldErrors?: ValidationErrors;
      };

      if (!response.ok) {
        if (data.fieldErrors) setErrors(data.fieldErrors);
        setSubmitError(data.error ?? "Could not submit the application.");
        return;
      }

      setSubmitted(true);
    } catch {
      setSubmitError("Could not reach the server. Check your connection.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="rounded-2xl border border-teal-400/25 bg-teal-400/5 p-6">
        <h2 className="text-base font-semibold text-white">Application received</h2>
        <ol className="mt-4 space-y-2.5 text-sm text-zinc-300">
          {[
            "Application submitted",
            "Pending review by the LOG POSE team",
            "A verification employee is assigned",
            "Physical verification visit at your establishment",
            "Verification report and admin decision",
            "If approved: LOG POSE SAFE HAVEN designation",
          ].map((step, index) => (
            <li key={step} className="flex gap-2.5">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] text-zinc-300">
                {index + 1}
              </span>
              <span className={index === 0 ? "text-teal-300" : undefined}>{step}</span>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-xs leading-relaxed text-zinc-500">
          Your establishment is not a LOG POSE Safe Haven yet and will not appear
          on the map until it passes physical verification and admin approval.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Section
        title="Establishment"
        description="This information is used by our verification team to find and confirm your establishment."
      >
        <div>
          <label htmlFor="name" className={labelClass}>
            Business name
          </label>
          <input
            id="name"
            className={`mt-1.5 ${inputClass}`}
            value={form.name}
            onChange={(event) => update("name", event.target.value)}
          />
          <FieldError message={errors.name} />
        </div>

        <div>
          <label htmlFor="type" className={labelClass}>
            Establishment type
          </label>
          <select
            id="type"
            className={`mt-1.5 ${inputClass}`}
            value={form.type}
            onChange={(event) =>
              update("type", event.target.value as SafeHavenApplicationInput["type"])
            }
          >
            {SAFE_HAVEN_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="address" className={labelClass}>
            Address
          </label>
          <input
            id="address"
            className={`mt-1.5 ${inputClass}`}
            value={form.address}
            onChange={(event) => update("address", event.target.value)}
          />
          <FieldError message={errors.address} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="city" className={labelClass}>
              City
            </label>
            <input
              id="city"
              className={`mt-1.5 ${inputClass}`}
              value={form.city}
              onChange={(event) => update("city", event.target.value)}
            />
            <FieldError message={errors.city} />
          </div>
          <div>
            <label htmlFor="pincode" className={labelClass}>
              Pincode
            </label>
            <input
              id="pincode"
              inputMode="numeric"
              className={`mt-1.5 ${inputClass}`}
              value={form.pincode}
              onChange={(event) => update("pincode", event.target.value)}
            />
            <FieldError message={errors.pincode} />
          </div>
        </div>

        <div>
          <label htmlFor="phone" className={labelClass}>
            Establishment contact number
          </label>
          <input
            id="phone"
            inputMode="tel"
            className={`mt-1.5 ${inputClass}`}
            value={form.phone}
            onChange={(event) => update("phone", event.target.value)}
          />
          <FieldError message={errors.phone} />
        </div>

        <div>
          <label htmlFor="description" className={labelClass}>
            Short description (optional)
          </label>
          <textarea
            id="description"
            rows={3}
            className={`mt-1.5 ${inputClass}`}
            value={form.description}
            onChange={(event) => update("description", event.target.value)}
          />
        </div>

        <div>
          <p className={labelClass}>Exact location</p>
          <div className="mt-1.5">
            <LocationPicker
              value={
                Number.isFinite(form.latitude) && Number.isFinite(form.longitude)
                  ? { lat: form.latitude, lng: form.longitude }
                  : null
              }
              onChange={(value) => {
                update("latitude", value.lat);
                update("longitude", value.lng);
              }}
            />
          </div>
          <FieldError message={errors.latitude} />
        </div>
      </Section>

      <Section title="Operating information">
        <label className="flex items-center gap-2.5 text-sm text-zinc-200">
          <input
            type="checkbox"
            checked={form.is247}
            onChange={() => toggle("is247")}
            className="h-4 w-4 accent-teal-500"
          />
          Open 24/7
        </label>

        {!form.is247 && (
          <div>
            <label htmlFor="openingHours" className={labelClass}>
              Opening hours
            </label>
            <input
              id="openingHours"
              placeholder="e.g. Mo-Su 09:00-22:00"
              className={`mt-1.5 ${inputClass}`}
              value={form.openingHours}
              onChange={(event) => update("openingHours", event.target.value)}
            />
            <FieldError message={errors.openingHours} />
          </div>
        )}

        <div>
          <label htmlFor="employeeCount" className={labelClass}>
            Approximate number of employees (optional)
          </label>
          <input
            id="employeeCount"
            inputMode="numeric"
            className={`mt-1.5 ${inputClass}`}
            value={form.employeeCount ?? ""}
            onChange={(event) =>
              update(
                "employeeCount",
                event.target.value === "" ? null : Number(event.target.value),
              )
            }
          />
          <FieldError message={errors.employeeCount} />
        </div>

        <div className="space-y-2.5">
          {(
            [
              { field: "staffAvailable" as BooleanField, label: "Staff present during opening hours" },
              { field: "securityAvailable" as BooleanField, label: "Security personnel available" },
              { field: "femaleStaffAvailable" as BooleanField, label: "Female staff available (optional)" },
            ]
          ).map(({ field, label }) => (
            <label key={field} className="flex items-center gap-2.5 text-sm text-zinc-200">
              <input
                type="checkbox"
                checked={Boolean(form[field])}
                onChange={() => toggle(field)}
                className="h-4 w-4 accent-teal-500"
              />
              {label}
            </label>
          ))}
        </div>

        {form.securityAvailable && (
          <div>
            <label htmlFor="securityHours" className={labelClass}>
              Security operating hours
            </label>
            <input
              id="securityHours"
              placeholder="e.g. 24/7 or 18:00-06:00"
              className={`mt-1.5 ${inputClass}`}
              value={form.securityHours}
              onChange={(event) => update("securityHours", event.target.value)}
            />
          </div>
        )}
      </Section>

      <Section
        title="Safe-space facilities"
        description="Only select what you can genuinely offer. False claims lead to rejection during verification."
      >
        <div className="grid gap-2.5 sm:grid-cols-2">
          {FACILITY_FIELDS.map(({ field, label }) => (
            <label key={field} className="flex items-center gap-2.5 text-sm text-zinc-200">
              <input
                type="checkbox"
                checked={Boolean(form[field])}
                onChange={() => toggle(field)}
                className="h-4 w-4 accent-teal-500"
              />
              {label}
            </label>
          ))}
        </div>
      </Section>

      <Section title="Emergency facilities">
        <div className="grid gap-2.5 sm:grid-cols-2">
          {EMERGENCY_FIELDS.map(({ field, label }) => (
            <label key={field} className="flex items-center gap-2.5 text-sm text-zinc-200">
              <input
                type="checkbox"
                checked={Boolean(form[field])}
                onChange={() => toggle(field)}
                className="h-4 w-4 accent-teal-500"
              />
              {label}
            </label>
          ))}
        </div>
      </Section>

      <Section title="Accessibility">
        <div className="grid gap-2.5 sm:grid-cols-2">
          {ACCESSIBILITY_FIELDS.map(({ field, label }) => (
            <label key={field} className="flex items-center gap-2.5 text-sm text-zinc-200">
              <input
                type="checkbox"
                checked={Boolean(form[field])}
                onChange={() => toggle(field)}
                className="h-4 w-4 accent-teal-500"
              />
              {label}
            </label>
          ))}
        </div>
      </Section>

      <Section
        title="How you can assist"
        description="Select what your staff can realistically do for someone who arrives feeling unsafe."
      >
        <div className="grid gap-2.5 sm:grid-cols-2">
          {ASSISTANCE_OPTIONS.map((option) => (
            <label key={option} className="flex items-center gap-2.5 text-sm text-zinc-200">
              <input
                type="checkbox"
                checked={form.assistanceOptions.includes(option)}
                onChange={() => toggleAssistance(option)}
                className="h-4 w-4 accent-teal-500"
              />
              {option}
            </label>
          ))}
        </div>
        <FieldError message={errors.assistanceOptions} />
      </Section>

      <Section
        title="Verification contact"
        description="Kept private for our verification team. It is never shown publicly on the map."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="contactPersonName" className={labelClass}>
              Contact person
            </label>
            <input
              id="contactPersonName"
              className={`mt-1.5 ${inputClass}`}
              value={form.contactPersonName}
              onChange={(event) => update("contactPersonName", event.target.value)}
            />
            <FieldError message={errors.contactPersonName} />
          </div>
          <div>
            <label htmlFor="contactPersonPhone" className={labelClass}>
              Contact number
            </label>
            <input
              id="contactPersonPhone"
              inputMode="tel"
              className={`mt-1.5 ${inputClass}`}
              value={form.contactPersonPhone}
              onChange={(event) => update("contactPersonPhone", event.target.value)}
            />
            <FieldError message={errors.contactPersonPhone} />
          </div>
        </div>

        <label className="flex gap-2.5 text-sm text-zinc-200">
          <input
            type="checkbox"
            checked={form.consentToVerification}
            onChange={() => toggle("consentToVerification")}
            className="mt-0.5 h-4 w-4 shrink-0 accent-teal-500"
          />
          <span>
            I agree to a physical verification visit by a LOG POSE representative
            and confirm the information above is accurate.
          </span>
        </label>
        <FieldError message={errors.consentToVerification} />
      </Section>

      {submitError && (
        <p
          className="rounded-xl border border-orange-400/25 bg-orange-400/10 px-4 py-3 text-sm text-orange-200"
          role="alert"
        >
          {submitError}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-xl bg-teal-500 py-3.5 text-base font-semibold text-zinc-950 transition hover:bg-teal-400 disabled:opacity-50"
      >
        {submitting ? "Submitting..." : "Submit application"}
      </button>

      <p className="pb-4 text-center text-xs leading-relaxed text-zinc-500">
        Submitting this form does not make your establishment a LOG POSE Safe
        Haven. Every application is reviewed and physically verified before
        approval.
      </p>
    </form>
  );
}
