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
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ ...form, requireApproval });
      }}
    >
      <div className="flex flex-wrap gap-2">
        {SAMPLES.map((s) => (
          <button
            key={s.label}
            type="button"
            disabled={disabled}
            onClick={() => setForm({ patientName: s.patientName, insuranceCarrier: s.insuranceCarrier, procedureCode: s.procedureCode, appointmentDate: s.appointmentDate })}
            className="rounded-lg border border-slate-700 bg-slate-800/40 px-3 py-1.5 text-xs text-slate-300 transition hover:border-teal-500/50 hover:text-teal-300 disabled:opacity-50"
          >
            {s.label}
          </button>
        ))}
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

      <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-slate-700 bg-slate-800/30 px-3 py-2.5 text-sm text-slate-300">
        <input
          type="checkbox"
          checked={requireApproval}
          onChange={(e) => setRequireApproval(e.target.checked)}
          disabled={disabled}
          className="h-4 w-4 accent-teal-500"
        />
        <span>
          Require human approval before saving
          <span className="ml-1 text-xs text-slate-500">(human-in-the-loop)</span>
        </span>
      </label>

      <button
        type="submit"
        disabled={disabled}
        className="mt-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 to-sky-500 px-4 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-teal-500/20 transition hover:from-teal-400 hover:to-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {disabled ? "Agent running…" : "Run prep agent"}
      </button>

      <style jsx>{`
        .input {
          width: 100%;
          border-radius: 0.6rem;
          border: 1px solid var(--border);
          background: rgba(15, 23, 42, 0.6);
          padding: 0.6rem 0.75rem;
          font-size: 0.875rem;
          color: var(--foreground);
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .input:focus {
          border-color: rgba(20, 184, 166, 0.6);
          box-shadow: 0 0 0 3px rgba(20, 184, 166, 0.15);
        }
        .input:disabled {
          opacity: 0.6;
        }
      `}</style>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium tracking-wide text-slate-400 uppercase">{label}</span>
      {children}
    </label>
  );
}
