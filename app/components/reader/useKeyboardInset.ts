import { useEffect, useState } from "react";

// Height of the on-screen keyboard (iOS), tracked via the visual viewport.
// `height * scale` (not raw height) so pinch-zoom doesn't read as a keyboard.
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => {
      const hidden =
        window.innerHeight -
        viewport.height * viewport.scale -
        viewport.offsetTop;
      setInset(Math.max(0, Math.round(hidden)));
    };
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, []);

  return inset;
}
