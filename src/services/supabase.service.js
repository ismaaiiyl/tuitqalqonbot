
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_KEY;

if (!url || !key) {
  console.error("❌ XATOLIK: SUPABASE_URL yoki SUPABASE_KEY topilmadi!");
  process.exit(1);
}

export const supabase = createClient(url, key);

export const db = {
  saveGroup: async (tgId) => {
    console.log(`[DB] Guruh saqlash: ${tgId}`);
    return await supabase.from('groups').upsert({ tg_id: tgId }, { onConflict: 'tg_id' });
  },
  getGroups: async () => {
    const { data } = await supabase.from('groups').select('tg_id');
    return data || [];
  },
  deleteGroup: async (tgId) => {
    console.log(`[DB] Guruh o'chirish: ${tgId}`);
    return await supabase.from('groups').delete().eq('tg_id', tgId);
  },
  getOPChannels: async () => {
    const { data } = await supabase.from('obuna').select('*');
    return data || [];
  },
  addOPChannel: async (id, nomi, link, type) => {
    console.log(`[DB] OP Kanal qo'shish: ${nomi}`);
    return await supabase.from('obuna').upsert({ tg_id: id, nomi, link, type });
  },
  removeOPChannel: async (id) => {
    return await supabase.from('obuna').delete().eq('tg_id', id);
  },
  getGlobalWords: async () => {
    const { data } = await supabase.from('forbidden_words').select('word');
    return data ? data.map(d => d.word) : [];
  },
  getGroupWords: async (chatId) => {
    const { data } = await supabase.from('group_words').select('word').eq('chat_id', chatId);
    return data ? data.map(d => d.word) : [];
  },
  addGroupWord: async (chatId, word) => {
    return await supabase.from('group_words').upsert({ chat_id: chatId, word: word.toLowerCase().trim() }, { onConflict: 'chat_id, word' });
  },
  getStats: async () => {
    const { count: gCount } = await supabase.from('groups').select('*', { count: 'exact', head: true });
    const { count: oCount } = await supabase.from('obuna').select('*', { count: 'exact', head: true });
    return { groups: gCount || 0, obuna: oCount || 0 };
  },
  getWarns: async (cId, uId) => {
    const { data } = await supabase.from('warns').select('count').eq('chat_id', cId).eq('user_id', uId).single();
    return data ? data.count : 0;
  },
  addWarn: async (cId, uId) => {
    const current = await db.getWarns(cId, uId);
    const { data } = await supabase.from('warns').upsert({ chat_id: cId, user_id: uId, count: current + 1 }, { onConflict: 'chat_id, user_id' }).select().single();
    return data?.count || current + 1;
  },
  resetWarns: async (cId, uId) => {
    return await supabase.from('warns').upsert({ chat_id: cId, user_id: uId, count: 0 }, { onConflict: 'chat_id, user_id' });
  },
  getSettings: async (chatId) => {
    console.log(`[DB] Sozlamalar o'qilmoqda... ChatID: ${chatId}`);
    try {
      const { data, error } = await supabase.from('settings').select('*').eq('chat_id', chatId).maybeSingle();
      if (error) {
        console.error(`[DB ERROR] getSettings (${chatId}):`, error.message);
        return { link_filter: true, swear_filter: true };
      }
      return data || { link_filter: true, swear_filter: true };
    } catch (e) {
      console.error(`[DB FATAL ERROR] getSettings:`, e.message);
      return { link_filter: true, swear_filter: true };
    }
  },
  updateSettings: async (chatId, key, value) => {
    console.log(`[DB] UPDATE START: ${chatId} -> ${key}=${value}`);
    try {
      const current = await db.getSettings(chatId);
      const payload = { ...current, chat_id: chatId, [key]: value };
      
      const { data, error } = await supabase.from('settings').upsert(payload, { onConflict: 'chat_id' }).select().single();
      
      if (error) {
        console.error(`[DB UPDATE ERROR] ${key}:`, error.message);
        return null;
      }
      console.log(`[DB UPDATE SUCCESS] ${key} saqlandi.`);
      return data;
    } catch (e) {
      console.error(`[DB FATAL UPDATE ERROR]`, e.message);
      return null;
    }
  },
  saveRequest: async (userId, chatId) => {
    return await supabase.from('requests').upsert({ user_id: userId, chat_id: chatId });
  },
  hasRequest: async (userId, chatId) => {
    const { data } = await supabase.from('requests').select('*').eq('user_id', userId).eq('chat_id', chatId);
    return data && data.length > 0;
  }
};
