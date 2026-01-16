
export const normalizeText = (text, strip = true) => {
  if (!text) return '';
  
  // O'zbekcha Kirilldan Lotinga o'girish jadvali
  const cyrillicToLatinMap = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'j', 'з': 'z',
    'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r',
    'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'x', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'ъ': '',
    'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya', 'ў': 'o', 'қ': 'q', 'ғ': 'g', 'ҳ': 'h'
  };

  let result = text.toLowerCase();
  
  // Har bir belgini tekshirib lotinga o'girish
  result = result.split('').map(char => cyrillicToLatinMap[char] || char).join('');

  // Raqamlar va vizual o'xshash belgilarni normalizatsiya qilish
  const charMap = { '1': 'i', '0': 'o', '3': 'e', '4': 'a', '@': 'a', '$': 's', 'u': 'u', 'v': 'u' };
  result = result.replace(/[1034@$uv]/g, m => charMap[m] || m);

  if (strip) {
    // Faqat harflarni qoldirish (Compression uchun)
    return result.replace(/[^a-z]/gi, '');
  }
  
  // Struktura (belgilar va bo'shliqlar) saqlangan holatda qaytarish
  return result;
};
