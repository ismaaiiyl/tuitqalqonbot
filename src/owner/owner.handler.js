
import { db } from '../services/supabase.service.js';
import { Markup } from 'telegraf';

let broadcastState = { isRunning: false, stopRequested: false };
const sleep = (ms) => new Promise(res => setTimeout(res, ms));

export const handleOwner = (bot) => {
  const isOwner = (ctx) => ctx.from?.id === Number(process.env.OWNER_ID);

  const mainMenu = (stats) => Markup.inlineKeyboard([
    [Markup.button.callback("📊 Statistika", "o_stats")],
    [Markup.button.callback("📢 Majburiy Obuna", "o_op")],
    [Markup.button.callback("🚀 Reklama Tarqatish", "o_broadcast_init")]
  ]);

  const backToMain = [Markup.button.callback("⬅️ Asosiy Menyu", "o_main")];

  bot.command('owner', async (ctx) => {
    try {
      if (!isOwner(ctx)) return;
      const s = await db.getStats();
      await ctx.replyWithHTML(`<b>👑 Boshqaruv Paneli</b>\n\n👥 Guruhlar: <code>${s.groups}</code>\n📢 Obunalar: <code>${s.obuna}</code>`, mainMenu(s));
    } catch (e) {}
  });

  bot.action('o_main', async (ctx) => {
    try {
      const s = await db.getStats();
      await ctx.editMessageText(`<b>👑 Boshqaruv Paneli</b>\n\n👥 Guruhlar: <code>${s.groups}</code>\n📢 Obunalar: <code>${s.obuna}</code>`, {
        parse_mode: 'HTML',
        ...mainMenu(s)
      });
    } catch (e) {}
  });

  bot.action('o_stats', async (ctx) => {
    try {
      const s = await db.getStats();
      await ctx.editMessageText(`<b>📊 Statistika Ma'lumotlari</b>\n\n👥 Bot qo'shilgan guruhlar: <code>${s.groups}</code>\n📢 Majburiy obuna kanallari: <code>${s.obuna}</code>`, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([backToMain])
      });
    } catch (e) {}
  });

  bot.action('o_broadcast_init', (ctx) => {
    try {
      if (broadcastState.isRunning) return ctx.answerCbQuery("⚠️ Reklama allaqachon jarayonda!", { show_alert: true });
      ctx.session = { step: 'wait_ad_msg' };
      ctx.editMessageText("<b>1-qadam:</b> Reklama xabaringizni yuboring.\n(Xabar media, text yoki tugmali bo'lishi mumkin)", {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([backToMain])
      });
    } catch (e) {}
  });

  bot.on('message', async (ctx, next) => {
    try {
      if (!isOwner(ctx) || !ctx.session?.step) return next();
      const step = ctx.session.step;

      if (step === 'wait_ad_msg') {
        ctx.session.adMsgId = ctx.message.message_id;
        ctx.session.step = 'ask_exc';
        await ctx.replyWithHTML("<b>2-qadam:</b> Istisno guruhlar qo'shasizmi?", 
          Markup.inlineKeyboard([
            [Markup.button.callback("✅ Ha", "exc_yes"), Markup.button.callback("❌ Yo'q", "exc_no")],
            backToMain
          ])
        );
      } 
      else if (step === 'wait_exc_ids') {
        const ids = ctx.message.text.split('\n').map(id => id.trim()).filter(id => id);
        ctx.session.exceptions = ids;
        ctx.session.step = 'ready';
        await ctx.replyWithHTML(`✅ <b>${ids.length} ta ID qabul qilindi.</b>`, 
          Markup.inlineKeyboard([
            [Markup.button.callback("🚀 Boshlash", "run_ad")],
            [Markup.button.callback("❌ Bekor qilish", "o_main")]
          ])
        );
      }
      else if (step === 'wait_op_add') {
        const parts = ctx.message.text.split('\n');
        if (parts.length < 4) return ctx.reply("❌ Format xato!");
        await db.addOPChannel(parts[0], parts[1], parts[2], parts[3]);
        ctx.session.step = null;
        ctx.reply("✅ Kanal qo'shildi!", Markup.inlineKeyboard([[Markup.button.callback("⬅️ Obunalar", "o_op")]]));
      }
    } catch (e) {}
  });

  bot.action('exc_yes', (ctx) => {
    try {
      ctx.session.step = 'wait_exc_ids';
      ctx.editMessageText("<b>Istisno guruhlar IDlarini yuboring.</b>", { parse_mode: 'HTML' });
    } catch (e) {}
  });

  bot.action('exc_no', (ctx) => {
    try {
      ctx.session.exceptions = [];
      ctx.session.step = 'ready';
      ctx.editMessageText("<b>Barcha guruhlarga yuborishga tayyormisiz?</b>", {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback("🚀 Boshlash", "run_ad")],
          [Markup.button.callback("❌ Bekor qilish", "o_main")]
        ])
      });
    } catch (e) {}
  });

  bot.action('run_ad', async (ctx) => {
    try {
      const msgId = ctx.session?.adMsgId;
      const exceptions = ctx.session?.exceptions || [];
      if (!msgId) return ctx.editMessageText("❌ Xabar topilmadi.");

      broadcastState.isRunning = true;
      broadcastState.stopRequested = false;
      ctx.session.step = null;

      const allGroups = await db.getGroups();
      const targetGroups = allGroups.filter(g => !exceptions.includes(String(g.tg_id)));
      
      let success = 0, failed = 0;
      const statusMsg = await ctx.replyWithHTML(`🛰 <b>Tarqatish boshlandi...</b>\n\nJami: <code>${targetGroups.length}</code>`, 
        Markup.inlineKeyboard([[Markup.button.callback("🛑 To'xtatish", "stop_broad")]])
      );

      for (let i = 0; i < targetGroups.length; i++) {
        if (broadcastState.stopRequested) break;
        try {
          await ctx.telegram.copyMessage(targetGroups[i].tg_id, ctx.chat.id, msgId);
          success++;
        } catch (e) {
          failed++;
          if (e.description?.includes('chat not found')) await db.deleteGroup(targetGroups[i].tg_id);
        }

        if (i % 5 === 0 || i === targetGroups.length - 1) {
          const percent = Math.round(((i + 1) / targetGroups.length) * 100);
          await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, null, 
            `⏳ <b>Jarayon:</b>\n\n✅ S: <code>${success}</code>\n❌ F: <code>${failed}</code>\n📊 Progress: <code>${percent}%</code>`,
            { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback("🛑 To'xtatish", "stop_broad")]]) }
          ).catch(() => {});
        }
        await sleep(150);
      }

      broadcastState.isRunning = false;
      await ctx.replyWithHTML(`🏁 <b>Yakunlandi!</b>\n✅ Yuborildi: ${success}\n❌ Xatolik: ${failed}`, Markup.inlineKeyboard([backToMain]));
    } catch (e) {}
  });

  bot.action('stop_broad', (ctx) => {
    broadcastState.stopRequested = true;
    ctx.answerCbQuery("🛑 To'xtatish so'rovi yuborildi!", { show_alert: true });
  });

  bot.action('o_op', async (ctx) => {
    try {
      const channels = await db.getOPChannels();
      let text = "📢 <b>Majburiy obuna ro'yxati:</b>\n\n";
      channels.forEach((c, i) => { text += `${i+1}. <b>${c.nomi}</b> [<code>${c.tg_id}</code>]\n`; });
      const kb = [[Markup.button.callback("➕ Qo'shish", "op_add_init")], [Markup.button.callback("🗑 O'chirish", "op_del_list")], backToMain];
      await ctx.editMessageText(text, { parse_mode: 'HTML', ...Markup.inlineKeyboard(kb) });
    } catch (e) {}
  });

  bot.action('op_add_init', (ctx) => {
    try {
      ctx.session = { step: 'wait_op_add' };
      ctx.editMessageText("<b>Format:</b>\n<code>TG_ID\nNOMI\nLINK\nTYPE</code>", {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback("⬅️ Orqaga", "o_op")]])
      });
    } catch (e) {}
  });

  bot.action('op_del_list', async (ctx) => {
    try {
      const channels = await db.getOPChannels();
      const kb = channels.map(c => [Markup.button.callback(`❌ ${c.nomi}`, `del_op_${c.tg_id}`)]);
      kb.push([Markup.button.callback("⬅️ Orqaga", "o_op")]);
      ctx.editMessageText("<b>O'chirish uchun tanlang:</b>", { parse_mode: 'HTML', ...Markup.inlineKeyboard(kb) });
    } catch (e) {}
  });

  bot.action(/^del_op_(.+)$/, async (ctx) => {
    try {
      await db.removeOPChannel(ctx.match[1]);
      ctx.answerCbQuery("O'chirildi!");
      ctx.editMessageText("✅ Kanal muvaffaqiyatli o'chirildi.", Markup.inlineKeyboard([[Markup.button.callback("⬅️ Obunalar", "o_op")]]));
    } catch (e) {}
  });
};
