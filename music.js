// Trilha original de arcade: melodia, baixo e pulso rítmico a 112 BPM.
const melody = [76,0,79,83,81,79,76,74,72,0,76,79,78,76,74,71,
  69,0,72,76,74,72,69,71,72,74,76,79,78,74,71,0];
const bass = [48,48,43,43,45,45,47,47];
const beat = 60 / 112 / 2;
let bus, context, next = 0, step = 0, running = false;
function note(midi, type, time, duration, volume) {
  if (!midi) return;
  const osc = context.createOscillator();
  const gain = context.createGain();
  osc.type = type;
  osc.frequency.value = 440 * 2 ** ((midi - 69) / 12);
  gain.gain.setValueAtTime(0, time);
  gain.gain.linearRampToValueAtTime(volume, time + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
  osc.connect(gain);
  gain.connect(bus);
  osc.start(time);
  osc.stop(time + duration + 0.01);
  osc.onended = () => { osc.disconnect(); gain.disconnect(); };
}
export function updateMusic(audio, enabled, active) {
  if (!audio) return;
  if (!bus) {
    context = audio;
    bus = audio.createGain();
    bus.gain.value = 0;
    bus.connect(audio.destination);
  }
  const shouldPlay = enabled && active && audio.state === 'running';
  if (shouldPlay !== running) {
    running = shouldPlay;
    bus.gain.cancelScheduledValues(audio.currentTime);
    bus.gain.setTargetAtTime(running ? 0.22 : 0, audio.currentTime, 0.025);
    if (running) next = audio.currentTime + 0.04;
  }
  if (!running) return;
  while (next < audio.currentTime + 0.1) {
    note(melody[step % melody.length], 'square', next, beat * 0.78, 0.12);
    if (step % 2 === 0) note(bass[Math.floor(step / 4) % bass.length], 'triangle', next, beat * 1.6, 0.20);
    // Curto pulso grave como bateria eletrônica, sem samples externos.
    if (step % 4 === 0) note(31, 'triangle', next, 0.08, 0.20);
    if (step % 4 === 2) note(91, 'square', next, 0.025, 0.035);
    next += beat;
    step++;
  }
}
