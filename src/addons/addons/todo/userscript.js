import { getSetting } from '../../tools/AEsettings/index'
import logo from '!../../../lib/tw-recolor/build!./logo.svg';
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
      steps: [
        { id: "s1", text: "收集数据", done: true }
      ],
    }
  ]
}
*/

const SIDEBAR_ID = 'todo';
var ADDON = null;
var PROJECT_NAME = '';
var MSG; // msg函数
const POINT = '_TODO_LIST_'
const emptyTodo = {
    groups: [],
    tasks: []
}

// 这个 ReduxStore 到底是哪里来的？？？
ReduxStore.subscribe(() => {
    PROJECT_NAME = ReduxStore.getState().scratchGui.projectTitle;
})

const createSideBarElements = (msg) => {
    const content = document.createElement('div');
    content.className = 'sa-todo-list';

    const title = document.createElement('h1');
    title.textContent = `${PROJECT_NAME.toString()} ${msg('title')}`;

    const createButton = document.createElement('button');
    createButton.textContent = msg('createTodo');
    createButton.onclick = () => {
        createCommentToStage(getFormatComment(emptyTodo))
    }

    const todoList = document.createElement('ul');
    try {
        getTodoListContent().tasks.forEach(element => {
            const todoEle = document.createElement('li');
            todoEle.textContent = element.name;

            todoList.appendChild(todoEle);
        });
    } catch (e) {
        console.warn('Todo List can\'t display')
    }
    const testButton = document.createElement('button');
    testButton.textContent = 'test';
    testButton.onclick = () => {
        addNewTodo({
            mode: 2,
            name: 'abc',
            task:{
                startTime: Date.now(),
                endTime: Date.now() + 100000086,
                done: false,
                tags: [],
            }
        })
    }

    content.appendChild(title)
    content.appendChild(createButton)
    content.appendChild(testButton)
    content.appendChild(todoList)
    return content
}
const getFormatComment = content => `
This comment is for the "todo" addon, this comment will storage your to-do list.\n
So don't edit, remove it. But you can move, resize and hide it, it won't affect work.
${POINT}
${JSON.stringify(content)}
`
const createCommentToStage = content => {
    const vm = ADDON.tab.traps.vm;
    // 删除之前的comment,它实际上不会替换
    delete vm.runtime.getTargetForStage().comments['todo']
    vm.runtime.getTargetForStage().createComment(
        'todo',
        null,
        content,
        50,
        50,
        350,
        150,
        false
    );
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
 * @param {[{ id: string, text: string, done: boolean }]} config.task.steps - 步骤
 * @param {object} config.group - 对组的配置
 * @param {string} config.group.color - 显示的颜色
 */
const addNewTodo = config => {
    const editTodo = getTodoListContent();
    if (config.mode === 1) {
        // 对于group
        editTodo.groups = [
            ...editTodo.groups,
            {
                id: config.id || Math.random(),
                name: config.name || MSG("New Group"),
                color: config.group.color || '#0099ff'
            }
        ]
    } else if (config.mode === 2) {
        // 对于Task
        editTodo.tasks = [
            ...editTodo.tasks,
            {
                id: config.id || Math.random(),
                name: config.name || MSG("New Group"),
                startTime: config.task.startTime || Date.now(),
                endTime: config.task.endTime || Date.now() + 100000086,
                done: config.task.done || false,
                groupId: config.task.tags || [],
                steps: config.task.steps || []
            }
        ]
    }
    createCommentToStage(getFormatComment(editTodo))
}

const getTodoList = () => {
    const vm = ADDON.tab.traps.vm;
    return vm.runtime.getTargetForStage().comments['todo'] || ''
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

function isVSCodeLayout() {
    return getSetting('EnableVSCodeLayout');
}
function addButtonWithVSCodeLayout(msg) {
    const tabs = document.querySelector('[class*="gui_tab-list"][class*="gui_vscode"]');
    const enableEffect = (ele, parent) => {
        ele.style.filter = '';
        console.log(parent)
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
                SideBar.register(SIDEBAR_ID, createSideBarElements(msg), {
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
function addButton(msg) {

}
export default function ({ addon, msg }) {
    MSG = msg
    ADDON = addon;
    if (isVSCodeLayout()) addButtonWithVSCodeLayout(msg)
    else addButton(msg)
}

