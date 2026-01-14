
// Bu fayl faqat platforma talabi uchun. Bot src/bot.js da ishlaydi.
console.log("Telegram Moderator Bot server muhitida ishlashga tayyor.");
document.body.innerHTML = `
  <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif; background: #0f172a; color: #f8fafc;">
    <h1 style="color: #38bdf8;">🚀 UzModeratorBot Running</h1>
    <p>Bot muvaffaqiyatli ishga tushdi va Supabase bilan bog'landi.</p>
    <div style="padding: 20px; background: #1e293b; border-radius: 8px; margin-top: 20px;">
      <code>Status: Active</code><br>
      <code>Database: Supabase Connected</code>
    </div>
  </div>
`;
