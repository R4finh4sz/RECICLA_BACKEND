import PDFDocument from 'pdfkit';

function stripHtml(html: string) {
  return String(html || '')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export default ({ strapi }: { strapi: any }) => ({
  async execute(ctx: any) {
    const termo = await strapi.documents('api::termo.termo').findFirst({
      sort: { updatedAt: 'desc' },
    });

    if (!termo) {
      return ctx.notFound('Nenhum termo ativo encontrado.');
    }

    const title = String((termo as any).title || 'Termos de Uso');
    const updatedAt = String((termo as any).updatedAt || '');
    const content = stripHtml(String((termo as any).content || ''));

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(Buffer.from(c)));
    const endPromise = new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });

    doc.fontSize(18).text(title, { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).text(`Última atualização: ${updatedAt}`, { align: 'center' });
    doc.moveDown(1);
    doc.fontSize(12).text(content, { align: 'left' });
    doc.end();

    const pdfBuffer = await endPromise;

    ctx.set('Content-Type', 'application/pdf');
    ctx.set('Content-Disposition', `attachment; filename="termos_recicla.pdf"`);
    ctx.body = pdfBuffer;
  },
});