/**
 * 表单构建器模块
 * 负责根据LLM返回的配置动态生成表单
 */

const FormBuilder = {
    
    // 当前表单配置
    currentFormConfig: null,
    
    // 表单变更回调
    onFormChange: null,

    /**
     * 构建动态表单
     * @param {Object} config - 表单配置
     * @param {Array} columns - 可用列名
     * @param {Function} onChange - 变更回调函数
     */
    buildForm(config, columns, onChange) {
        console.log('FormBuilder.buildForm - 开始');
        console.log('配置对象:', config);
        console.log('列名数组:', columns);

        this.currentFormConfig = config;
        this.onFormChange = onChange;

        const container = document.getElementById('chartConfigForm');
        container.innerHTML = '';

        // 创建表单元素
        const form = document.createElement('form');
        form.className = 'dynamic-form';
        form.addEventListener('submit', (e) => e.preventDefault());

        // 遍历配置项生成表单字段
        Object.entries(config).forEach(([key, fieldConfig]) => {
            console.log(`处理字段: ${key}`, fieldConfig);
            if (fieldConfig.configurable) {
                const formGroup = this.createFormGroup(key, fieldConfig, columns);
                form.appendChild(formGroup);
            }
        });

        container.appendChild(form);

        console.log('FormBuilder.buildForm - 表单创建完成');

        // 延迟触发初始变更事件，确保表单元素已完全创建
        setTimeout(() => {
            console.log('FormBuilder.buildForm - 延迟触发初始变更');
            this.triggerFormChange();
        }, 100);
    },

    /**
     * 创建表单组
     * @param {string} key - 字段键名
     * @param {Object} fieldConfig - 字段配置
     * @param {Array} columns - 可用列名
     * @returns {HTMLElement} 表单组元素
     */
    createFormGroup(key, fieldConfig, columns) {
        const formGroup = document.createElement('div');
        formGroup.className = 'form-group';
        
        // 创建标签
        const label = document.createElement('label');
        label.textContent = this.getFieldLabel(key);
        label.setAttribute('for', `field_${key}`);
        formGroup.appendChild(label);
        
        // 根据类型创建输入控件
        const input = this.createInputElement(key, fieldConfig, columns);
        formGroup.appendChild(input);
        
        // 添加帮助文本
        if (fieldConfig.help) {
            const helpText = document.createElement('div');
            helpText.className = 'form-help';
            helpText.textContent = fieldConfig.help;
            formGroup.appendChild(helpText);
        }
        
        return formGroup;
    },

    /**
     * 创建输入元素
     * @param {string} key - 字段键名
     * @param {Object} fieldConfig - 字段配置
     * @param {Array} columns - 可用列名
     * @returns {HTMLElement} 输入元素
     */
    createInputElement(key, fieldConfig, columns) {
        const type = fieldConfig.type || 'text';
        
        switch (type) {
            case 'text':
                return this.createTextInput(key, fieldConfig);
            case 'number':
                return this.createNumberInput(key, fieldConfig);
            case 'select':
                return this.createSelectInput(key, fieldConfig, columns);
            case 'boolean':
                return this.createBooleanInput(key, fieldConfig);
            case 'color':
                return this.createColorInput(key, fieldConfig);
            case 'range':
                return this.createRangeInput(key, fieldConfig);
            case 'textarea':
                return this.createTextareaInput(key, fieldConfig);
            default:
                return this.createTextInput(key, fieldConfig);
        }
    },

    /**
     * 创建文本输入框
     * @param {string} key - 字段键名
     * @param {Object} fieldConfig - 字段配置
     * @returns {HTMLElement} 文本输入框
     */
    createTextInput(key, fieldConfig) {
        const input = document.createElement('input');
        input.type = 'text';
        input.id = `field_${key}`;
        input.className = 'form-control';
        input.value = this.getFieldValue(key, fieldConfig) || '';
        input.placeholder = fieldConfig.placeholder || '';
        
        input.addEventListener('input', () => this.triggerFormChange());
        
        return input;
    },

    /**
     * 创建数字输入框
     * @param {string} key - 字段键名
     * @param {Object} fieldConfig - 字段配置
     * @returns {HTMLElement} 数字输入框
     */
    createNumberInput(key, fieldConfig) {
        const input = document.createElement('input');
        input.type = 'number';
        input.id = `field_${key}`;
        input.className = 'form-control';
        input.value = this.getFieldValue(key, fieldConfig) || '';
        
        if (fieldConfig.min !== undefined) input.min = fieldConfig.min;
        if (fieldConfig.max !== undefined) input.max = fieldConfig.max;
        if (fieldConfig.step !== undefined) input.step = fieldConfig.step;
        
        input.addEventListener('input', () => this.triggerFormChange());
        
        return input;
    },

    /**
     * 创建选择框
     * @param {string} key - 字段键名
     * @param {Object} fieldConfig - 字段配置
     * @param {Array} columns - 可用列名
     * @returns {HTMLElement} 选择框
     */
    createSelectInput(key, fieldConfig, columns) {
        const select = document.createElement('select');
        select.id = `field_${key}`;
        select.className = 'form-control';
        
        // 获取选项列表
        const options = fieldConfig.options || columns || [];
        const currentValue = this.getFieldValue(key, fieldConfig);
        
        // 添加空选项
        if (!fieldConfig.required) {
            const emptyOption = document.createElement('option');
            emptyOption.value = '';
            emptyOption.textContent = '请选择...';
            select.appendChild(emptyOption);
        }
        
        // 添加选项
        options.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option;
            optionElement.textContent = option;
            
            if (option === currentValue) {
                optionElement.selected = true;
            }
            
            select.appendChild(optionElement);
        });
        
        select.addEventListener('change', () => this.triggerFormChange());
        
        return select;
    },

    /**
     * 创建布尔开关
     * @param {string} key - 字段键名
     * @param {Object} fieldConfig - 字段配置
     * @returns {HTMLElement} 布尔开关
     */
    createBooleanInput(key, fieldConfig) {
        const container = document.createElement('div');
        container.className = 'switch-container';
        
        const switchElement = document.createElement('label');
        switchElement.className = 'switch';
        
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.id = `field_${key}`;
        input.checked = this.getFieldValue(key, fieldConfig) || false;
        
        const slider = document.createElement('span');
        slider.className = 'slider';
        
        switchElement.appendChild(input);
        switchElement.appendChild(slider);
        container.appendChild(switchElement);
        
        input.addEventListener('change', () => this.triggerFormChange());
        
        return container;
    },

    /**
     * 创建颜色选择器
     * @param {string} key - 字段键名
     * @param {Object} fieldConfig - 字段配置
     * @returns {HTMLElement} 颜色选择器
     */
    createColorInput(key, fieldConfig) {
        const container = document.createElement('div');
        container.className = 'color-picker-container';
        
        const input = document.createElement('input');
        input.type = 'color';
        input.id = `field_${key}`;
        input.value = this.getFieldValue(key, fieldConfig) || '#3498db';
        
        const preview = document.createElement('div');
        preview.className = 'color-preview';
        preview.style.backgroundColor = input.value;
        
        container.appendChild(input);
        container.appendChild(preview);
        
        input.addEventListener('input', () => {
            preview.style.backgroundColor = input.value;
            this.triggerFormChange();
        });
        
        return container;
    },

    /**
     * 创建范围滑块
     * @param {string} key - 字段键名
     * @param {Object} fieldConfig - 字段配置
     * @returns {HTMLElement} 范围滑块
     */
    createRangeInput(key, fieldConfig) {
        const container = document.createElement('div');
        container.className = 'range-container';
        
        const input = document.createElement('input');
        input.type = 'range';
        input.id = `field_${key}`;
        input.min = fieldConfig.min || 0;
        input.max = fieldConfig.max || 100;
        input.step = fieldConfig.step || 1;
        input.value = this.getFieldValue(key, fieldConfig) || fieldConfig.min || 0;
        
        const valueDisplay = document.createElement('span');
        valueDisplay.className = 'range-value';
        valueDisplay.textContent = input.value;
        
        container.appendChild(input);
        container.appendChild(valueDisplay);
        
        input.addEventListener('input', () => {
            valueDisplay.textContent = input.value;
            this.triggerFormChange();
        });
        
        return container;
    },

    /**
     * 创建文本域
     * @param {string} key - 字段键名
     * @param {Object} fieldConfig - 字段配置
     * @returns {HTMLElement} 文本域
     */
    createTextareaInput(key, fieldConfig) {
        const textarea = document.createElement('textarea');
        textarea.id = `field_${key}`;
        textarea.className = 'form-control';
        textarea.value = this.getFieldValue(key, fieldConfig) || '';
        textarea.rows = fieldConfig.rows || 3;
        textarea.placeholder = fieldConfig.placeholder || '';
        
        textarea.addEventListener('input', () => this.triggerFormChange());
        
        return textarea;
    },

    /**
     * 获取字段标签
     * @param {string} key - 字段键名
     * @returns {string} 字段标签
     */
    getFieldLabel(key) {
        const labels = {
            'title': '图表标题',
            'subtitle': '副标题',
            'xAxis': 'X轴',
            'yAxis': 'Y轴',
            'series': '系列名称',
            'legend': '显示图例',
            'legendPosition': '图例位置',
            'colors': '主要颜色',
            'dataLabels': '数据标签',
            'grid': '网格',
            'tooltip': '提示框',
            'animation': '动画效果'
        };

        // 如果没有预定义标签，尝试生成友好的标签
        if (labels[key]) {
            return labels[key];
        }

        // 将驼峰命名转换为友好的标签
        return key.replace(/([A-Z])/g, ' $1')
                  .replace(/^./, str => str.toUpperCase())
                  .trim();
    },

    /**
     * 获取字段值
     * @param {string} key - 字段键名
     * @param {Object} fieldConfig - 字段配置
     * @returns {any} 字段值
     */
    getFieldValue(key, fieldConfig) {
        // 从配置中获取默认值
        if (fieldConfig.text !== undefined) return fieldConfig.text;
        if (fieldConfig.column !== undefined) return fieldConfig.column;
        if (fieldConfig.name !== undefined) return fieldConfig.name;
        if (fieldConfig.show !== undefined) return fieldConfig.show;
        if (fieldConfig.primary !== undefined) return fieldConfig.primary;
        
        return fieldConfig.value || fieldConfig.default;
    },

    /**
     * 获取表单数据
     * @returns {Object} 表单数据
     */
    getFormData() {
        const formData = {};
        const form = document.querySelector('.dynamic-form');
        
        if (!form) return formData;
        
        // 遍历所有表单控件
        const inputs = form.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            const key = input.id.replace('field_', '');
            let value = input.value;
            
            // 根据输入类型转换值
            if (input.type === 'checkbox') {
                value = input.checked;
            } else if (input.type === 'number' || input.type === 'range') {
                value = parseFloat(value) || 0;
            }
            
            // 构建嵌套对象
            this.setNestedValue(formData, key, value);
        });
        
        return formData;
    },

    /**
     * 设置嵌套对象值
     * @param {Object} obj - 目标对象
     * @param {string} key - 键名
     * @param {any} value - 值
     */
    setNestedValue(obj, key, value) {
        // 处理嵌套键名，如 "title.text"
        const keys = key.split('.');
        let current = obj;
        
        for (let i = 0; i < keys.length - 1; i++) {
            const k = keys[i];
            if (!current[k] || typeof current[k] !== 'object') {
                current[k] = {};
            }
            current = current[k];
        }
        
        current[keys[keys.length - 1]] = value;
    },

    /**
     * 触发表单变更事件
     */
    triggerFormChange() {
        console.log('FormBuilder.triggerFormChange - 开始');
        if (this.onFormChange && typeof this.onFormChange === 'function') {
            const formData = this.getFormData();
            console.log('FormBuilder.triggerFormChange - 表单数据:', formData);
            this.onFormChange(formData);
        } else {
            console.log('FormBuilder.triggerFormChange - 没有变更回调函数');
        }
    },

    /**
     * 验证表单
     * @returns {Object} 验证结果
     */
    validateForm() {
        const formData = this.getFormData();
        const errors = [];
        
        // 基本验证规则
        if (!formData.xAxis || !formData.xAxis.column) {
            errors.push('请选择X轴列');
        }
        
        if (!formData.yAxis || !formData.yAxis.column) {
            errors.push('请选择Y轴列');
        }
        
        return {
            valid: errors.length === 0,
            errors: errors,
            data: formData
        };
    },

    /**
     * 清除表单
     */
    clearForm() {
        const container = document.getElementById('chartConfigForm');
        container.innerHTML = '';
        this.currentFormConfig = null;
        this.onFormChange = null;
    },

    /**
     * 显示表单验证错误
     * @param {Array} errors - 错误列表
     */
    showValidationErrors(errors) {
        // 清除之前的错误提示
        document.querySelectorAll('.error-message').forEach(el => el.remove());
        document.querySelectorAll('.form-control.error').forEach(el => {
            el.classList.remove('error');
        });
        
        // 显示新的错误提示
        errors.forEach(error => {
            Utils.showNotification(error, 'error', 5000);
        });
    }
};

// 导出表单构建器模块（如果使用模块系统）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FormBuilder;
}
