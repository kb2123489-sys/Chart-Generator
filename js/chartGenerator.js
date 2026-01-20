/**
 * 图表生成器模块
 * 负责使用ECharts生成和渲染图表
 */

const ChartGenerator = {

    // 当前图表实例
    currentChart: null,

    // 当前图表配置
    currentConfig: null,

    // 当前数据
    currentData: null,

    // 窗口大小变化监听器
    resizeListener: null,

    /**
     * 初始化图表容器
     */
    initChart() {
        const container = document.getElementById('chartContainer');
        if (this.currentChart) {
            this.currentChart.dispose();
        }

        // 清除占位符内容
        container.innerHTML = '';

        // 确保容器有明确的尺寸
        this.ensureContainerSize(container);

        // 创建ECharts实例，使用SVG渲染器以支持SVG导出
        this.currentChart = echarts.init(container, null, { renderer: 'svg' });

        // 移除之前的监听器（如果存在）
        if (this.resizeListener) {
            window.removeEventListener('resize', this.resizeListener);
        }

        // 添加窗口大小变化监听（带防抖）
        this.resizeListener = this.debounce(() => {
            if (this.currentChart && !this.currentChart.isDisposed()) {
                console.log('窗口大小变化，调整图表大小');
                this.ensureContainerSize(container);
                this.currentChart.resize();
            }
        }, 150);
        window.addEventListener('resize', this.resizeListener);

        // 添加容器大小变化监听（使用ResizeObserver）
        if (window.ResizeObserver) {
            if (this.containerObserver) {
                this.containerObserver.disconnect();
            }
            this.containerObserver = new ResizeObserver(this.debounce((entries) => {
                if (this.currentChart && !this.currentChart.isDisposed()) {
                    console.log('容器大小变化，调整图表大小');
                    for (let entry of entries) {
                        const { width, height } = entry.contentRect;
                        console.log('新的容器尺寸:', { width, height });
                    }
                    this.currentChart.resize();
                }
            }, 100));
            this.containerObserver.observe(container);
        }

        return this.currentChart;
    },

    /**
     * 确保容器有明确的尺寸
     */
    ensureContainerSize(container) {
        const rect = container.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
            // 如果容器没有尺寸，设置默认尺寸
            container.style.width = '100%';
            container.style.height = '400px';
        }
    },

    /**
     * 防抖函数
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    /**
     * 手动调整图表大小
     */
    resizeChart() {
        if (this.currentChart && !this.currentChart.isDisposed()) {
            const container = document.getElementById('chartContainer');
            this.ensureContainerSize(container);

            // 获取容器当前尺寸用于调试
            const rect = container.getBoundingClientRect();
            console.log('图表容器尺寸:', {
                width: rect.width,
                height: rect.height,
                containerStyle: {
                    width: container.style.width,
                    height: container.style.height
                }
            });

            // 延迟执行resize，确保DOM更新完成
            setTimeout(() => {
                if (this.currentChart && !this.currentChart.isDisposed()) {
                    this.currentChart.resize();
                    console.log('图表已调整大小');
                }
            }, 50);
        }
    },

    /**
     * 生成图表
     * @param {Array} data - 数据数组
     * @param {Object} config - 图表配置
     * @param {string} chartType - 图表类型
     * @returns {boolean} 是否成功
     */
    generateChart(data, config, chartType) {
        try {
            console.log('生成图表 - 开始');
            console.log('图表类型:', chartType);
            console.log('数据行数:', data ? data.length : 0);
            console.log('配置对象:', config);

            if (!this.currentChart) {
                this.initChart();
            }

            this.currentData = data;
            this.currentConfig = config;

            let option;

            // 如果config已经是完整的ECharts配置，直接使用
            if (this.isCompleteEChartsConfig(config)) {
                console.log('检测到完整的ECharts配置，直接使用LLM返回的配置');
                option = this.buildCompleteEChartsOption(data, config);
            } else {
                console.log('使用简化配置构建图表');
                option = this.buildEChartsOption(data, config, chartType);
            }

            console.log('最终绘制对象:', option);
            this.currentChart.setOption(option, true);

            // 确保图表正确调整大小
            this.resizeChart();

            // 启用导出按钮
            this.enableExportButtons();

            return true;
        } catch (error) {
            console.error('生成图表失败:', error);
            Utils.showNotification(`生成图表失败: ${error.message}`, 'error');
            return false;
        }
    },

    /**
     * 直接从配置生成图表（用于LLM返回的完整配置）
     * @param {Object} config - 完整的ECharts配置
     * @param {string} chartType - 图表类型
     * @returns {boolean} 是否成功
     */
    generateChartFromConfig(config, chartType) {
        try {
            console.log('从配置生成图表 - 开始');
            console.log('图表类型:', chartType);
            console.log('配置对象:', config);

            if (!this.currentChart) {
                this.initChart();
            }

            this.currentConfig = config;

            // 直接使用LLM返回的完整配置
            console.log('使用LLM返回的完整ECharts配置');
            this.currentChart.setOption(config, true);

            // 确保图表正确调整大小
            this.resizeChart();

            // 启用导出按钮
            this.enableExportButtons();

            return true;
        } catch (error) {
            console.error('从配置生成图表失败:', error);
            Utils.showNotification(`生成图表失败: ${error.message}`, 'error');
            return false;
        }
    },

    /**
     * 构建ECharts配置选项
     * @param {Array} data - 数据数组
     * @param {Object} config - 图表配置
     * @param {string} chartType - 图表类型
     * @returns {Object} ECharts选项
     */
    buildEChartsOption(data, config, chartType) {
        console.log('构建ECharts选项 - 配置:', config);

        // 如果config已经是完整的ECharts配置，直接使用
        if (this.isCompleteEChartsConfig(config)) {
            console.log('检测到完整的ECharts配置，直接使用');
            return this.buildCompleteEChartsOption(data, config);
        }

        // 否则使用简化配置构建
        const baseOption = {
            title: {
                text: config.title?.text || '图表标题',
                left: 'center',
                textStyle: {
                    fontSize: 16,
                    fontWeight: 'bold'
                }
            },
            tooltip: {
                trigger: 'axis',
                axisPointer: {
                    type: 'shadow'
                }
            },
            legend: {
                show: config.legend?.show !== false,
                top: 'bottom'
            },
            grid: {
                left: '3%',
                right: '4%',
                bottom: '10%',
                containLabel: true
            },
            color: this.getChartColors(config)
        };

        // 根据图表类型构建具体配置
        switch (chartType) {
            case 'bar':
                return this.buildBarChart(baseOption, data, config);
            case 'line':
                return this.buildLineChart(baseOption, data, config);
            case 'pie':
                return this.buildPieChart(baseOption, data, config);
            case 'scatter':
                return this.buildScatterChart(baseOption, data, config);
            case 'radar':
                return this.buildRadarChart(baseOption, data, config);
            case 'treemap':
                return this.buildTreemapChart(baseOption, data, config);
            case 'funnel':
                return this.buildFunnelChart(baseOption, data, config);
            case 'gauge':
                return this.buildGaugeChart(baseOption, data, config);
            case 'mixed':
                return this.buildMixedChart(baseOption, data, config);
            default:
                return this.buildBarChart(baseOption, data, config);
        }
    },

    /**
     * 检查是否为完整的ECharts配置
     * @param {Object} config - 配置对象
     * @returns {boolean} 是否为完整配置
     */
    isCompleteEChartsConfig(config) {
        if (!config || typeof config !== 'object') {
            return false;
        }

        // 检查是否包含ECharts的标准配置项
        const hasSeries = config.hasOwnProperty('series');

        if (!hasSeries) {
            return false;
        }

        // 检查是否为坐标系图表（需要xAxis和yAxis）
        const hasAxes = config.hasOwnProperty('xAxis') && config.hasOwnProperty('yAxis');

        // 检查是否为非坐标系图表（如饼图、仪表盘等）
        const seriesArray = Array.isArray(config.series) ? config.series : [config.series];
        const hasNonAxisChart = seriesArray.some(s =>
            s && (s.type === 'pie' || s.type === 'gauge' || s.type === 'radar' ||
                  s.type === 'treemap' || s.type === 'funnel' || s.type === 'sankey')
        );

        // 如果有坐标轴或者是非坐标系图表，则认为是完整配置
        const isComplete = hasAxes || hasNonAxisChart;

        console.log('ECharts配置检查:', {
            hasSeries,
            hasAxes,
            hasNonAxisChart,
            isComplete,
            seriesTypes: seriesArray.map(s => s?.type).filter(Boolean)
        });

        return isComplete;
    },

    /**
     * 构建完整的ECharts配置选项
     * @param {Array} data - 数据数组
     * @param {Object} config - 完整配置
     * @returns {Object} ECharts选项
     */
    buildCompleteEChartsOption(data, config) {
        //console.log('处理LLM返回的完整ECharts配置，直接使用');
        //console.log('LLM配置:', config);

        // 直接使用LLM返回的完整配置
        // LLM应该已经生成了包含所有数据的完整ECharts配置
        const option = { ...config };

        //console.log('最终使用的ECharts选项:', option);
        return option;
    },

    /**
     * 构建柱状图配置
     * @param {Object} baseOption - 基础配置
     * @param {Array} data - 数据数组
     * @param {Object} config - 图表配置
     * @returns {Object} 柱状图配置
     */
    buildBarChart(baseOption, data, config) {
        console.log('构建柱状图 - 配置对象:', config);
        console.log('构建柱状图 - 数据样例:', data.slice(0, 2));

        const xAxisColumn = config.xAxis?.column;
        const yAxisColumn = config.yAxis?.column;

        console.log('X轴列名:', xAxisColumn);
        console.log('Y轴列名:', yAxisColumn);

        if (!xAxisColumn || !yAxisColumn) {
            console.error('柱状图配置错误:', {
                xAxisColumn,
                yAxisColumn,
                config
            });
            throw new Error(`柱状图需要指定X轴和Y轴列。当前X轴: ${xAxisColumn}, Y轴: ${yAxisColumn}`);
        }
        
        const categories = data.map(item => item[xAxisColumn]);
        const values = data.map(item => item[yAxisColumn]);
        
        return {
            ...baseOption,
            xAxis: {
                type: 'category',
                data: categories,
                axisLabel: {
                    rotate: categories.some(cat => String(cat).length > 6) ? 45 : 0
                }
            },
            yAxis: {
                type: 'value',
                name: yAxisColumn
            },
            series: [{
                name: config.series?.name || yAxisColumn,
                type: 'bar',
                data: values,
                itemStyle: {
                    borderRadius: [4, 4, 0, 0]
                }
            }]
        };
    },

    /**
     * 构建折线图配置
     * @param {Object} baseOption - 基础配置
     * @param {Array} data - 数据数组
     * @param {Object} config - 图表配置
     * @returns {Object} 折线图配置
     */
    buildLineChart(baseOption, data, config) {
        const xAxisColumn = config.xAxis?.column;
        const yAxisColumn = config.yAxis?.column;
        
        if (!xAxisColumn || !yAxisColumn) {
            throw new Error('折线图需要指定X轴和Y轴列');
        }
        
        const categories = data.map(item => item[xAxisColumn]);
        const values = data.map(item => item[yAxisColumn]);
        
        return {
            ...baseOption,
            xAxis: {
                type: 'category',
                data: categories,
                boundaryGap: false
            },
            yAxis: {
                type: 'value',
                name: yAxisColumn
            },
            series: [{
                name: config.series?.name || yAxisColumn,
                type: 'line',
                data: values,
                smooth: true,
                symbol: 'circle',
                symbolSize: 6,
                lineStyle: {
                    width: 3
                },
                areaStyle: {
                    opacity: 0.3
                }
            }]
        };
    },

    /**
     * 构建饼图配置
     * @param {Object} baseOption - 基础配置
     * @param {Array} data - 数据数组
     * @param {Object} config - 图表配置
     * @returns {Object} 饼图配置
     */
    buildPieChart(baseOption, data, config) {
        const nameColumn = config.xAxis?.column;
        const valueColumn = config.yAxis?.column;
        
        if (!nameColumn || !valueColumn) {
            throw new Error('饼图需要指定名称列和数值列');
        }
        
        const pieData = data.map(item => ({
            name: item[nameColumn],
            value: item[valueColumn]
        }));
        
        return {
            ...baseOption,
            tooltip: {
                trigger: 'item',
                formatter: '{a} <br/>{b}: {c} ({d}%)'
            },
            series: [{
                name: config.series?.name || '数据',
                type: 'pie',
                radius: ['40%', '70%'],
                center: ['50%', '50%'],
                data: pieData,
                emphasis: {
                    itemStyle: {
                        shadowBlur: 10,
                        shadowOffsetX: 0,
                        shadowColor: 'rgba(0, 0, 0, 0.5)'
                    }
                },
                label: {
                    formatter: '{b}: {d}%'
                }
            }]
        };
    },

    /**
     * 构建散点图配置
     * @param {Object} baseOption - 基础配置
     * @param {Array} data - 数据数组
     * @param {Object} config - 图表配置
     * @returns {Object} 散点图配置
     */
    buildScatterChart(baseOption, data, config) {
        const xAxisColumn = config.xAxis?.column;
        const yAxisColumn = config.yAxis?.column;
        
        if (!xAxisColumn || !yAxisColumn) {
            throw new Error('散点图需要指定X轴和Y轴列');
        }
        
        const scatterData = data.map(item => [item[xAxisColumn], item[yAxisColumn]]);
        
        return {
            ...baseOption,
            xAxis: {
                type: 'value',
                name: xAxisColumn,
                splitLine: {
                    lineStyle: {
                        type: 'dashed'
                    }
                }
            },
            yAxis: {
                type: 'value',
                name: yAxisColumn,
                splitLine: {
                    lineStyle: {
                        type: 'dashed'
                    }
                }
            },
            series: [{
                name: config.series?.name || '数据点',
                type: 'scatter',
                data: scatterData,
                symbolSize: 8,
                emphasis: {
                    itemStyle: {
                        shadowBlur: 10,
                        shadowColor: 'rgba(120, 36, 50, 0.5)',
                        shadowOffsetY: 5
                    }
                }
            }]
        };
    },

    /**
     * 构建雷达图配置
     * @param {Object} baseOption - 基础配置
     * @param {Array} data - 数据数组
     * @param {Object} config - 图表配置
     * @returns {Object} 雷达图配置
     */
    buildRadarChart(baseOption, data, config) {
        // 雷达图需要多个数值列
        const numericColumns = Object.keys(data[0]).filter(col => 
            typeof data[0][col] === 'number'
        );
        
        if (numericColumns.length < 3) {
            throw new Error('雷达图至少需要3个数值列');
        }
        
        const indicators = numericColumns.map(col => ({
            name: col,
            max: Math.max(...data.map(item => item[col]))
        }));
        
        const radarData = data.map((item, index) => ({
            name: `数据${index + 1}`,
            value: numericColumns.map(col => item[col])
        }));
        
        return {
            ...baseOption,
            radar: {
                indicator: indicators,
                radius: '60%'
            },
            series: [{
                name: config.series?.name || '雷达数据',
                type: 'radar',
                data: radarData.slice(0, 5), // 最多显示5条数据
                areaStyle: {
                    opacity: 0.3
                }
            }]
        };
    },

    /**
     * 构建树图配置
     * @param {Object} baseOption - 基础配置
     * @param {Array} data - 数据数组
     * @param {Object} config - 图表配置
     * @returns {Object} 树图配置
     */
    buildTreemapChart(baseOption, data, config) {
        const nameColumn = config.xAxis?.column;
        const valueColumn = config.yAxis?.column;

        if (!nameColumn || !valueColumn) {
            throw new Error('树图需要指定名称列和数值列');
        }

        const treemapData = data.map(item => ({
            name: item[nameColumn],
            value: item[valueColumn]
        }));

        return {
            ...baseOption,
            tooltip: {
                trigger: 'item',
                formatter: '{b}: {c}'
            },
            series: [{
                name: config.series?.name || '树图数据',
                type: 'treemap',
                data: treemapData,
                roam: false,
                nodeClick: false,
                breadcrumb: {
                    show: false
                },
                label: {
                    show: true,
                    formatter: '{b}\n{c}'
                },
                itemStyle: {
                    borderColor: '#fff',
                    borderWidth: 2
                }
            }]
        };
    },

    /**
     * 构建漏斗图配置
     * @param {Object} baseOption - 基础配置
     * @param {Array} data - 数据数组
     * @param {Object} config - 图表配置
     * @returns {Object} 漏斗图配置
     */
    buildFunnelChart(baseOption, data, config) {
        const nameColumn = config.xAxis?.column;
        const valueColumn = config.yAxis?.column;

        if (!nameColumn || !valueColumn) {
            throw new Error('漏斗图需要指定名称列和数值列');
        }

        const funnelData = data.map(item => ({
            name: item[nameColumn],
            value: item[valueColumn]
        })).sort((a, b) => b.value - a.value); // 按值降序排列

        return {
            ...baseOption,
            tooltip: {
                trigger: 'item',
                formatter: '{a} <br/>{b}: {c} ({d}%)'
            },
            series: [{
                name: config.series?.name || '漏斗数据',
                type: 'funnel',
                left: '10%',
                width: '80%',
                maxSize: '80%',
                data: funnelData,
                label: {
                    show: true,
                    position: 'inside'
                },
                labelLine: {
                    show: false
                },
                itemStyle: {
                    borderColor: '#fff',
                    borderWidth: 1
                }
            }]
        };
    },

    /**
     * 构建仪表盘配置
     * @param {Object} baseOption - 基础配置
     * @param {Array} data - 数据数组
     * @param {Object} config - 图表配置
     * @returns {Object} 仪表盘配置
     */
    buildGaugeChart(baseOption, data, config) {
        const valueColumn = config.yAxis?.column;

        if (!valueColumn) {
            throw new Error('仪表盘需要指定数值列');
        }

        // 取第一行数据作为仪表盘值
        const value = data[0] ? data[0][valueColumn] : 0;
        const maxValue = Math.max(...data.map(item => item[valueColumn])) * 1.2;

        return {
            ...baseOption,
            tooltip: {
                formatter: '{a} <br/>{b}: {c}'
            },
            series: [{
                name: config.series?.name || '仪表盘',
                type: 'gauge',
                min: 0,
                max: maxValue,
                splitNumber: 10,
                radius: '80%',
                axisLine: {
                    lineStyle: {
                        width: 10
                    }
                },
                axisTick: {
                    distance: -30,
                    length: 8,
                    lineStyle: {
                        color: '#fff',
                        width: 2
                    }
                },
                splitLine: {
                    distance: -30,
                    length: 30,
                    lineStyle: {
                        color: '#fff',
                        width: 4
                    }
                },
                axisLabel: {
                    color: 'auto',
                    distance: 40,
                    fontSize: 12
                },
                detail: {
                    valueAnimation: true,
                    formatter: '{value}',
                    color: 'auto'
                },
                data: [{
                    value: value,
                    name: valueColumn
                }]
            }]
        };
    },

    /**
     * 构建组合图表配置
     * @param {Object} baseOption - 基础配置
     * @param {Array} data - 数据数组
     * @param {Object} config - 图表配置
     * @returns {Object} 组合图表配置
     */
    buildMixedChart(baseOption, data, config) {
        console.log('构建组合图表 - 配置对象:', config);

        // 检查是否有组合图表的特殊配置
        if (!config.mixedConfig && !config.config) {
            // 如果没有特殊配置，默认创建柱状图+折线图组合
            return this.buildDefaultMixedChart(baseOption, data, config);
        }

        const mixedConfig = config.mixedConfig || config.config;
        const xAxisColumn = config.xAxis?.column;
        const yAxisColumn = config.yAxis?.column;

        if (!xAxisColumn || !yAxisColumn) {
            throw new Error('组合图表需要指定X轴和Y轴列');
        }

        const categories = data.map(item => item[xAxisColumn]);
        const values = data.map(item => item[yAxisColumn]);

        // 构建多个Y轴（如果需要）
        const yAxes = [
            {
                type: 'value',
                name: yAxisColumn,
                position: 'left'
            }
        ];

        // 如果有第二个数值列，添加第二个Y轴
        const secondYColumn = this.findSecondNumericColumn(data, yAxisColumn);
        if (secondYColumn) {
            const secondValues = data.map(item => item[secondYColumn]);
            yAxes.push({
                type: 'value',
                name: secondYColumn,
                position: 'right'
            });
        }

        // 构建系列数据
        const series = [];

        if (mixedConfig.series) {
            // 使用配置中的系列定义
            mixedConfig.series.forEach((seriesConfig, index) => {
                const seriesData = index === 0 ? values :
                                 (secondYColumn ? data.map(item => item[secondYColumn]) : values);

                series.push({
                    name: seriesConfig.name || `系列${index + 1}`,
                    type: seriesConfig.type || 'bar',
                    data: seriesData,
                    yAxisIndex: seriesConfig.yAxisIndex || 0,
                    itemStyle: {
                        color: this.getChartColors(config)[index] || '#3498db'
                    }
                });
            });
        } else {
            // 默认组合：柱状图 + 折线图
            series.push({
                name: yAxisColumn,
                type: 'bar',
                data: values,
                yAxisIndex: 0,
                itemStyle: {
                    color: this.getChartColors(config)[0] || '#3498db'
                }
            });

            if (secondYColumn) {
                const secondValues = data.map(item => item[secondYColumn]);
                series.push({
                    name: secondYColumn,
                    type: 'line',
                    data: secondValues,
                    yAxisIndex: 1,
                    lineStyle: {
                        color: this.getChartColors(config)[1] || '#e74c3c'
                    },
                    itemStyle: {
                        color: this.getChartColors(config)[1] || '#e74c3c'
                    }
                });
            }
        }

        return {
            ...baseOption,
            tooltip: {
                trigger: 'axis',
                axisPointer: {
                    type: 'cross'
                }
            },
            legend: {
                show: config.legend?.show !== false,
                data: series.map(s => s.name)
            },
            xAxis: {
                type: 'category',
                data: categories,
                name: xAxisColumn
            },
            yAxis: yAxes,
            series: series
        };
    },

    /**
     * 构建默认组合图表
     * @param {Object} baseOption - 基础配置
     * @param {Array} data - 数据数组
     * @param {Object} config - 图表配置
     * @returns {Object} 默认组合图表配置
     */
    buildDefaultMixedChart(baseOption, data, config) {
        const xAxisColumn = config.xAxis?.column;
        const yAxisColumn = config.yAxis?.column;

        if (!xAxisColumn || !yAxisColumn) {
            throw new Error('组合图表需要指定X轴和Y轴列');
        }

        const categories = data.map(item => item[xAxisColumn]);
        const values = data.map(item => item[yAxisColumn]);

        // 查找第二个数值列
        const secondYColumn = this.findSecondNumericColumn(data, yAxisColumn);

        const series = [{
            name: yAxisColumn,
            type: 'bar',
            data: values,
            yAxisIndex: 0,
            itemStyle: {
                color: this.getChartColors(config)[0] || '#3498db'
            }
        }];

        const yAxes = [{
            type: 'value',
            name: yAxisColumn,
            position: 'left'
        }];

        if (secondYColumn) {
            const secondValues = data.map(item => item[secondYColumn]);
            series.push({
                name: secondYColumn,
                type: 'line',
                data: secondValues,
                yAxisIndex: 1,
                lineStyle: {
                    color: this.getChartColors(config)[1] || '#e74c3c'
                },
                itemStyle: {
                    color: this.getChartColors(config)[1] || '#e74c3c'
                }
            });

            yAxes.push({
                type: 'value',
                name: secondYColumn,
                position: 'right'
            });
        }

        return {
            ...baseOption,
            tooltip: {
                trigger: 'axis',
                axisPointer: {
                    type: 'cross'
                }
            },
            legend: {
                show: config.legend?.show !== false,
                data: series.map(s => s.name)
            },
            xAxis: {
                type: 'category',
                data: categories,
                name: xAxisColumn
            },
            yAxis: yAxes,
            series: series
        };
    },

    /**
     * 查找第二个数值列
     * @param {Array} data - 数据数组
     * @param {string} excludeColumn - 要排除的列名
     * @returns {string|null} 第二个数值列名
     */
    findSecondNumericColumn(data, excludeColumn) {
        if (!data || data.length === 0) return null;

        const firstRow = data[0];
        const numericColumns = Object.keys(firstRow).filter(key => {
            return key !== excludeColumn && typeof firstRow[key] === 'number';
        });

        return numericColumns.length > 0 ? numericColumns[0] : null;
    },

    /**
     * 获取图表颜色配置
     * @param {Object} config - 图表配置
     * @returns {Array} 颜色数组
     */
    getChartColors(config) {
        if (config.colors?.primary) {
            return [config.colors.primary];
        }

        // 默认颜色主题
        return [
            '#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6',
            '#1abc9c', '#34495e', '#e67e22', '#95a5a6', '#f1c40f'
        ];
    },

    /**
     * 启用导出按钮
     */
    enableExportButtons() {
        const exportButtons = ['exportPngBtn', 'exportSvgBtn', 'exportCodeBtn', 'shareChartBtn'];
        exportButtons.forEach(btnId => {
            const btn = document.getElementById(btnId);
            if (btn) {
                btn.disabled = false;
            }
        });
    },

    /**
     * 导出PNG图片
     */
    exportPNG() {
        if (!this.currentChart) {
            Utils.showNotification('没有可导出的图表', 'warning');
            return;
        }

        try {
            // 检查渲染器类型
            const rendererType = this.currentChart.getZr().painter.type;
            console.log('PNG导出 - 渲染器类型:', rendererType);

            if (rendererType === 'canvas') {
                // Canvas渲染器直接使用getDataURL
                const url = this.currentChart.getDataURL({
                    type: 'png',
                    pixelRatio: 2,
                    backgroundColor: '#fff'
                });
                this.downloadImage(url, 'png');
            } else {
                // SVG渲染器需要转换为PNG
                this.convertSVGToPNG();
            }

        } catch (error) {
            console.error('PNG导出错误:', error);
            Utils.showNotification(`导出PNG失败: ${error.message}`, 'error');
        }
    },

    /**
     * 将SVG转换为PNG并下载
     */
    convertSVGToPNG() {
        const chartDom = this.currentChart.getDom();
        const svgElement = chartDom.querySelector('svg');

        if (!svgElement) {
            throw new Error('无法找到SVG元素');
        }

        // 获取SVG的尺寸
        const rect = svgElement.getBoundingClientRect();
        const width = rect.width || 800;
        const height = rect.height || 600;

        // 创建Canvas
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // 设置高分辨率
        const pixelRatio = 2;
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
                ctx.drawImage(img, 0, 0, width, height);
                const pngUrl = canvas.toDataURL('image/png');
                this.downloadImage(pngUrl, 'png');
                URL.revokeObjectURL(svgUrl);
                Utils.showNotification('PNG图片导出成功', 'success');
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
    },

    /**
     * 下载图片
     */
    downloadImage(url, format) {
        const link = document.createElement('a');
        link.href = url;
        link.download = `chart_${Utils.formatDate(new Date(), 'YYYY-MM-DD_HH-mm-ss')}.${format}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    },

    /**
     * 导出SVG图片
     */
    exportSVG() {
        if (!this.currentChart) {
            Utils.showNotification('没有可导出的图表', 'warning');
            return;
        }

        try {
            // 检查渲染器类型
            console.log('Chart renderer:', this.currentChart.getZr().painter.type);

            // 获取SVG字符串
            let svgStr;
            if (this.currentChart.renderToSVGString) {
                svgStr = this.currentChart.renderToSVGString();
            } else {
                // 如果没有renderToSVGString方法，尝试从DOM获取SVG
                const chartDom = this.currentChart.getDom();
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
            link.download = `chart_${Utils.formatDate(new Date(), 'YYYY-MM-DD_HH-mm-ss')}.svg`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            URL.revokeObjectURL(url);
            Utils.showNotification('SVG图片导出成功', 'success');
        } catch (error) {
            console.error('SVG导出错误:', error);
            Utils.showNotification(`导出SVG失败: ${error.message}`, 'error');
        }
    },

    /**
     * 导出ECharts配置代码
     */
    exportCode() {
        if (!this.currentChart) {
            Utils.showNotification('没有可导出的图表', 'warning');
            return;
        }
        
        try {
            const option = this.currentChart.getOption();
            const codeContent = JSON.stringify(option, null, 2);
            
            // 显示代码模态框
            const modal = document.getElementById('codeModal');
            const codeElement = document.getElementById('codeContent');
            
            codeElement.textContent = codeContent;
            modal.style.display = 'flex';
            
        } catch (error) {
            Utils.showNotification(`导出代码失败: ${error.message}`, 'error');
        }
    },

    /**
     * 更新图表配置
     * @param {Object} newConfig - 新的配置
     */
    updateChart(newConfig) {
        if (!this.currentChart || !this.currentData) {
            return;
        }
        
        try {
            // 合并配置
            const mergedConfig = { ...this.currentConfig, ...newConfig };
            this.currentConfig = mergedConfig;
            
            // 重新生成图表
            const chartType = this.getCurrentChartType();
            const option = this.buildEChartsOption(this.currentData, mergedConfig, chartType);
            this.currentChart.setOption(option, true);

            // 确保图表正确调整大小
            this.resizeChart();
            
        } catch (error) {
            console.error('更新图表失败:', error);
            Utils.showNotification(`更新图表失败: ${error.message}`, 'error');
        }
    },

    /**
     * 获取当前图表类型
     * @returns {string} 图表类型
     */
    getCurrentChartType() {
        // 从当前选中的推荐卡片获取类型
        const selectedCard = document.querySelector('.recommendation-card.selected');
        return selectedCard ? selectedCard.dataset.type : 'bar';
    },

    /**
     * 清除图表
     */
    clearChart() {
        if (this.currentChart) {
            this.currentChart.clear();
        }

        // 显示占位符
        const container = document.getElementById('chartContainer');
        container.innerHTML = `
            <div class="chart-placeholder">
                <i class="fas fa-chart-bar chart-placeholder-icon"></i>
                <p>请先输入数据并进行分析</p>
            </div>
        `;

        // 禁用导出按钮
        const exportButtons = ['exportPngBtn', 'exportSvgBtn', 'exportCodeBtn','shareChartBtn'];
        exportButtons.forEach(btnId => {
            const btn = document.getElementById(btnId);
            if (btn) {
                btn.disabled = true;
            }
        });

        this.currentData = null;
        this.currentConfig = null;
    },

    /**
     * 销毁图表实例和清理资源
     */
    dispose() {
        // 清理图表实例
        if (this.currentChart) {
            this.currentChart.dispose();
            this.currentChart = null;
        }

        // 清理事件监听器
        if (this.resizeListener) {
            window.removeEventListener('resize', this.resizeListener);
            this.resizeListener = null;
        }

        // 清理容器观察器
        if (this.containerObserver) {
            this.containerObserver.disconnect();
            this.containerObserver = null;
        }

        this.currentData = null;
        this.currentConfig = null;
    }
};

// 导出图表生成器模块（如果使用模块系统）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChartGenerator;
}
