/**
 * УПД Конвертер - Улучшенная браузерная версия
 * Конвертирует Excel в XML формат ON_NSCHFDOPPR версия 5.03
 */

// Утилитарные функции
const MONTHS = {
    'января': '01', 'февраля': '02', 'марта': '03', 'апреля': '04',
    'мая': '05', 'июня': '06', 'июля': '07', 'августа': '08',
    'сентября': '09', 'октября': '10', 'ноября': '11', 'декабря': '12'
};

function parseDate(dateStr) {
    if (!dateStr) return null;
    dateStr = String(dateStr).trim();

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
}

function parseInnKpp(innKppStr) {
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
}

function escapeXml(text) {
    if (text === null || text === undefined) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function formatNumber(value, decimals = 2) {
    if (value === null || value === undefined) return '0.00';
    const num = parseFloat(String(value).replace(/\s/g, '').replace(',', '.'));
    if (isNaN(num)) return '0.00';
    return num.toFixed(decimals);
}

/**
 * Конвертер УПД для браузера
 */
async function convertExcelToXML(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: null });

                const xml = generateXML(jsonData, file.name);
                resolve(xml);
            } catch (error) {
                reject(error);
            }
        };

        reader.onerror = () => reject(new Error('Ошибка чтения файла'));
        reader.readAsArrayBuffer(file);
    });
}

function generateXML(data, filename) {
    const docId = uuidv4();
    const docNumber = extractDocNumber(data);
    const docDate = extractDocDate(data);

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<Файл ИдФайл="${docId}" ВерсПрог="УПД Конвертер Web 1.0" ВерсФорм="5.03">
    <СвУчДокОбор ИдОтпр="SENDER" ИдПол="RECEIVER">
        <СвОЭДОтпр ИННЮЛ="0000000000" ИдЭДО="2BE" НаимОрг="Организация"/>
    </СвУчДокОбор>
    <Документ КНД="1115131" Функция="СЧФ" ПоФактХЖ="Документ об отгрузке товаров (выполнении работ), передаче имущественных прав (документ об оказании услуг)" НаимДокОпр="Счет-фактура и документ об отгрузке товаров (выполнении работ), передаче имущественных прав (документ об оказании услуг)" ДатаИнфПр="${getCurrentDate()}" ВремИнфПр="${getCurrentTime()}" НаимЭконСубСост="Организация">
        <СвСчФакт НомерСчФ="${escapeXml(docNumber)}" ДатаСчФ="${escapeXml(docDate)}" КодОКВ="643">
            <СвПрод>
                <ИдСв>
                    <СвЮЛУч НаимОрг="Продавец" ИННЮЛ="0000000000" КПП="000000000"/>
                </ИдСв>
                <Адрес>
                    <АдрРФ КодРегион="00" Индекс="000000" Город="Москва" Улица="Улица" Дом="1"/>
                </Адрес>
            </СвПрод>
            <СвПокуп>
                <ИдСв>
                    <СвЮЛУч НаимОрг="Покупатель" ИННЮЛ="0000000000" КПП="000000000"/>
                </ИдСв>
                <Адрес>
                    <АдрРФ КодРегион="00" Индекс="000000" Город="Москва" Улица="Улица" Дом="1"/>
                </Адрес>
            </СвПокуп>
        </СвСчФакт>
        <ТаблСчФакт>`;

    // Извлекаем товары
    const items = extractItems(data);

    console.log(`Найдено товаров: ${items.length}`);

    items.forEach((item, index) => {
        xml += `
            <СведТов НомСтр="${index + 1}" НаимТов="${escapeXml(item.name)}" ОКЕИ_Тов="796" КолТов="${formatNumber(item.quantity, 3)}" ЦенаТов="${formatNumber(item.price)}" СтТовБезНДС="${formatNumber(item.sumWithoutVAT)}" НалСт="20%" СумНал="${formatNumber(item.vatSum)}" СтТовУчНал="${formatNumber(item.sumWithVAT)}">
                <Акциз>
                    <БезАкциз>без акциза</БезАкциз>
                </Акциз>
                <СумНал>
                    <СумНал>${formatNumber(item.vatSum)}</СумНал>
                </СумНал>
            </СведТов>`;
    });

    xml += `
        </ТаблСчФакт>
        <ВсегоОпл СтТовБезНДСВсего="${formatNumber(getTotalWithoutVAT(items))}" СтТовУчНалВсего="${formatNumber(getTotalWithVAT(items))}">
            <СумНалВсего>
                <СумНал>${formatNumber(getTotalVAT(items))}</СумНал>
            </СумНалВсего>
        </ВсегоОпл>
    </Документ>
</Файл>`;

    return xml;
}

function extractDocNumber(data) {
    // Поиск номера документа в первых 20 строках
    for (let i = 0; i < Math.min(20, data.length); i++) {
        const row = data[i];
        if (!row) continue;

        // Ищем ячейку с номером
        for (let j = 0; j < row.length - 1; j++) {
            const cell = String(row[j] || '');
            if (cell.includes('Счет-фактура') && row[j + 1]) {
                const nextCell = String(row[j + 1]);
                const match = nextCell.match(/№?\s*(\d+)/);
                if (match) return match[1];
            }
        }
    }

    // Альтернативный поиск
    for (let i = 0; i < Math.min(20, data.length); i++) {
        const row = data[i];
        if (!row) continue;
        for (let j = 0; j < row.length; j++) {
            const cell = String(row[j] || '');
            if (cell.match(/^№?\s*\d+$/)) {
                return cell.replace(/[^\d]/g, '');
            }
        }
    }

    return '1';
}

function extractDocDate(data) {
    // Поиск даты в первых 20 строках
    for (let i = 0; i < Math.min(20, data.length); i++) {
        const row = data[i];
        if (!row) continue;

        for (let j = 0; j < row.length; j++) {
            const cell = String(row[j] || '');

            // Проверяем различные форматы дат
            if (cell.match(/\d{1,2}\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)\s+\d{4}/i)) {
                return parseDate(cell) || getCurrentDate();
            }
            if (cell.match(/\d{2}\.\d{2}\.\d{4}/)) {
                return parseDate(cell) || getCurrentDate();
            }
        }
    }

    return getCurrentDate();
}

function extractItems(data) {
    const items = [];
    let headerRow = -1;
    let columns = {};

    // Шаг 1: Найти строку с заголовками таблицы
    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        if (!row) continue;

        // Ищем характерные заголовки
        for (let j = 0; j < row.length; j++) {
            const cell = String(row[j] || '').toLowerCase();

            // Если нашли колонку "№ п/п" или похожую
            if (cell.includes('п/п') || cell.includes('п.п')) {
                headerRow = i;

                // Определяем позиции колонок по заголовкам
                for (let k = 0; k < row.length; k++) {
                    const header = String(row[k] || '').toLowerCase();

                    if (header.includes('наименование') || header.includes('название')) {
                        columns.name = k;
                    }
                    if (header.includes('количество') || header.includes('кол-во') || header.includes('кол.')) {
                        columns.quantity = k;
                    }
                    if (header.includes('цена') && !header.includes('сумма')) {
                        columns.price = k;
                    }
                    if (header.includes('стоимость') && header.includes('без') && header.includes('ндс')) {
                        columns.sumWithoutVAT = k;
                    }
                    if (header.includes('сумма') && header.includes('ндс') && !header.includes('без')) {
                        columns.vatSum = k;
                    }
                    if (header.includes('стоимость') && header.includes('ндс')) {
                        columns.sumWithVAT = k;
                    }
                }
                break;
            }
        }

        if (headerRow !== -1) break;
    }

    console.log('Найдена строка заголовков:', headerRow);
    console.log('Определенные колонки:', columns);

    if (headerRow === -1) {
        console.error('Заголовки таблицы не найдены');
        return items;
    }

    // Шаг 2: Извлечь товары, начиная со следующей строки
    const startRow = headerRow + 1;

    for (let i = startRow; i < data.length && items.length < 200; i++) {
        const row = data[i];
        if (!row) continue;

        // Получаем значения из определенных колонок
        const name = row[columns.name];
        const quantity = row[columns.quantity];
        const price = row[columns.price];
        const sumWithoutVAT = row[columns.sumWithoutVAT];
        const vatSum = row[columns.vatSum];
        const sumWithVAT = row[columns.sumWithVAT];

        // Проверка: если наименование пустое или слишком короткое - конец таблицы
        if (!name || String(name).trim().length < 2) {
            break;
        }

        // Проверка: если это итоговая строка
        const nameStr = String(name).toLowerCase();
        if (nameStr.includes('всего') || nameStr.includes('итого')) {
            break;
        }

        // Парсим числовые значения
        const qty = parseFloat(String(quantity || '1').replace(/\s/g, '').replace(',', '.')) || 1;
        const prc = parseFloat(String(price || '0').replace(/\s/g, '').replace(',', '.')) || 0;

        // Используем готовые суммы если есть, иначе считаем
        let sum = parseFloat(String(sumWithoutVAT || '0').replace(/\s/g, '').replace(',', '.'));
        let vat = parseFloat(String(vatSum || '0').replace(/\s/g, '').replace(',', '.'));
        let total = parseFloat(String(sumWithVAT || '0').replace(/\s/g, '').replace(',', '.'));

        if (!sum || sum === 0) {
            sum = qty * prc;
        }
        if (!vat || vat === 0) {
            vat = sum * 0.20;
        }
        if (!total || total === 0) {
            total = sum + vat;
        }

        items.push({
            name: String(name).trim(),
            quantity: qty,
            price: prc,
            sumWithoutVAT: sum,
            vatSum: vat,
            sumWithVAT: total
        });
    }

    console.log(`Извлечено товаров: ${items.length}`);
    return items;
}

function getTotalWithoutVAT(items) {
    return items.reduce((sum, item) => sum + item.sumWithoutVAT, 0);
}

function getTotalVAT(items) {
    return items.reduce((sum, item) => sum + item.vatSum, 0);
}

function getTotalWithVAT(items) {
    return items.reduce((sum, item) => sum + item.sumWithVAT, 0);
}

function getCurrentDate() {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    return `${day}.${month}.${year}`;
}

function getCurrentTime() {
    const now = new Date();
    return now.toTimeString().split(' ')[0];
}

function downloadXML(content, filename) {
    const blob = new Blob([content], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.replace('.xlsx', '.xml').replace('.xls', '.xml');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
