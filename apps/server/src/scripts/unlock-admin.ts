import { prisma } from '../db/prisma';
import { authRepo } from '../db/repositories';

async function main(): Promise<void> {
  await authRepo.reset();
  console.log('Acceso del panel desbloqueado.');
  await prisma.$disconnect();
  process.exit(0);
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
