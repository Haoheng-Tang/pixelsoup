const SVG_PROPS = {
  width: 16,
  height: 16,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.4,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;

export function LayersIcon() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M8 2 1.8 5.2 8 8.4l6.2-3.2L8 2z" />
      <path d="M1.8 8 8 11.2 14.2 8" />
      <path d="M1.8 10.8 8 14l6.2-3.2" />
    </svg>
  );
}

export function UndoIcon() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M5.5 4H2.5v3" />
      <path d="M2.8 6.8A5.2 5.2 0 1 1 4 12" />
    </svg>
  );
}

export function RedoIcon() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M10.5 4h3v3" />
      <path d="M13.2 6.8A5.2 5.2 0 1 0 12 12" />
    </svg>
  );
}

export function HamburgerIcon() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M2.5 4h11M2.5 8h11M2.5 12h11" />
    </svg>
  );
}

export function SlidersIcon() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M2 4h7M12 4h2M2 8h2M7 8h7M2 12h9M14 12h0" />
      <circle cx="10.5" cy="4" r="1.5" />
      <circle cx="5.5" cy="8" r="1.5" />
      <circle cx="12.5" cy="12" r="1.5" />
    </svg>
  );
}

export function BackArrowIcon() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M10 3.5 5.5 8l4.5 4.5" />
    </svg>
  );
}
