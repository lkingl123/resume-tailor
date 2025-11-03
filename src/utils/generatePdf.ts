import jsPDF from "jspdf";

export const generateResumePDF = (result: any): void => {
  const doc = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // --- margins ---
  const leftMargin = 25;
  const rightMargin = 25;
  const usableWidth = pageWidth - leftMargin - rightMargin;
  const topMargin = 40;
  const bottomLimit = pageHeight - 40;

  // --- base line settings ---
  const baseLine = 11; // baseline spacing
  const minSpacing = 3; // minimal space between sections

  console.log("=== PAGE METRICS ===", { pageWidth, pageHeight, usableWidth });

  interface LineItem {
    text: string;
    size: number;
    bold: boolean;
    indent?: number;
  }

  const content: LineItem[] = [];

  // --- custom word-wrap ---
  const splitToFullWidth = (text: string, fontSize: number, maxWidth: number): string[] => {
    doc.setFontSize(fontSize);
    const words = text.split(" ");
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
      const test = current ? current + " " + word : word;
      if (doc.getTextWidth(test) > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
    return lines;
  };

  const add = (text: string | string[] | undefined, size = 10, bold = false, indent = 0): void => {
    if (!text) return;
    const lines = Array.isArray(text)
      ? text.filter(Boolean)
      : splitToFullWidth(text, size, usableWidth - indent);
    lines.forEach(line => content.push({ text: line, size, bold, indent }));
  };

  // === HEADER ===
  add(result.header?.name || "Your Name", 18, true);
  add(
    [
      [
        result.header?.location,
        result.header?.phone,
        result.header?.github,
        result.header?.linkedin,
      ]
        .filter(Boolean)
        .join(" | "),
    ],
    9
  );
  add("", minSpacing);

  // === SUMMARY ===
  add("SUMMARY OF QUALIFICATIONS", 11, true);
  add(result.summary || "N/A", 9.5);
  add("", minSpacing);

  // === TECHNICAL SKILLS ===
  if (result.technical_skills) {
    add("TECHNICAL SKILLS", 11, true);
    for (const [key, val] of Object.entries(result.technical_skills)) {
      const joined = Array.isArray(val) ? val.join(", ") : val;
      add(`${key[0].toUpperCase() + key.slice(1)}: ${joined}`, 9.5);
    }
    add("", minSpacing);
  }

  // === EXPERIENCE ===
  if (Array.isArray(result.experience)) {
    add("PROFESSIONAL EXPERIENCE", 11, true);
    result.experience.forEach((exp: any, i: number) => {
      add(`${exp.company || ""}, ${exp.location || ""}`, 10, true);
      add(`${exp.title || ""}     ${exp.dates || ""}`, 9.5);
      if (exp.bullets) {
        (Array.isArray(exp.bullets) ? exp.bullets : [exp.bullets])
          .filter(Boolean)
          .forEach((b: string, idx: number) => add(`• ${b}`, 9.5, false, 12));
      }
      add("", minSpacing);
    });
  }

  // === EDUCATION ===
  if (Array.isArray(result.education)) {
    add("EDUCATION & CERTIFICATES", 11, true);
    result.education.forEach((edu: any, i: number) => {
      add(edu.school || "Unknown School", 10, true);
      add(`${edu.degree || ""}${edu.dates ? ` | ${edu.dates}` : ""}`, 9.5);
      add("", minSpacing);
    });
  }

  // === Calculate dynamic spacing ===
  const totalLines = content.length;
  const usedHeight = totalLines * baseLine;
  const remaining = bottomLimit - topMargin - usedHeight;
  const stretchPerLine = remaining > 0 ? remaining / totalLines : 0;
  const lineHeight = baseLine + stretchPerLine; // evenly stretch vertically

  console.log("=== SPACING ADJUST ===", {
    totalLines,
    usedHeight,
    remaining,
    stretchPerLine,
    lineHeight,
  });

  // === DRAW TEXT ===
  let y = topMargin;
  content.forEach(({ text, size, bold, indent }: LineItem) => {
    if (y + lineHeight > bottomLimit) {
      doc.addPage();
      y = topMargin;
    }

    // ❌ removed underline (was visually unnecessary)
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.text(text, leftMargin + (indent || 0), y, { align: "left" });

    y += lineHeight;
  });

  console.log("=== FINAL PAGE METRICS ===", {
    finalY: y,
    totalPages: doc.getNumberOfPages(),
  });

  doc.save("Resume_for_Companies.pdf");
  console.log("✅ Resume generated with full dynamic fill.");
};
