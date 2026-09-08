"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          color: "#111",
          background: "#fff",
          margin: 0,
          padding: "3rem 1.5rem",
        }}
      >
        <h1 style={{ fontSize: "1.25rem" }}>Service error</h1>
        <p style={{ maxWidth: "60ch" }}>
          The application encountered an unexpected error. Please try again
          shortly.
        </p>
        {error.digest && (
          <p style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "#767676" }}>
            Reference: {error.digest}
          </p>
        )}
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: "1rem",
            border: "1px solid #d7d7d7",
            background: "#fff",
            padding: "0.5rem 0.875rem",
            borderRadius: 2,
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
