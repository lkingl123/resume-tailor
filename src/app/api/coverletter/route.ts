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

// === Helper: Safe JSON parsing with cleanup ===
function safeParseJSON(raw: string) {
  // Clean up common formatting junk (before/after JSON)
  let cleaned = raw
    .replace(/```json|```/g, "")
    .replace(/^[^{]*\{/, "{") // remove everything before first {
    .replace(/\}[^}]*$/, "}"); // remove everything after last }

  try {
    const repaired = jsonrepair(cleaned);
    return JSON.parse(repaired);
  } catch (err) {
    console.warn("⚠️ Could not parse JSON. Returning raw text instead.");
    return { coverLetter: raw.trim() }; // fallback if still malformed
  }
}

// === API handler ===
export async function POST(req: NextRequest) {
  try {
    const { jobDescription } = await req.json();

    // === Load base resume ===
    const resumePath = path.join(process.cwd(), "src", "data", "base_resume.json");
    const baseResume = JSON.parse(fs.readFileSync(resumePath, "utf-8"));

    // === Prompt ===
    const prompt = `
You are a professional resume and cover letter writer.

Task: Write a professional, tailored cover letter based on the user's resume and job description below.

Guidelines:
- Length: 150–200 words.
- Tone: Confident, conversational, and human — not robotic.
- Mention relevant achievements or transferable skills.
- No repeating the resume verbatim.
- Mention the company name only once.
- End with a call to action ("I look forward to discussing further").
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

    console.log("✅ Cover letter generated successfully");
    return NextResponse.json({ coverLetter: finalLetter });
  } catch (err: any) {
    console.error("❌ Error in cover letter API:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
