/**
 * Isolated test for the audio extraction + whisper.cpp transcription pipeline.
 *
 * Usage:
 *   node scripts/test-transcription.mjs <path-to-video>
 *
 * First run downloads whisper.cpp + base.en model (~142 MB). Subsequent runs are instant.
 */

import { createRequire } from "module";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const require = createRequire(import.meta.url);
const ffmpegStatic = require("ffmpeg-static");
const ffmpeg = require("fluent-ffmpeg");
const { nodewhisper } = require("nodejs-whisper");

ffmpeg.setFfmpegPath(ffmpegStatic);

const videoPath = process.argv[2];

if (!videoPath) {
  console.error("Usage: node scripts/test-transcription.mjs <path-to-video>");
  process.exit(1);
}

if (!fs.existsSync(videoPath)) {
  console.error(`File not found: ${videoPath}`);
  process.exit(1);
}

async function extractAudio(srcVideoPath, audioPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(srcVideoPath)
      .outputOptions([
        "-vn",          // no video stream
        "-ar", "16000", // 16 kHz — required by whisper.cpp
        "-ac", "1",     // mono
        "-f", "wav",
      ])
      .output(audioPath)
      .on("end", () => resolve())
      .on("error", reject)
      .run();
  });
}

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ctx-split-test-"));
  const audioPath = path.join(tmpDir, "audio.wav");

  try {
    console.log(`Video:           ${path.resolve(videoPath)}`);
    console.log(`Temp dir:        ${tmpDir}`);
    console.log("");

    console.log("Step 1/2 — Extracting audio (16 kHz mono WAV)...");
    await extractAudio(videoPath, audioPath);
    const stats = fs.statSync(audioPath);
    console.log(`Audio extracted: ${audioPath} (${(stats.size / 1024).toFixed(1)} KB)`);
    console.log("");

    console.log("Step 2/2 — Transcribing with whisper.cpp (base.en)...");
    console.log("          (First run downloads model ~142 MB — takes 1-3 min)");
    const transcript = await nodewhisper(audioPath, {
      modelName: "base.en",
      autoDownloadModelName: "base.en",
      removeWavFileAfterTranscription: false,
      withCuda: false,
      whisperOptions: {
        outputInText: false,
        outputInVtt: false,
        outputInSrt: false,
        outputInCsv: false,
        translateToEnglish: false,
        wordTimestamps: false,
        timestamps_length: 20,
        splitOnWord: true,
      },
    });

    const text = typeof transcript === "string" ? transcript.trim() : JSON.stringify(transcript);

    console.log("");
    console.log("--- TRANSCRIPT ---");
    if (text.length === 0) {
      console.log("(empty — video may have no audio track)");
    } else {
      console.log(text);
    }
    console.log("-----------------");
    console.log(`\nTranscript length: ${text.length} characters`);
    console.log("Done.");
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error("\nFailed:", err);
  process.exit(1);
});
