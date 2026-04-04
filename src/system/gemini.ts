// ==========================================
// 🤖 GEMINI AI LEVEL DEWA
// ==========================================

import axios from "axios";

const API_KEY = "ISI_API_KEY_KAMU"; // 🔥 WAJIB

export async function askGemini(prompt: string): Promise<string> {
  try {
    const res = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${API_KEY}`,
      {
        contents: [
          {
            parts: [
              {
                text: `Jawab dengan jelas, singkat, dan cerdas:\n${prompt}`
              }
            ]
          }
        ]
      }
    );

    return res.data.candidates?.[0]?.content?.parts?.[0]?.text || "❌ Tidak ada respon";
  } catch {
    return "❌ AI Error";
  }
}

// 🔥 HANYA TRIGGER GAMBAR
export function isImageRequest(text: string): boolean {
  return text.toLowerCase().includes("gambarkan");
}
