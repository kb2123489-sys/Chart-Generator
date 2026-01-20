/**
 * API客户端模块
 * 负责与LLM API进行通信
 */

const ApiClient = {
    
    // 默认配置
    defaultConfig: {
        endpoint: 'https://api.openai.com/v1/chat/completions',
        model: 'gpt-3.5-turbo',
        temperature: 0.7,
        maxTokens: 12000
    },

    /**
     * 获取API配置
     * @returns {Object} API配置
     */
    getConfig() {
        const saved = Utils.storage.get('llm_api_config', {});
        return {
            ...this.defaultConfig,
            ...saved
        };
    },

    /**
     * 保存API配置
     * @param {Object} config - API配置
     */
    saveConfig(config) {
        const currentConfig = this.getConfig();
        const newConfig = {
            ...currentConfig,
            ...config
        };
        Utils.storage.set('llm_api_config', newConfig);
    },

    /**
     * 清除API配置
     */
    clearConfig() {
        Utils.storage.remove('llm_api_config');
    },

    /**
     * 测试API连接
     * @returns {Promise<Object>} 测试结果
     */
    async testConnection() {
        const config = this.getConfig();
        
        if (!config.apiKey) {
            return {
                success: false,
                error: 'API Key未配置'
            };
        }

        try {
            const response = await this.callApi([
                {
                    role: 'user',
                    content: '请回复"连接测试成功"'
                }
            ], {
                maxTokens: 50
            });

            if (response.success) {
                return {
                    success: true,
                    message: '连接测试成功'
                };
            } else {
                return {
                    success: false,
                    error: response.error
                };
            }
        } catch (error) {
            return {
                success: false,
                error: `连接测试失败: ${error.message}`
            };
        }
    },

    /**
     * 调用LLM API
     * @param {Array} messages - 消息数组
     * @param {Object} options - 可选参数
     * @returns {Promise<Object>} API响应
     */
    async callApi(messages, options = {}) {
        const config = this.getConfig();
        
        if (!config.apiKey) {
            return {
                success: false,
                error: 'API Key未配置'
            };
        }

        const requestBody = {
            model: options.model || config.model,
            messages: messages,
            temperature: options.temperature || config.temperature,
            max_tokens: options.maxTokens || config.maxTokens
        };

        try {
            const response = await fetch(config.endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.apiKey}`
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                return {
                    success: false,
                    error: errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`
                };
            }

            const data = await response.json();
            
            if (!data.choices || data.choices.length === 0) {
                return {
                    success: false,
                    error: 'API返回数据格式错误'
                };
            }

            return {
                success: true,
                data: data,
                content: data.choices[0].message.content,
                usage: data.usage
            };

        } catch (error) {
            return {
                success: false,
                error: `API调用失败: ${error.message}`
            };
        }
    },

    /**
     * 分析数据并推荐图表类型
     * @param {Array} data - 数据数组
     * @param {Array} columns - 列名数组
     * @param {Object} stats - 数据统计信息
     * @returns {Promise<Object>} 分析结果
     */
    async analyzeDataForChartRecommendation(data, columns, stats) {
        const prompt = this.buildChartRecommendationPrompt(data, columns, stats);

        const messages = [
            {
                role: 'system',
                content: '你是一个专业的数据可视化专家，擅长根据数据特征推荐最适合的图表类型。请严格按照要求返回结果。'
            },
            {
                role: 'user',
                content: prompt
            }
        ];

        let response = null;

        try {
            response = await this.callApi(messages, {
                temperature: 0.3,
                maxTokens: 11500
            });

            if (!response.success) {
                return response;
            }

            // 尝试解析JSON响应
            const content = response.content.trim();
            let jsonContent = content;

            // 检查是否包含markdown代码块
            if (content.includes('```json')) {
                // 提取markdown代码块中的JSON
                const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
                if (jsonMatch && jsonMatch[1]) {
                    jsonContent = jsonMatch[1].trim();
                }
            } else if (content.includes('```')) {
                // 提取普通代码块中的JSON
                const codeMatch = content.match(/```\s*([\s\S]*?)\s*```/);
                if (codeMatch && codeMatch[1]) {
                    jsonContent = codeMatch[1].trim();
                }
            } else if (content.startsWith('`') && content.endsWith('`')) {
                jsonContent = content.substring(1, content.length - 1).trim();
            } else {
                // 尝试直接查找JSON结构
                let jsonStart = content.indexOf('{');
                let jsonEnd = content.lastIndexOf('}') + 1;

                if (jsonStart === -1 || jsonEnd === 0) {
                    // 如果没有找到对象，尝试查找数组
                    jsonStart = content.indexOf('[');
                    jsonEnd = content.lastIndexOf(']') + 1;
                }

                if (jsonStart !== -1 && jsonEnd > 0) {
                    jsonContent = content.substring(jsonStart, jsonEnd);
                }
            }

            if (!this.isValidJson(jsonContent)) {
                return {
                    success: false,
                    error: 'LLM返回的内容不包含有效的JSON格式',
                    rawResponse: response.content
                };
            }

            // 清理JSON内容，移除JavaScript注释
            const cleanedJsonContent = this.cleanJsonContent(jsonContent);
            const recommendations = JSON.parse(cleanedJsonContent);

            // 验证推荐结果格式
            const validRecommendations = this.validateRecommendations(recommendations);

            return {
                success: true,
                recommendations: validRecommendations,
                rawResponse: response.content
            };

        } catch (error) {
            return {
                success: false,
                error: `解析LLM响应失败: ${error.message}`,
                rawResponse: response?.content || null
            };
        }
    },



    /**
     * 图表配置生成Agent - 专门生成ECharts配置（带重试机制）
     * @param {Array} data - 完整数据数组
     * @param {Array} columns - 列名数组
     * @param {string} userMessage - 用户消息
     * @param {Object} currentConfig - 当前配置（可选）
     * @param {Array} chatHistory - 对话历史（可选）
     * @param {number} retryCount - 重试次数
     * @returns {Promise<Object>} 配置结果
     */
    async generateChartConfigAgent(data, columns, userMessage, currentConfig = null, chatHistory = [], retryCount = 0) {
        const maxRetries = 5;
        const prompt = this.buildChartConfigPrompt(data, columns, userMessage, currentConfig);

        // 构建包含历史对话的消息数组
        const messages = [
            {
                role: 'system',
                content: '你是一个专业的ECharts配置生成专家，专门根据用户需求和完整数据生成美观、专业的图表配置。请严格按照要求返回结果。'
            }
        ];

        // 添加历史对话
        if (chatHistory && chatHistory.length > 0) {
            messages.push(...chatHistory);
        }

        // 添加当前用户消息
        messages.push({
            role: 'user',
            content: prompt
        });

        let response = null;

        try {
            response = await this.callApi(messages, {
                temperature: 0.2,
                maxTokens: 6000
            });

            if (!response.success) {
                return response;
            }

            // 尝试解析JSON响应
            const content = response.content.trim();
            let jsonContent = content;

            console.log(`图表配置生成响应 (尝试 ${retryCount + 1}/${maxRetries + 1}):`);

            // 检查是否包含markdown代码块
            if (content.includes('```json')) {
                const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
                if (jsonMatch && jsonMatch[1]) {
                    jsonContent = jsonMatch[1].trim();
                }
            } else if (content.includes('```')) {
                const codeMatch = content.match(/```\s*([\s\S]*?)\s*```/);
                if (codeMatch && codeMatch[1]) {
                    jsonContent = codeMatch[1].trim();
                }
            } else if (content.startsWith('`') && content.endsWith('`')) {
                jsonContent = content.substring(1, content.length - 1).trim();
            }
             else {
                // 尝试直接查找JSON结构
                let jsonStart = content.indexOf('{');
                let jsonEnd = content.lastIndexOf('}') + 1;

                if (jsonStart !== -1 && jsonEnd > 0) {
                    jsonContent = content.substring(jsonStart, jsonEnd);
                }
            }

            // 尝试解析ECharts配置（可能包含函数）
            let config;
            try {
                config = this.parseEChartsConfig(jsonContent);
            } catch (parseError) {
                console.error('ECharts配置解析失败:', parseError);

                // 如果解析失败且还有重试次数，则重试
                if (retryCount < maxRetries) {
                    console.log(`ECharts配置解析失败，正在重试... (${retryCount + 1}/${maxRetries})`);
                    await new Promise(resolve => setTimeout(resolve, 1000)); // 等待1秒后重试
                    return this.generateChartConfigAgent(data, columns, userMessage, currentConfig, chatHistory, retryCount + 1);
                }

                return {
                    success: false,
                    error: `AI返回的ECharts配置无法解析 (已重试${maxRetries}次): ${parseError.message}`,
                    rawResponse: response.content
                };
            }

            console.log(`图表配置生成响应 (尝试 ${retryCount + 1}/${maxRetries + 1}):`, jsonContent);

            console.log('解析后的图表配置:', config);

            return {
                success: true,
                config: config,
                rawResponse: response.content
            };

        } catch (error) {
            console.error(`解析图表配置响应时发生错误 (尝试 ${retryCount + 1}/${maxRetries + 1}):`, error);

            // 如果解析失败且还有重试次数，则重试
            if (retryCount < maxRetries) {
                console.log(`解析错误，正在重试... (${retryCount + 1}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, 1000)); // 等待1秒后重试
                return this.generateChartConfigAgent(data, columns, userMessage, currentConfig, chatHistory, retryCount + 1);
            }

            return {
                success: false,
                error: `解析AI响应失败: ${error.message} (已重试${maxRetries}次)`,
                rawResponse: response?.content || null
            };
        }
    },

    /**
     * 图表配置生成Agent（带原始数据）- 专门用于初始图表生成
     * @param {string} rawDataInput - 用户输入的原始数据
     * @param {Array} data - 解析后的数据数组
     * @param {Array} columns - 列名数组
     * @param {string} userMessage - 用户消息
     * @param {Object} currentConfig - 当前配置（可选）
     * @param {Array} chatHistory - 对话历史（可选）
     * @param {number} retryCount - 重试次数
     * @returns {Promise<Object>} 配置结果
     */
    async generateChartConfigAgentWithRawData(rawDataInput, data, columns, userMessage, currentConfig = null, chatHistory = [], retryCount = 0) {
        const maxRetries = 5;
        const prompt = this.buildChartConfigPromptWithRawData(rawDataInput, data, columns, userMessage, currentConfig);

        // 构建包含历史对话的消息数组
        const messages = [
            {
                role: 'system',
                content: '你是一个专业的ECharts配置生成专家，专门根据用户需求和原始数据生成美观、专业的图表配置。请严格按照要求返回结果。'
            }
        ];

        // 添加历史对话
        if (chatHistory && chatHistory.length > 0) {
            messages.push(...chatHistory);
        }

        // 添加当前用户消息
        messages.push({
            role: 'user',
            content: prompt
        });

        let response = null;

        try {
            response = await this.callApi(messages, {
                temperature: 0.4,
                maxTokens: 12000
            });

            if (!response.success) {
                return response;
            }

            // 尝试解析JSON响应
            const content = response.content.trim();
            let jsonContent = content;

            console.log(`图表配置生成响应（原始数据）(尝试 ${retryCount + 1}/${maxRetries + 1}):`, content);

            // 检查是否包含markdown代码块
            if (content.includes('```json')) {
                const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
                if (jsonMatch && jsonMatch[1]) {
                    jsonContent = jsonMatch[1].trim();
                }
            } else if (content.includes('```')) {
                const codeMatch = content.match(/```\s*([\s\S]*?)\s*```/);
                if (codeMatch && codeMatch[1]) {
                    jsonContent = codeMatch[1].trim();
                }
            }else if (content.startsWith('`') && content.endsWith('`')) {
                jsonContent = content.substring(1, content.length - 1).trim();
            } else {
                // 尝试直接查找JSON结构
                let jsonStart = content.indexOf('{');
                let jsonEnd = content.lastIndexOf('}') + 1;

                if (jsonStart !== -1 && jsonEnd > 0) {
                    jsonContent = content.substring(jsonStart, jsonEnd);
                }
            }

            // 尝试解析ECharts配置（可能包含函数）
            let config;
            try {
                config = this.parseEChartsConfig(jsonContent);
            } catch (parseError) {
                console.error('ECharts配置解析失败（原始数据）:', parseError);

                // 如果解析失败且还有重试次数，则重试
                if (retryCount < maxRetries) {
                    console.log(`ECharts配置解析失败，正在重试... (${retryCount + 1}/${maxRetries})`);
                    await new Promise(resolve => setTimeout(resolve, 1000)); // 等待1秒后重试
                    return this.generateChartConfigAgentWithRawData(rawDataInput, data, columns, userMessage, currentConfig, chatHistory, retryCount + 1);
                }

                return {
                    success: false,
                    error: `AI返回的ECharts配置无法解析 (已重试${maxRetries}次): ${parseError.message}`,
                    rawResponse: response.content
                };
            }

            console.log('解析后的图表配置（原始数据）:', config);

            return {
                success: true,
                config: config,
                rawResponse: response.content
            };

        } catch (error) {
            console.error(`解析图表配置响应时发生错误（原始数据）(尝试 ${retryCount + 1}/${maxRetries + 1}):`, error);

            // 如果解析失败且还有重试次数，则重试
            if (retryCount < maxRetries) {
                console.log(`解析错误，正在重试... (${retryCount + 1}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, 1000)); // 等待1秒后重试
                return this.generateChartConfigAgentWithRawData(rawDataInput, data, columns, userMessage, currentConfig, chatHistory, retryCount + 1);
            }

            return {
                success: false,
                error: `解析AI响应失败: ${error.message} (已重试${maxRetries}次)`,
                rawResponse: response?.content || null
            };
        }
    },

    /**
     * 建议操作Agent - 基于当前配置生成操作建议
     * @param {Object} currentConfig - 当前图表配置
     * @param {Array} columns - 列名数组
     * @param {string} chartType - 当前图表类型
     * @returns {Promise<Object>} 建议结果
     */
    async generateSuggestionsAgent(rawDataInput,currentConfig, columns, chartType) {
        const prompt = this.buildSuggestionsPrompt(rawDataInput,currentConfig, columns, chartType);

        const messages = [
            {
                role: 'system',
                content: '你是一个图表操作建议专家，根据当前图表配置提供有用的操作建议。'
            },
            {
                role: 'user',
                content: prompt
            }
        ];

        try {
            const response = await this.callApi(messages, {
                temperature: 0.5,
                maxTokens: 10000
            });

            if (!response.success) {
                return response;
            }

            // 尝试解析JSON响应
            const content = response.content.trim();
            let jsonContent = content;

            if (content.includes('```json')) {
                const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
                if (jsonMatch && jsonMatch[1]) {
                    jsonContent = jsonMatch[1].trim();
                }
            } else if (content.includes('```')) {
                const codeMatch = content.match(/```\s*([\s\S]*?)\s*```/);
                if (codeMatch && codeMatch[1]) {
                    jsonContent = codeMatch[1].trim();
                }
            }else if (content.startsWith('`') && content.endsWith('`')) {
                jsonContent = content.substring(1, content.length - 1).trim();
            }

            const suggestions = JSON.parse(this.cleanJsonContent(jsonContent));

            return {
                success: true,
                suggestions: suggestions,
                rawResponse: response.content
            };

        } catch (error) {
            console.error('生成建议时发生错误:', error);
            // 返回默认建议
            return {
                success: true,
                suggestions: this.getDefaultSuggestions(chartType),
                rawResponse: null
            };
        }
    },

    /**
     * 刷新建议Agent - 基于当前配置和已有建议生成不同的建议
     * @param {string} rawDataInput - 原始数据输入
     * @param {Object} currentConfig - 当前图表配置
     * @param {Array} columns - 列名数组
     * @param {string} chartType - 当前图表类型
     * @param {Array} currentSuggestions - 当前显示的建议
     * @returns {Promise<Object>} 建议结果
     */
    async generateRefreshSuggestionsAgent(rawDataInput, currentConfig, columns, chartType, currentSuggestions) {
        const prompt = this.buildRefreshSuggestionsPrompt(rawDataInput, currentConfig, columns, chartType, currentSuggestions);

        const messages = [
            {
                role: 'system',
                content: '你是一个图表操作建议专家，根据当前图表配置和已有建议提供不同的、有用的操作建议。'
            },
            {
                role: 'user',
                content: prompt
            }
        ];

        try {
            const response = await this.callApi(messages, {
                temperature: 0.7, // 提高温度以获得更多样化的建议
                maxTokens: 10000
            });

            if (!response.success) {
                return response;
            }

            // 尝试解析JSON响应
            const content = response.content.trim();
            let jsonContent = content;

            if (content.includes('```json')) {
                const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
                if (jsonMatch && jsonMatch[1]) {
                    jsonContent = jsonMatch[1].trim();
                }
            } else if (content.includes('```')) {
                const codeMatch = content.match(/```\s*([\s\S]*?)\s*```/);
                if (codeMatch && codeMatch[1]) {
                    jsonContent = codeMatch[1].trim();
                }
            }

            const suggestions = JSON.parse(this.cleanJsonContent(jsonContent));

            return {
                success: true,
                suggestions: suggestions,
                rawResponse: response.content
            };

        } catch (error) {
            console.error('刷新建议时发生错误:', error);
            // 返回不同的默认建议
            return {
                success: true,
                suggestions: this.getAlternativeSuggestions(chartType, currentSuggestions),
                rawResponse: null
            };
        }
    },

    /**
     * 生成图表配置参数
     * @param {Array} data - 数据数组
     * @param {Array} columns - 列名数组
     * @param {string} chartType - 图表类型
     * @returns {Promise<Object>} 配置结果
     */
    async generateChartConfig(data, columns, chartType) {
        const prompt = this.buildChartConfigPrompt(data, columns, chartType);

        const messages = [
            {
                role: 'system',
                content: '你是一个ECharts配置专家，擅长根据数据和图表类型生成详细的配置参数。请严格按照要求返回结果。'
            },
            {
                role: 'user',
                content: prompt
            }
        ];

        let response = null;

        try {
            response = await this.callApi(messages, {
                temperature: 0.2,
                maxTokens: 12000
            });

            if (!response.success) {
                return response;
            }

            // 尝试解析JSON响应
            const content = response.content.trim();
            let jsonContent = content;

            console.log('原始LLM响应内容:', content);

            // 检查是否包含markdown代码块
            if (content.includes('```json')) {
                // 提取markdown代码块中的JSON
                const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
                if (jsonMatch && jsonMatch[1]) {
                    jsonContent = jsonMatch[1].trim();
                    console.log('从markdown代码块提取的JSON:', jsonContent);
                }
            } else if (content.includes('```')) {
                // 提取普通代码块中的JSON
                const codeMatch = content.match(/```\s*([\s\S]*?)\s*```/);
                if (codeMatch && codeMatch[1]) {
                    jsonContent = codeMatch[1].trim();
                    console.log('从普通代码块提取的JSON:', jsonContent);
                }
            }else if (content.startsWith('`') && content.endsWith('`')) {
                jsonContent = content.substring(1, content.length - 1).trim();
            } else {
                // 尝试直接查找JSON结构
                let jsonStart = content.indexOf('{');
                let jsonEnd = content.lastIndexOf('}') + 1;

                if (jsonStart !== -1 && jsonEnd > 0) {
                    jsonContent = content.substring(jsonStart, jsonEnd);
                    console.log('直接提取的JSON:', jsonContent);
                }
            }

            if (!jsonContent || jsonContent === content) {
                console.error('无法提取有效的JSON内容');
                return {
                    success: false,
                    error: 'LLM返回的内容不包含有效的JSON格式',
                    rawResponse: response.content
                };
            }

            // 尝试解析ECharts配置（可能包含函数）
            let config;
            try {
                config = this.parseEChartsConfig(jsonContent);
                console.log('解析后的配置对象:', config);
            } catch (parseError) {
                console.error('ECharts配置解析失败:', parseError);
                return {
                    success: false,
                    error: `AI返回的ECharts配置无法解析: ${parseError.message}`,
                    rawResponse: response.content
                };
            }

            // 验证配置格式
            const validConfig = this.validateChartConfig(config);
            console.log('验证后的配置对象:', validConfig);

            return {
                success: true,
                config: validConfig,
                rawResponse: response.content
            };

        } catch (error) {
            console.error('解析配置响应时发生错误:', error);
            console.error('错误堆栈:', error.stack);
            return {
                success: false,
                error: `解析LLM响应失败: ${error.message}`,
                rawResponse: response?.content || null
            };
        }
    },



    /**
     * 构建图表配置的Prompt
     * @param {Array} data - 完整数据数组
     * @param {Array} columns - 列名数组
     * @param {string} userMessage - 用户消息
     * @param {Object} currentConfig - 当前配置
     * @returns {string} Prompt字符串
     */
    buildChartConfigPrompt(data, columns, userMessage, currentConfig) {
        const numericColumns = columns.filter(col => {
            if (data.length === 0) return false;
            return typeof data[0][col] === 'number';
        });

        let currentConfigInfo = '';
        if (currentConfig) {
            currentConfigInfo = `\n当前图表配置：\n${JSON.stringify(currentConfig, null, 2)}\n`;
        }

        return `用户需求：${userMessage}

完整数据信息：
- 总行数: ${data.length}
- 列名: ${columns.join(', ')}
- 数值列: ${numericColumns.join(', ') || '无'}
- 完整数据：
${JSON.stringify(data, null, 2)}${currentConfigInfo}

请根据用户需求和完整数据生成专业的ECharts配置。请直接返回完整的ECharts option配置对象，包含所有必要的数据。

可以参照以下JSON格式返回：

{
    "title": {
        "text": "图表标题",
        "subtext": "副标题（可选）",
        "left": "center",
        "textStyle": {
            "color": "#333",
            "fontWeight": "bold",
            "fontSize": 18
        }
    },
    "tooltip": {
        "trigger": "axis",
        "axisPointer": {
            "type": "cross",
            "crossStyle": {
                "color": "#999"
            }
        },
        "backgroundColor": "rgba(255,255,255,0.9)",
        "borderColor": "#ccc",
        "borderWidth": 1
    },
    "legend": {
        "show": true,
        "data": ["系列名称"],
        "top": "bottom",
        "padding": [20, 10, 10, 10]
    },
    "toolbox": {
        "feature": {
            "dataView": { "show": true, "readOnly": false, "title": "数据视图" },
            "magicType": { "show": true, "type": ["line", "bar"], "title": {"line": "切换为折线图", "bar": "切换为柱状图"} },
            "restore": { "show": true, "title": "还原" },
            "saveAsImage": { "show": true, "title": "保存为图片" }
        },
        "right": 20
    },
    "grid": {
        "left": "3%",
        "right": "4%",
        "bottom": "12%",
        "containLabel": true
    },
    "xAxis": {
        "type": "category",
        "data": ["实际的X轴数据数组"],
        "name": "X轴名称",
        "axisLabel": {
            "color": "#666"
        }
    },
    "yAxis": {
        "type": "value",
        "name": "Y轴名称",
        "axisLabel": {
            "color": "#666"
        }
    },
    "series": [
        {
            "name": "系列名称",
            "type": "bar",
            "data": ["实际的Y轴数据数组"],
            "itemStyle": {
                "color": "#3498db",
                "borderRadius": [4, 4, 0, 0]
            },
            "emphasis": {
                "focus": "series"
            }
        }
    ],
    "color": ["#3498db", "#e74c3c", "#2ecc71", "#f39c12", "#9b59b6"]
}

注意：
1. 直接返回完整的ECharts option配置
2. 根据用户需求选择合适的图表类型和样式
3. 包含丰富的交互效果和美观的样式
4. 只返回ECharts option配置，不要包含其他文字`;
    },

    /**
     * 构建图表配置的Prompt（带原始数据）
     * @param {string} rawDataInput - 用户输入的原始数据
     * @param {Array} data - 解析后的数据数组（已废弃，传null）
     * @param {Array} columns - 列名数组（已废弃，传null）
     * @param {string} userMessage - 用户消息
     * @param {Object} currentConfig - 当前配置
     * @returns {string} Prompt字符串
     */
    buildChartConfigPromptWithRawData(rawDataInput, data, columns, userMessage, currentConfig) {
        let currentConfigInfo = '';
        if (currentConfig) {
            currentConfigInfo = `\n当前图表配置：\n${JSON.stringify(currentConfig, null, 2)}\n`;
        }

        return `用户需求：${userMessage}

用户输入的原始数据：
\`\`\`
${rawDataInput}
\`\`\`${currentConfigInfo}

请根据用户需求和原始数据生成专业的ECharts配置。

任务要求：
1. 首先分析和解析用户提供的原始数据
2. 识别数据的结构、列名、数据类型等信息
3. 根据数据特征和用户需求选择最合适的图表类型
4. 生成完整的ECharts option配置对象，包含所有必要的数据

请直接返回完整的ECharts option配置对象，包含所有必要的数据。

可以参照以下JSON格式返回：

{
    "title": {
        "text": "图表标题",
        "subtext": "副标题（可选）",
        "left": "center",
        "textStyle": {
            "color": "#333",
            "fontWeight": "bold",
            "fontSize": 18
        }
    },
    "tooltip": {
        "trigger": "axis",
        "axisPointer": {
            "type": "cross",
            "crossStyle": {
                "color": "#999"
            }
        },
        "backgroundColor": "rgba(255,255,255,0.9)",
        "borderColor": "#ccc",
        "borderWidth": 1
    },
    "legend": {
        "show": true,
        "data": ["系列名称"],
        "top": "bottom",
        "padding": [20, 10, 10, 10]
    },
    "toolbox": {
        "feature": {
            "dataView": { "show": true, "readOnly": false, "title": "数据视图" },
            "magicType": { "show": true, "type": ["line", "bar"], "title": {"line": "切换为折线图", "bar": "切换为柱状图"} },
            "restore": { "show": true, "title": "还原" },
            "saveAsImage": { "show": true, "title": "保存为图片" }
        },
        "right": 20
    },
    "grid": {
        "left": "3%",
        "right": "4%",
        "bottom": "12%",
        "containLabel": true
    },
    "xAxis": {
        "type": "category",
        "data": ["实际的X轴数据数组"],
        "name": "X轴名称",
        "axisLabel": {
            "color": "#666"
        }
    },
    "yAxis": {
        "type": "value",
        "name": "Y轴名称",
        "axisLabel": {
            "color": "#666"
        }
    },
    "series": [
        {
            "name": "系列名称",
            "type": "bar",
            "data": ["实际的Y轴数据数组"],
            "itemStyle": {
                "color": "#3498db",
                "borderRadius": [4, 4, 0, 0]
            },
            "emphasis": {
                "focus": "series"
            }
        }
    ],
    "color": ["#3498db", "#e74c3c", "#2ecc71", "#f39c12", "#9b59b6"]
}

注意：
1. 直接返回完整的ECharts option配置
2. 根据用户需求选择合适的图表类型和样式
3. 包含丰富的交互效果和美观的样式
4. 只返回ECharts option配置，不要包含其他文字`;
    },

    /**
     * 构建建议操作的Prompt
     * @param {string} rawDataInput - 原始数据输入
     * @param {Object} currentConfig - 当前图表配置
     * @param {Array} columns - 列名数组（已废弃，传null）
     * @param {string} chartType - 当前图表类型
     * @returns {string} Prompt字符串
     */
    buildSuggestionsPrompt(rawDataInput, currentConfig, columns, chartType) {
        return `基于当前图表配置，请提供5-8个有用的操作建议：

当前图表类型：${chartType}
用户输入的原始数据：
\`\`\`
${rawDataInput}
\`\`\`
当前配置：${JSON.stringify(currentConfig, null, 2)}

请返回JSON格式的建议数组：

[
    {
        "text": "切换为折线图",
        "type": "chart-type"
    },
    {
        "text": "修改标题为XXX",
        "type": "config-option"
    },
    {
        "text": "调整颜色",
        "type": "config-option"
    },
    {
        "text": "显示数据标签",
        "type": "config-option"
    },
    {
        "text": "添加副标题为XXX",
        "type": "config-option"
    }
]

注意：
1. type只能是"chart-type"或"config-option"
2. 建议要实用且相关，建议尽量是具体的
3. 只返回JSON数组，不要其他文字`;
    },

    /**
     * 构建刷新建议的Prompt
     * @param {string} rawDataInput - 原始数据输入
     * @param {Object} currentConfig - 当前图表配置
     * @param {Array} columns - 列名数组（已废弃，传null）
     * @param {string} chartType - 当前图表类型
     * @param {Array} currentSuggestions - 当前显示的建议
     * @returns {string} Prompt字符串
     */
    buildRefreshSuggestionsPrompt(rawDataInput, currentConfig, columns, chartType, currentSuggestions) {
        const currentSuggestionsText = currentSuggestions.map(s => s.text).join('、');

        return `基于当前图表配置，请提供5-8个与现有建议不同的新操作建议：

当前图表类型：${chartType}
用户输入的原始数据：
\`\`\`
${rawDataInput}
\`\`\`
当前配置：${JSON.stringify(currentConfig, null, 2)}

当前已显示的建议：${currentSuggestionsText}

请提供与上述建议不同的新建议，返回JSON格式的建议数组：

[
    {
        "text": "新的操作建议",
        "type": "chart-type"
    },
    {
        "text": "另一个新建议",
        "type": "config-option"
    }
]

要求：
1. type只能是"chart-type"或"config-option"
2. 建议要与当前已显示的建议不同
3. 建议要实用且相关
4. 优先提供更高级或创意的配置选项
5. 只返回JSON数组，不要其他文字`;
    },

    /**
     * 获取默认建议
     * @param {string} chartType - 图表类型
     * @returns {Array} 默认建议数组
     */
    getDefaultSuggestions(chartType) {
        const suggestions = [
            { text: '切换为柱状图', type: 'chart-type' },
            { text: '切换为折线图', type: 'chart-type' },
            { text: '切换为饼图', type: 'chart-type' },
            { text: '修改标题', type: 'config-option' },
            { text: '调整颜色', type: 'config-option' },
            { text: '显示数据标签', type: 'config-option' },
            { text: '隐藏图例', type: 'config-option' },
            { text: '添加副标题', type: 'config-option' }
        ];

        // 过滤掉当前图表类型
        return suggestions.filter(s =>
            s.type !== 'chart-type' ||
            !s.text.includes(this.getChartTypeName(chartType))
        ).slice(0, 6);
    },

    /**
     * 获取替代建议（用于刷新时的备选方案）
     * @param {string} chartType - 图表类型
     * @param {Array} currentSuggestions - 当前建议
     * @returns {Array} 替代建议数组
     */
    getAlternativeSuggestions(chartType, currentSuggestions = []) {
        const allSuggestions = [
            // 图表类型建议
            { text: '切换为柱状图', type: 'chart-type' },
            { text: '切换为折线图', type: 'chart-type' },
            { text: '切换为饼图', type: 'chart-type' },
            { text: '切换为散点图', type: 'chart-type' },
            { text: '切换为面积图', type: 'chart-type' },
            { text: '切换为雷达图', type: 'chart-type' },

            // 配置选项建议
            { text: '修改标题', type: 'config-option' },
            { text: '调整颜色', type: 'config-option' },
            { text: '显示数据标签', type: 'config-option' },
            { text: '隐藏图例', type: 'config-option' },
            { text: '添加副标题', type: 'config-option' },
            { text: '调整透明度', type: 'config-option' },
            { text: '添加网格线', type: 'config-option' },
            { text: '修改坐标轴标签', type: 'config-option' },
            { text: '添加数据缩放', type: 'config-option' },
            { text: '启用动画效果', type: 'config-option' },
            { text: '调整图表边距', type: 'config-option' },
            { text: '修改工具栏', type: 'config-option' },
            { text: '添加背景色', type: 'config-option' },
            { text: '调整字体大小', type: 'config-option' }
        ];

        // 获取当前建议的文本
        const currentTexts = currentSuggestions.map(s => s.text);

        // 过滤掉当前图表类型和已有建议
        const filteredSuggestions = allSuggestions.filter(s => {
            // 排除当前图表类型
            if (s.type === 'chart-type' && s.text.includes(this.getChartTypeName(chartType))) {
                return false;
            }
            // 排除已有建议
            if (currentTexts.includes(s.text)) {
                return false;
            }
            return true;
        });

        // 随机选择6个建议
        const shuffled = filteredSuggestions.sort(() => 0.5 - Math.random());
        return shuffled.slice(0, 6);
    },

    /**
     * 获取图表类型中文名称
     * @param {string} chartType - 图表类型
     * @returns {string} 中文名称
     */
    getChartTypeName(chartType) {
        const names = {
            'bar': '柱状图',
            'line': '折线图',
            'pie': '饼图',
            'scatter': '散点图',
            'radar': '雷达图'
        };
        return names[chartType] || chartType;
    },

    /**
     * 获取主要数据类型
     * @param {Object} dataTypes - 数据类型统计
     * @returns {string} 主要数据类型
     */
    getMainDataType(dataTypes) {
        if (!dataTypes) return 'unknown';

        let maxCount = 0;
        let mainType = 'unknown';

        for (const [type, count] of Object.entries(dataTypes)) {
            if (count > maxCount) {
                maxCount = count;
                mainType = type;
            }
        }

        return mainType;
    },









    /**
     * 获取主要数据类型
     * @param {Object} dataTypes - 数据类型分布
     * @returns {string} 主要数据类型
     */
    getMainDataType(dataTypes) {
        let maxCount = 0;
        let mainType = 'string';

        Object.entries(dataTypes).forEach(([type, count]) => {
            if (count > maxCount) {
                maxCount = count;
                mainType = type;
            }
        });

        return mainType;
    },

    /**
     * 清理JSON内容，移除注释和特殊字符
     * @param {string} jsonString - 原始JSON字符串
     * @returns {string} 清理后的JSON字符串
     */
    cleanJsonContent(jsonString) {
        if (!jsonString) return '';
        
        // 移除JavaScript单行注释
        let cleaned = jsonString.replace(/\/\/.*$/gm, '');
        
        // 移除JavaScript多行注释
        cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');
        
        // 移除可能导致解析错误的特殊字符
        cleaned = cleaned.replace(/[\u0000-\u001F]+/g, ' ');
        
        // 修复常见的JSON语法错误（如尾随逗号）
        cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');
        
        return cleaned.trim();
    },

    /**
     * 判断字符串是否为有效的JSON
     * @param {string} str - 要检查的字符串
     * @returns {boolean} 是否为有效的JSON
     */
    isValidJson(str) {
        if (!str || typeof str !== 'string') return false;

        try {
            JSON.parse(str);
            return true;
        } catch (e) {
            return false;
        }
    },

    /**
     * 解析ECharts配置（支持包含函数的配置）
     * @param {string} configStr - 配置字符串
     * @returns {Object} 解析后的配置对象
     */
    parseEChartsConfig(configStr) {
        if (!configStr || typeof configStr !== 'string') {
            throw new Error('配置字符串为空或无效');
        }

        // 首先尝试标准JSON解析
        try {
            const config = JSON.parse(configStr);
            console.log('使用标准JSON解析成功');
            return config;
        } catch (jsonError) {
            console.log('标准JSON解析失败，尝试处理包含函数的配置:', jsonError.message);
        }

        // 如果标准JSON解析失败，尝试使用eval解析（包含函数的情况）
        try {
            // 安全检查：确保字符串看起来像一个对象
            const trimmed = configStr.trim();
            if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
                throw new Error('配置不是有效的对象格式');
            }

            // 使用Function构造器而不是eval，相对更安全
            const config = new Function('return ' + configStr)();

            // 验证返回的是一个对象
            if (!config || typeof config !== 'object') {
                throw new Error('解析结果不是有效的对象');
            }

            console.log('使用Function构造器解析成功（包含函数）');
            return config;
        } catch (evalError) {
            console.error('Function构造器解析也失败:', evalError.message);
            throw new Error(`ECharts配置解析失败: ${evalError.message}`);
        }
    },

    /**
     * 验证图表配置
     * @param {Object} config - 图表配置
     * @returns {Object} 验证后的配置
     */
    validateChartConfig(config) {
        if (!config || typeof config !== 'object') {
            throw new Error('配置必须是一个对象');
        }

        // 基本的ECharts配置验证
        if (!config.series) {
            console.warn('配置中缺少series，这可能不是有效的ECharts配置');
        }

        // 返回原配置（这里可以添加更多验证逻辑）
        return config;
    }
};

// 导出API客户端模块（如果使用模块系统）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ApiClient;
}



