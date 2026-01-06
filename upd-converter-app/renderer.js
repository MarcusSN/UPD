/**
 * Renderer process - UI logic
 */

// Глобальное состояние
let files = [];
let outputFolder = '';
let config = {};
let isConverting = false;

// DOM элементы
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const filesSection = document.getElementById('filesSection');
const filesList = document.getElementById('filesList');
const filesCount = document.getElementById('filesCount');
const outputSection = document.getElementById('outputSection');
const outputPath = document.getElementById('outputPath');
const outputPathText = document.getElementById('outputPathText');
const actionSection = document.getElementById('actionSection');
const convertBtn = document.getElementById('convertBtn');
const progressSection = document.getElementById('progressSection');
const progressFill = document.getElementById('progressFill');
const progressCount = document.getElementById('progressCount');
const resultSection = document.getElementById('resultSection');

// Инициализация
document.addEventListener('DOMContentLoaded', async () => {
    // Загружаем конфиг
    config = await window.electronAPI.getConfig();
    outputFolder = config.outputFolder || '';
    
    // Устанавливаем язык
    if (config.language) {
        setLanguage(config.language);
        updateLangButton(config.language);
    }
    
    if (outputFolder) {
        updateOutputPath(outputFolder);
    }
    
    loadSettingsToUI();
    setupEventListeners();
    setupKeyboardShortcuts();
    setupLanguageSelector();
});

// Настройка обработчиков событий
function setupEventListeners() {
    // Dropzone
    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('dragover', handleDragOver);
    dropzone.addEventListener('dragleave', handleDragLeave);
    dropzone.addEventListener('drop', handleDrop);
    fileInput.addEventListener('change', handleFileSelect);

    // Кнопки
    document.getElementById('addMoreBtn').addEventListener('click', () => fileInput.click());
    document.getElementById('clearAllBtn').addEventListener('click', clearAllFiles);
    document.getElementById('selectFolderBtn').addEventListener('click', selectOutputFolder);
    convertBtn.addEventListener('click', startConversion);
    document.getElementById('openFolderBtn').addEventListener('click', () => {
        window.electronAPI.openFolder(outputFolder);
    });
    document.getElementById('convertMoreBtn').addEventListener('click', resetUI);

    // Настройки
    document.getElementById('settingsBtn').addEventListener('click', openSettings);
    document.getElementById('closeSettingsBtn').addEventListener('click', closeSettings);
    document.getElementById('cancelSettingsBtn').addEventListener('click', closeSettings);
    document.getElementById('saveSettingsBtn').addEventListener('click', saveSettings);
    document.getElementById('advancedToggle').addEventListener('click', toggleAdvancedSettings);
    document.getElementById('resetMappingBtn').addEventListener('click', resetMapping);

    // Превью
    document.getElementById('closePreviewBtn').addEventListener('click', closePreview);
    document.getElementById('closePreviewBtn2').addEventListener('click', closePreview);

    // Подписка на прогресс конвертации
    window.electronAPI.onConversionProgress(handleConversionProgress);
}

// Горячие клавиши
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Ctrl+O - открыть файлы
        if (e.ctrlKey && e.key === 'o') {
            e.preventDefault();
            fileInput.click();
        }
        
        // Enter - конвертировать (если есть файлы)
        if (e.key === 'Enter' && files.length > 0 && outputFolder && !isConverting) {
            e.preventDefault();
            startConversion();
        }
        
        // Escape - закрыть модальные окна
        if (e.key === 'Escape') {
            closeSettings();
            closePreview();
        }
    });
}

// Drag & Drop
function handleDragOver(e) {
    e.preventDefault();
    dropzone.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    dropzone.classList.remove('dragover');
}

async function handleDrop(e) {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    
    const droppedFiles = Array.from(e.dataTransfer.files)
        .filter(f => f.name.endsWith('.xlsx') || f.name.endsWith('.xls'));
    
    if (droppedFiles.length > 0) {
        await addFiles(droppedFiles.map(f => f.path));
    }
}

async function handleFileSelect(e) {
    const selectedFiles = Array.from(e.target.files);
    if (selectedFiles.length > 0) {
        // Для Electron нужно использовать dialog
        const filePaths = await window.electronAPI.selectFiles();
        if (filePaths.length > 0) {
            await addFiles(filePaths);
        }
    }
    fileInput.value = '';
}

// Управление файлами
async function addFiles(filePaths) {
    for (const filePath of filePaths) {
        // Проверяем, не добавлен ли уже файл
        if (files.find(f => f.path === filePath)) continue;
        
        const fileInfo = await window.electronAPI.getFileInfo(filePath);
        if (fileInfo) {
            files.push({
                ...fileInfo,
                status: 'waiting',
                error: null
            });
        }
    }
    
    updateFilesUI();
    
    // Если папка не выбрана, предлагаем выбрать
    if (!outputFolder && files.length > 0) {
        // Используем папку первого файла как дефолтную
        const firstFilePath = files[0].path;
        const defaultFolder = firstFilePath.substring(0, firstFilePath.lastIndexOf('\\')) || 
                              firstFilePath.substring(0, firstFilePath.lastIndexOf('/'));
        outputFolder = defaultFolder;
        updateOutputPath(defaultFolder);
    }
}

function removeFile(index) {
    files.splice(index, 1);
    updateFilesUI();
}

function clearAllFiles() {
    files = [];
    updateFilesUI();
}

function updateFilesUI() {
    if (files.length === 0) {
        filesSection.style.display = 'none';
        outputSection.style.display = 'none';
        actionSection.style.display = 'none';
        resultSection.style.display = 'none';
        dropzone.style.display = 'block';
        return;
    }
    
    dropzone.style.display = 'none';
    filesSection.style.display = 'block';
    outputSection.style.display = 'block';
    actionSection.style.display = 'block';
    resultSection.style.display = 'none';
    
    // Обновляем таблицу файлов
    filesList.innerHTML = files.map((file, index) => `
        <tr>
            <td>
                <div class="file-name">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" stroke-width="2"/>
                        <polyline points="14,2 14,8 20,8" stroke="currentColor" stroke-width="2"/>
                    </svg>
                    <span>${escapeHtml(file.name)}</span>
                </div>
            </td>
            <td class="file-size">${file.sizeFormatted}</td>
            <td>
                <span class="file-status ${file.status}">
                    ${getStatusText(file)}
                </span>
            </td>
            <td class="file-actions">
                ${file.status === 'success' ? `
                    <button class="btn-text" onclick="previewXml(${index})" title="Просмотр XML">👁</button>
                ` : ''}
                ${file.status !== 'processing' ? `
                    <button class="btn-text" onclick="removeFile(${index})" title="Удалить">×</button>
                ` : ''}
            </td>
        </tr>
    `).join('');
    
    // Обновляем счетчик
    filesCount.textContent = `Всего: ${files.length} файлов`;
    
    // Обновляем кнопку конвертации
    convertBtn.innerHTML = `<span class="btn-dot"></span> Конвертировать ${files.length} файлов`;
    convertBtn.disabled = !outputFolder;
}

function getStatusText(file) {
    switch (file.status) {
        case 'waiting': return '⏳ Ожидает';
        case 'processing': return '⏳ Обработка...';
        case 'success': return '✅ Готово';
        case 'error': return `❌ Ошибка`;
        default: return file.status;
    }
}

// Выбор папки
async function selectOutputFolder() {
    const folder = await window.electronAPI.selectFolder();
    if (folder) {
        outputFolder = folder;
        updateOutputPath(folder);
        convertBtn.disabled = false;
        
        // Сохраняем в конфиг
        config.outputFolder = folder;
        await window.electronAPI.saveConfig(config);
    }
}

function updateOutputPath(path) {
    outputPathText.textContent = path;
    outputPath.classList.add('selected');
}

// Конвертация
async function startConversion() {
    if (isConverting || files.length === 0 || !outputFolder) return;
    
    isConverting = true;
    
    // Показываем прогресс
    progressSection.style.display = 'block';
    actionSection.style.display = 'none';
    progressFill.style.width = '0%';
    progressCount.textContent = `0 / ${files.length}`;
    
    // Сбрасываем статусы файлов
    files.forEach(f => {
        f.status = 'waiting';
        f.error = null;
    });
    updateFilesUI();
    
    // Запускаем конвертацию
    const filePaths = files.map(f => f.path);
    const results = await window.electronAPI.convertFiles(filePaths, outputFolder);
    
    // Обновляем статусы файлов
    results.forEach((result, index) => {
        files[index].status = result.status;
        files[index].error = result.error || null;
        files[index].outputFile = result.outputFile || null;
    });
    
    updateFilesUI();
    showResults(results);
    
    isConverting = false;
    progressSection.style.display = 'none';
    
    // Открываем папку если включено
    if (config.openFolderAfter) {
        const successCount = results.filter(r => r.status === 'success').length;
        if (successCount > 0) {
            window.electronAPI.openFolder(outputFolder);
        }
    }
}

function handleConversionProgress(data) {
    const percent = (data.current / data.total) * 100;
    progressFill.style.width = `${percent}%`;
    progressCount.textContent = `${data.current} / ${data.total}`;
    
    // Обновляем статус текущего файла
    const fileIndex = files.findIndex(f => f.name === data.fileName);
    if (fileIndex !== -1) {
        files[fileIndex].status = 'processing';
        updateFilesUI();
    }
}

function showResults(results) {
    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'error').length;
    
    resultSection.style.display = 'block';
    
    const resultIcon = document.getElementById('resultIcon');
    const resultTitle = document.getElementById('resultTitle');
    const resultStats = document.getElementById('resultStats');
    const resultErrors = document.getElementById('resultErrors');
    const errorsList = document.getElementById('errorsList');
    
    if (errorCount === 0) {
        resultIcon.className = 'result-icon success';
        resultIcon.innerHTML = `<svg viewBox="0 0 24 24" fill="none"><polyline points="20,6 9,17 4,12" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
        resultTitle.textContent = 'Конвертация завершена';
        resultStats.textContent = `${successCount} из ${results.length} файлов успешно`;
        resultErrors.style.display = 'none';
    } else if (successCount === 0) {
        resultIcon.className = 'result-icon error';
        resultIcon.innerHTML = `<svg viewBox="0 0 24 24" fill="none"><line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="3"/><line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="3"/></svg>`;
        resultTitle.textContent = 'Ошибка конвертации';
        resultStats.textContent = `Все файлы завершились с ошибками`;
        resultErrors.style.display = 'block';
    } else {
        resultIcon.className = 'result-icon success';
        resultIcon.innerHTML = `<svg viewBox="0 0 24 24" fill="none"><polyline points="20,6 9,17 4,12" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
        resultTitle.textContent = 'Конвертация завершена';
        resultStats.textContent = `${successCount} из ${results.length} файлов успешно, ${errorCount} с ошибками`;
        resultErrors.style.display = 'block';
    }
    
    // Показываем ошибки
    if (errorCount > 0) {
        const errors = results.filter(r => r.status === 'error');
        errorsList.innerHTML = errors.map(e => `
            <li>${escapeHtml(e.fileName)} — ${escapeHtml(e.error)}</li>
        `).join('');
    }
}

function resetUI() {
    files = [];
    updateFilesUI();
    progressSection.style.display = 'none';
    resultSection.style.display = 'none';
    dropzone.style.display = 'block';
}

// Превью XML
async function previewXml(index) {
    const file = files[index];
    
    try {
        const xml = await window.electronAPI.previewXml(file.path, outputFolder);
        
        document.getElementById('previewTitle').textContent = `Превью: ${file.name.replace(/\.(xlsx|xls)$/i, '.xml')}`;
        document.getElementById('xmlPreviewContent').textContent = xml;
        document.getElementById('previewModal').style.display = 'flex';
    } catch (error) {
        alert(`Ошибка превью: ${error.message}`);
    }
}

function closePreview() {
    document.getElementById('previewModal').style.display = 'none';
}

// Настройки
function openSettings() {
    loadSettingsToUI();
    document.getElementById('settingsModal').style.display = 'flex';
}

function closeSettings() {
    document.getElementById('settingsModal').style.display = 'none';
}

function loadSettingsToUI() {
    document.getElementById('openFolderAfter').checked = config.openFolderAfter !== false;
    document.getElementById('soundOnComplete').checked = config.soundOnComplete === true;
    document.getElementById('xmlEncoding').value = config.xmlEncoding || 'windows-1251';
    document.getElementById('defaultCountry').value = config.defaultCountry || 'КИТАЙ';
    
    // Маппинг
    const mapping = config.excelMapping || {};
    document.getElementById('map_doc_number').value = mapping.document?.numberColumn || 15;
    document.getElementById('map_doc_date').value = mapping.document?.dateColumn || 24;
    document.getElementById('map_seller_name').value = mapping.seller?.nameColumn || 17;
    document.getElementById('map_seller_inn').value = mapping.seller?.innKppColumn || 17;
    document.getElementById('map_buyer_name').value = mapping.buyer?.nameColumn || 56;
    document.getElementById('map_buyer_inn').value = mapping.buyer?.innKppColumn || 56;
    document.getElementById('map_item_num').value = mapping.items?.rowNumberColumn || 5;
    document.getElementById('map_item_name').value = mapping.items?.nameColumn || 9;
    document.getElementById('map_item_okei').value = mapping.items?.okeiCodeColumn || 22;
    document.getElementById('map_item_unit').value = mapping.items?.unitColumn || 24;
    document.getElementById('map_item_qty').value = mapping.items?.quantityColumn || 26;
    document.getElementById('map_item_price').value = mapping.items?.priceColumn || 29;
    document.getElementById('map_item_amount').value = mapping.items?.amountNoVatColumn || 39;
    document.getElementById('map_item_vat_rate').value = mapping.items?.vatRateColumn || 51;
    document.getElementById('map_item_vat').value = mapping.items?.vatAmountColumn || 53;
    document.getElementById('map_item_total').value = mapping.items?.amountWithVatColumn || 57;
}

async function saveSettings() {
    config.openFolderAfter = document.getElementById('openFolderAfter').checked;
    config.soundOnComplete = document.getElementById('soundOnComplete').checked;
    config.xmlEncoding = document.getElementById('xmlEncoding').value;
    config.defaultCountry = document.getElementById('defaultCountry').value;
    
    // Маппинг
    config.excelMapping = {
        document: {
            numberSearchText: 'Счет-фактура №',
            numberColumn: parseInt(document.getElementById('map_doc_number').value),
            dateSearchText: 'от',
            dateColumn: parseInt(document.getElementById('map_doc_date').value)
        },
        seller: {
            nameSearchText: 'Продавец:',
            nameColumn: parseInt(document.getElementById('map_seller_name').value),
            innKppSearchText: 'ИНН/КПП продавца',
            innKppColumn: parseInt(document.getElementById('map_seller_inn').value)
        },
        buyer: {
            nameSearchText: 'Покупатель:',
            nameColumn: parseInt(document.getElementById('map_buyer_name').value),
            innKppSearchText: 'ИНН/КПП покупателя',
            innKppColumn: parseInt(document.getElementById('map_buyer_inn').value)
        },
        items: {
            headerSearchText: '№\nп/п',
            rowNumberColumn: parseInt(document.getElementById('map_item_num').value),
            nameColumn: parseInt(document.getElementById('map_item_name').value),
            okeiCodeColumn: parseInt(document.getElementById('map_item_okei').value),
            unitColumn: parseInt(document.getElementById('map_item_unit').value),
            quantityColumn: parseInt(document.getElementById('map_item_qty').value),
            priceColumn: parseInt(document.getElementById('map_item_price').value),
            amountNoVatColumn: parseInt(document.getElementById('map_item_amount').value),
            vatRateColumn: parseInt(document.getElementById('map_item_vat_rate').value),
            vatAmountColumn: parseInt(document.getElementById('map_item_vat').value),
            amountWithVatColumn: parseInt(document.getElementById('map_item_total').value)
        }
    };
    
    await window.electronAPI.saveConfig(config);
    closeSettings();
}

function toggleAdvancedSettings() {
    const toggle = document.getElementById('advancedToggle');
    const advanced = document.getElementById('advancedSettings');
    
    if (advanced.style.display === 'none') {
        advanced.style.display = 'block';
        toggle.classList.add('open');
    } else {
        advanced.style.display = 'none';
        toggle.classList.remove('open');
    }
}

function resetMapping() {
    document.getElementById('map_doc_number').value = 15;
    document.getElementById('map_doc_date').value = 24;
    document.getElementById('map_seller_name').value = 17;
    document.getElementById('map_seller_inn').value = 17;
    document.getElementById('map_buyer_name').value = 56;
    document.getElementById('map_buyer_inn').value = 56;
    document.getElementById('map_item_num').value = 5;
    document.getElementById('map_item_name').value = 9;
    document.getElementById('map_item_okei').value = 22;
    document.getElementById('map_item_unit').value = 24;
    document.getElementById('map_item_qty').value = 26;
    document.getElementById('map_item_price').value = 29;
    document.getElementById('map_item_amount').value = 39;
    document.getElementById('map_item_vat_rate').value = 51;
    document.getElementById('map_item_vat').value = 53;
    document.getElementById('map_item_total').value = 57;
}

// Утилиты
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Экспортируем функции для onclick
window.removeFile = removeFile;
window.previewXml = previewXml;

// =====================
// Локализация
// =====================

const langFlags = {
    ru: '🇷🇺',
    en: '🇬🇧',
    zh: '🇨🇳'
};

function setupLanguageSelector() {
    const langBtn = document.getElementById('langBtn');
    const langDropdown = document.getElementById('langDropdown');
    const langOptions = document.querySelectorAll('.lang-option');
    
    // Открытие/закрытие выпадающего списка
    langBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        langDropdown.classList.toggle('open');
    });
    
    // Закрытие при клике вне
    document.addEventListener('click', () => {
        langDropdown.classList.remove('open');
    });
    
    // Выбор языка
    langOptions.forEach(option => {
        option.addEventListener('click', async () => {
            const lang = option.getAttribute('data-lang');
            setLanguage(lang);
            updateLangButton(lang);
            langDropdown.classList.remove('open');
            
            // Обновляем активный класс
            langOptions.forEach(opt => opt.classList.remove('active'));
            option.classList.add('active');
            
            // Сохраняем в конфиг
            config.language = lang;
            await window.electronAPI.saveConfig(config);
            
            // Обновляем динамические элементы
            updateFilesUI();
        });
    });
    
    // Устанавливаем активный язык
    const currentLang = getLanguage();
    langOptions.forEach(opt => {
        if (opt.getAttribute('data-lang') === currentLang) {
            opt.classList.add('active');
        }
    });
}

function updateLangButton(lang) {
    document.getElementById('currentLangFlag').textContent = langFlags[lang] || '🇷🇺';
}

// Переопределяем getStatusText для локализации
function getStatusText(file) {
    switch (file.status) {
        case 'waiting': return t('statusWaiting');
        case 'processing': return t('statusProcessing');
        case 'success': return t('statusSuccess');
        case 'error': return t('statusError');
        default: return file.status;
    }
}

// Обновляем updateFilesUI для локализации
const originalUpdateFilesUI = updateFilesUI;
updateFilesUI = function() {
    if (files.length === 0) {
        filesSection.style.display = 'none';
        outputSection.style.display = 'none';
        actionSection.style.display = 'none';
        resultSection.style.display = 'none';
        dropzone.style.display = 'block';
        return;
    }
    
    dropzone.style.display = 'none';
    filesSection.style.display = 'block';
    outputSection.style.display = 'block';
    actionSection.style.display = 'block';
    resultSection.style.display = 'none';
    
    // Обновляем таблицу файлов
    filesList.innerHTML = files.map((file, index) => `
        <tr>
            <td>
                <div class="file-name">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" stroke-width="2"/>
                        <polyline points="14,2 14,8 20,8" stroke="currentColor" stroke-width="2"/>
                    </svg>
                    <span>${escapeHtml(file.name)}</span>
                </div>
            </td>
            <td class="file-size">${file.sizeFormatted}</td>
            <td>
                <span class="file-status ${file.status}">
                    ${getStatusText(file)}
                </span>
            </td>
            <td class="file-actions">
                ${file.status === 'success' ? `
                    <button class="btn-text" onclick="previewXml(${index})" title="${t('preview')}">👁</button>
                ` : ''}
                ${file.status !== 'processing' ? `
                    <button class="btn-text" onclick="removeFile(${index})" title="×">×</button>
                ` : ''}
            </td>
        </tr>
    `).join('');
    
    // Обновляем счетчик
    filesCount.textContent = t('totalFiles', { count: files.length });
    
    // Обновляем кнопку конвертации
    convertBtn.innerHTML = `<span class="btn-dot"></span> ${t('convertNFiles', { count: files.length })}`;
    convertBtn.disabled = !outputFolder;
};

// Обновляем showResults для локализации
const originalShowResults = showResults;
showResults = function(results) {
    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'error').length;
    
    resultSection.style.display = 'block';
    
    const resultIcon = document.getElementById('resultIcon');
    const resultTitle = document.getElementById('resultTitle');
    const resultStats = document.getElementById('resultStats');
    const resultErrors = document.getElementById('resultErrors');
    const errorsList = document.getElementById('errorsList');
    
    if (errorCount === 0) {
        resultIcon.className = 'result-icon success';
        resultIcon.innerHTML = `<svg viewBox="0 0 24 24" fill="none"><polyline points="20,6 9,17 4,12" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
        resultTitle.textContent = t('conversionComplete');
        resultStats.textContent = t('successCount', { success: successCount, total: results.length });
        resultErrors.style.display = 'none';
    } else if (successCount === 0) {
        resultIcon.className = 'result-icon error';
        resultIcon.innerHTML = `<svg viewBox="0 0 24 24" fill="none"><line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="3"/><line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="3"/></svg>`;
        resultTitle.textContent = t('conversionError');
        resultStats.textContent = t('allFailed');
        resultErrors.style.display = 'block';
    } else {
        resultIcon.className = 'result-icon success';
        resultIcon.innerHTML = `<svg viewBox="0 0 24 24" fill="none"><polyline points="20,6 9,17 4,12" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
        resultTitle.textContent = t('conversionComplete');
        resultStats.textContent = t('successWithErrors', { success: successCount, total: results.length, errors: errorCount });
        resultErrors.style.display = 'block';
    }
    
    // Показываем ошибки
    if (errorCount > 0) {
        const errors = results.filter(r => r.status === 'error');
        errorsList.innerHTML = errors.map(e => `
            <li>${escapeHtml(e.fileName)} — ${escapeHtml(e.error)}</li>
        `).join('');
    }
};
