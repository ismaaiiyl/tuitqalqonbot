
import { Markup } from 'telegraf';
import { db } from '../services/supabase.service.js';

export const handleAdmin = (bot) => {
  const checkAdmin = async (ctx) => {
    try {
      if (ctx.chat.type === 'private') return false;
      const member = await ctx.getChatMember(ctx.from.id);
      const isAdm = ['administrator', 'creator'].includes(member.status);
      console.log(`[AUTH] Admin Check | User: ${ctx.from.id} | Status: ${isAdm}`);
      return isAdm;
    } catch (e) { 
      console.error("[AUTH ERROR]", e.message);
      return false; 
    }
  };

  const getSettingsMenu = (s) => {
    console.log(`[UI] Menu Rendering | Link: ${s.link_filter}, Swear: ${s.swear_filter}`);
    return Markup.inlineKeyboard([
      [Markup.button.callback(`🔗 Linklar: ${s.link_filter ? '✅ ON' : '❌ OFF'}`, `adm_set_link_filter_${!s.link_filter}`)],
      [Markup.button.callback(`🤬 So'kinish: ${s.swear_filter ? '✅ ON' : '❌ OFF'}`, `adm_set_swear_filter_${!s.swear_filter}`)],
      [Markup.button.callback("❌ Menyuni yopish", "adm_close")]
    ]);
  };

  bot.command('settings', async (ctx) => {
    try {
      console.log(`[CMD] /settings request from Chat: ${ctx.chat.id}`);
      if (ctx.chat.type === 'private') return ctx.reply("❌ Bu buyruq faqat guruhlarda ishlaydi.");
      
      if (!await checkAdmin(ctx)) {
        console.log(`[AUTH] Access Denied: User ${ctx.from.id} is not admin.`);
        return ctx.reply("❌ Kechirasiz, bu buyruq faqat guruh adminlari uchun!").then(m => {
          setTimeout(() => ctx.deleteMessage(m.message_id).catch(() => {}), 5000);
        });
      }

      const s = await db.getSettings(ctx.chat.id);
      await ctx.replyWithHTML(`<b>⚙️ Guruh Sozlamalari</b>\n\nFiltrlarni yoqish yoki o'chirish uchun tugmalarni bosing:`, getSettingsMenu(s));
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
      console.log(`[ACTION] Button Clicked | Key: ${key} | Value: ${val}`);

      if (!await checkAdmin(ctx)) {
        console.log(`[AUTH] Action Forbidden | User: ${ctx.from.id}`);
        return ctx.answerCbQuery("❌ Faqat adminlar uchun!", { show_alert: true });
      }

      const result = await db.updateSettings(ctx.chat.id, key, val);
      if (!result) {
        console.error(`[ACTION ERROR] Database update failed for ${key}`);
        return ctx.answerCbQuery("❌ Bazaga saqlashda xatolik yuz berdi!", { show_alert: true });
      }

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
      console.log(`[ACTION SUCCESS] Settings updated successfully.`);
    } catch (e) {
      console.error(`[ACTION FATAL ERROR]`, e);
      await ctx.answerCbQuery("❌ Kutilmagan xatolik!", { show_alert: true });
    }
  });

  bot.action('adm_close', (ctx) => {
    console.log(`[ACTION] Menu Closed`);
    ctx.deleteMessage().catch(() => {});
  });
};
