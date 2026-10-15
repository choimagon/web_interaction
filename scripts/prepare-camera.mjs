import { copyFile, mkdir, readdir } from 'node:fs/promises';

// Keep the legacy runtime and its model files on the same origin. This also
// lets a Tizen installation serve them without a CDN or a module Worker.
const source = new URL('../node_modules/@mediapipe/hands/', import.meta.url);
const destination = new URL('../public/mediapipe/hands/', import.meta.url);
await mkdir(destination, { recursive: true });
const files = (await readdir(source)).filter((file) => /\.(js|wasm|data|tflite|binarypb)$/.test(file));
await Promise.all(files.map((file) => copyFile(new URL(file, source), new URL(file, destination))));
console.log(`Prepared ${files.length} local MediaPipe Hands assets.`);
