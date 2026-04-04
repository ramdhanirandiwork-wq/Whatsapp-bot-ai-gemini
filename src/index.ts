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
import QRCode from "qrcode";

// ================= SERVER =================
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.status(200).send("🤖 Bot Terminal Lama Aktif!");
});

// 🔥 ENDPOINT QR WEB
let currentQR: string | null = null;

app.get("/qr", async (req, res) => {
  try {
    if (!currentQR) {
      return res.send("QR belum tersedia atau sudah terhubung.");
    }

    const qrImage = await QRCode.toDataURL(currentQR);

    res.send(`
      <html>
        <head>
          <title>Scan QR WhatsApp</title>
          <meta http-equiv="refresh" content="5">
        </head>
        <body style="text-align:center;font-family:sans-serif">
          <h2>📱 Scan QR WhatsApp</h2>
          <img src="${qrImage}" />
          <p>Auto refresh setiap 5 detik</p>
        </body>
      </html>
    `);
  } catch {
    res.send("❌ Gagal generate QR");
  }
});

app.listen(PORT, () => {
  console.log(`🌐 Server running on port ${PORT}`);
});

// ================= BOT CORE =================
let sock: any = null;

// 🔥 AUTO DELETE SESSION (SOLUSI #1)
if (fs.existsSync("./session")) {
  fs.rmSync("./session", { recursive: true, force: true });
  console.log("🧹 Session lama dihapus");
}

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
    syncFullHistory: false,
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
      console.log("✅ BOT TERHUBUNG!");

      const user = sock.user;
      if (user) {
        console.log(`📱 Connected: ${user.id.split(":")[0]}`);
      } else {
        console.log("⚠️ Belum terkoneksi ke device manapun");
      }

      // kirim notif ke kamu
      await sock.sendMessage("628310982325@s.whatsapp.net", {
        text: "✅ Bot ON & LIVE 🚀"
      });

      currentQR = null; // QR hilang setelah connect
    }

    if (connection === "close") {
      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      console.log(`❌ Disconnect (${statusCode})`);

      if (shouldReconnect) {
        console.log("🔄 Reconnect 10 detik...");
        setTimeout(startBot, 10000);
      } else {
        console.log("⚠️ Logout. Scan ulang QR di /qr");
      }
    }
  });

  // ================= SYSTEM PROMPT ENGINE =================

  const TARGET: any = {
    "Chili Oil": 0.5,
    "Parsley": 1,
    "Saus Kompan": 1
  };

  function getTomorrowDate() {
    const hari = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
    const now = new Date();
    now.setDate(now.getDate() + 1);

    return `📅 ${hari[now.getDay()]}, ${now.toLocaleDateString("id-ID")}`;
  }

  function generateReport(inputText: string) {
    if (!inputText) {
      return "STOCK LAPORAN KAYAME FOOD\nSilakan input Laporan Hari ini:";
    }

    const lower = inputText.toLowerCase();

    let chili = lower.includes("chili") ? 0.2 : 0;
    let parsley = lower.includes("parsley") ? 0 : 0;
    let kompan = lower.includes("kompan") ? 0.3 : 0;

    let checklist: string[] = [];

    checklist.push("1. [ ] Dimsum: 600 Pcs");
    checklist.push("2. [ ] Saus Botol 🧴: 4 Botol");
    checklist.push("3. [ ] Bolognes 🍅: 2 Kantong");
    checklist.push("4. [ ] Tar-tar 🥣: 1 Kantong");

    let kompanNeed = (kompan < 0.5) ? "1 Kompan" : "";
    checklist.push(`5. [ ] Saus Kompan 🛢️: ${kompanNeed}`);
    checklist.push("");

    let index = 6;

    if (chili < TARGET["Chili Oil"]) {
      checklist.push(`${index++}. [ ] Chili Oil: ${TARGET["Chili Oil"] - chili} Pack`);
    }

    if (parsley < TARGET["Parsley"]) {
      checklist.push(`${index++}. [ ] Parsley: ${TARGET["Parsley"] - parsley} Pack`);
    }

    return `
\`\`\`
${getTomorrowDate()}
*DAFTAR CHECKLIST YANG HARUS DI BAWA TERMINAL LAMA*
______________________________
${checklist.join("\n")}

*INFO STOK DI LAPAK TERMINAL LAMA*
__________________________________________
• Saus Kompan 🛢️: ${kompan}
• Chili Oil: ${chili}
• Parsley: ${parsley}
\`\`\`
`;
  }

  // ================= MESSAGE HANDLER =================
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

  return sock;
}

startBot();
