const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const sustancias = [
  'ALCOHOL', 'COCAÍNA', 'MARIHUANA', 'BASE', 'ÉXTASIS', 
  'CRISTAL', 'TABACO', 'BZD', 'INHALANTES', 'TCA', 
  'LUDOPATÍA', 'ÁCIDOS'
];

async function main() {
  console.log('Iniciando carga de catálogo de sustancias...');
  
  for (const s of sustancias) {
    try {
      await prisma.sustancia.upsert({
        where: { nombre: s },
        update: {},
        create: { nombre: s, activo: true }
      });
      console.log(`Cargada: ${s}`);
    } catch (err) {
      console.error(`Error cargando ${s}:`, err.message);
    }
  }
  
  console.log('Carga completada.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
