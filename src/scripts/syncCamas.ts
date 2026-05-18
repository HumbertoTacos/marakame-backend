import { PrismaClient, AreaCentro, EstadoCama } from '@prisma/client';

// Capacidad institucional del centro Marakame — 50 camas totales.
// Cambiar aquí si la institución reorganiza la distribución.
export const CAMAS_POR_AREA: Record<AreaCentro, number> = {
  HOMBRES: 22,
  MUJERES: 18,
  DETOX: 10,
};

/**
 * Sincroniza habitaciones y camas con la capacidad institucional.
 * Idempotente y no destructivo:
 *   - Crea la habitación de cada área si no existe.
 *   - Ajusta capacidadMax al objetivo declarado.
 *   - Agrega las camas faltantes (códigos H-NN / M-NN / D-NN).
 *   - No elimina camas existentes ni cambia su estado/ocupación.
 */
export async function syncCamas(prisma: PrismaClient) {
  for (const area of Object.keys(CAMAS_POR_AREA) as AreaCentro[]) {
    const objetivo = CAMAS_POR_AREA[area];
    const prefijo = area.charAt(0); // 'H', 'M', 'D'

    const habitacion = await prisma.habitacion.upsert({
      where: { nombre: `Habitación ${area}` },
      update: { area, capacidadMax: objetivo },
      create: { nombre: `Habitación ${area}`, capacidadMax: objetivo, area },
    });

    for (let i = 1; i <= objetivo; i++) {
      const numero = `${prefijo}-${i.toString().padStart(2, '0')}`;
      await prisma.cama.upsert({
        where: { numero },
        update: { habitacionId: habitacion.id },
        create: {
          numero,
          codigo: numero,
          habitacionId: habitacion.id,
          estado: EstadoCama.DISPONIBLE,
        },
      });
    }
  }
}

// Permitir ejecución como script independiente: `npx ts-node src/scripts/syncCamas.ts`
if (require.main === module) {
  const prisma = new PrismaClient();
  syncCamas(prisma)
    .then(async () => {
      const total = await prisma.cama.count();
      console.log(`✅ Sincronización completa. Total de camas: ${total}`);
    })
    .catch((e) => {
      console.error('❌ Error sincronizando camas:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
