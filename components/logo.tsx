/**
 * P/A monogram — inline SVG so it inherits `currentColor` and needs no request.
 * The full mark (ring + nodes + P/A) is used in the header/footer; favicons come
 * from app/icon.svg.
 */
export function Logo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 256 256"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="P/A"
    >
      <path
        d="M150 25.2 A106 106 0 1 0 129 231"
        stroke="currentColor"
        strokeWidth="2.3"
        strokeLinecap="round"
      />
      <path
        d="M231.5 150 A106 106 0 0 1 200 200"
        stroke="currentColor"
        strokeWidth="2.3"
        strokeLinecap="round"
      />
      <circle cx="150" cy="25.2" r="8.5" fill="currentColor" />
      <circle cx="129" cy="231" r="8.5" fill="currentColor" />
      <text
        x="128"
        y="160"
        textAnchor="middle"
        fontFamily="Georgia, 'Times New Roman', 'Noto Serif JP', serif"
        fontSize="98"
        fontWeight="500"
        letterSpacing="-2"
        fill="currentColor"
      >
        P/A
      </text>
    </svg>
  );
}
