/**
 * УПД Конвертер - Исправленная браузерная версия
 * Конвертирует Excel в XML формат ON_NSCHFDOPPR версия 5.03
 *
 * Исправления:
 * - Добавлено извлечение данных продавца/покупателя
 * - Добавлено извлечение ИНН/КПП
 * - Улучшен парсинг товарных позиций
 * - Используются фиксированные индексы колонок (как в локальной версии)
 */

// Конфигурация маппинга колонок Excel (индексы начинаются с 0)
const EXCEL_MAPPING = {
    document: {
        numberSearchText: 'Счет-фактура №',
        numberColumn: 15,
        dateSearchText: 'от',
        dateColumn: 24
    },
    seller: {
        nameSearchText: 'Продавец:',
        nameColumn: 17,
        addressSearchText: 'Адрес:',
        addressColumn: 17,
        innKppSearchText: 'ИНН/КПП продавца',
        innKppColumn: 17
    },
    buyer: {
        nameSearchText: 'Покупатель:',
        nameColumn: 56,
        addressSearchText: 'Адрес:',
        addressColumn: 56,
        innKppSearchText: 'ИНН/КПП покупателя',
        innKppColumn: 56
    },
    items: {
        headerSearchText: '№\nп/п',
        rowNumberColumn: 5,
        nameColumn: 9,
        okeiCodeColumn: 22,
        unitColumn: 24,
        quantityColumn: 26,
        priceColumn: 29,
        amountNoVatColumn: 39,
        vatRateColumn: 51,
        vatAmountColumn: 53,
        amountWithVatColumn: 57
    }
};

// Настройки XML
const XML_SETTINGS = {
    version: '5.03',
    function: 'ДОП',
    currencyCode: '643',
    currencyName: 'Российский рубль',
    defaultCountry: 'КИТАЙ',
    defaultCountryCode: '156'
};

// Русские названия месяцев для парсинга дат
const MONTHS = {
    'января': '01', 'февраля': '02', 'марта': '03', 'апреля': '04',
    'мая': '05', 'июня': '06', 'июля': '07', 'августа': '08',
    'сентября': '09', 'октября': '10', 'ноября': '11', 'декабря': '12'
};

/**
 * Парсит дату из разных форматов
 */
function parseDate(dateStr) {
    if (!dateStr) return null;
    dateStr = String(dateStr).trim();

    // Проверяем формат с русским месяцем: "15 января 2026г."
    for (const [monthName, monthNum] of Object.entries(MONTHS)) {
        if (dateStr.toLowerCase().includes(monthName)) {
            const regex = new RegExp(`(\\d{1,2})\\s+${monthName}\\s*(\\d{4})`, 'i');
            const match = dateStr.match(regex);
            if (match) {
                const day = match[1].padStart(2, '0');
                const year = match[2];
                return `${day}.${monthNum}.${year}`;
            }
        }
    }

    // Проверяем формат DD.MM.YYYY
    const ddmmyyyy = dateStr.match(/(\d{2})\.(\d{2})\.(\d{4})/);
    if (ddmmyyyy) return ddmmyyyy[0];

    return dateStr;
}

/**
 * Парсит ИНН/КПП из строки
 */
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

/**
 * Извлекает артикул из наименования товара
 */
function extractArticle(nameStr) {
    if (!nameStr) return '';
    const match = String(nameStr).match(/^([A-Za-z0-9\-]+)/);
    return match ? match[1] : '';
}

/**
 * Экранирует специальные символы для XML
 */
function escapeXml(text) {
    if (text === null || text === undefined) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

/**
 * Форматирует число
 */
function formatNumber(value, decimals = 2) {
    if (value === null || value === undefined) return '0.00';
    const num = parseFloat(String(value).replace(/\s/g, '').replace(',', '.'));
    if (isNaN(num)) return '0.00';
    return num.toFixed(decimals);
}

/**
 * Безопасно получает значение ячейки
 */
function getCell(data, row, col) {
    if (row >= 0 && row < data.length) {
        const rowData = data[row];
        if (rowData && col >= 0 && col < rowData.length) {
            return rowData[col];
        }
    }
    return null;
}

/**
 * Ищет ячейку с текстом, возвращает {row, col}
 */
function findCellByText(data, searchText, maxRows = null) {
    const rowsToSearch = maxRows ? Math.min(maxRows, data.length) : data.length;

    for (let rowIdx = 0; rowIdx < rowsToSearch; rowIdx++) {
        const row = data[rowIdx];
        if (!row) continue;

        for (let colIdx = 0; colIdx < row.length; colIdx++) {
            const cell = row[colIdx];
            if (cell && String(cell).includes(searchText)) {
                return { row: rowIdx, col: colIdx };
            }
        }
    }
    return { row: null, col: null };
}

/**
 * Находит строку с заголовками таблицы товаров
 */
function findHeaderRow(data) {
    const searchTexts = ['№\nп/п', '№ п/п', 'п/п', '№\r\nп/п'];

    for (let rowIdx = 0; rowIdx < data.length; rowIdx++) {
        const row = data[rowIdx];
        if (!row) continue;

        for (const cell of row) {
            if (!cell) continue;
            const cellStr = String(cell);
            for (const searchText of searchTexts) {
                if (cellStr.includes(searchText)) {
                    return rowIdx;
                }
            }
        }
    }
    return null;
}

/**
 * Находит строку начала данных таблицы товаров
 */
function findDataStartRow(data, headerRow) {
    if (headerRow === null) return null;

    const rowNumCol = EXCEL_MAPPING.items.rowNumberColumn;
    const nameCol = EXCEL_MAPPING.items.nameColumn;

    // Ищем первую строку с номером "1" после заголовка
    for (let rowIdx = headerRow + 1; rowIdx < Math.min(headerRow + 10, data.length); rowIdx++) {
        const row = data[rowIdx];
        if (!row) continue;

        const rowNum = row[rowNumCol];
        const nameVal = row[nameCol];

        // Проверяем, что это строка с данными (номер = 1 и есть название)
        if ((rowNum === 1 || String(rowNum) === '1') && nameVal && String(nameVal).length > 2) {
            return rowIdx;
        }
    }

    // Если не нашли по номеру, пробуем найти по наличию данных
    for (let rowIdx = headerRow + 1; rowIdx < Math.min(headerRow + 10, data.length); rowIdx++) {
        const row = data[rowIdx];
        if (!row) continue;

        const nameVal = row[nameCol];
        if (nameVal && String(nameVal).length > 3 && !/^\d+$/.test(String(nameVal))) {
            return rowIdx;
        }
    }

    return headerRow + 3; // Fallback
}

/**
 * Извлекает информацию о документе
 */
function extractDocumentInfo(data) {
    const info = {};
    const docCfg = EXCEL_MAPPING.document;
    const sellerCfg = EXCEL_MAPPING.seller;
    const buyerCfg = EXCEL_MAPPING.buyer;

    // === НОМЕР ДОКУМЕНТА ===
    const { row: docRow } = findCellByText(data, docCfg.numberSearchText, 20);
    if (docRow !== null) {
        // Ищем число в той же строке после "Счет-фактура №"
        const row = data[docRow];
        for (let col = 0; col < row.length; col++) {
            const cell = row[col];
            if (cell !== null && cell !== undefined) {
                const cellStr = String(cell).trim();
                // Если это число или строка с числом
                if (/^\d+$/.test(cellStr)) {
                    info.docNumber = cellStr;
                    break;
                }
            }
        }
        // Fallback: берём из фиксированной колонки
        if (!info.docNumber) {
            info.docNumber = getCell(data, docRow, docCfg.numberColumn);
        }
    }

    // === ДАТА ДОКУМЕНТА ===
    for (let rowIdx = 0; rowIdx < Math.min(10, data.length); rowIdx++) {
        const row = data[rowIdx];
        if (!row) continue;

        for (let colIdx = 0; colIdx < row.length; colIdx++) {
            const cell = row[colIdx];
            if (cell) {
                const cellStr = String(cell);
                // Ищем дату в формате "DD месяц YYYY"
                for (const monthName of Object.keys(MONTHS)) {
                    if (cellStr.toLowerCase().includes(monthName)) {
                        info.docDate = parseDate(cellStr);
                        break;
                    }
                }
                // Или в формате DD.MM.YYYY
                if (!info.docDate && cellStr.match(/\d{2}\.\d{2}\.\d{4}/)) {
                    info.docDate = parseDate(cellStr);
                }
            }
            if (info.docDate) break;
        }
        if (info.docDate) break;
    }

    // === ПРОДАВЕЦ ===
    const { row: sellerRow } = findCellByText(data, sellerCfg.nameSearchText, 20);
    if (sellerRow !== null) {
        info.sellerName = getCell(data, sellerRow, sellerCfg.nameColumn);
    }

    // Адрес продавца - ищем "Адрес:" в первых 15 строках
    for (let rowIdx = 0; rowIdx < Math.min(15, data.length); rowIdx++) {
        const row = data[rowIdx];
        if (!row) continue;

        for (let colIdx = 0; colIdx < Math.min(15, row.length); colIdx++) {
            const cell = row[colIdx];
            if (cell && String(cell).includes('Адрес:')) {
                const addr = getCell(data, rowIdx, sellerCfg.addressColumn);
                if (addr && !info.sellerAddress) {
                    info.sellerAddress = String(addr).trim();
                    break;
                }
            }
        }
        if (info.sellerAddress) break;
    }

    // ИНН/КПП продавца
    const { row: sellerInnRow } = findCellByText(data, sellerCfg.innKppSearchText, 20);
    if (sellerInnRow !== null) {
        const innKpp = getCell(data, sellerInnRow, sellerCfg.innKppColumn);
        const parsed = parseInnKpp(innKpp);
        info.sellerInn = parsed.inn;
        info.sellerKpp = parsed.kpp;
    }

    // === ПОКУПАТЕЛЬ ===
    const { row: buyerRow } = findCellByText(data, buyerCfg.nameSearchText, 20);
    if (buyerRow !== null) {
        info.buyerName = getCell(data, buyerRow, buyerCfg.nameColumn);
    }

    // Адрес покупателя - ищем второй "Адрес:"
    let foundFirstAddress = false;
    for (let rowIdx = 0; rowIdx < Math.min(15, data.length); rowIdx++) {
        const row = data[rowIdx];
        if (!row) continue;

        for (let colIdx = 0; colIdx < row.length; colIdx++) {
            const cell = row[colIdx];
            if (cell && String(cell).includes('Адрес:')) {
                if (foundFirstAddress) {
                    const addr = getCell(data, rowIdx, buyerCfg.addressColumn);
                    if (addr) {
                        info.buyerAddress = String(addr).trim();
                    }
                    break;
                }
                foundFirstAddress = true;
            }
        }
        if (info.buyerAddress) break;
    }

    // ИНН/КПП покупателя
    const { row: buyerInnRow } = findCellByText(data, buyerCfg.innKppSearchText, 20);
    if (buyerInnRow !== null) {
        const innKpp = getCell(data, buyerInnRow, buyerCfg.innKppColumn);
        const parsed = parseInnKpp(innKpp);
        info.buyerInn = parsed.inn;
        info.buyerKpp = parsed.kpp;
    }

    return info;
}

/**
 * Извлекает товарные позиции
 */
function extractItems(data) {
    const items = [];
    const headerRow = findHeaderRow(data);
    const dataStart = findDataStartRow(data, headerRow);

    if (dataStart === null) {
        console.error('Не удалось найти начало таблицы товаров');
        return items;
    }

    console.log(`Заголовок таблицы: строка ${headerRow}, данные начинаются: строка ${dataStart}`);

    const cols = EXCEL_MAPPING.items;

    for (let rowIdx = dataStart; rowIdx < data.length; rowIdx++) {
        const row = data[rowIdx];
        if (!row) continue;

        const rowNum = row[cols.rowNumberColumn];
        const name = row[cols.nameColumn];

        // Проверяем, что это строка с данными
        if (rowNum === null || rowNum === undefined) {
            // Проверяем, не итоговая ли это строка
            if (name && (String(name).toLowerCase().includes('всего') ||
                        String(name).toLowerCase().includes('итого'))) {
                break;
            }
            continue;
        }

        // Проверяем, что rowNum - число
        const rowNumInt = parseInt(rowNum);
        if (isNaN(rowNumInt)) {
            break;
        }

        // Проверяем валидность названия
        if (!name || String(name).trim().length < 2) {
            continue;
        }

        const item = {
            num: rowNumInt,
            name: String(name).trim(),
            okeiCode: row[cols.okeiCodeColumn] || 796,
            unit: row[cols.unitColumn] || 'шт',
            quantity: row[cols.quantityColumn] || 0,
            price: row[cols.priceColumn] || 0,
            amountNoVat: row[cols.amountNoVatColumn] || 0,
            vatRate: row[cols.vatRateColumn] || 20,
            vatAmount: row[cols.vatAmountColumn] || 0,
            amountWithVat: row[cols.amountWithVatColumn] || 0
        };

        item.article = extractArticle(item.name);
        items.push(item);
    }

    console.log(`Извлечено товаров: ${items.length}`);
    return items;
}

/**
 * Вычисляет итоговые суммы
 */
function calculateTotals(items) {
    const totals = { totalNoVat: 0, totalVat: 0, totalWithVat: 0, totalQuantity: 0 };

    for (const item of items) {
        totals.totalNoVat += parseFloat(item.amountNoVat) || 0;
        totals.totalVat += parseFloat(item.vatAmount) || 0;
        totals.totalWithVat += parseFloat(item.amountWithVat) || 0;
        totals.totalQuantity += parseFloat(item.quantity) || 0;
    }

    return totals;
}

/**
 * Форматирует текущую дату
 */
function formatDate(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
}

/**
 * Форматирует дату для идентификатора файла
 */
function formatFileDate(dateStr) {
    if (!dateStr) {
        const now = new Date();
        return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    }
    const parts = dateStr.split('.');
    if (parts.length === 3) {
        return `${parts[2]}${parts[1]}${parts[0]}`;
    }
    return dateStr.replace(/\./g, '');
}

/**
 * Генерирует XML в формате ON_NSCHFDOPPR
 */
function generateXML(data, filename) {
    const docInfo = extractDocumentInfo(data);
    const items = extractItems(data);
    const totals = calculateTotals(items);

    const fileUuid = uuidv4();
    const docUuid = uuidv4();

    // Данные контрагентов с fallback
    const sellerInn = docInfo.sellerInn || '0000000000';
    const sellerKpp = docInfo.sellerKpp || '000000000';
    const buyerInn = docInfo.buyerInn || '0000000000';
    const buyerKpp = docInfo.buyerKpp || '000000000';

    const docNumber = docInfo.docNumber || '1';
    const docDateStr = docInfo.docDate || formatDate(new Date());
    const fileDate = formatFileDate(docDateStr);

    const fileId = `ON_NSCHFDOPPR_${buyerInn}_${buyerKpp}_${sellerInn}_${sellerKpp}_${fileDate}_${fileUuid}`;

    const sellerName = escapeXml(docInfo.sellerName || 'Организация');
    const sellerAddress = escapeXml(docInfo.sellerAddress || '');
    const buyerName = escapeXml(docInfo.buyerName || 'Покупатель');
    const buyerAddress = escapeXml(docInfo.buyerAddress || '');

    // Формируем XML
    const xml = [];
    xml.push('<?xml version="1.0" encoding="UTF-8"?>');
    xml.push(`<Файл xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ИдФайл="${fileId}" ВерсФорм="${XML_SETTINGS.version}" ВерсПрог="UPD Converter Web 2.0">`);

    xml.push(`\t<Документ КНД="1115131" Функция="${XML_SETTINGS.function}" ПоФактХЖ="Документ об отгрузке товаров (выполнении работ), передаче имущественных прав (документ об оказании услуг)" НаимДокОпр="Документ об отгрузке товаров (выполнении работ), передаче имущественных прав (Документ об оказании услуг)" ДатаИнфПр="${docDateStr}" ВремИнфПр="12.00.00" НаимЭконСубСост="${sellerName}, ИНН/КПП ${sellerInn}/${sellerKpp}">`);

    // СвСчФакт
    xml.push(`\t\t<СвСчФакт НомерДок="${escapeXml(docNumber)}" ДатаДок="${docDateStr}">`);

    // Продавец
    xml.push('\t\t\t<СвПрод>');
    xml.push('\t\t\t\t<ИдСв>');
    xml.push(`\t\t\t\t\t<СвЮЛУч НаимОрг="${sellerName}" ИННЮЛ="${sellerInn}" КПП="${sellerKpp}"/>`);
    xml.push('\t\t\t\t</ИдСв>');
    xml.push('\t\t\t\t<Адрес>');
    xml.push(`\t\t\t\t\t<АдрИнф КодСтр="643" НаимСтран="РОССИЯ" АдрТекст="${sellerAddress}"/>`);
    xml.push('\t\t\t\t</Адрес>');
    xml.push('\t\t\t</СвПрод>');

    // Грузоотправитель
    xml.push('\t\t\t<ГрузОт>');
    xml.push('\t\t\t\t<ОнЖе>он же</ОнЖе>');
    xml.push('\t\t\t</ГрузОт>');

    // Грузополучатель
    xml.push('\t\t\t<ГрузПолуч>');
    xml.push('\t\t\t\t<ИдСв>');
    xml.push(`\t\t\t\t\t<СвЮЛУч НаимОрг="${buyerName}" ИННЮЛ="${buyerInn}" КПП="${buyerKpp}"/>`);
    xml.push('\t\t\t\t</ИдСв>');
    xml.push('\t\t\t\t<Адрес>');
    xml.push(`\t\t\t\t\t<АдрИнф КодСтр="643" НаимСтран="РОССИЯ" АдрТекст="${buyerAddress}"/>`);
    xml.push('\t\t\t\t</Адрес>');
    xml.push('\t\t\t</ГрузПолуч>');

    // Документ подтверждения
    xml.push(`\t\t\t<ДокПодтвОтгрНом РеквНаимДок="Универсальный передаточный документ" РеквНомерДок="${escapeXml(docNumber)}" РеквДатаДок="${docDateStr}"/>`);

    // Покупатель
    xml.push('\t\t\t<СвПокуп>');
    xml.push('\t\t\t\t<ИдСв>');
    xml.push(`\t\t\t\t\t<СвЮЛУч НаимОрг="${buyerName}" ИННЮЛ="${buyerInn}" КПП="${buyerKpp}"/>`);
    xml.push('\t\t\t\t</ИдСв>');
    xml.push('\t\t\t\t<Адрес>');
    xml.push(`\t\t\t\t\t<АдрИнф КодСтр="643" НаимСтран="РОССИЯ" АдрТекст="${buyerAddress}"/>`);
    xml.push('\t\t\t\t</Адрес>');
    xml.push('\t\t\t</СвПокуп>');

    // Валюта
    xml.push(`\t\t\t<ДенИзм КодОКВ="${XML_SETTINGS.currencyCode}" НаимОКВ="${XML_SETTINGS.currencyName}" КурсВал="1.00"/>`);

    // Дополнительная информация
    xml.push('\t\t\t<ИнфПолФХЖ1>');
    xml.push(`\t\t\t\t<ТекстИнф Идентиф="ИдентификаторДокументаОснования" Значен="${docUuid}"/>`);
    xml.push('\t\t\t\t<ТекстИнф Идентиф="ВидСчетаФактуры" Значен="Реализация"/>');
    xml.push('\t\t\t\t<ТекстИнф Идентиф="ТолькоУслуги" Значен="false"/>');
    xml.push(`\t\t\t\t<ТекстИнф Идентиф="ДокументОбОтгрузке" Значен="№ п/п 1-${items.length} № ${escapeXml(docNumber)} от ${docDateStr} г."/>`);
    xml.push('\t\t\t</ИнфПолФХЖ1>');

    xml.push('\t\t</СвСчФакт>');

    // Таблица товаров
    xml.push('\t\t<ТаблСчФакт>');

    for (const item of items) {
        const itemUuid = uuidv4();
        const itemName = escapeXml(item.name);
        const okei = item.okeiCode || 796;
        const unit = escapeXml(item.unit || 'шт');
        const qty = parseFloat(item.quantity) || 0;
        const quantity = qty === parseInt(qty) ? String(parseInt(qty)) : formatNumber(qty, 2);
        const price = formatNumber(item.price, 2);
        const amountNoVat = formatNumber(item.amountNoVat, 2);
        const vatAmount = formatNumber(item.vatAmount, 2);
        const amountWithVat = formatNumber(item.amountWithVat, 2);
        const article = escapeXml(item.article);

        let vatRate = item.vatRate || 20;
        let vatRateStr;
        if (typeof vatRate === 'string' && vatRate.includes('%')) {
            vatRateStr = vatRate;
        } else if (typeof vatRate === 'number' && vatRate < 1) {
            vatRateStr = `${Math.round(vatRate * 100)}%`;
        } else {
            vatRateStr = `${Math.round(parseFloat(vatRate) || 20)}%`;
        }

        xml.push(`\t\t\t<СведТов НомСтр="${item.num}" НаимТов="${itemName}" ОКЕИ_Тов="${okei}" НаимЕдИзм="${unit}" КолТов="${quantity}" ЦенаТов="${price}" СтТовБезНДС="${amountNoVat}" НалСт="${vatRateStr}" СтТовУчНал="${amountWithVat}">`);
        xml.push(`\t\t\t\t<ДопСведТов ПрТовРаб="1" КодТов="${article}">`);
        xml.push(`\t\t\t\t\t<КрНаимСтрПр>${XML_SETTINGS.defaultCountry}</КрНаимСтрПр>`);
        xml.push('\t\t\t\t</ДопСведТов>');
        xml.push('\t\t\t\t<Акциз>');
        xml.push('\t\t\t\t\t<БезАкциз>без акциза</БезАкциз>');
        xml.push('\t\t\t\t</Акциз>');
        xml.push('\t\t\t\t<СумНал>');
        xml.push(`\t\t\t\t\t<СумНал>${vatAmount}</СумНал>`);
        xml.push('\t\t\t\t</СумНал>');
        xml.push(`\t\t\t\t<ИнфПолФХЖ2 Идентиф="Для1С_Идентификатор" Значен="${itemUuid}##"/>`);
        xml.push(`\t\t\t\t<ИнфПолФХЖ2 Идентиф="Для1С_Наименование" Значен="${itemName}"/>`);
        xml.push(`\t\t\t\t<ИнфПолФХЖ2 Идентиф="Для1С_ЕдиницаИзмерения" Значен="${unit}"/>`);
        xml.push(`\t\t\t\t<ИнфПолФХЖ2 Идентиф="Для1С_ЕдиницаИзмеренияКод" Значен="${okei}"/>`);
        xml.push(`\t\t\t\t<ИнфПолФХЖ2 Идентиф="Для1С_Артикул" Значен="${article}"/>`);
        xml.push('\t\t\t\t<ИнфПолФХЖ2 Идентиф="Для1С_СтавкаНДС" Значен="20"/>');
        xml.push(`\t\t\t\t<ИнфПолФХЖ2 Идентиф="ИД" Значен="${itemUuid}##"/>`);
        xml.push('\t\t\t</СведТов>');
    }

    // Итоги
    const totalNoVat = formatNumber(totals.totalNoVat, 2);
    const totalVat = formatNumber(totals.totalVat, 2);
    const totalWithVat = formatNumber(totals.totalWithVat, 2);
    const totalQty = Math.round(totals.totalQuantity);

    xml.push(`\t\t\t<ВсегоОпл СтТовБезНДСВсего="${totalNoVat}" СтТовУчНалВсего="${totalWithVat}" КолНеттоВс="${totalQty}">`);
    xml.push('\t\t\t\t<СумНалВсего>');
    xml.push(`\t\t\t\t\t<СумНал>${totalVat}</СумНал>`);
    xml.push('\t\t\t\t</СумНалВсего>');
    xml.push('\t\t\t</ВсегоОпл>');

    xml.push('\t\t</ТаблСчФакт>');

    // Сведения о передаче
    xml.push('\t\t<СвПродПер>');
    xml.push(`\t\t\t<СвПер СодОпер="Товары переданы" ВидОпер="Продажа" ДатаПер="${docDateStr}">`);
    xml.push(`\t\t\t\t<ОснПер РеквНаимДок="Универсальный передаточный документ" РеквНомерДок="${escapeXml(docNumber)}" РеквДатаДок="${docDateStr}"/>`);
    xml.push('\t\t\t</СвПер>');
    xml.push('\t\t\t<ИнфПолФХЖ3>');
    xml.push(`\t\t\t\t<ТекстИнф Идентиф="ИдентификаторДокументаОснования" Значен="${docUuid}"/>`);
    xml.push('\t\t\t</ИнфПолФХЖ3>');
    xml.push('\t\t</СвПродПер>');

    // Подписант
    xml.push('\t\t<Подписант ТипПодпис="2" СпосПодтПолном="1">');
    xml.push('\t\t\t<ФИО Фамилия="-" Имя="-"/>');
    xml.push('\t\t</Подписант>');

    xml.push('\t</Документ>');
    xml.push('</Файл>');

    return xml.join('\n');
}

/**
 * Конвертирует Excel файл в XML
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

                console.log(`Загружен файл: ${file.name}`);
                console.log(`Строк в Excel: ${jsonData.length}`);

                const xml = generateXML(jsonData, file.name);
                resolve(xml);
            } catch (error) {
                console.error('Ошибка конвертации:', error);
                reject(error);
            }
        };

        reader.onerror = () => reject(new Error('Ошибка чтения файла'));
        reader.readAsArrayBuffer(file);
    });
}

/**
 * Скачивает XML файл
 */
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
