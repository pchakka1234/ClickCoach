// Prefer Samantha US on macOS; Windows and other systems use an available
// local English voice. Never require an Apple-specific voice or a paid service.
export function chooseVoice(voices) {
  const local = voices.filter(v => v.remote === false && v.voiceName);
  return local.find(v => /\bsamantha\b/i.test(v.voiceName) && /^en[-_]US$/i.test(v.lang))
    || local.find(v => /^en[-_]US$/i.test(v.lang))
    || local.find(v => /^en(?:[-_]|$)/i.test(v.lang));
}

export function createNarrator(tts, onState) {
  let generation = 0;
  function stop() { generation++; tts?.stop(); onState('idle'); }
  async function speak(text, rate = 1) {
    stop();
    if (!tts) throw new Error('Read aloud is available inside the Chrome extension.');
    const request = generation;
    const voices = await tts.getVoices();
    if (request !== generation) return;
    const voice = chooseVoice(voices);
    if (!voice) throw new Error('No local English voice is available. Install an English speech voice in your device settings, then try again.');
    onState('speaking');
    try { tts.speak(text, { voiceName: voice.voiceName, lang: voice.lang, ...(voice.extensionId ? { extensionId: voice.extensionId } : {}), rate,
      onEvent(event) {
        if (request !== generation) return;
        if (['end', 'interrupted', 'cancelled', 'error'].includes(event.type)) onState(event.type === 'error' ? 'error' : 'idle');
      },
    }, () => {
      if (request === generation && globalThis.chrome?.runtime?.lastError) onState('error');
    }); } catch (error) { onState('idle'); throw error; }
  }
  return { speak, stop };
}
