
const userMessages = new Map();

export const isFlooding = (userId) => {
  const now = Date.now();
  const limit = 5; // 5 xabar
  const interval = 3000; // 3 soniya ichida

  if (!userMessages.has(userId)) {
    userMessages.set(userId, []);
  }

  const timestamps = userMessages.get(userId);
  const recent = timestamps.filter(t => now - t < interval);
  recent.push(now);
  userMessages.set(userId, recent);

  return recent.length > limit;
};
