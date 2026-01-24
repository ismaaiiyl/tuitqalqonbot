
import 'dotenv/config';
import { Telegraf, session } from 'telegraf';
import http from 'http';
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

const bot = new Telegraf(token);

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
    ).catch(() => {});
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

bot.catch((err, ctx) => {
  console.error(`🛑 Global Xatolik (${ctx.updateType}):`, err);
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

bot.launch({
  allowedUpdates: ['message', 'callback_query', 'chat_join_request', 'chat_member']
}).then(() => {
  console.log("🚀 Bot Active (Polling mode)");
}).catch(err => {
  if (err.response && err.response.error_code === 401) {
    console.error("❌ XATOLIK: Telegram Token noto'g'ri (401 Unauthorized)!");
  } else {
    console.error("❌ Botni ishga tushirishda xatolik:", err);
  }
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
