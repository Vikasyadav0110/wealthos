import { promises as fs } from 'fs';
import path from 'path';
import './guard'; // Ensure server-side only execution

const DATA_DIR = path.join(process.cwd(), 'data');
const FILE_PATH = path.join(DATA_DIR, 'wealthos-data.json');

// Simple write lock to avoid concurrent write corruption
let isWriting = false;
const writeQueue: Array<() => void> = [];

async function processWriteQueue() {
  if (isWriting || writeQueue.length === 0) return;
  isWriting = true;
  
  const nextWrite = writeQueue.shift();
  if (nextWrite) {
    try {
      await nextWrite();
    } finally {
      isWriting = false;
      // Process next in queue on the next tick
      setImmediate(processWriteQueue);
    }
  }
}

async function ensureDataDir() {
  try {
    await fs.access(DATA_DIR);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }
}

export async function readDataStore(): Promise<Record<string, unknown>> {
  try {
    await ensureDataDir();
    const data = await fs.readFile(FILE_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (err: unknown) {
    // If file doesn't exist or is empty/corrupt, return empty object
    if ((err as NodeJS.ErrnoException)?.code === 'ENOENT' || err instanceof SyntaxError) {
      return {};
    }
    throw err;
  }
}

export async function writeDataStore(data: Record<string, unknown>): Promise<void> {
  return new Promise((resolve, reject) => {
    writeQueue.push(async () => {
      try {
        await ensureDataDir();
        // Write to a temporary file first, then rename for atomicity (prevents corruption if process dies mid-write)
        const tempPath = `${FILE_PATH}.tmp`;
        await fs.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf-8');
        await fs.rename(tempPath, FILE_PATH);
        resolve();
      } catch (error) {
        reject(error);
      }
    });
    
    processWriteQueue();
  });
}
