import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { jsonrepair } from "jsonrepair";

export async function POST(req: NextRequest) {
  try {
    const { jobDescription } = await req.json();

    // === Load base resume JSON ===
    const resumePath = path.join(process.cwd(), "src", "data", "base_resume.json");
    const resumeJSON = fs.readFileSync(resumePath, "utf-8");

    // === Build prompt for Ollama ===
    const prompt = `
You are a professional resume writer.

Below is my current resume in JSON format.
You must:
- Keep all personal information (name, contact, education, job titles, company names, and dates) exactly the same.
- Only rewrite or tailor the "summary" and "bullets" sections.
- Use the provided job description to decide what to emphasize.
- Preserve structure and return valid JSON.

=== JOB DESCRIPTION ===
${jobDescription}

=== CURRENT RESUME ===
${resumeJSON}

=== OUTPUT FORMAT ===
Return ONLY valid JSON strictly matching this structure:
{
  "header": {...},
  "summary": "string",
  "technical_skills": {...},
  "experience": [...],
  "projects": [...],
  "education": [...]
}

⚠️ Do not include explanations, markdown, comments, or text outside JSON.
⚠️ Do not insert extra keys or newlines.
⚠️ Ensure the output parses directly as valid JSON.
`;

    // === Send to Ollama ===
    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama3",
        prompt,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Ollama request failed: ${errText}`);
    }

    const data = await response.json();
    const aiResponse = data.response;

    // === Extract and repair JSON ===
    let tailoredResume;
    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found in AI output");

      const repaired = jsonrepair(jsonMatch[0]);
      tailoredResume = JSON.parse(repaired);
    } catch (err) {
      console.warn("⚠️ AI returned invalid JSON, fallback to raw text.", err);
      tailoredResume = { text: aiResponse };
    }

    // === Respond to frontend ===
    return NextResponse.json({ tailoredResume });
  } catch (err: any) {
    console.error("❌ Error in tailor API:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
