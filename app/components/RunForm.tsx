"use client";

import { useState } from "react";
import type { AppointmentInput } from "@/lib/types";

const SAMPLES: Array<AppointmentInput & { label: string }> = [
  {
    label: "MRI Knee · Aetna",
    patientName: "John Smith",
    insuranceCarrier: "Aetna",
    procedureCode: "MRI_KNEE",
    appointmentDate: "2026-07-15",
  },
  {
    label: "CT Abdomen · UnitedHealthcare",
    patientName: "Maria Garcia",
    insuranceCarrier: "UnitedHealthcare",
    procedureCode: "CT_ABDOMEN",
    appointmentDate: "2026-07-02",
  },
  {
    label: "Colonoscopy · Medicare",
    patientName: "Robert Lee",
    insuranceCarrier: "Medicare",
    procedureCode: "COLONOSCOPY",
    appointmentDate: "2026-08-10",
  },
];

const PROCEDURES = ["MRI_KNEE", "MRI_BRAIN", "CT_ABDOMEN", "COLONOSCOPY", "ECHO_TTE", "PT_EVAL"];

export function RunForm({
  disabled,
  onSubmit,
}: {
  disabled: boolean;
  onSubmit: (input: AppointmentInput & { requireApproval: boolean }) => void;
}) {
  const [form, setForm] = useState<AppointmentInput>(SAMPLES[0]);
  const [requireApproval, setRequireApproval] = useState(false);

  const update = (k: keyof AppointmentInput, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ ...form, requireApproval });
      }}
    >
      <div>
        <p className="field-label mb-2">Quick start</p>
        <div className="flex flex-wrap gap-1.5">
          {SAMPLES.map((s) => (
            <button
              key={s.label}
              type="button"
              disabled={disabled}
              onClick={() =>
                setForm({
                  patientName: s.patientName,
                  insuranceCarrier: s.insuranceCarrier,
                  procedureCode: s.procedureCode,
                  appointmentDate: s.appointmentDate,
                })
              }
              className="btn-ghost disabled:opacity-50"
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <Field label="Patient name">
        <input
          className="input"
          value={form.patientName}
          onChange={(e) => update("patientName", e.target.value)}
          placeholder="John Smith"
          required
          disabled={disabled}
        />
      </Field>

      <Field label="Insurance carrier">
        <input
          className="input"
          value={form.insuranceCarrier}
          onChange={(e) => update("insuranceCarrier", e.target.value)}
          placeholder="Aetna"
          list="carriers"
          required
          disabled={disabled}
        />
        <datalist id="carriers">
          <option value="Aetna" />
          <option value="UnitedHealthcare" />
          <option value="Cigna" />
          <option value="Blue Cross Blue Shield" />
          <option value="Medicare" />
        </datalist>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Procedure code">
          <input
            className="input"
            value={form.procedureCode}
            onChange={(e) => update("procedureCode", e.target.value)}
            placeholder="MRI_KNEE"
            list="procedures"
            required
            disabled={disabled}
          />
          <datalist id="procedures">
            {PROCEDURES.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </Field>

        <Field label="Appointment date">
          <input
            className="input"
            type="date"
            value={form.appointmentDate}
            onChange={(e) => update("appointmentDate", e.target.value)}
            required
            disabled={disabled}
          />
        </Field>
      </div>

      <label className="flex cursor-pointer items-start gap-2.5 rounded-[var(--rad-sm)] border border-[var(--line)] bg-[var(--bg-2)] px-3 py-2.5 text-sm">
        <input
          type="checkbox"
          checked={requireApproval}
          onChange={(e) => setRequireApproval(e.target.checked)}
          disabled={disabled}
          className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
        />
        <span className="text-[var(--ink-2)]">
          Require human approval before saving
          <span className="ml-1 text-xs text-[var(--ink-3)]">(human-in-the-loop)</span>
        </span>
      </label>

      <button type="submit" disabled={disabled} className="cta cta-accent">
        {disabled ? "Agent running…" : "Run prep agent"}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}
