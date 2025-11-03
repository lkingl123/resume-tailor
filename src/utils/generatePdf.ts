import jsPDF from "jspdf";

export const generateResumePDF = (result: any): void => {
  const doc = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Margins and layout
  const leftMargin = 25;
  const rightMargin = 25;
  const usableWidth = pageWidth - leftMargin - rightMargin;
  const topMargin = 40;
  const bottomLimit = pageHeight - 40;
  const baseLine = 11;
  const minSpacing = 3;

  console.log("=== PAGE METRICS ===", { pageWidth, pageHeight, usableWidth });

  interface LineItem {
    text: string;
    size: number;
    bold: boolean;
    indent?: number;
  }

  const content: LineItem[] = [];

  // --- Custom line wrapping ---
  const splitToFullWidth = (text: string, fontSize: number, maxWidth: number): string[] => {
    doc.setFontSize(fontSize);
    const words = text.split(" ");
    const lines: string[] = [];
    let current = "";

    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      if (doc.getTextWidth(test) > maxWidth && current) {
        lines.push(current);
        current = word;
      } else current = test;
    }

    if (current) lines.push(current);
    return lines;
  };

  const add = (text: string | string[] | undefined, size = 10, bold = false, indent = 0): void => {
    if (!text) return;
    const lines = Array.isArray(text)
      ? text.filter(Boolean)
      : splitToFullWidth(text, size, usableWidth - indent);
    lines.forEach((line) => content.push({ text: line, size, bold, indent }));
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
  if (result.summary) {
    add("SUMMARY OF QUALIFICATIONS", 11, true);
    add(result.summary, 9.5);
    add("", minSpacing);
  }

  // === TECHNICAL SKILLS ===
  if (result.technical_skills && Object.keys(result.technical_skills).length > 0) {
    add("TECHNICAL SKILLS", 11, true);
    for (const [key, val] of Object.entries(result.technical_skills)) {
      const joined = Array.isArray(val) ? val.join(", ") : val;
      add(`${key}: ${joined}`, 9.5);
    }
    add("", minSpacing);
  }

  // === EXPERIENCE ===
  if (Array.isArray(result.experience) && result.experience.length > 0) {
    add("PROFESSIONAL EXPERIENCE", 11, true);
    result.experience.forEach((exp: any) => {
      add(`${exp.company || ""}, ${exp.location || ""}`, 10, true);

      // --- Title left, date right ---
      if (exp.title || exp.dates) {
        const titleX = leftMargin;
        const dateX = pageWidth - rightMargin;
        const fontSize = 9.5;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(fontSize);
        doc.text(exp.title || "", titleX, 0, { align: "left" }); // store line only
        content.push({
          text: JSON.stringify({ title: exp.title, date: exp.dates, fontSize }),
          size: fontSize,
          bold: false,
        });
      }

      if (exp.bullets) {
        (Array.isArray(exp.bullets) ? exp.bullets : [exp.bullets])
          .filter(Boolean)
          .forEach((b: string) => add(`• ${b}`, 9.5, false, 12));
      }
      add("", minSpacing);
    });
  }

  // === PROJECTS ===
  if (Array.isArray(result.projects) && result.projects.length > 0) {
    add("PROJECTS", 11, true);
    result.projects.forEach((proj: any) => {
      // --- Title left, date right ---
      if (proj.title || proj.dates) {
        const titleX = leftMargin;
        const dateX = pageWidth - rightMargin;
        const fontSize = 10;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(fontSize);
        content.push({
          text: JSON.stringify({ title: proj.title, date: proj.dates, fontSize }),
          size: fontSize,
          bold: true,
        });
      }

      if (proj.bullets) {
        (Array.isArray(proj.bullets) ? proj.bullets : [proj.bullets])
          .filter(Boolean)
          .forEach((b: string) => add(`• ${b}`, 9.5, false, 12));
      }
      add("", minSpacing);
    });
  }

  // === EDUCATION === (unchanged)
  if (Array.isArray(result.education) && result.education.length > 0) {
    add("EDUCATION & CERTIFICATES", 11, true);
    result.education.forEach((edu: any) => {
      add(edu.school || "Unknown School", 10, true);
      add(`${edu.degree || ""}${edu.dates ? ` | ${edu.dates}` : ""}`, 9.5);
      add("", minSpacing);
    });
  }

  // === FIT ALL CONTENT INTO ONE PAGE ===
  const totalLines = content.length;
  const availableHeight = bottomLimit - topMargin;
  const usedHeight = totalLines * baseLine;
  let scaleFactor = 1;
  let lineHeight = baseLine;
  if (usedHeight > availableHeight) {
    scaleFactor = availableHeight / usedHeight;
    lineHeight = baseLine * scaleFactor;
  }

  console.log("=== AUTO SCALE ===", {
    totalLines,
    usedHeight,
    availableHeight,
    scaleFactor,
    lineHeight,
  });

  // === DRAW CONTENT ===
  let y = topMargin;
  content.forEach(({ text, size, bold, indent }: LineItem) => {
    const adjustedSize = size * scaleFactor;
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(adjustedSize);

    // Detect right-aligned JSON lines (experience/project headers)
    if (text.startsWith("{") && text.includes('"title"')) {
      const { title, date, fontSize } = JSON.parse(text);
      doc.text(title || "", leftMargin, y, { align: "left" });
      if (date) doc.text(date, pageWidth - rightMargin, y, { align: "right" });
    } else {
      doc.text(text, leftMargin + (indent || 0), y, { align: "left" });
    }
    y += lineHeight;
  });

  console.log("=== FINAL PAGE ===", { finalY: y, scaleFactor });
  doc.save("Resume_for_Companies.pdf");
  console.log("✅ Resume generated (fits within one page).");
};
