import { getSetting } from '../../tools/AEsettings/index'
import logo from '!../../../lib/tw-recolor/build!./logo.svg';
import SideBar from "../../ui/side-bar/side-bar.js";

/*
{
  groups: [
    { id: "g1", name: "工作", color: "#3b82f6", order: 0 }
  ],
  tasks: [
    {
      id: "t1",
      name: "写周报",
      startTime: "2026-04-19T09:00",
      endTime: "2026-04-19T18:00",
      done: false,
      groupId: "g1",
      priority: 2,
      tags: ["办公"],
      steps: [
        { id: "s1", text: "收集数据", done: true }
      ],
      order: 0,
      remindAt: "2026-04-19T08:00",
      repeat: null
    }
  ]
}
*/

const SIDEBAR_ID = 'todo';
var ADDON = null;
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

const createSideBarElements = (msg) => {
    const content = document.createElement('div');
    content.className = 'sa-todo-list';

    const title = document.createElement('h1');
    title.textContent = `${PROJECT_NAME.toString()} ${msg('title')}`;

    const createButton = document.createElement('button');
    createButton.textContent = msg('createTodo');
    createButton.onclick = () => {
        createCommentToStage(getFormatComment(JSON.stringify(emptyTodo)))
    }

    const todoList = document.createElement('div');
    try {
        console.log(getTodoListContent())
        getTodoListContent().forEach(element => {
            const todoEle = document.createElement('div');
            todoEle.textContent = element;

            todoList.appendChild(todoEle);
        });
    } catch (e) {
        console.warn('Todo List can\'t display')
    }

    content.appendChild(title)
    content.appendChild(createButton)
    return content
}
const getFormatComment = content => `
This comment is for the "todo" addon, this comment will storage your to-do list.\n
So don't edit, remove it. But you can move, resize and hide it, it won't affect work.
${POINT}
${content}
`
const createCommentToStage = content => {
    const vm = ADDON.tab.traps.vm;
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
        return []
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
    ADDON = addon;
    if (isVSCodeLayout()) addButtonWithVSCodeLayout(msg)
    else addButton(msg)
}

