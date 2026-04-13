import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const data = await prisma.primerContacto.findMany({
    select: {
      id: true,
      nombrePaciente: true,
      acuerdoSeguimiento: true,
      fechaAcuerdo: true,
    }
  });
  console.log('DB_DUMP:', JSON.stringify(data, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
