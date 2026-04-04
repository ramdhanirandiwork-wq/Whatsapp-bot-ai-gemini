// ==========================================
// 🤖 GEMINI AI LEVEL DEWA (FINAL VERSION)
// ==========================================

import axios from "axios";

// 🔥 API KEY KAMU
const API_KEY = "AIzaSyB1KU5A8gX9F-87BsYOmMfxPfU7Bshlhcg";

// 🔥 SYSTEM PROMPT (BIAR PINTAR & TERARAH)
const SYSTEM_PROMPT = `
Kamu adalah AI super cerdas, cepat, dan akurat.
- Jawaban harus jelas, padat, dan bernilai.
- Jangan bertele-tele.
- Gunakan bahasa yang mudah dipahami.
- Jika ditanya teknis → jawab detail.
- Jika ditanya umum → jawab ringkas tapi informatif.
- Jika diminta langkah → beri step by step.
- Jika tidak tahu → bilang jujur, jangan ngarang.
`;

export async function askGemini(prompt: string): Promise<string> {
  try {
    const res = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${API_KEY}`,
      {
        contents: [
          {
            parts: [
              {
                text: `${SYSTEM_PROMPT}\n\nUser: ${prompt}`
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.7, // kreatif tapi masih akurat
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1000
        }
      }
    );

    const text =
      res.data?.candidates?.[0]?.content?.parts?.[0]?.text;

    return text || "❌ Tidak ada respon dari AI";
  } catch (err: any) {
    console.log("🔥 GEMINI ERROR:", err?.response?.data || err.message);
    return "❌ AI Error (cek log server)";
  }
}

// ==========================================
// 🎯 DETEKSI GAMBAR (ONLY IF REQUESTED)
// ==========================================

export function isImageRequest(text: string): boolean {
  const trigger = text.toLowerCase();

  return (
    trigger.includes("gambarkan") ||
    trigger.includes("buat gambar") ||
    trigger.includes("generate image") ||
    trigger.includes("buatkan gambar")
  );
}
