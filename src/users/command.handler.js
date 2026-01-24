
import { Markup } from 'telegraf';
import { db } from '../services/supabase.service.js';
import { moderation } from '../actions/moderation.js';
import { opService } from '../services/op.service.js';

const ACTION_MSG_DURATION = 600000; // 10 daqiqa
const SUCCESS_MSG_DURATION = 10000; // 10 soniya

export const handleCommands = (bot) => {
  const checkAdmin = async (ctx) => {
    try {
      const member = await ctx.getChatMember(ctx.from.id);
      return ['administrator', 'creator'].includes(member.status);
    } catch (e) { return false; }
  };

  const parseDuration = (text) => {
    try {
      const match = text.match(/(\d+)(s|min|h|d)/i);
      if (!match) {
        const num = text.split(' ').find(p => !isNaN(p) && p.length < 7);
        return num ? parseInt(num) : 0;
      }
      const val = parseInt(match[1]);
      const unit = match[2].toLowerCase();
      if (unit === 's') return Math.max(1, Math.floor(val / 60)); // Kamida 1 min TG cheklovi
      if (unit === 'min') return val;
      if (unit === 'h') return val * 60;
      if (unit === 'd') return val * 1440;
      return 0;
    } catch (e) { return 0; }
  };

  const getTargetUser = async (ctx) => {
    try {
      // 1. Reply
      if (ctx.message.reply_to_message) {
        return {
          id: ctx.message.reply_to_message.from.id,
          name: ctx.message.reply_to_message.from.first_name || "Foydalanuvchi"
        };
      }
      
      // 2. Mentions (Entities)
      const entities = ctx.message.entities || [];
      for (const ent of entities) {
        if (ent.type === 'text_mention') return { id: ent.user.id, name: ent.user.first_name };
        if (ent.type === 'mention') {
          const username = ctx.message.text.substring(ent.offset, ent.offset + ent.length);
          return { id: username, name: username };
        }
      }

      // 3. ID yoki Username qidirish
      const parts = ctx.message.text.split(' ');
      for (const p of parts) {
        if (!isNaN(p) && p.length >= 7) return { id: Number(p), name: "Foydalanuvchi" };
        if (p.startsWith('@')) return { id: p, name: p };
      }
      
      return null;
    } catch (e) { return null; }
  };

  bot.start(async (ctx) => {
    try {
      if (ctx.chat.type !== 'private') return;
      const botName = ctx.botInfo.first_name;
      const botUser = ctx.botInfo.username;
      
      const welcomeText = `👋 <b>Assalomu alaykum, ${ctx.from.first_name}!</b>

Men <b>${botName}</b> — guruhlaringiz xavfsizligini ta'minlovchi moderator botman.

<b>🚀 Imkoniyatlarim:</b>
  • 🛡 Reklamalarni o'chirish.
  • 🤬 So'kinishlarni filtrlar.
  • ⚠️ Ogohlantirish (warn) tizimi.
  • 🔇 Mute va Ban boshqaruvi.

<i>Botdan foydalanish uchun uni guruhingizga qo'shing va adminlik bering!</i>`;

      await ctx.replyWithHTML(welcomeText, Markup.inlineKeyboard([
        [Markup.button.url("➕ Guruhga qo'shish", `https://t.me/${botUser}?startgroup=true`)],
        [Markup.button.url("👨‍💻 Dasturchi", "https://t.me/ninjaskbot")]
      ]));
    } catch (e) {}
  });

  bot.command('mute', async (ctx) => {
    try {
      if (ctx.chat.type === 'private' || !await checkAdmin(ctx)) return;
      const target = await getTargetUser(ctx);
      if (!target) return;

      const mins = parseDuration(ctx.message.text);
      const res = await moderation.muteUser(ctx, target.id, mins);
      if (res) {
        const dText = mins > 0 ? (mins >= 1440 ? Math.floor(mins/1440)+' kunga' : (mins >= 60 ? Math.floor(mins/60)+' soatga' : mins+' daqiqaga')) : 'umrbod';
        const reply = await ctx.replyWithHTML(
          `🔇 <b>${target.name}</b> ${dText} jimgina o'tiradigan bo'ldi.`,
          Markup.inlineKeyboard([[Markup.button.callback("🔓 Ozod qilish", `unmute_${target.id}`)]])
        );
        setTimeout(() => ctx.telegram.deleteMessage(ctx.chat.id, reply.message_id).catch(() => {}), ACTION_MSG_DURATION);
        moderation.deleteMsg(ctx);
      }
    } catch (e) {}
  });

  bot.command('ban', async (ctx) => {
    try {
      if (ctx.chat.type === 'private' || !await checkAdmin(ctx)) return;
      const target = await getTargetUser(ctx);
      if (!target) return;

      const res = await moderation.banUser(ctx, target.id);
      if (res) {
        const reply = await ctx.replyWithHTML(
          `❌ <b>${target.name}</b> guruhdan haydaldi.`,
          Markup.inlineKeyboard([[Markup.button.callback("🔓 Bandan olish", `unban_${target.id}`)]])
        );
        setTimeout(() => ctx.telegram.deleteMessage(ctx.chat.id, reply.message_id).catch(() => {}), ACTION_MSG_DURATION);
        moderation.deleteMsg(ctx);
      }
    } catch (e) {}
  });

  bot.command(['unmute', 'unban'], async (ctx) => {
    try {
      if (ctx.chat.type === 'private' || !await checkAdmin(ctx)) return;
      const target = await getTargetUser(ctx);
      if (!target) return;
      
      const isUnban = ctx.message.text.includes('unban');
      const res = isUnban ? await moderation.unbanUser(ctx, target.id) : await moderation.unmuteUser(ctx, target.id);
      
      let text = "";
      if (res === true) text = `✅ <b>${target.name}</b> muvaffaqiyatli ${isUnban ? 'bandan' : 'mutedan'} olindi.`;
      else if (res === "NOT_MUTED") text = `ℹ️ <b>${target.name}</b> muted emas.`;
      else if (res === "NOT_BANNED") text = `ℹ️ <b>${target.name}</b> ban qilinmagan.`;
      else text = `❌ Amallarni bajarib bo'lmadi (ID topilmadi yoki bot admin emas).`;

      const reply = await ctx.replyWithHTML(text);
      setTimeout(() => ctx.telegram.deleteMessage(ctx.chat.id, reply.message_id).catch(() => {}), SUCCESS_MSG_DURATION);
      moderation.deleteMsg(ctx);
    } catch (e) {}
  });

  bot.command('myid', (ctx) => {
    try { ctx.reply(`Sizning ID: <code>${ctx.from.id}</code>`, { parse_mode: 'HTML' }).then(m => setTimeout(() => ctx.deleteMessage(m.message_id).catch(() => {}), 10000)); } catch (e) {}
  });
};

export const handleActions = (bot) => {
  const isAdmin = async (ctx) => {
    try {
      const member = await ctx.getChatMember(ctx.from.id);
      return ['administrator', 'creator'].includes(member.status);
    } catch (e) { return false; }
  };

  bot.action(/^unmute_(.+)$/, async (ctx) => {
    try {
      if (!await isAdmin(ctx)) return ctx.answerCbQuery("Faqat adminlar uchun!", { show_alert: true });
      const uid = ctx.match[1];
      const res = await moderation.unmuteUser(ctx, uid);
      if (res === true) {
        await ctx.answerCbQuery("Muvaffaqiyatli!");
        await ctx.editMessageText("✅ Foydalanuvchi mutedan olindi.");
        setTimeout(() => ctx.deleteMessage().catch(() => {}), SUCCESS_MSG_DURATION);
      } else {
        await ctx.answerCbQuery("Foydalanuvchi jazolanmagan.", { show_alert: true });
      }
    } catch (e) {}
  });

  bot.action(/^unban_(.+)$/, async (ctx) => {
    try {
      if (!await isAdmin(ctx)) return ctx.answerCbQuery("Faqat adminlar uchun!", { show_alert: true });
      const uid = ctx.match[1];
      const res = await moderation.unbanUser(ctx, uid);
      if (res === true) {
        await ctx.answerCbQuery("Muvaffaqiyatli!");
        await ctx.editMessageText("✅ Foydalanuvchi bandan olindi.");
        setTimeout(() => ctx.deleteMessage().catch(() => {}), SUCCESS_MSG_DURATION);
      } else {
        await ctx.answerCbQuery("Foydalanuvchi ban qilinmagan.", { show_alert: true });
      }
    } catch (e) {}
  });

  bot.action('check_op', async (ctx) => {
    try {
      const notJoined = await opService.checkSubscription(ctx, ctx.from.id);
      if (notJoined.length === 0) {
        await ctx.answerCbQuery("✅");
        return ctx.editMessageText("<b>Tabriklaymiz!</b> Endi yozishingiz mumkin.", { parse_mode: 'HTML' }).then(() => {
          setTimeout(() => ctx.deleteMessage().catch(() => {}), 5000);
        });
      }
      await ctx.answerCbQuery("❌ Obuna bo'ling!", { show_alert: true });
    } catch (e) {}
  });
};
