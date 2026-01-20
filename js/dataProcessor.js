/**
 * 数据处理模块
 * 负责解析和处理用户输入的各种格式数据
 */

const DataProcessor = {
    
    /**
     * 解析用户输入的数据
     * @param {string} rawData - 原始数据字符串
     * @returns {Object} 解析结果 { success: boolean, data: Array, columns: Array, error?: string }
     */
    parseData(rawData) {
        if (!rawData || !rawData.trim()) {
            return {
                success: false,
                error: '数据不能为空'
            };
        }

        const trimmedData = rawData.trim();
        
        // 尝试解析JSON格式
        if (this.isJsonFormat(trimmedData)) {
            return this.parseJsonData(trimmedData);
        }
        
        // 尝试解析CSV格式
        if (this.isCsvFormat(trimmedData)) {
            return this.parseCsvData(trimmedData);
        }
        
        // 尝试解析TSV格式
        if (this.isTsvFormat(trimmedData)) {
            return this.parseTsvData(trimmedData);
        }
        
        // 如果都不匹配，尝试作为CSV处理
        return this.parseCsvData(trimmedData);
    },

    /**
     * 判断是否为JSON格式
     * @param {string} data - 数据字符串
     * @returns {boolean}
     */
    isJsonFormat(data) {
        return (data.startsWith('[') && data.endsWith(']')) || 
               (data.startsWith('{') && data.endsWith('}'));
    },

    /**
     * 判断是否为CSV格式
     * @param {string} data - 数据字符串
     * @returns {boolean}
     */
    isCsvFormat(data) {
        const lines = data.split('\n');
        if (lines.length < 2) return false;
        
        const firstLine = lines[0];
        const secondLine = lines[1];
        
        const firstCommas = (firstLine.match(/,/g) || []).length;
        const secondCommas = (secondLine.match(/,/g) || []).length;
        
        return firstCommas > 0 && firstCommas === secondCommas;
    },

    /**
     * 判断是否为TSV格式
     * @param {string} data - 数据字符串
     * @returns {boolean}
     */
    isTsvFormat(data) {
        const lines = data.split('\n');
        if (lines.length < 2) return false;
        
        const firstLine = lines[0];
        const secondLine = lines[1];
        
        const firstTabs = (firstLine.match(/\t/g) || []).length;
        const secondTabs = (secondLine.match(/\t/g) || []).length;
        
        return firstTabs > 0 && firstTabs === secondTabs;
    },

    /**
     * 解析JSON数据
     * @param {string} jsonData - JSON字符串
     * @returns {Object} 解析结果
     */
    parseJsonData(jsonData) {
        try {
            const parsed = JSON.parse(jsonData);
            
            if (!Array.isArray(parsed)) {
                return {
                    success: false,
                    error: 'JSON数据必须是数组格式'
                };
            }
            
            if (parsed.length === 0) {
                return {
                    success: false,
                    error: 'JSON数组不能为空'
                };
            }
            
            // 提取列名
            const firstItem = parsed[0];
            if (typeof firstItem !== 'object' || firstItem === null) {
                return {
                    success: false,
                    error: 'JSON数组中的元素必须是对象'
                };
            }
            
            const columns = Object.keys(firstItem);
            
            // 验证数据一致性
            for (let i = 1; i < parsed.length; i++) {
                const item = parsed[i];
                if (typeof item !== 'object' || item === null) {
                    return {
                        success: false,
                        error: `第${i + 1}行数据格式错误`
                    };
                }
                
                const itemKeys = Object.keys(item);
                if (itemKeys.length !== columns.length || 
                    !itemKeys.every(key => columns.includes(key))) {
                    return {
                        success: false,
                        error: `第${i + 1}行数据列不匹配`
                    };
                }
            }
            
            return {
                success: true,
                data: parsed,
                columns: columns,
                format: 'json'
            };
            
        } catch (error) {
            return {
                success: false,
                error: `JSON解析错误: ${error.message}`
            };
        }
    },

    /**
     * 解析CSV数据
     * @param {string} csvData - CSV字符串
     * @returns {Object} 解析结果
     */
    parseCsvData(csvData) {
        try {
            const lines = csvData.split('\n').filter(line => line.trim());
            
            if (lines.length < 2) {
                return {
                    success: false,
                    error: 'CSV数据至少需要包含标题行和一行数据'
                };
            }
            
            // 解析标题行
            const headers = this.parseCsvLine(lines[0]);
            const columns = headers.map(header => header.trim());
            
            // 解析数据行
            const data = [];
            for (let i = 1; i < lines.length; i++) {
                const values = this.parseCsvLine(lines[i]);
                
                if (values.length !== columns.length) {
                    return {
                        success: false,
                        error: `第${i + 1}行数据列数不匹配，期望${columns.length}列，实际${values.length}列`
                    };
                }
                
                const row = {};
                for (let j = 0; j < columns.length; j++) {
                    row[columns[j]] = this.parseValue(values[j].trim());
                }
                data.push(row);
            }
            
            return {
                success: true,
                data: data,
                columns: columns,
                format: 'csv'
            };
            
        } catch (error) {
            return {
                success: false,
                error: `CSV解析错误: ${error.message}`
            };
        }
    },

    /**
     * 解析TSV数据
     * @param {string} tsvData - TSV字符串
     * @returns {Object} 解析结果
     */
    parseTsvData(tsvData) {
        try {
            const lines = tsvData.split('\n').filter(line => line.trim());
            
            if (lines.length < 2) {
                return {
                    success: false,
                    error: 'TSV数据至少需要包含标题行和一行数据'
                };
            }
            
            // 解析标题行
            const columns = lines[0].split('\t').map(header => header.trim());
            
            // 解析数据行
            const data = [];
            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split('\t');
                
                if (values.length !== columns.length) {
                    return {
                        success: false,
                        error: `第${i + 1}行数据列数不匹配，期望${columns.length}列，实际${values.length}列`
                    };
                }
                
                const row = {};
                for (let j = 0; j < columns.length; j++) {
                    row[columns[j]] = this.parseValue(values[j].trim());
                }
                data.push(row);
            }
            
            return {
                success: true,
                data: data,
                columns: columns,
                format: 'tsv'
            };
            
        } catch (error) {
            return {
                success: false,
                error: `TSV解析错误: ${error.message}`
            };
        }
    },

    /**
     * 解析CSV行（处理引号包围的字段）
     * @param {string} line - CSV行
     * @returns {Array} 字段数组
     */
    parseCsvLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    // 转义的引号
                    current += '"';
                    i++; // 跳过下一个引号
                } else {
                    // 切换引号状态
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                // 字段分隔符
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        
        result.push(current);
        return result;
    },

    /**
     * 解析值（尝试转换为适当的数据类型）
     * @param {string} value - 字符串值
     * @returns {any} 解析后的值
     */
    parseValue(value) {
        if (value === '') return null;
        
        // 尝试解析为数字
        if (!isNaN(value) && !isNaN(parseFloat(value))) {
            const num = parseFloat(value);
            return Number.isInteger(num) ? parseInt(value) : num;
        }
        
        // 尝试解析为布尔值
        const lowerValue = value.toLowerCase();
        if (lowerValue === 'true' || lowerValue === 'false') {
            return lowerValue === 'true';
        }
        
        // 尝试解析为日期
        if (this.isDateString(value)) {
            const date = new Date(value);
            if (!isNaN(date.getTime())) {
                return date;
            }
        }
        
        // 返回原始字符串
        return value;
    },

    /**
     * 判断是否为日期字符串
     * @param {string} value - 字符串值
     * @returns {boolean}
     */
    isDateString(value) {
        // 简单的日期格式检测
        const datePatterns = [
            /^\d{4}-\d{2}-\d{2}$/,           // YYYY-MM-DD
            /^\d{4}\/\d{2}\/\d{2}$/,         // YYYY/MM/DD
            /^\d{2}\/\d{2}\/\d{4}$/,         // MM/DD/YYYY
            /^\d{2}-\d{2}-\d{4}$/,           // MM-DD-YYYY
            /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/ // YYYY-MM-DD HH:MM:SS
        ];
        
        return datePatterns.some(pattern => pattern.test(value));
    },

    /**
     * 获取数据统计信息
     * @param {Array} data - 数据数组
     * @param {Array} columns - 列名数组
     * @returns {Object} 统计信息
     */
    getDataStats(data, columns) {
        if (!data || !Array.isArray(data) || data.length === 0) {
            return null;
        }
        
        const stats = {
            rowCount: data.length,
            columnCount: columns.length,
            columns: {}
        };
        
        // 分析每列的数据类型和统计信息
        columns.forEach(column => {
            const values = data.map(row => row[column]).filter(val => val !== null && val !== undefined);
            const nonNullCount = values.length;
            const nullCount = data.length - nonNullCount;
            
            const columnStats = {
                name: column,
                nonNullCount: nonNullCount,
                nullCount: nullCount,
                dataTypes: this.getColumnDataTypes(values),
                uniqueCount: new Set(values).size
            };
            
            // 如果是数值列，计算统计信息
            const numericValues = values.filter(val => typeof val === 'number');
            if (numericValues.length > 0) {
                columnStats.numeric = {
                    min: Math.min(...numericValues),
                    max: Math.max(...numericValues),
                    mean: numericValues.reduce((sum, val) => sum + val, 0) / numericValues.length,
                    sum: numericValues.reduce((sum, val) => sum + val, 0)
                };
            }
            
            stats.columns[column] = columnStats;
        });
        
        return stats;
    },

    /**
     * 获取列的数据类型分布
     * @param {Array} values - 列值数组
     * @returns {Object} 数据类型分布
     */
    getColumnDataTypes(values) {
        const types = {
            string: 0,
            number: 0,
            boolean: 0,
            date: 0,
            null: 0
        };
        
        values.forEach(value => {
            if (value === null || value === undefined) {
                types.null++;
            } else if (typeof value === 'number') {
                types.number++;
            } else if (typeof value === 'boolean') {
                types.boolean++;
            } else if (value instanceof Date) {
                types.date++;
            } else {
                types.string++;
            }
        });
        
        return types;
    },

    /**
     * 验证数据是否适合生成图表
     * @param {Array} data - 数据数组
     * @param {Array} columns - 列名数组
     * @returns {Object} 验证结果
     */
    validateDataForChart(data, columns) {
        if (!data || !Array.isArray(data) || data.length === 0) {
            return {
                valid: false,
                error: '数据为空'
            };
        }
        
        if (!columns || !Array.isArray(columns) || columns.length === 0) {
            return {
                valid: false,
                error: '列信息为空'
            };
        }
        
        if (data.length < 2) {
            return {
                valid: false,
                error: '数据行数太少，至少需要2行数据'
            };
        }
        
        if (columns.length < 2) {
            return {
                valid: false,
                error: '数据列数太少，至少需要2列数据'
            };
        }
        
        // 检查是否有数值列
        const stats = this.getDataStats(data, columns);
        const numericColumns = Object.values(stats.columns)
            .filter(col => col.numeric && col.numeric.sum !== undefined);
        
        if (numericColumns.length === 0) {
            return {
                valid: false,
                error: '数据中没有数值列，无法生成图表'
            };
        }
        
        return {
            valid: true,
            stats: stats,
            numericColumns: numericColumns.map(col => col.name)
        };
    }
};

// 导出数据处理模块（如果使用模块系统）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DataProcessor;
}
