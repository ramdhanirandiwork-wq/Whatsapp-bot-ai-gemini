import express from "express";
import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  makeCacheableSignalKeyStore
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";
import fs from "fs";
const QRCode = require("qrcode");

// IMPORT SYSTEM
import { generateReport } from "./system/inventory";

const app = express();
const PORT = process.env.PORT || 3000;

// ================= SERVER =================
app.get("/", (req, res) => {
  res.send("🤖 Bot Aktif");
});

// ================= QR =================
let currentQR: string | null = null;

app.get("/qr", async (req, res) => {
  if (!currentQR) return res.send("QR tidak tersedia");

  const qrImage = await QRCode.toDataURL(currentQR, { width: 400 });

  res.send(`
  <html>
    <body style="text-align:center;background:#111;color:white">
      <h2>Scan QR</h2>
      <img src="${qrImage}" />
    </body>
  </html>
  `);
});

app.listen(PORT, () => {
  console.log(`🌐 Server running ${PORT}`);
});

// ================= AUTO DELETE SESSION =================
if (fs.existsSync("./session")) {
  fs.rmSync("./session", { recursive: true, force: true });
}

// ================= BOT =================
let sock: any;

async function startBot() {
  const logger = pino({ level: "silent" });
  const { state, saveCreds } = await useMultiFileAuthState("session");
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    printQRInTerminal: false,
    logger
  });

  sock.ev.on("creds.update", saveCreds);

  // ================= CONNECTION =================
  sock.ev.on("connection.update", async (update) => {
    const { connection, qr } = update;

    if (qr) {
      currentQR = qr;
      console.log("QR ready /qr");
    }

    if (connection === "open") {
      console.log("✅ CONNECTED");

      // 🔥 NOTIF BOT AKTIF
      await sock.sendMessage("6283109862325@s.whatsapp.net", {
        text: "✅ Bot WhatsApp Aktif & Inventory System Ready 🚀"
      });

      currentQR = null;
    }
  });

  // ================= SERVER NOTIF =================
  setTimeout(async () => {
    try {
      await sock.sendMessage("6283109862325@s.whatsapp.net", {
        text: "🟢 Server Aktif"
      });
    } catch {}
  }, 15000);

  // ================= MESSAGE =================
  sock.ev.on("messages.upsert", async (m: any) => {
    const msg = m.messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const from = msg.key.remoteJid;
    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text;

    // ================= AI29 TRIGGER =================
    if (text?.startsWith("AI29")) {
      const question = text.replace("AI29", "").trim();

      // 🔥 TEMPORARY (placeholder Gemini)
      await sock.sendMessage(from, {
        text: `AI RESPONSE:\n${question}`
      });

      return;
    }

    // ================= INVENTORY =================
    const response = generateReport(text);

    await sock.sendMessage(from, { text: response });
  });
}

startBot();
