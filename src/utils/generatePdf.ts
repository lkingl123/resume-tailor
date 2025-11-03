import jsPDF from "jspdf";

/**
 * Generates a PDF resume.
 * @param result  Tailored resume JSON from API
 * @param company Optional company name (used for filename)
 */
export const generateResumePDF = (
  result: any,
  company: string = "Company"
): void => {
  const doc = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const leftMargin = 30;
  const rightMargin = 30;
  const usableWidth = pageWidth - leftMargin - rightMargin;
  const topMargin = 40;
  const bottomLimit = pageHeight - 40;
  const baseLine = 12;
  let y = topMargin;

  const addLine = (
    text: string,
    size = 10,
    bold = false,
    indent = 0,
    align: "left" | "center" | "right" = "left"
  ): void => {
    if (!text) return;
    doc.setFontSize(size);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    const lines: string[] = doc.splitTextToSize(text, usableWidth - indent);
    for (const line of lines) {
      if (y > bottomLimit) {
        doc.addPage();
        y = topMargin;
      }
      const x =
        align === "center"
          ? pageWidth / 2
          : align === "right"
          ? pageWidth - rightMargin
          : leftMargin + indent;
      doc.text(line, x, y, { align });
      y += baseLine;
    }
  };

  const addDualLine = (left: string, right: string, size = 10): void => {
    doc.setFontSize(size);
    doc.setFont("helvetica", "normal");
    if (y > bottomLimit) {
      doc.addPage();
      y = topMargin;
    }
    doc.text(left, leftMargin, y, { align: "left" });
    doc.setFont("helvetica", "bold");
    doc.text(right, pageWidth - rightMargin, y, { align: "right" });
    y += baseLine;
  };

  const addSpacing = (lines = 1): void => {
    y += baseLine * lines;
  };

  // === HEADER ===
  const name = result.header?.name || "Your Name";
  addLine(name, 20, true, 0, "center");
  addSpacing(0.3);

  const headerLine = [
    result.header?.location,
    result.header?.phone,
    result.header?.github,
    result.header?.linkedin,
  ]
    .filter(Boolean)
    .join(" | ");
  addLine(headerLine, 9, false, 0, "center");
  addSpacing(1);

  // === SUMMARY ===
  if (result.summary) {
    addLine("SUMMARY OF QUALIFICATIONS", 11, true);
    addLine(result.summary, 9.5);
    addSpacing(1.2);
  }

  // === TECHNICAL SKILLS ===
  if (result.technical_skills) {
    addLine("TECHNICAL SKILLS", 11, true);
    for (const [key, val] of Object.entries(result.technical_skills)) {
      const joined = Array.isArray(val) ? val.join(" • ") : String(val);
      addLine(`${key}: ${joined}`, 9.5);
    }
    addSpacing(1.2);
  }

  // === EXPERIENCE ===
  if (Array.isArray(result.experience)) {
    addLine("PROFESSIONAL EXPERIENCE", 11, true);
    addSpacing(0.3);
    for (const exp of result.experience) {
      addLine(`${exp.company || ""}, ${exp.location || ""}`, 10, true);
      addDualLine(exp.title || "", exp.dates || "", 9.5);
      if (Array.isArray(exp.bullets))
        exp.bullets.forEach((b: string) => addLine(`• ${b}`, 9.5, false, 12));
      addSpacing(0.5);
    }
    addSpacing(1.0);
  }

  // === PROJECTS ===
  if (Array.isArray(result.projects)) {
    addLine("PROJECTS", 11, true);
    addSpacing(0.3);
    for (const proj of result.projects) {
      addDualLine(proj.title || "", proj.dates || "", 10);
      if (Array.isArray(proj.bullets))
        proj.bullets.forEach((b: string) => addLine(`• ${b}`, 9.5, false, 12));
      addSpacing(0.5);
    }
    addSpacing(0.5);
  }

  // === EDUCATION ===
  if (Array.isArray(result.education)) {
    addLine("EDUCATION & CERTIFICATES", 11, true);
    addSpacing(0.3);
    result.education.forEach((edu: any, i: number) => {
      addDualLine(edu.school || "", edu.dates || "", 9.5);
      addLine(edu.degree || "", 9.5, false, 12);
      if (i < result.education.length - 1) addSpacing(0.4);
    });
  }

  const safeCompany = company.replace(/[^a-z0-9]/gi, "_").toLowerCase();
  doc.save(`Resume_for_${safeCompany}.pdf`);
  console.log(`✅ Resume generated for ${company}`);
};
