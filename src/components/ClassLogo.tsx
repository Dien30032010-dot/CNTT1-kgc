interface ClassLogoProps {
  size?: "sm" | "lg";
  className?: string;
}

export function ClassLogo({ size = "sm", className = "" }: ClassLogoProps) {
  if (size === "lg") {
    return (
      <svg
        className={`w-32 h-32 md:w-36 md:h-36 shrink-0 ${className}`}
        viewBox="0 0 200 200"
        role="img"
        aria-label="Logo CNTT1 9+K7"
      >
        <defs>
          <linearGradient id="cntt-lg-hero" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#49c7ff" />
            <stop offset="1" stopColor="#1254d4" />
          </linearGradient>
        </defs>
        <circle
          cx="100"
          cy="100"
          r="94"
          fill="#071a39"
          stroke="url(#cntt-lg-hero)"
          strokeWidth="5"
        />
        <circle
          cx="100"
          cy="100"
          r="81"
          fill="none"
          stroke="#f4bd36"
          strokeWidth="2"
          strokeDasharray="5 5"
        />
        <path
          d="M42 69 Q100 28 158 69 L100 91Z"
          fill="#fff"
          stroke="#70c9ff"
          strokeWidth="3"
        />
        <path
          d="M100 91v15m-27-32v26m54-26v26"
          stroke="#fff"
          strokeWidth="3"
          fill="none"
        />
        <text
          x="100"
          y="126"
          textAnchor="middle"
          fontSize="34"
          fontWeight="900"
          fontStyle="italic"
          fill="#fff"
        >
          CNTT1
        </text>
        <path d="M43 135 Q100 155 157 135" stroke="#f4bd36" strokeWidth="5" fill="none" />
        <text x="100" y="164" textAnchor="middle" fontSize="23" fontWeight="900" fill="#fff">
          9+K7
        </text>
        <path d="M145 42l9-10 9 10-9 10z" fill="#4cc8ff" />
      </svg>
    );
  }

  return (
    <svg
      className={`w-11 h-11 shrink-0 ${className}`}
      viewBox="0 0 200 200"
      role="img"
      aria-label="Logo CNTT1 9+K7"
    >
      <circle cx="100" cy="100" r="94" fill="#071a39" stroke="#42baff" strokeWidth="6" />
      <circle cx="100" cy="100" r="80" fill="none" stroke="#f4bd36" strokeWidth="3" />
      <path d="M45 67Q100 30 155 67L100 89Z" fill="white" />
      <text x="100" y="128" textAnchor="middle" fontSize="34" fontWeight="900" fill="white">
        CNTT1
      </text>
      <text x="100" y="164" textAnchor="middle" fontSize="25" fontWeight="900" fill="white">
        9+K7
      </text>
    </svg>
  );
}
