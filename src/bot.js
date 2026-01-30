
import 'dotenv/config';
import { Telegraf, session } from 'telegraf';
import http from 'http';
import https from 'https';
import { handleMessage, handleServiceMessage } from './users/message.handler.js';
import { handleCommands, handleActions } from './users/command.handler.js';
import { handleOwner } from './owner/owner.handler.js';
import { handleAdmin, handleAdminActions } from './admin/admin.handler.js';
import { db } from './services/supabase.service.js';

// Tokenni tekshirish
const token = process.env.BOT_TOKEN;
if (!token) {
  console.error("❌ XATOLIK: BOT_TOKEN topilmadi! Render Environment Variables bo'limini tekshiring.");
  process.exit(1);
}

const bot = new Telegraf(token, {
  handlerTimeout: 90000 // Tarmoq sekin bo'lganda kutish vaqtini uzaytirish
});

bot.use(session());

bot.use(async (ctx, next) => {
  try {
    if (ctx.chat && (ctx.chat.type === 'group' || ctx.chat.type === 'supergroup')) {
      await db.saveGroup(ctx.chat.id);
    }
  } catch (e) {}
  return next();
});

// Join Request handling
bot.on('chat_join_request', async (ctx) => {
  try {
    const userId = ctx.from.id;
    const chatTitle = ctx.chat.title;
    await db.saveRequest(userId, ctx.chat.id);
    await ctx.telegram.sendMessage(userId, 
      `👋 <b>Assalomu alaykum, ${ctx.from.first_name}!</b>\n\n` +
      `Siz <b>${chatTitle}</b> guruhiga kirish uchun so'rov yubordingiz.\n` +
      `Sizning so'rovingiz qabul qilindi, adminlar ko'rib chiqishmoqda.`, 
      { parse_mode: 'HTML' }
    ).catch((err) => console.log(`[JOIN REQ SEND ERROR] ${userId}: ${err.message}`));
  } catch (e) {
    console.error('[JOIN REQUEST ERROR]', e);
  }
});

handleOwner(bot);
handleAdmin(bot);
handleAdminActions(bot);
handleCommands(bot);
handleActions(bot);

bot.on([
  'new_chat_members', 'left_chat_member', 'new_chat_title', 
  'new_chat_photo', 'delete_chat_photo', 'pinned_message',
  'group_chat_created', 'supergroup_chat_created'
], handleServiceMessage);

bot.on(['text', 'caption'], handleMessage);

// Global xatoliklarni ushlash (ETIMEDOUT va b.q.)
bot.catch((err, ctx) => {
  console.error(`🛑 Telegraf Error (${ctx.updateType}):`, err.message);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('⚠️ Uncaught Exception:', err);
});

// Render uchun Port va Health-check
const PORT = process.env.PORT || 10000; 
const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end('UzModeratorBot is Running!');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server started on port ${PORT}`);
});

// Render Keep-Alive (Ping) - 10 daqiqada bir
const RENDER_URL = process.env.RENDER_EXTERNAL_URL;
if (RENDER_URL) {
  setInterval(() => {
    https.get(RENDER_URL, (res) => {
      console.log(`[PING] Status: ${res.statusCode}`);
    }).on('error', (err) => {
      console.error('[PING ERROR]:', err.message);
    });
  }, 600000); // 10 daqiqa (600,000 ms)
}

const startBot = async () => {
  try {
    await bot.launch({
      allowedUpdates: ['message', 'callback_query', 'chat_join_request', 'chat_member']
    });
    console.log("🚀 Bot Active (Polling mode)");
  } catch (err) {
    console.error("❌ Botni ishga tushirishda xatolik, 5 soniyadan so'ng qayta urinish...", err.message);
    setTimeout(startBot, 5000);
  }
};

startBot();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
