const { ipcRenderer } = require('electron');

class FeedbackRenderer {
    constructor() {
        this.isCommandSectionVisible = false;
        this.isCommandRunning = false;
        this.commandLogs = '';
        this.projectDirectory = '';
        this.prompt = '';
        
        this.initializeElements();
        this.setupEventListeners();
        this.loadInitialData();
        this.loadSettings();
    }

    initializeElements() {
        this.elements = {
            toggleCommand: document.getElementById('toggleCommand'),
            commandSection: document.getElementById('commandSection'),
            workingDir: document.getElementById('workingDir'),
            commandInput: document.getElementById('commandInput'),
            runBtn: document.getElementById('runBtn'),
            autoExecute: document.getElementById('autoExecute'),
            saveConfig: document.getElementById('saveConfig'),
            console: document.getElementById('console'),
            clearBtn: document.getElementById('clearBtn'),
            description: document.getElementById('description'),
            feedbackInput: document.getElementById('feedbackInput'),
            submitBtn: document.getElementById('submitBtn')
        };
    }

    setupEventListeners() {
        // Toggle command section
        this.elements.toggleCommand.addEventListener('click', () => {
            this.toggleCommandSection();
        });

        // Run command
        this.elements.runBtn.addEventListener('click', () => {
            if (this.isCommandRunning) {
                this.stopCommand();
            } else {
                this.runCommand();
            }
        });

        // Command input enter key
        this.elements.commandInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !this.isCommandRunning) {
                this.runCommand();
            }
        });

        // Clear console
        this.elements.clearBtn.addEventListener('click', () => {
            this.clearConsole();
        });

        // Save configuration
        this.elements.saveConfig.addEventListener('click', () => {
            this.saveConfiguration();
        });

        // Submit feedback
        this.elements.submitBtn.addEventListener('click', () => {
            this.submitFeedback();
        });

        // Feedback input Ctrl+Enter
        this.elements.feedbackInput.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                this.submitFeedback();
            }
        });

        // Listen for command output
        ipcRenderer.on('command-output', (event, output) => {
            this.appendToConsole(output);
        });

        // Auto-save settings on change
        this.elements.commandInput.addEventListener('input', () => {
            this.saveSettings();
        });

        this.elements.autoExecute.addEventListener('change', () => {
            this.saveSettings();
        });
    }

    async loadInitialData() {
        try {
            const data = await ipcRenderer.invoke('get-initial-data');
            this.projectDirectory = data.projectDirectory;
            this.prompt = data.prompt;
            
            this.elements.workingDir.textContent = `Working directory: ${this.formatPath(this.projectDirectory)}`;
            this.elements.description.textContent = this.prompt;
            
            // Focus on feedback input
            this.elements.feedbackInput.focus();
        } catch (error) {
            console.error('Failed to load initial data:', error);
        }
    }

    formatPath(path) {
        if (process.platform === 'win32') {
            // Convert forward slashes to backslashes and capitalize drive letter
            path = path.replace(/\//g, '\\');
            if (path.length >= 2 && path[1] === ':' && /[a-zA-Z]/.test(path[0])) {
                path = path[0].toUpperCase() + path.slice(1);
            }
        }
        return path;
    }

    toggleCommandSection() {
        this.isCommandSectionVisible = !this.isCommandSectionVisible;
        
        if (this.isCommandSectionVisible) {
            this.elements.commandSection.classList.remove('hidden');
            this.elements.toggleCommand.textContent = 'Hide Command Section';
        } else {
            this.elements.commandSection.classList.add('hidden');
            this.elements.toggleCommand.textContent = 'Show Command Section';
        }
        
        this.saveSettings();
    }

    async runCommand() {
        const command = this.elements.commandInput.value.trim();
        if (!command) {
            this.appendToConsole('Please enter a command to run\n');
            return;
        }

        this.isCommandRunning = true;
        this.elements.runBtn.textContent = 'Stop';
        this.elements.runBtn.disabled = false;
        
        this.appendToConsole(`$ ${command}\n`);
        this.commandLogs = '';

        try {
            const result = await ipcRenderer.invoke('run-command', command, this.projectDirectory);
            this.appendToConsole(`\nProcess exited with code ${result.code}\n`);
        } catch (error) {
            this.appendToConsole(`\nError running command: ${error.message}\n`);
        } finally {
            this.isCommandRunning = false;
            this.elements.runBtn.textContent = 'Run';
            this.elements.feedbackInput.focus();
        }
    }

    async stopCommand() {
        try {
            await ipcRenderer.invoke('stop-command');
            this.appendToConsole('\nCommand stopped\n');
        } catch (error) {
            this.appendToConsole(`\nError stopping command: ${error.message}\n`);
        }
        
        this.isCommandRunning = false;
        this.elements.runBtn.textContent = 'Run';
    }

    appendToConsole(text) {
        this.commandLogs += text;
        this.elements.console.textContent += text;
        this.elements.console.scrollTop = this.elements.console.scrollHeight;
    }

    clearConsole() {
        this.commandLogs = '';
        this.elements.console.textContent = '';
    }

    async submitFeedback() {
        const feedback = this.elements.feedbackInput.value.trim();
        
        try {
            await ipcRenderer.invoke('submit-feedback', this.commandLogs, feedback);
        } catch (error) {
            console.error('Failed to submit feedback:', error);
        }
    }

    saveConfiguration() {
        this.saveSettings();
        this.appendToConsole('Configuration saved for this project.\n');
    }

    saveSettings() {
        const settings = {
            command: this.elements.commandInput.value,
            autoExecute: this.elements.autoExecute.checked,
            commandSectionVisible: this.isCommandSectionVisible,
            projectDirectory: this.projectDirectory
        };
        
        localStorage.setItem(`feedback-settings-${this.getProjectHash()}`, JSON.stringify(settings));
    }

    loadSettings() {
        const settingsKey = `feedback-settings-${this.getProjectHash()}`;
        const savedSettings = localStorage.getItem(settingsKey);
        
        if (savedSettings) {
            try {
                const settings = JSON.parse(savedSettings);
                
                this.elements.commandInput.value = settings.command || '';
                this.elements.autoExecute.checked = settings.autoExecute || false;
                
                if (settings.commandSectionVisible) {
                    this.toggleCommandSection();
                }
                
                // Auto-execute if enabled
                if (settings.autoExecute && settings.command) {
                    setTimeout(() => {
                        this.runCommand();
                    }, 500);
                }
            } catch (error) {
                console.error('Failed to load settings:', error);
            }
        }
    }

    getProjectHash() {
        // Simple hash function for project directory
        let hash = 0;
        const str = this.projectDirectory;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(16);
    }
}

// Initialize the renderer when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new FeedbackRenderer();
});