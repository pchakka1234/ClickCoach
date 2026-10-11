export function createNarrator(tts, onState) {
  let generation = 0;
  function stop() { generation++; tts?.stop(); onState('idle'); }
  async function speak(text, rate = 1) {
    stop();
    if (!tts) throw new Error('Read aloud is available inside the Chrome extension.');
    const request = generation;
    const voices = await tts.getVoices();
    if (request !== generation) return;
    const local = voices.filter(voice => voice.remote === false);
    const voice = local.find(v => /^en\b/i.test(v.lang)) || local[0];
    if (!voice) throw new Error('No local voice is available. Add a system voice in your device settings.');
    onState('speaking');
    try { tts.speak(text, { voiceName: voice.voiceName, lang: voice.lang, rate,
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
