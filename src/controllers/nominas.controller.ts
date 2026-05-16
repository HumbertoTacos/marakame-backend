import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import { prisma } from '../utils/prisma';
import { AppError } from '../middlewares/errorHandler';
import { crearNotificacion, apagarNotificacionesPorLink } from '../utils/notificaciones';

// ============================================================
// Helper: genera el PDF de la pre-nómina y devuelve la URL pública
// ============================================================
const generarPDFPreNomina = async (nominaId: number): Promise<string> => {
  const nomina = await prisma.nomina.findUnique({
    where: { id: nominaId },
    include: { prenominas: { include: { empleado: true } } },
  });
  if (!nomina) throw new Error('Nómina no encontrada para generar PDF.');

  const dir = path.join('uploads', 'nominas');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const filename = `PRENOM_${nomina.folio.replace(/[^A-Za-z0-9-]/g, '_')}_${Date.now()}.pdf`;
  const filepath = path.join(dir, filename);

  const fmtMoney = (n: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n || 0);
  const fmtFecha = (d: Date) =>
    new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });

  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 36, size: 'LETTER', layout: 'landscape' });
    const stream = fs.createWriteStream(filepath);
    stream.on('finish', () => resolve());
    stream.on('error', reject);
    doc.pipe(stream);

    // Encabezado institucional
    doc.fontSize(16).font('Helvetica-Bold').text('Centro de Rehabilitación Marakame', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(13).font('Helvetica').text('Pre-Nómina Quincenal', { align: 'center' });
    doc.moveDown(0.6);

    // Bloque de metadatos en dos columnas
    const metaY = doc.y;
    doc.fontSize(9).font('Helvetica-Bold').text('Folio:', 40, metaY);
    doc.font('Helvetica').text(nomina.folio, 90, metaY);
    doc.font('Helvetica-Bold').text('Periodo:', 250, metaY);
    doc.font('Helvetica').text(nomina.periodo, 300, metaY);
    doc.font('Helvetica-Bold').text('Régimen:', 560, metaY);
    doc.font('Helvetica').text(nomina.regimen === 'LISTA_RAYA' ? 'Lista de Raya' : 'Confianza', 615, metaY);

    const metaY2 = metaY + 14;
    doc.font('Helvetica-Bold').text('Inicio:', 40, metaY2);
    doc.font('Helvetica').text(fmtFecha(nomina.fechaInicio), 90, metaY2);
    doc.font('Helvetica-Bold').text('Fin:', 250, metaY2);
    doc.font('Helvetica').text(fmtFecha(nomina.fechaFin), 300, metaY2);
    doc.font('Helvetica-Bold').text('Emisión:', 560, metaY2);
    doc.font('Helvetica').text(new Date().toLocaleString('es-MX'), 615, metaY2);

    doc.moveDown(2);
    doc.moveTo(40, doc.y).lineTo(760, doc.y).strokeColor('#cbd5e1').stroke();
    doc.moveDown(0.4);

    // Columnas (anchos calibrados para LETTER landscape, margen 36)
    const cols = [
      { key: 'empleado',     label: 'Empleado',         x: 40,  w: 170, align: 'left'  as const },
      { key: 'depto',        label: 'Depto.',           x: 210, w: 70,  align: 'left'  as const },
      { key: 'puesto',       label: 'Puesto',           x: 280, w: 120, align: 'left'  as const },
      { key: 'dias',         label: 'Días',             x: 400, w: 30,  align: 'right' as const },
      { key: 'sueldo',       label: 'Sueldo',           x: 430, w: 65,  align: 'right' as const },
      { key: 'comp',         label: 'Compens.',         x: 495, w: 65,  align: 'right' as const },
      { key: 'percep',       label: 'Percepciones',     x: 560, w: 70,  align: 'right' as const },
      { key: 'isr',          label: 'ISR',              x: 630, w: 55,  align: 'right' as const },
      { key: 'neto',         label: 'A Pagar',          x: 685, w: 75,  align: 'right' as const },
    ];

    const drawHeader = () => {
      const y = doc.y;
      doc.rect(40, y - 2, 720, 16).fillColor('#f1f5f9').fill();
      doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(9);
      cols.forEach(c => doc.text(c.label, c.x, y + 1, { width: c.w, align: c.align }));
      doc.moveDown(1.1);
      doc.fillColor('#000');
    };

    drawHeader();

    let acumPercep = 0, acumIsr = 0, acumNeto = 0, acumComp = 0, acumSueldo = 0;

    doc.font('Helvetica').fontSize(8);
    for (const pn of nomina.prenominas) {
      // Salto de página si nos pasamos del área útil.
      if (doc.y > 540) {
        doc.addPage({ margin: 36, size: 'LETTER', layout: 'landscape' });
        drawHeader();
        doc.font('Helvetica').fontSize(8);
      }
      const y = doc.y;
      doc.text(`${pn.empleado.nombre} ${pn.empleado.apellidos}`, 40, y, { width: 170, align: 'left' });
      doc.text(pn.empleado.departamento || '',                    210, y, { width: 70,  align: 'left' });
      doc.text(pn.empleado.puesto || '',                          280, y, { width: 120, align: 'left' });
      doc.text(String(pn.diasTrabajados),                         400, y, { width: 30,  align: 'right' });
      doc.text(fmtMoney(pn.sueldoBruto),                          430, y, { width: 65,  align: 'right' });
      doc.text(fmtMoney(pn.compensacion),                         495, y, { width: 65,  align: 'right' });
      doc.text(fmtMoney(pn.totalPercepciones),                    560, y, { width: 70,  align: 'right' });
      doc.text(fmtMoney(pn.retencionISR),                         630, y, { width: 55,  align: 'right' });
      doc.text(fmtMoney(pn.totalAPagar),                          685, y, { width: 75,  align: 'right' });
      doc.moveDown(0.9);

      acumSueldo += pn.sueldoBruto;
      acumComp   += pn.compensacion;
      acumPercep += pn.totalPercepciones;
      acumIsr    += pn.retencionISR;
      acumNeto   += pn.totalAPagar;
    }

    // Fila de totales
    doc.moveDown(0.3);
    doc.moveTo(40, doc.y).lineTo(760, doc.y).strokeColor('#0f172a').stroke();
    doc.moveDown(0.3);
    const yTot = doc.y;
    doc.font('Helvetica-Bold').fontSize(9);
    doc.text('TOTAL',               40,  yTot, { width: 360, align: 'left'  });
    doc.text(fmtMoney(acumSueldo),  430, yTot, { width: 65,  align: 'right' });
    doc.text(fmtMoney(acumComp),    495, yTot, { width: 65,  align: 'right' });
    doc.text(fmtMoney(acumPercep),  560, yTot, { width: 70,  align: 'right' });
    doc.text(fmtMoney(acumIsr),     630, yTot, { width: 55,  align: 'right' });
    doc.text(fmtMoney(acumNeto),    685, yTot, { width: 75,  align: 'right' });
    doc.moveDown(2);

    // Bloque de firmas (4 cajitas)
    const firmasY = doc.y + 10;
    const cajaW = 170;
    const firmas = ['Recursos Financieros', 'Administración', 'Dirección General', 'Recursos Humanos'];
    firmas.forEach((nombre, i) => {
      const x = 40 + i * (cajaW + 5);
      doc.moveTo(x, firmasY + 30).lineTo(x + cajaW, firmasY + 30).strokeColor('#94a3b8').stroke();
      doc.fontSize(8).fillColor('#475569').font('Helvetica').text(nombre, x, firmasY + 34, { width: cajaW, align: 'center' });
    });

    doc.end();
  });

  return `/uploads/nominas/${filename}`;
};

// ============================================================
// EMPLEADOS
// ============================================================

export const createEmpleado = async (req: Request, res: Response) => {
  const { numeroEmpleado, nombre, apellidos, puesto, departamento, regimen, salarioBase, compensacionFija } = req.body;
  
  const empleado = await prisma.empleado.create({
    data: {
      numeroEmpleado,
      nombre,
      apellidos,
      puesto,
      departamento,
      regimen: regimen || 'CONFIANZA',
      salarioBase: parseFloat(salarioBase),
      compensacionFija: parseFloat(compensacionFija || 0)
    }
  });
  res.status(201).json({ success: true, data: empleado });
};

export const getEmpleados = async (req: Request, res: Response) => {
  // Mismo mapa que en obtenerAsistencias: jefes y el usuario legacy "administracion" (RRHH_FINANZAS)
  // ven sólo su área. Sólo RECURSOS_HUMANOS y ADMIN_GENERAL ven todo.
  const DEPTOS_POR_JEFE: Record<string, string[]> = {
    JEFE_MEDICO:         ['MEDICO'],
    JEFE_CLINICO:        ['CLINICO'],
    JEFE_ADMISIONES:     ['ADMISIONES'],
    JEFE_ADMINISTRATIVO: ['ADMINISTRACION', 'RECURSOS HUMANOS'],
    RRHH_FINANZAS:       ['ADMINISTRACION', 'RECURSOS HUMANOS'],
  };
  const rolUsuario = req.usuario!.rol as string;
  const deptosVisibles = DEPTOS_POR_JEFE[rolUsuario];

  const empleados = await prisma.empleado.findMany({
    where: deptosVisibles ? { departamento: { in: deptosVisibles } } : undefined,
    orderBy: { nombre: 'asc' }
  });
  res.json({ success: true, data: empleados });
};

export const updateEmpleado = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ success: false, message: 'ID inválido.' });
    }

    const { nombre, apellidos, puesto, departamento, regimen, salarioBase, compensacionFija, activo } = req.body;

    // Sólo actualizamos campos que vienen en el body — así un toggle de activo no borra el sueldo.
    const data: any = {};
    if (nombre !== undefined)           data.nombre = String(nombre).trim();
    if (apellidos !== undefined)        data.apellidos = String(apellidos).trim();
    if (puesto !== undefined)           data.puesto = String(puesto).trim();
    if (departamento !== undefined)     data.departamento = String(departamento).trim();
    if (regimen !== undefined)          data.regimen = regimen;
    if (salarioBase !== undefined)      data.salarioBase = parseFloat(salarioBase);
    if (compensacionFija !== undefined) data.compensacionFija = parseFloat(compensacionFija);
    if (activo !== undefined)           data.activo = Boolean(activo);

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ success: false, message: 'No hay datos para actualizar.' });
    }

    const empleado = await prisma.empleado.update({ where: { id }, data });
    res.json({ success: true, data: empleado });
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'Empleado no encontrado.' });
    }
    console.error('Error al actualizar empleado:', error);
    res.status(500).json({ success: false, message: 'Error interno al actualizar empleado', detalle: error.message });
  }
};

// ============================================================
// NÓMINA GENERAL (CICLOS)
// ============================================================

// Tarifa de retención ISR aplicada al sueldo bruto. Pendiente de homologar con tablas reales.
const ISR_TARIFA = 0.08;
// Días laborables por quincena (referencia institucional). Se ajusta al cerrar con faltas reales.
const DIAS_QUINCENA = 15;

export const generarNomina = async (req: Request, res: Response) => {
  try {
    // RH genera la pre-nómina DIRECTO en el sistema (sin Nomipaq / CONTPAQi).
    // Body: periodo, fechaInicio, fechaFin, regimen.
    const { periodo, fechaInicio, fechaFin, regimen } = req.body;
    if (!periodo || !fechaInicio || !fechaFin) {
      return res.status(400).json({ success: false, message: 'Faltan datos del periodo.' });
    }

    // 1. Folio NOM-AAAA-###
    const currentYear = new Date().getFullYear();
    const count = await prisma.nomina.count({ where: { folio: { startsWith: `NOM-${currentYear}` } } });
    const folio = `NOM-${currentYear}-${String(count + 1).padStart(3, '0')}`;

    // 2. Snapshot de empleados activos (filtrados por régimen si vino en el body).
    const empleados = await prisma.empleado.findMany({
      where: {
        activo: true,
        ...(regimen ? { regimen: regimen as any } : {}),
      },
    });
    if (empleados.length === 0) {
      return res.status(400).json({ success: false, message: 'No hay empleados activos para generar la pre-nómina.' });
    }

    // 3. Cálculo institucional preliminar (sin descuentos por faltas — esos se aplican al CIERRE).
    let acumPercepciones = 0;
    let acumDeducciones = 0;
    let acumNeto = 0;

    const preNominasData = empleados.map((emp: any) => {
      const sueldoBruto = Number(emp.salarioBase) || 0;
      const compensacion = Number(emp.compensacionFija) || 0;
      const totalPercepciones = sueldoBruto + compensacion;
      const retencionISR = +(sueldoBruto * ISR_TARIFA).toFixed(2);
      const totalDeducciones = retencionISR;
      const totalAPagar = +(totalPercepciones - totalDeducciones).toFixed(2);

      acumPercepciones += totalPercepciones;
      acumDeducciones  += totalDeducciones;
      acumNeto         += totalAPagar;

      return {
        empleadoId: emp.id,
        diasTrabajados: DIAS_QUINCENA,
        horasExtra: 0,
        sueldoBruto,
        compensacion,
        otrasPercepciones: 0,
        totalPercepciones,
        retencionISR,
        descuentoIncidencias: 0, // se llena al cerrar
        otrasDeducciones: 0,
        totalDeducciones,
        totalAPagar,
        incidencias: null,
      };
    });

    // 4. Crear la Nomina + sus PreNomina en una sola transacción.
    const nomina = await prisma.nomina.create({
      data: {
        folio,
        periodo,
        fechaInicio: new Date(fechaInicio),
        fechaFin: new Date(fechaFin),
        estado: 'PRE_NOMINA',
        regimen: regimen || null,
        totalPercepciones: +acumPercepciones.toFixed(2),
        totalDeducciones:  +acumDeducciones.toFixed(2),
        totalNetoPagar:    +acumNeto.toFixed(2),
        totalGeneral:      +acumNeto.toFixed(2),
        prenominas: { create: preNominasData },
      },
      include: { prenominas: true },
    });

    // 4.b Generar PDF institucional de la pre-nómina y guardar la URL en archivoUrl.
    try {
      const archivoUrl = await generarPDFPreNomina(nomina.id);
      await prisma.nomina.update({ where: { id: nomina.id }, data: { archivoUrl } });
      (nomina as any).archivoUrl = archivoUrl;
    } catch (pdfErr: any) {
      console.error('No se pudo generar el PDF de la pre-nómina:', pdfErr?.message);
      // No bloqueamos el flujo si falla el PDF; la nómina ya quedó creada.
    }

    // 5. Notificar a Finanzas (siguiente paso) + informar al resto del flujo.
    const notifMsg = `Pre-nómina ${folio} (${periodo}) creada por RH. Esperando documento de subsidio.`;
    const notifLink = `/nominas/${nomina.id}`;
    await Promise.all([
      crearNotificacion({ rol: 'RECURSOS_FINANCIEROS' as any, titulo: 'Nueva pre-nómina pendiente', mensaje: notifMsg, link: notifLink, tipo: 'ALERTA' as any }),
      crearNotificacion({ rol: 'RRHH_FINANZAS' as any,       titulo: 'Nueva pre-nómina pendiente', mensaje: notifMsg, link: notifLink, tipo: 'INFO' as any }),
      crearNotificacion({ rol: 'DIRECCION_GENERAL' as any,   titulo: 'Nueva pre-nómina iniciada', mensaje: notifMsg, link: notifLink, tipo: 'INFO' as any })
    ]);

    res.status(201).json({ success: true, data: nomina });
  } catch (error: any) {
    console.error('🔥 Error generando pre-nómina:', error);
    res.status(500).json({ success: false, message: 'Falló la creación de la pre-nómina', detalle: error.message });
  }
};

export const getNominas = async (req: Request, res: Response) => {
  // CORRECCIÓN: Quitamos el filtro 'not: AUTORIZADO'. Ahora manda TODO a React.
  const nominas = await prisma.nomina.findMany({
    include: {
      usuarioAutoriza: { select: { nombre: true, apellidos: true } },
      prenominas: { include: { empleado: true } }
    },
    orderBy: { createdAt: 'desc' }
  });
  res.json({ success: true, data: nominas });
};

// ============================================================
// FLUJO DE FIRMAS (NUEVO Y AUTOMATIZADO)
// ============================================================
export const firmarNomina = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const rolUsuario = req.usuario!.rol;

    const nomina = await prisma.nomina.findUnique({ where: { id: Number(id) } });
    if (!nomina) return res.status(404).json({ success: false, message: 'Nómina no encontrada' });

    // Secuencia oficial del flujo (4 firmas):
    //   Paso 1 — Finanzas:        firmaFinanzas       → RECURSOS_FINANCIEROS o RRHH_FINANZAS
    //   Paso 2 — Administración:  firmaAdministracion → RRHH_FINANZAS (administracion@marakame.com)
    //   Paso 3 — Dirección:       firmaDireccion      → DIRECCION_GENERAL (direccion@marakame.com — firma + envía lista a RH)
    //   Paso 4 — RH:              firmaRecursosHumanos→ RECURSOS_HUMANOS o RRHH_FINANZAS
    const esFinanzas = rolUsuario === 'RECURSOS_FINANCIEROS' || rolUsuario === 'RRHH_FINANZAS';
    const esAdministracion = rolUsuario === 'RRHH_FINANZAS';
    const esDireccion = rolUsuario === 'DIRECCION_GENERAL';
    const esRH = rolUsuario === 'RECURSOS_HUMANOS' || rolUsuario === 'RRHH_FINANZAS';

    let firmaACambiar: 'firmaFinanzas' | 'firmaAdministracion' | 'firmaDireccion' | 'firmaRecursosHumanos' | null = null;
    let etiquetaPaso = '';

    if (!nomina.firmaFinanzas) {
      if (esFinanzas) {
        firmaACambiar = 'firmaFinanzas';
        etiquetaPaso = 'Recursos Financieros (solicitud de subsidio)';
      }
    } else if (!nomina.firmaAdministracion) {
      if (esAdministracion) {
        firmaACambiar = 'firmaAdministracion';
        etiquetaPaso = 'Administración (revisión y firma)';
      }
    } else if (!nomina.firmaDireccion) {
      if (esDireccion) {
        firmaACambiar = 'firmaDireccion';
        etiquetaPaso = 'Dirección General';
      }
    } else if (!nomina.firmaRecursosHumanos) {
      if (esRH) {
        firmaACambiar = 'firmaRecursosHumanos';
        etiquetaPaso = 'Recursos Humanos (cierre del ciclo)';
      }
    } else {
      return res.status(400).json({ success: false, message: 'La nómina ya tiene todas las firmas registradas.' });
    }

    if (!firmaACambiar) {
      return res.status(403).json({
        success: false,
        message: 'Tu rol no puede firmar el paso actual del flujo.'
      });
    }

    const dataToUpdate: any = { [firmaACambiar]: true };

    // Cambios de estado a lo largo del flujo:
    //   PRE_NOMINA          → SOLICITUD_SUBSIDIO al firmar Finanzas
    //   SOLICITUD_SUBSIDIO  → EN_REVISION        al firmar Administración
    //   EN_REVISION         → AUTORIZADO         al firmar Jefatura
    //   AUTORIZADO se mantiene cuando RH cierra; archivar lo pasa a PAGADO.
    if (firmaACambiar === 'firmaFinanzas') {
      dataToUpdate.estado = 'SOLICITUD_SUBSIDIO';
      dataToUpdate.fechaSolicitudSubsidio = new Date();
    } else if (firmaACambiar === 'firmaAdministracion') {
      dataToUpdate.estado = 'EN_REVISION';
    } else if (firmaACambiar === 'firmaDireccion') {
      dataToUpdate.estado = 'AUTORIZADO';
      dataToUpdate.fechaAutorizacion = new Date();
      dataToUpdate.usuarioAutorizaId = req.usuario!.id;
    }

    const actualizada = await prisma.nomina.update({
      where: { id: Number(id) },
      data: dataToUpdate
    });

    // Notificar al siguiente paso del flujo.
    const link3 = `/nominas/${actualizada.id}`;

    // Apaga las notificaciones del paso que acaba de cerrarse, para el usuario y para los roles
    // que recibieron la alerta de ese paso.
    const rolesQueAcabanDeActuar: any[] = [];
    if (firmaACambiar === 'firmaFinanzas')          rolesQueAcabanDeActuar.push('RECURSOS_FINANCIEROS', 'RRHH_FINANZAS');
    if (firmaACambiar === 'firmaAdministracion')    rolesQueAcabanDeActuar.push('RRHH_FINANZAS');
    if (firmaACambiar === 'firmaDireccion')         rolesQueAcabanDeActuar.push('DIRECCION_GENERAL');
    if (firmaACambiar === 'firmaRecursosHumanos')   rolesQueAcabanDeActuar.push('RECURSOS_HUMANOS', 'RRHH_FINANZAS');
    await Promise.all([
      apagarNotificacionesPorLink(req.usuario!.id, req.usuario!.rol, link3),
      ...rolesQueAcabanDeActuar.map(r => apagarNotificacionesPorLink(req.usuario!.id, r, link3))
    ]);

    if (firmaACambiar === 'firmaFinanzas') {
      const msg = `Pre-nómina ${actualizada.folio} firmada por Finanzas. Esperando firma de Administración.`;
      await crearNotificacion({ rol: 'RRHH_FINANZAS' as any, titulo: 'Pre-nómina pendiente de firma (Administración)', mensaje: msg, link: link3, tipo: 'ALERTA' as any });
    } else if (firmaACambiar === 'firmaAdministracion') {
      const msg = `Pre-nómina ${actualizada.folio} firmada por Administración. Esperando firma de Dirección.`;
      await crearNotificacion({ rol: 'DIRECCION_GENERAL' as any, titulo: 'Pre-nómina pendiente de firma (Dirección)', mensaje: msg, link: link3, tipo: 'ALERTA' as any });
    } else if (firmaACambiar === 'firmaDireccion') {
      const msg = `Pre-nómina ${actualizada.folio} autorizada. RH debe subir la nómina firmada por el trabajador.`;
      await Promise.all([
        crearNotificacion({ rol: 'RECURSOS_HUMANOS' as any, titulo: 'Pre-nómina autorizada', mensaje: msg, link: link3, tipo: 'ALERTA' as any }),
        crearNotificacion({ rol: 'RRHH_FINANZAS' as any,    titulo: 'Pre-nómina autorizada', mensaje: msg, link: link3, tipo: 'INFO' as any })
      ]);
    }

    res.json({
      success: true,
      message: `Firma de ${etiquetaPaso} registrada.`,
      data: actualizada
    });
  } catch (error: any) {
    console.error("Error al firmar:", error);
    res.status(500).json({ success: false, message: 'Error interno al firmar', detalle: error.message });
  }
};


export const autorizarNomina = async (req: Request, res: Response) => {
  const { id } = req.params;
  const usuarioId = req.usuario!.id;

  const nominaBase = await prisma.nomina.findUnique({ 
    where: { id: parseInt(id as string, 10) }
  });
  
  if (!nominaBase) throw new AppError(404, 'Nómina no encontrada');

  const nomina = await prisma.nomina.update({
    where: { id: parseInt(id as string, 10) },
    data: {
      estado: 'AUTORIZADO',
      usuarioAutorizaId: usuarioId,
      fechaAutorizacion: new Date(),
    }
  });

  res.json({ success: true, data: nomina });
};

// ============================================================
// PRE-NÓMINAS (Cálculos individuales por empleado)
// ============================================================

export const updatePreNomina = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { 
    diasTrabajados, horasExtra, 
    otrasPercepciones, 
    descuentoIncidencias, otrasDeducciones, 
    incidencias, reciboFirmado 
  } = req.body;

  const preNomina = await prisma.preNomina.findUnique({ where: { id: parseInt(id as string, 10) } });
  if (!preNomina) throw new AppError(404, 'Pre-Nómina no encontrada');

  const newDias = diasTrabajados !== undefined ? parseFloat(diasTrabajados) : preNomina.diasTrabajados;
  const newOtrasPerc = otrasPercepciones !== undefined ? parseFloat(otrasPercepciones) : preNomina.otrasPercepciones;
  const newDescuentosInc = descuentoIncidencias !== undefined ? parseFloat(descuentoIncidencias) : preNomina.descuentoIncidencias;
  const newOtrasDeduc = otrasDeducciones !== undefined ? parseFloat(otrasDeducciones) : preNomina.otrasDeducciones;

  const baseReducida = (preNomina.sueldoBruto / 15) * newDias;
  const totalPercepciones = baseReducida + preNomina.compensacion + newOtrasPerc;
  const totalDeducciones = preNomina.retencionISR + newDescuentosInc + newOtrasDeduc;
  const nuevoTotal = totalPercepciones - totalDeducciones;

  const preUpdate = await prisma.preNomina.update({
    where: { id: parseInt(id as string, 10) },
    data: {
      diasTrabajados: newDias,
      horasExtra: horasExtra !== undefined ? parseFloat(horasExtra) : preNomina.horasExtra,
      otrasPercepciones: newOtrasPerc,
      totalPercepciones,
      descuentoIncidencias: newDescuentosInc,
      otrasDeducciones: newOtrasDeduc,
      totalDeducciones,
      totalAPagar: nuevoTotal,
      incidencias: incidencias !== undefined ? incidencias : preNomina.incidencias,
      reciboFirmado: reciboFirmado !== undefined ? reciboFirmado : preNomina.reciboFirmado
    }
  });
  
  res.json({ success: true, data: preUpdate });
};


export const actualizarPreNomina = async (req: Request, res: Response) => {
  try {
    const { id } = req.params; 
    
    const { 
      sueldoBruto, 
      compensacion, 
      horasExtra, 
      otrasPercepciones, 
      retencionISR, 
      descuentoIncidencias, 
      otrasDeducciones 
    } = req.body;

    // 1. Recalcular los totales individuales del empleado
    const totalPercepciones = 
      Number(sueldoBruto || 0) + 
      Number(compensacion || 0) + 
      Number(horasExtra || 0) + 
      Number(otrasPercepciones || 0);

    const totalDeducciones = 
      Number(retencionISR || 0) + 
      Number(descuentoIncidencias || 0) + 
      Number(otrasDeducciones || 0);

    const totalAPagar = totalPercepciones - totalDeducciones;

    // 2. Actualizar el registro individual (PreNómina)
    const preNominaActualizada = await prisma.preNomina.update({
      where: { id: Number(id) },
      data: {
        sueldoBruto: Number(sueldoBruto),
        compensacion: Number(compensacion),
        horasExtra: Number(horasExtra),
        otrasPercepciones: Number(otrasPercepciones),
        retencionISR: Number(retencionISR),
        descuentoIncidencias: Number(descuentoIncidencias),
        otrasDeducciones: Number(otrasDeducciones),
        totalPercepciones,
        totalDeducciones,
        totalAPagar
      }
    });

    // --- MAGIA AUTOMÁTICA: RECALCULAR LA NÓMINA GENERAL ---
    const nominaId = preNominaActualizada.nominaId;

    // 3. Sumar todos los recibos que pertenecen a esta misma Nómina
    const sumatorias = await prisma.preNomina.aggregate({
      where: { nominaId: nominaId },
      _sum: {
        totalPercepciones: true,
        totalDeducciones: true,
        totalAPagar: true
      }
    });

    // 4. Actualizar la Nómina principal con los nuevos grandes totales
    await prisma.nomina.update({
      where: { id: nominaId },
      data: {
        totalPercepciones: sumatorias._sum.totalPercepciones || 0,
        totalDeducciones: sumatorias._sum.totalDeducciones || 0,
        totalNetoPagar: sumatorias._sum.totalAPagar || 0
      }
    });
    // -------------------------------------------------------

    res.status(200).json({ 
      success: true, 
      message: "Recibo actualizado y totales generales recalculados correctamente",
      data: preNominaActualizada 
    });

  } catch (error: any) {
    console.error("ERROR AL ACTUALIZAR PRENOMINA:", error.message);
    res.status(500).json({ 
      success: false, 
      message: "Falló la actualización del recibo", 
      detalle: error.message 
    });
  }
};

export const getNominaById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const nomina = await prisma.nomina.findUnique({
      where: { id: Number(id) },
      include: { 
        prenominas: { 
          include: { empleado: true }
        } 
      }
    });

    if (!nomina) {
      return res.status(404).json({ success: false, message: "Nómina no encontrada" });
    }

    res.status(200).json({ success: true, data: nomina });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "Error al buscar la nómina", detalle: error.message });
  }
};

export const archivarNomina = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const nomina = await prisma.nomina.update({
      where: { id: Number(id) },
      data: { estado: 'PAGADO' } // Cambia a estado terminal
    });

    // Cierre del ciclo: apaga cualquier notificación viva sobre esta nómina para el usuario actual
    // y para los roles que pudieran tenerla "Lista para archivar".
    const linkArchivada = `/nominas/${nomina.id}`;
    await Promise.all([
      apagarNotificacionesPorLink(req.usuario!.id, req.usuario!.rol, linkArchivada),
      apagarNotificacionesPorLink(req.usuario!.id, 'RECURSOS_FINANCIEROS' as any, linkArchivada),
      apagarNotificacionesPorLink(req.usuario!.id, 'RRHH_FINANZAS' as any, linkArchivada)
    ]);

    res.json({ success: true, message: 'Nómina archivada y cerrada.', data: nomina });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Error al archivar la nómina', detalle: error.message });
  }
};

// ============================================================
// CONTROL DE ASISTENCIAS DIARIAS
// ============================================================

export const guardarAsistencias = async (req: Request, res: Response) => {
  try {
    // El body viene como multipart/form-data: `fecha` es string, `registros` viene como JSON string,
    // y los archivos llegan en req.files con fieldname `archivo_<empleadoId>`.
    const { fecha } = req.body;
    const usuarioId = req.usuario!.id;

    let registros: any[] = [];
    try {
      registros = typeof req.body.registros === 'string'
        ? JSON.parse(req.body.registros)
        : (req.body.registros || []);
    } catch {
      return res.status(400).json({ success: false, message: 'Formato inválido en `registros`.' });
    }

    if (!fecha || !Array.isArray(registros) || registros.length === 0) {
      return res.status(400).json({ success: false, message: 'Faltan datos: fecha o registros.' });
    }

    // Indexamos archivos subidos por empleadoId (fieldname = archivo_<id>)
    const archivosPorEmpleado: Record<string, string> = {};
    const files = (req.files as Express.Multer.File[]) || [];
    for (const f of files) {
      const match = f.fieldname.match(/^archivo_(\d+)$/);
      if (match) {
        archivosPorEmpleado[match[1]] = `/uploads/justificantes/${f.filename}`;
      }
    }

    // 1. Buscar la Nómina que esté actualmente en curso (opcional).
    // Si no hay nómina abierta, igual se registra la asistencia: el control diario
    // es independiente del ciclo de nómina y debe poder hacerse cualquier día.
    const nominaActiva = await prisma.nomina.findFirst({
      where: {
        estado: { in: ['BORRADOR', 'PRE_NOMINA', 'EN_REVISION'] }
      },
      orderBy: { id: 'desc' }
    });

    // 2. Política UPSERT: los jefes pueden editar la asistencia del día las veces que quieran.
    // Borramos los registros previos del rango (empleados × fecha) antes de insertar los nuevos.
    const fechaInicio = new Date(fecha);
    fechaInicio.setUTCHours(0, 0, 0, 0);
    const fechaFin = new Date(fecha);
    fechaFin.setUTCHours(23, 59, 59, 999);

    const empleadoIds = registros.map((r: any) => Number(r.empleadoId)).filter(Number.isFinite);
    await prisma.registroAsistencia.deleteMany({
      where: {
        empleadoId: { in: empleadoIds },
        fecha: { gte: fechaInicio, lte: fechaFin }
      }
    });

    // 3. Preparar los datos (incluyendo URL del documento si subieron archivo).
    // Regla del estadoJustificacion:
    //   - ASISTENCIA → NO_APLICA (no hay incidencia que justificar)
    //   - FALTA + el jefe dijo que SÍ tiene justificante → PENDIENTE (admin debe revisar)
    //   - FALTA + el jefe dijo que NO tiene justificante → RECHAZADA (es falta directa, sin nada que revisar)
    const datosAInsertar = registros.map((reg: any) => {
      let estadoJustificacion: 'NO_APLICA' | 'PENDIENTE' | 'RECHAZADA' = 'NO_APLICA';
      if (reg.tipo !== 'ASISTENCIA') {
        estadoJustificacion = reg.quiereJustificar === true ? 'PENDIENTE' : 'RECHAZADA';
      }
      // Omitimos `nominaId` cuando no hay nómina abierta (la columna es opcional en BD).
      const base: any = {
        fecha: new Date(fecha),
        tipo: reg.tipo,
        motivoJustificacion: reg.quiereJustificar ? (reg.motivo || null) : null,
        documentoUrl: archivosPorEmpleado[String(reg.empleadoId)] || null,
        estadoJustificacion,
        empleadoId: Number(reg.empleadoId),
        registradoPorId: usuarioId
      };
      if (nominaActiva) base.nominaId = nominaActiva.id;
      return base;
    });

    // 4. Guardar en la base de datos
    const resultado = await prisma.registroAsistencia.createMany({
      data: datosAInsertar as any,
      skipDuplicates: true
    });

    res.json({
      success: true,
      message: `Se guardaron ${resultado.count} registros de asistencia.`,
      data: resultado
    });

  } catch (error: any) {
    console.error("Error al guardar asistencias:", error);
    res.status(500).json({ success: false, message: 'Error interno al guardar asistencias', detalle: error.message });
  }
};

// Recursos Financieros sube el documento de solicitud de subsidio.
// Esto AUTO-firma el paso de Finanzas y avanza el estado a SOLICITUD_SUBSIDIO.
export const subirSubsidio = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const archivo = (req as any).file as Express.Multer.File | undefined;
    if (!archivo) {
      return res.status(400).json({ success: false, message: 'Debes adjuntar el documento de subsidio.' });
    }

    const nomina = await prisma.nomina.findUnique({ where: { id: Number(id) } });
    if (!nomina) return res.status(404).json({ success: false, message: 'Nómina no encontrada.' });
    if (nomina.firmaFinanzas) {
      return res.status(400).json({ success: false, message: 'Esta nómina ya tiene firma de Finanzas.' });
    }

    const actualizada = await prisma.nomina.update({
      where: { id: Number(id) },
      data: {
        archivoSubsidioUrl: `/uploads/nominas/${archivo.filename}`,
        firmaFinanzas: true,
        estado: 'SOLICITUD_SUBSIDIO',
        fechaSolicitudSubsidio: new Date()
      }
    });

    // Apaga las notificaciones que llamaban a este paso: la acción de Finanzas ya quedó hecha,
    // ningún usuario de Finanzas (RECURSOS_FINANCIEROS / RRHH_FINANZAS) necesita seguir viendo la alerta.
    const linkNomina = `/nominas/${actualizada.id}`;
    await Promise.all([
      apagarNotificacionesPorLink(req.usuario!.id, req.usuario!.rol, linkNomina),
      apagarNotificacionesPorLink(req.usuario!.id, 'RECURSOS_FINANCIEROS' as any, linkNomina),
      apagarNotificacionesPorLink(req.usuario!.id, 'RRHH_FINANZAS' as any, linkNomina)
    ]);

    // Notifica al siguiente paso: AHORA es Administración (administracion@marakame.com con rol RRHH_FINANZAS).
    // Jefatura Administrativa entra después de Administración, no aquí.
    const msg2 = `Pre-nómina ${actualizada.folio} (${actualizada.periodo}) con subsidio listo. Esperando tu firma de Administración.`;
    await crearNotificacion({
      rol: 'RRHH_FINANZAS' as any,
      titulo: 'Pre-nómina pendiente de firma (Administración)',
      mensaje: msg2,
      link: linkNomina,
      tipo: 'ALERTA' as any
    });

    res.json({ success: true, message: 'Documento de subsidio subido y firma de Finanzas aplicada.', data: actualizada });
  } catch (error: any) {
    console.error('Error subiendo subsidio:', error);
    res.status(500).json({ success: false, message: 'Error interno', detalle: error.message });
  }
};

// Administración (administracion@marakame.com, rol RRHH_FINANZAS) firma su paso con un botón.
// No sube documento — sólo revisa lo que Finanzas dejó listo y aplica su firma.
// Tras firmar, el turno pasa a Dirección General (direccion@marakame.com).
export const firmarAdministracion = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const nomina = await prisma.nomina.findUnique({ where: { id } });
    if (!nomina) return res.status(404).json({ success: false, message: 'Nómina no encontrada.' });
    if (!nomina.firmaFinanzas) {
      return res.status(400).json({ success: false, message: 'Finanzas debe firmar primero (subir el documento de subsidio).' });
    }
    if (nomina.firmaAdministracion) {
      return res.status(400).json({ success: false, message: 'Esta nómina ya tiene la firma de Administración.' });
    }

    const actualizada = await prisma.nomina.update({
      where: { id },
      data: {
        firmaAdministracion: true,
        estado: 'EN_REVISION'
      }
    });

    const link = `/nominas/${actualizada.id}`;

    // Apaga las notificaciones del paso recién cerrado (Administración) tanto del usuario como del rol.
    await apagarNotificacionesPorLink(req.usuario!.id, req.usuario!.rol, link);
    await apagarNotificacionesPorLink(req.usuario!.id, 'RRHH_FINANZAS' as any, link);

    // Notifica a Dirección General (paso siguiente: firmar + enviar lista de asistencias a RH).
    const msg = `Pre-nómina ${actualizada.folio} firmada por Administración. Te toca firmar y enviar la lista de asistencias a RH.`;
    await crearNotificacion({
      rol: 'DIRECCION_GENERAL' as any,
      titulo: 'Pre-nómina pendiente de firma (Dirección)',
      mensaje: msg,
      link,
      tipo: 'ALERTA' as any
    });

    res.json({ success: true, message: 'Firma de Administración aplicada.', data: actualizada });
  } catch (error: any) {
    console.error('Error firmando Administración:', error);
    res.status(500).json({ success: false, message: 'Error interno', detalle: error.message });
  }
};


// RH cierra la nómina aplicando los descuentos por faltas no justificadas del periodo
// (cálculo institucional — ya no se sube un archivo escaneado). Tras esto Finanzas archiva.
export const cerrarNomina = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const nomina = await prisma.nomina.findUnique({
      where: { id: Number(id) },
      include: { prenominas: { include: { empleado: true } } },
    });
    if (!nomina) return res.status(404).json({ success: false, message: 'Nómina no encontrada.' });
    if (nomina.estado !== 'AUTORIZADO') {
      return res.status(400).json({ success: false, message: 'La nómina debe estar AUTORIZADA antes de cerrarla.' });
    }

    // Asistencias del periodo (FALTAs NO aprobadas se descuentan; las aprobadas no).
    const desde = new Date(nomina.fechaInicio);
    desde.setUTCHours(0, 0, 0, 0);
    const hasta = new Date(nomina.fechaFin);
    hasta.setUTCHours(23, 59, 59, 999);
    const empleadoIds = nomina.prenominas.map(p => p.empleadoId);

    const faltas = await prisma.registroAsistencia.findMany({
      where: {
        empleadoId: { in: empleadoIds },
        fecha: { gte: desde, lte: hasta },
        tipo: 'FALTA' as any,
        NOT: { estadoJustificacion: 'APROBADA' as any },
      },
      select: { empleadoId: true },
    });
    const faltasPorEmp: Record<number, number> = {};
    for (const f of faltas) faltasPorEmp[f.empleadoId] = (faltasPorEmp[f.empleadoId] || 0) + 1;

    // Recalcular cada PreNomina con su descuento por faltas y volver a sumar el total.
    let acumPercepciones = 0;
    let acumDeducciones = 0;
    let acumNeto = 0;

    for (const pn of nomina.prenominas) {
      const tarifaDia = (Number(pn.empleado.salarioBase) || 0) / DIAS_QUINCENA;
      const faltasEmp = faltasPorEmp[pn.empleadoId] || 0;
      const descuentoIncidencias = +(tarifaDia * faltasEmp).toFixed(2);
      const diasTrabajados = Math.max(DIAS_QUINCENA - faltasEmp, 0);
      const totalDeducciones = +(pn.retencionISR + descuentoIncidencias + (pn.otrasDeducciones || 0)).toFixed(2);
      const totalAPagar = +(pn.totalPercepciones - totalDeducciones).toFixed(2);

      acumPercepciones += pn.totalPercepciones;
      acumDeducciones  += totalDeducciones;
      acumNeto         += totalAPagar;

      await prisma.preNomina.update({
        where: { id: pn.id },
        data: {
          diasTrabajados,
          descuentoIncidencias,
          totalDeducciones,
          totalAPagar,
          incidencias: faltasEmp > 0 ? `${faltasEmp} falta(s) no justificada(s) descontada(s).` : null,
        },
      });
    }

    const actualizada = await prisma.nomina.update({
      where: { id: Number(id) },
      data: {
        firmaRecursosHumanos: true,
        totalPercepciones: +acumPercepciones.toFixed(2),
        totalDeducciones:  +acumDeducciones.toFixed(2),
        totalNetoPagar:    +acumNeto.toFixed(2),
        totalGeneral:      +acumNeto.toFixed(2),
      },
    });

    // Apaga las notificaciones del paso (RH cerró la nómina).
    const link4 = `/nominas/${actualizada.id}`;
    await Promise.all([
      apagarNotificacionesPorLink(req.usuario!.id, req.usuario!.rol, link4),
      apagarNotificacionesPorLink(req.usuario!.id, 'RECURSOS_HUMANOS' as any, link4),
      apagarNotificacionesPorLink(req.usuario!.id, 'RRHH_FINANZAS' as any, link4)
    ]);

    // Notifica a Finanzas (archivar) y a Administración (informativo).
    const msg4 = `Nómina ${actualizada.folio} cerrada por RH. Lista para archivar.`;
    await Promise.all([
      crearNotificacion({ rol: 'RECURSOS_FINANCIEROS' as any, titulo: 'Nómina lista para archivar', mensaje: msg4, link: link4, tipo: 'ALERTA' as any }),
      crearNotificacion({ rol: 'RRHH_FINANZAS' as any,        titulo: 'Nómina lista para archivar', mensaje: msg4, link: link4, tipo: 'INFO' as any })
    ]);

    res.json({
      success: true,
      message: `Nómina cerrada. Se descontaron faltas no justificadas a ${Object.keys(faltasPorEmp).length} empleado(s).`,
      data: actualizada
    });
  } catch (error: any) {
    console.error('Error cerrando nómina:', error);
    res.status(500).json({ success: false, message: 'Error interno al cerrar la nómina', detalle: error.message });
  }
};

// Aplica una justificación quincenal a TODAS las faltas del empleado dentro del rango.
// Carga un solo motivo + archivo y deja las incidencias en PENDIENTE de revisión.
export const justificarQuincena = async (req: Request, res: Response) => {
  try {
    const empleadoId = Number(req.body.empleadoId);
    const motivo = (req.body.motivo || '').toString().trim();
    const fechaInicio = req.body.fechaInicio as string;
    const fechaFin = req.body.fechaFin as string;
    const archivo = (req as any).file as Express.Multer.File | undefined;

    if (!Number.isFinite(empleadoId) || !fechaInicio || !fechaFin) {
      return res.status(400).json({ success: false, message: 'empleadoId, fechaInicio y fechaFin son obligatorios.' });
    }
    if (!motivo) {
      return res.status(400).json({ success: false, message: 'Debes capturar un motivo para la justificación quincenal.' });
    }

    const inicio = new Date(fechaInicio);
    inicio.setUTCHours(0, 0, 0, 0);
    const fin = new Date(fechaFin);
    fin.setUTCHours(23, 59, 59, 999);

    const documentoUrl = archivo ? `/uploads/justificantes/${archivo.filename}` : undefined;

    // Sólo las FALTAs son justificables — las ASISTENCIAs no se tocan.
    const resultado = await prisma.registroAsistencia.updateMany({
      where: {
        empleadoId,
        fecha: { gte: inicio, lte: fin },
        tipo: 'FALTA' as any,
      },
      data: {
        motivoJustificacion: motivo,
        ...(documentoUrl ? { documentoUrl } : {}),
        estadoJustificacion: 'PENDIENTE' as any,
      },
    });

    res.json({
      success: true,
      message: `Justificación quincenal aplicada a ${resultado.count} incidencia(s).`,
      data: { incidenciasJustificadas: resultado.count }
    });
  } catch (error: any) {
    console.error('Error en justificarQuincena:', error);
    res.status(500).json({ success: false, message: 'Error interno al aplicar justificación quincenal.', detalle: error.message });
  }
};

export const decidirJustificacion = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { aprobar } = req.body;

    if (typeof aprobar !== 'boolean') {
      return res.status(400).json({ success: false, message: 'Debe enviar `aprobar: boolean` en el body.' });
    }

    const registro = await prisma.registroAsistencia.findUnique({ where: { id: Number(id) } });
    if (!registro) {
      return res.status(404).json({ success: false, message: 'Registro de asistencia no encontrado.' });
    }

    if (registro.tipo === 'ASISTENCIA') {
      return res.status(400).json({ success: false, message: 'Una asistencia normal no requiere justificación.' });
    }

    const actualizado = await prisma.registroAsistencia.update({
      where: { id: Number(id) },
      data: {
        estadoJustificacion: aprobar ? 'APROBADA' : 'RECHAZADA'
      },
      include: { empleado: true }
    });

    res.json({
      success: true,
      message: aprobar ? 'Justificación aprobada.' : 'Justificación rechazada.',
      data: actualizado
    });
  } catch (error: any) {
    console.error('Error decidiendo justificación:', error);
    res.status(500).json({ success: false, message: 'Error interno', detalle: error.message });
  }
};

// Mapa rol → departamentos que supervisa. RECURSOS_HUMANOS y ADMIN_GENERAL no se listan acá:
// ellos ven TODO (sin filtro). El rol legacy RRHH_FINANZAS (usuario administracion@) queda
// recortado a su propia área (Administración + Recursos Humanos) igual que JEFE_ADMINISTRATIVO.
const DEPARTAMENTOS_POR_JEFE: Record<string, string[]> = {
  JEFE_MEDICO:         ['MEDICO'],
  JEFE_CLINICO:        ['CLINICO'],
  JEFE_ADMISIONES:     ['ADMISIONES'],
  JEFE_ADMINISTRATIVO: ['ADMINISTRACION', 'RECURSOS HUMANOS'],
  RRHH_FINANZAS:       ['ADMINISTRACION', 'RECURSOS HUMANOS'],
};

export const obtenerAsistencias = async (req: Request, res: Response) => {
  try {
    const { fechaInicio, fechaFin } = req.query;

    if (!fechaInicio || !fechaFin) {
      return res.status(400).json({ success: false, message: 'Faltan rangos de fecha.' });
    }

    // Normalizamos en UTC para que el offset local no recorte los registros de los bordes
    // (ej. en México UTC-6, setHours(0) movía el inicio 6 horas adelante y dejaba fuera el día 1).
    const inicio = new Date(fechaInicio as string);
    inicio.setUTCHours(0, 0, 0, 0);

    const fin = new Date(fechaFin as string);
    fin.setUTCHours(23, 59, 59, 999);

    // Visibilidad por rol: RH / Dirección / Admin ven todo. Cada jefe sólo ve sus departamentos.
    const rolUsuario = req.usuario!.rol as string;
    const deptosVisibles = DEPARTAMENTOS_POR_JEFE[rolUsuario];

    const registros = await prisma.registroAsistencia.findMany({
      where: {
        fecha: { gte: inicio, lte: fin },
        ...(deptosVisibles ? { empleado: { departamento: { in: deptosVisibles } } } : {}),
      },
      include: {
        empleado: true
      },
      orderBy: {
        fecha: 'asc'
      }
    });

    res.json({ success: true, data: registros });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};