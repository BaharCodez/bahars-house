"use client";

import { useEffect, useRef, useState } from "react";

const DESIGN_WIDTH = 1617;
const DESIGN_HEIGHT = 3155;

export default function ResponsiveFigmaCanvas({
  children,
}: {
  children: React.ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateScale = () => {
      setScale(Math.min(1, container.clientWidth / DESIGN_WIDTH));
    };

    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden"
      style={{ height: DESIGN_HEIGHT * scale }}
    >
      <div
        className="absolute top-0 left-1/2"
        style={{
          width: DESIGN_WIDTH,
          height: DESIGN_HEIGHT,
          transform: `translateX(-50%) scale(${scale})`,
          transformOrigin: "top center",
        }}
      >
        {children}
      </div>
    </div>
  );
}
