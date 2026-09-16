const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3.8-flash";

export type GeneratedQuestion = {
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
};

async function callGateway(system: string, user: string): Promise<string> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("LOVABLE_API_KEY tidak tersedia");

  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    if (res.status === 402) throw new Error("Kredit AI habis. Tambahkan kredit untuk memakai AI.");
    if (res.status === 429) throw new Error("AI sedang sibuk, coba lagi sebentar lagi.");
    throw new Error(`AI gagal (${res.status}): ${text.slice(0, 300)}`);
  }

  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return json.choices?.[0]?.message?.content ?? "";
}

function parseJson(raw: string): unknown {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "");
  return JSON.parse(cleaned);
}

export async function generateQuestionsFromMaterial(input: {
  material: string;
  count: number;
  difficulty: string;
  subject: string;
}): Promise<GeneratedQuestion[]> {
  const system =
    "Kamu guru profesional Indonesia yang membuat soal pilihan ganda dari materi pelajaran. " +
    "Jawab HANYA dengan JSON valid berbentuk " +
    '{"questions":[{"prompt":"...","options":["a","b","c","d"],"correctIndex":0,"explanation":"..."}]}. ' +
    "Setiap soal harus punya tepat 4 pilihan, satu jawaban benar, dan pembahasan singkat. Gunakan bahasa Indonesia.";

  const user = [
    `Mata pelajaran: ${input.subject || "umum"}`,
    `Jumlah soal: ${input.count}`,
    `Tingkat kesulitan: ${input.difficulty}`,
    "Materi:",
    input.material,
  ].join("\n");

  const parsed = parseJson(await callGateway(system, user)) as {
    questions?: GeneratedQuestion[];
  };

  return (parsed.questions ?? [])
    .filter((q) => q && typeof q.prompt === "string" && Array.isArray(q.options))
    .slice(0, input.count)
    .map((q) => ({
      prompt: String(q.prompt),
      options: q.options.slice(0, 6).map((o) => String(o)),
      correctIndex: Math.min(Math.max(Number(q.correctIndex) || 0, 0), q.options.length - 1),
      explanation: String(q.explanation ?? ""),
    }));
}

export async function improveQuestion(input: {
  prompt: string;
  options: string[];
  instruction: string;
}): Promise<GeneratedQuestion> {
  const system =
    "Kamu guru Indonesia yang memperbaiki soal pilihan ganda agar jelas, bebas ambigu, dan pengecohnya masuk akal. " +
    'Jawab HANYA JSON valid: {"prompt":"...","options":["a","b","c","d"],"correctIndex":0,"explanation":"..."}. ' +
    "Gunakan bahasa Indonesia.";

  const user = [
    `Soal saat ini: ${input.prompt}`,
    `Pilihan: ${JSON.stringify(input.options)}`,
    `Permintaan perbaikan: ${input.instruction || "perbaiki secara umum"}`,
  ].join("\n");

  const q = parseJson(await callGateway(system, user)) as GeneratedQuestion;
  const options = (Array.isArray(q.options) ? q.options : input.options).map((o) => String(o));
  return {
    prompt: String(q.prompt ?? input.prompt),
    options,
    correctIndex: Math.min(Math.max(Number(q.correctIndex) || 0, 0), options.length - 1),
    explanation: String(q.explanation ?? ""),
  };
}
