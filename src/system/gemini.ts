import axios from "axios";

const API_KEY = "AIzaSyB1KU5A8gX9F-87BsYOmMfxPfU7Bshlhcg";

export async function askGemini(prompt: string) {
  try {
    const res = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${API_KEY}`,
      {
        contents: [{ parts: [{ text: prompt }] }]
      }
    );

    const text =
      res.data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    return text;
  } catch {
    return "❌ AI Error";
  }
}

// 🔥 DETEKSI PERINTAH GAMBAR
export function isImageRequest(text: string): boolean {
  const trigger = [
    "gambar",
    "foto",
    "image",
    "buat gambar",
    "generate image"
  ];

  return trigger.some(t => text.toLowerCase().includes(t));
}
