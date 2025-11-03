import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { jsonrepair } from "jsonrepair";

const OLLAMA_URL = "http://localhost:11434/api/generate";
const MODEL = "llama3";

// === Helper: call Ollama ===
async function callOllama(prompt: string) {
  const res = await fetch(OLLAMA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      prompt,
      stream: false,
      temperature: 0.0,
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.response.trim();
}

// === Helper: safe parse ===
function safeParseJSON(raw: string) {
  let jsonStr = raw
    .replace(/^[^{]*\{/, "{")
    .replace(/\}[^}]*$/, "}")
    .replace(/```json|```/g, "");
  try {
    const repaired = jsonrepair(jsonStr);
    return JSON.parse(repaired);
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { jobDescription } = await req.json();

    // === Load base resume ===
    const resumePath = path.join(process.cwd(), "src", "data", "base_resume.json");
    const baseResume = JSON.parse(fs.readFileSync(resumePath, "utf-8"));

    // === Build prompts ===
    const summaryPrompt = `
You are a professional resume writer.

Task: Rewrite ONLY the "summary" section to align with the job description.

Rules:
- Keep it factual.
- No fake titles or years of experience.
- Return JSON: { "summary": "..." }

=== JOB DESCRIPTION ===
${jobDescription}

=== CURRENT SUMMARY ===
${baseResume.summary}
`;

    const expPrompt = `
You are a technical resume editor.

Rewrite only the "bullets" for each job to match the job description.

Rules:
- Keep all company names, titles, dates.
- Focus on relevance & measurable outcomes.
- Return JSON: { "experience": [ ... ] }

=== JOB DESCRIPTION ===
${jobDescription}

=== CURRENT EXPERIENCE ===
${JSON.stringify(baseResume.experience, null, 2)}
`;

    // === Run both AI calls in parallel ===
    const [summaryResponse, expResponse] = await Promise.all([
      callOllama(summaryPrompt),
      callOllama(expPrompt),
    ]);

    const summaryData = safeParseJSON(summaryResponse);
    const expData = safeParseJSON(expResponse);

    // === Merge results with fallbacks ===
    const newSummary = summaryData?.summary || baseResume.summary;

    const newExperience =
      Array.isArray(expData?.experience) && expData.experience.length > 0
        ? baseResume.experience.map((exp: any, i: number) => ({
            ...exp,
            bullets:
              Array.isArray(expData.experience[i]?.bullets) &&
              expData.experience[i].bullets.length > 0
                ? expData.experience[i].bullets
                : exp.bullets,
          }))
        : baseResume.experience;

    const tailoredResume = {
      ...baseResume,
      summary: newSummary,
      experience: newExperience,
      projects: baseResume.projects,
      education: baseResume.education,
    };

    console.log("✅ Tailored resume generated (parallel mode)");
    return NextResponse.json({ tailoredResume });
  } catch (err: any) {
    console.error("❌ Error in tailor API:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
