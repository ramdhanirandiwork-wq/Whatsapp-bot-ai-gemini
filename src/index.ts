// --- KONFIGURASI NOMOR TUJUAN (OWNER) ---
// Format harus menggunakan @s.whatsapp.net
const OWNER_NUMBER = "6283109862325@s.whatsapp.net"; 

// --- MODIFIKASI HANDLER KONEKSI ---
sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "close") {
        const error = (lastDisconnect?.error as any);
        const statusCode = error?.output?.statusCode || error?.statusCode;
        
        console.log(`❌ Terputus (Status: ${statusCode})`);

        if (statusCode !== DisconnectReason.loggedOut) {
            console.log("🔄 Mencoba menyambung ulang...");
            setTimeout(() => startBot(), 5000);
        }
    } else if (connection === "open") {
        console.log("✅ BOT BERHASIL TERHUBUNG!");

        // --- NOTIFIKASI OTOMATIS KE 083109862325 SAAT ON ---
        try {
            await sock.sendMessage(OWNER_NUMBER, { 
                text: `🚀 *LAPORAN SISTEM*\n\nBot Terminal Lama sudah *AKTIF*.\nSiap menerima laporan stok.\n\n_Waktu: ${new Date().toLocaleString('id-ID')}_` 
            });
        } catch (err) {
            console.error("Gagal kirim notif login:", err);
        }
    }
});

// --- MODIFIKASI HANDLER PESAN (UNTUK LAPOR ERROR) ---
sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const jid = msg.key.remoteJid!;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
    if (!text) return;

    try {
        if (text.toLowerCase() === "p" || text.toLowerCase() === "cek stok") {
            await sock.sendMessage(jid, { text: "STOCK LAPORAN KAYAME FOOD\nSilakan input Laporan Hari ini:" });
            return;
        }

        const result = await model.generateContent(text);
        await sock.sendMessage(jid, { text: result.response.text() }, { quoted: msg });

    } catch (error) {
        console.error("❌ Gemini Error:", error);
        
        // --- KIRIM DETAIL ERROR KE 083109862325 ---
        await sock.sendMessage(OWNER_NUMBER, { 
            text: `⚠️ *ALERTI ERROR*\n\nBot gagal memproses pesan dari: ${jid}\n\n*Pesan User:* ${text}\n*Detail Error:* ${error.message}` 
        });
        
        await sock.sendMessage(jid, { text: "Maaf, sistem sedang pemeliharaan. Laporan error telah dikirim ke pengembang." });
    }
});
