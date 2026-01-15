
import { db } from '../services/supabase.service.js';
import { Markup } from 'telegraf';

const DEFAULT_MAX_WARN = 5;

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
      let keyboard = null;
      let duration = 10000; // Standart 10 soniya

      if (count === 4) {
        await moderation.muteUser(ctx, userId, 60); // 1 soat
        text += `\n\n🚫 <b>4-warn:</b> 1 soat MUTE!`;
        keyboard = Markup.inlineKeyboard([[Markup.button.callback("🔓 Ozod qilish", `unmute_${userId}`)]]);
        duration = 600000; // 10 daqiqa
      } else if (count >= maxWarn) {
        await moderation.muteUser(ctx, userId, 240); // 4 soat
        await db.resetWarns(chatId, userId);
        text += `\n\n🚫 <b>5-warn:</b> 4 soat MUTE va warnlar nollandi.`;
        keyboard = Markup.inlineKeyboard([[Markup.button.callback("🔓 Ozod qilish", `unmute_${userId}`)]]);
        duration = 600000; // 10 daqiqa
      }

      const reply = await ctx.replyWithHTML(text, keyboard);
      setTimeout(() => ctx.telegram.deleteMessage(chatId, reply.message_id).catch(() => {}), duration);
      
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
    } catch (e) { return false; }
  },
  unmuteUser: async (ctx, userId) => {
    try {
      const member = await ctx.getChatMember(userId);
      if (member.status !== 'restricted') return "NOT_MUTED";

      await db.resetWarns(ctx.chat.id, userId);
      await ctx.telegram.restrictChatMember(ctx.chat.id, userId, {
        permissions: { 
          can_send_messages: true, can_send_media_messages: true, 
          can_send_polls: true, can_send_other_messages: true, 
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
      const member = await ctx.getChatMember(userId);
      if (member.status !== 'kicked') return "NOT_BANNED";

      await ctx.telegram.unbanChatMember(ctx.chat.id, userId);
      return true;
    } catch (e) { return false; }
  }
};
