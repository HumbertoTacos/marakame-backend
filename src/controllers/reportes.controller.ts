import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';

// ============================================================
// EXPORTACIÓN A PDF (Ej: Lista de Pacientes Internados)
// ============================================================

export const exportarPacientesPDF = async (req: Request, res: Response) => {
  try {
    const pacientes = await (prisma.paciente as any).findMany({
      where: { estado: 'INTERNADO' },
      include: {
        cama: true,
        ingresos: {
          where: { estado: 'COMPLETADO' },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      },
      orderBy: { apellidoPaterno: 'asc' }
    });

    const doc = new PDFDocument({ margin: 50 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="pacientes_internados.pdf"');

    doc.pipe(res);

    // Cabecera
    doc.fontSize(20).text('Centro de Rehabilitación Marakame', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(14).text('Reporte de Pacientes Internados Activos', { align: 'center' });
    doc.fontSize(10).text(`Fecha de emisión: ${new Date().toLocaleString('es-MX')}`, { align: 'center' });
    doc.moveDown(2);

    // Listado
    let y = doc.y;
    doc.fontSize(10);
    // Tabla Headings
    doc.font('Helvetica-Bold');
    doc.text('ID', 50, y, { width: 50 });
    doc.text('Nombre Completo', 100, y, { width: 200 });
    doc.text('Área', 300, y, { width: 80 });
    doc.text('Cama', 380, y, { width: 60 });
    doc.text('Ingreso', 440, y);
    doc.moveDown();
    
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.5);

    doc.font('Helvetica');
    pacientes.forEach((pac: any) => {
      y = doc.y;
      const pacCama: any = pac.cama;
      doc.text(pac.id.toString(), 50, y, { width: 50 });
      doc.text(`${pac.nombre} ${pac.apellidoPaterno} ${pac.apellidoMaterno || ''}`, 100, y, { width: 200 });
      doc.text(pacCama?.area || 'N/A', 300, y, { width: 80 });
      doc.text(pacCama?.numero || 'N/A', 380, y, { width: 60 });
      
      const fechaIngreso = pac.ingresos && pac.ingresos[0]?.fechaIngreso 
        ? new Date(pac.ingresos[0].fechaIngreso).toLocaleDateString('es-MX') 
        : 'N/A';
      
      doc.text(fechaIngreso, 440, y);
      doc.moveDown(0.5);
    });

    doc.end();
  } catch (error) {
    console.error('Error generando PDF:', error);
    res.status(500).json({ success: false, error: 'Hubo un problema generando el PDF' });
  }
};

// ============================================================
// EXPORTACIÓN A EXCEL (Ej: Kardex General de Almacén)
// ============================================================

export const exportarAlmacenExcel = async (req: Request, res: Response) => {
  try {
    const productos = await prisma.almacenProducto.findMany({
      orderBy: { categoria: 'asc' }
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Inventario Marakame');

    // Estilos de Cabecera
    worksheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Código', key: 'codigo', width: 15 },
      { header: 'Nombre', key: 'nombre', width: 35 },
      { header: 'Categoría', key: 'categoria', width: 20 },
      { header: 'Unidad', key: 'unidad', width: 15 },
      { header: 'Stock Actual', key: 'stockActual', width: 15 },
      { header: 'Stock Mínimo', key: 'stockMinimo', width: 15 },
      { header: 'Estado', key: 'estadoStock', width: 15 }
    ];

    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = { type: 'pattern', pattern:'solid', fgColor:{ argb:'FF2D3748' } };

    // Agregar Data
    productos.forEach(prod => {
      worksheet.addRow({
        id: prod.id,
        codigo: prod.codigo,
        nombre: prod.nombre,
        categoria: prod.categoria,
        unidad: prod.unidad,
        stockActual: prod.stockActual,
        stockMinimo: prod.stockMinimo,
        estadoStock: prod.estadoStock
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="inventario_marakame.xlsx"');

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error generando Excel:', error);
    res.status(500).json({ success: false, error: 'Hubo un problema generando el archivo EXCEL' });
  }
};
