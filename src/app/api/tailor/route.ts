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
      temperature: 0.7,
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

// === MAIN HANDLER ===
export async function POST(req: NextRequest) {
  try {
    const { jobDescription, companyName } = await req.json();

    if (!jobDescription) {
      return NextResponse.json({ error: "Missing job description" }, { status: 400 });
    }

    // === Load base resume ===
    const resumePath = path.join(process.cwd(), "src", "data", "base_resume.json");
    const baseResume = JSON.parse(fs.readFileSync(resumePath, "utf-8"));

    // === SUMMARY PROMPT ===
    const summaryPrompt = `
You are a professional resume writer.

Task:
Rewrite ONLY the "summary" section to align with the job description for ${
      companyName || "the company"
    } — emphasizing transferable skills, measurable impact, and system-level thinking rather than specific tools or platforms.

Rules:
- Focus on essence: automation, workflow optimization, AI-driven solutions, team enablement, and scalable systems.
- Do NOT mention specific software names (e.g., Yardi, Salesforce, SAP, etc.) unless already in the base resume.
- Keep tone confident and factual.
- Keep it concise (3–5 sentences max).
- Return valid JSON exactly in this format:
{
  "summary": "..."
}

=== JOB DESCRIPTION ===
${jobDescription}

=== CURRENT SUMMARY ===
${baseResume.summary}
`;

    // === EXPERIENCE PROMPT ===
    const expPrompt = `
You are a professional technical resume writer.

Task:
Rewrite the "bullets" for each experience entry below so they align with the provided job description at ${
      companyName || "the company"
    } — focusing on high-level contributions and avoiding tool-specific references.

Guidelines:
- Keep "company", "location", "title", and "dates" unchanged.
- Write exactly 3 concise, impactful bullet points per role.
- Focus on *functional essence*:
  - process improvement
  - automation and AI integration
  - scalable system design
  - workflow optimization
  - training infrastructure
  - data-driven decision-making
- DO NOT include vendor names or placeholder metrics (like [X]%).
- Instead of numeric values, use qualitative results (e.g., "significant improvement", "enhanced efficiency", "streamlined collaboration").
- Each bullet should describe impact and outcome using strong verbs (Automated, Optimized, Designed, Streamlined, Improved).
- Keep tone natural and professional — like a top-tier LinkedIn experience section.
- Return valid JSON only in this format:
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

    // === Parse AI responses safely ===
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
              ? aiBullets.map((b: string) =>
                  b
                    .replace(/\[X\]%?/gi, "") // remove placeholders
                    .replace(/\[.*?\]/g, "") // remove any leftover [text]
                    .replace(/\s{2,}/g, " ") // cleanup extra spaces
                    .trim()
                )
              : [
                  `${exp.title}: Designed and implemented automation solutions to optimize workflows and improve efficiency.`,
                  `${exp.title}: Collaborated cross-functionally to streamline processes and enhance scalability.`,
                  `${exp.title}: Supported adoption of modern tools and best practices to drive innovation.`,
                ],
          };
        })
      : baseResume.experience.map((exp: any) => ({
          ...exp,
          bullets: Array.isArray(exp.bullets)
            ? exp.bullets.map((b: string) =>
                b
                  .replace(/\[X\]%?/gi, "")
                  .replace(/\[.*?\]/g, "")
                  .trim()
              )
            : [
                `${exp.title}: Designed and implemented automation solutions to optimize workflows and improve efficiency.`,
                `${exp.title}: Collaborated cross-functionally to streamline processes and enhance scalability.`,
                `${exp.title}: Supported adoption of modern tools and best practices to drive innovation.`,
              ],
        }));

    // === Build final tailored resume ===
    const tailoredResume = {
      ...baseResume,
      summary: newSummary,
      experience: newExperience,
      projects: baseResume.projects,
      education: baseResume.education,
      company: companyName || "Company",
    };

    console.log(`✅ Tailored resume generated successfully for ${companyName || "Company"}`);
    return NextResponse.json({ tailoredResume, company: companyName || "Company" });
  } catch (err: any) {
    console.error("❌ Error in tailor API:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
