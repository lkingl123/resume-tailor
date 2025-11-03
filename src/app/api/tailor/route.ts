import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { jsonrepair } from "jsonrepair";

const OLLAMA_URL = "http://localhost:11434/api/generate";
const MODEL = "llama3";

async function callOllama(prompt: string) {
  const res = await fetch(OLLAMA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, prompt, stream: false, temperature: 0.7 }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.response.trim();
}

function safeParseJSON(raw: string) {
  let jsonStr = raw.replace(/^[^{]*\{/, "{").replace(/\}[^}]*$/, "}").replace(/```json|```/g, "");
  try {
    const repaired = jsonrepair(jsonStr);
    return JSON.parse(repaired);
  } catch {
    return null;
  }
}

function validBullets(arr: any): boolean {
  return Array.isArray(arr) && arr.every((b) => typeof b === "string" && b.length > 0);
}

export async function POST(req: NextRequest) {
  try {
    const { jobDescription, companyName } = await req.json();

    if (!jobDescription) {
      return NextResponse.json({ error: "Missing job description" }, { status: 400 });
    }

    const resumePath = path.join(process.cwd(), "src", "data", "base_resume.json");
    const baseResume = JSON.parse(fs.readFileSync(resumePath, "utf-8"));

    // === SUMMARY PROMPT ===
    const summaryPrompt = `
You are a professional resume writer.
Task: Rewrite ONLY the "summary" section to align with the job description for ${companyName || "the company"}.

Rules:
- Do NOT fabricate experience.
- Keep it 3–5 sentences.
- Keep tone confident and relevant.
Return valid JSON: {"summary": "..."}
=== JOB DESCRIPTION ===
${jobDescription}
=== CURRENT SUMMARY ===
${baseResume.summary}
`;

    // === EXPERIENCE PROMPT ===
    const expPrompt = `
You are a technical resume writer.
Task: Rewrite the bullets for each experience to match the job description at ${companyName || "the company"}.
Rules:
- Keep company/location/title/dates unchanged.
- Write 3 concise, measurable bullet points each.
- Do not imply working for ${companyName || "the company"} directly.
Return valid JSON: {"experience": [{ "bullets": [...] }, ...]}
=== JOB DESCRIPTION ===
${jobDescription}
=== CURRENT EXPERIENCE ===
${JSON.stringify(baseResume.experience, null, 2)}
`;

    const [summaryResponse, expResponse] = await Promise.all([
      callOllama(summaryPrompt),
      callOllama(expPrompt),
    ]);

    const summaryData = safeParseJSON(summaryResponse);
    const expData = safeParseJSON(expResponse);

    const newSummary = summaryData?.summary || baseResume.summary;
    const newExperience = Array.isArray(expData?.experience)
      ? baseResume.experience.map((exp: any, i: number) => {
          const aiBullets = expData.experience[i]?.bullets;
          return {
            ...exp,
            bullets: validBullets(aiBullets)
              ? aiBullets
              : exp.bullets || [
                  `${exp.title}: Improved team workflows and delivered measurable impact.`,
                  `${exp.title}: Collaborated across teams to achieve project goals.`,
                  `${exp.title}: Enhanced processes through automation and documentation.`,
                ],
          };
        })
      : baseResume.experience;

    const tailoredResume = {
      ...baseResume,
      summary: newSummary,
      experience: newExperience,
      company: companyName || "Company",
    };

    console.log(`✅ Tailored resume generated for ${companyName || "Company"}`);
    return NextResponse.json({ tailoredResume, company: companyName || "Company" });
  } catch (err: any) {
    console.error("❌ Error in tailor API:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
