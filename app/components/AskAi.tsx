"use client";

import { useEffect, useRef, useState } from "react";
import type { OfficeSummary } from "@/lib/types";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

export function AskAi({ summary }: { summary?: OfficeSummary }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy, open]);

  const suggestions = summary
    ? ["Is prior auth required?", "What should we ask the patient?", "What are the top risks?"]
    : ["What does Aetna require for an MRI?", "How do prior authorizations work?"];

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    const history = messages.slice(-6);
    setMessages((m) => [...m, { role: "user", content: q }]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, summary, history }),
      });
      const data = (await res.json()) as { answer?: string; error?: string };
      setMessages((m) => [
        ...m,
        { role: "assistant", content: data.answer ?? "Sorry, I couldn't answer that." },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "Network error — please try again." },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {!open && (
        <button type="button" onClick={() => setOpen(true)} className="ask-ai">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M21 12a8 8 0 0 1-8 8H7l-4 3V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8z"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinejoin="round"
            />
            <circle cx="9" cy="12" r="1" fill="currentColor" />
            <circle cx="13" cy="12" r="1" fill="currentColor" />
          </svg>
          Ask Prep AI
        </button>
      )}

      {open && (
        <div className="card fixed bottom-5 right-5 z-50 flex h-[32rem] max-h-[calc(100dvh-2.5rem)] w-[22rem] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between border-b border-[var(--line)] bg-[var(--ink)] px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M21 12a8 8 0 0 1-8 8H7l-4 3V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8z"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="text-sm font-medium">Prep AI</span>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="rounded p-1 text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <div ref={scrollRef} className="scroll-thin flex-1 space-y-3 overflow-y-auto p-3">
            {messages.length === 0 && (
              <div className="px-1 py-2 text-sm text-[var(--ink-2)]">
                <p className="mb-1 font-medium text-[var(--ink)]">
                  {summary ? `Ask about ${summary.patientName}'s appointment` : "How can I help?"}
                </p>
                <p className="text-[var(--ink-3)]">
                  {summary
                    ? "I can answer using this prep's findings — prior auth, coverage, prep, risks, and actions."
                    : "Run or open a prep for appointment-specific answers, or ask a general question."}
                </p>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-[var(--rad-sm)] px-3 py-2 text-sm ${
                    m.role === "user"
                      ? "bg-[var(--accent)] text-white"
                      : "bg-[var(--bg-2)] text-[var(--ink)]"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {busy && (
              <div className="flex justify-start">
                <div className="rounded-[var(--rad-sm)] bg-[var(--bg-2)] px-3 py-2">
                  <span className="typing-dots">
                    <i />
                    <i />
                    <i />
                  </span>
                </div>
              </div>
            )}
          </div>

          {messages.length === 0 && (
            <div className="flex flex-wrap gap-1.5 px-3 pb-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="chip transition hover:border-[var(--accent)] hover:text-[var(--accent-ink)]"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <form
            className="flex items-center gap-2 border-t border-[var(--line)] p-2.5"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <input
              className="input flex-1"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question…"
              disabled={busy}
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="cta cta-accent shrink-0 px-3 disabled:opacity-50"
              aria-label="Send"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </form>
        </div>
      )}
    </>
  );
}
