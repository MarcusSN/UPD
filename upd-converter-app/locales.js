/**
 * Локализация интерфейса
 * Поддерживаемые языки: ru, en, zh
 */

const locales = {
    ru: {
        // Header
        appTitle: 'УПД Конвертер',
        settings: 'Настройки',
        
        // Dropzone
        dropzoneTitle: 'Перетащите файлы Excel сюда',
        dropzoneSubtitle: 'или нажмите для выбора',
        dropzoneHint: 'Поддерживаются .xlsx и .xls',
        
        // Files section
        filesToConvert: 'Файлы для конвертации',
        addMore: '+ Добавить',
        fileName: 'Имя файла',
        fileSize: 'Размер',
        status: 'Статус',
        clearAll: 'Очистить всё',
        totalFiles: 'Всего: {count} файлов',
        
        // Status
        statusWaiting: '⏳ Ожидает',
        statusProcessing: '⏳ Обработка...',
        statusSuccess: '✅ Готово',
        statusError: '❌ Ошибка',
        
        // Output
        saveXmlTo: 'Сохранять XML в:',
        notSelected: 'Не выбрано',
        browse: 'Обзор',
        
        // Progress
        converting: 'Конвертация...',
        
        // Action
        convert: 'Конвертировать',
        convertNFiles: 'Конвертировать {count} файлов',
        
        // Results
        conversionComplete: 'Конвертация завершена',
        conversionError: 'Ошибка конвертации',
        successCount: '{success} из {total} файлов успешно',
        successWithErrors: '{success} из {total} файлов успешно, {errors} с ошибками',
        allFailed: 'Все файлы завершились с ошибками',
        errors: 'Ошибки:',
        openFolder: 'Открыть папку с XML',
        convertMore: 'Конвертировать ещё',
        
        // Settings
        settingsTitle: 'Настройки',
        settingsBasic: 'Основные',
        openFolderAfter: 'Открывать папку после конвертации',
        soundOnComplete: 'Звук при завершении',
        xmlFormat: 'Формат XML',
        encoding: 'Кодировка:',
        defaultCountry: 'Страна товара:',
        advancedSettings: 'Расширенные настройки (маппинг колонок)',
        advancedWarning: '⚠️ Изменяйте только если данные читаются неправильно',
        document: 'Документ',
        docNumber: 'Номер документа:',
        docDate: 'Дата документа:',
        seller: 'Продавец',
        buyer: 'Покупатель',
        name: 'Наименование:',
        innKpp: 'ИНН/КПП:',
        items: 'Товары',
        rowNum: '№ п/п:',
        itemName: 'Наименование:',
        okeiCode: 'Код ОКЕИ:',
        unit: 'Ед. измерения:',
        quantity: 'Количество:',
        price: 'Цена:',
        amountNoVat: 'Сумма без НДС:',
        vatRate: 'Ставка НДС:',
        vatAmount: 'Сумма НДС:',
        amountWithVat: 'Сумма с НДС:',
        resetDefaults: 'Сбросить по умолчанию',
        cancel: 'Отмена',
        save: 'Сохранить',
        
        // Preview
        preview: 'Просмотр',
        previewXml: 'Превью XML',
        close: 'Закрыть',
        
        // Language
        language: 'Язык',
        langRu: 'Русский',
        langEn: 'English',
        langZh: '中文'
    },
    
    en: {
        // Header
        appTitle: 'UPD Converter',
        settings: 'Settings',
        
        // Dropzone
        dropzoneTitle: 'Drag & drop Excel files here',
        dropzoneSubtitle: 'or click to select',
        dropzoneHint: 'Supports .xlsx and .xls',
        
        // Files section
        filesToConvert: 'Files to convert',
        addMore: '+ Add more',
        fileName: 'File name',
        fileSize: 'Size',
        status: 'Status',
        clearAll: 'Clear all',
        totalFiles: 'Total: {count} files',
        
        // Status
        statusWaiting: '⏳ Waiting',
        statusProcessing: '⏳ Processing...',
        statusSuccess: '✅ Done',
        statusError: '❌ Error',
        
        // Output
        saveXmlTo: 'Save XML to:',
        notSelected: 'Not selected',
        browse: 'Browse',
        
        // Progress
        converting: 'Converting...',
        
        // Action
        convert: 'Convert',
        convertNFiles: 'Convert {count} files',
        
        // Results
        conversionComplete: 'Conversion complete',
        conversionError: 'Conversion error',
        successCount: '{success} of {total} files successful',
        successWithErrors: '{success} of {total} files successful, {errors} with errors',
        allFailed: 'All files failed',
        errors: 'Errors:',
        openFolder: 'Open XML folder',
        convertMore: 'Convert more',
        
        // Settings
        settingsTitle: 'Settings',
        settingsBasic: 'Basic',
        openFolderAfter: 'Open folder after conversion',
        soundOnComplete: 'Sound on complete',
        xmlFormat: 'XML Format',
        encoding: 'Encoding:',
        defaultCountry: 'Product country:',
        advancedSettings: 'Advanced settings (column mapping)',
        advancedWarning: '⚠️ Change only if data is read incorrectly',
        document: 'Document',
        docNumber: 'Document number:',
        docDate: 'Document date:',
        seller: 'Seller',
        buyer: 'Buyer',
        name: 'Name:',
        innKpp: 'INN/KPP:',
        items: 'Items',
        rowNum: 'Row #:',
        itemName: 'Name:',
        okeiCode: 'OKEI code:',
        unit: 'Unit:',
        quantity: 'Quantity:',
        price: 'Price:',
        amountNoVat: 'Amount w/o VAT:',
        vatRate: 'VAT rate:',
        vatAmount: 'VAT amount:',
        amountWithVat: 'Amount with VAT:',
        resetDefaults: 'Reset to defaults',
        cancel: 'Cancel',
        save: 'Save',
        
        // Preview
        preview: 'Preview',
        previewXml: 'XML Preview',
        close: 'Close',
        
        // Language
        language: 'Language',
        langRu: 'Русский',
        langEn: 'English',
        langZh: '中文'
    },
    
    zh: {
        // Header
        appTitle: 'UPD 转换器',
        settings: '设置',
        
        // Dropzone
        dropzoneTitle: '将Excel文件拖放到此处',
        dropzoneSubtitle: '或点击选择文件',
        dropzoneHint: '支持 .xlsx 和 .xls 格式',
        
        // Files section
        filesToConvert: '待转换文件',
        addMore: '+ 添加更多',
        fileName: '文件名',
        fileSize: '大小',
        status: '状态',
        clearAll: '清除全部',
        totalFiles: '共 {count} 个文件',
        
        // Status
        statusWaiting: '⏳ 等待中',
        statusProcessing: '⏳ 处理中...',
        statusSuccess: '✅ 完成',
        statusError: '❌ 错误',
        
        // Output
        saveXmlTo: 'XML保存位置：',
        notSelected: '未选择',
        browse: '浏览',
        
        // Progress
        converting: '转换中...',
        
        // Action
        convert: '转换',
        convertNFiles: '转换 {count} 个文件',
        
        // Results
        conversionComplete: '转换完成',
        conversionError: '转换错误',
        successCount: '{success}/{total} 个文件成功',
        successWithErrors: '{success}/{total} 个文件成功，{errors} 个有错误',
        allFailed: '所有文件都失败了',
        errors: '错误：',
        openFolder: '打开XML文件夹',
        convertMore: '继续转换',
        
        // Settings
        settingsTitle: '设置',
        settingsBasic: '基本设置',
        openFolderAfter: '转换后打开文件夹',
        soundOnComplete: '完成时播放声音',
        xmlFormat: 'XML格式',
        encoding: '编码：',
        defaultCountry: '商品国家：',
        advancedSettings: '高级设置（列映射）',
        advancedWarning: '⚠️ 仅在数据读取不正确时更改',
        document: '文档',
        docNumber: '文档编号：',
        docDate: '文档日期：',
        seller: '卖方',
        buyer: '买方',
        name: '名称：',
        innKpp: 'INN/KPP：',
        items: '商品',
        rowNum: '序号：',
        itemName: '名称：',
        okeiCode: 'OKEI代码：',
        unit: '单位：',
        quantity: '数量：',
        price: '价格：',
        amountNoVat: '不含税金额：',
        vatRate: '增值税税率：',
        vatAmount: '增值税额：',
        amountWithVat: '含税金额：',
        resetDefaults: '恢复默认',
        cancel: '取消',
        save: '保存',
        
        // Preview
        preview: '预览',
        previewXml: 'XML预览',
        close: '关闭',
        
        // Language
        language: '语言',
        langRu: 'Русский',
        langEn: 'English',
        langZh: '中文'
    }
};

// Текущий язык
let currentLang = 'ru';

/**
 * Получить перевод по ключу
 */
function t(key, params = {}) {
    let text = locales[currentLang]?.[key] || locales['ru'][key] || key;
    
    // Подстановка параметров {param}
    Object.keys(params).forEach(param => {
        text = text.replace(`{${param}}`, params[param]);
    });
    
    return text;
}

/**
 * Установить язык
 */
function setLanguage(lang) {
    if (locales[lang]) {
        currentLang = lang;
        updateUI();
        return true;
    }
    return false;
}

/**
 * Получить текущий язык
 */
function getLanguage() {
    return currentLang;
}

/**
 * Получить список доступных языков
 */
function getAvailableLanguages() {
    return Object.keys(locales);
}

/**
 * Обновить все элементы интерфейса
 */
function updateUI() {
    // Обновляем все элементы с data-i18n атрибутом
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.textContent = t(key);
    });
    
    // Обновляем placeholder'ы
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        el.placeholder = t(key);
    });
    
    // Обновляем title'ы
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        el.title = t(key);
    });
}

// Экспорт для использования в других файлах
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { t, setLanguage, getLanguage, getAvailableLanguages, locales };
}
