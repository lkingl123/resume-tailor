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
  let cleaned = raw
    .replace(/```json|```/g, "")
    .replace(/^[^{]*\{/, "{")
    .replace(/\}[^}]*$/, "}");

  try {
    const repaired = jsonrepair(cleaned);
    return JSON.parse(repaired);
  } catch {
    console.warn("⚠️ Could not parse JSON. Returning raw text instead.");
    return { coverLetter: raw.trim() };
  }
}

// === POST handler ===
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

    // === Prompt ===
    const prompt = `
You are a professional resume and cover letter writer.

Task: Write a professional, tailored cover letter for the company "${companyName}" 
based on the user's resume and job description below.

Guidelines:
- Length: 150–200 words.
- Tone: Confident, conversational, and human — not robotic.
- Mention "${companyName}" only once in the letter.
- Mention relevant achievements or transferable skills.
- No repeating the resume verbatim.
- End with a call to action such as "I look forward to discussing further."
- Output must be STRICT JSON in this format ONLY:
{
  "coverLetter": "..."
}

=== JOB DESCRIPTION ===
${jobDescription}

=== USER RESUME ===
${JSON.stringify(baseResume, null, 2)}
`;

    const rawResponse = await callOllama(prompt);
    const data = safeParseJSON(rawResponse);
    const finalLetter = data.coverLetter?.trim() || rawResponse;

    console.log(`✅ Cover letter for ${companyName} generated successfully`);
    return NextResponse.json({ coverLetter: finalLetter, company: companyName });
  } catch (err: any) {
    console.error("❌ Error generating cover letter:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
