"use client";

export function AskAiButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="ask-ai">
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
  );
}
