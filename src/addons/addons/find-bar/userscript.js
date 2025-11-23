import BlockItem from "./blockly/BlockItem.js";
import BlockInstance from "./blockly/BlockInstance.js";
import Utils from "./blockly/Utils.js";

export default async function ({ addon, msg, console }) {
  const Blockly = await addon.tab.traps.getBlockly();

  class FindBar {
    constructor() {
      this.utils = new Utils(addon);

      this.prevValue = "";

      this.findBarOuter = null;
      this.findWrapper = null;
      this.findInput = null;
      this.dropdownOut = null;
      this.dropdown = new Dropdown(this.utils);

      document.addEventListener("keydown", (e) => this.eventKeyDown(e), true);
    }

    get workspace() {
      return Blockly.getMainWorkspace();
    }

    createDom(root) {
      this.findBarOuter = document.createElement("div");
      this.findBarOuter.className = "sa-find-bar";
      
      addon.tab.displayNoneWhileDisabled(this.findBarOuter, { display: "flex"});
      root.appendChild(this.findBarOuter);
     
      this.findWrapper = this.findBarOuter.appendChild(document.createElement("span"));
      this.findWrapper.className = "sa-find-wrapper";

      this.dropdownOut = this.findWrapper.appendChild(document.createElement("label"));
      this.dropdownOut.className = "sa-find-dropdown-out";
      this.dropdownOut.style.borderRadius = "16px"
      this.findInput = this.dropdownOut.appendChild(document.createElement("input"));
      this.findInput.style.borderRadius="20px"
      this.findInput.className = addon.tab.scratchClass("input_input-form", {
        others: "sa-find-input",
      });
      // for <label>
      this.findInput.id = "sa-find-input";
      this.findInput.type = "search";
      this.findInput.placeholder = msg("find-placeholder");
      this.findInput.autocomplete = "off";

      this.dropdownOut.appendChild(this.dropdown.createDom());

      this.bindEvents();
      this.tabChanged();
    }

    bindEvents() {
      this.findInput.addEventListener("focus", () => this.inputChange());
      this.findInput.addEventListener("keydown", (e) => this.inputKeyDown(e));
      this.findInput.addEventListener("keyup", () => this.inputChange());
      this.findInput.addEventListener("focusout", () => this.hideDropDown());
    }

    tabChanged() {
      if (!this.findBarOuter) {
        return;
      }
      const tab = addon.tab.redux.state.scratchGui.editorTab.activeTabIndex;
      const visible = tab === 0 || tab === 1 || tab === 2;
      this.findBarOuter.hidden = !visible;
    }

    inputChange() {
      this.showDropDown();

      // Filter the list...
      let val = (this.findInput.value || "").toLowerCase();
      if (val === this.prevValue) {
        // No change so don't re-filter
        return;
      }
      this.prevValue = val;

      this.dropdown.blocks = null;

      // Hide items in list that do not contain filter text
      let listLI = this.dropdown.items;
      for (const li of listLI) {
        let procCode = li.data.procCode;
        let i = li.data.lower.indexOf(val);
        if (i >= 0) {
          li.style.display = "block";
          li.style.borderRadius = "16px";
          
          // 只在有搜索词时才高亮
          if (val.length > 0) {
            while (li.firstChild) {
              li.removeChild(li.firstChild);
            }
            if (i > 0) {
              li.appendChild(document.createTextNode(procCode.substring(0, i)));
            }
            let bText = document.createElement("b");
            bText.appendChild(document.createTextNode(procCode.substr(i, val.length)));
            li.appendChild(bText);
            if (i + val.length < procCode.length) {
              li.appendChild(document.createTextNode(procCode.substr(i + val.length)));
            }
          } else {
            // 没有搜索词时，只显示文本，不高亮
            li.innerText = procCode;
          }
        } else {
          li.style.display = "none";
          li.style.borderRadius = "16px"
        }
      }
    }

    inputKeyDown(e) {
      this.dropdown.inputKeyDown(e);

      // Enter
      if (e.key === "Enter") {
        this.findInput.blur();
        return;
      }

      // Escape
      if (e.key === "Escape") {
        if (this.findInput.value.length > 0) {
          this.findInput.value = ""; // Clear search first, then close on second press
          this.inputChange();
        } else {
          this.findInput.blur();
        }
        e.preventDefault();
        return;
      }
    }

    eventKeyDown(e) {
      if (addon.self.disabled || !this.findBarOuter) return;

      let ctrlKey = e.ctrlKey || e.metaKey;

      if (e.key.toLowerCase() === "f" && ctrlKey && !e.shiftKey) {
        // Ctrl + F (Override default Ctrl+F find)
        this.findInput.focus();
        this.findInput.select();
        e.cancelBubble = true;
        e.preventDefault();
        return true;
      }

      if (e.key === "ArrowLeft" && ctrlKey) {
        // Ctrl + Left Arrow Key
        if (document.activeElement.tagName === "INPUT") {
          return;
        }

        if (this.selectedTab === 0) {
          this.utils.navigationHistory.goBack();
          e.cancelBubble = true;
          e.preventDefault();
          return true;
        }
      }

      if (e.key === "ArrowRight" && ctrlKey) {
        // Ctrl + Right Arrow Key
        if (document.activeElement.tagName === "INPUT") {
          return;
        }

        if (this.selectedTab === 0) {
          this.utils.navigationHistory.goForward();
          e.cancelBubble = true;
          e.preventDefault();
          return true;
        }
      }
    }

    showDropDown(focusID, instanceBlock) {
      if (!focusID && this.dropdownOut.classList.contains("visible")) {
        return;
      }

      // special '' vs null... - null forces a reevaluation
      this.prevValue = focusID ? "" : null; // Clear the previous value of the input search

      this.dropdownOut.classList.add("visible");
      let scratchBlocks =
        this.selectedTab === 0
          ? this.getAllScratchBlocks()
          : []; // 只在代码标签页显示积木，不在造型和声音标签页显示

      this.dropdown.empty();

      for (const proc of scratchBlocks) {
        let item = this.dropdown.addItem(proc);

        if (focusID) {
          if (proc.matchesID(focusID)) {
            this.dropdown.onItemClick(item, instanceBlock);
          } else {
            item.style.display = "none";
            
          }
        }
      }

      this.utils.offsetX = this.dropdownOut.getBoundingClientRect().width + 32;
      this.utils.offsetY = 32;
    }

    hideDropDown() {
      this.dropdownOut.classList.remove("visible");
    }

    get selectedTab() {
      return addon.tab.redux.state.scratchGui.editorTab.activeTabIndex;
    }

    // 新增：提取积木颜色的方法
    extractBlockColour(block) {
      try {
        // 尝试多种方式获取积木颜色
        
        // 1. 尝试直接获取 colour_ 属性（标准积木）
        if (block.colour_ !== undefined && block.colour_ !== null) {
          return this.normalizeColour(block.colour_);
        }
        
        // 2. 尝试从 style 对象获取（扩展积木）
        if (block.style && block.style.colourPrimary !== undefined) {
          return this.normalizeColour(block.style.colourPrimary);
        }
        
        // 3. 尝试从 colour_ 的字符串值获取
        if (typeof block.colour_ === 'string' && block.colour_) {
          return this.normalizeColour(block.colour_);
        }
        
        // 4. 对于扩展积木，尝试其他可能的属性
        if (block.getColour) {
          const colour = block.getColour();
          if (colour) {
            return this.normalizeColour(colour);
          }
        }
        
        // 5. 尝试从 block.colour 获取（某些版本使用这个）
        if (block.colour !== undefined && block.colour !== null) {
          return this.normalizeColour(block.colour);
        }
        
        return null;
      } catch (error) {
        console.error('提取积木颜色时出错:', error);
        return null;
      }
    }

    // 新增：颜色标准化方法
    normalizeColour(colour) {
      if (!colour) return null;

      // 如果是数字，转换为十六进制
      if (typeof colour === 'number') {
        return '#' + colour.toString(16).padStart(6, '0');
      }

      // 如果是字符串，确保是十六进制格式
      if (typeof colour === 'string') {
        // 如果已经是十六进制格式
        if (colour.startsWith('#')) {
          return colour;
        }

        // 如果是 RGB 格式 (rgb(r, g, b))
        if (colour.startsWith('rgb(')) {
          const rgb = colour.match(/\d+/g);
          if (rgb && rgb.length >= 3) {
            const r = parseInt(rgb[0]);
            const g = parseInt(rgb[1]);
            const b = parseInt(rgb[2]);
            return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
          }
        }

        // 如果是 HSL 格式 (hsl(h, s%, l%))
        if (colour.startsWith('hsl(')) {
          const hsl = colour.match(/\d+/g);
          if (hsl && hsl.length >= 3) {
            const h = parseInt(hsl[0]) / 360;
            const s = parseInt(hsl[1]) / 100;
            const l = parseInt(hsl[2]) / 100;
            
            // HSL 转 RGB
            let r, g, b;
            if (s === 0) {
              r = g = b = l;
            } else {
              const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1/6) return p + (q - p) * 6 * t;
                if (t < 1/2) return q;
                if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                return p;
              };
              
              const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
              const p = 2 * l - q;
              r = hue2rgb(p, q, h + 1/3);
              g = hue2rgb(p, q, h);
              b = hue2rgb(p, q, h - 1/3);
            }
            
            return '#' + ((1 << 24) + (Math.round(r * 255) << 16) + (Math.round(g * 255) << 8) + Math.round(b * 255)).toString(16).slice(1);
          }
        }

        // 如果是颜色名称，转换为十六进制
        const colourNames = {
          'red': '#FF0000',
          'blue': '#0000FF',
          'green': '#00FF00',
          'yellow': '#FFFF00',
          'orange': '#FFA500',
          'purple': '#800080',
          'pink': '#FFC0CB'
        };

        if (colourNames[colour.toLowerCase()]) {
          return colourNames[colour.toLowerCase()];
        }

        // 尝试解析为数字
        const num = parseInt(colour);
        if (!isNaN(num)) {
          return '#' + num.toString(16).padStart(6, '0');
        }
      }

      return null;
    }

    // 新增：从样式中提取颜色
    getColourFromStyle(style) {
      try {
        if (!style) return null;

        // 样式可能包含颜色信息
        if (style.colourPrimary) {
          return this.normalizeColour(style.colourPrimary);
        }
        if (style.colourSecondary) {
          return this.normalizeColour(style.colourSecondary);
        }
        if (style.colourTertiary) {
          return this.normalizeColour(style.colourTertiary);
        }

        return null;
      } catch (error) {
        console.error('从样式中提取颜色时出错:', error);
        return null;
      }
    }

    // 修改：获取所有积木的方法
    getAllScratchBlocks() {
      let myBlocks = [];
      let myBlocksByProcCode = {};

      let allBlocks = this.workspace.getAllBlocks(); // 获取所有积木，包括嵌套的

      /**
       * @param cls
       * @param txt
       * @param root
       * @returns BlockItem
       */
      const addBlock = (cls, txt, root) => {
        try {
          let id = root.id ? root.id : root.getId ? root.getId() : null;
          let clone = myBlocksByProcCode[txt];
          if (clone) {
            if (!clone.clones) {
              clone.clones = [];
            }
            clone.clones.push(id);
            return clone;
          }

          // 获取积木颜色
          const blockColour = this.extractBlockColour(root);
          let items = new BlockItem(cls, txt, id, 0, blockColour);
          items.y = root.getRelativeToSurfaceXY ? root.getRelativeToSurfaceXY().y : null;
          myBlocks.push(items);
          myBlocksByProcCode[txt] = items;
          return items;
        } catch (error) {
          console.error('添加积木时出错:', error, '积木类型:', root.type, '积木ID:', root.id);
          return null;
        }
      };

      const getBlockDisplayText = (block) => {
        try {
          // 对于变量积木
          if (block.type === 'data_variable' || block.type === 'data_changevariableby' || block.type === 'data_setvariableto') {
            const vars = block.getVars();
            if (vars && vars.length > 0) {
              const variable = this.workspace.getVariableById(vars[0]);
              if (variable) {
                return '变量 ' + variable.name;
              }
            }
          }
          
          // 特殊处理 control_if，显示为 "如果...那么"
          if (block.type === 'control_if') {
            return '如果...那么';
          }
          
          if (block.type === 'control_if_else') {
            return '如果...那么...否则';
          }
          
          if (block.type === 'control_repeat') {
            return '重复执行';
          }
          
          if (block.type === 'control_forever') {
            return '重复执行';
          }
          
          // 使用 getProcCode 获取积木的标准文本（不包含输入值）
          if (typeof block.getProcCode === 'function') {
            const procCode = block.getProcCode();
            
            // 对于其他积木，移除输入占位符 %s, %n, %b
            return procCode.replace(/%[sbnd]/g, '').trim();
          }
          
          // 如果没有 getProcCode，尝试使用 toString
          if (typeof block.toString === 'function') {
            const text = block.toString();
            // 移除输入框的值
            const bracketIndex = text.indexOf('[');
            if (bracketIndex > 0) {
              return text.substring(0, bracketIndex).trim();
            }
            return text;
          }
          
          // 最后 fallback 到类型
          return block.type;
        } catch (error) {
          console.error('获取积木显示文本时出错:', error);
          return block.type || '未知积木';
        }
      };

      const getBlockCategory = (type) => {
        if (!type) return 'other';

        if (type === "procedures_definition") return "define";
        if (type === "event_whenflagclicked") return "flag";
        if (type === "event_whenbroadcastreceived") return "receive";
        if (type.substr(0, 10) === "event_when") return "event";
        if (type === "control_start_as_clone") return "event";
        if (type.startsWith("motion_")) return "motion";
        if (type.startsWith("looks_")) return "looks";
        if (type.startsWith("sound_")) return "sound";
        if (type.startsWith("control_")) return "control";
        if (type.startsWith("sensing_")) return "sensing";
        if (type.startsWith("operator_")) return "operator";
        if (type.startsWith("data_")) return "data";
        if (type.startsWith("argument_") || type.startsWith("text2speech_") ||
          type.startsWith("music_") || type.startsWith("videoSensing_") ||
          type.startsWith("pen_")) return "extension";
        return "other";
      };

      for (const root of allBlocks) {
        try {
          if (!root || !root.type) continue;

          // 跳过ID为"@"的问题积木
          if (root.id === "@") {
            console.warn('跳过ID为"@"的问题积木:', root.type);
            continue;
          }

          const category = getBlockCategory(root.type);
          const displayText = getBlockDisplayText(root); // 使用显示文本
          
          // 过滤掉纯数字和纯占位符的结果（这些是输入框的值，不是积木类型）
          if (/^\d+$/.test(displayText) || /^\?+$/.test(displayText)) {
            continue; // 跳过纯数字和纯问号
          }

          addBlock(category, displayText, root);
        } catch (e) {
          console.error('处理积木时出错:', e, '积木:', root);
          continue;
        }
      }

      // 变量和列表的处理
      let map = this.workspace.getVariableMap();

      let vars = map.getVariablesOfType("");
      for (const row of vars) {
        addBlock(
          row.isLocal ? "var" : "VAR",
          row.isLocal ? msg("var-local", { name: row.name }) : msg("var-global", { name: row.name }),
          row
        );
      }

      let lists = map.getVariablesOfType("list");
      for (const row of lists) {
        addBlock(
          row.isLocal ? "list" : "LIST",
          row.isLocal ? msg("list-local", { name: row.name }) : msg("list-global", { name: row.name }),
          row
        );
      }

      // 注释掉这行，不添加广播消息作为独立搜索结果
      // const events = this.getCallsToEvents();
      // for (const event of events) {
      //   addBlock("receive", msg("event", { name: event.eventName }), event.block).eventName = event.eventName;
      // }

      // 扩展排序顺序
      const clsOrder = {
        flag: 0, receive: 1, event: 2, define: 3,
        var: 4, VAR: 5, list: 6, LIST: 7,
        motion: 8, looks: 9, sound: 10, control: 11,
        sensing: 12, operator: 13, data: 14, extension: 15,
        other: 16
      };

      myBlocks.sort((a, b) => {
        let t = clsOrder[a.cls] - clsOrder[b.cls];
        if (t !== 0) {
          return t;
        }
        if (a.lower < b.lower) {
          return -1;
        }
        if (a.lower > b.lower) {
          return 1;
        }
        return a.y - b.y;
      });

      return myBlocks;
    }

    getScratchCostumes() {
      let costumes = this.utils.getEditingTarget().getCostumes();

      let items = [];

      let i = 0;
      for (const costume of costumes) {
        let item = new BlockItem("costume", costume.name, costume.assetId, i, null); // 造型不需要特殊颜色
        items.push(item);
        i++;
      }

      return items;
    }

    getScratchSounds() {
      let sounds = this.utils.getEditingTarget().getSounds();

      let items = [];

      let i = 0;
      for (const sound of sounds) {
        let item = new BlockItem("sound", sound.name, sound.assetId, i, null); // 声音不需要特殊颜色
        items.push(item);
        i++;
      }

      return items;
    }

    getCallsToEvents() {
      const uses = [];
      const alreadyFound = new Set();

      for (const block of this.workspace.getAllBlocks()) {
        if (block.type !== "event_broadcast" && block.type !== "event_broadcastandwait") {
          continue;
        }

        const broadcastInput = block.getChildren()[0];
        if (!broadcastInput) {
          continue;
        }

        let eventName = "";
        if (broadcastInput.type === "event_broadcast_menu") {
          eventName = broadcastInput.inputList[0].fieldRow[0].getText();
        } else {
          eventName = msg("complex-broadcast");
        }
        if (!alreadyFound.has(eventName)) {
          alreadyFound.add(eventName);
          uses.push({ eventName: eventName, block: block });
        }
      }

      return uses;
    }
  }

  class Dropdown {
    constructor(utils) {
      this.utils = utils;

      this.el = null;
      this.items = [];
      this.selected = null;
      this.carousel = new Carousel(this.utils);
    }

    get workspace() {
      return Blockly.getMainWorkspace();
    }

    createDom() {
      this.el = document.createElement("ul");
      this.el.className = "sa-find-dropdown";
      return this.el;
    }

    inputKeyDown(e) {
      // Up Arrow
      if (e.key === "ArrowUp") {
        this.navigateFilter(-1);
        e.preventDefault();
        return;
      }

      // Down Arrow
      if (e.key === "ArrowDown") {
        this.navigateFilter(1);
        e.preventDefault();
        return;
      }

      // Enter
      if (e.key === "Enter") {
        // Any selected on enter? if not select now
        if (this.selected) {
          this.navigateFilter(1);
        }
        e.preventDefault();
        return;
      }

      this.carousel.inputKeyDown(e);
    }

    navigateFilter(dir) {
      let nxt;
      if (this.selected && this.selected.style.display !== "none") {
        nxt = dir === -1 ? this.selected.previousSibling : this.selected.nextSibling;
      } else {
        nxt = this.items[0];
        dir = 1;
      }
      while (nxt && nxt.style.display === "none") {
        nxt = dir === -1 ? nxt.previousSibling : nxt.nextSibling;
      }
      if (nxt) {
        nxt.scrollIntoView({ block: "nearest" });
        this.onItemClick(nxt);
      }
    }

    addItem(proc) {
      const item = document.createElement("li");
      item.innerText = proc.procCode;
      item.data = proc;

      // 只使用边框颜色，不设置背景颜色
      const colorIds = {
        receive: "events",
        event: "events",
        define: "more",
        var: "data",
        VAR: "data",
        list: "data-lists",
        LIST: "data-lists",
        costume: "looks",
        sound: "sounds",
        motion: "motion",
        looks: "looks",
        control: "control",
        sensing: "sensing",
        operator: "operators",
        data: "data",
        extension: "pen",
        other: "more"
      };

      if (proc.cls === "flag") {
        item.className = "sa-find-flag";
      } else {
        const colorId = colorIds[proc.cls];
        item.className = `sa-block-color sa-block-color-${colorId}`;
      }
      
      // 添加悬停效果（亮度变化）
      item.style.transition = 'filter 0.2s ease';
      item.addEventListener('mouseenter', () => {
        item.style.filter = 'brightness(0.9)';
      });
      item.addEventListener('mouseleave', () => {
        item.style.filter = 'brightness(1)';
      });

      item.addEventListener("mousedown", (e) => {
        this.onItemClick(item);
        e.preventDefault();
        e.cancelBubble = true;
        return false;
      });
      this.items.push(item);
      this.el.appendChild(item);
      return item;
    }

    // 辅助方法：加深颜色
    darkenColor(color, factor) {
      try {
        let r, g, b;

        if (color.startsWith('#')) {
          r = parseInt(color.slice(1, 3), 16);
          g = parseInt(color.slice(3, 5), 16);
          b = parseInt(color.slice(5, 7), 16);
        } else {
          return color;
        }

        r = Math.floor(r * (1 - factor));
        g = Math.floor(g * (1 - factor));
        b = Math.floor(b * (1 - factor));

        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
      } catch (error) {
        console.error('加深颜色时出错:', error);
        return color;
      }
    }

    // 辅助方法：根据背景色确定文字颜色
    getTextColor(bgColor) {
      try {
        let r, g, b;

        if (bgColor.startsWith('#')) {
          r = parseInt(bgColor.slice(1, 3), 16);
          g = parseInt(bgColor.slice(3, 5), 16);
          b = parseInt(bgColor.slice(5, 7), 16);
        } else {
          return '#000000';
        }

        // 计算亮度
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;

        return brightness > 128 ? '#000000' : '#FFFFFF';
      } catch (error) {
        console.error('计算文字颜色时出错:', error);
        return '#000000';
      }
    }

    onItemClick(item, instanceBlock) {
      if (this.selected && this.selected !== item) {
        this.selected.classList.remove("sel");
        this.selected = null;
      }
      if (this.selected !== item) {
        item.classList.add("sel");
        this.selected = item;
      }

      let cls = item.data.cls;
      if (cls === "costume" || cls === "sound") {
        // Viewing costumes/sounds - jump to selected costume/sound
        const assetPanel = document.querySelector("[class^=asset-panel_wrapper]");
        if (assetPanel) {
          const reactInstance = assetPanel[addon.tab.traps.getInternalKey(assetPanel)];
          const reactProps = reactInstance.child.stateNode.props;
          reactProps.onItemClick(item.data.y);
          const selectorList = assetPanel.firstChild.firstChild;
          selectorList.children[item.data.y].scrollIntoView({
            behavior: "auto",
            block: "center",
            inline: "start",
          });
          // The wrapper seems to scroll when we use the function above.
          let wrapper = assetPanel.closest("div[class*=gui_flex-wrapper]");
          wrapper.scrollTop = 0;
        }
      } else if (cls === "var" || cls === "VAR" || cls === "list" || cls === "LIST") {
        // Search now for all instances
        let blocks = this.getVariableUsesById(item.data.labelID);
        this.carousel.build(item, blocks, instanceBlock);
      } else if (cls === "define") {
        let blocks = this.getCallsToProcedureById(item.data.labelID);
        this.carousel.build(item, blocks, instanceBlock);
      } else if (cls === "receive") {
        let blocks = this.getCallsToEventsByName(item.data.eventName);
        if (!instanceBlock) {
          // Can we start by selecting the first block on 'this' sprite
          const currentTargetID = this.utils.getEditingTarget().id;
          for (const block of blocks) {
            if (block.targetId === currentTargetID) {
              instanceBlock = block;
              break;
            }
          }
        }
        this.carousel.build(item, blocks, instanceBlock);
      } else if (item.data.clones) {
        let blocks = [this.workspace.getBlockById(item.data.labelID)];
        for (const cloneID of item.data.clones) {
          blocks.push(this.workspace.getBlockById(cloneID));
        }
        this.carousel.build(item, blocks, instanceBlock);
      } else {
        this.utils.scrollBlockIntoView(item.data.labelID);
        this.carousel.remove();
      }
    }

    getVariableUsesById(id) {
      let uses = [];

      let topBlocks = this.workspace.getTopBlocks();
      for (const topBlock of topBlocks) {
        /** @type {!Array<!Blockly.Block>} */
        let kids = topBlock.getDescendants();
        for (const block of kids) {
          /** @type {!Array<!Blockly.VariableModel>} */
          let blockVariables = block.getVarModels();
          if (blockVariables) {
            for (const blockVar of blockVariables) {
              if (blockVar.getId() === id) {
                uses.push(block);
              }
            }
          }
        }
      }

      return uses;
    }

    getCallsToProcedureById(id) {
      let procBlock = this.workspace.getBlockById(id);
      let label = procBlock.getChildren()[0];
      let procCode = label.getProcCode();

      let uses = [procBlock]; // Definition First, then calls to it
      let topBlocks = this.workspace.getTopBlocks();
      for (const topBlock of topBlocks) {
        /** @type {!Array<!Blockly.Block>} */
        let kids = topBlock.getDescendants();
        for (const block of kids) {
          if (block.type === "procedures_call") {
            if (block.getProcCode() === procCode) {
              uses.push(block);
            }
          }
        }
      }

      return uses;
    }

    getCallsToEventsByName(name) {
      let uses = []; // Definition First, then calls to it

      const runtime = addon.tab.traps.vm.runtime;
      const targets = runtime.targets; // The sprites / stage

      for (const target of targets) {
        if (!target.isOriginal) {
          continue; // Skip clones
        }

        const blocks = target.blocks;
        if (!blocks._blocks) {
          continue;
        }

        for (const id of Object.keys(blocks._blocks)) {
          const block = blocks._blocks[id];
          if (block.opcode === "event_whenbroadcastreceived" && block.fields.BROADCAST_OPTION.value === name) {
            uses.push(new BlockInstance(target, block));
          } else if (block.opcode === "event_broadcast" || block.opcode === "event_broadcastandwait") {
            const broadcastInputBlockId = block.inputs.BROADCAST_INPUT.block;
            const broadcastInputBlock = blocks._blocks[broadcastInputBlockId];
            if (broadcastInputBlock) {
              let eventName;
              if (broadcastInputBlock.opcode === "event_broadcast_menu") {
                eventName = broadcastInputBlock.fields.BROADCAST_OPTION.value;
              } else {
                eventName = msg("complex-broadcast");
              }
              if (eventName === name) {
                uses.push(new BlockInstance(target, block));
              }
            }
          }
        }
      }

      return uses;
    }

    empty() {
      for (const item of this.items) {
        if (this.el.contains(item)) {
          this.el.removeChild(item);
        }
      }
      this.items = [];
      this.selected = null;
    }
  }

  class Carousel {
    constructor(utils) {
      this.utils = utils;

      this.el = null;
      this.count = null;
      this.blocks = [];
      this.idx = 0;
    }

    build(item, blocks, instanceBlock) {
      if (this.el && this.el.parentNode === item) {
        // Same control... click again to go to next
        this.navRight();
      } else {
        this.remove();
        this.blocks = blocks;
        item.appendChild(this.createDom());

        this.idx = 0;
        if (instanceBlock) {
          for (const idx of Object.keys(this.blocks)) {
            const block = this.blocks[idx];
            if (block.id === instanceBlock.id) {
              this.idx = Number(idx);
              break;
            }
          }
        }

        if (this.idx < this.blocks.length) {
          this.utils.scrollBlockIntoView(this.blocks[this.idx]);
        }
      }
    }

    createDom() {
      this.el = document.createElement("span");
      this.el.className = "sa-find-carousel";

      const leftControl = this.el.appendChild(document.createElement("span"));
      leftControl.className = "sa-find-carousel-control";
      leftControl.textContent = "◀";
      leftControl.addEventListener("mousedown", (e) => this.navLeft(e));

      this.count = this.el.appendChild(document.createElement("span"));
      this.count.innerText = this.blocks.length > 0 ? this.idx + 1 + " / " + this.blocks.length : "0";

      const rightControl = this.el.appendChild(document.createElement("span"));
      rightControl.className = "sa-find-carousel-control";
      rightControl.textContent = "▶";
      rightControl.addEventListener("mousedown", (e) => this.navRight(e));

      return this.el;
    }

    inputKeyDown(e) {
      // Left Arrow
      if (e.key === "ArrowLeft") {
        if (this.el && this.blocks) {
          this.navLeft(e);
        }
      }

      // Right Arrow
      if (e.key === "ArrowRight") {
        if (this.el && this.blocks) {
          this.navRight(e);
        }
      }
    }

    navLeft(e) {
      return this.navSideways(e, -1);
    }

    navRight(e) {
      return this.navSideways(e, 1);
    }

    navSideways(e, dir) {
      if (this.blocks.length > 0) {
        this.idx = (this.idx + dir + this.blocks.length) % this.blocks.length;
        this.count.innerText = this.idx + 1 + " / " + this.blocks.length;
        this.utils.scrollBlockIntoView(this.blocks[this.idx]);
      }

      if (e) {
        e.cancelBubble = true;
        e.preventDefault();
      }
    }

    remove() {
      if (this.el) {
        this.el.remove();
        this.blocks = [];
        this.idx = 0;
      }
    }
  }

  const findBar = new FindBar();

  const _doBlockClick_ = Blockly.Gesture.prototype.doBlockClick_;
  Blockly.Gesture.prototype.doBlockClick_ = function () {
    if (!addon.self.disabled && (this.mostRecentEvent_.button === 1 || this.mostRecentEvent_.shiftKey)) {
      let block = this.startBlock_;
      for (; block; block = block.getSurroundParent()) {
        if (block.type === "procedures_definition" || (!this.jumpToDef && block.type === "procedures_call")) {
          let id = block.id ? block.id : block.getId ? block.getId() : null;

          findBar.findInput.focus();
          findBar.showDropDown(id);

          return;
        }

        if (
          block.type === "data_variable" ||
          block.type === "data_changevariableby" ||
          block.type === "data_setvariableto"
        ) {
          let id = block.getVars()[0];

          findBar.findInput.focus();
          findBar.showDropDown(id, block);

          findBar.selVarID = id;

          return;
        }

        if (
          block.type === "event_whenbroadcastreceived" ||
          block.type === "event_broadcastandwait" ||
          block.type === "event_broadcast"
        ) {
          let id = block.id;

          findBar.findInput.focus();
          findBar.showDropDown(id, block);

          findBar.selVarID = id;

          return;
        }
      }
    }

    _doBlockClick_.call(this);
  };

  addon.tab.redux.initialize();
  addon.tab.redux.addEventListener("statechanged", (e) => {
    if (e.detail.action.type === "scratch-gui/navigation/ACTIVATE_TAB") {
      findBar.tabChanged();
    }
  });

  while (true) {
    const root = await addon.tab.waitForElement("ul[class*=gui_tab-list_]", {
      markAsSeen: true,
      reduxEvents: ["scratch-gui/mode/SET_PLAYER", "fontsLoaded/SET_FONTS_LOADED", "scratch-gui/locales/SELECT_LOCALE"],
      reduxCondition: (state) => !state.scratchGui.mode.isPlayerOnly,
    });
    findBar.createDom(root);
  }
}