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

    // === PROMPT (bulletproof) ===
    const prompt = `
You are a professional resume writer.

You will receive:
1. A complete BASE RESUME JSON (this must be preserved exactly).
2. A JOB DESCRIPTION.

Your task is to tailor the resume for the given job.

🧭 RULES:
- KEEP all names, titles, company names, dates, and education EXACTLY as in the base resume.
- ONLY rewrite:
  • "summary"
  • "bullets" arrays in "experience" and "projects".
- DO NOT modify "technical_skills" keys or their categories.
- DO NOT add, remove, or rename fields.
- RETURN a **single valid JSON object** only — no markdown, no commentary, no extra words.

=== JOB DESCRIPTION ===
${jobDescription}

=== BASE RESUME JSON (KEEP EVERYTHING ELSE IDENTICAL) ===
\`\`\`json
${resumeJSON}
\`\`\`

Now return only the final tailored resume JSON object.
`;

    // === Call Ollama ===
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

    // === STEP 1: Extract possible JSON block ===
    let rawJSON = aiResponse
      .replace(/^[^{]*\{/, "{") // remove junk before first {
      .replace(/\}[^}]*$/, "}") // remove junk after last }
      .replace(/```json|```/g, "") // strip code fences
      .replace(/^\s*Here.?s.*?{|Output:.*?{|JSON:/gi, "{"); // kill intro phrases

    // === STEP 2: Sanitize before repair (super hardened) ===
    rawJSON = rawJSON
      // remove rogue commas like ", , ,"
      .replace(/(,|\[|{)\s*,+\s*(,|\]|})/g, "$1$2")
      // remove commas before ] or }
      .replace(/,\s*([\]}])/g, "$1")
      // remove commas after [ or {
      .replace(/([\[{])\s*,\s*/g, "$1")
      // quote unquoted keys
      .replace(/([{,])\s*([A-Za-z0-9_]+)\s*:/g, '$1"$2":')
      // quote bareword values
      .replace(/:\s*([^",}\]\[]+)\s*([,}\]])/g, ':"$1"$2')
      // remove duplicate quotes
      .replace(/""/g, '"')
      // compress whitespace
      .replace(/\s+/g, " ")
      // remove stray trailing commas
      .replace(/,\s*(?=[}\]])/g, "")
      // trim leftover junk
      .replace(/^[^{]*\{/, "{")
      .replace(/\}[^}]*$/, "}");

    let tailoredResume: any;

    // === STEP 3: Attempt parse + repair ===
    try {
      const repaired = jsonrepair(rawJSON);
      tailoredResume = JSON.parse(repaired);
      console.log("✅ JSON successfully parsed and repaired.");
    } catch (err) {
      console.warn("⚠️ Primary parse failed, attempting regex fallback...");

      try {
        const cleaned = rawJSON
          .replace(/:\s*undefined/g, ':""')
          .replace(/:\s*null/g, ':""')
          .replace(/:\s*NaN/g, ':""')
          .replace(/,\s*([\]}])/g, "$1");
        const repaired = jsonrepair(cleaned);
        tailoredResume = JSON.parse(repaired);
        console.log("✅ JSON repaired using fallback parser.");
      } catch (err2) {
        console.error("❌ JSON completely invalid, returning raw text.", err2);
        tailoredResume = { text: aiResponse };
      }
    }

    // === STEP 4: Safety validation ===
    if (tailoredResume && typeof tailoredResume === "object") {
      tailoredResume.experience ??= [];
      tailoredResume.projects ??= [];
      tailoredResume.education ??= [];
      tailoredResume.summary ??= "";

      for (const exp of tailoredResume.experience) {
        if (!Array.isArray(exp.bullets)) exp.bullets = [];
      }
      for (const proj of tailoredResume.projects) {
        if (!Array.isArray(proj.bullets)) proj.bullets = [];
      }
    }

    return NextResponse.json({ tailoredResume });
  } catch (err: any) {
    console.error("❌ Error in tailor API:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
