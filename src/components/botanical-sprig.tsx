export function BotanicalSprig({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`botanical-sprig ${className}`}
      viewBox="0 0 180 280"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M48 270C76 213 91 160 118 34M73 211C46 185 34 164 23 133M92 156C120 142 141 118 153 92M105 101C82 82 72 65 66 43"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <g
        fill="currentColor"
        fillOpacity=".12"
        stroke="currentColor"
        strokeWidth="1"
      >
        <ellipse
          cx="43"
          cy="177"
          rx="15"
          ry="31"
          transform="rotate(-39 43 177)"
        />
        <ellipse
          cx="24"
          cy="127"
          rx="15"
          ry="27"
          transform="rotate(-19 24 127)"
        />
        <ellipse
          cx="87"
          cy="185"
          rx="17"
          ry="31"
          transform="rotate(25 87 185)"
        />
        <ellipse
          cx="124"
          cy="137"
          rx="16"
          ry="29"
          transform="rotate(49 124 137)"
        />
        <ellipse
          cx="151"
          cy="91"
          rx="15"
          ry="27"
          transform="rotate(30 151 91)"
        />
        <ellipse
          cx="83"
          cy="77"
          rx="14"
          ry="28"
          transform="rotate(-40 83 77)"
        />
        <ellipse
          cx="121"
          cy="39"
          rx="16"
          ry="30"
          transform="rotate(11 121 39)"
        />
      </g>
    </svg>
  );
}
