"use client";

const ZONE =
  "text-ink/70 hover:text-ink absolute top-0 z-30 flex h-full w-[15%] items-center text-3xl select-none [-webkit-touch-callout:none]";

// Kept narrow (15%) so they sit over the page margins — any wider and they
// swallow the long-press needed to select text near the edges on iOS.
export default function PageTurnZones({
  onPrev,
  onNext,
}: {
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <>
      <button
        onClick={onPrev}
        aria-label="Previous page"
        className={`${ZONE} left-0 justify-start pl-1`}
      >
        ‹
      </button>
      <button
        onClick={onNext}
        aria-label="Next page"
        className={`${ZONE} right-0 justify-end pr-1`}
      >
        ›
      </button>
    </>
  );
}
