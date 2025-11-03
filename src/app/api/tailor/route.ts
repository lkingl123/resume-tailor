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
      temperature: 0.7, // balanced creativity
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
    const { jobDescription } = await req.json();

    // === Load base resume ===
    const resumePath = path.join(process.cwd(), "src", "data", "base_resume.json");
    const baseResume = JSON.parse(fs.readFileSync(resumePath, "utf-8"));

    // === SUMMARY PROMPT ===
    const summaryPrompt = `
You are a professional resume writer.

Task: Rewrite ONLY the "summary" section to align with the given job description.

Rules:
- Keep it factual and professional.
- Do NOT add fake titles, companies, or years of experience.
- Do NOT mention the company name directly.
- Make it sound confident and natural, like a strong LinkedIn summary.
- Keep it concise (3–5 sentences).
- Focus on aligning tone and relevant strengths to the job posting.
- Return valid JSON exactly in this format:
{
  "summary": "..."
}

=== JOB DESCRIPTION ===
${jobDescription}

=== CURRENT SUMMARY ===
${baseResume.summary}
`;

    // === EXPERIENCE PROMPT (CONTEXT-AWARE DYNAMIC VERSION) ===
    const expPrompt = `
You are a professional technical resume writer.

Task: Rewrite the "bullets" for each experience entry below so that they naturally align with the provided job description — focusing on transferable skills, scope, and measurable outcomes.

Guidelines:
- Keep "company", "location", "title", and "dates" unchanged.
- Write exactly 3 concise bullet points for each role.
- You may reference technologies, tools, or concepts mentioned in the job description (e.g., APIs, Salesforce, Zoom), but do NOT imply that the candidate worked for or represented the company hiring (e.g., Gong.io).
- Emphasize impact, collaboration, and problem-solving.
- Avoid filler words like "responsible for" or "helped with".
- Use action verbs (e.g., Designed, Implemented, Automated, Improved).
- Maintain a professional and confident tone, suitable for modern tech resumes.
- Do NOT include any bracketed placeholders like [team names] or [technologies].
- Keep bullets 1–2 lines long, clear, and results-driven.
- Return only VALID JSON in this format:
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
                  `${exp.title}: Applied transferable technical skills to achieve measurable impact.`,
                  `${exp.title}: Collaborated across departments to streamline workflows and resolve issues.`,
                  `${exp.title}: Improved systems, documentation, and support efficiency through proactive solutions.`,
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
