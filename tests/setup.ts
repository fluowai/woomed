import { mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Each test worker gets its own temp data directory to prevent
// concurrent JSON file access between test files
const workerId = process.env.VITEST_WORKER_ID || '0';
const testDataDir = join(tmpdir(), `consultio-test-${workerId}-${Date.now()}`);
mkdirSync(testDataDir, { recursive: true });
process.env.DATA_DIR = testDataDir;
