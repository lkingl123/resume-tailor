import jsPDF from "jspdf";

/**
 * Generates a PDF from a cover letter string.
 * @param data An object with a header (title) and body (cover letter content).
 */
export const generateCoverLetterPDF = (data: { header: string; body: string }): void => {
  const doc = new jsPDF({
    orientation: "p",
    unit: "pt",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const leftMargin = 40;
  const rightMargin = 40;
  const topMargin = 50;
  const usableWidth = pageWidth - leftMargin - rightMargin;

  let y = topMargin;

  // === Header ===
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  const headerLines: string[] = doc.splitTextToSize(data.header, usableWidth);
  for (const line of headerLines) {
    doc.text(line, leftMargin, y);
    y += 20;
  }

  y += 10; // Space between header and body

  // === Body ===
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  const bodyLines: string[] = doc.splitTextToSize(data.body, usableWidth);

  for (const line of bodyLines) {
    if (y > pageHeight - 50) {
      doc.addPage();
      y = topMargin;
    }
    doc.text(line, leftMargin, y);
    y += 16;
  }

  // Save the file
  doc.save("cover_letter_for_company.pdf");
};
