-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('ADMIN_GENERAL', 'AREA_MEDICA', 'ENFERMERIA', 'NUTRICION', 'PSICOLOGIA', 'RRHH_FINANZAS', 'ADMISIONES', 'ALMACEN');

-- CreateEnum
CREATE TYPE "EstadoPaciente" AS ENUM ('PROSPECTO', 'EN_VALORACION', 'PENDIENTE_INGRESO', 'INTERNADO', 'EGRESADO', 'CANALIZADO');

-- CreateEnum
CREATE TYPE "TipoAdiccion" AS ENUM ('ALCOHOL', 'COCAINA', 'METANFETAMINA', 'MARIHUANA', 'HEROINA', 'BENZODIACEPINAS', 'MULTIPLE', 'OTRO');

-- CreateEnum
CREATE TYPE "UbicacionFisica" AS ENUM ('LADO_IZQ', 'LADO_DER', 'EVALUACIONES');

-- CreateEnum
CREATE TYPE "EstadoDocumentoExpediente" AS ENUM ('PENDIENTE', 'ENTREGADO');

-- CreateEnum
CREATE TYPE "FuenteReferencia" AS ENUM ('INTERNET', 'EX_PACIENTE', 'FAMILIAR', 'REVISTA', 'ANUNCIO', 'PROFESIONAL_SALUD', 'OTRO');

-- CreateEnum
CREATE TYPE "EstadoProgramaReforzamiento" AS ENUM ('ACTIVO', 'ABANDONO', 'COMPLETADO');

-- CreateEnum
CREATE TYPE "NivelUrgencia" AS ENUM ('BAJA', 'MEDIA', 'ALTA', 'CRITICA');

-- CreateEnum
CREATE TYPE "EstadoSolicitud" AS ENUM ('PENDIENTE', 'EN_PROCESO', 'APROBADA', 'RECHAZADA', 'EN_ESPERA');

-- CreateEnum
CREATE TYPE "TipoNota" AS ENUM ('MEDICA', 'PSICOLOGICA', 'NUTRICIONAL', 'ENFERMERIA', 'GENERAL');

-- CreateEnum
CREATE TYPE "TipoDocumento" AS ENUM ('IDENTIFICACION', 'ACTA_NACIMIENTO', 'CURP', 'COMPROBANTE_DOMICILIO', 'ESTUDIO_LABORATORIO', 'FOTOGRAFIA', 'CONSENTIMIENTO', 'FACTURA', 'CFDI', 'ORDEN_COMPRA', 'RECIBO_NOMINA', 'OTRO');

-- CreateEnum
CREATE TYPE "MetodoPago" AS ENUM ('EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'OTRO');

-- CreateEnum
CREATE TYPE "EstadoCita" AS ENUM ('PROGRAMADA', 'COMPLETADA', 'CANCELADA', 'NO_ASISTIO');

-- CreateEnum
CREATE TYPE "AreaCentro" AS ENUM ('MUJERES', 'HOMBRES', 'DETOX');

-- CreateEnum
CREATE TYPE "EstadoCama" AS ENUM ('DISPONIBLE', 'OCUPADA', 'MANTENIMIENTO', 'RESERVADA');

-- CreateEnum
CREATE TYPE "CategoriaProducto" AS ENUM ('MEDICAMENTO', 'INSUMO_MEDICO', 'MOBILIARIO', 'PAPELERIA', 'LIMPIEZA', 'OTRO');

-- CreateEnum
CREATE TYPE "EstadoStock" AS ENUM ('NORMAL', 'BAJO', 'CRITICO');

-- CreateEnum
CREATE TYPE "TipoMovimiento" AS ENUM ('ENTRADA', 'SALIDA');

-- CreateEnum
CREATE TYPE "EstadoCompra" AS ENUM ('BORRADOR', 'PENDIENTE_COTIZACION', 'EN_COMPARATIVO', 'PENDIENTE_AUTORIZACION', 'AUTORIZADO', 'RECHAZADO', 'ORDEN_GENERADA');

-- CreateEnum
CREATE TYPE "EstadoNomina" AS ENUM ('BORRADOR', 'PENDIENTE', 'AUTORIZADO', 'PAGADO');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellidos" TEXT NOT NULL,
    "correo" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "rol" "Rol" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "ultimoAcceso" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pacientes" (
    "id" SERIAL NOT NULL,
    "claveUnica" TEXT,
    "nombre" TEXT NOT NULL,
    "apellidoPaterno" TEXT NOT NULL,
    "apellidoMaterno" TEXT NOT NULL,
    "fechaNacimiento" TIMESTAMP(3) NOT NULL,
    "sexo" TEXT NOT NULL,
    "curp" TEXT,
    "estadoCivil" TEXT,
    "hijos" INTEGER,
    "escolaridad" TEXT,
    "lugarOrigen" TEXT,
    "ocupacion" TEXT,
    "telefono" TEXT,
    "celular" TEXT,
    "direccion" TEXT,
    "estado" "EstadoPaciente" NOT NULL DEFAULT 'PROSPECTO',
    "tipoAdiccion" "TipoAdiccion" DEFAULT 'ALCOHOL',
    "tiempoConsumo" TEXT,
    "ultimoConsumo" TIMESTAMP(3),
    "motivoIngreso" TEXT,
    "antecedentesMedicos" TEXT,
    "tratamientosPrevios" BOOLEAN NOT NULL DEFAULT false,
    "detallesTratamientos" TEXT,
    "areaDeseada" "AreaCentro",
    "sustancias" TEXT[],
    "nivelTratamiento" INTEGER NOT NULL DEFAULT 1,
    "fechaIngreso" TIMESTAMP(3),
    "fechaEgresoPrevista" TIMESTAMP(3),
    "totalDiasTratamiento" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "pacientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "familiares_responsables" (
    "id" SERIAL NOT NULL,
    "pacienteId" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "parentesco" TEXT NOT NULL,
    "telefono" TEXT,
    "telefonoAlt" TEXT,
    "celular" TEXT,
    "correo" TEXT,
    "direccion" TEXT,
    "municipio" TEXT,
    "estado" TEXT,
    "ocupacion" TEXT,

    CONSTRAINT "familiares_responsables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "primer_contacto" (
    "id" SERIAL NOT NULL,
    "pacienteId" INTEGER NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dia" TEXT NOT NULL,
    "fuenteReferencia" "FuenteReferencia",
    "solicitanteNombre" TEXT NOT NULL,
    "solicitanteTelefono" TEXT,
    "solicitanteCelular" TEXT,
    "solicitanteDireccion" TEXT,
    "solicitanteOcupacion" TEXT,
    "relacionPaciente" TEXT NOT NULL,
    "dispuestoInternarse" TEXT NOT NULL,
    "requiereIntervencion" BOOLEAN NOT NULL DEFAULT false,
    "estadoPrevioTratamiento" BOOLEAN NOT NULL DEFAULT false,
    "acuerdo" TEXT,
    "observaciones" TEXT,
    "posibilidadesEconomicas" TEXT,
    "medicoNombre" TEXT,
    "conclusionMedica" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "primer_contacto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "valoraciones_diagnosticas" (
    "id" SERIAL NOT NULL,
    "pacienteId" INTEGER NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sustanciasConsume" TEXT[],
    "descripcionSustancias" TEXT,
    "cumpleCriteriosInternamiento" BOOLEAN NOT NULL DEFAULT false,
    "aceptaInternarse" BOOLEAN NOT NULL DEFAULT false,
    "requiereIntervencion" BOOLEAN NOT NULL DEFAULT false,
    "internacionPrevia" BOOLEAN NOT NULL DEFAULT false,
    "posibilidadesEconomicas" TEXT,
    "acuerdos" TEXT,
    "fechaTentativaIngreso" TIMESTAMP(3),
    "medicoNombre" TEXT,
    "observacionesMedicas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "valoraciones_diagnosticas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "valoraciones_medicas" (
    "id" SERIAL NOT NULL,
    "pacienteId" INTEGER NOT NULL,
    "padecimientoActual" TEXT,
    "antecedentes" JSONB,
    "signosVitales" JSONB,
    "exploracionFisica" TEXT,
    "examenMental" JSONB,
    "diagnosticoCIE10" TEXT,
    "pronostico" TEXT,
    "tratamientoSugerido" TEXT,
    "esAptoParaIngreso" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "valoraciones_medicas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "programas_reforzamiento" (
    "id" SERIAL NOT NULL,
    "pacienteId" INTEGER NOT NULL,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFinEstimada" TIMESTAMP(3) NOT NULL,
    "estado" "EstadoProgramaReforzamiento" NOT NULL DEFAULT 'ACTIVO',
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "programas_reforzamiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solicitudes_ingreso" (
    "id" SERIAL NOT NULL,
    "folio" TEXT NOT NULL,
    "estado" "EstadoSolicitud" NOT NULL DEFAULT 'PENDIENTE',
    "urgencia" "NivelUrgencia" NOT NULL DEFAULT 'BAJA',
    "observaciones" TEXT,
    "motivoRechazo" TEXT,
    "solicitanteId" INTEGER NOT NULL,
    "pacienteId" INTEGER NOT NULL,
    "creadoPorId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "solicitudes_ingreso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asignaciones_cama" (
    "id" SERIAL NOT NULL,
    "fechaIngresoEstimada" TIMESTAMP(3) NOT NULL,
    "observaciones" TEXT,
    "medicoResponsableId" INTEGER NOT NULL,
    "medicoResponsableNom" TEXT NOT NULL,
    "solicitudId" INTEGER NOT NULL,
    "camaId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asignaciones_cama_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estudio_socioeconomico" (
    "id" SERIAL NOT NULL,
    "pacienteId" INTEGER NOT NULL,
    "seccionActual" INTEGER NOT NULL DEFAULT 1,
    "completado" BOOLEAN NOT NULL DEFAULT false,
    "datos" JSONB NOT NULL,
    "nivelSocioeconomico" TEXT,
    "puntajeCalculado" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "estudio_socioeconomico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventario_pertenencias" (
    "id" SERIAL NOT NULL,
    "pacienteId" INTEGER NOT NULL,
    "articulos" JSONB NOT NULL,
    "validado" BOOLEAN NOT NULL DEFAULT false,
    "firmaRecibido" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventario_pertenencias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expedientes" (
    "id" SERIAL NOT NULL,
    "pacienteId" INTEGER NOT NULL,
    "diagnosticoPrincipal" TEXT,
    "diagnosticoSecundario" TEXT,
    "cuotaAsignada" DOUBLE PRECISION,
    "saldoPendiente" DOUBLE PRECISION,
    "indiceBMI" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expedientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notas_evolucion" (
    "id" SERIAL NOT NULL,
    "expedienteId" INTEGER NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "tipo" "TipoNota" NOT NULL DEFAULT 'GENERAL',
    "nota" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notas_evolucion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signos_vitales" (
    "id" SERIAL NOT NULL,
    "expedienteId" INTEGER NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "presionArterial" TEXT,
    "temperatura" DOUBLE PRECISION,
    "frecuenciaCardiaca" INTEGER,
    "frecuenciaRespiratoria" INTEGER,
    "oxigenacion" INTEGER,
    "glucosa" DOUBLE PRECISION,
    "peso" DOUBLE PRECISION,
    "observaciones" TEXT,

    CONSTRAINT "signos_vitales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tratamientos_medicos" (
    "id" SERIAL NOT NULL,
    "expedienteId" INTEGER NOT NULL,
    "medicoId" INTEGER NOT NULL,
    "medicamento" TEXT NOT NULL,
    "dosis" TEXT NOT NULL,
    "frecuencia" TEXT NOT NULL,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "indicaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tratamientos_medicos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suministros_tratamientos" (
    "id" SERIAL NOT NULL,
    "tratamientoId" INTEGER NOT NULL,
    "enfermeroId" INTEGER NOT NULL,
    "fechaSuministro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dosisAplicada" TEXT NOT NULL,
    "observaciones" TEXT,

    CONSTRAINT "suministros_tratamientos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documentos" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "tipoDocumento" "TipoDocumento" NOT NULL DEFAULT 'OTRO',
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "rutaArchivo" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "tamanoBytes" INTEGER NOT NULL,
    "pacienteId" INTEGER,
    "primerContactoId" INTEGER,
    "valoracionId" INTEGER,
    "estudioId" INTEGER,
    "inventarioId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documentos_expediente_fisico" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "ubicacion" "UbicacionFisica" NOT NULL,
    "estado" "EstadoDocumentoExpediente" NOT NULL DEFAULT 'PENDIENTE',
    "pacienteId" INTEGER NOT NULL,

    CONSTRAINT "documentos_expediente_fisico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagos_paciente" (
    "id" SERIAL NOT NULL,
    "pacienteId" INTEGER NOT NULL,
    "usuarioRecibeId" INTEGER NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "fechaPago" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metodoPago" "MetodoPago" NOT NULL,
    "concepto" TEXT NOT NULL,
    "comprobanteUrl" TEXT,
    "facturado" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pagos_paciente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cargos_paciente" (
    "id" SERIAL NOT NULL,
    "pacienteId" INTEGER NOT NULL,
    "usuarioCargaId" INTEGER NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "concepto" TEXT NOT NULL,
    "fechaCargo" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pagado" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "cargos_paciente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "citas_agenda" (
    "id" SERIAL NOT NULL,
    "pacienteId" INTEGER NOT NULL,
    "especialistaId" INTEGER NOT NULL,
    "fechaHora" TIMESTAMP(3) NOT NULL,
    "motivo" TEXT NOT NULL,
    "estado" "EstadoCita" NOT NULL DEFAULT 'PROGRAMADA',
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "citas_agenda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bitacora" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "pacienteId" INTEGER,
    "modulo" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "archivoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bitacora_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "habitaciones" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "capacidadMax" INTEGER NOT NULL DEFAULT 4,
    "area" "AreaCentro" NOT NULL,

    CONSTRAINT "habitaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "camas" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT,
    "numero" TEXT NOT NULL,
    "estado" "EstadoCama" NOT NULL DEFAULT 'DISPONIBLE',
    "descripcion" TEXT,
    "pacienteId" INTEGER,
    "habitacionId" INTEGER,

    CONSTRAINT "camas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "almacen_productos" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "categoria" "CategoriaProducto" NOT NULL,
    "unidad" TEXT NOT NULL,
    "stockActual" INTEGER NOT NULL DEFAULT 0,
    "stockMinimo" INTEGER NOT NULL DEFAULT 5,
    "estadoStock" "EstadoStock" NOT NULL DEFAULT 'NORMAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "almacen_productos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "almacen_movimientos" (
    "id" SERIAL NOT NULL,
    "productoId" INTEGER NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "tipo" "TipoMovimiento" NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "proveedor" TEXT,
    "numeroFactura" TEXT,
    "validadoFactura" BOOLEAN NOT NULL DEFAULT false,
    "areaSolicitante" TEXT,
    "motivo" TEXT,
    "nombreRecibe" TEXT,
    "confirmadoRecibido" BOOLEAN NOT NULL DEFAULT false,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "almacen_movimientos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compras_requisiciones" (
    "id" SERIAL NOT NULL,
    "folio" TEXT NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "areaSolicitante" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "justificacion" TEXT NOT NULL,
    "presupuestoEstimado" DOUBLE PRECISION,
    "estado" "EstadoCompra" NOT NULL DEFAULT 'BORRADOR',
    "usuarioAutorizaId" INTEGER,
    "observacionesVoBo" TEXT,
    "fechaAutorizacion" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compras_requisiciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compras_cotizaciones" (
    "id" SERIAL NOT NULL,
    "requisicionId" INTEGER NOT NULL,
    "proveedor" TEXT NOT NULL,
    "precio" DOUBLE PRECISION NOT NULL,
    "tiempoEntrega" TEXT,
    "esMejorOpcion" BOOLEAN NOT NULL DEFAULT false,
    "documentoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compras_cotizaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compras_ordenes" (
    "id" SERIAL NOT NULL,
    "requisicionId" INTEGER NOT NULL,
    "proveedor" TEXT NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "documentoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compras_ordenes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "empleados" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellidos" TEXT NOT NULL,
    "puesto" TEXT NOT NULL,
    "departamento" TEXT NOT NULL,
    "salarioBase" DOUBLE PRECISION NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "empleados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nominas" (
    "id" SERIAL NOT NULL,
    "folio" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3) NOT NULL,
    "estado" "EstadoNomina" NOT NULL DEFAULT 'BORRADOR',
    "usuarioAutorizaId" INTEGER,
    "totalGeneral" DOUBLE PRECISION DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nominas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prenominas" (
    "id" SERIAL NOT NULL,
    "nominaId" INTEGER NOT NULL,
    "empleadoId" INTEGER NOT NULL,
    "salarioBase" DOUBLE PRECISION NOT NULL,
    "bonos" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deducciones" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAPagar" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "prenominas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auditoria" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "accion" TEXT NOT NULL,
    "modulo" TEXT NOT NULL,
    "detalle" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_correo_key" ON "usuarios"("correo");

-- CreateIndex
CREATE UNIQUE INDEX "pacientes_claveUnica_key" ON "pacientes"("claveUnica");

-- CreateIndex
CREATE UNIQUE INDEX "pacientes_curp_key" ON "pacientes"("curp");

-- CreateIndex
CREATE UNIQUE INDEX "familiares_responsables_pacienteId_key" ON "familiares_responsables"("pacienteId");

-- CreateIndex
CREATE UNIQUE INDEX "valoraciones_medicas_pacienteId_key" ON "valoraciones_medicas"("pacienteId");

-- CreateIndex
CREATE UNIQUE INDEX "programas_reforzamiento_pacienteId_key" ON "programas_reforzamiento"("pacienteId");

-- CreateIndex
CREATE UNIQUE INDEX "solicitudes_ingreso_folio_key" ON "solicitudes_ingreso"("folio");

-- CreateIndex
CREATE UNIQUE INDEX "asignaciones_cama_solicitudId_key" ON "asignaciones_cama"("solicitudId");

-- CreateIndex
CREATE UNIQUE INDEX "estudio_socioeconomico_pacienteId_key" ON "estudio_socioeconomico"("pacienteId");

-- CreateIndex
CREATE UNIQUE INDEX "inventario_pertenencias_pacienteId_key" ON "inventario_pertenencias"("pacienteId");

-- CreateIndex
CREATE UNIQUE INDEX "expedientes_pacienteId_key" ON "expedientes"("pacienteId");

-- CreateIndex
CREATE UNIQUE INDEX "camas_codigo_key" ON "camas"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "camas_numero_key" ON "camas"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "camas_pacienteId_key" ON "camas"("pacienteId");

-- CreateIndex
CREATE UNIQUE INDEX "almacen_productos_codigo_key" ON "almacen_productos"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "compras_requisiciones_folio_key" ON "compras_requisiciones"("folio");

-- CreateIndex
CREATE UNIQUE INDEX "compras_ordenes_requisicionId_key" ON "compras_ordenes"("requisicionId");

-- CreateIndex
CREATE UNIQUE INDEX "nominas_folio_key" ON "nominas"("folio");

-- AddForeignKey
ALTER TABLE "familiares_responsables" ADD CONSTRAINT "familiares_responsables_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "pacientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "primer_contacto" ADD CONSTRAINT "primer_contacto_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "pacientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "primer_contacto" ADD CONSTRAINT "primer_contacto_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "valoraciones_diagnosticas" ADD CONSTRAINT "valoraciones_diagnosticas_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "pacientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "valoraciones_diagnosticas" ADD CONSTRAINT "valoraciones_diagnosticas_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "valoraciones_medicas" ADD CONSTRAINT "valoraciones_medicas_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "pacientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "programas_reforzamiento" ADD CONSTRAINT "programas_reforzamiento_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "pacientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitudes_ingreso" ADD CONSTRAINT "solicitudes_ingreso_solicitanteId_fkey" FOREIGN KEY ("solicitanteId") REFERENCES "familiares_responsables"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitudes_ingreso" ADD CONSTRAINT "solicitudes_ingreso_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "pacientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones_cama" ADD CONSTRAINT "asignaciones_cama_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "solicitudes_ingreso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones_cama" ADD CONSTRAINT "asignaciones_cama_camaId_fkey" FOREIGN KEY ("camaId") REFERENCES "camas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estudio_socioeconomico" ADD CONSTRAINT "estudio_socioeconomico_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "pacientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventario_pertenencias" ADD CONSTRAINT "inventario_pertenencias_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "pacientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expedientes" ADD CONSTRAINT "expedientes_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "pacientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_evolucion" ADD CONSTRAINT "notas_evolucion_expedienteId_fkey" FOREIGN KEY ("expedienteId") REFERENCES "expedientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_evolucion" ADD CONSTRAINT "notas_evolucion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signos_vitales" ADD CONSTRAINT "signos_vitales_expedienteId_fkey" FOREIGN KEY ("expedienteId") REFERENCES "expedientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signos_vitales" ADD CONSTRAINT "signos_vitales_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tratamientos_medicos" ADD CONSTRAINT "tratamientos_medicos_expedienteId_fkey" FOREIGN KEY ("expedienteId") REFERENCES "expedientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tratamientos_medicos" ADD CONSTRAINT "tratamientos_medicos_medicoId_fkey" FOREIGN KEY ("medicoId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suministros_tratamientos" ADD CONSTRAINT "suministros_tratamientos_tratamientoId_fkey" FOREIGN KEY ("tratamientoId") REFERENCES "tratamientos_medicos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suministros_tratamientos" ADD CONSTRAINT "suministros_tratamientos_enfermeroId_fkey" FOREIGN KEY ("enfermeroId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "pacientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_primerContactoId_fkey" FOREIGN KEY ("primerContactoId") REFERENCES "primer_contacto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_valoracionId_fkey" FOREIGN KEY ("valoracionId") REFERENCES "valoraciones_diagnosticas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_estudioId_fkey" FOREIGN KEY ("estudioId") REFERENCES "estudio_socioeconomico"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_inventarioId_fkey" FOREIGN KEY ("inventarioId") REFERENCES "inventario_pertenencias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos_expediente_fisico" ADD CONSTRAINT "documentos_expediente_fisico_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "pacientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos_paciente" ADD CONSTRAINT "pagos_paciente_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "pacientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos_paciente" ADD CONSTRAINT "pagos_paciente_usuarioRecibeId_fkey" FOREIGN KEY ("usuarioRecibeId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cargos_paciente" ADD CONSTRAINT "cargos_paciente_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "pacientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cargos_paciente" ADD CONSTRAINT "cargos_paciente_usuarioCargaId_fkey" FOREIGN KEY ("usuarioCargaId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "citas_agenda" ADD CONSTRAINT "citas_agenda_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "pacientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "citas_agenda" ADD CONSTRAINT "citas_agenda_especialistaId_fkey" FOREIGN KEY ("especialistaId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bitacora" ADD CONSTRAINT "bitacora_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "camas" ADD CONSTRAINT "camas_habitacionId_fkey" FOREIGN KEY ("habitacionId") REFERENCES "habitaciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "camas" ADD CONSTRAINT "camas_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "pacientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "almacen_movimientos" ADD CONSTRAINT "almacen_movimientos_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "almacen_productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "almacen_movimientos" ADD CONSTRAINT "almacen_movimientos_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compras_requisiciones" ADD CONSTRAINT "compras_requisiciones_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compras_cotizaciones" ADD CONSTRAINT "compras_cotizaciones_requisicionId_fkey" FOREIGN KEY ("requisicionId") REFERENCES "compras_requisiciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compras_ordenes" ADD CONSTRAINT "compras_ordenes_requisicionId_fkey" FOREIGN KEY ("requisicionId") REFERENCES "compras_requisiciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nominas" ADD CONSTRAINT "nominas_usuarioAutorizaId_fkey" FOREIGN KEY ("usuarioAutorizaId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prenominas" ADD CONSTRAINT "prenominas_nominaId_fkey" FOREIGN KEY ("nominaId") REFERENCES "nominas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prenominas" ADD CONSTRAINT "prenominas_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "empleados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
