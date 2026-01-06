/**
 * УПД Конвертер - Браузерная версия
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
    const num = parseFloat(value);
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

                // Простая конвертация (можно расширить)
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
    // Поиск номера документа
    for (let i = 0; i < Math.min(20, data.length); i++) {
        const row = data[i];
        if (!row) continue;
        for (let j = 0; j < row.length; j++) {
            const cell = row[j];
            if (cell && String(cell).includes('№')) {
                return row[j + 1] || '1';
            }
        }
    }
    return '1';
}

function extractDocDate(data) {
    // Поиск даты документа
    for (let i = 0; i < Math.min(20, data.length); i++) {
        const row = data[i];
        if (!row) continue;
        for (let j = 0; j < row.length; j++) {
            const cell = row[j];
            if (cell && (String(cell).includes('от') || String(cell).includes('дата'))) {
                const dateStr = row[j + 1];
                return parseDate(dateStr) || getCurrentDate();
            }
        }
    }
    return getCurrentDate();
}

function extractItems(data) {
    const items = [];
    let startRow = -1;

    // Поиск начала таблицы товаров
    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        if (!row) continue;
        for (const cell of row) {
            if (cell && (String(cell).includes('№') && String(cell).includes('п/п'))) {
                startRow = i + 2; // Пропускаем заголовок
                break;
            }
        }
        if (startRow !== -1) break;
    }

    if (startRow === -1) return items;

    // Извлекаем товары
    for (let i = startRow; i < data.length && items.length < 100; i++) {
        const row = data[i];
        if (!row || row.length < 10) continue;

        const rowNum = row[5];
        const name = row[9];
        const quantity = row[10];
        const price = row[11];

        if (!name || String(name).length < 3) break;

        const qty = parseFloat(quantity) || 1;
        const prc = parseFloat(price) || 0;
        const sumWithoutVAT = qty * prc;
        const vatSum = sumWithoutVAT * 0.20;
        const sumWithVAT = sumWithoutVAT + vatSum;

        items.push({
            name: String(name),
            quantity: qty,
            price: prc,
            sumWithoutVAT,
            vatSum,
            sumWithVAT
        });
    }

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
