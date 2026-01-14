
import 'dotenv/config';
import { Telegraf, session } from 'telegraf';
import { handleMessage, handleServiceMessage } from './users/message.handler.js';
import { handleCommands, handleActions } from './users/command.handler.js';
import { handleOwner } from './owner/owner.handler.js';
import { handleAdmin, handleAdminActions } from './admin/admin.handler.js';
import { db } from './services/supabase.service.js';

const bot = new Telegraf(process.env.BOT_TOKEN);

// Sessiyani yoqish
bot.use(session());

// Har bir guruhni bazaga saqlash va tekshirish
bot.use(async (ctx, next) => {
  try {
    if (ctx.chat && (ctx.chat.type === 'group' || ctx.chat.type === 'supergroup')) {
      await db.saveGroup(ctx.chat.id);
    }
  } catch (e) {}
  return next();
});

// Join Requestlarni tutish (OP tizimi uchun)
bot.on('chat_join_request', async (ctx) => {
  try { await db.saveRequest(ctx.from.id, ctx.chat.id); } catch (e) {}
});

// Handlerlarni ulash
handleOwner(bot);         // Bot egasi paneli
handleAdmin(bot);        // Guruh adminlari paneli (/settings)
handleAdminActions(bot); // Guruh adminlari tugmalari
handleCommands(bot);      // Foydalanuvchi buyruqlari
handleActions(bot);       // Umumiy tugma bosish mantiqlari

// Xabarlarni tahlil qilish
bot.on([
  'new_chat_members', 'left_chat_member', 'new_chat_title', 
  'new_chat_photo', 'delete_chat_photo', 'pinned_message',
  'group_chat_created', 'supergroup_chat_created'
], handleServiceMessage);

bot.on(['text', 'caption'], handleMessage);

// Global xato tutuvchi (Bot o'lmasligi uchun)
bot.catch((err, ctx) => {
  console.error(`🛑 Global Xatolik (${ctx.updateType}):`, err);
});

bot.launch().then(() => {
  console.log("🚀 UzModeratorBot Active (Clean Architecture Mode)");
}).catch(e => console.error("Launch Error:", e));
