import fs from 'fs/promises';
import { createReadStream, ReadStream } from 'fs';
import path from 'path';
import os from 'os';
import { randomUUID } from 'crypto';
import { Readable } from 'stream';
import OpenAI from 'openai';
import fetch from 'node-fetch';

export interface WordToken {
  text: string;
  start: number;
  end: number;
}

export interface TranscriptionResult {
  text: string;
  words: WordToken[];
  vttString: string;
}

const TEMP_DIR = process.env.VIDEO_TEMP_DIR || path.join(os.tmpdir(), 'video-processing');

async function ensureTempDir() {
  await fs.mkdir(TEMP_DIR, { recursive: true }).catch(() => undefined);
}

async function bufferToTempFile(buffer: Buffer, extension = '.mp3'): Promise<string> {
  await ensureTempDir();
  const tempPath = path.join(TEMP_DIR, `${randomUUID()}${extension}`);
  await fs.writeFile(tempPath, buffer);
  return tempPath;
}

function toFileStream(input: Buffer | string): { stream: ReadStream | Readable; cleanup?: () => Promise<void> } {
  if (Buffer.isBuffer(input)) {
    const stream = Readable.from(input);
    return { stream };
  }

  const resolved = path.resolve(input);
  return {
    stream: createReadStream(resolved),
  };
}

function segmentsToWords(segments: any[]): WordToken[] {
  if (!Array.isArray(segments)) return [];
  const words: WordToken[] = [];

  for (const segment of segments) {
    if (Array.isArray(segment?.words)) {
      for (const word of segment.words) {
        if (typeof word?.word === 'string') {
          words.push({
            text: word.word.trim(),
            start: Number(word.start ?? segment.start ?? 0),
            end: Number(word.end ?? segment.end ?? word.start ?? 0),
          });
        }
      }
      continue;
    }

    if (typeof segment?.text === 'string') {
      words.push({
        text: segment.text.trim(),
        start: Number(segment.start ?? 0),
        end: Number(segment.end ?? Number(segment.start ?? 0) + Number(segment.duration ?? 0)),
      });
    }
  }

  return words;
}

function buildVttFromWords(words: WordToken[]): string {
  if (!words.length) return '';
  const lines: string[] = ['WEBVTT', ''];
  let index = 1;

  for (const token of words) {
    const start = secondsToTimestamp(token.start);
    const end = secondsToTimestamp(token.end > token.start ? token.end : token.start + 0.6);
    lines.push(`${index++}`);
    lines.push(`${start} --> ${end}`);
    lines.push(token.text);
    lines.push('');
  }

  return lines.join('\n');
}

function secondsToTimestamp(seconds: number): string {
  const date = new Date(Math.max(seconds, 0) * 1000);
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const secs = String(date.getUTCSeconds()).padStart(2, '0');
  const millis = String(date.getUTCMilliseconds()).padStart(3, '0');
  return `${hours}:${minutes}:${secs}.${millis}`;
}

async function transcribeWithOpenAI(input: Buffer | string): Promise<TranscriptionResult | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const client = new OpenAI({ apiKey });
  const { stream } = toFileStream(input);

  const response: any = await client.audio.transcriptions.create({
    model: 'whisper-1',
    file: stream as any,
    response_format: 'verbose_json',
  });

  const text: string = response?.text ?? '';
  const words = segmentsToWords(response?.segments ?? []);
  const vttString = response?.segments
    ? buildVttFromWords(words)
    : response?.text
    ? `WEBVTT\n\n1\n00:00:00.000 --> 00:00:10.000\n${text}\n`
    : '';

  return { text, words, vttString };
}

async function transcribeWithReplicate(input: Buffer | string): Promise<TranscriptionResult | null> {
  const apiKey = process.env.REPLICATE_API_KEY;
  if (!apiKey) return null;

  let filePath: string | undefined;
  let buffer: Buffer;

  if (Buffer.isBuffer(input)) {
    buffer = input;
  } else {
    buffer = await fs.readFile(path.resolve(input));
  }

  filePath = await bufferToTempFile(buffer);

  try {
    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Token ${apiKey}`,
      },
      body: JSON.stringify({
        version: 'b23e348c3ba5b73307039e8c2625ff52ec3b2f5db78402a26c6d108aeda6f324',
        input: {
          audio: `data:audio/mp3;base64,${buffer.toString('base64')}`,
        },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Replicate request failed: ${err}`);
    }

    const prediction: any = await response.json();

    const text: string = prediction?.output?.text ?? prediction?.output ?? '';
    const segments = prediction?.output?.segments ?? [];
    const words = segmentsToWords(segments);
    const vttString = buildVttFromWords(words);

    return { text, words, vttString };
  } finally {
    if (filePath) {
      await fs.rm(filePath, { force: true }).catch(() => undefined);
    }
  }
}

export async function transcribeAudio(input: Buffer | string): Promise<TranscriptionResult> {
  const openAiResult = await transcribeWithOpenAI(input);
  if (openAiResult) return openAiResult;

  const replicateResult = await transcribeWithReplicate(input);
  if (replicateResult) return replicateResult;

  throw new Error('No transcription provider configured. Please set OPENAI_API_KEY or REPLICATE_API_KEY.');
}
