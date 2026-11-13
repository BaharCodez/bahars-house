import { useState } from "react";
import type { SpanishLine } from "@/app/lib/spanish";
import { speakSpanish } from "@/app/lib/daily/speech";
import { useClientValue } from "@/app/lib/daily/useClientValue";
import { DASHED_BUTTON } from "./styles";
import TickButton from "./TickButton";
import type { TickControl } from "./types";


export default function ListeningCard({
  line,
  understood,
}: {
  line: SpanishLine;
  understood: TickControl;
}) {
  const [revealed, setRevealed] = useState(false);
  // SSR says no (there's no window); the real answer arrives on hydration.
  const canSpeak = useClientValue(
    () => "speechSynthesis" in window,
    () => false,
  );

  return (
    <section className="pixel-frame bg-surface p-4 sm:p-5">
      <h2 className="font-pixel text-ink-soft text-xs tracking-wider uppercase">
        el oído — just listen
      </h2>
      <p className="text-ink-soft mt-2 text-sm">
        One sentence, ears only. Play it a few times before you peek.
      </p>

      {canSpeak ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => speakSpanish(line.es, 0.9)}
            className="bg-accent-2 text-accent-ink font-pixel rounded-full px-4 py-2 text-sm hover:opacity-90"
          >
            ▶ listen
          </button>
          <button
            type="button"
            onClick={() => speakSpanish(line.es, 0.6)}
            className={DASHED_BUTTON}
          >
            🐢 slower
          </button>
        </div>
      ) : (
        <p className="text-ink-soft mt-4 font-mono text-xs">
          (this browser can&apos;t speak — reveal and read instead)
        </p>
      )}

      {revealed ? (
        <div className="border-accent-2 bg-accent-2/10 mt-4 border-l-4 p-3">
          <p className="text-ink text-sm font-medium">{line.es}</p>
          <p className="text-ink-soft mt-1 text-xs">{line.en}</p>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setRevealed(true)}
          className={`${DASHED_BUTTON} mt-4 block`}
        >
          reveal the sentence
        </button>
      )}

      <TickButton
        {...understood}
        idleLabel="¡entendido!"
        doneLabel="entendido ✓"
        className="mt-4"
      />
    </section>
  );
}
