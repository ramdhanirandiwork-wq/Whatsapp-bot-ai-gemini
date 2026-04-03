import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState
} from "@whiskeysockets/baileys";

import pino from "pino";
import { GoogleGenerativeAI } from "@google/generative-ai";
import "dotenv/config";

const genAI = new GoogleGenerativeAI(process.env.API_KEY!);

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth");

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: "silent" }),
  });

  // ✅ PAIRING CODE (CUMA SEKALI)
  if (!state.creds.registered) {
    console.log("🔥 Ambil pairing code...");

    const code = await sock.requestPairingCode(process.env.WA_NUMBER!);
    console.log("✅ PAIRING CODE:", code);

    console.log("⚠️ Masukkan code ke WhatsApp SEKARANG!");
  }

  // simpan session
  sock.ev.on("creds.update", saveCreds);

  // terima pesan
  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message) return;

    const sender = msg.key.remoteJid!;
    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text;

    if (!text) return;

    console.log("📩 Message:", text);

    try {
      const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
      });

      const result = await model.generateContent(text);
      const response = await result.response;
      const reply = response.text();

      await sock.sendMessage(sender, { text: reply });
    } catch (err) {
      console.log("❌ Error AI:", err);
      await sock.sendMessage(sender, {
        text: "Maaf, AI lagi error 😅",
      });
    }
  });

  // koneksi handler
  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "close") {
      const statusCode =
        (lastDisconnect?.error as any)?.output?.statusCode;

      console.log("❌ Koneksi terputus:", statusCode);

      // ❗ JANGAN reconnect saat belum pairing
      if (!state.creds.registered) {
        console.log("⛔ Stop reconnect (lagi pairing)");
        return;
      }

      // ✅ reconnect kalau sudah login
      if (statusCode !== DisconnectReason.loggedOut) {
        console.log("🔄 Reconnecting...");
        startBot();
      } else {
        console.log("🚫 Logout, scan ulang");
      }
    }

    if (connection === "open") {
      console.log("✅ Bot connected!");
    }
  });
}

startBot();
