import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkCitas() {
  const citas = await prisma.primerContacto.findMany({
    where: { acuerdoSeguimiento: 'CITA_PROGRAMADA' },
    include: { paciente: true }
  });
  console.log('CITAS PROGRAMADAS EN DB:', JSON.stringify(citas, null, 2));
  await prisma.$disconnect();
}

checkCitas();
