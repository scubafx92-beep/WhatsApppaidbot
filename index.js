const { Telegraf } = require('telegraf');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const fs = require('fs');

// 🔑 CONFIGURATION
const BOT_TOKEN = '8722740855:AAHMyWM_iHLSTD5i-D6x8GJZhhbQWazrWMI';
const ADMIN_CHAT_ID = '8457670186'; 
const SELLER_USERNAME = '@vanshfx1';  

const tgBot = new Telegraf(BOT_TOKEN);
let sock = null;
let isConnected = false;

// 📁 DATABASE
const DB_FILE = 'paid_users.json';
let paidUsers = {};

if (fs.existsSync(DB_FILE)) {
    paidUsers = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
}

function saveDatabase() {
    fs.writeFileSync(DB_FILE, JSON.stringify(paidUsers, null, 2));
}

function checkAccess(ctx) {
    const userId = ctx.chat.id.toString();
    if (userId === ADMIN_CHAT_ID) return true;

    if (paidUsers[userId]) {
        const expiryTime = paidUsers[userId].expiry;
        if (Date.now() < expiryTime) {
            return true; 
        } else {
            delete paidUsers[userId]; 
            saveDatabase();
        }
    }
    return false; 
}

// 🤖 WHATSAPP CORE ENGINE
async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_nexus');
    sock = makeWASocket({
        auth: state,
        printQRInTerminal: false
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.log('[*] WhatsApp QR Code generated.');
            try {
                await tgBot.telegram.sendMessage(ADMIN_CHAT_ID, `⚠️ <b>WhatsApp Not Linked!</b>\n\nApne isi phone se link karne ke liye reply me type karein:\n<code>/link 91XXXXXXXXXX</code>`, { parse_mode: 'HTML' });
            } catch (err) {
                console.log('TG Send Error: ', err.message);
            }
        }

        if (connection === 'open') {
            isConnected = true;
            console.log('[+] WhatsApp Connected Successfully.');
            await tgBot.telegram.sendMessage(ADMIN_CHAT_ID, '✅ <b>WhatsApp core successfully connected!</b>\n\nAb aap ya aapke paid users messages bhej sakte hain.', { parse_mode: 'HTML' });
        }

        if (connection === 'close') {
            isConnected = false;
            if ((lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut) {
                connectToWhatsApp();
            }
        }
    });

    sock.ev.on('creds.update', saveCreds);
}

// 📡 TELEGRAM COMMANDS
tgBot.command('start', (ctx) => {
    const userId = ctx.chat.id.toString();
    
    if (userId === ADMIN_CHAT_ID) {
        return ctx.reply(`👋 Welcome Back Boss!\n\nUser ko 1 mahine ke liye approve karne ke liye ye type karein:\n<code>/approve [User_ID]</code>\n\nWhatsApp link karne ke liye type karein:\n<code>/link 91XXXXXXXXXX</code>`, { parse_mode: 'HTML' });
    }

    if (checkAccess(ctx)) {
        return ctx.reply('✅ <b>Aapka VIP access active hai!</b>\n\nBulk message bhejne ke liye niche diye gaye format ka use karein:\n<code>/send message text | number1,number2</code>', { parse_mode: 'HTML' });
    } else {
        return ctx.reply(`❌ <b>Access Denied! Premium Bot Only.</b>\n\nये एक प्रीमियम बल्क व्हाट्सएप मैसेंजर बोट है। इसे 1 महीने के लिए अनलॉक कराने और इसका पूरा फायदा उठाने के लिए मेरे DM में आओ।\n\n👉 <b>Meri ID hai:</b> ${SELLER_USERNAME}\n\n⚠️ <i>Note: Pay karne ke baad mujhe apni ye ID send karein: <code>${userId}</code></i>`, { parse_mode: 'HTML' });
    }
});

tgBot.command('approve', (ctx) => {
    if (ctx.chat.id.toString() !== ADMIN_CHAT_ID) return;

    let targetUser = ctx.message.text.replace('/approve', '').trim();
    if (!targetUser) {
        return ctx.reply('❌ Kripya user ki ID dalo! Example: /approve 123456789');
    }

    const oneMonthTime = 30 * 24 * 60 * 60 * 1000;
    const expiryDate = Date.now() + oneMonthTime;

    paidUsers[targetUser] = {
        expiry: expiryDate,
        approvedAt: Date.now()
    };
    saveDatabase();

    ctx.reply(`✅ <b>User ${targetUser} successfully unlock ho gaya hai!</b>\n\nIska access abhi se lekar agle 30 din tak valid rahega. 👍`, { parse_mode: 'HTML' });
    tgBot.telegram.sendMessage(targetUser, '🎉 <b>Good News!</b>\n\nOwner ne aapka access <b>1 mahine (30 Days)</b> ke liye unlock kar diya hai. Ab aap daba ke bina ban hue messages bhej sakte hain!\n\n<b>Format:</b>\n<code>/send message | number1,number2</code>', { parse_mode: 'HTML' }).catch(() => {});
});

tgBot.command('link', async (ctx) => {
    if (ctx.chat.id.toString() !== ADMIN_CHAT_ID) return;
    
    let text = ctx.message.text.replace('/link', '').trim();
    if (!text) return ctx.reply('❌ Kripya number dalo! Example: /link 917217604544');

    ctx.reply('⏳ Requesting 8-digit code from WhatsApp server...');
    try {
        let code = await sock.requestPairingCode(text);
        ctx.reply(`✅ <b>WhatsApp Pairing Code:</b>\n\n👉 <code>${code}</code>\n\nIs code ko apne WhatsApp me daal do!`, { parse_mode: 'HTML' });
    } catch (err) {
        ctx.reply('❌ Error: ' + err.message);
    }
});

tgBot.command('send', async (ctx) => {
    if (!checkAccess(ctx)) {
        return ctx.reply(`❌ <b>Premium Feature Only!</b>\n\nIs bot ko buy karne ke liye dm me aao: ${SELLER_USERNAME}`);
    }

    if (!isConnected) {
        return ctx.reply('❌ WhatsApp Core abhi offline hai. Kripya Admin ko contact karein ki wo bot ko re-link karein!');
    }

    let input = ctx.message.text.replace('/send', '').trim();
    if (!input.includes('|')) {
        return ctx.reply('❌ Wrong format! Sahi format: /send message | number1,number2');
    }

    let parts = input.split('|');
    let messageText = parts[0].trim();
    let numbersList = parts[1].split(',');

    ctx.reply(`🚀 <b>WhatsApp Campaign Started!</b>\n\nTotal ${numbersList.length} numbers par safe interval ke sath message bheja ja raha hai...`, { parse_mode: 'HTML' });

    for (let i = 0; i < numbersList.length; i++) {
        let num = numbersList[i].trim();
        if (!num) continue;

        let jid = num + "@s.whatsapp.net";
        try {
            await sock.sendMessage(jid, { text: messageText });
            await ctx.reply(`[+] Delivered to ${num} - DONE ✅`);
            
            if (i < numbersList.length - 1) {
                let delay = Math.floor(Math.random() * (15000 - 10000 + 1)) + 10000;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        } catch (e) {
            await ctx.reply(`[!] ${num} par fail hua ❌`);
        }
    }

    ctx.reply('🏁 <b>Campaign Finished! Sabhi messages successfully chale gaye hain.</b>', { parse_mode: 'HTML' });
});

tgBot.launch();
console.log('[+] TELEGRAM PREMIUM CONTROL BOT CORE ACTIVE');
connectToWhatsApp() ;
