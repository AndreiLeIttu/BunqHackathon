import Anthropic from "@anthropic-ai/sdk";
import ffmpegPath from "ffmpeg-static";
import ffmpeg from "fluent-ffmpeg";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { nodewhisper } from "nodejs-whisper";
import { AnalysisResult } from "@/types";

if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);

const MOCK_RESULT: AnalysisResult = {
  total_amount: 127.5,
  currency: "EUR",
  restaurant_name: "La Bella Italia",
  is_mock: true,
  raw_items: [
    { name: "Ribeye Steak", price: 28.0 },
    { name: "House Wine", price: 4.5 },
    { name: "Salmon Fillet", price: 24.0 },
    { name: "Tiramisu", price: 8.0 },
    { name: "Wagyu Burger", price: 26.0 },
    { name: "Beer x2", price: 9.0 },
    { name: "Pasta Carbonara", price: 19.0 },
    { name: "Aperol Spritz", price: 9.0 },
  ],
  splits: [
    {
      name: "Alex",
      amount_owed: 32.5,
      justification: "Ordered the ribeye steak and a glass of house wine",
      items: ["Ribeye Steak - €28.00", "House Wine - €4.50"],
    },
    {
      name: "Sarah",
      amount_owed: 28.0,
      justification: "Had the salmon fillet and shared the tiramisu",
      items: ["Salmon Fillet - €24.00", "Tiramisu (shared) - €4.00"],
    },
    {
      name: "Marco",
      amount_owed: 35.0,
      justification: "Ordered the wagyu burger and two beers",
      items: ["Wagyu Burger - €26.00", "Beer x2 - €9.00"],
    },
    {
      name: "Emma",
      amount_owed: 32.0,
      justification: "Had the pasta carbonara, a cocktail, and shared tiramisu",
      items: [
        "Pasta Carbonara - €19.00",
        "Aperol Spritz - €9.00",
        "Tiramisu (shared) - €4.00",
      ],
    },
  ],
};

const SYSTEM_PROMPT = `You are a receipt and conversation analyzer for a bill-splitting app.
You will receive several video frames (screenshots taken every few seconds) from a short dinner video,
and optionally an audio transcript of what was said during the video.

The video shows a restaurant receipt and/or people discussing who ordered what.

Analyze ALL frames carefully — the receipt may appear in one frame, and people may be talking in others.
If an audio transcript is provided, use it as the PRIMARY source for identifying who ordered which items.
Cross-reference the transcript with receipt items visible in the frames to build accurate splits.

Return ONLY a valid JSON object with this exact structure (no markdown, no explanation):
{
  "total_amount": <number — total bill amount>,
  "currency": <string — currency code e.g. "EUR", "USD">,
  "restaurant_name": <string or null>,
  "raw_items": [
    { "name": <string — item name>, "price": <number — item price> }
  ],
  "splits": [
    {
      "name": <string — person's first name as visible/mentioned>,
      "amount_owed": <number — total they owe>,
      "justification": <string — brief explanation of what they ordered>,
      "items": [<string — "Item Name - €price" format>]
    }
  ]
}

Rules:
- Read receipt items and prices from the video frames
- Use the audio transcript (if provided) to determine who ordered what
- Split shared items evenly among the people who shared them
- Ensure all split amounts sum to total_amount
- If you cannot read the receipt clearly, make reasonable estimates based on visible context
- Return ONLY the JSON object`;

function extractFramesFromFile(videoPath: string, tmpDir: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const framePattern = path.join(tmpDir, "frame-%02d.jpg");

    ffmpeg(videoPath)
      .outputOptions([
        "-vf", "fps=1/4,scale=1280:-1",
        "-q:v", "4",
        "-frames:v", "8",
      ])
      .output(framePattern)
      .on("end", () => {
        const frames: string[] = [];
        let i = 1;
        while (true) {
          const framePath = path.join(tmpDir, `frame-${String(i).padStart(2, "0")}.jpg`);
          if (!fs.existsSync(framePath)) break;
          frames.push(fs.readFileSync(framePath).toString("base64"));
          i++;
          if (i > 8) break;
        }
        resolve(frames);
      })
      .on("error", reject)
      .run();
  });
}

function extractAudioFromFile(videoPath: string, audioPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
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

async function transcribeAudio(audioPath: string): Promise<string> {
  const result = await nodewhisper(audioPath, {
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
  return typeof result === "string" ? result.trim() : JSON.stringify(result);
}

export async function analyzeVideoWithClaude(
  videoBuffer: Buffer,
  mimeType: string
): Promise<AnalysisResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.warn("ANTHROPIC_API_KEY not set — returning mock data");
    await new Promise((r) => setTimeout(r, 2000));
    return MOCK_RESULT;
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ctx-split-"));
  const ext = mimeType.includes("quicktime") ? "mov" : "mp4";
  const videoPath = path.join(tmpDir, `input.${ext}`);
  const audioPath = path.join(tmpDir, "audio.wav");

  fs.writeFileSync(videoPath, videoBuffer);

  let frames: string[] = [];
  let transcript = "";

  try {
    // Extract frames and audio from the video in parallel
    const [extractedFrames] = await Promise.all([
      extractFramesFromFile(videoPath, tmpDir).catch((err) => {
        console.error("Frame extraction failed:", err);
        return [] as string[];
      }),
      extractAudioFromFile(videoPath, audioPath).catch((err) => {
        console.warn("Audio extraction failed (transcription will be skipped):", err);
      }),
    ]);
    frames = extractedFrames;

    // Transcribe audio with whisper.cpp if the WAV was produced
    if (fs.existsSync(audioPath)) {
      try {
        console.log("Transcribing audio with whisper.cpp...");
        transcript = await transcribeAudio(audioPath);
        console.log(`Transcription (${transcript.length} chars): ${transcript.slice(0, 200)}`);
      } catch (err) {
        console.warn("Whisper transcription failed (will proceed with frames only):", err);
      }
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  if (frames.length === 0) {
    console.warn("No frames extracted — returning mock data");
    return MOCK_RESULT;
  }

  const client = new Anthropic({ apiKey });

  const imageBlocks: Anthropic.ImageBlockParam[] = frames.map((b64) => ({
    type: "image",
    source: { type: "base64", media_type: "image/jpeg", data: b64 },
  }));

  const userText = transcript
    ? `These are ${frames.length} frames from the dinner video.\n\nAudio transcript of what was said:\n"""\n${transcript}\n"""\n\nPlease analyze the frames and transcript to return the JSON split result.`
    : `These are ${frames.length} frames extracted from the dinner video (no audio transcript available). Please analyze them and return the JSON split result.`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: [
          ...imageBlocks,
          { type: "text", text: userText },
        ],
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";

  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  return JSON.parse(cleaned) as AnalysisResult;
}
