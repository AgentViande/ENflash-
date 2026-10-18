import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const modelDir = path.join(rootDir, 'resources', 'models', 'Kokoro-82M-v1.0-ONNX');
const onnxDir = path.join(modelDir, 'onnx');

const KOKORO_REPO_BASE = 'https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main';
const FILES = [
  { path: path.join(modelDir, 'config.json'), url: `${KOKORO_REPO_BASE}/config.json`, minSize: 30 },
  { path: path.join(modelDir, 'tokenizer.json'), url: `${KOKORO_REPO_BASE}/tokenizer.json`, minSize: 2000 },
  { path: path.join(modelDir, 'tokenizer_config.json'), url: `${KOKORO_REPO_BASE}/tokenizer_config.json`, minSize: 50 },
  { path: path.join(onnxDir, 'model_quantized.onnx'), url: `${KOKORO_REPO_BASE}/onnx/model_quantized.onnx`, minSize: 80000000 },
];

async function prepare() {
  console.log('[prepare-models] Vérification des modèles Kokoro-82M...');
  if (!fs.existsSync(modelDir)) fs.mkdirSync(modelDir, { recursive: true });
  if (!fs.existsSync(onnxDir)) fs.mkdirSync(onnxDir, { recursive: true });

  for (const file of FILES) {
    if (fs.existsSync(file.path)) {
      const stat = fs.statSync(file.path);
      if (stat.size >= file.minSize) {
        console.log(`[prepare-models] ✓ ${path.basename(file.path)} (${(stat.size / 1024 / 1024).toFixed(1)} Mo) présent`);
        continue;
      }
    }

    console.log(`[prepare-models] Téléchargement de ${path.basename(file.path)} depuis Hugging Face...`);
    const res = await fetch(file.url, { redirect: 'follow' });
    if (!res.ok) {
      throw new Error(`Échec du téléchargement de ${file.url} (${res.status})`);
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(file.path, buffer);
    console.log(`[prepare-models] ✓ ${path.basename(file.path)} téléchargé (${(buffer.length / 1024 / 1024).toFixed(1)} Mo)`);
  }

  console.log('[prepare-models] Modèles Kokoro-82M prêts et vérifiés !');
}

prepare().catch((err) => {
  console.error('[prepare-models] Erreur :', err);
  process.exit(1);
});
