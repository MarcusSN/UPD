/**
 * Конвертер УПД из Excel в XML формат для электронного документооборота
 * Формат: ON_NSCHFDOPPR (Документ об отгрузке товаров) версия 5.03
 */

const XLSX = require('xlsx');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

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
    
    // Проверяем формат с русским месяцем: "15 января 2026"
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
    
    // Проверяем формат DD.MM.YYYY
    const ddmmyyyy = dateStr.match(/(\d{2})\.(\d{2})\.(\d{4})/);
    if (ddmmyyyy) {
        return ddmmyyyy[0];
    }
    
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
    const num = parseFloat(value);
    if (isNaN(num)) return '0.00';
    return num.toFixed(decimals);
}

/**
 * Класс конвертера УПД
 */
class UPDConverter {
    constructor(excelPath, config) {
        this.excelPath = excelPath;
        this.config = config;
        this.mapping = config.excelMapping || {};
        this.xmlSettings = config.xmlSettings || {};
        this.defaults = config.defaults || {};
        
        // Загружаем Excel файл
        this.workbook = XLSX.readFile(excelPath);
        this.sheet = this.workbook.Sheets[this.workbook.SheetNames[0]];
        this.data = XLSX.utils.sheet_to_json(this.sheet, { header: 1, defval: null });
    }

    /**
     * Безопасно получает значение ячейки
     */
    getCell(row, col) {
        if (row >= 0 && row < this.data.length) {
            const rowData = this.data[row];
            if (rowData && col >= 0 && col < rowData.length) {
                return rowData[col];
            }
        }
        return null;
    }

    /**
     * Ищет ячейку с текстом, возвращает {row, col}
     */
    findCellByText(searchText, maxRows = null) {
        const rowsToSearch = maxRows ? this.data.slice(0, maxRows) : this.data;
        
        for (let rowIdx = 0; rowIdx < rowsToSearch.length; rowIdx++) {
            const row = rowsToSearch[rowIdx];
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
    findHeaderRow() {
        const searchText = this.mapping.items?.headerSearchText || '№\nп/п';
        
        for (let rowIdx = 0; rowIdx < this.data.length; rowIdx++) {
            const row = this.data[rowIdx];
            if (!row) continue;
            
            for (const cell of row) {
                if (cell && String(cell).includes(searchText)) {
                    return rowIdx;
                }
            }
        }
        return null;
    }

    /**
     * Находит строку начала данных таблицы товаров
     */
    findDataStartRow() {
        const headerRow = this.findHeaderRow();
        if (headerRow === null) return null;

        const itemsCfg = this.mapping.items || {};
        const rowNumCol = itemsCfg.rowNumberColumn || 5;
        const nameCol = itemsCfg.nameColumn || 9;

        for (let rowIdx = headerRow + 1; rowIdx < Math.min(headerRow + 6, this.data.length); rowIdx++) {
            const row = this.data[rowIdx];
            if (!row || row.length <= Math.max(rowNumCol, nameCol)) continue;

            const rowNum = row[rowNumCol];
            const nameVal = row[nameCol];
            
            const isValidName = nameVal !== null && 
                typeof nameVal === 'string' && 
                nameVal.length > 3 && 
                !/^\d+$/.test(nameVal);
            
            if ((rowNum === 1 || String(rowNum) === '1') && isValidName) {
                return rowIdx;
            }
        }
        
        return headerRow + 3;
    }

    /**
     * Извлекает информацию о документе
     */
    extractDocumentInfo() {
        const info = {};
        const docCfg = this.mapping.document || {};
        const sellerCfg = this.mapping.seller || {};
        const buyerCfg = this.mapping.buyer || {};

        // Номер документа
        const { row: docRow } = this.findCellByText(docCfg.numberSearchText || 'Счет-фактура №');
        if (docRow !== null) {
            info.docNumber = this.getCell(docRow, docCfg.numberColumn || 15);
        }

        // Дата документа
        for (let rowIdx = 0; rowIdx < 5; rowIdx++) {
            const row = this.data[rowIdx];
            if (!row) continue;
            
            for (let colIdx = 0; colIdx < row.length; colIdx++) {
                const cell = row[colIdx];
                if (cell && String(cell).trim() === (docCfg.dateSearchText || 'от')) {
                    const dateVal = this.getCell(rowIdx, docCfg.dateColumn || 24);
                    if (dateVal) {
                        info.docDate = parseDate(dateVal);
                        break;
                    }
                }
            }
            if (info.docDate) break;
        }

        // Продавец
        const { row: sellerRow } = this.findCellByText(sellerCfg.nameSearchText || 'Продавец:');
        if (sellerRow !== null) {
            info.sellerName = this.getCell(sellerRow, sellerCfg.nameColumn || 17);
        }

        // Адрес продавца
        for (let rowIdx = 0; rowIdx < 15; rowIdx++) {
            const row = this.data[rowIdx];
            if (!row) continue;
            
            for (let colIdx = 0; colIdx < Math.min(10, row.length); colIdx++) {
                const cell = row[colIdx];
                if (cell && String(cell).includes('Адрес:')) {
                    const addr = this.getCell(rowIdx, sellerCfg.addressColumn || 17);
                    if (addr && !info.sellerAddress) {
                        info.sellerAddress = String(addr).trim();
                    }
                }
            }
        }

        // ИНН/КПП продавца
        const { row: sellerInnRow } = this.findCellByText(sellerCfg.innKppSearchText || 'ИНН/КПП продавца');
        if (sellerInnRow !== null) {
            const innKpp = this.getCell(sellerInnRow, sellerCfg.innKppColumn || 17);
            const parsed = parseInnKpp(innKpp);
            info.sellerInn = parsed.inn;
            info.sellerKpp = parsed.kpp;
        }

        // Покупатель
        const { row: buyerRow } = this.findCellByText(buyerCfg.nameSearchText || 'Покупатель:');
        if (buyerRow !== null) {
            info.buyerName = this.getCell(buyerRow, buyerCfg.nameColumn || 56);
        }

        // Адрес покупателя
        for (let rowIdx = 0; rowIdx < 15; rowIdx++) {
            const row = this.data[rowIdx];
            if (!row) continue;
            
            for (let colIdx = 0; colIdx < row.length; colIdx++) {
                const cell = row[colIdx];
                if (cell && String(cell).includes('Адрес:')) {
                    const addr = this.getCell(rowIdx, buyerCfg.addressColumn || 56);
                    if (addr) {
                        info.buyerAddress = String(addr).trim();
                    }
                }
            }
        }

        // ИНН/КПП покупателя
        const { row: buyerInnRow } = this.findCellByText(buyerCfg.innKppSearchText || 'ИНН/КПП покупателя');
        if (buyerInnRow !== null) {
            const innKpp = this.getCell(buyerInnRow, buyerCfg.innKppColumn || 56);
            const parsed = parseInnKpp(innKpp);
            info.buyerInn = parsed.inn;
            info.buyerKpp = parsed.kpp;
        }

        return info;
    }

    /**
     * Извлекает товарные позиции
     */
    extractItems() {
        const items = [];
        const dataStart = this.findDataStartRow();
        if (dataStart === null) return items;

        const itemsCfg = this.mapping.items || {};
        const cols = {
            rowNum: itemsCfg.rowNumberColumn || 5,
            name: itemsCfg.nameColumn || 9,
            okei: itemsCfg.okeiCodeColumn || 22,
            unit: itemsCfg.unitColumn || 24,
            qty: itemsCfg.quantityColumn || 26,
            price: itemsCfg.priceColumn || 29,
            amountNoVat: itemsCfg.amountNoVatColumn || 39,
            vatRate: itemsCfg.vatRateColumn || 51,
            vatAmount: itemsCfg.vatAmountColumn || 53,
            amountWithVat: itemsCfg.amountWithVatColumn || 57
        };

        for (let rowIdx = dataStart; rowIdx < this.data.length; rowIdx++) {
            const row = this.data[rowIdx];
            if (!row || row.length < Math.max(...Object.values(cols)) + 1) continue;

            const rowNum = row[cols.rowNum];
            if (rowNum === null || (typeof rowNum !== 'number' && isNaN(parseInt(rowNum)))) {
                break;
            }

            const item = {
                num: parseInt(rowNum),
                name: row[cols.name],
                okeiCode: row[cols.okei] || this.defaults.okeiCode || 796,
                unit: row[cols.unit] || this.defaults.unit || 'шт',
                quantity: row[cols.qty],
                price: row[cols.price],
                amountNoVat: row[cols.amountNoVat],
                vatRate: row[cols.vatRate],
                vatAmount: row[cols.vatAmount],
                amountWithVat: row[cols.amountWithVat]
            };
            item.article = extractArticle(item.name);
            items.push(item);
        }

        return items;
    }

    /**
     * Вычисляет итоговые суммы
     */
    extractTotals() {
        const totals = { totalNoVat: 0, totalVat: 0, totalWithVat: 0, totalQuantity: 0 };
        
        for (const item of this.extractItems()) {
            try {
                totals.totalNoVat += parseFloat(item.amountNoVat) || 0;
                totals.totalVat += parseFloat(item.vatAmount) || 0;
                totals.totalWithVat += parseFloat(item.amountWithVat) || 0;
                totals.totalQuantity += parseFloat(item.quantity) || 0;
            } catch (e) {
                // Игнорируем ошибки парсинга
            }
        }
        
        return totals;
    }

    /**
     * Генерирует XML в формате ON_NSCHFDOPPR
     */
    generateXml() {
        const docInfo = this.extractDocumentInfo();
        const items = this.extractItems();
        const totals = this.extractTotals();

        const fileUuid = uuidv4();
        const docUuid = uuidv4();

        const sellerInn = docInfo.sellerInn || '0000000000';
        const sellerKpp = docInfo.sellerKpp || '000000000';
        const buyerInn = docInfo.buyerInn || '0000000000';
        const buyerKpp = docInfo.buyerKpp || '000000000';

        const docNumber = docInfo.docNumber || '1';
        const docDateStr = docInfo.docDate || this.formatDate(new Date());

        // Парсим дату для формирования идентификатора файла
        let dateInfo, fileDate, docDateXml;
        const dateParts = String(docDateStr).split('.');
        if (dateParts.length === 3) {
            dateInfo = docDateStr;
            fileDate = `${dateParts[2]}${dateParts[1]}${dateParts[0]}`;
            docDateXml = docDateStr;
        } else {
            const now = new Date();
            dateInfo = this.formatDate(now);
            fileDate = this.formatFileDate(now);
            docDateXml = dateInfo;
        }

        const timeInfo = '12.00.00';
        const fileId = `ON_NSCHFDOPPR_${buyerInn}_${buyerKpp}_${sellerInn}_${sellerKpp}_${fileDate}_${fileUuid}`;

        const xmlVer = this.xmlSettings.version || '5.03';
        const xmlFunc = this.xmlSettings.function || 'ДОП';
        const currencyCode = this.xmlSettings.currencyCode || '643';
        const currencyName = this.xmlSettings.currencyName || 'Российский рубль';
        const defaultCountry = this.config.defaultCountry || 'КИТАЙ';

        const sellerName = escapeXml(docInfo.sellerName || 'Организация');
        const sellerAddress = escapeXml(docInfo.sellerAddress || '');
        const buyerName = escapeXml(docInfo.buyerName || 'Покупатель');
        const buyerAddress = escapeXml(docInfo.buyerAddress || '');

        // Формируем XML
        const xml = [];
        xml.push('<?xml version="1.0" encoding="windows-1251"?>');
        xml.push(`<Файл xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ИдФайл="${fileId}" ВерсФорм="${xmlVer}" ВерсПрог="UPD Converter 1.0">`);

        xml.push(`\t<Документ КНД="1115131" Функция="${xmlFunc}" ПоФактХЖ="Документ об отгрузке товаров (выполнении работ), передаче имущественных прав (документ об оказании услуг)" НаимДокОпр="Документ об отгрузке товаров (выполнении работ), передаче имущественных прав (Документ об оказании услуг)" ДатаИнфПр="${dateInfo}" ВремИнфПр="${timeInfo}" НаимЭконСубСост="${sellerName}, ИНН/КПП ${sellerInn}/${sellerKpp}">`);

        // СвСчФакт
        xml.push(`\t\t<СвСчФакт НомерДок="${docNumber}" ДатаДок="${docDateXml}">`);

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
        xml.push(`\t\t\t<ДокПодтвОтгрНом РеквНаимДок="Универсальный передаточный документ" РеквНомерДок="${docNumber}" РеквДатаДок="${docDateXml}"/>`);

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
        xml.push(`\t\t\t<ДенИзм КодОКВ="${currencyCode}" НаимОКВ="${currencyName}" КурсВал="1.00"/>`);

        // Дополнительная информация
        xml.push('\t\t\t<ИнфПолФХЖ1>');
        xml.push(`\t\t\t\t<ТекстИнф Идентиф="ИдентификаторДокументаОснования" Значен="${docUuid}"/>`);
        xml.push('\t\t\t\t<ТекстИнф Идентиф="ВидСчетаФактуры" Значен="Реализация"/>');
        xml.push('\t\t\t\t<ТекстИнф Идентиф="ТолькоУслуги" Значен="false"/>');
        xml.push(`\t\t\t\t<ТекстИнф Идентиф="ДокументОбОтгрузке" Значен="№ п/п 1-${items.length} № ${docNumber} от ${docDateXml} г."/>`);
        xml.push('\t\t\t</ИнфПолФХЖ1>');

        xml.push('\t\t</СвСчФакт>');

        // Таблица товаров
        xml.push('\t\t<ТаблСчФакт>');

        for (const item of items) {
            const itemUuid = uuidv4();
            const itemName = escapeXml(item.name || '');
            const okei = item.okeiCode || 796;
            const unit = escapeXml(item.unit || 'шт');
            const qty = item.quantity || 0;
            const quantity = parseFloat(qty) === parseInt(qty) ? String(parseInt(qty)) : formatNumber(qty, 2);
            const price = formatNumber(item.price, 2);
            const amountNoVat = formatNumber(item.amountNoVat, 2);
            const vatAmount = formatNumber(item.vatAmount, 2);
            const amountWithVat = formatNumber(item.amountWithVat, 2);
            const article = escapeXml(item.article || '');

            let vatRate = item.vatRate || 0.2;
            let vatRateStr;
            if (typeof vatRate === 'number' && vatRate < 1) {
                vatRateStr = `${Math.round(vatRate * 100)}%`;
            } else {
                vatRateStr = vatRate ? `${Math.round(vatRate)}%` : '20%';
            }

            xml.push(`\t\t\t<СведТов НомСтр="${item.num}" НаимТов="${itemName}" ОКЕИ_Тов="${okei}" НаимЕдИзм="${unit}" КолТов="${quantity}" ЦенаТов="${price}" СтТовБезНДС="${amountNoVat}" НалСт="${vatRateStr}" СтТовУчНал="${amountWithVat}">`);
            xml.push(`\t\t\t\t<ДопСведТов ПрТовРаб="1" КодТов="${article}">`);
            xml.push(`\t\t\t\t\t<КрНаимСтрПр>${defaultCountry}</КрНаимСтрПр>`);
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
        xml.push(`\t\t\t<СвПер СодОпер="Товары переданы" ВидОпер="Продажа" ДатаПер="${docDateXml}">`);
        xml.push(`\t\t\t\t<ОснПер РеквНаимДок="Универсальный передаточный документ" РеквНомерДок="${docNumber}" РеквДатаДок="${docDateXml}"/>`);
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

        return { xml: xml.join('\n'), fileId };
    }

    formatDate(date) {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}.${month}.${year}`;
    }

    formatFileDate(date) {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${year}${month}${day}`;
    }

    /**
     * Сохраняет XML в файл
     */
    saveXml(outputPath) {
        const { xml, fileId } = this.generateXml();
        
        // Конвертируем в windows-1251
        const iconv = require('iconv-lite');
        const buffer = iconv.encode(xml, 'win1251');
        
        fs.writeFileSync(outputPath, buffer);
        
        return { outputPath, fileId };
    }
}

/**
 * Конвертирует один файл
 */
async function convertFile(inputPath, outputPath, config) {
    const converter = new UPDConverter(inputPath, config);
    return converter.saveXml(outputPath);
}

/**
 * Генерирует превью XML без сохранения
 */
async function generateXmlPreview(inputPath, config) {
    const converter = new UPDConverter(inputPath, config);
    return converter.generateXml();
}

module.exports = {
    convertFile,
    generateXmlPreview,
    UPDConverter
};
