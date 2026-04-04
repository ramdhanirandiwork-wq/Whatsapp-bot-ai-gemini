import axios from "axios";

const API_KEY = process.env.GEMINI_API_KEY!;

export async function askGemini(prompt: string): Promise<string> {
  try {
    const res = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`,
      {
        contents: [
          {
            parts: [
              {
                text: `Jawab dengan cerdas, cepat, dan jelas:\n${prompt}`
              }
            ]
          }
        ]
      }
    );

    return res.data.candidates?.[0]?.content?.parts?.[0]?.text || "❌ Tidak ada respon";
  } catch (err: any) {
    console.log("🔥 GEMINI ERROR:", err.response?.data || err.message);
    return "❌ AI Error";
  }
}

// 🔥 TRIGGER GAMBAR
export function isImageRequest(text: string): boolean {
  return text.toLowerCase().includes("gambarkan");
}
