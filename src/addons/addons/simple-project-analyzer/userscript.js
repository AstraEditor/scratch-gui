import { Chart, RadarController, DoughnutController, RadialLinearScale, CategoryScale, LinearScale, PointElement, LineElement, ArcElement, Filler, Legend, Tooltip } from 'chart.js';

// 注册Chart.js组件
Chart.register(
  RadarController,
  DoughnutController,
  RadialLinearScale,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Filler,
  Legend,
  Tooltip
);
import icon from '!../../../lib/tw-recolor/build!./SPA.svg'
import SideBar from "../../ui/side-bar/side-bar.js";
import { getSetting } from "../../tools/AEsettings/index.js";

// 检测是否启用 VSCode 布局
function isVSCodeLayoutEnabled() {
  return getSetting("EnableVSCodeLayout");
}

export default function ({ addon, msg, console }) {
  const vm = addon.tab.traps.vm;

  // 项目分析器类
  class SimpleProjectAnalyzer {
    constructor() {
      this.analyzeButton = null;
      this.analyzeModal = null;
      this.removeModal = null;
      this.chartInstance = null;
      this.mathLogicChartInstance = null;
      this.drScratchChartInstance = null;
      this.sidebarContent = null;
      this.isVSCodeLayout = false;
    }

    // 创建分析按钮
    async createAnalyzeButton() {
      // 检测是否在 VSCodeLayout 下
      this.isVSCodeLayout = isVSCodeLayoutEnabled();

      const tabBar = await addon.tab.waitForElement('[class*="react-tabs_react-tabs__tab-list"]', {
        markAsSeen: true
      });

      // 等待 spaContainer 出现
      const spaContainer = await addon.tab.waitForElement('.spaContainer', {
        markAsSeen: true
      });

      if (!spaContainer) return;

      this.analyzeButton = document.createElement('button');
      this.analyzeButton.className = addon.tab.scratchClass('menu-bar_menu-bar-button', {
        others: 'sa-analyze-button'
      });

      if (this.isVSCodeLayout) {
        // VSCodeLayout 下使用 SVG 图标
        this.analyzeButton.classList.add('vscode-tab');
        const img = document.createElement('img');
        img.src = icon();
        img.style.filter = "grayscale(100%)"
        img.marginTop = '5px';
        img.width = '20px';
        img.height = '20px';
        img.alt = '分析';
        this.analyzeButton.appendChild(img);
      } else {
        // 普通布局下使用文字
        this.analyzeButton.textContent = msg('analyze-button');
      }
      this.analyzeButton.title = msg('analyze-tooltip');

      // 禁用时隐藏按钮
      addon.tab.displayNoneWhileDisabled(this.analyzeButton);

      // 点击事件：根据布局类型选择显示方式
      this.analyzeButton.addEventListener('click', () => {
        if (this.isVSCodeLayout) {
          // VSCode 布局：使用 Sidebar
          if (SideBar.getActivePlugin() === 'spa') {
            SideBar.close();
          } else {
            this.showAnalysisSidebar();
          }
        } else {
          // 普通 Tab 布局：使用模态框
          this.showAnalysisModal();
        }
      });

      // 将按钮添加到目标位置
      if (this.isVSCodeLayout) {
        // VSCodeLayout 下，按钮应该插入到标签栏（TabList）中
        tabBar.appendChild(this.analyzeButton);
      } else {
        // 普通布局下，插入到 spaContainer
        spaContainer.appendChild(this.analyzeButton);
      }
    }

    // 显示分析结果模态框
    showAnalysisModal() {
      // 如果模态框已存在，先移除
      if (this.analyzeModal) {
        this.analyzeModal.remove();
      }

      // 使用 addon.tab.createModal 创建模态框
      const { backdrop, container, content, closeButton, remove } = addon.tab.createModal(msg('modal-title'), {
        isOpen: true
      });

      this.analyzeModal = backdrop;
      this.removeModal = remove;

      // 添加自定义 CSS 类
      container.classList.add('sa-analyze-modal-popup');
      content.classList.add('sa-analyze-modal-content');

      // 生成分析结果HTML（类似子目录中的界面）
      const analysisHTML = this.generateAnalysisHTML();

      // 设置模态框内容
      content.innerHTML = `
        <div class="sa-analyze-header">
          <button id="saExportButton" class="sa-export-button">
            ${msg('export-image', '导出图片')}
          </button>
        </div>
        <div class="sa-analyze-loading" id="saAnalyzeLoading">
          <div class="sa-analyze-spinner"></div>
          <p>${msg('analyzing')}</p>
        </div>
        <div class="sa-analyze-results" id="saAnalyzeResults" style="display: none;">
          ${analysisHTML}
        </div>
      `;

      // 添加关闭事件监听器
      backdrop.addEventListener('click', () => this.closeModal());
      closeButton.addEventListener('click', () => this.closeModal());

      // 添加导出按钮事件
      document.getElementById('saExportButton').addEventListener('click', () => {
        this.exportAnalysisAsImage();
      });

      // 异步分析项目
      this.analyzeProject();
    }

    closeModal() {
      if (this.removeModal) {
        this.removeModal();
        this.analyzeModal = null;
        this.removeModal = null;

        // 销毁图表实例
        if (this.chartInstance) {
          this.chartInstance.destroy();
          this.chartInstance = null;
        }
        if (this.mathLogicChartInstance) {
          this.mathLogicChartInstance.destroy();
          this.mathLogicChartInstance = null;
        }
        if (this.drScratchChartInstance) {
          this.drScratchChartInstance.destroy();
          this.drScratchChartInstance = null;
        }
      }
    }

    // 创建 Sidebar 内容容器
    createSidebarContent() {
      if (!this.sidebarContent) {
        this.sidebarContent = document.createElement("div");
        this.sidebarContent.className = "sa-spa-sidebar-content";
        this.sidebarContent.style.cssText = `
          width: 100%;
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding: 16px;
          overflow-y: auto;
          box-sizing: border-box;
        `;

        // 添加标题栏（包含标题和导出按钮）
        const header = document.createElement("div");
        header.style.cssText = `
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-bottom: 12px;
          border-bottom: 1px solid rgba(0, 0, 0, 0.1);
          flex-shrink: 0;
        `;

        // 添加标题
        const title = document.createElement("div");
        title.className = "sa-spa-sidebar-title";
        title.style.cssText = `
          font-size: 16px;
          font-weight: 600;
          color: var(--text-primary);
        `;
        title.textContent = msg('modal-title');
        header.appendChild(title);

        // 添加导出按钮
        const exportButton = document.createElement("button");
        exportButton.id = "saSPASidebarExportButton";
        exportButton.className = "sa-spa-sidebar-export-button";
        exportButton.textContent = msg('export-image', '导出图片');
        exportButton.style.cssText = `
          padding: 6px 12px;
          font-size: 12px;
          font-weight: 500;
          color: #ffffff;
          background-color: var(--motion-primary);
          border: none;
          border-radius: 4px;
          cursor: pointer;
          transition: background-color 0.2s ease;
        `;
        exportButton.addEventListener('click', () => {
          this.exportAnalysisAsImage();
        });
        header.appendChild(exportButton);

        this.sidebarContent.appendChild(header);

        // 添加加载提示
        const loadingDiv = document.createElement("div");
        loadingDiv.className = "sa-spa-sidebar-loading";
        loadingDiv.id = "saSAPASidebarLoading";
        loadingDiv.style.cssText = `
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px;
          gap: 16px;
        `;
        loadingDiv.innerHTML = `
          <div class="sa-spa-sidebar-spinner" style="
            width: 40px;
            height: 40px;
            border: 4px solid rgba(0, 0, 0, 0.1);
            border-radius: 50%;
            border-top-color: var(--ui-primary);
            animation: sa-spa-spin 1s ease-in-out infinite;
          "></div>
          <p style="color: var(--text-primary);">${msg('analyzing')}</p>
        `;
        this.sidebarContent.appendChild(loadingDiv);

        // 添加结果容器
        const resultsDiv = document.createElement("div");
        resultsDiv.className = "sa-spa-sidebar-results";
        resultsDiv.id = "saSAPASidebarResults";
        resultsDiv.style.cssText = `
          display: none;
          gap: 16px;
          flex-direction: column;
        `;
        this.sidebarContent.appendChild(resultsDiv);

        // 添加 CSS 动画
        const style = document.createElement('style');
        style.textContent = `
          @keyframes sa-spa-spin {
            to { transform: rotate(360deg); }
          }
          .sa-spa-sidebar-export-button:hover {
            background-color: #3a7bc8;
          }
        `;
        document.head.appendChild(style);
      }
    }

    // 在 Sidebar 中显示分析结果
    showAnalysisSidebar() {
      this.createSidebarContent();

      // 显示加载，隐藏结果
      const loadingDiv = document.getElementById('saSAPASidebarLoading');
      const resultsDiv = document.getElementById('saSAPASidebarResults');

      if (loadingDiv) loadingDiv.style.display = 'flex';
      if (resultsDiv) resultsDiv.style.display = 'none';

      // 注册到 Sidebar
      SideBar.register('spa', this.sidebarContent, {
        onActivate: () => {
          if (this.analyzeButton) {
            this.analyzeButton.classList.add("sa-spa-active", "is-selected");
            const img = this.analyzeButton.querySelector('img');
            if (img) {
              img.style.filter = "grayscale(0%)";
            }
          }
          // 开始分析
          this.analyzeProjectForSidebar();
        },
        onDeactivate: () => {
          if (this.analyzeButton) {
            this.analyzeButton.classList.remove("sa-spa-active", "is-selected");
            const img = this.analyzeButton.querySelector('img');
            if (img) {
              img.style.filter = "grayscale(100%)";
            }
          }
          // 销毁图表实例
          if (this.chartInstance) {
            this.chartInstance.destroy();
            this.chartInstance = null;
          }
          if (this.mathLogicChartInstance) {
            this.mathLogicChartInstance.destroy();
            this.mathLogicChartInstance = null;
          }
          if (this.drScratchChartInstance) {
            this.drScratchChartInstance.destroy();
            this.drScratchChartInstance = null;
          }
        }
      });

      // 切换到 Sidebar
      SideBar.switchTo('spa');
    }

    // 为 Sidebar 分析项目
    async analyzeProjectForSidebar() {
      try {
        // 使用 vm.toJSON 获取项目数据
        const vm = addon.tab.traps.vm;
        const projectJSON = JSON.parse(vm.toJSON());

        // 执行分析
        const analysis = this.performAnalysis(projectJSON);

        // 更新 Sidebar UI
        this.updateSidebarResults(analysis);
      } catch (error) {
        console.error(msg('analysis-error', '分析项目时出错:'), error);
        const loadingDiv = document.getElementById('saSAPASidebarLoading');
        if (loadingDiv) {
          loadingDiv.innerHTML = `<p style="color: #d32f2f;">${msg('analysis-error')}</p>`;
        }
      }
    }

    // 更新 Sidebar 分析结果
    updateSidebarResults(analysis) {
      const resultsDiv = document.getElementById('saSAPASidebarResults');
      const loadingDiv = document.getElementById('saSAPASidebarLoading');

      if (!resultsDiv) return;

      // 生成简化版的 HTML（适合 Sidebar 显示）
      resultsDiv.innerHTML = this.generateSidebarAnalysisHTML(analysis);

      // 更新统计数据
      this.updateSidebarStats(analysis);

      // 显示代码类型分布饼图
      this.displaySidebarCodeTypesChart(analysis);

      // 计算并更新 Dr.Scratch 评分
      const vm = addon.tab.traps.vm;
      const projectJSON = JSON.parse(vm.toJSON());
      const drScratchScores = this.calculateDrScratchScores(projectJSON);
      this.displaySidebarDrScratchScores(drScratchScores);

      // 计算并更新数学逻辑评分
      const mathLogicScores = this.calculateMathLogicScores(projectJSON);
      this.displaySidebarMathLogicScores(mathLogicScores);

      // 更新扩展列表
      this.displaySidebarExtensions(analysis.extensions);

      // 显示结果，隐藏加载
      if (loadingDiv) loadingDiv.style.display = 'none';
      resultsDiv.style.display = 'flex';
    }

    // 生成 Sidebar 版本的分析结果 HTML
    generateSidebarAnalysisHTML(analysis) {
      return `
        <div class="sa-spa-stats-section" style="
          background: var(--ui-secondary);
          border-radius: 8px;
          padding: 12px;
        ">
          <h4 style="margin: 0 0 8px 0; font-size: 14px; color: var(--text-primary);">${msg('project-stats')}</h4>
          <div class="sa-spa-stats-grid" id="saSAPAStatsGrid" style="
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 8px;
          "></div>
        </div>

        <div class="sa-spa-codetypes-section" style="
          background: var(--ui-secondary);
          border-radius: 8px;
          padding: 12px;
        ">
          <h4 style="margin: 0 0 8px 0; font-size: 14px; color: var(--text-primary);">${msg('block-distribution')}</h4>
          <div style="height: 200px; margin-top: 8px;">
            <canvas id="saSAPACodeTypesChart"></canvas>
          </div>
        </div>

        <div class="sa-spa-drscratch-section" style="
          background: var(--ui-secondary);
          border-radius: 8px;
          padding: 12px;
        ">
          <h4 style="margin: 0 0 8px 0; font-size: 14px; color: var(--text-primary);">${msg('dr-scratch-score')}</h4>
          <div class="sa-spa-drscratch-summary" id="saSAPADrScratchSummary" style="
            font-size: 14px;
            color: var(--text-primary);
          "></div>
          <div style="height: 180px; margin-top: 8px;">
            <canvas id="saSAPADrScratchChart"></canvas>
          </div>
        </div>

        <div class="sa-spa-math-section" style="
          background: var(--ui-secondary);
          border-radius: 8px;
          padding: 12px;
        ">
          <h4 style="margin: 0 0 8px 0; font-size: 14px; color: var(--text-primary);">${msg('math-logic-assessment')}</h4>
          <div class="sa-spa-math-summary" id="saSAPAMathSummary" style="
            font-size: 14px;
            color: var(--text-primary);
          "></div>
          <div style="height: 180px; margin-top: 8px;">
            <canvas id="saSAPAMathChart"></canvas>
          </div>
        </div>

        <div class="sa-spa-extensions-section" style="
          background: var(--ui-secondary);
          border-radius: 8px;
          padding: 12px;
        ">
          <h4 style="margin: 0 0 8px 0; font-size: 14px; color: var(--text-primary);">${msg('extensions-used')}</h4>
          <div class="sa-spa-extensions-list" id="saSAPAExtensionsList" style="
            display: flex;
            flex-direction: column;
            gap: 8px;
          "></div>
        </div>
      `;
    }

    // 更新 Sidebar 统计数据
    updateSidebarStats(analysis) {
      const statsGrid = document.getElementById('saSAPAStatsGrid');
      if (!statsGrid) return;

      const stats = [
        { label: msg('total-blocks'), value: analysis.totalBlocks },
        { label: msg('effective-blocks'), value: analysis.effectiveBlocks },
        { label: msg('function-definitions'), value: analysis.functionDefinitions },
        { label: msg('stat-sprites'), value: analysis.sprites },
        { label: msg('stat-costumes'), value: analysis.costumeCount },
        { label: msg('stat-sounds'), value: analysis.soundCount },
        { label: msg('stat-variables'), value: analysis.variableCount },
        { label: msg('stat-lists'), value: analysis.listCount },
      ];

      statsGrid.innerHTML = stats.map(stat => `
        <div style="
          background: var(--ui-white);
          border-radius: 4px;
          padding: 8px;
          text-align: center;
        ">
          <div style="font-size: 18px; font-weight: bold; color: var(--motion-primary);">${stat.value}</div>
          <div style="font-size: 11px; color: var(--text-primary); opacity: 0.8;">${stat.label}</div>
        </div>
      `).join('');
    }

    // 显示 Sidebar 版本的代码类型分布饼图
    displaySidebarCodeTypesChart(analysis) {
      const canvas = document.getElementById('saSAPACodeTypesChart');
      if (!canvas) return;

      const ctx = canvas.getContext('2d');

      const categoryColors = {
        [msg('motion')]: '#4C97FF',
        [msg('looks')]: '#9966FF',
        [msg('sound')]: '#CF63CF',
        [msg('events')]: '#FFBF00',
        [msg('control')]: '#FFAB19',
        [msg('sensing')]: '#5CB1D6',
        [msg('operators')]: '#59C059',
        [msg('data')]: '#FF8C1A',
        [msg('custom-functions')]: '#FF6680'
      };

      const extensionColors = [
        '#3498DB', '#E74C3C', '#F39C12', '#27AE60', '#16A085',
        '#2ECC71', '#E67E22', '#95A5A6', '#34495E', '#7F8C8D',
        '#9B59B6', '#1ABC9C', '#2C3E50', '#F1C40F', '#D35400'
      ];

      const standardOrder = [
        msg('motion'), msg('looks'), msg('sound'),
        msg('events'), msg('control'), msg('sensing'),
        msg('operators'), msg('data'), msg('custom-functions')
      ];

      const sortedCodeTypes = {};
      standardOrder.forEach(category => {
        if (analysis.codeTypes[category]) {
          sortedCodeTypes[category] = analysis.codeTypes[category];
        }
      });

      Object.keys(analysis.codeTypes).sort().forEach(category => {
        if (!standardOrder.includes(category)) {
          sortedCodeTypes[category] = analysis.codeTypes[category];
        }
      });

      const labels = Object.keys(sortedCodeTypes);
      const data = Object.values(sortedCodeTypes);
      const colors = labels.map((label, index) => {
        if (categoryColors[label]) return categoryColors[label];
        return extensionColors[index % extensionColors.length];
      });

      if (this.codeTypesChartInstance) {
        this.codeTypesChartInstance.destroy();
      }

      this.codeTypesChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: labels,
          datasets: [{
            data: data,
            backgroundColor: colors,
            borderWidth: 2,
            borderColor: '#ffffff'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'right',
              labels: {
                boxWidth: 12,
                padding: 8,
                font: {
                  size: 10
                }
              }
            }
          }
        }
      });
    }

    // 显示 Sidebar 版本的 Dr.Scratch 评分
    displaySidebarDrScratchScores(scores) {
      const canvas = document.getElementById('saSAPADrScratchChart');
      const summaryDiv = document.getElementById('saSAPADrScratchSummary');

      if (!canvas || !summaryDiv) return;

      const ctx = canvas.getContext('2d');
      const labels = Object.keys(scores);
      const data = Object.values(scores);
      const totalScore = data.reduce((sum, val) => sum + val, 0);

      // 更新总分摘要
      let level = msg('beginner');
      if (totalScore >= 18) {
        level = msg('expert');
      } else if (totalScore >= 14) {
        level = msg('advanced');
      } else if (totalScore >= 10) {
        level = msg('intermediate');
      } else if (totalScore >= 6) {
        level = msg('developing');
      }

      summaryDiv.innerHTML = `<strong>${msg('total-score')}：</strong>${totalScore} / 21<br><strong>${msg('evaluation-level')}：</strong>${level}`;

      // 创建雷达图
      if (this.drScratchChartInstance) {
        this.drScratchChartInstance.destroy();
      }

      this.drScratchChartInstance = new Chart(ctx, {
        type: 'radar',
        data: {
          labels: labels,
          datasets: [{
            data: data,
            backgroundColor: 'rgba(77, 151, 255, 0.2)',
            borderColor: '#4d97ff',
            borderWidth: 2,
            pointBackgroundColor: '#4d97ff',
            pointBorderColor: '#fff',
            pointRadius: 3
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            r: {
              beginAtZero: true,
              max: 3,
              ticks: {
                stepSize: 1,
                font: { size: 10 }
              },
              pointLabels: {
                font: { size: 9 }
              }
            }
          },
          plugins: {
            legend: { display: false }
          }
        }
      });
    }

    // 显示 Sidebar 版本的数学逻辑评分
    displaySidebarMathLogicScores(scores) {
      const canvas = document.getElementById('saSAPAMathChart');
      const summaryDiv = document.getElementById('saSAPAMathSummary');

      if (!canvas || !summaryDiv) return;

      const ctx = canvas.getContext('2d');
      const labels = Object.keys(scores);
      const data = Object.values(scores);
      const totalScore = data.reduce((sum, val) => sum + val, 0);

      // 更新总分摘要
      let level = msg('beginner', '初级');
      if (totalScore >= 20) {
        level = msg('advanced', '高级');
      } else if (totalScore >= 10) {
        level = msg('intermediate', '中级');
      } else if (totalScore >= 5) {
        level = msg('developing', '发展中');
      }

      summaryDiv.innerHTML = `<strong>${msg('math-total-score')}：</strong>${totalScore}<br><strong>${msg('evaluation-level')}：</strong>${level}`;

      // 数据标准化
      const maxValue = Math.max(...data, 1);
      const normalizedData = data.map(value => value / maxValue);

      // 创建雷达图
      if (this.mathLogicChartInstance) {
        this.mathLogicChartInstance.destroy();
      }

      this.mathLogicChartInstance = new Chart(ctx, {
        type: 'radar',
        data: {
          labels: labels,
          datasets: [{
            data: normalizedData,
            backgroundColor: 'rgba(230, 81, 0, 0.2)',
            borderColor: '#E65100',
            borderWidth: 2,
            pointBackgroundColor: '#E65100',
            pointBorderColor: '#fff',
            pointRadius: 3
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            r: {
              beginAtZero: true,
              max: 1,
              ticks: {
                stepSize: 0.2,
                font: { size: 10 }
              },
              pointLabels: {
                font: { size: 9 }
              }
            }
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: function (context) {
                  const label = context.label || '';
                  const rawValue = data[context.dataIndex];
                  return `${label}: ${rawValue}`;
                }
              }
            }
          }
        }
      });
    }

    // 显示 Sidebar 版本的扩展列表
    displaySidebarExtensions(extensions) {
      const extensionList = document.getElementById('saSAPAExtensionsList');
      if (!extensionList) return;

      if (extensions.length === 0) {
        extensionList.innerHTML = `<p style="font-size: 12px; color: var(--text-primary); opacity: 0.7;">${msg('no-extensions')}</p>`;
        return;
      }

      extensionList.innerHTML = extensions.map(extension => {
        const color = extension.color || '#888888';
        return `
          <div style="
            background: var(--ui-white);
            border-radius: 4px;
            padding: 8px;
            display: flex;
            align-items: center;
            gap: 8px;
          ">
            <div style="
              width: 12px;
              height: 12px;
              border-radius: 50%;
              flex-shrink: 0;
              background-color: ${color};
            "></div>
            <div style="flex: 1; font-size: 12px; color: var(--text-primary);">${extension.name}</div>
            <div style="font-size: 11px; color: var(--text-primary); opacity: 0.7;">${extension.blocks.length}</div>
          </div>
        `;
      }).join('');
    }

    // 分析项目
    async analyzeProject() {
      try {
        // 使用 vm.toJSON 获取项目数据
        const vm = addon.tab.traps.vm;
        const projectJSON = JSON.parse(vm.toJSON());

        // 执行分析
        const analysis = this.performAnalysis(projectJSON);

        // 更新UI
        this.updateAnalysisResults(analysis);
      } catch (error) {
        console.error(msg('analysis-error', '分析项目时出错:'), error);
        document.getElementById('saAnalyzeLoading').innerHTML = `
          <p style="color: #d32f2f;">${msg('analysis-error')}</p>
        `;
      }
    }

    // 执行分析
    performAnalysis(projectData) {
      const analysis = {
        totalBlocks: 0,
        codeTypes: {},
        extensions: [],
        sprites: 0,
        stageInfo: {},
        editorPlatform: 'Scratch',
        effectiveBlocks: 0,
        functionDefinitions: 0,
        projectSize: 0,
        costumesSize: 0,
        soundsSize: 0,
        costumeCount: 0,
        soundCount: 0,
        variableCount: 0,
        listCount: 0
      };

      // 分析扩展
      this.analyzeExtensions(analysis, projectData);

      // 创建扩展名称映射
      const extensionNameMap = {};
      analysis.extensions.forEach(ext => {
        extensionNameMap[ext.id] = ext.name;
      });

      // 分析代码块
      this.analyzeBlocks(analysis, projectData, extensionNameMap);

      // 分析精灵和舞台
      this.analyzeSprites(analysis, projectData);

      // 分析有效积木和函数定义
      this.analyzeEffectiveBlocks(analysis, projectData);

      return analysis;
    }

    // 分析代码块
    analyzeBlocks(analysis, projectData, extensionNameMap = {}) {
      const targets = projectData.targets || [];

      targets.forEach(target => {
        const blocks = target.blocks || {};

        Object.values(blocks).forEach(block => {
          if (block.opcode && !block.shadow) {
            analysis.totalBlocks++;

            const category = this.getBlockCategory(block.opcode, extensionNameMap);
            analysis.codeTypes[category] = (analysis.codeTypes[category] || 0) + 1;
          }
        });
      });
    }

    // 获取积木类型
    getBlockCategory(opcode, extensionNameMap = {}) {
      if (opcode.startsWith('motion_')) return msg('motion', '运动');
      if (opcode.startsWith('looks_')) return msg('looks', '外观');
      if (opcode.startsWith('sound_')) return msg('sound', '声音');
      if (opcode.startsWith('event_')) return msg('events', '事件');
      if (opcode.startsWith('control_')) return msg('control', '控制');
      if (opcode.startsWith('sensing_')) return msg('sensing', '侦测');
      if (opcode.startsWith('operator_')) return msg('operators', '运算');
      if (opcode.startsWith('data_')) return msg('data', '数据');
      if (opcode.startsWith('video_')) return msg('video', '视频');

      // 自定义函数和参数
      if (opcode.startsWith('procedures_')) return msg('custom-functions', '自定义函数');
      if (opcode.startsWith('argument_')) return msg('custom-functions', '自定义函数');

      // 扩展积木处理
      if (!this.isStandardBlock(opcode)) {
        const extensionId = this.getExtensionIdFromOpcode(opcode);
        // 优先使用解析的中文名称
        if (extensionNameMap[extensionId]) {
          return extensionNameMap[extensionId];
        }
        // 回退到默认名称
        return this.getExtensionNameFromId(extensionId);
      }

      return msg('other', '其他');
    }

    // 检查是否为标准积木
    isStandardBlock(opcode) {
      const standardCategories = [
        'motion_', 'looks_', 'sound_', 'event_', 'control_',
        'sensing_', 'operator_', 'data_', 'video_',
        'procedures_', 'argument_'
      ];

      return standardCategories.some(category => opcode.startsWith(category));
    }

    // 从积木操作码提取扩展ID
    getExtensionIdFromOpcode(opcode) {
      const underscoreIndex = opcode.indexOf('_');
      if (underscoreIndex > 0) {
        return opcode.substring(0, underscoreIndex);
      }
      return opcode;
    }

    // 从扩展ID获取扩展名称
    getExtensionNameFromId(extensionId) {
      const defaultExtensionNames = {
        'music': 'Music',
        'pen': 'Pen',
        'videoSensing': 'Video Sensing',
        'text2speech': 'Text to Speech',
        'translate': 'Translate',
        'makeymakey': 'Makey Makey',
        'microbit': 'micro:bit',
        'ev3': 'LEGO EV3',
        'wedo2': 'LEGO WeDo 2.0',
        'boost': 'LEGO BOOST'
      };

      return defaultExtensionNames[extensionId] || extensionId;
    }

    // 分析扩展
    analyzeExtensions(analysis, projectData) {
      const extensions = projectData.extensions || [];
      const extensionURLs = projectData.extensionURLs || {};

      // 获取所有扩展积木操作码
      const extensionBlocks = this.getExtensionBlocks(projectData);

      // 分析扩展信息
      extensions.forEach(ext => {
        let extensionName = this.getExtensionNameFromId(ext);
        let extensionColor = null;

        const extensionInfo = {
          id: ext,
          name: extensionName,
          color: extensionColor,
          url: extensionURLs[ext] || null,
          blocks: extensionBlocks.filter(block => block.extensionId === ext)
        };

        analysis.extensions.push(extensionInfo);
      });

      // 检查画笔扩展使用情况
      const penBlocks = extensionBlocks.filter(block => block.extensionId === 'pen');
      if (penBlocks.length > 0 && !extensions.includes('pen')) {
        const penExtensionInfo = {
          id: 'pen',
          name: msg('extension-pen', '画笔'),
          color: null,
          url: null,
          blocks: penBlocks
        };
        analysis.extensions.push(penExtensionInfo);
      }
    }

    // 获取扩展积木
    getExtensionBlocks(projectData) {
      const extensionBlocks = [];
      const targets = projectData.targets || [];

      targets.forEach(target => {
        const blocks = target.blocks || {};
        Object.values(blocks).forEach(block => {
          if (block.opcode && !this.isStandardBlock(block.opcode)) {
            const extensionId = this.getExtensionIdFromOpcode(block.opcode);
            extensionBlocks.push({
              opcode: block.opcode,
              extensionId: extensionId
            });
          }
        });
      });

      return extensionBlocks;
    }

    // 分析精灵和舞台
    analyzeSprites(analysis, projectData) {
      const targets = projectData.targets || [];
      const sprites = targets.filter(t => !t.isStage);
      const stage = targets.find(t => t.isStage);

      analysis.sprites = sprites.length;

      // 统计造型和声音
      targets.forEach(target => {
        if (target.costumes) {
          analysis.costumeCount += target.costumes.length;
        }
        if (target.sounds) {
          analysis.soundCount += target.sounds.length;
        }
        if (target.variables) {
          analysis.variableCount += Object.keys(target.variables).length;
        }
        if (target.lists) {
          analysis.listCount += Object.keys(target.lists).length;
        }
      });
    }

    // 分析有效积木和函数定义
    analyzeEffectiveBlocks(analysis, projectData) {
      const targets = projectData.targets || [];
      // 获取 vm 对象
      const vm = addon.tab.traps.vm;

      targets.forEach(target => {
        const blocks = target.blocks || {};
        
        // 首先找出所有头代码（hat blocks）
        const hatBlocks = [];
        Object.values(blocks).forEach(block => {
          if (block.opcode && !block.shadow && block.topLevel) {
            // 使用 vm.runtime.getIsHat() 判断是否为头代码，同时手动检查函数定义
            if (vm.runtime.getIsHat(block.opcode) || block.opcode === 'procedures_definition') {
              hatBlocks.push(block);
            }
          }
          
          // 统计函数定义
          if (block.opcode === 'procedures_definition') {
            analysis.functionDefinitions++;
          }
        });
        
        // 统计每个头代码栈中的有效积木
        hatBlocks.forEach(hatBlock => {
          this.traverseBlockStack(blocks, hatBlock, analysis);
        });
      });
    }
    
    // 遍历代码栈，包括子栈（迭代实现）
    traverseBlockStack(blocks, block, analysis) {
      if (!block) return;
      
      const stack = [block];
      
      while (stack.length > 0) {
        const currentBlock = stack.pop();
        if (!currentBlock) continue;
        
        // 计数当前积木（非阴影）
        if (!currentBlock.shadow) {
          analysis.effectiveBlocks++;
        }
        
        // 处理下一个积木（先入栈，后处理）
        if (currentBlock.next && blocks[currentBlock.next]) {
          stack.push(blocks[currentBlock.next]);
        }
        
        // 处理子栈（如循环体、条件语句等）
        if (currentBlock.inputs) {
          Object.values(currentBlock.inputs).forEach(input => {
            if (Array.isArray(input) && input.length >= 2) {
              const inputValue = input[1];
              // 如果输入值是积木ID，入栈
              if (typeof inputValue === 'string' && blocks[inputValue]) {
                stack.push(blocks[inputValue]);
              }
            }
          });
        }
      }
    }

    // 计算Dr.Scratch评分
    calculateDrScratchScores(projectData) {
      const scores = {
        [msg('abstraction', '抽象和问题分解')]: 0,
        [msg('parallelism', '并行性')]: 0,
        [msg('logic', '逻辑思维')]: 0,
        [msg('synchronization', '同步')]: 0,
        [msg('flow-control', '流程控制')]: 0,
        [msg('user-interactivity', '用户交互')]: 0,
        [msg('data-representation', '数据表示')]: 0
      };

      const targets = projectData.targets || [];
      const blockTypes = new Set(); // 存储所有使用的积木块种类
      const eventBlockTypes = new Set(); // 存储事件积木块种类
      const controlBlockTypes = new Set(); // 存储控制积木块种类
      const operatorBlockTypes = new Set(); // 存储运算积木块种类
      const dataBlockTypes = new Set(); // 存储数据积木块种类
      const sensingBlockTypes = new Set(); // 存储侦测积木块种类
      const motionBlockTypes = new Set(); // 存储运动积木块种类
      const looksBlockTypes = new Set(); // 存储外观积木块种类
      const soundBlockTypes = new Set(); // 存储声音积木块种类
      const procedureBlockTypes = new Set(); // 存储自定义积木块种类
      const variableNames = new Set();
      const listNames = new Set();

      // 收集所有积木块种类
      targets.forEach(target => {
        const blocks = target.blocks || {};
        Object.values(blocks).forEach(block => {
          if (block.opcode) {
            blockTypes.add(block.opcode);

            // 分类收集积木块种类
            if (block.opcode.startsWith('event_')) {
              eventBlockTypes.add(block.opcode);
            }
            if (block.opcode.startsWith('control_')) {
              controlBlockTypes.add(block.opcode);
            }
            if (block.opcode.startsWith('operator_')) {
              operatorBlockTypes.add(block.opcode);
            }
            if (block.opcode.startsWith('data_')) {
              dataBlockTypes.add(block.opcode);
            }
            if (block.opcode.startsWith('sensing_')) {
              sensingBlockTypes.add(block.opcode);
            }
            if (block.opcode.startsWith('motion_')) {
              motionBlockTypes.add(block.opcode);
            }
            if (block.opcode.startsWith('looks_')) {
              looksBlockTypes.add(block.opcode);
            }
            if (block.opcode.startsWith('sound_')) {
              soundBlockTypes.add(block.opcode);
            }
            if (block.opcode.startsWith('procedures_')) {
              procedureBlockTypes.add(block.opcode);
            }
          }
        });

        // 收集变量和列表名称
        if (target.variables) {
          Object.values(target.variables).forEach(variable => {
            if (Array.isArray(variable) && variable.length > 0) {
              variableNames.add(variable[0]);
            }
          });
        }
        if (target.lists) {
          Object.values(target.lists).forEach(list => {
            if (Array.isArray(list) && list.length > 0) {
              listNames.add(list[0]);
            }
          });
        }
      });

      // 1. 抽象和问题分解 (Abstraction and problem decomposition)
      // 完全基于积木块种类评分
      const spriteCount = targets.filter(t => !t.isStage).length;
      const hasMultipleSprites = spriteCount > 1;
      const hasMultipleScripts = eventBlockTypes.size > 1; // 多种事件积木表示多个脚本
      const hasCustomBlocks = procedureBlockTypes.has('procedures_definition');
      const hasClones = controlBlockTypes.has('control_create_clone_of') || controlBlockTypes.has('control_start_as_clone');

      if (hasMultipleSprites && hasMultipleScripts) {
        scores[msg('abstraction', '抽象和问题分解')] = 1; // Basic
      }
      if (hasCustomBlocks) {
        scores[msg('abstraction', '抽象和问题分解')] = 2; // Developing
      }
      if (hasClones) {
        scores[msg('abstraction', '抽象和问题分解')] = 3; // Proficiency
      }

      // 2. 并行性 (Parallelism)
      // 基于不同的事件积木块种类
      const hasGreenFlag = eventBlockTypes.has('event_whenflagclicked');
      const hasKeyEvents = eventBlockTypes.has('event_whenkeypressed');
      const hasClickEvents = eventBlockTypes.has('event_whenthisspriteclicked');
      const hasMessageEvents = eventBlockTypes.has('event_whenbroadcastreceived');
      const hasCloneEvents = controlBlockTypes.has('control_create_clone_of');
      const hasSensorEvents = eventBlockTypes.has('event_whengreaterthan');
      const hasBackdropEvents = eventBlockTypes.has('event_whenbackdropswitchesto');

      if (hasGreenFlag && eventBlockTypes.size > 1) {
        scores[msg('parallelism', '并行性')] = 1; // Basic - 多个绿旗脚本
      }
      if ((hasKeyEvents || hasClickEvents) && (eventBlockTypes.size > 2)) {
        scores[msg('parallelism', '并行性')] = 2; // Developing - 按键或点击事件
      }
      if (hasMessageEvents || hasCloneEvents || hasSensorEvents || hasBackdropEvents) {
        scores[msg('parallelism', '并行性')] = 3; // Proficiency - 消息、克隆或传感器事件
      }

      // 3. 逻辑思维 (Logical thinking)
      // 基于不同的逻辑积木块种类
      const hasIf = controlBlockTypes.has('control_if');
      const hasIfElse = controlBlockTypes.has('control_if_else');
      const hasLogicOps = operatorBlockTypes.has('operator_and') ||
        operatorBlockTypes.has('operator_or') ||
        operatorBlockTypes.has('operator_not');

      if (hasIf) {
        scores[msg('logic', '逻辑思维')] = 1; // Basic
      }
      if (hasIfElse) {
        scores[msg('logic', '逻辑思维')] = 2; // Developing
      }
      if (hasLogicOps) {
        scores[msg('logic', '逻辑思维')] = 3; // Proficiency
      }

      // 4. 同步 (Synchronization)
      // 基于不同的同步积木块种类
      const hasWait = controlBlockTypes.has('control_wait');
      const hasBroadcast = eventBlockTypes.has('event_broadcast');
      const hasReceiveMessage = eventBlockTypes.has('event_whenbroadcastreceived');
      const hasStopAll = controlBlockTypes.has('control_stop_all');
      const hasStopThis = controlBlockTypes.has('control_stop_this_script');
      const hasStopOther = controlBlockTypes.has('control_stop_other_scripts_in_sprite');
      const hasWaitUntil = controlBlockTypes.has('control_wait_until');
      const hasBackdropChange = looksBlockTypes.has('looks_nextbackdrop') || looksBlockTypes.has('looks_switchbackdropto');
      const hasBroadcastAndWait = eventBlockTypes.has('event_broadcastandwait');

      if (hasWait) {
        scores[msg('synchronization', '同步')] = 1; // Basic
      }
      if (hasBroadcast || hasReceiveMessage || hasStopAll || hasStopThis || hasStopOther) {
        scores[msg('synchronization', '同步')] = 2; // Developing
      }
      if (hasWaitUntil || hasBackdropChange || hasBroadcastAndWait) {
        scores[msg('synchronization', '同步')] = 3; // Proficiency
      }

      // 5. 流程控制 (Flow control)
      // 基于不同的流程控制积木块种类
      const hasSequence = blockTypes.size > 0; // 任何积木块都表示有序列
      const hasRepeat = controlBlockTypes.has('control_repeat') || controlBlockTypes.has('control_forever');
      const hasRepeatUntil = controlBlockTypes.has('control_repeat_until');

      if (hasSequence) {
        scores[msg('flow-control', '流程控制')] = 1; // Basic
      }
      if (hasRepeat) {
        scores[msg('flow-control', '流程控制')] = 2; // Developing
      }
      if (hasRepeatUntil) {
        scores[msg('flow-control', '流程控制')] = 3; // Proficiency
      }

      // 6. 用户交互 (User Interactivity)
      // 基于不同的交互积木块种类
      const hasGreenFlagEvent = eventBlockTypes.has('event_whenflagclicked');
      const hasKeyPressedEvent = eventBlockTypes.has('event_whenkeypressed');
      const hasSpriteClickedEvent = eventBlockTypes.has('event_whenthisspriteclicked');
      const hasAskWait = sensingBlockTypes.has('sensing_askandwait');
      const hasMouseBlocks = sensingBlockTypes.has('sensing_mousedown') ||
        sensingBlockTypes.has('sensing_mousex') ||
        sensingBlockTypes.has('sensing_mousey');
      const hasSensorGreater = eventBlockTypes.has('event_whengreaterthan');
      const hasVideo = Array.from(blockTypes).some(type => type.startsWith('video_'));
      const hasAudioInteraction = soundBlockTypes.has('sound_playuntildone') ||
        soundBlockTypes.has('sound_setvolumeto') ||
        soundBlockTypes.has('sound_changevolumeby');

      if (hasGreenFlagEvent) {
        scores[msg('user-interactivity', '用户交互')] = 1; // Basic
      }
      if (hasKeyPressedEvent || hasSpriteClickedEvent || hasAskWait || hasMouseBlocks) {
        scores[msg('user-interactivity', '用户交互')] = 2; // Developing
      }
      if (hasSensorGreater || hasVideo || hasAudioInteraction) {
        scores[msg('user-interactivity', '用户交互')] = 3; // Proficiency
      }

      // 7. 数据表示 (Data representation)
      // 基于不同的数据积木块种类
      const hasSpriteModifiers = motionBlockTypes.size > 0 || looksBlockTypes.size > 0 || soundBlockTypes.size > 0;
      const hasVariableOperations = variableNames.size > 0 && dataBlockTypes.size > 0;
      const hasListOperations = listNames.size > 0 && Array.from(dataBlockTypes).some(type => type.includes('list'));

      if (hasSpriteModifiers) {
        scores[msg('data-representation', '数据表示')] = 1; // Basic
      }
      if (hasVariableOperations) {
        scores[msg('data-representation', '数据表示')] = 2; // Developing
      }
      if (hasListOperations) {
        scores[msg('data-representation', '数据表示')] = 3; // Proficiency
      }

      return scores;
    }

    // 计算数学逻辑评分
    calculateMathLogicScores(projectData) {
      const targets = projectData.targets || [];

      // 统计各类积木块数量
      let operatorCount = 0;
      let controlCount = 0;
      let dataCount = 0;

      targets.forEach(target => {
        const blocks = target.blocks || {};
        Object.values(blocks).forEach(block => {
          if (!block.opcode) return;

          if (block.opcode.startsWith('operator_')) {
            operatorCount++;
          }

          if (block.opcode.startsWith('control_')) {
            controlCount++;
          }

          if (block.opcode.startsWith('data_')) {
            dataCount++;
          }
        });
      });

      const scores = {
        [msg('operation-complexity', 'Operation Complexity')]: operatorCount,
        [msg('logic-depth', 'Logic Depth')]: controlCount,
        [msg('data-magnitude', 'Data Magnitude')]: dataCount
      };

      return scores;
    }

    // 格式化文件大小
    formatFileSize(bytes) {
      if (bytes === 0) return '0 B';

      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));

      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // 生成分析结果HTML
    generateAnalysisHTML() {
      return `
        <div class="sa-analyze-modal-body">
          <!-- 项目统计部分 -->
          <div class="sa-analyze-section">
            <h3 class="sa-analyze-section-title">${msg('project-stats', '项目统计')}</h3>
            <div class="sa-analyze-stats-grid" id="saStatsGrid">
              <div class="sa-analyze-stat">
                <div class="sa-analyze-stat-value">-</div>
                <div class="sa-analyze-stat-label">${msg('total-blocks', '总积木数')}</div>
              </div>
              <div class="sa-analyze-stat">
                <div class="sa-analyze-stat-value">-</div>
                <div class="sa-analyze-stat-label">${msg('effective-blocks', '有效积木')}</div>
              </div>
              <div class="sa-analyze-stat">
                <div class="sa-analyze-stat-value">-</div>
                <div class="sa-analyze-stat-label">${msg('function-definitions', '函数定义')}</div>
              </div>
              <div class="sa-analyze-stat">
                <div class="sa-analyze-stat-value">-</div>
                <div class="sa-analyze-stat-label">${msg('stat-sprites', '精灵数量')}</div>
              </div>
              <div class="sa-analyze-stat">
                <div class="sa-analyze-stat-value">-</div>
                <div class="sa-analyze-stat-label">${msg('stat-costumes', '造型数量')}</div>
              </div>
              <div class="sa-analyze-stat">
                <div class="sa-analyze-stat-value">-</div>
                <div class="sa-analyze-stat-label">${msg('stat-sounds', '声音数量')}</div>
              </div>
              <div class="sa-analyze-stat">
                <div class="sa-analyze-stat-value">-</div>
                <div class="sa-analyze-stat-label">${msg('stat-variables', '变量数量')}</div>
              </div>
              <div class="sa-analyze-stat">
                <div class="sa-analyze-stat-value">-</div>
                <div class="sa-analyze-stat-label">${msg('stat-lists', '列表数量')}</div>
              </div>
              <div class="sa-analyze-stat">
                <div class="sa-analyze-stat-value">-</div>
                <div class="sa-analyze-stat-label">${msg('extensions', '扩展数量')}</div>
              </div>
            </div>
          </div>

          <!-- 代码类型分布 -->
          <div class="sa-analyze-section">
            <h3 class="sa-analyze-section-title">${msg('block-distribution', '代码类型分布')}</h3>
            <div class="sa-analyze-chart-container">
              <canvas id="saCodeTypeChart" width="400" height="200"></canvas>
            </div>
          </div>

          <!-- Dr.Scratch评分系统 -->
          <div class="sa-analyze-section">
            <h3 class="sa-analyze-section-title">${msg('dr-scratch-score', 'Dr.Scratch评分系统')}</h3>
            <div class="sa-analyze-row">
              <div class="sa-analyze-col-6">
                <div class="sa-analyze-chart-container">
                  <canvas id="saDrScratchChart" width="400" height="300"></canvas>
                </div>
              </div>
              <div class="sa-analyze-col-6">
                <div class="sa-analyze-score-details" id="saDrScratchDetails">
                  <div class="sa-analyze-score-summary">
                    <h4>${msg('total-score', '总分')}：<span id="saDrScratchTotalScore">0</span> / 21</h4>
                    <div class="sa-analyze-score-level" id="saDrScratchScoreLevel">${msg('evaluation-level', '评估等级')}：${msg('calculating', '计算中...')}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 核心数学能力评估 -->
          <div class="sa-analyze-section">
            <h3 class="sa-analyze-section-title">${msg('math-logic-assessment', '核心数学能力评估')}</h3>
            <div class="sa-analyze-row">
              <div class="sa-analyze-col-6">
                <div class="sa-analyze-chart-container">
                  <canvas id="saMathLogicChart" width="400" height="300"></canvas>
                </div>
              </div>
              <div class="sa-analyze-col-6">
                <div class="sa-analyze-score-details" id="saMathLogicDetails">
                  <div class="sa-analyze-score-summary">
                    <h4>${msg('math-total-score', '数学总分')}：<span id="saMathTotalScore">0</span> ${msg('blocks-count', '')}</h4>
                    <div class="sa-analyze-score-level" id="saMathScoreLevel">${msg('evaluation-level', '评估等级')}：${msg('calculating', '计算中...')}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 使用的扩展 -->
          <div class="sa-analyze-section">
            <h3 class="sa-analyze-section-title">${msg('extensions-used', '使用的扩展')}</h3>
            <div class="sa-analyze-extension-list" id="saExtensionList">
              <p>${msg('loading', '加载中...')}</p>
            </div>
          </div>
        </div>
      `;
    }

    // 更新分析结果
    updateAnalysisResults(analysis) {
      // 更新统计数据
      this.updateStats(analysis);

      // 更新代码类型分布图
      this.displayCodeTypeChart(analysis);

      // 计算并更新Dr.Scratch评分
      const vm = addon.tab.traps.vm;
      const projectJSON = JSON.parse(vm.toJSON());
      const drScratchScores = this.calculateDrScratchScores(projectJSON);
      this.displayDrScratchScores(drScratchScores);

      // 计算并更新数学逻辑评分
      const mathLogicScores = this.calculateMathLogicScores(projectJSON);
      this.displayMathLogicScores(mathLogicScores);

      // 更新扩展列表
      this.displayExtensions(analysis.extensions);

      // 显示结果，隐藏加载
      document.getElementById('saAnalyzeLoading').style.display = 'none';
      document.getElementById('saAnalyzeResults').style.display = 'block';
    }

    // 更新统计数据
    updateStats(analysis) {
      const statsGrid = document.getElementById('saStatsGrid');
      const totalExtensionBlocks = analysis.extensions.reduce((sum, ext) => sum + ext.blocks.length, 0);

      statsGrid.innerHTML = `
        <div class="sa-analyze-stat">
          <div class="sa-analyze-stat-value">${analysis.totalBlocks}</div>
          <div class="sa-analyze-stat-label">${msg('total-blocks', '总积木数')}</div>
        </div>
        <div class="sa-analyze-stat">
          <div class="sa-analyze-stat-value">${analysis.effectiveBlocks}</div>
          <div class="sa-analyze-stat-label">${msg('effective-blocks', '有效积木')}</div>
        </div>
        <div class="sa-analyze-stat">
          <div class="sa-analyze-stat-value">${analysis.functionDefinitions}</div>
          <div class="sa-analyze-stat-label">${msg('function-definitions', '函数定义')}</div>
        </div>
        <div class="sa-analyze-stat">
          <div class="sa-analyze-stat-value">${analysis.sprites}</div>
          <div class="sa-analyze-stat-label">${msg('stat-sprites', '精灵数量')}</div>
        </div>
        <div class="sa-analyze-stat">
          <div class="sa-analyze-stat-value">${analysis.costumeCount}</div>
          <div class="sa-analyze-stat-label">${msg('stat-costumes', '造型数量')}</div>
        </div>
        <div class="sa-analyze-stat">
          <div class="sa-analyze-stat-value">${analysis.soundCount}</div>
          <div class="sa-analyze-stat-label">${msg('stat-sounds', '声音数量')}</div>
        </div>
        <div class="sa-analyze-stat">
          <div class="sa-analyze-stat-value">${analysis.variableCount}</div>
          <div class="sa-analyze-stat-label">${msg('stat-variables', '变量数量')}</div>
        </div>
        <div class="sa-analyze-stat">
          <div class="sa-analyze-stat-value">${analysis.listCount}</div>
          <div class="sa-analyze-stat-label">${msg('stat-lists', '列表数量')}</div>
        </div>
        <div class="sa-analyze-stat">
          <div class="sa-analyze-stat-value">${analysis.extensions.length}</div>
          <div class="sa-analyze-stat-label">${msg('extensions', '扩展数量')}</div>
        </div>
      `;
    }

    // 显示代码类型分布图
    displayCodeTypeChart(analysis) {
      const canvas = document.getElementById('saCodeTypeChart');
      if (!canvas) return;

      const ctx = canvas.getContext('2d');

      // 定义标准类别的固定顺序
      const standardOrder = [
        msg('motion', '运动'),
        msg('looks', '外观'),
        msg('sound', '声音'),
        msg('events', '事件'),
        msg('control', '控制'),
        msg('sensing', '侦测'),
        msg('operators', '运算'),
        msg('data', '数据'),
        msg('custom-functions', '自定义函数')
      ];

      // 分离标准和扩展类别
      const standardCategories = {};
      const extensionCategories = {};

      Object.keys(analysis.codeTypes).forEach(category => {
        if (standardOrder.includes(category)) {
          standardCategories[category] = analysis.codeTypes[category];
        } else {
          extensionCategories[category] = analysis.codeTypes[category];
        }
      });

      // 按固定顺序排列标准类别
      const orderedStandard = {};
      standardOrder.forEach(category => {
        if (standardCategories[category]) {
          orderedStandard[category] = standardCategories[category];
        }
      });

      // 按字母顺序排序扩展类别
      const sortedExtensions = {};
      Object.keys(extensionCategories).sort().forEach(category => {
        sortedExtensions[category] = extensionCategories[category];
      });

      // 合并排序后的数据
      const sortedCodeTypes = { ...orderedStandard, ...sortedExtensions };
      const sortedLabels = Object.keys(sortedCodeTypes);
      const sortedData = Object.values(sortedCodeTypes);

      // 定义每个类别的颜色
      const categoryColors = {
        [msg('motion', '运动')]: '#4C97FF',
        [msg('looks', '外观')]: '#9966FF',
        [msg('sound', '声音')]: '#CF63CF',
        [msg('events', '事件')]: '#FFBF00',
        [msg('control', '控制')]: '#FFAB19',
        [msg('sensing', '侦测')]: '#5CB1D6',
        [msg('operators', '运算')]: '#59C059',
        [msg('data', '数据')]: '#FF8C1A',
        [msg('custom-functions', '自定义函数')]: '#FF6680'
      };

      // 为扩展生成默认颜色
      const extensionColors = [
        '#3498DB', '#E74C3C', '#F39C12', '#27AE60', '#16A085',
        '#2ECC71', '#E67E22', '#95A5A6', '#34495E', '#7F8C8D',
        '#9B59B6', '#1ABC9C', '#2C3E50', '#F1C40F', '#D35400',
        '#C0392B', '#BDC3C7', '#7F8C8D', '#95A5A6'
      ];

      // 为每个标签分配对应颜色
      const assignedColors = sortedLabels.map((label, index) => {
        if (categoryColors[label]) {
          return categoryColors[label];
        } else {
          // 检查是否是具有自定义颜色的扩展
          const extension = analysis.extensions.find(ext => ext.name === label);
          if (extension && extension.color) {
            return extension.color;
          }
          // 使用预定义的扩展颜色
          return extensionColors[index % extensionColors.length];
        }
      });

      // 销毁现有图表
      if (this.chartInstance) {
        this.chartInstance.destroy();
        this.chartInstance = null;
      }

      // 创建新图表
      this.chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: sortedLabels,
          datasets: [{
            data: sortedData,
            backgroundColor: assignedColors,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'right',
              labels: {
                boxWidth: 12,
                padding: 10,
                font: {
                  size: 11
                }
              }
            },
            tooltip: {
              callbacks: {
                label: function (context) {
                  const label = context.label || '';
                  const value = context.raw || 0;
                  const total = context.dataset.data.reduce((a, b) => a + b, 0);
                  const percentage = ((value / total) * 100).toFixed(1);
                  return `${label}: ${value} (${percentage}%)`;
                }
              }
            }
          }
        }
      });
    }

    // 显示Dr.Scratch评分
    displayDrScratchScores(scores) {
      const canvas = document.getElementById('saDrScratchChart');
      if (!canvas) return;

      const ctx = canvas.getContext('2d');

      const labels = Object.keys(scores);
      const data = Object.values(scores);
      const totalScore = data.reduce((sum, val) => sum + val, 0);

      // 更新总分
      document.getElementById('saDrScratchTotalScore').textContent = totalScore;

      // 计算等级
      let level = msg('beginner', '初学者');
      if (totalScore >= 18) {
        level = msg('expert', '专家级');
      } else if (totalScore >= 14) {
        level = msg('advanced', '高级');
      } else if (totalScore >= 10) {
        level = msg('intermediate', '中级');
      } else if (totalScore >= 6) {
        level = msg('developing', '发展中');
      }
      document.getElementById('saDrScratchScoreLevel').textContent = `${msg('evaluation-level', '评估等级')}：${level}`;

      // 更新评分详情
      const detailsHTML = labels.map(label => `
        <div class="sa-analyze-score-item">
          <div class="sa-analyze-score-label">${label}</div>
          <div class="sa-analyze-score-bar">
            <div class="sa-analyze-score-fill" style="width: ${(scores[label] / 3) * 100}%"></div>
          </div>
          <div class="sa-analyze-score-value">${scores[label]}/3</div>
        </div>
      `).join('');

      const detailsContainer = document.getElementById('saDrScratchDetails');
      const summaryHTML = detailsContainer.querySelector('.sa-analyze-score-summary').outerHTML;
      detailsContainer.innerHTML = summaryHTML + detailsHTML;

      // 销毁现有图表
      if (this.drScratchChartInstance) {
        this.drScratchChartInstance.destroy();
        this.drScratchChartInstance = null;
      }

      // 创建雷达图
      this.drScratchChartInstance = new Chart(ctx, {
        type: 'radar',
        data: {
          labels: labels,
          datasets: [{
            label: msg('computational-thinking-score', '计算思维评分'),
            data: data,
            backgroundColor: 'rgba(77, 151, 255, 0.2)',
            borderColor: '#4d97ff',
            borderWidth: 2,
            pointBackgroundColor: '#4d97ff',
            pointBorderColor: '#fff',
            pointHoverBackgroundColor: '#fff',
            pointHoverBorderColor: '#4d97ff'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            r: {
              beginAtZero: true,
              max: 3,
              ticks: {
                stepSize: 1
              }
            }
          },
          plugins: {
            legend: {
              display: false
            }
          }
        }
      });
    }

    // 显示数学逻辑评分
    displayMathLogicScores(scores) {
      const canvas = document.getElementById('saMathLogicChart');
      if (!canvas) return;

      const ctx = canvas.getContext('2d');

      const labels = Object.keys(scores);
      const data = Object.values(scores);
      const totalScore = data.reduce((sum, val) => sum + val, 0);

      // 更新总分
      document.getElementById('saMathTotalScore').textContent = totalScore;

      // 计算等级
      let level = msg('beginner', '初级');
      if (totalScore >= 20) {
        level = msg('advanced', '高级');
      } else if (totalScore >= 10) {
        level = msg('intermediate', '中级');
      } else if (totalScore >= 5) {
        level = msg('developing', '发展中');
      }
      document.getElementById('saMathScoreLevel').textContent = `${msg('evaluation-level', '评估等级')}：${level}`;

      // 更新评分详情
      const detailsHTML = labels.map(label => `
        <div class="sa-analyze-score-item">
          <div class="sa-analyze-score-label">${label}</div>
          <div class="sa-analyze-score-value">${scores[label]} </div>
        </div>
      `).join('');

      const detailsContainer = document.getElementById('saMathLogicDetails');
      const summaryHTML = detailsContainer.querySelector('.sa-analyze-score-summary').outerHTML;
      detailsContainer.innerHTML = summaryHTML + detailsHTML;

      // 销毁现有图表
      if (this.mathLogicChartInstance) {
        this.mathLogicChartInstance.destroy();
        this.mathLogicChartInstance = null;
      }

      // 数据标准化
      const maxValue = Math.max(...data, 1);
      const normalizedData = data.map(value => value / maxValue);

      // 创建雷达图
      this.mathLogicChartInstance = new Chart(ctx, {
        type: 'radar',
        data: {
          labels: labels,
          datasets: [{
            label: msg('relative-intensity', '相对强度'),
            data: normalizedData,
            backgroundColor: 'rgba(230, 81, 0, 0.2)',
            borderColor: '#E65100',
            borderWidth: 2,
            pointBackgroundColor: '#E65100',
            pointBorderColor: '#fff',
            pointHoverBackgroundColor: '#fff',
            pointHoverBorderColor: '#E65100'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            r: {
              beginAtZero: true,
              max: 1,
              ticks: {
                stepSize: 0.2
              }
            }
          },
          plugins: {
            legend: {
              display: false
            },
            tooltip: {
              callbacks: {
                label: function (context) {
                  const label = context.label || '';
                  const rawValue = data[context.dataIndex];
                  return `${label}: ${rawValue} `;
                }
              }
            }
          }
        }
      });
    }

    // 显示扩展列表
    displayExtensions(extensions) {
      const extensionList = document.getElementById('saExtensionList');

      if (extensions.length === 0) {
        extensionList.innerHTML = `<p>${msg('no-extensions', '未使用扩展')}</p>`;
        return;
      }

      let html = '<div class="sa-analyze-extensions-grid">';

      extensions.forEach(extension => {
        const color = extension.color || '#888888';
        html += `
          <div class="sa-analyze-extension-item">
            <div class="sa-analyze-extension-color" style="background-color: ${color}"></div>
            <div class="sa-analyze-extension-name">${extension.name}</div>
            <div class="sa-analyze-extension-count">${extension.blocks.length} ${msg('blocks-count', '')}</div>
          </div>
        `;
      });

      html += '</div>';
      extensionList.innerHTML = html;
    }

    // 导出分析结果为图片
    async exportAnalysisAsImage() {
      // 获取项目数据并执行分析
      const vm = addon.tab.traps.vm;
      const projectJSON = JSON.parse(vm.toJSON());
      const analysis = this.performAnalysis(projectJSON);
      const drScratchScores = this.calculateDrScratchScores(projectJSON);
      const mathLogicScores = this.calculateMathLogicScores(projectJSON);

      // 创建导出Canvas
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      // 设置Canvas尺寸
      const padding = 40;
      const sectionPadding = 25;
      const topBarHeight = 60;
      const statsHeight = 200;
      const chartHeight = 280;
      const scoreSectionHeight = 320;
      const footerHeight = 40;

      const totalHeight = topBarHeight + statsHeight + chartHeight + scoreSectionHeight * 2 + footerHeight + padding * 2 + sectionPadding * 4;
      const width = 900;
      canvas.width = width;
      canvas.height = totalHeight;

      // 设置背景
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, totalHeight);

      // 绘制顶部栏
      ctx.fillStyle = '#66ccff';
      ctx.fillRect(0, 0, width, topBarHeight);

      // 绘制Logo（使用SVG路径直接绘制）
      const logoX = 20;
      const logoY = 12;
      const logoWidth = 36;
      const logoHeight = 36;
      // 将SVG坐标缩放并平移到我们需要的位置
      const scale = logoWidth / 103.42932;
      const offsetX = logoX - 188.28534 * scale;
      const offsetY = logoY - 128.35262 * scale;
      
      ctx.save();
      ctx.fillStyle = '#ffffff';
      
      // 绘制所有路径
      ctx.beginPath();
      ctx.moveTo(188.28534 * scale + offsetX, 196.60551 * scale + offsetY);
      ctx.lineTo(188.28534 * scale + offsetX, (196.60551 - 68.25289) * scale + offsetY);
      ctx.lineTo((188.28534 + 33.21101) * scale + offsetX, (196.60551 - 68.25289) * scale + offsetY);
      ctx.lineTo((188.28534 + 33.21101) * scale + offsetX, 196.60551 * scale + offsetY);
      ctx.closePath();
      ctx.fill();
      
      ctx.beginPath();
      ctx.moveTo(188.28534 * scale + offsetX, 196.60551 * scale + offsetY);
      ctx.lineTo(188.28534 * scale + offsetX, (196.60551 - 33.21101) * scale + offsetY);
      ctx.lineTo((188.28534 + 103.29475) * scale + offsetX, (196.60551 - 33.21101) * scale + offsetY);
      ctx.lineTo((188.28534 + 103.29475) * scale + offsetX, 196.60551 * scale + offsetY);
      ctx.closePath();
      ctx.fill();
      
      ctx.beginPath();
      ctx.moveTo(188.28534 * scale + offsetX, 231.64738 * scale + offsetY);
      ctx.lineTo(188.28534 * scale + offsetX, (231.64738 - 33.21101) * scale + offsetY);
      ctx.lineTo((188.28534 + 68.32016) * scale + offsetX, (231.64738 - 33.21101) * scale + offsetY);
      ctx.lineTo((188.28534 + 68.32016) * scale + offsetX, 231.64738 * scale + offsetY);
      ctx.closePath();
      ctx.fill();
      
      ctx.beginPath();
      ctx.moveTo(223.3945 * scale + offsetX, 161.56363 * scale + offsetY);
      ctx.lineTo(223.3945 * scale + offsetX, (161.56363 - 33.21101) * scale + offsetY);
      ctx.lineTo((223.3945 + 33.21101) * scale + offsetX, (161.56363 - 33.21101) * scale + offsetY);
      ctx.lineTo((223.3945 + 33.21101) * scale + offsetX, 161.56363 * scale + offsetY);
      ctx.closePath();
      ctx.fill();
      
      ctx.beginPath();
      ctx.moveTo(258.50366 * scale + offsetX, 161.56363 * scale + offsetY);
      ctx.lineTo(258.50366 * scale + offsetX, (161.56363 - 33.21101) * scale + offsetY);
      ctx.lineTo((258.50366 + 33.21101) * scale + offsetX, (161.56363 - 33.21101) * scale + offsetY);
      ctx.lineTo((258.50366 + 33.21101) * scale + offsetX, 161.56363 * scale + offsetY);
      ctx.closePath();
      ctx.fill();
      
      ctx.beginPath();
      ctx.moveTo(258.50366 * scale + offsetX, 231.64738 * scale + offsetY);
      ctx.lineTo(258.50366 * scale + offsetX, (231.64738 - 68.25289) * scale + offsetY);
      ctx.lineTo((258.50366 + 33.21101) * scale + offsetX, (231.64738 - 68.25289) * scale + offsetY);
      ctx.lineTo((258.50366 + 33.21101) * scale + offsetX, 231.64738 * scale + offsetY);
      ctx.closePath();
      ctx.fill();
      
      ctx.restore();

      // 绘制标题文本
      ctx.font = 'bold 20px Arial, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.fillText('Simple Project Analyser Result', logoX + 50, logoY + 24);

      let y = topBarHeight + padding;

      // 绘制项目统计部分
      y = this.drawStatsSection(ctx, analysis, width, y, padding, sectionPadding);

      // 绘制代码类型分布饼图
      y = this.drawCodeTypeChart(ctx, analysis, width, y, padding, sectionPadding);

      // 绘制Dr.Scratch评分
      y = this.drawDrScratchSection(ctx, drScratchScores, width, y, padding, sectionPadding);

      // 绘制数学逻辑评分
      y = this.drawMathLogicSection(ctx, mathLogicScores, width, y, padding, sectionPadding);

      // 绘制底部版权信息
      ctx.font = '12px Arial, sans-serif';
      ctx.fillStyle = '#aaaaaa';
      ctx.textAlign = 'center';
      ctx.fillText('Generated by Simple Project Analyser', width / 2, totalHeight - 15);

      // 下载图片
      const link = document.createElement('a');
      link.download = `project-analysis-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    }

    // 绘制统计部分
    drawStatsSection(ctx, analysis, width, y, padding, sectionPadding) {
      const sectionWidth = width - padding * 2;
      const sectionHeight = 200;
      
      // 绘制背景
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.05)';
      ctx.shadowBlur = 5;
      ctx.shadowOffsetY = 2;
      ctx.beginPath();
      ctx.roundRect(padding, y, sectionWidth, sectionHeight, 12);
      ctx.fill();
      ctx.shadowColor = 'transparent';

      // 绘制标题
      ctx.font = 'bold 16px Arial, sans-serif';
      ctx.fillStyle = '#333333';
      ctx.textAlign = 'left';
      ctx.fillText(msg('project-stats', '项目统计'), padding + 20, y + 30);

      // 统计数据
      const stats = [
        { label: msg('total-blocks', '总积木数'), value: analysis.totalBlocks },
        { label: msg('effective-blocks', '有效积木'), value: analysis.effectiveBlocks },
        { label: msg('function-definitions', '函数定义'), value: analysis.functionDefinitions },
        { label: msg('stat-sprites', '精灵数量'), value: analysis.sprites },
        { label: msg('stat-costumes', '造型数量'), value: analysis.costumeCount },
        { label: msg('stat-sounds', '声音数量'), value: analysis.soundCount },
        { label: msg('stat-variables', '变量数量'), value: analysis.variableCount },
        { label: msg('stat-lists', '列表数量'), value: analysis.listCount },
        { label: msg('extensions', '扩展数量'), value: analysis.extensions.length }
      ];

      const cols = 3;
      const rows = 3;
      const itemWidth = (sectionWidth - 40) / cols;
      const itemHeight = (sectionHeight - 60) / rows;

      stats.forEach((stat, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);
        const itemX = padding + 20 + col * itemWidth;
        const itemY = y + 50 + row * itemHeight;

        // 绘制数值
        ctx.font = 'bold 22px Arial, sans-serif';
        ctx.fillStyle = '#4C97FF';
        ctx.textAlign = 'center';
        ctx.fillText(stat.value.toString(), itemX + itemWidth / 2, itemY + 20);

        // 绘制标签
        ctx.font = '13px Arial, sans-serif';
        ctx.fillStyle = '#666666';
        ctx.fillText(stat.label, itemX + itemWidth / 2, itemY + 42);
      });

      return y + sectionHeight + sectionPadding;
    }

    // 绘制代码类型分布饼图
    drawCodeTypeChart(ctx, analysis, width, y, padding, sectionPadding) {
      const sectionWidth = width - padding * 2;
      
      // 绘制背景
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.05)';
      ctx.shadowBlur = 5;
      ctx.shadowOffsetY = 2;
      ctx.beginPath();
      ctx.roundRect(padding, y, sectionWidth, 280, 12);
      ctx.fill();
      ctx.shadowColor = 'transparent';

      // 绘制标题
      ctx.font = 'bold 16px Arial, sans-serif';
      ctx.fillStyle = '#333333';
      ctx.textAlign = 'left';
      ctx.fillText(msg('block-distribution', '代码类型分布'), padding + 20, y + 30);

      // 饼图区域位置：左侧1/3位置
      const chartAreaWidth = sectionWidth / 3;
      const centerX = padding + chartAreaWidth / 2;
      const centerY = y + 140; // 背景高度280的垂直中心
      const radius = 80; // 减小半径以适应背景

      // 定义颜色
      const categoryColors = {
        [msg('motion', '运动')]: '#4C97FF',
        [msg('looks', '外观')]: '#9966FF',
        [msg('sound', '声音')]: '#CF63CF',
        [msg('events', '事件')]: '#FFBF00',
        [msg('control', '控制')]: '#FFAB19',
        [msg('sensing', '侦测')]: '#5CB1D6',
        [msg('operators', '运算')]: '#59C059',
        [msg('data', '数据')]: '#FF8C1A',
        [msg('custom-functions', '自定义函数')]: '#FF6680'
      };

      const extensionColors = [
        '#3498DB', '#E74C3C', '#F39C12', '#27AE60', '#16A085',
        '#2ECC71', '#E67E22', '#95A5A6', '#34495E', '#7F8C8D',
        '#9B59B6', '#1ABC9C', '#2C3E50', '#F1C40F', '#D35400'
      ];

      // 排序数据
      const standardOrder = [
        msg('motion', '运动'), msg('looks', '外观'), msg('sound', '声音'),
        msg('events', '事件'), msg('control', '控制'), msg('sensing', '侦测'),
        msg('operators', '运算'), msg('data', '数据'), msg('custom-functions', '自定义函数')
      ];

      const sortedCodeTypes = {};
      standardOrder.forEach(category => {
        if (analysis.codeTypes[category]) {
          sortedCodeTypes[category] = analysis.codeTypes[category];
        }
      });

      Object.keys(analysis.codeTypes).sort().forEach(category => {
        if (!standardOrder.includes(category)) {
          sortedCodeTypes[category] = analysis.codeTypes[category];
        }
      });

      const labels = Object.keys(sortedCodeTypes);
      const data = Object.values(sortedCodeTypes);
      const total = data.reduce((a, b) => a + b, 0);

      // 绘制饼图
      let startAngle = -Math.PI / 2;

      data.forEach((value, index) => {
        const sliceAngle = (value / total) * Math.PI * 2;
        const endAngle = startAngle + sliceAngle;
        const label = labels[index];

        // 获取颜色
        let color = categoryColors[label];
        if (!color) {
          color = extensionColors[index % extensionColors.length];
        }

        // 绘制扇形
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();

        // 绘制边框
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        startAngle = endAngle;
      });

      // 绘制图例（3列布局，限制最大显示数量）
      const legendStartX = padding + 280;
      const legendItemWidth = 180;
      const maxItems = 21; // 最多显示21项
      const displayLabels = labels.slice(0, maxItems);
      const displayData = data.slice(0, maxItems);

      displayLabels.forEach((label, index) => {
        let color = categoryColors[label];
        if (!color) {
          color = extensionColors[index % extensionColors.length];
        }

        const row = Math.floor(index / 3);
        const col = index % 3;
        const legendX = legendStartX + col * legendItemWidth;
        const legendY = y + 50 + row * 26;

        // 绘制颜色方块
        ctx.fillStyle = color;
        ctx.fillRect(legendX, legendY, 10, 10);

        // 绘制标签和数值
        ctx.font = '11px Arial, sans-serif';
        ctx.fillStyle = '#333333';
        ctx.textAlign = 'left';
        
        const displayLabel = label.length > 10 ? label.substring(0, 10) + '...' : label;
        ctx.fillText(`${displayLabel}: ${displayData[index]}`, legendX + 14, legendY + 9);
      });

      // 如果有更多项目，显示提示
      if (labels.length > maxItems) {
        ctx.font = '11px Arial, sans-serif';
        ctx.fillStyle = '#999999';
        ctx.textAlign = 'left';
        ctx.fillText(`+${labels.length - maxItems} more...`, legendStartX, y + 50 + Math.ceil(maxItems / 3) * 26 + 10);
      }

      return y + 280 + sectionPadding;
    }

    // 绘制Dr.Scratch评分部分
    drawDrScratchSection(ctx, scores, width, y, padding, sectionPadding) {
      const sectionWidth = width - padding * 2;
      
      // 绘制背景
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.05)';
      ctx.shadowBlur = 5;
      ctx.shadowOffsetY = 2;
      ctx.beginPath();
      ctx.roundRect(padding, y, sectionWidth, 320, 12);
      ctx.fill();
      ctx.shadowColor = 'transparent';

      // 绘制标题
      ctx.font = 'bold 16px Arial, sans-serif';
      ctx.fillStyle = '#333333';
      ctx.textAlign = 'left';
      ctx.fillText(msg('dr-scratch-score', 'Dr.Scratch评分系统'), padding + 20, y + 30);

      const labels = Object.keys(scores);
      const data = Object.values(scores);
      const totalScore = data.reduce((sum, val) => sum + val, 0);

      // 计算等级
      let level = msg('beginner', '初学者');
      if (totalScore >= 18) level = msg('expert', '专家级');
      else if (totalScore >= 14) level = msg('advanced', '高级');
      else if (totalScore >= 10) level = msg('intermediate', '中级');
      else if (totalScore >= 6) level = msg('developing', '发展中');

      // 绘制雷达图（在背景左侧1/3位置）
      this.drawRadarChart(ctx, padding + 136, y + 160, 80, labels, data, 3, '#4d97ff');

      // 绘制评分详情
      const detailsX = padding + 340;
      let detailsY = y + 60;

      // 总分
      ctx.font = 'bold 18px Arial, sans-serif';
      ctx.fillStyle = '#333333';
      ctx.fillText(`${msg('total-score', '总分')}: ${totalScore} / 21`, detailsX, detailsY);
      detailsY += 25;

      // 等级
      ctx.font = '14px Arial, sans-serif';
      ctx.fillStyle = '#666666';
      ctx.fillText(`${msg('evaluation-level', '评估等级')}: ${level}`, detailsX, detailsY);
      detailsY += 35;

      // 各项评分
      labels.forEach((label, index) => {
        const score = data[index];
        
        // 标签
        ctx.font = '12px Arial, sans-serif';
        ctx.fillStyle = '#333333';
        const displayLabel = label.length > 14 ? label.substring(0, 14) + '...' : label;
        ctx.fillText(displayLabel, detailsX, detailsY);

        // 进度条背景
        ctx.fillStyle = '#eeeeee';
        ctx.fillRect(detailsX + 150, detailsY - 10, 100, 12);

        // 进度条填充
        ctx.fillStyle = '#4d97ff';
        ctx.fillRect(detailsX + 150, detailsY - 10, (score / 3) * 100, 12);

        // 分数
        ctx.font = 'bold 12px Arial, sans-serif';
        ctx.fillStyle = '#333333';
        ctx.fillText(`${score}/3`, detailsX + 260, detailsY);

        detailsY += 28;
      });

      return y + 320 + sectionPadding;
    }

    // 绘制数学逻辑评分部分
    drawMathLogicSection(ctx, scores, width, y, padding, sectionPadding) {
      const sectionWidth = width - padding * 2;
      
      // 绘制背景
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.05)';
      ctx.shadowBlur = 5;
      ctx.shadowOffsetY = 2;
      ctx.beginPath();
      ctx.roundRect(padding, y, sectionWidth, 320, 12);
      ctx.fill();
      ctx.shadowColor = 'transparent';

      // 绘制标题
      ctx.font = 'bold 16px Arial, sans-serif';
      ctx.fillStyle = '#333333';
      ctx.textAlign = 'left';
      ctx.fillText(msg('math-logic-assessment', '核心数学能力评估'), padding + 20, y + 30);

      const labels = Object.keys(scores);
      const data = Object.values(scores);
      const totalScore = data.reduce((sum, val) => sum + val, 0);

      // 计算等级
      let level = msg('beginner', '初级');
      if (totalScore >= 20) level = msg('advanced', '高级');
      else if (totalScore >= 10) level = msg('intermediate', '中级');
      else if (totalScore >= 5) level = msg('developing', '发展中');

      // 标准化数据用于雷达图
      const maxValue = Math.max(...data, 1);
      const normalizedData = data.map(v => v / maxValue);

      // 绘制雷达图（在背景左侧1/3位置）
      this.drawRadarChart(ctx, padding + 136, y + 160, 100, labels, normalizedData, 1, '#E65100');

      // 绘制评分详情
      const detailsX = padding + 340;
      let detailsY = y + 60;

      // 总分
      ctx.font = 'bold 18px Arial, sans-serif';
      ctx.fillStyle = '#333333';
      ctx.fillText(`${msg('math-total-score', '数学总分')}: ${totalScore}`, detailsX, detailsY);
      detailsY += 25;

      // 等级
      ctx.font = '14px Arial, sans-serif';
      ctx.fillStyle = '#666666';
      ctx.fillText(`${msg('evaluation-level', '评估等级')}: ${level}`, detailsX, detailsY);
      detailsY += 35;

      // 各项评分
      labels.forEach((label, index) => {
        ctx.font = '12px Arial, sans-serif';
        ctx.fillStyle = '#333333';
        const displayLabel = label.length > 14 ? label.substring(0, 14) + '...' : label;
        ctx.fillText(`${displayLabel}: ${data[index]}`, detailsX, detailsY);
        detailsY += 28;
      });

      return y + 320 + sectionPadding;
    }

    // 绘制雷达图
    drawRadarChart(ctx, centerX, centerY, radius, labels, data, maxValue, color) {
      const numSides = labels.length;
      const angleStep = (Math.PI * 2) / numSides;

      // 绘制网格
      const gridLevels = 5;
      for (let i = 1; i <= gridLevels; i++) {
        const gridRadius = (radius / gridLevels) * i;
        ctx.beginPath();
        for (let j = 0; j < numSides; j++) {
          const angle = j * angleStep - Math.PI / 2;
          const x = centerX + gridRadius * Math.cos(angle);
          const y = centerY + gridRadius * Math.sin(angle);
          if (j === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.strokeStyle = '#eeeeee';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // 绘制轴线
      for (let i = 0; i < numSides; i++) {
        const angle = i * angleStep - Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(centerX + radius * Math.cos(angle), centerY + radius * Math.sin(angle));
        ctx.strokeStyle = '#dddddd';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // 绘制数据区域
      ctx.beginPath();
      data.forEach((value, index) => {
        const angle = index * angleStep - Math.PI / 2;
        const pointRadius = (value / maxValue) * radius;
        const x = centerX + pointRadius * Math.cos(angle);
        const y = centerY + pointRadius * Math.sin(angle);
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.fillStyle = color + '33'; // 添加透明度
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();

      // 绘制数据点
      data.forEach((value, index) => {
        const angle = index * angleStep - Math.PI / 2;
        const pointRadius = (value / maxValue) * radius;
        const x = centerX + pointRadius * Math.cos(angle);
        const y = centerY + pointRadius * Math.sin(angle);
        
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      });

      // 绘制标签
      ctx.font = '10px Arial, sans-serif';
      ctx.fillStyle = '#666666';
      ctx.textAlign = 'center';

      labels.forEach((label, index) => {
        const angle = index * angleStep - Math.PI / 2;
        const labelRadius = radius + 15; // 减小标签半径
        const x = centerX + labelRadius * Math.cos(angle);
        const y = centerY + labelRadius * Math.sin(angle);

        const displayLabel = label.length > 8 ? label.substring(0, 8) + '...' : label;
        ctx.fillText(displayLabel, x, y);
      });
    }

    // 绘制扩展列表部分
    drawExtensionsSection(ctx, extensions, width, y, padding, sectionPadding) {
      const sectionWidth = width - padding * 2;
      const height = Math.max(150, extensions.length * 50 + 60);
      
      // 绘制背景
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.05)';
      ctx.shadowBlur = 5;
      ctx.shadowOffsetY = 2;
      ctx.beginPath();
      ctx.roundRect(padding, y, sectionWidth, height, 12);
      ctx.fill();
      ctx.shadowColor = 'transparent';

      // 绘制标题
      ctx.font = 'bold 16px Arial, sans-serif';
      ctx.fillStyle = '#333333';
      ctx.textAlign = 'left';
      ctx.fillText(msg('extensions-used', '使用的扩展'), padding + 20, y + 30);

      if (extensions.length === 0) {
        ctx.font = '14px Arial, sans-serif';
        ctx.fillStyle = '#999999';
        ctx.fillText(msg('no-extensions', '未使用扩展'), padding + 20, y + 60);
        return;
      }

      const cols = 3;
      const itemWidth = (sectionWidth - 40) / cols;
      const itemHeight = 40;

      extensions.forEach((extension, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);
        const itemX = padding + 20 + col * itemWidth;
        const itemY = y + 50 + row * itemHeight;

        // 绘制背景
        ctx.fillStyle = '#f8f9fa';
        ctx.beginPath();
        ctx.roundRect(itemX, itemY, itemWidth - 10, itemHeight - 8, 6);
        ctx.fill();

        // 绘制颜色圆点
        const color = extension.color || '#888888';
        ctx.beginPath();
        ctx.arc(itemX + 12, itemY + 16, 6, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // 绘制名称
        ctx.font = '13px Arial, sans-serif';
        ctx.fillStyle = '#333333';
        ctx.textAlign = 'left';
        const displayName = extension.name.length > 16 ? extension.name.substring(0, 16) + '...' : extension.name;
        ctx.fillText(displayName, itemX + 26, itemY + 18);

        // 绘制积木数量
        ctx.font = '12px Arial, sans-serif';
        ctx.fillStyle = '#999999';
        ctx.textAlign = 'right';
        ctx.fillText(`${extension.blocks.length} ${msg('blocks-count', 'blocks')}`, itemX + itemWidth - 18, itemY + 18);
      });
    }

    // 初始化插件
    async init() {
      await this.createAnalyzeButton();
    }
  }

  // 创建并初始化分析器
  const analyzer = new SimpleProjectAnalyzer();

  // 等待编辑器加载完成
  addon.tab.waitForElement('[class*="menu-bar_menu-bar"], [class*="react-tabs_react-tabs__tab-list"]', {
    markAsSeen: true
  }).then(() => {
    analyzer.init();
    if(isVSCodeLayoutEnabled()) vm.runtime.on('PROJECT_CHANGED', () => {
      analyzer.analyzeProjectForSidebar();
    });
  });
}