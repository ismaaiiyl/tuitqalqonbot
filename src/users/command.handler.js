
import { Markup } from 'telegraf';
import { db } from '../services/supabase.service.js';
import { moderation } from '../actions/moderation.js';
import { opService } from '../services/op.service.js';

export const handleCommands = (bot) => {
  const checkAdmin = async (ctx) => {
    try {
      const member = await ctx.getChatMember(ctx.from.id);
      return ['administrator', 'creator'].includes(member.status);
    } catch (e) { return false; }
  };

  const parseDuration = (text) => {
    try {
      const match = text.match(/(\d+)(min|h|d)/i);
      if (!match) {
        const num = text.split(' ').find(p => !isNaN(p) && p.length < 6);
        return num ? parseInt(num) : 0;
      }
      const val = parseInt(match[1]);
      const unit = match[2].toLowerCase();
      if (unit === 'min') return val;
      if (unit === 'h') return val * 60;
      if (unit === 'd') return val * 1440;
      return 0;
    } catch (e) { return 0; }
  };

  const getTargetUser = (ctx) => {
    try {
      if (ctx.message.reply_to_message) {
        return {
          id: ctx.message.reply_to_message.from.id,
          name: ctx.message.reply_to_message.from.first_name
        };
      }
      const entities = ctx.message.entities;
      if (entities) {
        for (const ent of entities) {
          if (ent.type === 'text_mention') return { id: ent.user.id, name: ent.user.first_name };
        }
      }
      const parts = ctx.message.text.split(' ');
      const potentialId = parts.find(p => !isNaN(p) && p.length > 5);
      if (potentialId) return { id: potentialId, name: "Foydalanuvchi" };
      return null;
    } catch (e) { return null; }
  };

  bot.start(async (ctx) => {
    try {
      if (ctx.chat.type !== 'private') return;

      const botName = ctx.botInfo.first_name;
      const botUser = ctx.botInfo.username;

      const welcomeText = `
👋 <b>Assalomu alaykum, ${ctx.from.first_name}!</b>

Men <b>${botName}</b> — guruhlaringiz xavfsizligini ta'minlovchi professional moderator botman.

<b>🚀 Asosiy vazifalarim:</b>
  • 🛡 <b>Reklama nazorati:</b> Link va reklamalarni darhol o'chiraman.
  • 🤬 <b>Filtr:</b> Haqoratli va so'kingan so'zlarni bloklayman.
  • ⚠️ <b>Ogohlantirish:</b> Qoidabuzarlarga avtomatik warn beraman.
  • 🔇 <b>Mute/Ban:</b> Tartibbuzarlarni guruhdan chetlataman.
  • 📢 <b>Obuna tizimi:</b> Kanallaringizga a'zo bo'lmaganlarni yozishini cheklayman.

<i>Botdan foydalanish uchun uni guruhingizga qo'shing va adminlik huquqini bering!</i>`;

      await ctx.replyWithHTML(welcomeText, Markup.inlineKeyboard([
        [Markup.button.url("➕ Guruhga qo'shish", `https://t.me/${botUser}?startgroup=true`)],
        [Markup.button.url("👨‍💻 Dasturchi", "https://t.me/ninja_askbot")]
      ]));
    } catch (e) { console.error('Start Command Error:', e); }
  });

  bot.command('mute', async (ctx) => {
    try {
      if (ctx.chat.type === 'private' || !await checkAdmin(ctx)) return;
      const target = getTargetUser(ctx);
      if (!target) return ctx.reply("❌ Foydalanuvchini topolmadim.").then(m => setTimeout(() => ctx.deleteMessage(m.message_id).catch(() => {}), 5000));

      const mins = parseDuration(ctx.message.text);
      const res = await moderation.muteUser(ctx, target.id, mins);
      if (res) {
        const reply = await ctx.replyWithHTML(
          `🔇 <b>${target.name}</b> ${mins > 0 ? (mins >= 1440 ? (mins/1440)+' kunga' : (mins >= 60 ? (mins/60)+' soatga' : mins+' daqiqaga')) : 'umrbod'} jimgina o'tiradigan bo'ldi.`,
          Markup.inlineKeyboard([[Markup.button.callback("🔓 Ozod qilish", `unmute_${target.id}`)]])
        );
        setTimeout(() => ctx.telegram.deleteMessage(ctx.chat.id, reply.message_id).catch(() => {}), 10000);
        moderation.deleteMsg(ctx);
      }
    } catch (e) {}
  });

  bot.command('ban', async (ctx) => {
    try {
      if (ctx.chat.type === 'private' || !await checkAdmin(ctx)) return;
      const target = getTargetUser(ctx);
      if (!target) return ctx.reply("❌ Kimni ban qilmoqchisiz?");

      const res = await moderation.banUser(ctx, target.id);
      if (res) {
        const reply = await ctx.replyWithHTML(
          `❌ <b>${target.name}</b> guruhdan haydaldi.`,
          Markup.inlineKeyboard([[Markup.button.callback("🔓 Ozod qilish", `unban_${target.id}`)]])
        );
        setTimeout(() => ctx.telegram.deleteMessage(ctx.chat.id, reply.message_id).catch(() => {}), 10000);
        moderation.deleteMsg(ctx);
      }
    } catch (e) {}
  });

  bot.command(['unmute', 'unban'], async (ctx) => {
    try {
      if (ctx.chat.type === 'private' || !await checkAdmin(ctx)) return;
      const target = getTargetUser(ctx);
      if (!target) return;
      
      const isUnban = ctx.message.text.includes('unban');
      const res = isUnban ? await moderation.unbanUser(ctx, target.id) : await moderation.unmuteUser(ctx, target.id);
      
      if (res) {
        const reply = await ctx.replyWithHTML(`✅ <b>${target.name}</b> ${isUnban ? 'bandan' : 'mutedan'} olindi.`);
        setTimeout(() => ctx.telegram.deleteMessage(ctx.chat.id, reply.message_id).catch(() => {}), 10000);
        moderation.deleteMsg(ctx);
      }
    } catch (e) {}
  });

  bot.command('myid', (ctx) => {
    try { ctx.reply(`User ID: ${ctx.from.id}`).then(m => setTimeout(() => ctx.deleteMessage(m.message_id).catch(() => {}), 10000)); } catch (e) {}
  });
};

export const handleActions = (bot) => {
  const isAdmin = async (ctx) => {
    try {
      const member = await ctx.getChatMember(ctx.from.id);
      return ['administrator', 'creator'].includes(member.status);
    } catch (e) { return false; }
  };

  bot.action(/^unmute_(\d+)$/, async (ctx) => {
    try {
      if (!await isAdmin(ctx)) return ctx.answerCbQuery("❌ Faqat adminlar uchun!", { show_alert: true });
      const userId = ctx.match[1];
      const res = await moderation.unmuteUser(ctx, userId);
      if (res) {
        await ctx.answerCbQuery("✅ Ozod qilindi!");
        const text = `✅ <a href="tg://user?id=${userId}">${userId}</a> admin tomonidan mutedan olindi.`;
        try {
          await ctx.editMessageText(text, { parse_mode: 'HTML' });
          setTimeout(() => ctx.deleteMessage().catch(() => {}), 10000);
        } catch (err) {
          const reply = await ctx.replyWithHTML(text);
          setTimeout(() => ctx.telegram.deleteMessage(ctx.chat.id, reply.message_id).catch(() => {}), 10000);
        }
      }
    } catch (e) {}
  });

  bot.action(/^unban_(\d+)$/, async (ctx) => {
    try {
      if (!await isAdmin(ctx)) return ctx.answerCbQuery("❌ Faqat adminlar uchun!", { show_alert: true });
      const userId = ctx.match[1];
      const res = await moderation.unbanUser(ctx, userId);
      if (res) {
        await ctx.answerCbQuery("✅ Bandan olindi!");
        const text = `✅ <a href="tg://user?id=${userId}">${userId}</a> admin tomonidan bandan olindi.`;
        try {
          await ctx.editMessageText(text, { parse_mode: 'HTML' });
          setTimeout(() => ctx.deleteMessage().catch(() => {}), 10000);
        } catch (err) {
          const reply = await ctx.replyWithHTML(text);
          setTimeout(() => ctx.telegram.deleteMessage(ctx.chat.id, reply.message_id).catch(() => {}), 10000);
        }
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
