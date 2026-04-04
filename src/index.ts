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

// 🔥 FIX QR (ANTI ERROR TYPESCRIPT)
const QRCode = require("qrcode");

const app = express();
const PORT = process.env.PORT || 3000;

// ================= SERVER =================
app.get("/", (req, res) => {
  res.send("🤖 Bot Terminal Lama Aktif!");
});

// ================= QR WEB =================
let currentQR: string | null = null;

app.get("/qr", async (req, res) => {
  try {
    if (!currentQR) {
      return res.send("QR belum tersedia / sudah connect");
    }

    const qrImage = await QRCode.toDataURL(currentQR);

    res.send(`
      <html>
        <head>
          <title>QR WhatsApp</title>
          <meta http-equiv="refresh" content="5">
        </head>
        <body style="text-align:center">
          <h2>Scan QR WhatsApp</h2>
          <img src="${qrImage}" />
          <p>Auto refresh 5 detik</p>
        </body>
      </html>
    `);
  } catch {
    res.send("Gagal generate QR");
  }
});

app.listen(PORT, () => {
  console.log(`🌐 Server running on port ${PORT}`);
});

// ================= AUTO DELETE SESSION =================
if (fs.existsSync("./session")) {
  fs.rmSync("./session", { recursive: true, force: true });
  console.log("🧹 Session lama dihapus");
}

// ================= BOT =================
let sock: any = null;

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
    browser: ["Terminal Lama", "Chrome", "1.0.0"],
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

    if (connection === "open") {
      console.log("✅ BOT TERHUBUNG!");

      const user = sock.user;
      if (user) {
        console.log(`📱 Connected: ${user.id.split(":")[0]}`);
      } else {
        console.log("⚠️ Belum ada device");
      }

      await sock.sendMessage("628310982325@s.whatsapp.net", {
        text: "✅ Bot ON & LIVE 🚀"
      });

      currentQR = null;
    }

    if (connection === "close") {
      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      console.log(`❌ Disconnect (${statusCode})`);

      if (shouldReconnect) {
        setTimeout(startBot, 10000);
      }
    }
  });

  // ================= SYSTEM =================
  function getTomorrowDate() {
    const hari = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return `📅 ${hari[d.getDay()]}, ${d.toLocaleDateString("id-ID")}`;
  }

  function generateReport(text: string) {
    if (!text) {
      return "STOCK LAPORAN KAYAME FOOD\nSilakan input Laporan Hari ini:";
    }

    return `
\`\`\`
${getTomorrowDate()}
*DAFTAR CHECKLIST YANG HARUS DI BAWA TERMINAL LAMA*
______________________________
1. [ ] Dimsum: 600 Pcs
2. [ ] Saus Botol 🧴: 4 Botol
3. [ ] Bolognes 🍅: 2 Kantong
4. [ ] Tar-tar 🥣: 1 Kantong
5. [ ] Saus Kompan 🛢️: 1 Kompan

6. [ ] Chili Oil: 0.5 Pack
7. [ ] Parsley: 1 Pack

*INFO STOK DI LAPAK TERMINAL LAMA*
__________________________________________
• Input: ${text}
\`\`\`
`;
  }

  // ================= MESSAGE =================
  sock.ev.on("messages.upsert", async (m: any) => {
    const msg = m.messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const from = msg.key.remoteJid;
    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text;

    const response = generateReport(text);

    await sock.sendMessage(from, { text: response });
  });
}

startBot();
