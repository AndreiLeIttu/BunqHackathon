/**
 * Downloads a pre-built whisper-cli.exe (v1.7.5 for Windows x64) and the
 * base.en model into the locations nodejs-whisper expects.
 *
 * Run once before using the app:
 *   node scripts/setup-whisper.mjs
 */

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

// Resolve paths the same way nodejs-whisper does
const WHISPER_CPP_PATH = path.join(
  path.dirname(require.resolve("nodejs-whisper/package.json")),
  "cpp",
  "whisper.cpp"
);
const EXE_PATH = path.join(WHISPER_CPP_PATH, "build", "bin", "Release", "whisper-cli.exe");
const MODEL_PATH = path.join(WHISPER_CPP_PATH, "models", "ggml-base.en.bin");
const MODEL_URL = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin";
const RELEASE_URL =
  "https://github.com/ggml-org/whisper.cpp/releases/download/v1.7.6/whisper-bin-x64.zip";

function ps(command) {
  execSync(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${command}"`, {
    stdio: "inherit",
  });
}

async function downloadBinary() {
  if (fs.existsSync(EXE_PATH)) {
    console.log("  whisper-cli.exe already present — skipping.");
    return;
  }

  const zipPath = path.join(os.tmpdir(), "whisper-bin-x64.zip");
  const extractDir = path.join(os.tmpdir(), "whisper-bin-x64");

  console.log(`  Downloading ${RELEASE_URL}`);
  ps(`Invoke-WebRequest -Uri '${RELEASE_URL}' -OutFile '${zipPath}'`);

  console.log("  Extracting zip...");
  if (fs.existsSync(extractDir)) fs.rmSync(extractDir, { recursive: true, force: true });
  ps(`Expand-Archive -Path '${zipPath}' -DestinationPath '${extractDir}' -Force`);

  // Find whisper-cli.exe anywhere inside the extracted directory
  const findExe = execSync(
    `powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-ChildItem -Recurse -Filter 'whisper-cli.exe' '${extractDir}' | Select-Object -First 1 -ExpandProperty FullName"`,
    { encoding: "utf8" }
  ).trim();

  if (!findExe) {
    throw new Error(
      "whisper-cli.exe not found in the downloaded zip. The release asset may have changed — check https://github.com/ggerganov/whisper.cpp/releases/tag/v1.7.5"
    );
  }

  fs.mkdirSync(path.dirname(EXE_PATH), { recursive: true });
  fs.copyFileSync(findExe, EXE_PATH);

  // Also copy any DLLs sitting next to the exe (e.g. ggml.dll)
  const exeDir = path.dirname(findExe);
  for (const file of fs.readdirSync(exeDir)) {
    if (file.endsWith(".dll")) {
      fs.copyFileSync(path.join(exeDir, file), path.join(path.dirname(EXE_PATH), file));
    }
  }

  fs.rmSync(zipPath, { force: true });
  fs.rmSync(extractDir, { recursive: true, force: true });

  console.log(`  Installed: ${EXE_PATH}`);
}

async function downloadModel() {
  if (fs.existsSync(MODEL_PATH)) {
    console.log("  ggml-base.en.bin already present — skipping.");
    return;
  }

  fs.mkdirSync(path.dirname(MODEL_PATH), { recursive: true });
  console.log(`  Downloading ${MODEL_URL}`);
  console.log("  (this is ~142 MB, may take a minute...)");
  ps(`Invoke-WebRequest -Uri '${MODEL_URL}' -OutFile '${MODEL_PATH}'`);
  console.log(`  Installed: ${MODEL_PATH}`);
}

console.log("\n=== whisper.cpp setup ===\n");

console.log("[1/2] whisper-cli.exe");
await downloadBinary();

console.log("\n[2/2] base.en model");
await downloadModel();

console.log("\nDone. You can now run npm run dev and upload a video.\n");
