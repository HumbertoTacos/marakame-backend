import { PrismaClient, EstadoCama, AreaCentro, Rol, EstadoPaciente, TipoAcuerdoSeguimiento } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Iniciando Seed de Base de Datos Marakame (v2.0) ---');

  const salt = await bcrypt.genSalt(10);
  const commonPassword = await bcrypt.hash('Marakame2026!', salt);

  // 1. USUARIOS POR DEPARTAMENTO
  console.log('👥 Creando usuarios por departamento...');
  const usuarios = [
    { correo: 'admin@marakame.com', nombre: 'Roberto', apellidos: 'Admin', rol: Rol.ADMIN_GENERAL },
    { correo: 'medico@marakame.com', nombre: 'Dra. Laura', apellidos: 'García', rol: Rol.AREA_MEDICA },
    { correo: 'enfermeria@marakame.com', nombre: 'Juan', apellidos: 'Pérez', rol: Rol.ENFERMERIA },
    { correo: 'admisiones@marakame.com', nombre: 'Ana', apellidos: 'López', rol: Rol.ADMISIONES },
    { correo: 'psicologia@marakame.com', nombre: 'Lic. Martha', apellidos: 'Sánchez', rol: Rol.PSICOLOGIA },
    { correo: 'nutricion@marakame.com', nombre: 'Cecilia', apellidos: 'Ríos', rol: Rol.NUTRICION },
    { correo: 'finanzas@marakame.com', nombre: 'Ricardo', apellidos: 'Contador', rol: Rol.RRHH_FINANZAS },
    { correo: 'almacen@marakame.com', nombre: 'Pablo', apellidos: 'Logística', rol: Rol.ALMACEN },
  ];

  for (const u of usuarios) {
    await prisma.usuario.upsert({
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
  const areas: AreaCentro[] = [AreaCentro.HOMBRES, AreaCentro.MUJERES, AreaCentro.DETOX];
  for (const area of areas) {
    const habitacion = await prisma.habitacion.upsert({
      where: { nombre: `Habitación ${area}` },
      update: { area },
      create: { 
        nombre: `Habitación ${area}`, 
        capacidadMax: 10, 
        area 
      },
    });

    for (let i = 1; i <= 5; i++) {
      const numero = `${area.charAt(0)}-${i.toString().padStart(2, '0')}`;
      await prisma.cama.upsert({
        where: { numero },
        update: { habitacionId: habitacion.id },
        create: { 
          numero,
          codigo: numero,
          habitacionId: habitacion.id, 
          estado: EstadoCama.DISPONIBLE 
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
  console.log('🏥 Registrando pacientes y expedientes clínicos (Muestra Completa)...');
  
  // PACIENTE 1: INTERNADO (Flujo Completo)
  const pInternado = await prisma.paciente.create({
    data: {
      claveUnica: 'ADM-2026-001',
      nombre: 'Carlos',
      apellidoPaterno: 'Jiménez',
      apellidoMaterno: 'Sosa',
      fechaNacimiento: new Date('1990-05-15'),
      sexo: 'M',
      estado: EstadoPaciente.INTERNADO,
      sustancias: ['Alcohol', 'Tabaco'],
      direccion: 'Av. Siempre Viva 123, Tepic',
      areaDeseada: AreaCentro.HOMBRES,
    },
  });

  const expCarlos = await prisma.expediente.upsert({
    where: { pacienteId: pInternado.id },
    update: {},
    create: {
      pacienteId: pInternado.id,
      diagnosticoPrincipal: 'Dependencia al alcohol crónica (F10.2)',
      cuotaAsignada: 15000,
      saldoPendiente: 5000,
    },
  });

  // Asignar cama a Carlos
  await prisma.cama.update({
    where: { numero: 'H-01' },
    data: { estado: EstadoCama.OCUPADA, pacienteId: pInternado.id },
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
      observaciones: 'Paciente estable en su primer día de ingreso.',
    },
  });

  // Nota de Evolución
  await (prisma as any).notaEvolucion.create({
    data: {
      expedienteId: expCarlos.id,
      usuarioId: medico!.id,
      tipo: 'MEDICA',
      nota: 'El paciente presenta una evolución favorable. Se mantiene esquema de desintoxicación gradual.',
    },
  });

  // PACIENTE 2: PROSPECTO (CRM - Agenda)
  const pProspecto = await prisma.paciente.create({
    data: {
      nombre: 'María',
      apellidoPaterno: 'Rodríguez',
      apellidoMaterno: 'Pena',
      fechaNacimiento: new Date('1995-10-20'),
      sexo: 'F',
      estado: EstadoPaciente.PROSPECTO,
      sustancias: ['Cannabis'],
      direccion: 'Col. Centro, Xalisco',
    },
  });

  await prisma.primerContacto.create({
    data: {
      pacienteId: pProspecto.id,
      usuarioId: admisionista!.id,
      nombreLlamada: 'Elena Rodríguez',
      parentescoLlamada: 'Madre',
      nombrePaciente: 'María Rodríguez Pena',
      celularLlamada: '3111234567',
      sustancias: ['CANNABIS', 'TABACO'],
      dispuestoInternarse: 'SI',
      conclusionMedica: 'Interesada en internamiento voluntario. Se programa cita para mañana.',
      acuerdoSeguimiento: TipoAcuerdoSeguimiento.CITA_PROGRAMADA,
      fechaAcuerdo: new Date(new Date().getTime() + 24 * 60 * 60 * 1000), // Mañana
    },
  });

  // PACIENTE 3: EN VALORACIÓN (Bandeja Médica)
  const pValoracion = await prisma.paciente.create({
    data: {
      nombre: 'Fernando',
      apellidoPaterno: 'Gómez',
      apellidoMaterno: 'Arias',
      fechaNacimiento: new Date('1985-08-12'),
      sexo: 'M',
      estado: EstadoPaciente.EN_VALORACION,
      sustancias: ['Cristal', 'Metanfetaminas'],
      areaDeseada: AreaCentro.HOMBRES,
    },
  });

  await prisma.primerContacto.create({
    data: {
      pacienteId: pValoracion.id,
      usuarioId: admisionista!.id,
      nombreLlamada: 'Fernando Gómez',
      parentescoLlamada: 'PACIENTE',
      nombrePaciente: 'Fernando Gómez Arias',
      celularLlamada: '3119876543',
      sustancias: ['CRISTAL'],
      dispuestoInternarse: 'SI',
      conclusionMedica: 'Solicita valoración inmediata por crisis de consumo.',
      acuerdoSeguimiento: TipoAcuerdoSeguimiento.OTRO
    },
  });

  // 4.1 Valoración Médica (Nueva Estructura) para Fernando
  console.log('🩺 Generando valoración médica institucional para Fernando...');
  await prisma.valoracionMedica.create({
    data: {
      pacienteId: pValoracion.id,
      estado: 'BORRADOR',
      residente: 'Dr. Julián Martínez',
      tipoValoracion: 'PRESENCIAL',
      fechaValoracion: new Date(),
      horaValoracion: '11:45 AM',
      motivoConsulta: 'Crisis de ansiedad y deseo intenso de consumo (craving). Refiere haber consumido cristal hace 24 horas.',
      padecimientoActual: 'Paciente masculino que inicia consumo hace 5 años, con incremento notable en los últimos 6 meses. Presenta episodios de paranoia y pérdida de peso significativa.',
      sintomasGenerales: 'Taquicardia leve, pupilas dilatadas, insomnio de 3 días, irritabilidad extrema.',
      tratamientosPrevios: 'Anexo por 3 meses en 2024 (sin éxito), terapia psicológica ambulatoria.',
      tensionArterial: '135/85',
      frecuenciaCardiaca: '92',
      frecuenciaRespiratoria: '20',
      temperatura: '37.1',
      peso: '68',
      talla: '1.75',
      exploracionFisicaDesc: 'Buen estado de hidratación. Mucosas húmedas. Tórax con ruidos respiratorios normales. Abdomen blando, no doloroso.',
      examenMental: 'Consciente, orientado en 3 esferas. Discurso coherente pero acelerado. Afecto ansioso. No presenta alucinaciones en el momento.',
      impresionDiagnostica: 'Trastorno por consumo de estimulantes (Metanfetaminas) Grave [F15.2]. Trastorno de ansiedad generalizada inducido por sustancias.',
      pronostico: 'Reservado a evolución bajo tratamiento residencial.',
      planTratamiento: 'Ingreso a programa residencial de 3 meses. Manejo farmacológico para control de ansiedad y abstinencia. Terapia cognitivo-conductual.',
      esAptoParaIngreso: true
    }
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

  // 6. AGENDA Y CITAS
  console.log('📅 Programando citas y seguimiento...');
  await (prisma as any).citaAgenda.create({
    data: {
      pacienteId: pInternado.id,
      especialistaId: medico!.id,
      fechaHora: new Date(new Date().getTime() + 48 * 60 * 60 * 1000), // Pasado mañana
      motivo: 'Revisión médica semanal',
    },
  });
  
  // PACIENTE 4: EGRESADO + REFORZAMIENTO
  console.log('🎓 Registrando paciente egresado...');
  const pEgresado = await prisma.paciente.create({
    data: {
      claveUnica: 'ADM-2025-088',
      nombre: 'Elena',
      apellidoPaterno: 'Luna',
      apellidoMaterno: 'Mora',
      fechaNacimiento: new Date('1988-03-12'),
      sexo: 'F',
      estado: EstadoPaciente.EGRESADO,
      sustancias: ['Crystal'],
      direccion: 'Col. San Juan, Tepic',
    },
  });

  await prisma.programaReforzamiento.upsert({
    where: { pacienteId: pEgresado.id },
    update: {},
    create: {
      pacienteId: pEgresado.id,
      fechaInicio: new Date(),
      fechaFinEstimada: new Date(new Date().getTime() + 365 * 24 * 60 * 60 * 1000), 
      estado: 'ACTIVO',
      observaciones: 'Paciente en seguimiento post-egreso.',
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
