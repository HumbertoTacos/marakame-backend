# Marakame Backend Context

## Proyecto

Marakame es un sistema institucional para una clínica/centro de rehabilitación.

El backend está desarrollado con:

- Node.js
- Express
- TypeScript
- Prisma ORM
- PostgreSQL

---

# Objetivo

Construir una API modular, mantenible y segura para gestionar:

- pacientes
- expedientes clínicos
- área médica
- admisiones
- inventario
- compras
- nóminas
- reportes

---

# Arquitectura Backend

## Stack

- Node.js
- Express
- TypeScript
- Prisma ORM
- PostgreSQL
- JWT Authentication

---

# Organización

## Estructura general

- routes = endpoints
- controllers = manejo request/response
- services = lógica de negocio
- middleware = autenticación/validaciones
- prisma = acceso a base de datos
- utils = helpers reutilizables

---

# Convenciones

## TypeScript

- NO usar any
- Mantener tipado estricto
- Interfaces claras
- Código legible y modular

---

# API

## Buenas prácticas

- Usar REST
- Respuestas consistentes
- Manejo correcto de errores
- Status HTTP adecuados
- Validar inputs
- Evitar lógica pesada en controllers

---

# Prisma

## Reglas

- Reutilizar modelos existentes
- Mantener integridad relacional
- Usar include/select correctamente
- Evitar consultas innecesarias
- Revisar schema.prisma antes de generar cambios

---

# Seguridad

- JWT Authentication
- Middlewares existentes
- Validación de datos
- No exponer información sensible
- Manejo seguro de errores

---

# Área Médica

El módulo médico incluye:

- expediente clínico
- evolución médica
- signos vitales
- notas médicas
- historial clínico
- seguimiento de pacientes
- valoraciones médicas

Las operaciones médicas deben mantener:

- trazabilidad
- integridad de datos
- historial consistente

---

# Base de Datos

PostgreSQL local normalmente:
localhost:5432

Prisma administra:

- migraciones
- relaciones
- seed
- schema

---

# Importante

Antes de generar código:

- revisar endpoints existentes
- revisar schema Prisma
- mantener compatibilidad con frontend
- no romper módulos existentes
- reutilizar lógica existente antes de crear nueva
