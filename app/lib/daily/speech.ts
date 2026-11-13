/** Read a line aloud with the browser's built-in Spanish voice. */
export function speakSpanish(text: string, rate: number) {
  const synth = window.speechSynthesis;
  synth.cancel();
  const speak = () => synth.speak(spanishUtterance(text, rate));
  if (synth.getVoices().length > 0) {
    speak();
    return;
  }
  // The voice list loads async — first click can land before it's ready.
  let spoken = false;
  const speakOnce = () => {
    if (spoken) return;
    spoken = true;
    speak();
  };
  synth.addEventListener("voiceschanged", speakOnce, { once: true });
  setTimeout(speakOnce, 300);
}

function spanishUtterance(text: string, rate: number) {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "es-ES";
  utterance.rate = rate;
  const voice = pickSpanishVoice();
  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang;
  }
  return utterance;
}

/* The default Spanish voice is often the muffled "compact" one — rank the
   installed voices and take the clearest on offer. */
function pickSpanishVoice() {
  const voices = window.speechSynthesis
    .getVoices()
    .filter((v) => v.lang.toLowerCase().startsWith("es"));
  return voices.sort((a, b) => voiceClarity(b) - voiceClarity(a))[0] ?? null;
}

function voiceClarity(voice: SpeechSynthesisVoice) {
  return (
    (/google/i.test(voice.name) ? 4 : 0) +
    (/enhanced|premium|natural/i.test(voice.name) ? 3 : 0) +
    (/m[oó]nica|paulina/i.test(voice.name) ? 2 : 0) +
    (/^es-(ES|MX|US)$/i.test(voice.lang) ? 1 : 0)
  );
}
