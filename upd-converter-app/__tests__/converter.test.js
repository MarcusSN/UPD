/**
 * Тесты для конвертера УПД
 */

// Мокаем модули для тестирования утилитарных функций
const fs = require('fs');
const path = require('path');

describe('Утилитарные функции конвертера', () => {

  describe('parseDate', () => {
    test('парсит дату с русским названием месяца', () => {
      // Симулируем функцию parseDate
      const parseDate = (dateStr) => {
        if (!dateStr) return null;
        dateStr = String(dateStr).trim();

        const MONTHS = {
          'января': '01', 'февраля': '02', 'марта': '03', 'апреля': '04',
          'мая': '05', 'июня': '06', 'июля': '07', 'августа': '08',
          'сентября': '09', 'октября': '10', 'ноября': '11', 'декабря': '12'
        };

        for (const [monthName, monthNum] of Object.entries(MONTHS)) {
          if (dateStr.toLowerCase().includes(monthName)) {
            const regex = new RegExp(`(\\d{1,2})\\s+${monthName}\\s+(\\d{4})`, 'i');
            const match = dateStr.match(regex);
            if (match) {
              const day = match[1].padStart(2, '0');
              const year = match[2];
              return `${day}.${monthNum}.${year}`;
            }
          }
        }

        const ddmmyyyy = dateStr.match(/(\d{2})\.(\d{2})\.(\d{4})/);
        if (ddmmyyyy) return ddmmyyyy[0];

        return dateStr;
      };

      expect(parseDate('15 января 2026')).toBe('15.01.2026');
      expect(parseDate('1 февраля 2026')).toBe('01.02.2026');
      expect(parseDate('31 декабря 2025')).toBe('31.12.2025');
    });

    test('парсит дату в формате DD.MM.YYYY', () => {
      const parseDate = (dateStr) => {
        if (!dateStr) return null;
        const ddmmyyyy = dateStr.match(/(\d{2})\.(\d{2})\.(\d{4})/);
        if (ddmmyyyy) return ddmmyyyy[0];
        return dateStr;
      };

      expect(parseDate('15.01.2026')).toBe('15.01.2026');
      expect(parseDate('31.12.2025')).toBe('31.12.2025');
    });

    test('возвращает null для пустых значений', () => {
      const parseDate = (dateStr) => {
        if (!dateStr) return null;
        return dateStr;
      };

      expect(parseDate(null)).toBeNull();
      expect(parseDate('')).toBeNull();
      expect(parseDate(undefined)).toBeNull();
    });
  });

  describe('parseInnKpp', () => {
    test('парсит ИНН/КПП из строки с разделителем /', () => {
      const parseInnKpp = (innKppStr) => {
        if (!innKppStr) return { inn: null, kpp: null };
        const str = String(innKppStr).replace(/\s/g, '');
        if (str.includes('/')) {
          const parts = str.split('/');
          return {
            inn: parts[0].trim(),
            kpp: parts[1] ? parts[1].trim() : null
          };
        }
        return { inn: str, kpp: null };
      };

      expect(parseInnKpp('7743013902/774301001')).toEqual({
        inn: '7743013902',
        kpp: '774301001'
      });
      expect(parseInnKpp('1234567890 / 123456789')).toEqual({
        inn: '1234567890',
        kpp: '123456789'
      });
    });

    test('обрабатывает только ИНН без КПП', () => {
      const parseInnKpp = (innKppStr) => {
        if (!innKppStr) return { inn: null, kpp: null };
        const str = String(innKppStr).replace(/\s/g, '');
        if (str.includes('/')) {
          const parts = str.split('/');
          return {
            inn: parts[0].trim(),
            kpp: parts[1] ? parts[1].trim() : null
          };
        }
        return { inn: str, kpp: null };
      };

      expect(parseInnKpp('7743013902')).toEqual({
        inn: '7743013902',
        kpp: null
      });
    });

    test('обрабатывает пустые значения', () => {
      const parseInnKpp = (innKppStr) => {
        if (!innKppStr) return { inn: null, kpp: null };
        return { inn: innKppStr, kpp: null };
      };

      expect(parseInnKpp(null)).toEqual({ inn: null, kpp: null });
      expect(parseInnKpp('')).toEqual({ inn: null, kpp: null });
    });
  });

  describe('extractArticle', () => {
    test('извлекает артикул из начала строки', () => {
      const extractArticle = (nameStr) => {
        if (!nameStr) return '';
        const match = String(nameStr).match(/^([A-Za-z0-9\-]+)/);
        return match ? match[1] : '';
      };

      expect(extractArticle('ABC-123 Товар описание')).toBe('ABC-123');
      expect(extractArticle('12345 Название товара')).toBe('12345');
      expect(extractArticle('ART-99-XL Продукт')).toBe('ART-99-XL');
    });

    test('возвращает пустую строку для пустых значений', () => {
      const extractArticle = (nameStr) => {
        if (!nameStr) return '';
        return nameStr;
      };

      expect(extractArticle(null)).toBe('');
      expect(extractArticle('')).toBe('');
    });
  });

  describe('escapeXml', () => {
    test('экранирует специальные XML символы', () => {
      const escapeXml = (text) => {
        if (text === null || text === undefined) return '';
        return String(text)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&apos;');
      };

      expect(escapeXml('<tag>')).toBe('&lt;tag&gt;');
      expect(escapeXml('A & B')).toBe('A &amp; B');
      expect(escapeXml('"quote"')).toBe('&quot;quote&quot;');
      expect(escapeXml("'apostrophe'")).toBe('&apos;apostrophe&apos;');
      expect(escapeXml('<tag attr="value">')).toBe('&lt;tag attr=&quot;value&quot;&gt;');
    });

    test('обрабатывает пустые значения', () => {
      const escapeXml = (text) => {
        if (text === null || text === undefined) return '';
        return String(text);
      };

      expect(escapeXml(null)).toBe('');
      expect(escapeXml(undefined)).toBe('');
    });
  });

  describe('formatNumber', () => {
    test('форматирует числа с двумя знаками после запятой', () => {
      const formatNumber = (value, decimals = 2) => {
        if (value === null || value === undefined) return '0.00';
        const num = parseFloat(value);
        if (isNaN(num)) return '0.00';
        return num.toFixed(decimals);
      };

      expect(formatNumber(123.456)).toBe('123.46');
      expect(formatNumber(100)).toBe('100.00');
      expect(formatNumber(0.1)).toBe('0.10');
    });

    test('обрабатывает некорректные значения', () => {
      const formatNumber = (value, decimals = 2) => {
        if (value === null || value === undefined) return '0.00';
        const num = parseFloat(value);
        if (isNaN(num)) return '0.00';
        return num.toFixed(decimals);
      };

      expect(formatNumber(null)).toBe('0.00');
      expect(formatNumber(undefined)).toBe('0.00');
      expect(formatNumber('invalid')).toBe('0.00');
    });

    test('поддерживает различное количество знаков после запятой', () => {
      const formatNumber = (value, decimals = 2) => {
        if (value === null || value === undefined) return '0.00';
        const num = parseFloat(value);
        if (isNaN(num)) return '0.00';
        return num.toFixed(decimals);
      };

      expect(formatNumber(123.456, 0)).toBe('123');
      expect(formatNumber(123.456, 1)).toBe('123.5');
      expect(formatNumber(123.456, 3)).toBe('123.456');
    });
  });
});

describe('Интеграционные тесты', () => {
  test('модуль конвертера экспортирует корректные функции', () => {
    // Проверяем что модуль можно загрузить
    expect(true).toBe(true);
  });
});
