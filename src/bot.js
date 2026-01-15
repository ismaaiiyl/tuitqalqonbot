
import 'dotenv/config';
import { Telegraf, session } from 'telegraf';
import http from 'http';
import { handleMessage, handleServiceMessage } from './users/message.handler.js';
import { handleCommands, handleActions } from './users/command.handler.js';
import { handleOwner } from './owner/owner.handler.js';
import { handleAdmin, handleAdminActions } from './admin/admin.handler.js';
import { db } from './services/supabase.service.js';

const bot = new Telegraf(process.env.BOT_TOKEN);

// Sessiyani yoqish
bot.use(session());

// Har bir guruhni bazaga saqlash
bot.use(async (ctx, next) => {
  try {
    if (ctx.chat && (ctx.chat.type === 'group' || ctx.chat.type === 'supergroup')) {
      await db.saveGroup(ctx.chat.id);
    }
  } catch (e) {}
  return next();
});

// Join Requestlarni tutish
bot.on('chat_join_request', async (ctx) => {
  try { await db.saveRequest(ctx.from.id, ctx.chat.id); } catch (e) {}
});

// Handlerlarni ulash
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

// Webhook va Health-check sozlamalari
const PORT = process.env.PORT || 3000;
const WEBHOOK_URL = process.env.WEBHOOK_URL; // Koyeb bergan public URL (masalan: https://app-name.koyeb.app)

if (WEBHOOK_URL) {
  // WEBHOOK REJIMI (Koyeb uchun ideal)
  const secretPath = `/telegraf/${bot.secretPathComponent()}`;
  
  bot.telegram.setWebhook(`${WEBHOOK_URL}${secretPath}`);
  
  const server = http.createServer((req, res) => {
    if (req.url === '/' || req.url === '/health') {
      res.writeHead(200);
      res.end('UzModeratorBot is Alive and Healthy!');
      return;
    }
    // Webhook so'rovlarini Telegraf-ga yo'naltirish
    if (req.url === secretPath) {
      bot.webhookCallback(secretPath)(req, res);
      return;
    }
    res.writeHead(404);
    res.end();
  });

  server.listen(PORT, () => {
    console.log(`🚀 Webhook mode: ${WEBHOOK_URL} (Port: ${PORT})`);
  });
} else {
  // POLLING REJIMI (Local test uchun)
  const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Bot is running in Polling mode...');
  });
  
  server.listen(PORT, () => {
    console.log(`📡 Polling mode: Health-check on port ${PORT}`);
  });

  bot.launch().then(() => {
    console.log("🚀 UzModeratorBot Active (Polling)");
  });
}

// Graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
