
import { Markup } from 'telegraf';
import { db } from '../services/supabase.service.js';

const SETTINGS_MSG_DURATION = 300000; // 5 daqiqa (ms)

export const handleAdmin = (bot) => {
  const checkAdmin = async (ctx) => {
    try {
      if (ctx.chat.type === 'private') return false;
      const member = await ctx.getChatMember(ctx.from.id);
      return ['administrator', 'creator'].includes(member.status);
    } catch (e) { return false; }
  };

  const getSettingsMenu = (s) => {
    return Markup.inlineKeyboard([
      [Markup.button.callback(`🔗 Linklar: ${s.link_filter ? '✅ ON' : '❌ OFF'}`, `adm_set_link_filter_${!s.link_filter}`)],
      [Markup.button.callback(`🤬 So'kinish: ${s.swear_filter ? '✅ ON' : '❌ OFF'}`, `adm_set_swear_filter_${!s.swear_filter}`)],
      [Markup.button.callback("❌ Menyuni yopish", "adm_close")]
    ]);
  };

  bot.command('settings', async (ctx) => {
    try {
      if (ctx.chat.type === 'private') return ctx.reply("❌ Bu buyruq faqat guruhlarda ishlaydi.");
      
      if (!await checkAdmin(ctx)) {
        return ctx.reply("❌ Kechirasiz, bu buyruq faqat guruh adminlari uchun!").then(m => {
          setTimeout(() => ctx.deleteMessage(m.message_id).catch(() => {}), 5000);
        });
      }

      const s = await db.getSettings(ctx.chat.id);
      const reply = await ctx.replyWithHTML(`<b>⚙️ Guruh Sozlamalari</b>\n\nFiltrlarni yoqish yoki o'chirish uchun tugmalarni bosing. Ushbu menyu 5 daqiqadan so'ng o'chib ketadi:`, getSettingsMenu(s));
      
      // Settings menyusi 5 daqiqadan keyin o'chadi
      setTimeout(() => ctx.telegram.deleteMessage(ctx.chat.id, reply.message_id).catch(() => {}), SETTINGS_MSG_DURATION);
      
    } catch (e) { console.error('[SETTINGS CMD ERROR]', e); }
  });
};

export const handleAdminActions = (bot) => {
  const checkAdmin = async (ctx) => {
    try {
      const member = await ctx.getChatMember(ctx.from.id);
      return ['administrator', 'creator'].includes(member.status);
    } catch (e) { return false; }
  };

  bot.action(/^adm_set_(link_filter|swear_filter)_(true|false)$/, async (ctx) => {
    try {
      const key = ctx.match[1];
      const val = ctx.match[2] === 'true';

      if (!await checkAdmin(ctx)) {
        return ctx.answerCbQuery("❌ Faqat adminlar uchun!", { show_alert: true });
      }

      await db.updateSettings(ctx.chat.id, key, val);
      const updatedSettings = await db.getSettings(ctx.chat.id);
      
      await ctx.editMessageText(`<b>⚙️ Guruh Sozlamalari</b> (Yangilandi)\n\nFiltrlarni yoqish yoki o'chirish uchun tugmalarni bosing:`, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [Markup.button.callback(`🔗 Linklar: ${updatedSettings.link_filter ? '✅ ON' : '❌ OFF'}`, `adm_set_link_filter_${!updatedSettings.link_filter}`)],
            [Markup.button.callback(`🤬 So'kinish: ${updatedSettings.swear_filter ? '✅ ON' : '❌ OFF'}`, `adm_set_swear_filter_${!updatedSettings.swear_filter}`)],
            [Markup.button.callback("❌ Menyuni yopish", "adm_close")]
          ]
        }
      });

      await ctx.answerCbQuery("✅ Saqlandi");
    } catch (e) {
      console.error(`[ACTION ERROR]`, e);
      await ctx.answerCbQuery("❌ Xatolik yuz berdi!", { show_alert: true });
    }
  });

  bot.action('adm_close', (ctx) => {
    ctx.deleteMessage().catch(() => {});
  });
};
