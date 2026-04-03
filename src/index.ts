import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState
} from "@whiskeysockets/baileys";

import pino from "pino";
import { GoogleGenerativeAI } from "@google/generative-ai";
import "dotenv/config";

const genAI = new GoogleGenerativeAI(process.env.API_KEY!);

let isPairing = false; // 🔥 kunci biar tidak dobel

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth");

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: "silent" }),
  });

  // ✅ Pairing hanya SEKALI
  if (!state.creds.registered && !isPairing) {
    isPairing = true;

    console.log("🔥 Ambil pairing code...");

    const code = await sock.requestPairingCode(process.env.WA_NUMBER!);
    console.log("✅ PAIRING CODE:", code);

    console.log("⚠️ Masukkan code SEKARANG (jangan nunggu)");
  }

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message) return;

    const sender = msg.key.remoteJid!;
    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text;

    if (!text) return;

    try {
      const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
      });

      const result = await model.generateContent(text);
      const reply = result.response.text();

      await sock.sendMessage(sender, { text: reply });
    } catch {
      await sock.sendMessage(sender, {
        text: "AI error, coba lagi nanti",
      });
    }
  });

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "close") {
      const code =
        (lastDisconnect?.error as any)?.output?.statusCode;

      console.log("❌ Disconnect:", code);

      // ❗ STOP TOTAL saat pairing
      if (!state.creds.registered) {
        console.log("⛔ STOP (lagi pairing, jangan reconnect)");
        return;
      }

      if (code !== DisconnectReason.loggedOut) {
        console.log("🔄 Reconnect...");
        startBot();
      }
    }

    if (connection === "open") {
      console.log("✅ Bot connected!");
    }
  });
}

startBot();
