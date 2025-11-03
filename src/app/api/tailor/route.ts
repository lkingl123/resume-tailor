import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function POST(req: NextRequest) {
  try {
    const { jobDescription } = await req.json();

    // Load base resume
    const resumePath = path.join(
      process.cwd(),
      "src",
      "data",
      "base_resume.json"
    );

    const resumeJSON = fs.readFileSync(resumePath, "utf-8");

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
Return a JSON with the same structure, replacing only:
- "summary"
- any field containing "bullets" with rewritten content.

Avoid mentioning frameworks, tools, or technologies that are not already present in the original resume.
Focus on results, impact, metrics, and action-oriented phrasing (e.g., improved, delivered, implemented).
Do not mention Vue.js, Angular, or other unrelated technologies.
Keep tone professional, concise, and accomplishment-based.
`;

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
      const text = await response.text();
      throw new Error(`Ollama request failed: ${text}`);
    }

    const data = await response.json();
    const aiResponse = data.response;

    // Validate and parse JSON output
    let tailoredResume;
    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/); // find first {...} JSON block
      if (jsonMatch) {
        tailoredResume = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in AI output");
      }
    } catch (err) {
      console.warn(
        "⚠️ AI returned text instead of JSON — fallback to text mode:",
        err
      );
      tailoredResume = { text: aiResponse };
    }

    return NextResponse.json({ tailoredResume });
  } catch (err: any) {
    console.error("Error in tailor API:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
