/**
 * УПД Конвертер - UI логика
 */

let selectedFiles = [];

// DOM элементы
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const selectBtn = document.getElementById('select-btn');
const filesList = document.getElementById('files-list');
const filesItems = document.getElementById('files-items');
const convertBtn = document.getElementById('convert-btn');
const clearBtn = document.getElementById('clear-btn');
const results = document.getElementById('results');
const resultsContent = document.getElementById('results-content');
const progress = document.getElementById('progress');
const progressFill = document.getElementById('progress-fill');
const progressText = document.getElementById('progress-text');

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
});

function setupEventListeners() {
    // Drag & Drop
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', handleDragOver);
    dropZone.addEventListener('dragleave', handleDragLeave);
    dropZone.addEventListener('drop', handleDrop);

    // Кнопки
    selectBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        fileInput.click();
    });
    fileInput.addEventListener('change', handleFileSelect);
    convertBtn.addEventListener('click', handleConvert);
    clearBtn.addEventListener('click', clearFiles);
}

function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('dragover');

    const files = Array.from(e.dataTransfer.files).filter(file =>
        file.name.endsWith('.xlsx') || file.name.endsWith('.xls')
    );

    if (files.length > 0) {
        addFiles(files);
    }
}

function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    addFiles(files);
}

function addFiles(files) {
    selectedFiles = [...selectedFiles, ...files];
    updateFilesList();
    showSection(filesList);
    hideSection(results);
}

function updateFilesList() {
    filesItems.innerHTML = '';

    selectedFiles.forEach((file, index) => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span class="file-icon">📄</span>
            <div class="file-info">
                <div class="file-name">${escapeHtml(file.name)}</div>
                <div class="file-size">${formatFileSize(file.size)}</div>
            </div>
            <button onclick="removeFile(${index})" class="btn-secondary" style="padding: 8px 16px;">Удалить</button>
        `;
        filesItems.appendChild(li);
    });
}

function removeFile(index) {
    selectedFiles.splice(index, 1);
    updateFilesList();

    if (selectedFiles.length === 0) {
        hideSection(filesList);
    }
}

function clearFiles() {
    selectedFiles = [];
    fileInput.value = '';
    hideSection(filesList);
    hideSection(results);
}

async function handleConvert() {
    if (selectedFiles.length === 0) return;

    showSection(progress);
    hideSection(results);
    resultsContent.innerHTML = '';

    const totalFiles = selectedFiles.length;
    let processedFiles = 0;

    for (const file of selectedFiles) {
        try {
            progressText.textContent = `Конвертация ${file.name}...`;
            const xml = await convertExcelToXML(file);

            // Скачиваем XML
            downloadXML(xml, file.name);

            // Показываем успех
            addResult(file.name, 'success', '✅ Успешно сконвертирован');
        } catch (error) {
            console.error('Ошибка конвертации:', error);
            addResult(file.name, 'error', '❌ Ошибка: ' + error.message);
        }

        processedFiles++;
        const percent = (processedFiles / totalFiles) * 100;
        progressFill.style.width = percent + '%';
    }

    progressText.textContent = `Готово! Обработано файлов: ${totalFiles}`;

    setTimeout(() => {
        hideSection(progress);
        showSection(results);
    }, 1000);
}

function addResult(filename, status, message) {
    if (resultsContent.children.length === 0) {
        showSection(results);
    }

    const div = document.createElement('div');
    div.className = `result-item ${status}`;
    div.innerHTML = `
        <div class="result-info">
            <span>${status === 'success' ? '✅' : '❌'}</span>
            <div>
                <div style="font-weight: 500;">${escapeHtml(filename)}</div>
                <div style="font-size: 0.875rem; color: var(--text-secondary);">${message}</div>
            </div>
        </div>
    `;
    resultsContent.appendChild(div);
}

function showSection(element) {
    element.style.display = 'block';
}

function hideSection(element) {
    element.style.display = 'none';
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Б';
    const k = 1024;
    const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Предотвращение drag & drop на всей странице
window.addEventListener('dragover', (e) => {
    e.preventDefault();
}, false);

window.addEventListener('drop', (e) => {
    e.preventDefault();
}, false);
