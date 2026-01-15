
import { db } from '../services/supabase.service.js';
import { Markup } from 'telegraf';

const DEFAULT_MAX_WARN = 5;

export const moderation = {
  deleteMsg: async (ctx, msgId = null) => {
    try { 
      const mid = msgId || ctx.message?.message_id;
      const cid = ctx.chat?.id;
      if (mid && cid) {
        console.log(`[MOD] Message Deleted: ${mid} in Chat: ${cid}`);
        await ctx.telegram.deleteMessage(cid, mid);
      }
    } catch (e) { console.error("[MOD DELETE ERROR]", e.message); }
  },
  warnUser: async (ctx, userId, reason) => {
    try {
      const chatId = ctx.chat.id;
      console.log(`[MOD] Warning User: ${userId} in ${chatId} | Reason: ${reason}`);
      
      const count = await db.addWarn(chatId, userId);
      const maxWarn = DEFAULT_MAX_WARN;

      let text = `⚠️ <b>Ogohlantirish!</b> (${count}/${maxWarn})\n👤 Foydalanuvchi: <a href="tg://user?id=${userId}">${userId}</a>\n📝 Sabab: ${reason}`;
      let keyboard = null;

      if (count === 3) {
        await moderation.muteUser(ctx, userId, 10);
        text += `\n\n🚫 3-warn uchun 10 daqiqa MUTE!`;
        keyboard = Markup.inlineKeyboard([[Markup.button.callback("🔓 Ozod qilish", `unmute_${userId}`)]]);
      } else if (count === 4) {
        await moderation.muteUser(ctx, userId, 60);
        text += `\n\n🚫 4-warn uchun 1 soat MUTE!`;
        keyboard = Markup.inlineKeyboard([[Markup.button.callback("🔓 Ozod qilish", `unmute_${userId}`)]]);
      } else if (count >= maxWarn) {
        await moderation.muteUser(ctx, userId, 240);
        await db.resetWarns(chatId, userId);
        text += `\n\n🚫 ${maxWarn}-chi warn: 4 soat MUTE va warnlar nollandi.`;
        keyboard = Markup.inlineKeyboard([[Markup.button.callback("🔓 Ozod qilish", `unmute_${userId}`)]]);
      }

      const reply = await ctx.replyWithHTML(text, keyboard);
      setTimeout(() => ctx.telegram.deleteMessage(chatId, reply.message_id).catch(() => {}), 10000);
      
    } catch (e) { console.error('[WARN ERROR]', e); }
  },
  muteUser: async (ctx, userId, mins = 0) => {
    try {
      console.log(`[MOD] Muting User: ${userId} for ${mins} mins`);
      const until = mins > 0 ? Math.floor(Date.now() / 1000) + mins * 60 : 0;
      await ctx.telegram.restrictChatMember(ctx.chat.id, userId, {
        until_date: until,
        permissions: { can_send_messages: false }
      });
      return true;
    } catch (e) { 
      console.error("[MUTE ERROR]", e.message);
      return false; 
    }
  },
  unmuteUser: async (ctx, userId) => {
    try {
      console.log(`[MOD] Unmuting User: ${userId}`);
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
      console.log(`[MOD] Banning User: ${userId}`);
      await ctx.telegram.banChatMember(ctx.chat.id, userId);
      return true;
    } catch (e) { return false; }
  },
  unbanUser: async (ctx, userId) => {
    try {
      console.log(`[MOD] Unbanning User: ${userId}`);
      await ctx.telegram.unbanChatMember(ctx.chat.id, userId);
      return true;
    } catch (e) { return false; }
  }
};
