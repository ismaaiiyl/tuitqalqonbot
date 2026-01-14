
import { db } from './supabase.service.js';

export const opService = {
  checkSubscription: async (ctx, userId) => {
    const channels = await db.getOPChannels();
    const notJoined = [];

    for (const ch of channels) {
      if (ch.type === 'bot') {
        if (!ctx.session?.joinedBots?.includes(ch.tg_id)) notJoined.push(ch);
        continue;
      }

      try {
        const member = await ctx.telegram.getChatMember(ch.tg_id, userId);
        const active = ['member', 'administrator', 'creator'].includes(member.status);
        if (!active) {
          const requested = await db.hasRequest(userId, ch.tg_id);
          if (!requested) notJoined.push(ch);
        }
      } catch (e) {
        notJoined.push(ch);
      }
    }
    return notJoined;
  }
};
