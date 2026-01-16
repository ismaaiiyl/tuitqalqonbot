
import { db } from '../services/supabase.service.js';
import { moderation } from '../actions/moderation.js';
import { normalizeText } from '../utils/normalizeText.js';
import { opService } from '../services/op.service.js';
import { Markup } from 'telegraf';

export const handleMessage = async (ctx) => {
  try {
    if (!ctx.message || ctx.chat.type === 'private') return;
    if (ctx.message.text?.startsWith('/')) return;

    const userId = ctx.from.id;
    const chatId = ctx.chat.id;

    // Adminlarni tekshirmaslik
    try {
      const member = await ctx.getChatMember(userId);
      if (member.status === 'administrator' || member.status === 'creator') return;
    } catch (e) {}

    // 1. Majburiy obuna
    const notJoined = await opService.checkSubscription(ctx, userId);
    if (notJoined.length > 0) {
      console.log(`[FILTER] OP To'sig'i: ${userId}`);
      await moderation.deleteMsg(ctx);
      const buttons = notJoined.slice(0, 3).map(ch => [Markup.button.url(`📢 ${ch.nomi}`, ch.link)]);
      const warnMsg = await ctx.replyWithHTML(
        `👤 <a href="tg://user?id=${userId}">${ctx.from.first_name.replace(/[<>]/g, '')}</a>, guruhda yozish uchun kanallarga a'zo bo'ling!`,
        Markup.inlineKeyboard(buttons)
      );
      setTimeout(() => ctx.telegram.deleteMessage(chatId, warnMsg.message_id).catch(() => {}), 10000);
      return;
    }

    const settings = await db.getSettings(chatId);
    const text = ctx.message.text || ctx.message.caption || '';

    // 2. Link filtri
    if (settings.link_filter) {
      if (/(https?:\/\/|t\.me\/|@[a-z0-9_]+)/gi.test(text)) {
        console.log(`[FILTER] Link topildi: ${userId}`);
        await moderation.deleteMsg(ctx);
        return moderation.warnUser(ctx, userId, "Reklama yoki Link taqiqlangan");
      }
    }

    // 3. So'kinish filtri (Mukammallashtirilgan mantiq)
    if (settings.swear_filter) {
      // Matndagi harflarni normalizatsiya qilamiz, lekin bo'shliq va belgilarni saqlaymiz
      const structuralText = normalizeText(text, false);
      // Yashirin (s*o*k*i*n) so'zlarni aniqlash uchun to'liq siqilgan matn
      const compressedText = normalizeText(text, true);

      const globalWords = await db.getGlobalWords();
      const groupWords = await db.getGroupWords(chatId);
      const allForbiddenWords = [...new Set([...globalWords, ...groupWords])];

      const hasSwear = allForbiddenWords.some(forbiddenWord => {
        const nw = normalizeText(forbiddenWord, true); // Taqiqlangan so'zning toza shakli
        if (!nw || nw.length < 2) return false;

        // Harflar orasida ixtiyoriy belgi bo'lishi mumkinligini hisobga oluvchi pattern
        const pattern = nw.split('').join('[^a-z0-9]*');
        
        if (nw.length <= 3) {
          // Qisqa so'zlar (masalan: "am"): Faqat alohida so'z bo'lgandagina flag qilamiz (\b boundary)
          // Bu orqali "hammaga" ichidagi "am" o'tib ketadi, lekin "am", "a.m", "a*m" ushlanadi.
          const regex = new RegExp(`\\b${pattern}\\b`, 'i');
          return regex.test(structuralText);
        } else {
          // Uzun so'zlar: Ham alohida, ham boshqa so'z ichida (yoki yashirin) bo'lsa flag qilamiz
          const regex = new RegExp(pattern, 'i');
          return regex.test(structuralText) || compressedText.includes(nw);
        }
      });

      if (hasSwear) {
        console.log(`[FILTER] Taqiqlangan so'z aniqlandi: ${userId}`);
        await moderation.deleteMsg(ctx);
        return moderation.warnUser(ctx, userId, "Taqiqlangan so'z ishlatildi");
      }
    }

  } catch (e) { console.error('[MSG HANDLER ERROR]', e); }
};

export const handleServiceMessage = async (ctx) => {
  try { await moderation.deleteMsg(ctx); } catch (e) {}
};
