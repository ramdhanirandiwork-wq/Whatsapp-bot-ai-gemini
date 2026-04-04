import axios from "axios";

// 🔑 SUPPORT 2 ENV (ANTI ERROR)
const API_KEY =
  process.env.GEMINI_API_KEY ||
  process.env.API_KEY ||
  "";

// 🔥 CORE GEMINI AI
export async function askGemini(prompt: string): Promise<string> {
  try {
    // ❌ kalau API kosong
    if (!API_KEY) {
      return "❌ API KEY BELUM DI SET";
    }

    // 🔥 request ke Gemini (FIX endpoint terbaru)
    const res = await axios.post(
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${API_KEY}`,
      {
        contents: [
          {
            parts: [
              {
                text: `
Kamu adalah AI super cerdas, cepat, dan membantu.
Jawab dengan:
- jelas
- ringkas
- akurat
- tidak bertele-tele

Pertanyaan:
${prompt}
                `
              }
            ]
          }
        ]
      },
      {
        timeout: 20000 // ⏱️ anti hang
      }
    );

    const result =
      res.data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!result) {
      return "❌ AI tidak memberikan jawaban";
    }

    return result.trim();

  } catch (err: any) {
    console.log("🔥 GEMINI ERROR:", err.response?.data || err.message);

    // 🔥 fallback biar ga diam
    return "❌ AI sedang error, coba lagi nanti";
  }
}

// 🎯 DETEKSI PERINTAH GAMBAR
export function isImageRequest(text: string): boolean {
  const t = text.toLowerCase();

  return (
    t.includes("gambarkan") ||
    t.includes("buat gambar") ||
    t.includes("gambar kan")
  );
}
