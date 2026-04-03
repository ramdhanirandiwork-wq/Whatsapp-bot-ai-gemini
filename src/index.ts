import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState
} from "@whiskeysockets/baileys";

import pino from "pino";
import { GoogleGenerativeAI } from "@google/generative-ai";
import "dotenv/config";

// 🔑 Gemini AI (FREE)
const genAI = new GoogleGenerativeAI(process.env.API_KEY!);

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth");

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: "silent" }),
  });

  // ✅ Pairing Code (sekali saja)
  if (!state.creds.registered) {
    console.log("Ambil pairing code...");

    const code = await sock.requestPairingCode(process.env.WA_NUMBER!);
    console.log("PAIRING CODE:", code);
  }

  // simpan session
  sock.ev.on("creds.update", saveCreds);

  // auto reply
  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message) return;

    const sender = msg.key.remoteJid!;
    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text;

    if (!text) return;

    console.log("Message:", text);

    try {
      // 🔥 AI FREE (hemat)
      const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
      });

      const result = await model.generateContent({
        contents: [{
          role: "user",
          parts: [{ text }]
        }]
      });

      const reply = result.response.text();

      await sock.sendMessage(sender, { text: reply });

    } catch (err) {
      console.log("AI Error:", err);

      await sock.sendMessage(sender, {
        text: "Maaf, AI sedang sibuk. Coba lagi nanti."
      });
    }
  });

  // koneksi
  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "close") {
      const shouldReconnect =
        (lastDisconnect?.error as any)?.output?.statusCode !==
        DisconnectReason.loggedOut;

      console.log("Reconnect...");

      if (shouldReconnect) startBot();
    }

    if (connection === "open") {
      console.log("Bot connected ✅");
    }
  });
}

startBot();
