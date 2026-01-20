/**
 * 主应用程序
 * 负责协调各个模块，处理用户交互
 */

class ChartGeneratorApp {
    constructor() {
        // 应用状态
        this.selectedChartType = null;
        this.chartConfig = null;

        // 对话历史
        this.chatHistory = [];

        // 初始化应用
        this.init();
    }

    /**
     * 初始化应用
     */
    init() {
        this.bindEvents();
        this.loadSavedConfig();
        this.initializeChart();
        this.updateClearChatButtonState();
    }

    /**
     * 绑定事件监听器
     */
    bindEvents() {
        // 数据输入相关事件
        document.getElementById('clearDataBtn').addEventListener('click', () => this.clearData());
        document.getElementById('analyzeDataBtn').addEventListener('click', () => this.analyzeData());
        document.getElementById('toggleDataInputBtn').addEventListener('click', () => this.toggleDataInputSection());

        // Header按钮事件
        document.getElementById('configBtn').addEventListener('click', () => this.openConfigModal());
        document.getElementById('fullscreenBtn').addEventListener('click', () => this.toggleFullscreen());

        // AI聊天相关事件
        document.getElementById('sendChatBtn').addEventListener('click', () => this.sendChatMessage());
        document.getElementById('chatInput').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendChatMessage();
            }
        });

        // API配置相关事件
        document.getElementById('toggleApiKeyBtn').addEventListener('click', () => this.toggleApiKeyVisibility());
        document.getElementById('clearChatBtn').addEventListener('click', () => this.clearChatHistory());
        document.getElementById('testConnectionBtn').addEventListener('click', () => this.testConnection());
        document.getElementById('saveConfigBtn').addEventListener('click', () => this.saveApiConfig());
        document.getElementById('clearConfigBtn').addEventListener('click', () => this.clearApiConfig());

        // 图表控制事件
        document.getElementById('maximizeChartBtn').addEventListener('click', () => this.maximizeChart());

        // 导出相关事件
        document.getElementById('exportPngBtn').addEventListener('click', () => ChartGenerator.exportPNG());
        document.getElementById('exportSvgBtn').addEventListener('click', () => ChartGenerator.exportSVG());
        document.getElementById('exportCodeBtn').addEventListener('click', () => ChartGenerator.exportCode());
        document.getElementById('shareChartBtn').addEventListener('click', () => this.shareChart());

        // 最大化图表导出事件
        document.getElementById('exportMaxPngBtn').addEventListener('click', () => this.exportMaximizedPNG());
        document.getElementById('exportMaxSvgBtn').addEventListener('click', () => this.exportMaximizedSVG());

        // 分辨率控制事件
        document.getElementById('resolutionSelect').addEventListener('change', () => this.handleResolutionChange());
        document.getElementById('applyResolutionBtn').addEventListener('click', () => this.applyResolution());

        // 建议面板事件
        document.getElementById('refreshSuggestionsBtn').addEventListener('click', () => this.refreshSuggestions());

        // 模态框事件
        document.getElementById('closeModalBtn').addEventListener('click', () => this.closeModal());
        document.getElementById('copyCodeBtn').addEventListener('click', () => this.copyCode());
        document.getElementById('closeConfigModalBtn').addEventListener('click', () => this.closeConfigModal());
        document.getElementById('closeChartMaxBtn').addEventListener('click', () => this.closeChartMaxModal());

        // 点击模态框外部关闭
        document.getElementById('codeModal').addEventListener('click', (e) => {
            if (e.target.id === 'codeModal') {
                this.closeModal();
            }
        });

        document.getElementById('configModal').addEventListener('click', (e) => {
            if (e.target.id === 'configModal') {
                this.closeConfigModal();
            }
        });

        document.getElementById('chartMaxModal').addEventListener('click', (e) => {
            if (e.target.id === 'chartMaxModal') {
                this.closeChartMaxModal();
            }
        });

        // ESC键关闭模态框
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeAllModals();
            }
        });
    }

    /**
     * 加载保存的配置
     */
    loadSavedConfig() {
        const config = ApiClient.getConfig();
        
        if (config.endpoint) {
            document.getElementById('apiEndpoint').value = config.endpoint;
        }
        
        if (config.apiKey) {
            document.getElementById('apiKey').value = config.apiKey;
        }
        
        if (config.model) {
            document.getElementById('modelName').value = config.model;
        }
    }

    /**
     * 初始化图表
     */
    initializeChart() {
        ChartGenerator.clearChart();
    }

    /**
     * 清除数据
     */
    clearData() {
        document.getElementById('dataInput').value = '';
        this.selectedChartType = null;
        this.chartConfig = null;

        // 禁用AI聊天区域
        const aiSection = document.querySelector('.ai-chat-section');
        aiSection.classList.add('ai-chat-disabled');
        aiSection.classList.remove('ai-chat-enabled');

        // 清除聊天记录
        this.clearChatMessages();

        // 清除图表
        ChartGenerator.clearChart();

        // 清除对话历史
        this.chatHistory = [];

        Utils.showNotification('数据已清除', 'info');
    }

    /**
     * 切换数据输入区域的收起/展开状态
     */
    toggleDataInputSection() {
        const dataInputSection = document.querySelector('.data-input-section');
        const mainContent = document.querySelector('.main-content');
        const toggleBtn = document.getElementById('toggleDataInputBtn');
        const toggleIcon = toggleBtn.querySelector('i');

        const isCollapsed = dataInputSection.classList.contains('collapsed');

        if (isCollapsed) {
            // 展开
            dataInputSection.classList.remove('collapsed');
            mainContent.classList.remove('data-input-collapsed');
            toggleIcon.className = 'fas fa-chevron-left';
            toggleBtn.title = '收起数据输入区域';
        } else {
            // 收起
            dataInputSection.classList.add('collapsed');
            mainContent.classList.add('data-input-collapsed');
            toggleIcon.className = 'fas fa-chevron-right';
            toggleBtn.title = '展开数据输入区域';
        }
    }

    /**
     * 开始生成图表
     */
    async analyzeData() {
        const rawData = document.getElementById('dataInput').value.trim();

        if (!rawData) {
            Utils.showNotification('请先输入数据', 'warning');
            return;
        }

        Utils.showLoading('正在生成图表...');

        try {
            // 直接生成默认图表，传入原始数据，让LLM处理所有数据解析和分析
            await this.generateInitialChart(rawData);

            Utils.hideLoading();

            // 显示AI聊天界面
            this.showAIChatInterface();

            // 添加图表生成完成的消息
            this.addAIMessage('图表已生成！您可以通过下方的建议或直接对话来调整图表。');

            Utils.showNotification('图表生成完成', 'success');

        } catch (error) {
            Utils.hideLoading();
            Utils.showNotification(`生成图表出错: ${error.message}`, 'error');
        }
    }

    /**
     * 启用AI聊天界面
     */
    showAIChatInterface() {
        const section = document.querySelector('.ai-chat-section');
        section.classList.remove('ai-chat-disabled');
        section.classList.add('ai-chat-enabled');

        // 更新欢迎消息
        this.updateWelcomeMessage();

        // 启用清空对话按钮
        this.updateClearChatButtonState();
    }

    /**
     * 更新欢迎消息
     */
    updateWelcomeMessage() {
        const welcomeMessage = document.querySelector('.welcome-message .message-content');
        if (welcomeMessage) {
            welcomeMessage.innerHTML = `
                <p>您好！我是您的AI图表助手。请告诉我您想要什么样的图表，我会为您生成相应的配置。</p>
                <p>例如：</p>
                <ul>
                    <li>"生成一个柱状图"</li>
                    <li>"我想要一个折线图，标题改为'销售趋势'"</li>
                    <li>"给我一个饼图，并且显示百分比"</li>
                </ul>
            `;
        }
    }

    /**
     * 清除聊天消息
     */
    clearChatMessages() {
        const chatMessages = document.getElementById('chatMessages');
        // 保留欢迎消息，清除其他消息
        const welcomeMessage = chatMessages.querySelector('.welcome-message');
        chatMessages.innerHTML = '';
        if (welcomeMessage) {
            chatMessages.appendChild(welcomeMessage);
        }

        // 隐藏建议面板
        document.getElementById('suggestionPanel').style.display = 'none';
    }

    /**
     * 清空对话历史
     */
    clearChatHistory() {
        // 确认对话框
        if (!confirm('确定要清空所有对话记录吗？此操作不可撤销。')) {
            return;
        }

        // 清除聊天消息（保留欢迎消息）
        this.clearChatMessages();

        // 清除对话历史
        this.chatHistory = [];

        // 隐藏建议面板
        document.getElementById('suggestionPanel').style.display = 'none';

        // 重置欢迎消息为初始状态
        this.resetWelcomeMessage();

        // 更新清空按钮状态
        this.updateClearChatButtonState();

        Utils.showNotification('对话记录已清空', 'info');
    }

    /**
     * 更新清空对话按钮的状态
     */
    updateClearChatButtonState() {
        const clearChatBtn = document.getElementById('clearChatBtn');
        const isEnabled = document.querySelector('.ai-chat-section').classList.contains('ai-chat-enabled');
        const hasHistory = this.chatHistory.length > 0;

        // 只有当AI助手启用且有对话历史时才启用按钮
        clearChatBtn.disabled = !isEnabled || !hasHistory;
    }

    /**
     * 重置欢迎消息为初始状态
     */
    resetWelcomeMessage() {
        const welcomeMessage = document.querySelector('.welcome-message .message-content');
        if (welcomeMessage) {
            const isEnabled = document.querySelector('.ai-chat-section').classList.contains('ai-chat-enabled');

            if (isEnabled) {
                // 如果AI助手已启用，显示启用状态的欢迎消息
                welcomeMessage.innerHTML = `
                    <p>您好！我是您的AI图表助手。请告诉我您想要什么样的图表，我会为您生成相应的配置。</p>
                    <p>例如：</p>
                    <ul>
                        <li>"生成一个柱状图"</li>
                        <li>"我想要一个折线图，标题改为'销售趋势'"</li>
                        <li>"给我一个饼图，并且显示百分比"</li>
                    </ul>
                `;
            } else {
                // 如果AI助手未启用，显示初始状态的欢迎消息
                welcomeMessage.innerHTML = `
                    <p>您好！我是您的AI图表助手。</p>
                    <p class="disabled-hint">请先在左侧输入数据并点击"开始生成图表"，然后我就可以帮您调整和优化图表了。</p>
                `;
            }
        }
    }

    /**
     * 添加AI消息
     * @param {string} message - 消息内容
     */
    addAIMessage(message) {
        const chatMessages = document.getElementById('chatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message ai-message';

        messageDiv.innerHTML = `
            <div class="message-avatar">
                <i class="fas fa-robot"></i>
            </div>
            <div class="message-content">
                <p>${message.replace(/\n/g, '</p><p>')}</p>
            </div>
        `;

        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        // 添加到对话历史
        this.chatHistory.push({
            role: 'assistant',
            content: message
        });

        // 更新清空按钮状态
        this.updateClearChatButtonState();
    }

    /**
     * 添加用户消息
     * @param {string} message - 消息内容
     */
    addUserMessage(message) {
        const chatMessages = document.getElementById('chatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message user-message';

        messageDiv.innerHTML = `
            <div class="message-avatar">
                <i class="fas fa-user"></i>
            </div>
            <div class="message-content">
                <p>${message}</p>
            </div>
        `;

        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        // 添加到对话历史
        this.chatHistory.push({
            role: 'user',
            content: message
        });

        // 更新清空按钮状态
        this.updateClearChatButtonState();
    }

    /**
     * 移除最后一条AI消息
     */
    removeLastAIMessage() {
        const chatMessages = document.getElementById('chatMessages');
        const aiMessages = chatMessages.querySelectorAll('.ai-message');
        if (aiMessages.length > 1) { // 保留欢迎消息
            const lastAIMessage = aiMessages[aiMessages.length - 1];
            lastAIMessage.remove();
        }
         Utils.hideLoading();
    }

    /**
     * 添加AI加载动画消息
     */
    addAILoadingMessage() {
        const chatMessages = document.getElementById('chatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message ai-message ai-loading-message';
        messageDiv.innerHTML = `
            <div class="message-avatar">
                <i class="fas fa-robot"></i>
            </div>
            <div class="message-content">
                <div class="ai-thinking-animation">
                    <div class="thinking-dots">
                        <span class="dot"></span>
                        <span class="dot"></span>
                        <span class="dot"></span>
                    </div>
                    <div class="thinking-text">AI正在思考中</div>
                </div>
            </div>
        `;
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
         Utils.showLoading('AI正在思考中...');
    }

    /**
     * 发送聊天消息
     */
    async sendChatMessage() {
        const chatInput = document.getElementById('chatInput');
        const message = chatInput.value.trim();

        if (!message) {
            return;
        }

        // 检查是否有原始数据输入
        const rawData = document.getElementById('dataInput').value.trim();
        if (!rawData) {
            Utils.showNotification('请先输入数据', 'warning');
            return;
        }

        // 添加用户消息
        this.addUserMessage(message);

        // 清空输入框
        chatInput.value = '';

        // 禁用发送按钮
        const sendBtn = document.getElementById('sendChatBtn');
        sendBtn.disabled = true;

        try {
            // 显示处理中的动画消息
            this.addAILoadingMessage();

            // 调用AI生成图表配置
            const result = await this.processAIRequest(message);

            // 移除处理中的消息
            this.removeLastAIMessage();

            if (result.success) {
                // 更新图表配置
                this.chartConfig = result.config;
                this.selectedChartType = result.chartType || 'bar';

                // 生成图表
                this.generateChart();

                // 添加配置信息到console.log中显示
                console.log('生成的图表配置:', result.config);
                console.log('检测到的图表类型:', result.chartType);

                // 显示建议
                if (result.suggestions && result.suggestions.length > 0) {
                    this.displaySuggestions(result.suggestions);
                }

                // 添加简单的成功消息给用户
                //this.addAIMessage('图表已更新！您可以点击下方的建议进行进一步调整。');

            } else {
                // 检查是否是重试相关的错误
                if (result.error.includes('已重试')) {
                    this.addAIMessage(`抱歉，经过多次尝试仍无法处理您的请求：${result.error}\n\n请尝试重新表述您的需求，或检查API配置是否正确。`);
                } else {
                    this.addAIMessage(`抱歉，处理您的请求时出现了问题：${result.error}`);
                }
            }

        } catch (error) {
            console.error('AI请求处理错误:', error);
            this.addAIMessage('抱歉，处理您的请求时出现了错误，请稍后再试。');
        } finally {
            // 重新启用发送按钮
            sendBtn.disabled = false;
        }
    }

    /**
     * 处理AI请求
     * @param {string} userMessage - 用户消息
     * @returns {Object} 处理结果
     */
    async processAIRequest(userMessage) {
        try {
            // 获取原始数据输入
            const rawDataInput = document.getElementById('dataInput').value;

            // 1. 使用图表配置生成Agent，传入原始数据和对话历史
            const configResult = await ApiClient.generateChartConfigAgentWithRawData(
                rawDataInput,
                null, // 不再需要解析后的数据
                null, // 不再需要列信息
                userMessage,
                this.chartConfig,
                this.chatHistory
            );

            if (!configResult.success) {
                return {
                    success: false,
                    error: configResult.error
                };
            }

            // 2. 确定图表类型
            const chartType = this.detectChartType(configResult.config);

            // 3. 使用建议操作Agent生成建议
            const suggestionsResult = await ApiClient.generateSuggestionsAgent(
                rawDataInput,
                configResult.config,
                null, // 不再需要列信息
                chartType
            );

            return {
                success: true,
                config: configResult.config,
                chartType: chartType,
                suggestions: suggestionsResult.success ? suggestionsResult.suggestions : []
            };

        } catch (error) {
            console.error('AI请求处理错误:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 处理AI请求（带原始数据）- 用于初始图表生成
     * @param {string} userMessage - 用户消息
     * @param {string} rawDataInput - 原始数据输入
     * @returns {Object} 处理结果
     */
    async processAIRequestWithRawData(userMessage, rawDataInput) {
        try {
            // 1. 使用图表配置生成Agent，传入原始数据和对话历史
            const configResult = await ApiClient.generateChartConfigAgentWithRawData(
                rawDataInput,
                null, // 不再需要解析后的数据
                null, // 不再需要列信息
                userMessage,
                this.chartConfig,
                this.chatHistory
            );

            if (!configResult.success) {
                return {
                    success: false,
                    error: configResult.error
                };
            }

            // 2. 确定图表类型
            const chartType = this.detectChartType(configResult.config);

            // 3. 使用建议操作Agent生成建议
            const suggestionsResult = await ApiClient.generateSuggestionsAgent(
                rawDataInput,
                configResult.config,
                null, // 不再需要列信息
                chartType
            );

            return {
                success: true,
                config: configResult.config,
                chartType: chartType,
                suggestions: suggestionsResult.success ? suggestionsResult.suggestions : []
            };

        } catch (error) {
            console.error('AI请求处理错误:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }



    /**
     * 生成初始图表
     * @param {string} rawDataInput - 用户输入的原始数据
     */
    async generateInitialChart(rawDataInput) {
        try {
            // 直接使用图表配置生成Agent，传入原始数据
            const result = await this.processAIRequestWithRawData('生成一个美观的Echart图表', rawDataInput);

            if (result.success) {
                // 更新图表配置
                this.chartConfig = result.config;
                this.selectedChartType = result.chartType || 'bar';

                // 生成图表
                this.generateChart();

                // 显示建议
                if (result.suggestions && result.suggestions.length > 0) {
                    this.displaySuggestions(result.suggestions);
                }

                console.log('初始图表生成完成:', result.config);
            } else {
                console.warn('初始图表生成失败:', result.error);
                Utils.showNotification('图表生成失败，请手动输入需求', 'warning');
            }
        } catch (error) {
            console.error('初始图表生成错误:', error);
            Utils.showNotification('图表生成出错，请手动输入需求', 'error');
        }
    }

    /**
     * 检测图表类型
     * @param {Object} config - 图表配置
     * @returns {string} 图表类型
     */
    detectChartType(config) {
        if (config.series) {
            if (Array.isArray(config.series)) {
                return config.series[0]?.type || 'bar';
            } else {
                return config.series.type || 'bar';
            }
        }
        return 'bar';
    }



    /**
     * 显示建议
     * @param {Array} suggestions - 建议列表
     */
    displaySuggestions(suggestions) {
        const suggestionPanel = document.getElementById('suggestionPanel');
        const suggestionsContainer = document.getElementById('suggestions');

        suggestionsContainer.innerHTML = '';

        suggestions.forEach(suggestion => {
            const chip = document.createElement('div');
            chip.className = `suggestion-chip ${suggestion.type}`;
            chip.textContent = suggestion.text;
            chip.addEventListener('click', () => this.handleSuggestionClick(suggestion));
            suggestionsContainer.appendChild(chip);
        });

        suggestionPanel.style.display = 'block';
    }

    /**
     * 处理建议点击
     * @param {Object} suggestion - 建议对象
     */
    async handleSuggestionClick(suggestion) {
        // 将建议作为用户消息发送
        document.getElementById('chatInput').value = suggestion.text;
        await this.sendChatMessage();
    }

    /**
     * 刷新建议 - 换一批
     */
    async refreshSuggestions() {
        const rawData = document.getElementById('dataInput').value.trim();
        if (!rawData || !this.chartConfig) {
            Utils.showNotification('请先生成图表后再刷新建议', 'warning');
            return;
        }

        const refreshBtn = document.getElementById('refreshSuggestionsBtn');
        const icon = refreshBtn.querySelector('i');

        // 禁用按钮并显示加载状态
        refreshBtn.disabled = true;
        icon.classList.add('fa-spin');

        try {
            // 获取当前建议
            const currentSuggestions = this.getCurrentSuggestions();

            // 调用新的API方法生成不同的建议
            const suggestionsResult = await ApiClient.generateRefreshSuggestionsAgent(
                rawData,
                this.chartConfig,
                null, // 不再需要列信息
                this.detectChartType(this.chartConfig),
                currentSuggestions
            );

            if (suggestionsResult.success && suggestionsResult.suggestions.length > 0) {
                this.displaySuggestions(suggestionsResult.suggestions);
                Utils.showNotification('建议已更新', 'success');
            } else {
                Utils.showNotification('暂时无法生成新建议，请稍后再试', 'warning');
            }

        } catch (error) {
            console.error('刷新建议错误:', error);
            Utils.showNotification('刷新建议失败，请稍后再试', 'error');
        } finally {
            // 恢复按钮状态
            refreshBtn.disabled = false;
            icon.classList.remove('fa-spin');
        }
    }

    /**
     * 获取当前显示的建议
     * @returns {Array} 当前建议列表
     */
    getCurrentSuggestions() {
        const suggestionChips = document.querySelectorAll('.suggestion-chip');
        return Array.from(suggestionChips).map(chip => ({
            text: chip.textContent,
            type: chip.classList.contains('chart-type') ? 'chart-type' : 'config-option'
        }));
    }

    /**
     * 生成图表
     */
    generateChart() {
        console.log('App.generateChart - 开始生成图表');
        console.log('当前配置:', this.chartConfig);
        console.log('选中图表类型:', this.selectedChartType);

        if (!this.chartConfig || !this.selectedChartType) {
            console.error('生成图表失败 - 缺少必要参数:', {
                hasConfig: !!this.chartConfig,
                hasChartType: !!this.selectedChartType
            });
            Utils.showNotification('生成图表失败：缺少必要参数', 'error');
            return;
        }

        // 直接使用LLM返回的配置生成图表，不再需要传入数据
        const success = ChartGenerator.generateChartFromConfig(
            this.chartConfig,
            this.selectedChartType
        );

        if (success) {
            Utils.showNotification('图表生成成功', 'success');
        }
    }



    /**
     * 切换API Key可见性
     */
    toggleApiKeyVisibility() {
        const input = document.getElementById('apiKey');
        const button = document.getElementById('toggleApiKeyBtn');
        const icon = button.querySelector('i');
        
        if (input.type === 'password') {
            input.type = 'text';
            icon.className = 'fas fa-eye-slash';
        } else {
            input.type = 'password';
            icon.className = 'fas fa-eye';
        }
    }

    /**
     * 测试API连接
     */
    async testConnection() {
        const config = this.getApiConfigFromForm();
        
        if (!config.apiKey) {
            Utils.showNotification('请先输入API Key', 'warning');
            return;
        }

        Utils.showLoading('正在测试连接...');
        
        // 临时保存配置用于测试
        ApiClient.saveConfig(config);
        
        try {
            const result = await ApiClient.testConnection();
            Utils.hideLoading();
            
            if (result.success) {
                Utils.showNotification('连接测试成功', 'success');
            } else {
                Utils.showNotification(`连接测试失败: ${result.error}`, 'error');
            }
        } catch (error) {
            Utils.hideLoading();
            Utils.showNotification(`连接测试出错: ${error.message}`, 'error');
        }
    }

    /**
     * 保存API配置
     */
    saveApiConfig() {
        const config = this.getApiConfigFromForm();
        
        if (!config.apiKey) {
            Utils.showNotification('请先输入API Key', 'warning');
            return;
        }

        ApiClient.saveConfig(config);
        Utils.showNotification('API配置已保存', 'success');
    }

    /**
     * 清除API配置
     */
    clearApiConfig() {
        if (confirm('确定要清除API配置吗？')) {
            ApiClient.clearConfig();
            
            document.getElementById('apiEndpoint').value = ApiClient.defaultConfig.endpoint;
            document.getElementById('apiKey').value = '';
            document.getElementById('modelName').value = ApiClient.defaultConfig.model;
            
            Utils.showNotification('API配置已清除', 'info');
        }
    }

    /**
     * 从表单获取API配置
     * @returns {Object} API配置
     */
    getApiConfigFromForm() {
        return {
            endpoint: document.getElementById('apiEndpoint').value.trim(),
            apiKey: document.getElementById('apiKey').value.trim(),
            model: document.getElementById('modelName').value.trim()
        };
    }

    /**
     * 打开配置模态框
     */
    openConfigModal() {
        document.getElementById('configModal').style.display = 'flex';
    }

    /**
     * 关闭配置模态框
     */
    closeConfigModal() {
        document.getElementById('configModal').style.display = 'none';
    }

    /**
     * 最大化图表
     */
    maximizeChart() {
        if (!ChartGenerator.currentChart) {
            Utils.showNotification('没有可最大化的图表', 'warning');
            return;
        }

        // 显示最大化模态框
        const modal = document.getElementById('chartMaxModal');
        const container = document.getElementById('chartMaxContainer');

        modal.style.display = 'flex';

        // 重置分辨率选择器
        document.getElementById('resolutionSelect').value = 'auto';
        this.handleResolutionChange();

        // 创建新的图表实例（使用SVG渲染器以支持SVG导出）
        setTimeout(() => {
            const maxChart = echarts.init(container, null, { renderer: 'svg' });
            const option = ChartGenerator.currentChart.getOption();
            maxChart.setOption(option);

            // 保存最大化图表实例
            this.maximizedChart = maxChart;

            // 监听窗口大小变化
            const resizeHandler = () => {
                if (this.maximizedChart) {
                    this.maximizedChart.resize();
                }
            };

            window.addEventListener('resize', resizeHandler);

            // 保存resize处理器以便清理
            this.maxChartResizeHandler = resizeHandler;
        }, 100);
    }

    /**
     * 处理分辨率选择变化
     */
    handleResolutionChange() {
        const select = document.getElementById('resolutionSelect');
        const customDiv = document.getElementById('customResolution');

        if (select.value === 'custom') {
            customDiv.style.display = 'flex';
        } else {
            customDiv.style.display = 'none';
        }
    }

    /**
     * 应用分辨率设置
     */
    applyResolution() {
        if (!this.maximizedChart) {
            Utils.showNotification('没有可调整的图表', 'warning');
            return;
        }

        const select = document.getElementById('resolutionSelect');
        const container = document.getElementById('chartMaxContainer');
        let width, height;

        if (select.value === 'auto') {
            // 自适应 - 恢复默认样式
            container.style.width = '100%';
            container.style.height = 'calc(95vh - 120px)';
            Utils.showNotification('已设置为自适应模式', 'success');
        } else if (select.value === 'custom') {
            // 自定义分辨率
            width = parseInt(document.getElementById('customWidth').value);
            height = parseInt(document.getElementById('customHeight').value);

            if (!width || !height || width < 100 || height < 100) {
                Utils.showNotification('请输入有效的自定义分辨率 (最小100x100)', 'error');
                return;
            }
        } else {
            // 预设分辨率
            const [w, h] = select.value.split('x').map(Number);
            width = w;
            height = h;
        }

        if (width && height) {
            // 设置固定尺寸
            container.style.width = width + 'px';
            container.style.height = height + 'px';

            // 如果尺寸超出视窗，添加滚动
            const modal = document.querySelector('.chart-max-content');
            if (width > window.innerWidth * 0.9 || height > window.innerHeight * 0.8) {
                modal.style.overflow = 'auto';
            } else {
                modal.style.overflow = 'hidden';
            }

            Utils.showNotification(`已设置分辨率为 ${width}×${height}`, 'success');
        }

        // 延迟调整图表大小
        setTimeout(() => {
            if (this.maximizedChart) {
                this.maximizedChart.resize();
            }
        }, 100);
    }

    /**
     * 关闭最大化图表模态框
     */
    closeChartMaxModal() {
        const modal = document.getElementById('chartMaxModal');
        modal.style.display = 'none';

        // 清理最大化图表实例
        if (this.maximizedChart) {
            this.maximizedChart.dispose();
            this.maximizedChart = null;
        }

        // 移除resize监听器
        if (this.maxChartResizeHandler) {
            window.removeEventListener('resize', this.maxChartResizeHandler);
            this.maxChartResizeHandler = null;
        }
    }

    /**
     * 切换全屏模式
     */
    toggleFullscreen() {
        const container = document.querySelector('.app-container');
        const btn = document.getElementById('fullscreenBtn');
        const icon = btn.querySelector('i');

        if (container.classList.contains('fullscreen')) {
            // 退出全屏
            container.classList.remove('fullscreen');
            icon.className = 'fas fa-expand';
            btn.title = '全屏模式';
        } else {
            // 进入全屏
            container.classList.add('fullscreen');
            icon.className = 'fas fa-compress';
            btn.title = '退出全屏';
        }

        // 调整图表大小
        setTimeout(() => {
            if (ChartGenerator.currentChart) {
                ChartGenerator.currentChart.resize();
            }
        }, 300);
    }


    /**
     * 导出最大化图表PNG
     */
    exportMaximizedPNG() {
        if (!this.maximizedChart) {
            Utils.showNotification('没有可导出的最大化图表', 'warning');
            return;
        }

        try {
            // 获取当前分辨率设置
            const resolution = this.getCurrentResolution();
            const resolutionText = resolution.width && resolution.height ?
                `_${resolution.width}x${resolution.height}` : '_maximized';

            // 检查渲染器类型
            const rendererType = this.maximizedChart.getZr().painter.type;
            console.log('最大化PNG导出 - 渲染器类型:', rendererType);
            console.log('导出分辨率:', resolution);

            if (rendererType === 'canvas') {
                // Canvas渲染器直接使用getDataURL
                const url = this.maximizedChart.getDataURL({
                    type: 'png',
                    pixelRatio: 3,
                    backgroundColor: '#fff'
                });

                const link = document.createElement('a');
                link.href = url;
                link.download = `chart${resolutionText}_${Utils.formatDate(new Date(), 'YYYY-MM-DD_HH-mm-ss')}.png`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                Utils.showNotification('最大化图表PNG导出成功', 'success');
            } else {
                // SVG渲染器需要转换为PNG
                this.convertMaximizedSVGToPNG(resolution, resolutionText);
            }

        } catch (error) {
            console.error('最大化PNG导出错误:', error);
            Utils.showNotification(`导出最大化PNG失败: ${error.message}`, 'error');
        }
    }

    /**
     * 获取当前分辨率设置
     */
    getCurrentResolution() {
        const select = document.getElementById('resolutionSelect');
        const container = document.getElementById('chartMaxContainer');

        if (select.value === 'auto') {
            // 自适应模式，使用容器当前尺寸
            const rect = container.getBoundingClientRect();
            return {
                width: Math.round(rect.width),
                height: Math.round(rect.height),
                mode: 'auto'
            };
        } else if (select.value === 'custom') {
            // 自定义分辨率
            return {
                width: parseInt(document.getElementById('customWidth').value),
                height: parseInt(document.getElementById('customHeight').value),
                mode: 'custom'
            };
        } else {
            // 预设分辨率
            const [width, height] = select.value.split('x').map(Number);
            return {
                width,
                height,
                mode: 'preset'
            };
        }
    }

    /**
     * 将最大化图表的SVG转换为PNG并下载
     */
    convertMaximizedSVGToPNG(resolution, resolutionText) {
        const chartDom = this.maximizedChart.getDom();
        const svgElement = chartDom.querySelector('svg');

        if (!svgElement) {
            throw new Error('无法找到SVG元素');
        }

        // 获取SVG的尺寸
        const rect = svgElement.getBoundingClientRect();
        let width = rect.width || 800;
        let height = rect.height || 600;

        // 如果有指定分辨率，使用指定的分辨率
        if (resolution && resolution.width && resolution.height && resolution.mode !== 'auto') {
            width = resolution.width;
            height = resolution.height;
        }

        // 创建Canvas
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // 设置高分辨率
        const pixelRatio = 3; // 最大化图表使用更高的分辨率
        canvas.width = width * pixelRatio;
        canvas.height = height * pixelRatio;
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        ctx.scale(pixelRatio, pixelRatio);

        // 设置白色背景
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);

        // 将SVG转换为图片
        const svgData = new XMLSerializer().serializeToString(svgElement);
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const svgUrl = URL.createObjectURL(svgBlob);

        const img = new Image();
        img.onload = () => {
            try {
                // 如果需要缩放到指定分辨率
                if (resolution && resolution.width && resolution.height && resolution.mode !== 'auto') {
                    // 计算缩放比例以保持宽高比
                    const scaleX = width / rect.width;
                    const scaleY = height / rect.height;
                    const scale = Math.min(scaleX, scaleY);

                    const scaledWidth = rect.width * scale;
                    const scaledHeight = rect.height * scale;
                    const offsetX = (width - scaledWidth) / 2;
                    const offsetY = (height - scaledHeight) / 2;

                    ctx.drawImage(img, offsetX, offsetY, scaledWidth, scaledHeight);
                } else {
                    ctx.drawImage(img, 0, 0, width, height);
                }

                const pngUrl = canvas.toDataURL('image/png');

                const link = document.createElement('a');
                link.href = pngUrl;
                link.download = `chart${resolutionText || '_maximized'}_${Utils.formatDate(new Date(), 'YYYY-MM-DD_HH-mm-ss')}.png`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                URL.revokeObjectURL(svgUrl);
                Utils.showNotification('最大化图表PNG导出成功', 'success');
            } catch (error) {
                URL.revokeObjectURL(svgUrl);
                throw error;
            }
        };

        img.onerror = () => {
            URL.revokeObjectURL(svgUrl);
            throw new Error('SVG转PNG失败');
        };

        img.src = svgUrl;
    }

    /**
     * 导出最大化图表SVG
     */
    exportMaximizedSVG() {
        if (!this.maximizedChart) {
            Utils.showNotification('没有可导出的最大化图表', 'warning');
            return;
        }

        try {
            // 获取当前分辨率设置
            const resolution = this.getCurrentResolution();
            const resolutionText = resolution.width && resolution.height ?
                `_${resolution.width}x${resolution.height}` : '_maximized';

            // 检查渲染器类型
            console.log('最大化图表渲染器:', this.maximizedChart.getZr().painter.type);
            console.log('导出分辨率:', resolution);

            // 获取SVG字符串
            let svgStr;
            if (this.maximizedChart.renderToSVGString) {
                svgStr = this.maximizedChart.renderToSVGString();
            } else {
                // 如果没有renderToSVGString方法，尝试从DOM获取SVG
                const chartDom = this.maximizedChart.getDom();
                const svgElement = chartDom.querySelector('svg');
                if (svgElement) {
                    svgStr = new XMLSerializer().serializeToString(svgElement);
                } else {
                    throw new Error('无法获取SVG内容，请确保图表使用SVG渲染器');
                }
            }

            const blob = new Blob([svgStr], { type: 'image/svg+xml' });
            const url = URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.href = url;
            link.download = `chart${resolutionText}_${Utils.formatDate(new Date(), 'YYYY-MM-DD_HH-mm-ss')}.svg`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            URL.revokeObjectURL(url);
            Utils.showNotification('最大化图表SVG导出成功', 'success');
        } catch (error) {
            console.error('最大化SVG导出错误:', error);
            Utils.showNotification(`导出最大化SVG失败: ${error.message}`, 'error');
        }
    }

    /**
     * 分享图表
     */
    shareChart() {
        if (!this.chartConfig) {
            Utils.showNotification('没有可分享的图表', 'warning');
            return;
        }

        try {
            // 准备分享数据 - 只需要配置信息，数据已经包含在配置中
            const shareData = {
                config: this.chartConfig,
                chartType: this.selectedChartType,
                timestamp: new Date().toISOString(),
                version: '1.0'
            };

            // 将数据转换为JSON字符串
            const jsonString = JSON.stringify(shareData);

            // 使用pako压缩数据 - 修复压缩格式
            const uint8Array = new TextEncoder().encode(jsonString);
            const compressed = pako.gzip(uint8Array);

            // 将压缩数据转换为Base64编码
            const base64Data = btoa(String.fromCharCode.apply(null, compressed));

            // 生成分享链接
            const baseUrl = window.location.origin + window.location.pathname.replace('index.html', '');
            const shareUrl = `${baseUrl}share.html?data=${encodeURIComponent(base64Data)}`;

            // 复制到剪贴板
            Utils.copyToClipboard(shareUrl).then(success => {
                if (success) {
                    Utils.showNotification('分享链接已复制到剪贴板', 'success');
                } else {
                    // 如果复制失败，显示链接让用户手动复制
                    this.showShareModal(shareUrl);
                }
            });

        } catch (error) {
            console.error('分享图表失败:', error);
            Utils.showNotification(`分享失败: ${error.message}`, 'error');
        }
    }

    /**
     * 显示分享模态框
     * @param {string} shareUrl - 分享链接
     */
    showShareModal(shareUrl) {
        // 创建模态框HTML
        const modalHtml = `
            <div id="shareModal" class="modal" style="display: block;">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3><i class="fas fa-share-alt"></i> 分享图表</h3>
                        <button id="closeShareModalBtn" class="btn btn-icon">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <p>复制下面的链接来分享您的图表：</p>
                        <div class="share-url-container">
                            <input type="text" id="shareUrlInput" class="share-url-input" value="${shareUrl}" readonly>
                            <button id="copyShareUrlBtn" class="btn btn-primary">
                                <i class="fas fa-copy"></i> 复制
                            </button>
                        </div>
                        <p class="share-note">
                            <i class="fas fa-info-circle"></i>
                            此链接包含您的图表配置和数据，任何人都可以通过此链接查看您的图表。
                        </p>
                    </div>
                </div>
            </div>
        `;

        // 添加到页面
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // 绑定事件
        document.getElementById('closeShareModalBtn').addEventListener('click', () => {
            document.getElementById('shareModal').remove();
        });

        document.getElementById('copyShareUrlBtn').addEventListener('click', async () => {
            const input = document.getElementById('shareUrlInput');
            input.select();
            const success = await Utils.copyToClipboard(shareUrl);
            if (success) {
                Utils.showNotification('链接已复制到剪贴板', 'success');
                document.getElementById('shareModal').remove();
            }
        });

        // 点击模态框外部关闭
        document.getElementById('shareModal').addEventListener('click', (e) => {
            if (e.target.id === 'shareModal') {
                document.getElementById('shareModal').remove();
            }
        });
    }

    /**
     * 关闭所有模态框
     */
    closeAllModals() {
        this.closeModal();
        this.closeConfigModal();
        this.closeChartMaxModal();
        // 关闭分享模态框（如果存在）
        const shareModal = document.getElementById('shareModal');
        if (shareModal) {
            shareModal.remove();
        }
    }



    /**
     * 关闭代码模态框
     */
    closeModal() {
        document.getElementById('codeModal').style.display = 'none';
    }

    /**
     * 复制代码
     */
    async copyCode() {
        const codeContent = document.getElementById('codeContent').textContent;
        const success = await Utils.copyToClipboard(codeContent);
        
        if (success) {
            Utils.showNotification('代码已复制到剪贴板', 'success');
        } else {
            Utils.showNotification('复制失败，请手动复制', 'error');
        }
    }
}

// 应用启动
document.addEventListener('DOMContentLoaded', () => {
    window.app = new ChartGeneratorApp();
});

// 导出应用类（如果使用模块系统）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChartGeneratorApp;
}
