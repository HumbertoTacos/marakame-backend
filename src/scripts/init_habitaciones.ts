import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Iniciando script de inicialización de Habitaciones y Camas...');

  // 1. Crear Habitaciones A, B, C, D para cada Área (HOMBRES, MUJERES, DETOX)
  const areas: ('HOMBRES' | 'MUJERES' | 'DETOX')[] = ['HOMBRES', 'MUJERES', 'DETOX'];
  const habitacionNombres = ['A', 'B', 'C', 'D'];

  console.log('--- Creando Habitaciones ---');
  for (const area of areas) {
    for (const nombre of habitacionNombres) {
      await prisma.habitacion.upsert({
        where: { id: 0 }, // No importa mucho para el upsert si no hay id
        create: {
          nombre,
          area,
          capacidadMax: 4,
        },
        update: {},
      });
      console.log(`✅ Habitación ${nombre} creada en área ${area}`);
    }
  }

  // 2. Obtener todas las habitaciones creadas
  const todasLasHabitaciones = await prisma.habitacion.findMany();

  // 3. Obtener todas las camas actuales (sin habitación)
  const todasLasCamas = await prisma.cama.findMany({
    where: { habitacionId: null }
  });

  console.log(`--- Asignando ${todasLasCamas.length} camas a habitaciones ---`);

  // 4. Distribuir las camas (asumimos una distribución secuencial)
  // Nota: Dado que antes las camas tenían 'area', intentaremos respetar esa área si es posible
  // Pero como acabamos de borrar la columna 'area', tendremos que usar la lógica secuencial
  // o basarnos en el prefijo del código si existe (ej: "H-01")
  
  for (let i = 0; i < todasLasCamas.length; i++) {
    const cama = todasLasCamas[i];
    
    // Buscar una habitación que tenga espacio (capacidad < 4)
    // Para simplificar iniciamos con las habitaciones de HOMBRES
    const habIndex = Math.floor(i / 4); // 4 camas por habitación
    const habitacionDestino = todasLasHabitaciones[habIndex] || todasLasHabitaciones[0];

    await prisma.cama.update({
      where: { id: cama.id },
      data: { habitacionId: habitacionDestino.id }
    });
    console.log(`✅ Cama ${cama.numero} asignada a Habitación ${habitacionDestino.nombre} (${habitacionDestino.area})`);
  }

  console.log('✨ Proceso de inicialización completado con éxito.');
}

main()
  .catch((e) => {
    console.error('❌ Error durante la inicialización:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
