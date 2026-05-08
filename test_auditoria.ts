import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    const count = await prisma.auditoria.count();
    console.log(`Auditoria count: ${count}`);
    
    const logs = await prisma.auditoria.findMany({
      include: {
        usuario: { select: { nombre: true, apellidos: true, rol: true } }
      },
      take: 2
    });
    console.log(JSON.stringify(logs, null, 2));
  } catch (e) {
    console.error('Error fetching auditoria:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
