import PDFDocument from 'pdfkit';
import { InvoicePayload } from '@/types/invoice';
import { calculateTotals } from '@/lib/invoice';

const formatMoney = (value: number, currencyCode: string, fallbackSymbol: string) => {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  } catch (error) {
    return `${fallbackSymbol}${value.toFixed(2)}`;
  }
};

const formatDate = (iso: string) => {
  try {
    const date = new Date(iso);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(date);
  } catch (error) {
    return iso;
  }
};

export const buildInvoicePdf = (invoice: InvoicePayload): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const buffers: Buffer[] = [];

    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', (err) => reject(err));

    const { customer, currency } = invoice;
    const totals = calculateTotals(invoice);
    const money = (value: number) => formatMoney(value, currency.code, currency.symbol);

    // Header
    doc
      .fillColor('#2563eb')
      .font('Helvetica-Bold')
      .fontSize(26)
      .text('Invoice', { align: 'left' });

    doc.moveDown(0.5);

    doc
      .font('Helvetica')
      .fillColor('#6b7280')
      .fontSize(11)
      .text(`Invoice Number: ${invoice.invoiceNumber}`)
      .text(`Issue Date: ${formatDate(invoice.issueDate)}`);

    if (invoice.dueDate) {
      doc.text(`Due Date: ${formatDate(invoice.dueDate)}`);
    }

    doc.moveDown();

    // Customer block
    doc
      .font('Helvetica-Bold')
      .fontSize(14)
      .fillColor('#1f2937')
      .text(customer.name);

    doc.font('Helvetica').fontSize(11).fillColor('#1f2937');

    if (customer.email) {
      doc.text(customer.email);
    }

    if (customer.address) {
      doc.text(customer.address, { width: 220 });
    }

    doc.moveDown(1.5);

    // Table header
    const tableTop = doc.y;
    const columnX = {
      item: 50,
      desc: 190,
      qty: 330,
      price: 380,
      tax: 450,
      amount: 510
    } as const;

    doc
      .lineWidth(1)
      .fillColor('#f8fafc')
      .rect(40, tableTop - 6, 515, 24)
      .fill('#f8fafc')
      .stroke('#e2e8f0');

    doc
      .fillColor('#1f2937')
      .font('Helvetica-Bold')
      .fontSize(10)
      .text('Item', columnX.item, tableTop, { width: 130 })
      .text('Description', columnX.desc, tableTop, { width: 120 })
      .text('Qty', columnX.qty, tableTop, { width: 40 })
      .text('Unit Price', columnX.price, tableTop, { width: 60 })
      .text('Tax %', columnX.tax, tableTop, { width: 50 })
      .text('Amount', columnX.amount, tableTop, { width: 70 });

    doc.moveDown();

    // Table rows
    doc.font('Helvetica').fontSize(10).fillColor('#1f2937');
    let rowY = tableTop + 24;

    invoice.lineItems.forEach((item, index) => {
      const baseAmount = item.quantity * item.unitPrice;
      const totalAmount = baseAmount + baseAmount * (item.taxRate / 100);

      const rowHeight = 24 + Math.max(0, (item.description?.length ?? 0) / 45) * 12;

      doc
        .fillColor(index % 2 === 0 ? '#ffffff' : '#f8fafc')
        .rect(40, rowY - 6, 515, rowHeight)
        .fill(index % 2 === 0 ? '#ffffff' : '#f8fafc');

      doc.fillColor('#1f2937');

      doc.text(item.name, columnX.item, rowY, { width: 130 });
      doc.text(item.description ?? '-', columnX.desc, rowY, { width: 130 });
      doc.text(item.quantity.toString(), columnX.qty, rowY, { width: 40 });
      doc.text(money(item.unitPrice), columnX.price, rowY, { width: 70 });
      doc.text(`${item.taxRate}%`, columnX.tax, rowY, { width: 50 });
      doc.text(money(totalAmount), columnX.amount, rowY, { width: 70 });

      rowY += rowHeight;
    });

    doc.moveTo(40, rowY - 6).lineTo(555, rowY - 6).stroke('#e2e8f0');

    doc.moveDown();

    // Totals summary
    const summaryTop = rowY + 10;
    doc.font('Helvetica-Bold').fontSize(11);
    doc.text('Subtotal', 360, summaryTop);
    doc.text(money(totals.subtotal), 470, summaryTop, { align: 'right' });

    doc.font('Helvetica').text('Tax Total', 360, summaryTop + 18);
    doc.text(money(totals.taxTotal), 470, summaryTop + 18, { align: 'right' });

    doc.text('Round-Off Adjustment', 360, summaryTop + 36);
    doc.text(money(totals.roundOff), 470, summaryTop + 36, { align: 'right' });

    doc.font('Helvetica-Bold').fontSize(12).fillColor('#2563eb');
    doc.text('Total Due', 360, summaryTop + 60);
    doc.text(money(totals.total), 470, summaryTop + 60, { align: 'right' });

    doc.moveDown(4);

    if (invoice.notes) {
      doc
        .font('Helvetica-Bold')
        .fontSize(11)
        .fillColor('#1f2937')
        .text('Notes')
        .font('Helvetica')
        .fontSize(10)
        .fillColor('#374151')
        .text(invoice.notes, { width: 460 });
    }

    doc.end();
  });
};
