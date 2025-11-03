"use client";
import { useState } from "react";
import { generateResumePDF } from "@/utils/generatePdf";
import { log } from "@/utils/logger";

export default function HomePage() {
  const [jobDesc, setJobDesc] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleTailor = async () => {
    if (!jobDesc.trim()) return alert("Please paste a job description!");
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/tailor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobDescription: jobDesc }),
      });

      const data = await res.json();
      log("API response:", data);

      if (data.error) throw new Error(data.error);
      setResult(data.tailoredResume);
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0f172a] flex flex-col items-center py-10 px-6 text-[#f1f5f9]">
      <h1 className="text-4xl font-bold text-[#3b82f6] mb-8 tracking-tight">
        🎯 AI Resume Tailor (Local Ollama)
      </h1>

      <textarea
        className="bg-[#1e293b] border border-[#334155] p-4 rounded-md h-64 w-full max-w-4xl focus:outline-none focus:ring-2 focus:ring-[#3b82f6] placeholder-gray-400 text-[#f1f5f9]"
        placeholder="Paste the job description here..."
        value={jobDesc}
        onChange={(e) => setJobDesc(e.target.value)}
      />

      <button
        onClick={handleTailor}
        disabled={loading}
        className="mt-6 px-8 py-3 bg-[#3b82f6] rounded-md hover:bg-[#2563eb] disabled:bg-gray-600 transition-all"
      >
        {loading ? "Generating..." : "✨ Tailor Resume"}
      </button>

      {result && (
        <div className="mt-10 bg-[#1e293b] border border-[#334155] rounded-lg p-6 w-full max-w-5xl shadow-lg">
          <h2 className="text-2xl font-semibold text-[#3b82f6] mb-4">
            Tailored Resume (Preview)
          </h2>
          <pre className="whitespace-pre-wrap text-gray-100 text-sm font-sans leading-relaxed">
            {JSON.stringify(result, null, 2)}
          </pre>
          <button
            onClick={() => generateResumePDF(result)}
            className="mt-4 px-5 py-2 bg-[#22c55e] text-white rounded hover:bg-[#16a34a]"
          >
            ⬇️ Download PDF
          </button>
        </div>
      )}
    </main>
  );
}
