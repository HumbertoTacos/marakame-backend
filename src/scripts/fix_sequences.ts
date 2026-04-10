import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixSequences() {
  console.log('--- Iniciando re-sincronización de secuencias ---');
  
  try {
    // Obtener todas las tablas en el esquema public
    const tables: any[] = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    `;

    for (const { table_name } of tables) {
      if (table_name === '_PrismaMigrations') continue;

      try {
        // Intentar resetear la secuencia de la columna 'id' para cada tabla
        // PostgreSQL: setval(sequencename, nextval, is_called)
        await prisma.$executeRawUnsafe(`
          SELECT setval(pg_get_serial_sequence('"${table_name}"', 'id'), coalesce(max(id), 0) + 1, false) 
          FROM "${table_name}"
        `);
        console.log(`✅ Secuencia reseteada para la tabla: ${table_name}`);
      } catch (err) {
        // Algunas tablas podrían no tener columna 'id' o secuencia, las ignoramos
        console.log(`ℹ️ Saltando tabla ${table_name} (posiblemente sin secuencia 'id')`);
      }
    }

    console.log('--- Sincronización completada exitosamente ---');
  } catch (error) {
    console.error('❌ Error fatal al sincronizar secuencias:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixSequences();
