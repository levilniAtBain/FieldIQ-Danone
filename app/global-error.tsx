"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            gap: "12px",
            fontFamily: "system-ui, sans-serif",
            color: "#374151",
          }}
        >
          <p style={{ fontSize: "14px" }}>Something went wrong.</p>
          <button
            onClick={reset}
            style={{
              padding: "8px 16px",
              background: "#4f46e5",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "13px",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
