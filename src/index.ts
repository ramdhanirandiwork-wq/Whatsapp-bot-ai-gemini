import "dotenv/config";
import express from "express";
import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  makeCacheableSignalKeyStore
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";
const QRCode = require("qrcode");

// SYSTEM
import { generateReport } from "./system/inventory";
import { askGemini, isImageRequest } from "./system/gemini";
import { getImageUrl } from "./system/image";

const app = express();
const PORT = process.env.PORT || 3000;

let currentQR: string | null = null;
let sock: any = null;
let isConnected = false;

// ================= WEB =================
app.get("/", (req, res) => {
  res.send("🤖 BOT ONLINE");
});

app.get("/qr", async (req, res) => {
  if (!currentQR) return res.send("✅ Sudah connect");

  const qr = await QRCode.toDataURL(currentQR);
  res.send(`<img src="${qr}" />`);
});

app.listen(PORT, () => {
  console.log(`🌐 Server running on port ${PORT}`);
});

// ================= BOT =================
async function startBot() {
  console.log("🚀 Memulai bot...");

  const logger = pino({ level: "silent" });
  const { state, saveCreds } = await useMultiFileAuthState("session");
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    keepAliveIntervalMs: 30000,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    printQRInTerminal: false,
    logger
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      currentQR = qr;
      console.log("📱 QR siap di /qr");
    }

    if (connection === "open") {
      isConnected = true;
      currentQR = null;

      console.log("✅ BOT TERHUBUNG!");

      await sock.sendMessage("6283109862325@s.whatsapp.net", {
        text: "🟢 Server Aktif & Bot Siap Digunakan"
      });
    }

    if (connection === "close") {
      isConnected = false;

      const code = (lastDisconnect?.error as Boom)?.output?.statusCode;

      console.log("❌ Disconnect:", code);

      if (code !== DisconnectReason.loggedOut) {
        console.log("🔄 Reconnect 10 detik...");
        setTimeout(startBot, 10000);
      } else {
        console.log("⚠️ Logout! Scan ulang QR");
      }
    }
  });

  // ================= KEEP ALIVE =================
  setInterval(() => {
    if (sock && isConnected) {
      console.log("💓 KEEP ALIVE");
    }
  }, 30000);

  // ================= MESSAGE =================
  sock.ev.on("messages.upsert", async (m: any) => {
    try {
      const msg = m.messages[0];
      if (!msg.message) return;
      if (msg.key.fromMe) return;

      const from = msg.key.remoteJid;

      const text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        "";

      console.log("📩", text);

      // ================= AI29 =================
      if (text.startsWith("AI29")) {
        const q = text.replace("AI29", "").trim();

        if (!q) {
          await sock.sendMessage(from, {
            text: "❌ Masukkan pertanyaan setelah AI29"
          });
          return;
        }

        // 🔥 GAMBAR hanya jika diminta
        if (isImageRequest(q)) {
          const url = getImageUrl(q);

          await sock.sendMessage(from, {
            image: { url },
            caption: `🖼️ ${q}`
          });
          return;
        }

        const ai = await askGemini(q);

        await sock.sendMessage(from, { text: ai });
        return;
      }

      // ================= INVENTORY =================
      const result = generateReport(text);
      await sock.sendMessage(from, { text: result });

    } catch (err) {
      console.log("❌ ERROR MESSAGE:", err);
    }
  });
}

startBot();
