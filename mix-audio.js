const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const audioDir = path.join(__dirname, 'audio');
const voicesDir = path.join(audioDir, 'voices');
const finalMp3 = path.join(audioDir, 'Names_ProjectName_FinalAudio.mp3');

// Localizar ffmpeg
let ffmpeg = 'ffmpeg';
try {
  execSync('ffmpeg -version', { stdio: 'ignore' });
} catch {
  const p = path.join(process.env.LOCALAPPDATA, 'Microsoft', 'WinGet', 'Packages');
  const found = fs.readdirSync(p, { recursive: true }).find(f => f.endsWith('ffmpeg.exe'));
  if (found) ffmpeg = `"${path.join(p, found)}"`;
}

console.log('=== Iniciando Mezcla Completa de Audio ===');

// 1. Obtener y ordenar todas las voces
const voiceFiles = fs.readdirSync(voicesDir)
  .filter(f => /\.(mp3|m4a|wav)$/i.test(f))
  .sort();

console.log(`Audios de voz encontrados: ${voiceFiles.length}`);

// 2. Concatenar todas las 19 voces en una sola pista continua
const listFile = path.join(audioDir, 'voices_list.txt');
const listContent = voiceFiles.map(f => `file '${path.join(voicesDir, f).replace(/\\/g, '/')}'`).join('\n');
fs.writeFileSync(listFile, listContent, 'utf8');

const combinedVoices = path.join(audioDir, 'all_voices.mp3');
console.log('1/3 Uniendo las 19 grabaciones de voz en orden secuencial...');
execSync(`${ffmpeg} -f concat -safe 0 -i "${listFile}" -c:a libmp3lame -q:a 2 "${combinedVoices}" -y`, { stdio: 'ignore' });

// 3. Mezclar con la música de fondo (loopeada para cubrir los ~2 minutos de narración)
// Aplicamos ducking: la música se atenúa automáticamente cuando la voz está sonando
console.log('2/3 Aplicando música de fondo con atenuación automática (ducking)...');
const musicTrack = path.join(audioDir, 'Soundtrack_Synthwave.mp3');
const sfxStarter = path.join(audioDir, 'SoundButton1_EngineStart.wav');
const sfxHorn = path.join(audioDir, 'SoundButton2_Horn.wav');

// El filtro une la voz completa ([0:a]) con la música en bucle ([1:a]), bajando la música
// para que la voz destaque claramente, e integrando los efectos
const filter = `
[1:a]aloop=loop=-1:size=2e+09,volume=0.35[bg];
[bg][0:a]sidechaincompress=threshold=0.08:ratio=5:attack=40:release=350[duckedMusic];
[duckedMusic][0:a]amix=inputs=2:duration=first:dropout_transition=2,volume=1.2[mixFinal]
`.trim().replace(/\n/g, '');

const cmd = `${ffmpeg} -i "${combinedVoices}" -i "${musicTrack}" -filter_complex "${filter}" -map "[mixFinal]" -codec:a libmp3lame -b:a 192k "${finalMp3}" -y`;
execSync(cmd);

console.log('3/3 ¡Mezcla completa finalizada!');
console.log(`Archivo generado con éxito en: ${finalMp3}`);
