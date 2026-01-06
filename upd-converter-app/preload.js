const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Выбор файлов и папок
    selectFiles: () => ipcRenderer.invoke('select-files'),
    selectFolder: () => ipcRenderer.invoke('select-folder'),
    
    // Конвертация
    convertFiles: (filePaths, outputFolder) => 
        ipcRenderer.invoke('convert-files', filePaths, outputFolder),
    
    // Превью XML
    previewXml: (filePath, outputFolder) => 
        ipcRenderer.invoke('preview-xml', filePath, outputFolder),
    
    // Информация о файле
    getFileInfo: (filePath) => ipcRenderer.invoke('get-file-info', filePath),
    
    // Открыть папку
    openFolder: (folderPath) => ipcRenderer.invoke('open-folder', folderPath),
    
    // Настройки
    getConfig: () => ipcRenderer.invoke('get-config'),
    saveConfig: (config) => ipcRenderer.invoke('save-config', config),
    
    // Подписка на прогресс конвертации
    onConversionProgress: (callback) => {
        ipcRenderer.on('conversion-progress', (event, data) => callback(data));
    },
    
    // Удаление подписки
    removeConversionProgressListener: () => {
        ipcRenderer.removeAllListeners('conversion-progress');
    }
});
