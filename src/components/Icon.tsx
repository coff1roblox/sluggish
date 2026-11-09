// A handful of thin-stroke icons, only where they carry meaning.

type Name =
  | "copy"
  | "check"
  | "bookmark"
  | "bookmark-filled"
  | "back"
  | "search"
  | "moon"
  | "sun"
  | "close"
  | "undo";

const PATHS: Record<Name, React.ReactNode> = {
  copy: (
    <>
      <rect x="8.5" y="8.5" width="11" height="11" rx="2" />
      <path d="M15.5 8.5V6.5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  bookmark: <path d="M7 4.5h10a.5.5 0 0 1 .5.5v14.2l-5.5-3.6-5.5 3.6V5a.5.5 0 0 1 .5-.5z" />,
  "bookmark-filled": (
    <path
      d="M7 4.5h10a.5.5 0 0 1 .5.5v14.2l-5.5-3.6-5.5 3.6V5a.5.5 0 0 1 .5-.5z"
      fill="currentColor"
    />
  ),
  back: <path d="M19 12H5m0 0l6-6m-6 6l6 6" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4 4" />
    </>
  ),
  moon: <path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v1.5M12 19.5V21M3 12h1.5M19.5 12H21M5.6 5.6l1.1 1.1M17.3 17.3l1.1 1.1M5.6 18.4l1.1-1.1M17.3 6.7l1.1-1.1" />
    </>
  ),
  close: <path d="M7 7l10 10M17 7L7 17" />,
  undo: <path d="M9 7L5 11l4 4M5 11h9a5 5 0 0 1 0 10h-2" />,
};

export function Icon({
  name,
  size = 20,
  className,
}: {
  name: Name;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {PATHS[name]}
    </svg>
  );
}
