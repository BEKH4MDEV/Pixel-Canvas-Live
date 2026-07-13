import fs from 'node:fs';
import path from 'node:path';

const dbPath = path.resolve(process.cwd(), 'prisma/data/canvas.db');
const backupDir = path.resolve(process.cwd(), process.env.BACKUP_PATH ?? './backups');

if (!fs.existsSync(dbPath)) {
  console.error(`No se encontro la base en ${dbPath}`);
  process.exit(1);
}

fs.mkdirSync(backupDir, { recursive: true });
const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
const dest = path.join(backupDir, `canvas_${stamp}.db`);
fs.copyFileSync(dbPath, dest);
console.log(`Copia de seguridad creada: ${dest}`);
