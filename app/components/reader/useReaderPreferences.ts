import { useEffect, useState } from "react";
import type { ReadingMode } from "./useBookRendition";

const MODE_KEY = "readingMode";
const FONT_SCALE_KEY = "fontScale";
const MIN_FONT_SCALE = 70;
const MAX_FONT_SCALE = 220;

// Reading mode and font size (a percentage), remembered in localStorage.
export function useReaderPreferences() {
  const [mode, setMode] = useState<ReadingMode>("paginated");
  const [fontScale, setFontScale] = useState(100);

  // Restored in a frame callback so it doesn't run synchronously in the effect.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      if (localStorage.getItem(MODE_KEY) === "scrolled") setMode("scrolled");
    });
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const saved = Number(localStorage.getItem(FONT_SCALE_KEY));
      if (saved >= MIN_FONT_SCALE && saved <= MAX_FONT_SCALE)
        setFontScale(saved);
    });
    return () => cancelAnimationFrame(id);
  }, []);

  function toggleMode() {
    setMode((current) => {
      const next = current === "paginated" ? "scrolled" : "paginated";
      localStorage.setItem(MODE_KEY, next);
      return next;
    });
  }

  function changeFontScale(delta: number) {
    setFontScale((current) => {
      const next = Math.min(
        MAX_FONT_SCALE,
        Math.max(MIN_FONT_SCALE, current + delta),
      );
      localStorage.setItem(FONT_SCALE_KEY, String(next));
      return next;
    });
  }

  return { mode, toggleMode, fontScale, changeFontScale };
}
