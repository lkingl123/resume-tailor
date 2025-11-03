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

// === Helper: Safe JSON parsing ===
function safeParseJSON(raw: string) {
  const match = raw.match(/\{[\s\S]*\}/);
  const jsonOnly = match ? match[0] : raw;

  try {
    const repaired = jsonrepair(jsonOnly);
    return JSON.parse(repaired);
  } catch {
    console.warn("⚠️ Could not parse JSON. Returning raw text instead.");
    return { coverLetter: raw.trim() };
  }
}

// === MAIN HANDLER ===
export async function POST(req: NextRequest) {
  try {
    const { jobDescription, companyName } = await req.json();

    if (!jobDescription || !companyName) {
      return NextResponse.json(
        { error: "Missing jobDescription or companyName" },
        { status: 400 }
      );
    }

    // === Load Base Resume ===
    const resumePath = path.join(process.cwd(), "src", "data", "base_resume.json");
    const baseResume = JSON.parse(fs.readFileSync(resumePath, "utf-8"));

    // === PROMPT ===
    const prompt = `
You are a professional resume and cover letter writer.

STRICT OUTPUT RULE:
Return ONLY a valid JSON object — no explanations, no markdown, and no commentary.
If anything other than JSON is included, the response is invalid.
Output format:
{"coverLetter": "..."}

Task:
Write a professional, tailored cover letter for "${companyName}" using the provided job description and resume.

Objectives:
- Connect the applicant’s experience and skills to the company’s goals and responsibilities.
- Highlight transferable strengths: automation, workflow optimization, AI systems, onboarding, innovation.
- DO NOT invent or imply any job titles not present in the resume.
- If the job description contains a section title (e.g., "Project Management"), discuss it as a *functional area* the applicant contributes to — not a formal title.
- DO NOT mention specific platforms or tools (e.g., Yardi, Salesforce, SAP) unless they are listed in the resume.
- Tone: confident, factual, and conversational.
- Mention "${companyName}" exactly once.
- Length: 150–200 words.
- End with this closing:
  "Thank you for your time and consideration.
  Best regards,
  Jake Loke"

=== JOB DESCRIPTION ===
${jobDescription}

=== USER RESUME ===
${JSON.stringify(baseResume, null, 2)}
`;

    // === Call Ollama ===
    const rawResponse = await callOllama(prompt);

    // === Parse safely ===
    const data = safeParseJSON(rawResponse);
    const finalLetter = data.coverLetter?.trim() || rawResponse;

    console.log(`✅ Cover letter for ${companyName} generated successfully`);
    return NextResponse.json({ coverLetter: finalLetter, company: companyName });
  } catch (err: any) {
    console.error("❌ Error generating cover letter:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
