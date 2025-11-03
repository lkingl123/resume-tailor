import jsPDF from "jspdf";

// --- TYPES ---
interface ResumeHeader {
  name?: string;
  location?: string;
  phone?: string;
  github?: string;
  linkedin?: string;
}

interface Experience {
  company?: string;
  location?: string;
  title?: string;
  dates?: string;
  bullets?: string[] | string | undefined;
}

interface Education {
  school?: string;
  degree?: string;
  dates?: string;
}

interface TechnicalSkills {
  [key: string]: string[] | string;
}

export interface ResumeData {
  header?: ResumeHeader;
  summary?: string;
  experience?: Experience[];
  education?: Education[];
  technical_skills?: TechnicalSkills;
  text?: string;
}

// --- MAIN FUNCTION ---
export const generateResumePDF = (result: ResumeData): void => {
  if (!result) {
    alert("No tailored resume found!");
    return;
  }

  const doc = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });

  const left = 45;
  const right = 550;
  const width = right - left;
  const baseLine = 12;
  const topMargin = 60;
  const bottomLimit = 780;

  interface LineItem {
    text: string;
    size: number;
    bold: boolean;
    indent?: number;
  }

  const content: LineItem[] = [];

  const add = (
    text: string | string[] | undefined,
    size = 10,
    bold = false,
    indent = 0
  ): void => {
    if (!text) return;
    const lines: string[] = Array.isArray(text)
      ? text.filter((t): t is string => Boolean(t))
      : doc.splitTextToSize(text, width - indent);
    lines.forEach((line: string) => content.push({ text: line, size, bold, indent }));
  };

  // === HEADER ===
  add(result.header?.name || "Your Name", 20, true);
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
    10,
    false
  );

  add("", 8, false);

  // === SUMMARY ===
  add("SUMMARY OF QUALIFICATIONS", 11, true);
  add(result.summary || "N/A", 10, false);

  add("", 8, false);

  // === TECHNICAL SKILLS ===
  if (result.technical_skills) {
    add("TECHNICAL SKILLS", 11, true);
    for (const [key, value] of Object.entries(result.technical_skills)) {
      const joined =
        typeof value === "string" ? value : (value as string[]).join(", ");
      add(`${key[0].toUpperCase() + key.slice(1)}: ${joined}`, 10, false);
    }
  }

  add("", 8, false);

  // === EXPERIENCE ===
  if (Array.isArray(result.experience)) {
    add("PROFESSIONAL EXPERIENCE", 11, true);
    result.experience.forEach((exp: Experience) => {
      add(`${exp.company || ""}, ${exp.location || ""}`, 10.5, true);
      add(`${exp.title || ""}     ${exp.dates || ""}`, 10, false);

      if (exp.bullets) {
        const bullets = Array.isArray(exp.bullets)
          ? exp.bullets
          : [exp.bullets];
        bullets
          .filter((b): b is string => Boolean(b))
          .forEach((b: string) => add(`• ${b}`, 10, false, 15));
      }

      add("", 6, false);
    });
  }

  add("", 8, false);

  // === EDUCATION ===
  if (Array.isArray(result.education)) {
    add("EDUCATION & CERTIFICATES", 11, true);
    result.education.forEach((edu: Education) => {
      add(edu.school || "Unknown School", 10.5, true);
      const degreeLine = `${edu.degree || ""}${
        edu.dates ? ` — ${edu.dates}` : ""
      }`;
      add(degreeLine, 10, false);
      add("", 6, false);
    });
  }

  // --- SMART PAGE BALANCE ---
  const totalLines = content.length;
  const usedHeight = totalLines * baseLine;
  const remaining = bottomLimit - topMargin - usedHeight;
  const extraPerLine = remaining > 0 ? remaining / totalLines : 0;
  const lineHeight = baseLine + extraPerLine;

  console.log(
    `[ResumeTailor] Lines: ${totalLines}, BaseHeight: ${baseLine}, Stretch: +${extraPerLine.toFixed(
      2
    )} per line`
  );

  let y = topMargin;

  content.forEach(({ text, size, bold, indent }: LineItem) => {
    if (y + lineHeight > bottomLimit) {
      doc.addPage();
      y = topMargin;
    }
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.text(text, left + (indent || 0), y);
    y += lineHeight;
  });

  doc.save("Resume_for_Companies.pdf");
  console.log("✅ Resume_for_Companies.pdf generated successfully!");
};
