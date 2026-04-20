import { getSetting } from '../../tools/AEsettings/index'
import logo from '!../../../lib/tw-recolor/build!./logo.svg';
import dropdown from './dropdown-arrow.svg';
import SideBar from "../../ui/side-bar/side-bar.js";

/*
{
  groups: [
    { id: "g1", name: "工作", color: "#3b82f6"}
  ],
  tasks: [
    {
      id: "t1",
      name: "写周报",
      startTime: "123445",
      endTime: "33333",
      done: false,
      priority: 2,
      tags: ["g1"],
      color: "#0099ff",
      steps: [
        { id: "s1", text: "收集数据", done: true }
      ],
    }
  ]
}
*/

/**
 * 获取两个时间戳的格式化日期区间
 * AI 太好用了你知道吗
 * @param {number} timestamp1 - 第一个时间戳（毫秒）
 * @param {number} timestamp2 - 第二个时间戳（毫秒）
 * @returns {string} 格式化后的日期区间字符串
 */
function getFormattedDateRange(timestamp1, timestamp2) {

    const date1 = new Date(timestamp1);
    const date2 = new Date(timestamp2);

    const pad = (num) => String(num).padStart(2, '0');

    const year1 = date1.getFullYear();
    const month1 = pad(date1.getMonth() + 1);
    const day1 = pad(date1.getDate());
    const hour1 = pad(date1.getHours());
    const minute1 = pad(date1.getMinutes());
    const second1 = pad(date1.getSeconds());

    const year2 = date2.getFullYear();
    const month2 = pad(date2.getMonth() + 1);
    const day2 = pad(date2.getDate());
    const hour2 = pad(date2.getHours());
    const minute2 = pad(date2.getMinutes());
    const second2 = pad(date2.getSeconds());

    const timeStr1 = `${hour1}:${minute1}:${second1}`;
    const timeStr2 = `${hour2}:${minute2}:${second2}`;

    const isSameDate = year1 === year2 && month1 === month2 && day1 === day2;

    if (isSameDate) {
        const dateStr = `${year1}-${month1}-${day1}`;
        return `${dateStr} ${timeStr1} -> ${timeStr2}`;
    } else {
        const fullStr1 = `${year1}-${month1}-${day1} ${timeStr1}`;
        const fullStr2 = `${year2}-${month2}-${day2} ${timeStr2}`;
        return `${fullStr1} -> ${fullStr2}`;
    }
}

export default function ({ addon, msg }) {
    const generateId = () => {
        return `todo-${Math.random().toString(36).substr(2, 9)}`;
    }
    const isVSCodeLayout = () => {
        return getSetting('EnableVSCodeLayout');
    }
    // 在加载的项目内寻找正确的Todo注释ID
    // 因为它保存的ID是会！变！的！
    // 那我这个设置‘todo’为id的意义是什么...
    addon.tab.traps.vm.runtime.on("PROJECT_LOADED", () => {
        try {
            Object.values(addon.tab.traps.vm.runtime.getTargetForStage().comments).forEach(obj => {
                if (obj.id == COMMENT_ID) return
                if (obj.text.indexOf(POINT) != -1) { COMMENT_ID = obj.id; return }
            })
        } catch (e) {
            console.warn(e);
            // 没找到没关系
        }
    })


    const SIDEBAR_ID = 'todo';
    let COMMENT_ID = 'todo'
    var PROJECT_NAME = '';
    const POINT = '_TODO_LIST_'
    const emptyTodo = {
        groups: [],
        tasks: []
    }

    // 这个 ReduxStore 到底是哪里来的？？？
    ReduxStore.subscribe(() => {
        PROJECT_NAME = ReduxStore.getState().scratchGui.projectTitle;
    })

    const getFormatComment = content => `
This comment is for the "todo" addon, this comment will storage your to-do list.\n
So don't edit, remove it. But you can move, resize and hide it, it won't affect work.
${POINT}
${JSON.stringify(content)}
`

    const createSideBarElements = () => {
        const content = document.createElement('div');
        content.className = 'sa-todo';

        const title = document.createElement('h1');
        title.textContent = `${PROJECT_NAME.toString()} ${msg('title')}`;

        const todoList = document.createElement('ul');
        todoList.className = 'sa-todo-list';
        try {
            getTodoListContent().tasks.forEach(task => {
                let isHide = true;
                const todoEle = document.createElement('li');
                todoEle.className = 'sa-todo-list-ele';
                const todoEleTile = document.createElement('div')
                todoEleTile.className = 'sa-todo-list-ele-titleDiv';
                const todoEleName = document.createElement('span');
                todoEleName.className = 'sa-todo-list-ele-title';
                todoEleName.textContent = task.name;

                const todoEleDate = document.createElement('span');
                todoEleDate.textContent = getFormattedDateRange(task.startTime, task.endTime);
                // steps
                const todoEleStepsContent = document.createElement('ul');
                todoEleStepsContent.className = 'sa-todo-list-ele-steps';
                todoEleStepsContent.id = task.id;
                task.steps.forEach(step => {
                    const todoEleStep = document.createElement('li');
                    todoEleStep.className = 'sa-todo-list-ele-steps-li';
                    const todoEleStep_Text = document.createElement('span');
                    todoEleStep_Text.textContent = step.text;

                    todoEleStep.appendChild(todoEleStep_Text);

                    todoEleStepsContent.appendChild(todoEleStep);
                })
                
                // display
                todoEle.style.backgroundColor = task.color + 'a0';

                // dropdown
                const todoEleDropdown = document.createElement('img');
                todoEleDropdown.src = dropdown;
                todoEleDropdown.className = 'sa-todo-list-ele-titleDiv-dropdown';
                const refreshDropdown_Steps = () => {
                    todoEleDropdown.style.transform = isHide ? 'rotate(180deg)' : 'rotate(0deg)';
                    // steps
                    todoEleStepsContent.style.display = isHide ? 'none' : 'block';
                }
                todoEleDropdown.onclick = () => {
                    isHide = !isHide;
                    refreshDropdown_Steps()
                }
                // spawn
                todoEleTile.appendChild(todoEleDropdown);
                todoEleTile.appendChild(todoEleName);
                todoEle.appendChild(todoEleTile);
                todoEle.appendChild(todoEleDate);
                todoEle.appendChild(todoEleStepsContent);
                refreshDropdown_Steps();

                todoList.appendChild(todoEle);
            });
        } catch (e) {
            console.warn('Todo List can\'t display: ' + e)
        }
        const testButton = document.createElement('button');
        testButton.textContent = 'test';
        testButton.onclick = () => {
            addNewTodo({
                mode: 2,
                name: 'A Todo',
                task: {
                    startTime: Date.now(),
                    endTime: Date.now() + 100000086,
                    done: false,
                    tags: [],
                    steps: [
                        { id: "s1", text: "收集数据", done: true },
                        { id: "s2", text: "收集数据2", done: false },
                        { id: "s3", text: "收集数据3", done: true }
                    ]
                }
            })
        }

        content.appendChild(title)
        content.appendChild(testButton)
        content.appendChild(todoList)
        return content
    }

    const createCommentToStage = content => {
        const vm = addon.tab.traps.vm;
        // 删除之前的comment,它实际上不会替换
        delete vm.runtime.getTargetForStage().comments[COMMENT_ID]
        vm.runtime.getTargetForStage().createComment(
            COMMENT_ID,
            null,
            content,
            50,
            50,
            350,
            150,
            false
        );

        // 刷新一下Tab
        SideBar.clearContent();
        SideBar.setContent(createSideBarElements(msg))
    }

    const getTodoList = () => {
        const vm = addon.tab.traps.vm;
        return vm.runtime.getTargetForStage().comments[COMMENT_ID] || ''
    }
    const getTodoListContent = () => {
        try {
            return JSON.parse(
                getTodoList()['text']
                    .split(POINT)[1]
                /**
                 * 我们的格式是:
                 * 
                 * xxx
                 * POINT
                 * object
                 * 
                 * 所以用split以POINT拆分出来[xxx,object]，然后获取第二项
                 */
            )
        } catch (e) {
            return emptyTodo
        }
    }


    const addButtonWithVSCodeLayout = () => {
        const tabs = document.querySelector('[class*="gui_tab-list"][class*="gui_vscode"]');
        const enableEffect = (ele, parent) => {
            ele.style.filter = '';
            parent.style.backgroundColor = 'var(--ui - white)';
            parent.style.boxShadow = 'inset 3px 0px 0px 0px var(--looks-secondary)';
        }
        const unableEffect = (ele, parent) => {
            ele.style.filter = "grayscale(100%)";
            parent.style.backgroundColor = 'transprant';
            parent.style.boxShadow = 'none';
        }
        if (tabs) {
            const tabbutton = document.createElement('li');
            tabbutton.className = 'sa-todo-tabButton';
            const tabbuttonIcon = document.createElement('img');
            tabbuttonIcon.src = logo();
            tabbuttonIcon.style.filter = "grayscale(100%)";
            tabbuttonIcon.style.width = '25px';
            tabbuttonIcon.style.height = 'auto';

            tabbutton.appendChild(tabbuttonIcon);

            tabbutton.onclick = () => {
                if (SideBar.getActivePlugin() === SIDEBAR_ID) {
                    SideBar.close()
                    unableEffect(tabbuttonIcon, tabbutton)
                } else {
                    SideBar.register(SIDEBAR_ID, createSideBarElements(), {
                        onActivate: () => {
                            enableEffect(tabbuttonIcon, tabbutton)
                        },
                        onDeactivate: () => {
                            unableEffect(tabbuttonIcon, tabbutton)
                        }
                    });
                    SideBar.switchTo(SIDEBAR_ID);
                    SideBar.open();

                    enableEffect(tabbuttonIcon, tabbutton)
                }
            }
            tabs.appendChild(tabbutton);
        } else {
            throw new Error('Cant add list to tabs.')
        }
    }
    const addButton = () => {

    }


    /**
     * 添加新的Todo
     * @param {object} config 配置
     * @param {1|2} config.mode - 1为加入组（group），2为加入todo（tasks）
     * @param {string} config.id - ID，用于区分
     * @param {string} config.name - 对组的配置
     * @param {object} config.task - 对todo的配置
     * @param {int} config.task.startTime - 开始时间
     * @param {int} config.task.endTime - 结束时间
     * @param {boolean} config.task.done - 是否完成
     * @param {[]} config.task.tags - 属于什么组
     * @param {int} config.task.priority - 优先级，越高越提前，默认为0
     * @param {string} config.task.color - 显示的颜色
     * @param {[{ id: string, text: string, done: boolean }]} config.task.steps - 步骤
     * @param {object} config.group - 对组的配置
     * @param {string} config.group.color - 显示的颜色
     */
    const addNewTodo = config => {
        const editTodo = getTodoListContent();
        // 这会破坏读取,所以我们需要替换
        // 事实上对于POINT是*不可能*不通过用户而出现的，所以就直接全替换了
        config = JSON.parse(JSON.stringify(config).replaceAll(POINT,
            // 这很神秘啊
            `Why? ${POINT} is key word, how did you found it?`
        ));
        if (config.mode === 1) {
            // 对于group
            editTodo.groups = [
                ...editTodo.groups,
                {
                    id: config.id || generateId(),
                    name: config.name || msg("New Group"),
                    color: config.group.color || '#0099ff'
                }
            ]
        } else if (config.mode === 2) {
            // 对于Task
            editTodo.tasks = [
                ...editTodo.tasks,
                {
                    id: config.id || generateId(),
                    name: config.name || msg("New Group"),
                    startTime: config.task.startTime || Date.now(),
                    endTime: config.task.endTime || Date.now() + 100000086,
                    done: config.task.done || false,
                    groupId: config.task.tags || [],
                    color: config.task.color || "#0099ff",
                    steps: config.task.steps || []
                }
            ]
        }
        createCommentToStage(getFormatComment(editTodo))
    }


    if (isVSCodeLayout()) addButtonWithVSCodeLayout()
    else addButton()
}

