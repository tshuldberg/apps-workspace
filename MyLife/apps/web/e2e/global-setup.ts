import fs from 'node:fs';
import path from 'node:path';

const E2E_DB_PATH = path.join(__dirname, '..', '.tmp', 'e2e', 'mylife-hub-e2e.sqlite');

export default async function globalSetup() {
  fs.mkdirSync(path.dirname(E2E_DB_PATH), { recursive: true });

  for (const suffix of ['', '-wal', '-shm']) {
    const filePath = `${E2E_DB_PATH}${suffix}`;
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}
