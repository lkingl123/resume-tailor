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
      temperature: 0.4, // Adds light creativity without hallucinating
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

// === Helper: validate bullet list ===
function validBullets(arr: any): boolean {
  return Array.isArray(arr) && arr.every((b) => typeof b === "string" && b.length > 0);
}

export async function POST(req: NextRequest) {
  try {
    const { jobDescription } = await req.json();

    // === Load base resume ===
    const resumePath = path.join(process.cwd(), "src", "data", "base_resume.json");
    const baseResume = JSON.parse(fs.readFileSync(resumePath, "utf-8"));

    // === SUMMARY PROMPT ===
    const summaryPrompt = `
You are a professional resume writer.

Task: Rewrite ONLY the "summary" section to align with the job description.

Rules:
- Keep it factual and professional.
- No fake titles or made-up years of experience.
- Return only valid JSON exactly in this format:
{
  "summary": "..."
}

=== JOB DESCRIPTION ===
${jobDescription}

=== CURRENT SUMMARY ===
${baseResume.summary}
`;

    // === EXPERIENCE PROMPT (ENHANCED) ===
    const expPrompt = `
You are a professional technical resume editor.

Task: Rewrite the "bullets" for each experience entry below so that they align with the job description — even if the role title differs.

Rules:
- Keep "company", "location", "title", and "dates" unchanged.
- Always generate bullets for every job — do NOT write "Not applicable".
- Use the "title" as a creative context guide. For example:
  - Software Engineer → emphasize coding, architecture, testing, cloud integration.
  - Tier 3 Support → emphasize problem-solving, debugging, customer support.
  - Business Analyst → emphasize requirements gathering, process improvement, data analysis.
- Highlight measurable outcomes and transferable skills (e.g., collaboration, systems improvement, automation).
- Write exactly 3 concise bullet points using action verbs.
- Return VALID JSON in this format:
{
  "experience": [
    { "bullets": ["bullet 1", "bullet 2", "bullet 3"] },
    { "bullets": ["bullet 1", "bullet 2", "bullet 3"] },
    { "bullets": ["bullet 1", "bullet 2", "bullet 3"] }
  ]
}

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

    // === Parse responses safely ===
    const summaryData = safeParseJSON(summaryResponse);
    const expData = safeParseJSON(expResponse);

    // === Merge summary ===
    const newSummary = summaryData?.summary || baseResume.summary;

    // === Merge experience ===
    const newExperience = Array.isArray(expData?.experience)
      ? baseResume.experience.map((exp: any, i: number) => {
          const aiBullets = expData.experience[i]?.bullets;
          return {
            ...exp,
            bullets: validBullets(aiBullets)
              ? aiBullets
              : [
                  `${exp.title}: Contributed to project success and applied transferable analytical or technical skills.`,
                  `${exp.title}: Supported cross-functional teams through documentation, communication, or problem-solving.`,
                  `${exp.title}: Strengthened workflows and outcomes aligned with organizational goals.`,
                ],
          };
        })
      : baseResume.experience.map((exp: any) => ({
          ...exp,
          bullets: Array.isArray(exp.bullets)
            ? exp.bullets.map((b: string) => b.replace(/\{\{.*?\}\}/g, ""))
            : [
                `${exp.title}: Applied transferable skills to support team operations.`,
                `${exp.title}: Delivered value through collaboration and process improvements.`,
                `${exp.title}: Contributed to the success of cross-functional initiatives.`,
              ],
        }));

    // === Build final tailored resume ===
    const tailoredResume = {
      ...baseResume,
      summary: newSummary,
      experience: newExperience,
      projects: baseResume.projects,
      education: baseResume.education,
    };

    console.log("✅ Tailored resume generated successfully");
    return NextResponse.json({ tailoredResume });
  } catch (err: any) {
    console.error("❌ Error in tailor API:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
