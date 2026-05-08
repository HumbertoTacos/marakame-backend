import { EstadoCompra, Rol } from '@prisma/client';

export const permisosEstado: Partial<
    Record<EstadoCompra, Rol[]>
    > = {

    REQUISICION_CREADA: [
        Rol.ALMACEN,
        Rol.ADMIN_GENERAL
    ],

    EN_REVISION_RECURSOS: [
        Rol.ADMIN_GENERAL
    ],

    EN_REVISION_COMPRAS: [
        Rol.ADMIN_GENERAL
    ],

    EN_REVISION_ADMINISTRACION: [
        Rol.RRHH_FINANZAS,
        Rol.ADMIN_GENERAL
    ],

    EN_REVISION_DIRECCION: [
        Rol.ADMIN_GENERAL
    ],

    COTIZACIONES_CARGADAS: [
        Rol.ALMACEN,
        Rol.ADMIN_GENERAL
    ],

    PROVEEDOR_SELECCIONADO: [
        Rol.ADMIN_GENERAL
    ],

    NEGOCIACION_COMPLETADA: [
        Rol.ADMIN_GENERAL
    ],

    AUTORIZADA: [
        Rol.ADMIN_GENERAL
    ],

    ORDEN_GENERADA: [
        Rol.ADMIN_GENERAL
    ],

    FACTURAS_RECIBIDAS: [
        Rol.RRHH_FINANZAS,
        Rol.ADMIN_GENERAL
    ],

    ORDEN_PAGO_GENERADA: [
        Rol.RRHH_FINANZAS,
        Rol.ADMIN_GENERAL
    ],

    PAGO_GENERADO: [
        Rol.RRHH_FINANZAS,
        Rol.ADMIN_GENERAL
    ],

    FINALIZADO: [
        Rol.ADMIN_GENERAL
    ],

    RECHAZADO: [
        Rol.ADMIN_GENERAL,
        Rol.RRHH_FINANZAS
    ]
};