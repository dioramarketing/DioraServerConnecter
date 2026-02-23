import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminExists = await prisma.user.findUnique({ where: { username: 'admin' } });
  if (adminExists) {
    console.log('Admin user already exists, skipping seed.');
    return;
  }

  const passwordHash = await bcrypt.hash('admin1234!', 12);
  const admin = await prisma.user.create({
    data: {
      username: 'admin',
      email: 'admin@dioramarketing.co.kr',
      passwordHash,
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  });

  await prisma.resourceAllocation.create({
    data: { userId: admin.id },
  });

  console.log(`Admin user created: ${admin.username} (${admin.id})`);
  console.log('Default password: admin1234! (change after first login)');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
