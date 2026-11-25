// The game's own line icons, drawn in a 24 × 24 box, so buttons look the
// same on every device instead of borrowing its emoji.
import type { ReactNode } from "react";

const PATHS: Record<string, ReactNode> = {
  home: (
    <>
      <path d="M4 11.5 12 4.5l8 7" />
      <path d="M6.5 10v9h11v-9" />
      <path d="M10.2 19v-4.6h3.6V19" />
    </>
  ),
  back: <path d="M14.5 5.5 8 12l6.5 6.5" />,
  gear: (
    <>
      <circle cx="12" cy="12" r="3.1" />
      <path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.8 1.8M16.7 16.7l1.8 1.8M18.5 5.5l-1.8 1.8M7.3 16.7l-1.8 1.8" />
    </>
  ),
  hint: (
    <>
      <path d="M8.6 14.6a6 6 0 1 1 6.8 0c-.7.5-1 1.2-1 2v.4H9.6v-.4c0-.8-.3-1.5-1-2Z" />
      <path d="M9.9 20.2h4.2" />
    </>
  ),
  undo: (
    <>
      <path d="M8.5 5 4.5 9l4 4" />
      <path d="M4.8 9h9.4a5.3 5.3 0 0 1 0 10.6H9" />
    </>
  ),
  shuffle: (
    <>
      <path d="M3.5 7.5h3.2c2 0 3.2.9 4.3 2.6l2 3.8c1.1 1.7 2.3 2.6 4.3 2.6h3.2" />
      <path d="M3.5 16.5h3.2c1.3 0 2.3-.4 3.1-1.2M13.7 8.7c.8-.8 1.8-1.2 3.1-1.2h3.7" />
      <path d="m18 5 2.5 2.5L18 10M18 14l2.5 2.5L18 19" />
    </>
  ),
  skip: (
    <>
      <path d="m5 5.5 8 6.5-8 6.5Z" />
      <path d="M18 5.5v13" />
    </>
  ),
  play: <path d="M8 5.2v13.6L19 12Z" fill="currentColor" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="3.8" />
      <path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6" />
    </>
  ),
  layers: (
    <>
      <path d="m12 4 8.5 4.5L12 13 3.5 8.5Z" />
      <path d="m3.5 12.5 8.5 4.5 8.5-4.5" />
      <path d="m3.5 16 8.5 4.5 8.5-4.5" opacity=".55" />
    </>
  ),
  palette: (
    <>
      <rect x="4.5" y="3.5" width="10" height="13.5" rx="2" />
      <path d="M17.5 7.5a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-7" opacity=".6" />
      <circle cx="9.5" cy="10.2" r="2.1" />
    </>
  ),
  swords: (
    <>
      <path d="M5 4h3l9.5 9.5-3 3L5 7Z" />
      <path d="M19 4h-3l-3.2 3.2M5 20l4.2-4.2M19 20l-2.5-2.5M4.5 15.5l4 4M19.5 15.5l-4 4" />
    </>
  ),
  check: <path d="m5.5 12.5 4.2 4.2 8.8-9.4" />,
  lock: (
    <>
      <rect x="5.5" y="10.5" width="13" height="9.5" rx="2.2" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
    </>
  ),
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 24 }: { name: string; size?: number }) {
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
