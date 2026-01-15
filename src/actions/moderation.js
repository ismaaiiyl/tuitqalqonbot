
import { db } from '../services/supabase.service.js';
import { Markup } from 'telegraf';

const DEFAULT_MAX_WARN = 5;
const MUTE_MSG_DURATION = 600000; // 10 daqiqa (ms)
const WARN_MSG_DURATION = 10000; // 10 soniya (ms)

export const moderation = {
  deleteMsg: async (ctx, msgId = null) => {
    try { 
      const mid = msgId || ctx.message?.message_id;
      const cid = ctx.chat?.id;
      if (mid && cid) {
        await ctx.telegram.deleteMessage(cid, mid);
      }
    } catch (e) {}
  },
  warnUser: async (ctx, userId, reason) => {
    try {
      const chatId = ctx.chat.id;
      const count = await db.addWarn(chatId, userId);
      const maxWarn = DEFAULT_MAX_WARN;

      let text = `⚠️ <b>Ogohlantirish!</b> (${count}/${maxWarn})\n👤 Foydalanuvchi: <a href="tg://user?id=${userId}">${userId}</a>\n📝 Sabab: ${reason}`;

      if (count >= maxWarn) {
        await moderation.muteUser(ctx, userId, 240); // 4 soat mute
        await db.resetWarns(chatId, userId);
        text += `\n\n🚫 ${maxWarn}-chi warn: Foydalanuvchi 4 soatga guruhdan chetlatildi (MUTE).`;
      }

      const reply = await ctx.replyWithHTML(text);
      // Warn xabari 10 soniyada o'chadi
      setTimeout(() => ctx.telegram.deleteMessage(chatId, reply.message_id).catch(() => {}), WARN_MSG_DURATION);
      
    } catch (e) { console.error('[WARN ERROR]', e); }
  },
  muteUser: async (ctx, userId, mins = 0) => {
    try {
      const until = mins > 0 ? Math.floor(Date.now() / 1000) + mins * 60 : 0;
      await ctx.telegram.restrictChatMember(ctx.chat.id, userId, {
        until_date: until,
        permissions: { 
          can_send_messages: false,
          can_send_media_messages: false,
          can_send_other_messages: false,
          can_add_web_page_previews: false
        }
      });
      return true;
    } catch (e) { 
      console.error("[MUTE ERROR]", e.message);
      return false; 
    }
  },
  unmuteUser: async (ctx, userId) => {
    try {
      await db.resetWarns(ctx.chat.id, userId);
      await ctx.telegram.restrictChatMember(ctx.chat.id, userId, {
        permissions: { 
          can_send_messages: true, 
          can_send_media_messages: true, 
          can_send_polls: true, 
          can_send_other_messages: true, 
          can_add_web_page_previews: true 
        }
      });
      return true;
    } catch (e) { return false; }
  },
  banUser: async (ctx, userId) => {
    try {
      await ctx.telegram.banChatMember(ctx.chat.id, userId);
      return true;
    } catch (e) { return false; }
  },
  unbanUser: async (ctx, userId) => {
    try {
      await ctx.telegram.unbanChatMember(ctx.chat.id, userId);
      return true;
    } catch (e) { return false; }
  }
};
