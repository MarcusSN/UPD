/**
 * Простой конвертер UTF-8 в Windows-1251 для браузера
 * Таблица перекодировки кириллицы
 */

const WIN1251_MAP = {
    '\u0410': 0xC0, '\u0411': 0xC1, '\u0412': 0xC2, '\u0413': 0xC3,
    '\u0414': 0xC4, '\u0415': 0xC5, '\u0416': 0xC6, '\u0417': 0xC7,
    '\u0418': 0xC8, '\u0419': 0xC9, '\u041A': 0xCA, '\u041B': 0xCB,
    '\u041C': 0xCC, '\u041D': 0xCD, '\u041E': 0xCE, '\u041F': 0xCF,
    '\u0420': 0xD0, '\u0421': 0xD1, '\u0422': 0xD2, '\u0423': 0xD3,
    '\u0424': 0xD4, '\u0425': 0xD5, '\u0426': 0xD6, '\u0427': 0xD7,
    '\u0428': 0xD8, '\u0429': 0xD9, '\u042A': 0xDA, '\u042B': 0xDB,
    '\u042C': 0xDC, '\u042D': 0xDD, '\u042E': 0xDE, '\u042F': 0xDF,
    '\u0430': 0xE0, '\u0431': 0xE1, '\u0432': 0xE2, '\u0433': 0xE3,
    '\u0434': 0xE4, '\u0435': 0xE5, '\u0436': 0xE6, '\u0437': 0xE7,
    '\u0438': 0xE8, '\u0439': 0xE9, '\u043A': 0xEA, '\u043B': 0xEB,
    '\u043C': 0xEC, '\u043D': 0xED, '\u043E': 0xEE, '\u043F': 0xEF,
    '\u0440': 0xF0, '\u0441': 0xF1, '\u0442': 0xF2, '\u0443': 0xF3,
    '\u0444': 0xF4, '\u0445': 0xF5, '\u0446': 0xF6, '\u0447': 0xF7,
    '\u0448': 0xF8, '\u0449': 0xF9, '\u044A': 0xFA, '\u044B': 0xFB,
    '\u044C': 0xFC, '\u044D': 0xFD, '\u044E': 0xFE, '\u044F': 0xFF,
    '\u0401': 0xA8, // Ё
    '\u0451': 0xB8, // ё
    '\u2116': 0xB9, // №
    '\u00AB': 0xAB, // «
    '\u00BB': 0xBB, // »
    '\u2014': 0x97, // —
    '\u2013': 0x96, // –
    '\u201C': 0x93, // "
    '\u201D': 0x94, // "
    '\u2018': 0x91, // '
    '\u2019': 0x92, // '
    '\u2026': 0x85, // …
};

/**
 * Конвертирует строку UTF-8 в массив байтов Windows-1251
 */
function encodeWindows1251(str) {
    const bytes = [];

    for (let i = 0; i < str.length; i++) {
        const char = str[i];
        const code = char.charCodeAt(0);

        if (code < 128) {
            // ASCII символы (0-127) одинаковы
            bytes.push(code);
        } else if (WIN1251_MAP[char] !== undefined) {
            // Кириллица и спецсимволы
            bytes.push(WIN1251_MAP[char]);
        } else {
            // Неизвестный символ — заменяем на ?
            bytes.push(0x3F);
        }
    }

    return new Uint8Array(bytes);
}

/**
 * Создаёт Blob с кодировкой Windows-1251
 */
function createWindows1251Blob(content) {
    const bytes = encodeWindows1251(content);
    return new Blob([bytes], { type: 'application/xml' });
}
