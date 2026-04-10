import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Iniciando Seed de Base de Datos Marakame ---');

  const salt = await bcrypt.genSalt(10);
  const commonPassword = await bcrypt.hash('Marakame2026!', salt);

  // 1. USUARIOS POR DEPARTAMENTO
  console.log('👥 Creando usuarios por departamento...');
  const usuarios = [
    { correo: 'admin@marakame.com', nombre: 'Roberto', apellidos: 'Admin', rol: 'ADMIN_GENERAL' },
    { correo: 'medico@marakame.com', nombre: 'Dra. Laura', apellidos: 'García', rol: 'AREA_MEDICA' },
    { correo: 'enfermeria@marakame.com', nombre: 'Juan', apellidos: 'Pérez', rol: 'ENFERMERIA' },
    { correo: 'admisiones@marakame.com', nombre: 'Ana', apellidos: 'López', rol: 'ADMISIONES' },
    { correo: 'psicologia@marakame.com', nombre: 'Lic. Martha', apellidos: 'Sánchez', rol: 'PSICOLOGIA' },
    { correo: 'nutricion@marakame.com', nombre: 'Cecilia', apellidos: 'Ríos', rol: 'NUTRICION' },
  ];

  for (const u of usuarios) {
    await (prisma.usuario as any).upsert({
      where: { correo: u.correo },
      update: { passwordHash: commonPassword, rol: u.rol, activo: true },
      create: { ...u, passwordHash: commonPassword, activo: true },
    });
  }

  const medico = await prisma.usuario.findUnique({ where: { correo: 'medico@marakame.com' } });
  const enfermero = await prisma.usuario.findUnique({ where: { correo: 'enfermeria@marakame.com' } });
  const admisionista = await prisma.usuario.findUnique({ where: { correo: 'admisiones@marakame.com' } });

  // 2. CATÁLOGO DE CAMAS
  console.log('🛏️ Inicializando catálogo de habitaciones y camas...');
  const areas = ['HOMBRES', 'MUJERES', 'DETOX'];
  for (const area of areas) {
    const habitacion = await (prisma.habitacion as any).upsert({
      where: { nombre: `Habitación ${area}` },
      update: { area: area as any },
      create: { 
        nombre: `Habitación ${area}`, 
        capacidadMax: 10, 
        area: area as any 
      },
    });

    for (let i = 1; i <= 5; i++) {
      const numero = `${area.charAt(0)}-${i.toString().padStart(2, '0')}`;
      await (prisma.cama as any).upsert({
        where: { numero },
        update: { habitacionId: habitacion.id },
        create: { 
          numero, 
          habitacionId: habitacion.id, 
          estado: 'DISPONIBLE' 
        },
      });
    }
  }

  // 3. PRODUCTOS DE ALMACÉN
  console.log('📦 Poblado inventario de farmacia y suministros...');
  const productos = [
    { codigo: 'MED-001', nombre: 'Paracetamol 500mg', categoria: 'MEDICAMENTO', unidad: 'Caja 20 tabs', stockActual: 100 },
    { codigo: 'MED-002', nombre: 'Diazepam 5mg', categoria: 'MEDICAMENTO', unidad: 'Caja 20 tabs', stockActual: 20 },
    { codigo: 'MED-003', nombre: 'Omeprazol 20mg', categoria: 'MEDICAMENTO', unidad: 'Caja 30 caps', stockActual: 50 },
    { codigo: 'INS-001', nombre: 'Gasas estériles', categoria: 'INSUMO_MEDICO', unidad: 'Sobre 10x10', stockActual: 500 },
    { codigo: 'INS-002', nombre: 'Jeringas 5ml', categoria: 'INSUMO_MEDICO', unidad: 'Pieza', stockActual: 200 },
    { codigo: 'LIM-001', nombre: 'Alcohol Isopropílico', categoria: 'LIMPIEZA', unidad: 'Litro', stockActual: 10 },
  ];

  for (const p of productos) {
    await (prisma.almacenProducto as any).upsert({
      where: { codigo: p.codigo },
      update: { stockActual: p.stockActual },
      create: { ...p, stockMinimo: 10 },
    });
  }

  // 4. PACIENTES Y EXPEDIENTES
  console.log('🏥 Registrando pacientes y expedientes clínicos...');
  
  // PACIENTE 1: INTERNADO
  const pInternado = await (prisma.paciente as any).create({
    data: {
      nombre: 'Carlos',
      apellidoPaterno: 'Jiménez',
      apellidoMaterno: 'Sosa',
      fechaNacimiento: new Date('1990-05-15'),
      sexo: 'M',
      estado: 'INTERNADO',
      sustancias: ['Alcohol', 'Tabaco'],
      direccion: 'Av. Siempre Viva 123, Tepic',
    },
  });

  const expCarlos = await prisma.expediente.upsert({
    where: { pacienteId: pInternado.id },
    update: {},
    create: {
      pacienteId: pInternado.id,
      diagnosticoPrincipal: 'Dependencia al alcohol crónica',
      cuotaAsignada: 15000,
      saldoPendiente: 5000,
    },
  });

  // Asignar cama a Carlos
  await (prisma.cama as any).update({
    where: { numero: 'H-01' },
    data: { estado: 'OCUPADA', pacienteId: pInternado.id },
  });

  // Agregar Signos Vitales para Carlos
  await (prisma as any).signoVital.create({
    data: {
      expedienteId: expCarlos.id,
      usuarioId: enfermero!.id,
      presionArterial: '120/80',
      temperatura: 36.5,
      frecuenciaCardiaca: 72,
      frecuenciaRespiratoria: 18,
      oxigenacion: 98,
      peso: 75.5,
      observaciones: 'Paciente estable en su segundo día.',
    },
  });

  // Nota de Evolución
  await (prisma as any).notaEvolucion.create({
    data: {
      expedienteId: expCarlos.id,
      usuarioId: medico!.id,
      tipo: 'MEDICA',
      nota: 'El paciente presenta una evolución favorable. Se mantiene esquema de desintoxicación gradual. Sin reporte de crisis convulsivas ni delirium.',
    },
  });

  // PACIENTE 2: PROSPECTO (Solo primer contacto)
  const pProspecto = await (prisma.paciente as any).create({
    data: {
      nombre: 'María',
      apellidoPaterno: 'Rodríguez',
      apellidoMaterno: 'Pena',
      fechaNacimiento: new Date('1995-10-20'),
      sexo: 'F',
      estado: 'PROSPECTO',
      sustancias: ['Cannabis'],
      direccion: 'Col. Centro, Xalisco',
    },
  });

  await prisma.primerContacto.create({
    data: {
      pacienteId: pProspecto.id,
      usuarioId: admisionista!.id,
      dia: 'Lunes',
      solicitanteNombre: 'Elena Rodríguez',
      relacionPaciente: 'Madre',
      dispuestoInternarse: 'SI',
      observaciones: 'Interesada en internamiento voluntario para su hija.',
    },
  });

  // 5. FINANZAS
  console.log('💰 Generando movimientos financieros...');
  await (prisma as any).cargoPaciente.create({
    data: {
      pacienteId: pInternado.id,
      usuarioCargaId: admisionista!.id,
      monto: 15000,
      concepto: 'Cuota de recuperación - Mes 1',
    },
  });

  await (prisma as any).pagoPaciente.create({
    data: {
      pacienteId: pInternado.id,
      usuarioRecibeId: admisionista!.id,
      monto: 10000,
      metodoPago: 'TRANSFERENCIA',
      concepto: 'Pago inicial cuota mes 1',
    },
  });

  // 6. AGENDA
  console.log('📅 Programando citas en la agenda...');
  await (prisma as any).citaAgenda.create({
    data: {
      pacienteId: pInternado.id,
      especialistaId: medico!.id,
      fechaHora: new Date(new Date().getTime() + 24 * 60 * 60 * 1000), // Mañana
      motivo: 'Revisión médica semanal',
    },
  });
  
  // PACIENTE 3: EGRESADO + REFORZAMIENTO
  console.log('🎓 Registrando paciente egresado y programa de reforzamiento...');
  const pEgresado = await (prisma.paciente as any).create({
    data: {
      nombre: 'Elena',
      apellidoPaterno: 'Luna',
      apellidoMaterno: 'Mora',
      fechaNacimiento: new Date('1988-03-12'),
      sexo: 'F',
      estado: 'EGRESADO',
      sustancias: ['Crystal'],
      direccion: 'Col. San Juan, Tepic',
    },
  });

  await (prisma as any).programaReforzamiento.upsert({
    where: { pacienteId: pEgresado.id },
    update: {},
    create: {
      pacienteId: pEgresado.id,
      fechaInicio: new Date(),
      fechaFinEstimada: new Date(new Date().getTime() + 365 * 24 * 60 * 60 * 1000), // 1 año después
      estado: 'ACTIVO',
      observaciones: 'Paciente inicia programa de seguimiento de un año tras egreso exitoso.',
    },
  });

  console.log('✅ Seed completado con éxito 🚀');
}

main()
  .catch((e) => {
    console.error('❌ Error ejecutando el seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
