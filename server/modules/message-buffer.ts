import { nowIso } from "../helpers";

interface BufferEntry {
  messages: string[];
  firstAt: string;
  timer: ReturnType<typeof setTimeout>;
  resolvers: Array<(value: BufferedMessageResult) => void>;
}

export interface BufferedMessageResult {
  shouldProcess: boolean;
  text: string;
  messageCount: number;
  firstAt: string;
  flushedAt: string;
}

const buffers = new Map<string, BufferEntry>();
const DEFAULT_DELAY_MS = Number(process.env.AGENT_MESSAGE_BUFFER_MS || 2500);

export function enqueueBufferedMessage(key: string, text: string, delayMs = DEFAULT_DELAY_MS): Promise<BufferedMessageResult> {
  const cleanText = String(text || "").trim();
  const now = nowIso();

  return new Promise(resolve => {
    const existing = buffers.get(key);
    if (existing) {
      clearTimeout(existing.timer);
      existing.messages.push(cleanText);
      existing.resolvers.push(resolve);
      existing.timer = setTimeout(() => flush(key), delayMs);
      return;
    }

    const entry: BufferEntry = {
      messages: [cleanText],
      firstAt: now,
      resolvers: [resolve],
      timer: setTimeout(() => flush(key), delayMs),
    };
    buffers.set(key, entry);
  });
}

function flush(key: string): void {
  const entry = buffers.get(key);
  if (!entry) return;
  buffers.delete(key);

  const messages = entry.messages.filter(Boolean);
  const text = messages.join("\n");
  const result: BufferedMessageResult = {
    shouldProcess: true,
    text,
    messageCount: messages.length,
    firstAt: entry.firstAt,
    flushedAt: nowIso(),
  };

  entry.resolvers.forEach((resolve, index) => {
    resolve(index === entry.resolvers.length - 1
      ? result
      : { ...result, shouldProcess: false });
  });
}

export function getPendingBufferCount(): number {
  return buffers.size;
}
