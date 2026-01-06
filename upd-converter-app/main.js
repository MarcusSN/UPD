const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const converter = require('./converter');

let mainWindow;
let config = loadConfig();

function loadConfig() {
    const configPath = path.join(app.getPath('userData'), 'config.json');
    const defaultConfig = {
        outputFolder: '',
        openFolderAfter: true,
        soundOnComplete: false,
        language: 'ru',
        xmlEncoding: 'windows-1251',
        defaultCountry: 'КИТАЙ',
        excelMapping: {
            document: {
                numberSearchText: 'Счет-фактура №',
                numberColumn: 15,
                dateSearchText: 'от',
                dateColumn: 24
            },
            seller: {
                nameSearchText: 'Продавец:',
                nameColumn: 17,
                innKppSearchText: 'ИНН/КПП продавца',
                innKppColumn: 17
            },
            buyer: {
                nameSearchText: 'Покупатель:',
                nameColumn: 56,
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
        },
        xmlSettings: {
            version: '5.03',
            function: 'ДОП',
            currencyCode: '643',
            currencyName: 'Российский рубль'
        },
        defaults: {
            vatRate: 20,
            unit: 'шт',
            okeiCode: 796
        }
    };

    try {
        if (fs.existsSync(configPath)) {
            const savedConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            return { ...defaultConfig, ...savedConfig };
        }
    } catch (e) {
        console.error('Error loading config:', e);
    }
    return defaultConfig;
}

function saveConfig(newConfig) {
    const configPath = path.join(app.getPath('userData'), 'config.json');
    try {
        config = { ...config, ...newConfig };
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
        return true;
    } catch (e) {
        console.error('Error saving config:', e);
        return false;
    }
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 900,
        height: 700,
        minWidth: 700,
        minHeight: 500,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        icon: path.join(__dirname, 'assets', 'icon.png'),
        title: 'УПД Конвертер',
        backgroundColor: '#FAF9F7'
    });

    mainWindow.loadFile('index.html');
    
    // Убираем стандартное меню
    mainWindow.setMenuBarVisibility(false);

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// IPC обработчики

ipcMain.handle('select-files', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile', 'multiSelections'],
        filters: [
            { name: 'Excel файлы', extensions: ['xlsx', 'xls'] }
        ]
    });
    return result.filePaths;
});

ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory']
    });
    return result.filePaths[0] || null;
});

ipcMain.handle('get-config', () => {
    return config;
});

ipcMain.handle('save-config', (event, newConfig) => {
    return saveConfig(newConfig);
});

ipcMain.handle('convert-files', async (event, filePaths, outputFolder) => {
    const results = [];
    
    for (let i = 0; i < filePaths.length; i++) {
        const filePath = filePaths[i];
        const fileName = path.basename(filePath);
        
        // Отправляем прогресс
        mainWindow.webContents.send('conversion-progress', {
            current: i + 1,
            total: filePaths.length,
            fileName: fileName,
            status: 'processing'
        });

        try {
            const outputPath = path.join(
                outputFolder,
                path.basename(filePath, path.extname(filePath)) + '.xml'
            );
            
            const result = await converter.convertFile(filePath, outputPath, config);
            
            results.push({
                inputFile: filePath,
                fileName: fileName,
                outputFile: outputPath,
                status: 'success',
                fileId: result.fileId
            });
        } catch (error) {
            results.push({
                inputFile: filePath,
                fileName: fileName,
                status: 'error',
                error: error.message
            });
        }
    }

    return results;
});

ipcMain.handle('open-folder', (event, folderPath) => {
    shell.openPath(folderPath);
});

ipcMain.handle('preview-xml', async (event, filePath, outputFolder) => {
    try {
        const outputPath = path.join(
            outputFolder,
            path.basename(filePath, path.extname(filePath)) + '.xml'
        );
        
        // Если файл уже существует, читаем его
        if (fs.existsSync(outputPath)) {
            return fs.readFileSync(outputPath, 'utf8');
        }
        
        // Иначе генерируем превью
        const result = await converter.generateXmlPreview(filePath, config);
        return result.xml;
    } catch (error) {
        throw new Error(`Ошибка превью: ${error.message}`);
    }
});

ipcMain.handle('get-file-info', async (event, filePath) => {
    try {
        const stats = fs.statSync(filePath);
        return {
            name: path.basename(filePath),
            path: filePath,
            size: stats.size,
            sizeFormatted: formatFileSize(stats.size)
        };
    } catch (error) {
        return null;
    }
});

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' Б';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' КБ';
    return (bytes / (1024 * 1024)).toFixed(1) + ' МБ';
}
