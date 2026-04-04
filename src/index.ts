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
import QRCode from "qrcode";

// SYSTEM
import { generateReport } from "./system/inventory";
import { askGemini, isImageRequest } from "./system/gemini";
import { getImageUrl } from "./system/image";

const app = express();
const PORT = process.env.PORT || 3000;

let currentQR: string | null = null;
let sock: any = null;
let isStarting = false;

// ================= WEB =================
app.get("/", (req, res) => {
  res.send("🤖 BOT ONLINE 24 JAM");
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
  if (isStarting) return;
  isStarting = true;

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

    // ================= QR =================
    if (qr) {
      currentQR = qr;
      console.log("📱 QR siap di /qr");
    }

    // ================= CONNECTED =================
    if (connection === "open") {
      console.log("✅ BOT TERHUBUNG!");
      currentQR = null;
      isStarting = false;

      const number = sock.user?.id?.split(":")[0];
      console.log("📱 Nomor:", number);

      // NOTIF WA
      await sock.sendMessage("6283109862325@s.whatsapp.net", {
        text: `🟢 BOT AKTIF\nNomor: ${number}`
      });
    }

    // ================= DISCONNECT =================
    if (connection === "close") {
      isStarting = false;

      const code = (lastDisconnect?.error as Boom)?.output?.statusCode;

      console.log(`❌ Disconnect (${code})`);

      if (code !== DisconnectReason.loggedOut) {
        console.log("🔄 Reconnect 15 detik...");
        setTimeout(startBot, 15000);
      } else {
        console.log("⚠️ Logout! Hapus session & scan ulang");
      }
    }
  });

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

      if (!text) return;

      console.log("📩", text);

      // ================= AI29 =================
      if (text.startsWith("AI29")) {
        const q = text.replace("AI29", "").trim();

        if (!q) {
          await sock.sendMessage(from, {
            text: "❌ Pertanyaan kosong"
          });
          return;
        }

        // GAMBAR hanya jika diminta
        if (isImageRequest(q)) {
          const url = getImageUrl(q);

          await sock.sendMessage(from, {
            image: { url },
            caption: `🖼️ ${q}`
          });
          return;
        }

        // AI TEXT
        const ai = await askGemini(q);

        await sock.sendMessage(from, { text: ai });
        return;
      }

      // ================= INVENTORY =================
      const result = generateReport(text);

      await sock.sendMessage(from, {
        text: result
      });

    } catch (err) {
      console.log("❌ ERROR MESSAGE:", err);
    }
  });
}

startBot();
