/**
 * Generador de archivos de audio WAV para el proyecto
 * Produce:
 *  - SoundButton1: Arranque del motor (Engine Start)
 *  - SoundButton2: Claxon (Horn)
 *  - Soundtrack: Tema Synthwave original del simulador (bucle de 1.5 minutos)
 */
const fs = require('fs');
const path = require('path');

function createWavHeader(dataLength, sampleRate = 44100, numChannels = 1, bitsPerSample = 16) {
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const buffer = Buffer.alloc(44);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataLength, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataLength, 40);

  return buffer;
}

function writeWav(filename, samples, sampleRate = 44100) {
  const dataLength = samples.length * 2;
  const header = createWavHeader(dataLength, sampleRate);
  const pcmBuffer = Buffer.alloc(dataLength);

  for (let i = 0; i < samples.length; i++) {
    let s = Math.max(-1, Math.min(1, samples[i]));
    pcmBuffer.writeInt16LE(Math.floor(s < 0 ? s * 0x8000 : s * 0x7FFF), i * 2);
  }

  const fullBuffer = Buffer.concat([header, pcmBuffer]);
  fs.writeFileSync(filename, fullBuffer);
  console.log(`Guardado: ${filename} (${(samples.length / sampleRate).toFixed(2)}s)`);
}

// 1. GENERAR SOUNDBUTTON 1: Engine Starter
function generateStarter(duration = 2.0, sampleRate = 44100) {
  const numSamples = Math.floor(duration * sampleRate);
  const samples = new Float32Array(numSamples);
  let phaseOsc = 0;
  let phaseLfo = 0;

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let s = 0;
    if (t < 0.9) {
      // Starter cranking: sawtooth + square LFO
      phaseOsc += 2 * Math.PI * 75 / sampleRate;
      phaseLfo += 2 * Math.PI * 12 / sampleRate;
      let saw = 2 * ((phaseOsc / (2 * Math.PI)) % 1) - 1;
      let lfo = Math.sin(phaseLfo) > 0 ? 1 : 0.2;
      s = saw * lfo * 0.5;
    } else {
      // Engine caught and idling: twin harmonics
      let engineTime = t - 0.9;
      let rpmFreq = 45 + 15 * Math.exp(-engineTime * 3);
      phaseOsc += 2 * Math.PI * rpmFreq / sampleRate;
      let sub = Math.sin(phaseOsc * 0.5) * 0.4;
      let main = (2 * ((phaseOsc / (2 * Math.PI)) % 1) - 1) * 0.4;
      let env = Math.min(1, engineTime * 6) * Math.max(0, 1 - engineTime * 0.25);
      s = (main + sub) * env;
    }
    samples[i] = s;
  }
  return samples;
}

// 2. GENERAR SOUNDBUTTON 2: Dual-tone Car Horn
function generateHorn(duration = 1.2, sampleRate = 44100) {
  const numSamples = Math.floor(duration * sampleRate);
  const samples = new Float32Array(numSamples);
  let p1 = 0, p2 = 0;

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    p1 += 2 * Math.PI * 415 / sampleRate;
    p2 += 2 * Math.PI * 523 / sampleRate;

    // Sawtooth harmonics
    let saw1 = 2 * ((p1 / (2 * Math.PI)) % 1) - 1;
    let saw2 = 2 * ((p2 / (2 * Math.PI)) % 1) - 1;

    let env = 1;
    if (t < 0.05) env = t / 0.05;
    else if (t > duration - 0.1) env = (duration - t) / 0.1;

    samples[i] = (saw1 * 0.4 + saw2 * 0.4) * env;
  }
  return samples;
}

// 3. GENERAR SOUNDTRACK: Synthwave Theme
function generateSynthwaveTrack(duration = 95.0, sampleRate = 44100) {
  const numSamples = Math.floor(duration * sampleRate);
  const samples = new Float32Array(numSamples);

  const bpm = 104;
  const spb = 60 / bpm / 4; // 16th note length in sec
  const total16ths = Math.floor(duration / spb);

  const chords = [
    [57, 60, 64], // Am
    [53, 57, 60], // F
    [48, 52, 55], // C
    [55, 59, 62]  // G
  ];

  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

  for (let s16 = 0; s16 < total16ths; s16++) {
    const chordIdx = Math.floor(s16 / 16) % 4;
    const chord = chords[chordIdx];
    const stepInBar = s16 % 16;
    const startSample = Math.floor(s16 * spb * sampleRate);
    const noteSamples = Math.floor(spb * sampleRate * 1.5);

    // Kick on beats 0, 4, 8, 12
    if (stepInBar % 4 === 0) {
      const kickLen = Math.floor(0.25 * sampleRate);
      for (let i = 0; i < kickLen && (startSample + i) < numSamples; i++) {
        const t = i / sampleRate;
        const freq = 140 * Math.exp(-t * 22) + 40;
        const kickSample = Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 12) * 0.65;
        samples[startSample + i] += kickSample;
      }
    }

    // Snare on beats 4, 12
    if (stepInBar === 4 || stepInBar === 12) {
      const snareLen = Math.floor(0.18 * sampleRate);
      for (let i = 0; i < snareLen && (startSample + i) < numSamples; i++) {
        const t = i / sampleRate;
        const noise = (Math.random() * 2 - 1) * Math.exp(-t * 18) * 0.35;
        const tone = Math.sin(2 * Math.PI * 190 * t) * Math.exp(-t * 25) * 0.25;
        samples[startSample + i] += (noise + tone);
      }
    }

    // Hi-hat on every 16th note
    const hatLen = Math.floor(0.04 * sampleRate);
    for (let i = 0; i < hatLen && (startSample + i) < numSamples; i++) {
      const t = i / sampleRate;
      samples[startSample + i] += (Math.random() * 2 - 1) * Math.exp(-t * 90) * 0.12;
    }

    // Bassline (rolling 16th bass)
    const bassNote = chord[0] - 24 + (stepInBar % 2 === 0 ? 0 : 12);
    const bFreq = mtof(bassNote);
    for (let i = 0; i < noteSamples && (startSample + i) < numSamples; i++) {
      const t = i / sampleRate;
      const saw = 2 * (((t * bFreq) % 1)) - 1;
      const env = Math.exp(-t * 14) * 0.22;
      samples[startSample + i] += saw * env;
    }

    // Synth Arpeggio
    const arpNote = chord[stepInBar % chord.length] + 12;
    const aFreq = mtof(arpNote);
    for (let i = 0; i < noteSamples && (startSample + i) < numSamples; i++) {
      const t = i / sampleRate;
      const square = Math.sin(2 * Math.PI * aFreq * t) > 0 ? 0.08 : -0.08;
      const env = Math.exp(-t * 10);
      samples[startSample + i] += square * env;
    }
  }

  // Fade out final 3 seconds
  const fadeStart = numSamples - Math.floor(3.0 * sampleRate);
  for (let i = fadeStart; i < numSamples; i++) {
    const factor = (numSamples - i) / (numSamples - fadeStart);
    samples[i] *= factor;
  }

  return samples;
}

const outDir = path.join(__dirname, 'audio');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

console.log('Generando efectos y música...');
writeWav(path.join(outDir, 'SoundButton1_EngineStart.wav'), generateStarter());
writeWav(path.join(outDir, 'SoundButton2_Horn.wav'), generateHorn());
writeWav(path.join(outDir, 'Soundtrack_Synthwave.wav'), generateSynthwaveTrack(95.0));
console.log('¡Generación completada con éxito!');
