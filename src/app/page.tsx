"use client";
import { useState } from "react";
import { generateResumePDF } from "@/utils/generatePdf";
import { generateCoverLetterPDF } from "@/utils/generateCoverLetterPdf";
import { log } from "@/utils/logger";

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<"resume" | "cover">("resume");
  const [jobDesc, setJobDesc] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (!jobDesc.trim()) return alert("Please paste a job description!");
    if (!companyName.trim()) return alert("Please enter the company name!");

    setLoading(true);
    setResult(null);

    const apiEndpoint =
      activeTab === "resume" ? "/api/tailor" : "/api/coverletter";

    try {
      const body = JSON.stringify({
        jobDescription: jobDesc,
        companyName: companyName.trim(),
      });

      const res = await fetch(apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });

      const data = await res.json();
      log("API response:", data);

      if (data.error) throw new Error(data.error);
      setResult(data.tailoredResume || data.coverLetter);
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = () => {
    if (!result) return;

    if (activeTab === "resume") {
      generateResumePDF(result, companyName);
    } else {
      generateCoverLetterPDF({
        header: `Cover Letter for ${companyName}`,
        body: typeof result === "string" ? result : result.coverLetter,
        company: companyName,
      });
    }
  };

  return (
    <main className="min-h-screen bg-[#0f172a] flex flex-col items-center py-10 px-6 text-[#f1f5f9]">
      <h1 className="text-4xl font-bold text-[#3b82f6] mb-8 tracking-tight text-center">
        🎯 AI Resume & Cover Letter Tailor (Local Ollama)
      </h1>

      {/* Tabs */}
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setActiveTab("resume")}
          className={`px-6 py-2 rounded-md font-semibold transition-all ${
            activeTab === "resume"
              ? "bg-[#3b82f6] text-white"
              : "bg-[#1e293b] text-gray-300 hover:bg-[#334155]"
          }`}
        >
          🎯 Resume
        </button>
        <button
          onClick={() => setActiveTab("cover")}
          className={`px-6 py-2 rounded-md font-semibold transition-all ${
            activeTab === "cover"
              ? "bg-[#3b82f6] text-white"
              : "bg-[#1e293b] text-gray-300 hover:bg-[#334155]"
          }`}
        >
          📝 Cover Letter
        </button>
      </div>

      {/* Company Name Input (shared for both tabs) */}
      <input
        type="text"
        className="mb-4 bg-[#1e293b] border border-[#334155] p-3 rounded-md w-full max-w-4xl text-[#f1f5f9] focus:outline-none focus:ring-2 focus:ring-[#3b82f6] placeholder-gray-400"
        placeholder="Enter the company name..."
        value={companyName}
        onChange={(e) => setCompanyName(e.target.value)}
      />

      {/* Job Description Input */}
      <textarea
        className="bg-[#1e293b] border border-[#334155] p-4 rounded-md h-64 w-full max-w-4xl focus:outline-none focus:ring-2 focus:ring-[#3b82f6] placeholder-gray-400 text-[#f1f5f9]"
        placeholder="Paste the job description here..."
        value={jobDesc}
        onChange={(e) => setJobDesc(e.target.value)}
      />

      {/* Generate Button */}
      <button
        onClick={handleGenerate}
        disabled={loading}
        className="mt-6 px-8 py-3 bg-[#3b82f6] rounded-md hover:bg-[#2563eb] disabled:bg-gray-600 transition-all"
      >
        {loading
          ? "Generating..."
          : activeTab === "resume"
          ? "✨ Tailor Resume"
          : "📝 Generate Cover Letter"}
      </button>

      {/* Output Section */}
      {result && (
        <div className="mt-10 bg-[#1e293b] border border-[#334155] rounded-lg p-6 w-full max-w-5xl shadow-lg">
          <h2 className="text-2xl font-semibold text-[#3b82f6] mb-4">
            {activeTab === "resume"
              ? `Tailored Resume for ${companyName}`
              : `Cover Letter for ${companyName}`}
          </h2>

          <pre className="whitespace-pre-wrap text-gray-100 text-sm font-sans leading-relaxed">
            {typeof result === "string"
              ? result
              : JSON.stringify(result, null, 2)}
          </pre>

          <button
            onClick={handleDownloadPDF}
            className="mt-4 px-5 py-2 bg-[#22c55e] text-white rounded hover:bg-[#16a34a]"
          >
            ⬇️ Download {activeTab === "resume" ? "Resume" : "Cover Letter"} PDF
          </button>
        </div>
      )}
    </main>
  );
}
