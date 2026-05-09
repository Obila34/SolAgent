import * as FileSystem from "expo-file-system";
import { Buffer } from "buffer";

type FileSystemWritingOptions = NonNullable<Parameters<typeof FileSystem.writeAsStringAsync>[2]>;

const BASE_URL = "https://api.elevenlabs.io/v1";
const VOICE_ID = "Rachel";
const STT_MODEL = "scribe_v1";
const TTS_MODEL = "eleven_turbo_v2";

const cache = new Map<string, string>();
const apiKey = process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY ?? "";

function cachePathForText(text: string): string {
  const safe = text.slice(0, 32).replace(/[^a-zA-Z0-9]+/g, "_").toLowerCase();
  // @ts-expect-error — expo-file-system root typings omit legacy cacheDirectory; it exists at runtime.
  const cacheDir = FileSystem.cacheDirectory ?? "";
  return `${cacheDir}tts_${safe}_${Date.now()}.mp3`;
}

export async function speechToText(audioUri: string): Promise<string> {
  const fileResponse = await fetch(audioUri);
  const blob = await fileResponse.blob();
  const formData = new FormData();
  formData.append("file", blob, "recording.m4a");
  formData.append("model_id", STT_MODEL);

  const response = await fetch(`${BASE_URL}/speech-to-text`, {
    method: "POST",
    headers: { "xi-api-key": apiKey },
    body: formData,
  });
  if (!response.ok) throw new Error("Speech transcription failed");
  const data = (await response.json()) as { text?: string };
  return data.text?.trim() ?? "";
}

export async function textToSpeech(text: string): Promise<string> {
  if (cache.has(text)) return cache.get(text) ?? "";
  const response = await fetch(`${BASE_URL}/text-to-speech/${VOICE_ID}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      model_id: TTS_MODEL,
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  });
  if (!response.ok) throw new Error("ElevenLabs request failed");
  const base64 = Buffer.from(await response.arrayBuffer()).toString("base64");
  const uri = cachePathForText(text);
  const writingOptions: FileSystemWritingOptions = { encoding: "base64" };
  await FileSystem.writeAsStringAsync(uri, base64, writingOptions);
  cache.set(text, uri);
  return uri;
}
