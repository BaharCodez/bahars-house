import { useState } from "react";
import type { SpanishScene } from "@/app/lib/spanish";
import { DASHED_BUTTON } from "./styles";
import TickButton from "./TickButton";
import type { TickControl } from "./types";


export default function SpanishCard({
  scene,
  practised,
}: {
  scene: SpanishScene;
  practised: TickControl;
}) {
  const [showEnglish, setShowEnglish] = useState(false);
  return (
    <section className="pixel-frame bg-surface p-4 sm:p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-pixel text-ink-soft text-xs tracking-wider uppercase">
          hoy: un poco de español
        </h2>
        <span className="text-ink-soft font-mono text-xs">
          scene: {scene.scene}
        </span>
      </div>

      <div className="mt-3 space-y-2">
        {scene.lines.map((line, i) => (
          <div key={i} className={i % 2 === 0 ? "" : "pl-4 sm:pl-6"}>
            <p className="text-ink text-sm font-medium">{line.es}</p>
            {showEnglish && <p className="text-ink-soft text-xs">{line.en}</p>}
          </div>
        ))}
      </div>

      <div className="border-accent bg-accent/10 mt-4 border-l-4 p-3">
        <p className="font-pixel text-ink-soft text-[10px] tracking-wider uppercase">
          your turn — say it out loud, once is enough
        </p>
        <p className="text-ink mt-1 text-sm font-medium">{scene.yourTurn.es}</p>
        {showEnglish && (
          <p className="text-ink-soft text-xs">{scene.yourTurn.en}</p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setShowEnglish((s) => !s)}
          className={DASHED_BUTTON}
        >
          {showEnglish ? "hide english" : "show english"}
        </button>
        <TickButton {...practised} idleLabel="¡hecho!" doneLabel="hecho ✓" />
      </div>
    </section>
  );
}
