import { 
  PrismaClient, 
  EstadoCama, 
  AreaCentro, 
  Rol, 
  EstadoPaciente, 
  TipoAcuerdoSeguimiento, 
  EstadoNomina,
  RegimenLaboral,     
  TipoIncidencia      
} from '@prisma/client';
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
    // Administración General: usuario "paraguas" del depto. de Administración (alberga RH y Finanzas).
    // Conserva el rol legacy RRHH_FINANZAS porque puede actuar como ambos cuando hace falta.
    { correo: 'administracion@marakame.com', nombre: 'Administración', apellidos: 'General', rol: Rol.RRHH_FINANZAS },
    { correo: 'almacen@marakame.com', nombre: 'Pablo', apellidos: 'Logística', rol: Rol.ALMACEN },
    { correo: 'jefemedico@marakame.com', nombre: 'Dr. Carlos', apellidos: 'Ramírez', rol: Rol.JEFE_MEDICO },
    // Roles dedicados del flujo de pre-nómina (separados del rol legacy RRHH_FINANZAS)
    { correo: 'rrhh@marakame.com',         nombre: 'Lucía',    apellidos: 'Vega',     rol: Rol.RECURSOS_HUMANOS },
    { correo: 'financieros@marakame.com',  nombre: 'Marco',    apellidos: 'Tesorero', rol: Rol.RECURSOS_FINANCIEROS },
    { correo: 'jefatura@marakame.com',     nombre: 'Patricia', apellidos: 'Mendoza',  rol: Rol.JEFE_ADMINISTRATIVO },
  ];

  for (const u of usuarios) {
    await prisma.usuario.upsert({
      where: { correo: u.correo },
      update: { passwordHash: commonPassword, rol: u.rol, activo: true },
      create: { ...u, passwordHash: commonPassword, activo: true },
    });
  }

  const admin = await prisma.usuario.findUnique({ where: { correo: 'admin@marakame.com' } });
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

  // 2.5 CATÁLOGO DE SUSTANCIAS
  console.log('🧪 Poblado catálogo de sustancias...');
  const sustanciasBase = [
    'ALCOHOL', 'CRISTAL', 'METANFETAMINAS', 'MARIHUANA', 'COCAÍNA', 
    'HEROÍNA', 'BENZODIACEPINAS', 'TABACO', 'LUDOPATÍA', 'OTRO'
  ];
  for (const s of sustanciasBase) {
    await prisma.sustancia.upsert({
      where: { nombre: s },
      update: { activo: true },
      create: { nombre: s, activo: true }
    });
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
  
  let pInternado = await prisma.paciente.findUnique({ where: { claveUnica: 1 } });
  if (!pInternado) {
    pInternado = await prisma.paciente.create({
      data: {
        claveUnica: 1, 
        nombre: 'Carlos',
        apellidoPaterno: 'Jiménez',
        apellidoMaterno: 'Sosa',
        fechaNacimiento: new Date('1990-05-15'),
        sexo: 'M',
        estado: EstadoPaciente.INTERNADO,
        sustancias: ['ALCOHOL', 'TABACO'],
        direccion: 'Av. Siempre Viva 123, Tepic',
        areaDeseada: AreaCentro.HOMBRES,
      },
    });
  }

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

  await prisma.cama.update({
    where: { numero: 'H-01' },
    data: { estado: EstadoCama.OCUPADA, pacienteId: pInternado.id },
  });

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

  await (prisma as any).notaEvolucion.create({
    data: {
      expedienteId: expCarlos.id,
      usuarioId: medico!.id,
      tipo: 'MEDICA',
      nota: 'El paciente presenta una evolución favorable. Se mantiene esquema de desintoxicación gradual.',
    },
  });

  let pProspecto = await prisma.paciente.findFirst({ where: { nombre: 'María', apellidoPaterno: 'Rodríguez' } });
  if (!pProspecto) {
    pProspecto = await prisma.paciente.create({
      data: {
        claveUnica: 2,
        nombre: 'María',
        apellidoPaterno: 'Rodríguez',
        apellidoMaterno: 'Pena',
        fechaNacimiento: new Date('1995-10-20'),
        sexo: 'F',
        estado: EstadoPaciente.PROSPECTO,
        sustancias: ['CANNABIS'],
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
        fechaAcuerdo: new Date(new Date().getTime() + 24 * 60 * 60 * 1000), 
      },
    });
  }

  let pValoracion = await prisma.paciente.findFirst({ where: { nombre: 'Fernando', apellidoPaterno: 'Gómez' } });
  if (!pValoracion) {
    pValoracion = await prisma.paciente.create({
      data: {
        claveUnica: 3,
        nombre: 'Fernando',
        apellidoPaterno: 'Gómez',
        apellidoMaterno: 'Arias',
        fechaNacimiento: new Date('1985-08-12'),
        sexo: 'M',
        estado: EstadoPaciente.EN_VALORACION,
        sustancias: ['CRISTAL', 'METANFETAMINAS'],
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
  }

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
  let pEgresado = await prisma.paciente.findUnique({ where: { claveUnica: 88 } });
  if (!pEgresado) {
    pEgresado = await prisma.paciente.create({
      data: {
        claveUnica: 88,
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
  }

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

  // ==========================================================
  // 7. NÓMINAS Y EMPLEADOS (SÚPER POBLADO)
  // ==========================================================
  console.log('💵 Generando base de empleados robusta (30 Empleados)...');
  
  const empleadosData = [
    // --- ADMISIONES ---
    { nombre: 'Sofía', apellidos: 'López', puesto: 'Recepcionista', departamento: 'ADMISIONES', regimen: RegimenLaboral.CONFIANZA, salarioBase: 6000, compensacionFija: 0 },
    { nombre: 'Mario', apellidos: 'Guzmán', puesto: 'Asesor de Admisiones', departamento: 'ADMISIONES', regimen: RegimenLaboral.CONFIANZA, salarioBase: 8000, compensacionFija: 1000 },
    { nombre: 'Carla', apellidos: 'Suárez', puesto: 'Asistente Telefónico', departamento: 'ADMISIONES', regimen: RegimenLaboral.LISTA_RAYA, salarioBase: 5000, compensacionFija: 0 },
    { nombre: 'Héctor', apellidos: 'Navarro', puesto: 'Trabajador Social', departamento: 'ADMISIONES', regimen: RegimenLaboral.CONFIANZA, salarioBase: 9000, compensacionFija: 500 },
    { nombre: 'Patricia', apellidos: 'Mendoza', puesto: 'Orientadora', departamento: 'ADMISIONES', regimen: RegimenLaboral.CONFIANZA, salarioBase: 7500, compensacionFija: 0 },

    // --- ALMACÉN ---
    { nombre: 'Pablo', apellidos: 'Vargas', puesto: 'Jefe de Almacén', departamento: 'ALMACEN', regimen: RegimenLaboral.CONFIANZA, salarioBase: 10000, compensacionFija: 1500 },
    { nombre: 'Luis', apellidos: 'Ponce', puesto: 'Auxiliar de Almacén', departamento: 'ALMACEN', regimen: RegimenLaboral.LISTA_RAYA, salarioBase: 4500, compensacionFija: 200 },
    { nombre: 'Raúl', apellidos: 'García', puesto: 'Montacarguista', departamento: 'ALMACEN', regimen: RegimenLaboral.LISTA_RAYA, salarioBase: 5500, compensacionFija: 0 },
    { nombre: 'Diana', apellidos: 'Castro', puesto: 'Inventarista', departamento: 'ALMACEN', regimen: RegimenLaboral.CONFIANZA, salarioBase: 6500, compensacionFija: 0 },
    { nombre: 'Tomás', apellidos: 'Ruiz', puesto: 'Auxiliar de Limpieza', departamento: 'ALMACEN', regimen: RegimenLaboral.LISTA_RAYA, salarioBase: 4000, compensacionFija: 0 },

    // --- ADMINISTRACIÓN / RRHH ---
    { nombre: 'Valeria', apellidos: 'Ortiz', puesto: 'Auxiliar Contable', departamento: 'ADMINISTRACION', regimen: RegimenLaboral.CONFIANZA, salarioBase: 9000, compensacionFija: 0 },
    { nombre: 'Felipe', apellidos: 'Ramos', puesto: 'Generalista RRHH', departamento: 'RECURSOS HUMANOS', regimen: RegimenLaboral.CONFIANZA, salarioBase: 11000, compensacionFija: 2000 },
    { nombre: 'Mónica', apellidos: 'Salazar', puesto: 'Secretaria', departamento: 'ADMINISTRACION', regimen: RegimenLaboral.CONFIANZA, salarioBase: 5500, compensacionFija: 0 },
    { nombre: 'Andrés', apellidos: 'Campos', puesto: 'Auditor Interno', departamento: 'ADMINISTRACION', regimen: RegimenLaboral.CONFIANZA, salarioBase: 14000, compensacionFija: 1000 },
    { nombre: 'Elena', apellidos: 'Vega', puesto: 'Asistente de Dirección', departamento: 'ADMINISTRACION', regimen: RegimenLaboral.CONFIANZA, salarioBase: 8500, compensacionFija: 500 },

    // --- CLÍNICO (Enfermería, Psicología, etc) ---
    { nombre: 'Lucía', apellidos: 'Fernández', puesto: 'Psicóloga', departamento: 'CLINICO', regimen: RegimenLaboral.CONFIANZA, salarioBase: 12000, compensacionFija: 1000 },
    { nombre: 'Daniel', apellidos: 'Romero', puesto: 'Psicólogo Clínico', departamento: 'CLINICO', regimen: RegimenLaboral.CONFIANZA, salarioBase: 12000, compensacionFija: 500 },
    { nombre: 'Rosa', apellidos: 'Peralta', puesto: 'Enfermera Jefe', departamento: 'CLINICO', regimen: RegimenLaboral.CONFIANZA, salarioBase: 9500, compensacionFija: 1200 },
    { nombre: 'Jorge', apellidos: 'Escobar', puesto: 'Enfermero de Guardia', departamento: 'CLINICO', regimen: RegimenLaboral.LISTA_RAYA, salarioBase: 7000, compensacionFija: 800 },
    { nombre: 'Carmen', apellidos: 'Lara', puesto: 'Nutrióloga', departamento: 'CLINICO', regimen: RegimenLaboral.CONFIANZA, salarioBase: 10500, compensacionFija: 0 },

    // --- MÉDICO ---
    { nombre: 'Miguel', apellidos: 'Torres', puesto: 'Médico General', departamento: 'MEDICO', regimen: RegimenLaboral.CONFIANZA, salarioBase: 18000, compensacionFija: 2000 },
    { nombre: 'Sara', apellidos: 'Molina', puesto: 'Médico Psiquiatra', departamento: 'MEDICO', regimen: RegimenLaboral.CONFIANZA, salarioBase: 25000, compensacionFija: 5000 },
    { nombre: 'Roberto', apellidos: 'Díaz', puesto: 'Médico Residente', departamento: 'MEDICO', regimen: RegimenLaboral.CONFIANZA, salarioBase: 12000, compensacionFija: 0 },
    { nombre: 'Teresa', apellidos: 'Blanco', puesto: 'Médico General Guardia', departamento: 'MEDICO', regimen: RegimenLaboral.CONFIANZA, salarioBase: 15000, compensacionFija: 1500 },
    { nombre: 'Arturo', apellidos: 'Pineda', puesto: 'Paramédico', departamento: 'MEDICO', regimen: RegimenLaboral.LISTA_RAYA, salarioBase: 8000, compensacionFija: 500 },

    // --- MANTENIMIENTO Y COCINA (Otros) ---
    { nombre: 'Pedro', apellidos: 'Martínez', puesto: 'Guardia de Seguridad', departamento: 'MANTENIMIENTO', regimen: RegimenLaboral.LISTA_RAYA, salarioBase: 5000, compensacionFija: 500 },
    { nombre: 'José', apellidos: 'Cabrera', puesto: 'Técnico Mantenimiento', departamento: 'MANTENIMIENTO', regimen: RegimenLaboral.CONFIANZA, salarioBase: 6500, compensacionFija: 0 },
    { nombre: 'Gloria', apellidos: 'Rojas', puesto: 'Chef Principal', departamento: 'COCINA', regimen: RegimenLaboral.CONFIANZA, salarioBase: 8000, compensacionFija: 1000 },
    { nombre: 'Beatriz', apellidos: 'Soto', puesto: 'Ayudante de Cocina', departamento: 'COCINA', regimen: RegimenLaboral.LISTA_RAYA, salarioBase: 4200, compensacionFija: 0 },
    { nombre: 'Manuel', apellidos: 'Flores', puesto: 'Chofer', departamento: 'MANTENIMIENTO', regimen: RegimenLaboral.LISTA_RAYA, salarioBase: 5500, compensacionFija: 200 },
  ];

  const empleadosCreados = [];
  // Evitar duplicados si ya existen corriendo el seed varias veces
  for (const emp of empleadosData) {
    const empleadoExiste = await prisma.empleado.findFirst({ where: { nombre: emp.nombre, apellidos: emp.apellidos }});
    if (!empleadoExiste) {
      const empleadoBD = await prisma.empleado.create({ data: emp });
      empleadosCreados.push(empleadoBD);
    } else {
      empleadosCreados.push(empleadoExiste);
    }
  }

  // Crear una nómina autorizada por el administrador general (solo si hay empleados nuevos o si no hay nominas)
  const nominasExistentes = await prisma.nomina.count();
  if (nominasExistentes === 0 && empleadosCreados.length > 0) {
    let totalNomina = 0;
    const nominaPrueba = await prisma.nomina.create({
      data: {
        folio: 'NOM-2026-05-01',
        periodo: 'Primera Quincena Mayo 2026',
        fechaInicio: new Date('2026-05-01'),
        fechaFin: new Date('2026-05-15'),
        estado: EstadoNomina.AUTORIZADO,
        usuarioAutorizaId: admin!.id,
        fechaAutorizacion: new Date(),
        firmaRecursosHumanos: true,
        firmaFinanzas: true,
        firmaAdministracion: true,
        firmaDireccion: true
      }
    });

    // Crear las prenóminas (recibos) para cada empleado
    for (const emp of empleadosCreados) {
      const sueldoBruto = emp.salarioBase;
      const compensacion = emp.compensacionFija || 0;
      const totalPercepciones = sueldoBruto + compensacion;
      
      // Simular retención ISR básica (8%)
      const retencionISR = sueldoBruto * 0.08;
      const descuentoIncidencias = 0; // Sin faltas en este ejemplo
      const totalDeducciones = retencionISR + descuentoIncidencias;
      
      const totalAPagar = totalPercepciones - totalDeducciones;
      
      totalNomina += totalAPagar;

      await prisma.preNomina.create({
        data: {
          nominaId: nominaPrueba.id,
          empleadoId: emp.id,
          diasTrabajados: 15,
          horasExtra: 0,
          sueldoBruto,
          compensacion,
          totalPercepciones,
          retencionISR,
          descuentoIncidencias,
          totalDeducciones,
          totalAPagar,
          incidencias: null,
        }
      });
    }

    // Actualizar el total general de la nómina
    await prisma.nomina.update({
      where: { id: nominaPrueba.id },
      data: { totalGeneral: totalNomina, totalNetoPagar: totalNomina, totalPercepciones: totalNomina, totalDeducciones: totalNomina * 0.08 }
    });
  }

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