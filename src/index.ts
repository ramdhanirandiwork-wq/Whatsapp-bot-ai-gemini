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

// IMPORT SYSTEM
import { generateReport } from "./system/inventory";

const app = express();
const PORT = process.env.PORT || 3000;

// ================= SERVER =================
app.get("/", (req, res) => {
  res.send("🤖 Bot Aktif");
});

let currentQR: string | null = null;

// ================= QR WEB =================
app.get("/qr", async (req, res) => {
  try {
    if (!currentQR) {
      return res.send("✅ Sudah terhubung / QR tidak tersedia");
    }

    const qrImage = await QRCode.toDataURL(currentQR, {
      width: 400,
      margin: 2
    });

    res.send(`
    <html>
      <head>
        <meta http-equiv="refresh" content="3">
      </head>
      <body style="display:flex;justify-content:center;align-items:center;height:100vh;background:#111;color:white;flex-direction:column">
        <h2>📱 Scan QR WhatsApp</h2>
        <div style="background:white;padding:20px;border-radius:20px">
          <img src="${qrImage}" />
        </div>
      </body>
    </html>
    `);
  } catch {
    res.send("❌ QR Error");
  }
});

app.listen(PORT, () => {
  console.log(`🌐 Server running on port ${PORT}`);
});

// ================= BOT =================
let sock: any = null;
let isConnected = false;

async function startBot() {
  console.log("🚀 Memulai bot...");

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
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      currentQR = qr;
      console.log("📱 QR tersedia di /qr");
    }

    if (connection === "connecting") {
      console.log("⏳ Menghubungkan...");
    }

    if (connection === "open") {
      isConnected = true;
      currentQR = null;

      console.log("✅ BOT TERHUBUNG!");

      const number = sock.user?.id?.split(":")[0] || "unknown";
      console.log(`📱 Connected Number: ${number}`);

      // 🔥 NOTIF WA (BOT AKTIF)
      try {
        await sock.sendMessage("6283109862325@s.whatsapp.net", {
          text: `✅ Bot Aktif & Terhubung\nNomor: ${number}`
        });
      } catch {}

    }

    if (connection === "close") {
      isConnected = false;

      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;

      console.log(`❌ Disconnect (${statusCode})`);

      // 🔥 HANDLE RECONNECT
      if (statusCode !== DisconnectReason.loggedOut) {
        console.log("🔄 Reconnect 15 detik...");
        setTimeout(startBot, 15000);
      } else {
        console.log("⚠️ Logout, scan ulang QR");
      }
    }
  });

  // ================= SERVER NOTIF =================
  setTimeout(async () => {
    if (!isConnected) return;

    try {
      await sock.sendMessage("6283109862325@s.whatsapp.net", {
        text: "🟢 Server Aktif & Bot Running"
      });
    } catch {}
  }, 20000);

  // ================= MESSAGE =================
  sock.ev.on("messages.upsert", async (m: any) => {
    try {
      const msg = m.messages[0];
      if (!msg.message || msg.key.fromMe) return;

      const from = msg.key.remoteJid;

      const text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        "";

      // ================= AI29 =================
      if (text.startsWith("AI29")) {
        const question = text.replace("AI29", "").trim();

        await sock.sendMessage(from, {
          text: `AI RESPONSE:\n${question}`
        });

        return;
      }

      // ================= INVENTORY =================
      const response = generateReport(text);

      await sock.sendMessage(from, { text: response });

    } catch (err) {
      console.log("❌ Error message handler");
    }
  });
}

startBot();
