import { getSetting } from '../../tools/AEsettings/index'
import logo from '!../../../lib/tw-recolor/build!./logo.svg';
import dropdown from './dropdown-arrow.svg';;
import done from './done.svg';
import undone from './undone.svg';
import edit from './edit.svg';
import remove from './remove.svg';
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

export default async function ({ addon, msg }) {
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
    let PROJECT_NAME = '';
    const POINT = '_TODO_LIST_'
    const emptyTodo = {
        groups: [],
        tasks: []
    }
    const alpha = 'a0';

    // 这个 ReduxStore 到底是哪里来的？？？
    await ReduxStore.subscribe(() => {
        PROJECT_NAME = ReduxStore.getState().scratchGui.projectTitle;
    })

    const getFormatComment = content => `
This comment is for the "todo" addon, this comment will storage your to-do list.\n
So don't edit, remove it. But you can move, resize and hide it, it won't affect work.
${POINT}
${JSON.stringify(content)}
`

    const getTextWidth = (() => {
        const el = document.createElement('span');
        el.style.cssText = 'position:fixed;visibility:hidden;white-space:nowrap;height:auto;width:auto';
        document.body.appendChild(el);
        return (text = 'hello world', fontSize = '16px', plus = 0, fontFamily = '"Helvetica Neue", Helvetica, Arial, sans-serif') => {
            el.style.font = `${String(fontSize).endsWith('px') ? fontSize : fontSize + 'px'} ${fontFamily}`;
            el.textContent = text;
            return el.offsetWidth + plus + 'px';
        };
    })();

    const addModal = (editEleConfig = false) => {
        const addContentForModal = (remove) => {
            let config
            if (editEleConfig) {
                /*
{
    "id": "todo-9p4po00hs",
    "name": "todo/new-todo",
    "startTime": 1777418067938,
    "endTime": 1777428068024,
    "done": false,
    "groupId": [],
    "color": "#0099ff",
    "steps": [
        {
            "id": "todo-gs3bvbl8d",
            "text": "todo/new-step",
            "latest": false,
            "done": false
        },
        {
            "id": "todo-ikqruv7df",
            "text": "todo/new-step",
            "latest": false,
            "done": false
        },
        {
            "id": "todo-b9uol4wgz",
            "text": "todo/new-step",
            "latest": false,
            "done": false
        }
    ]
}
                 */
                config = {
                    mode: editEleConfig.mode || 2,
                    id: editEleConfig.id || generateId(),
                    name: editEleConfig.name || msg('new-todo'),
                    color: editEleConfig.color || '#0099ff',
                    task: {
                        startTime: editEleConfig.startTime || Date.now(),
                        endTime: editEleConfig.endTime || Date.now() + 10000086,
                        done: editEleConfig.done || false,
                        tags: editEleConfig.groupId || [],
                        priority: 1,
                        steps: editEleConfig.steps || [],
                    },
                }
            } else {
                config = {
                    mode: 2,
                    id: generateId(),
                    name: msg('new-todo'),
                    name_group: msg('new-group'),
                    color: '#0099ff',
                    task: {
                        startTime: Date.now(),
                        endTime: Date.now() + 10000086,
                        done: false,
                        tags: [],
                        priority: 1,
                        steps: [],
                    }
                }
            }

            const content = document.createElement('div');
            const preview = document.createElement('div');
            preview.className = 'sa-todo-modal-preview';
            const preview_title = document.createElement('input');
            preview_title.className = 'sa-todo-modal-preview-title';
            preview_title.style.outlineColor = config.color;
            preview_title.onchange = e => {
                config.name = e.target.value;
                refresh();
            }
            const preview_date = document.createElement('span')
            preview_date.className = 'sa-todo-modal-preview-date';

            const refresh = () => {
                preview_title.value = config.name;
                preview_date.textContent = getFormattedDateRange(config.task.startTime, config.task.endTime);
                preview.style.backgroundColor = config.color + alpha;
                document.querySelectorAll('.sa-todo-modal-preview-steps').forEach(ele => ele.remove())
                const preview_steps = document.createElement('ul');
                preview_steps.className = 'sa-todo-modal-preview-steps';

                config.task.steps.forEach((step, index) => {
                    const preview_steps_step = document.createElement('li');
                    preview_steps_step.id = step.id;
                    preview_steps_step.className = 'sa-todo-modal-preview-steps-step';
                    const preview_steps_step_text = document.createElement('input');
                    preview_steps_step_text.className = 'sa-todo-modal-preview-steps-step-input';
                    preview_steps_step_text.style.outlineColor = config.color;
                    preview_steps_step_text.value = step.text;
                    preview_steps_step_text.onchange = e => {
                        config.task.steps[index].text = e.target.value;
                    }
                    preview_steps_step_text.style.color = 'white';
                    const preview_steps_remove = document.createElement('button');
                    preview_steps_remove.textContent = '×';
                    preview_steps_remove.className = 'sa-todo-modal-preview-steps-step-remove';
                    preview_steps_remove.style.backgroundColor = config.color;
                    preview_steps_remove.style.color = 'white';

                    preview_steps_step.appendChild(preview_steps_remove);
                    preview_steps_step.appendChild(preview_steps_step_text);

                    preview_steps.appendChild(preview_steps_step);
                })

                preview.appendChild(preview_steps)
                // 最新创建的step自动对焦
                const latestStepIndex = config.task.steps.findIndex(step => step.latest === true);
                if (latestStepIndex !== -1) {
                    const stepElements = document.querySelectorAll('.sa-todo-modal-preview-steps-step');
                    if (stepElements[latestStepIndex]) {
                        const input = stepElements[latestStepIndex].querySelector('.sa-todo-modal-preview-steps-step-input');
                        if (input) {
                            setTimeout(() => {
                                input.focus();
                                input.select();
                            }, 0);
                        }
                    }
                    config.task.steps[latestStepIndex].latest = false;
                }

            }

            const input = (inputType, text, inputConfig = {}) => {
                const inputContent = document.createElement('div');
                inputContent.className = 'sa-todo-modal-input';
                const inputText = document.createElement('span');
                inputText.textContent = text;
                const input = document.createElement('input');
                input.className = 'sa-todo-modal-input-input';
                if (inputType != 'input') input.type = inputType;
                if (inputConfig.key2) input.value = config[inputConfig.key][inputConfig.key2];
                else input.value = config[inputConfig.key];
                input.oninput = e => {
                    if (inputConfig.key2) config[inputConfig.key][inputConfig.key2] = e.target.value;
                    else config[inputConfig.key] = e.target.value;
                    refresh();
                }

                inputContent.appendChild(inputText);
                inputContent.appendChild(input);

                return inputContent
            }

            preview.appendChild(preview_title);
            preview.appendChild(preview_date);
            refresh();

            const isNew = !editEleConfig;

            const modeTab = document.createElement('div');
            modeTab.className = 'sa-todo-mode-tab';

            const taskTabBtn = document.createElement('button');
            taskTabBtn.className = 'sa-todo-mode-tab-btn ' + (config.mode === 2 ? 'enable' : 'unable');
            taskTabBtn.textContent = msg('task');
            taskTabBtn.style.width = '50%';
            taskTabBtn.onclick = () => {
                config.mode = 2;
                taskTabBtn.className = 'sa-todo-mode-tab-btn enable';
                groupTabBtn.className = 'sa-todo-mode-tab-btn unable';
                taskFields.style.display = '';
                groupFields.style.display = 'none';
                preview.style.display = '';
                previewLabel.style.display = '';
                preview_steps_create.style.display = '';
                refreshGroupSelector();
                refresh();
            };

            const groupTabBtn = document.createElement('button');
            groupTabBtn.className = 'sa-todo-mode-tab-btn ' + (config.mode === 1 ? 'enable' : 'unable');
            groupTabBtn.textContent = msg('group');
            groupTabBtn.style.width = '50%';
            groupTabBtn.onclick = () => {
                config.mode = 1;
                groupTabBtn.className = 'sa-todo-mode-tab-btn enable';
                taskTabBtn.className = 'sa-todo-mode-tab-btn unable';
                taskFields.style.display = 'none';
                groupFields.style.display = '';
                preview.style.display = 'none';
                previewLabel.style.display = 'none';
                preview_steps_create.style.display = 'none';
            };

            modeTab.appendChild(taskTabBtn);
            modeTab.appendChild(groupTabBtn);

            const groupSelector = document.createElement('div');
            groupSelector.className = 'sa-todo-group-selector';
            const refreshGroupSelector = () => {
                groupSelector.innerHTML = '';
                const groups = getTodoListContent().groups || [];
                if (groups.length === 0) return;
                groups.forEach(group => {
                    const tag = document.createElement('button');
                    tag.className = 'sa-todo-group-tag';
                    tag.textContent = group.name;
                    const active = (config.task.tags || []).includes(group.id);
                    if (active) {
                        tag.classList.add('active');
                        tag.style.backgroundColor = group.color;
                    } else {
                        tag.style.backgroundColor = group.color + '60';
                    }
                    tag.onclick = () => {
                        const tags = config.task.tags || [];
                        const idx = tags.indexOf(group.id);
                        if (idx === -1) tags.push(group.id); else tags.splice(idx, 1);
                        config.task.tags = tags;
                        refreshGroupSelector();
                    };
                    groupSelector.appendChild(tag);
                });
            };

            const taskFields = document.createElement('div');
            const groupFields = document.createElement('div');
            const previewLabel = Object.assign(document.createElement('h1'), {
                className: 'sa-todo-modal-title',
                textContent: msg('preview')
            });

            const preview_steps_create = document.createElement('button');
            preview_steps_create.className = 'sa-todo-modal-create-button';
            preview_steps_create.textContent = msg('new-step');
            preview_steps_create.onclick = () => {
                config.task.steps.push({
                    id: generateId(),
                    text: msg('new-step'),
                    latest: true,
                    done: false
                });
                refresh()
            }

            const done = document.createElement('button');
            done.className = 'sa-todo-modal-create-button';
            done.textContent = msg('done');
            done.onclick = () => {
                if (editEleConfig) replaceTodo(config);
                else addNewTodo(config);
                remove()
            }

            taskFields.appendChild(input('color', msg('color'), { key: 'color' }));
            taskFields.appendChild(input('datetime-local', msg('start-time'), { key: 'task', key2: 'startTime' }));
            taskFields.appendChild(input('datetime-local', msg('end-time'), { key: 'task', key2: 'endTime' }));
            taskFields.appendChild(groupSelector);

            groupFields.appendChild(input('text', msg('name'), { key: 'name' }));
            groupFields.appendChild(input('color', msg('color'), { key: 'color' }));

            if (config.mode === 1) {
                taskFields.style.display = 'none';
                preview.style.display = 'none';
                previewLabel.style.display = 'none';
            } else {
                groupFields.style.display = 'none';
            }

            content.appendChild(Object.assign(document.createElement('h1'), {
                className: 'sa-todo-modal-title',
                textContent: msg('edit')
            }));
            if (isNew) content.appendChild(modeTab);
            content.appendChild(taskFields);
            content.appendChild(groupFields);
            content.appendChild(preview_steps_create);
            content.appendChild(done);
            content.appendChild(previewLabel);
            content.appendChild(preview);
            refreshGroupSelector();
            return content
        }

        const { backdrop, container, content: contentMain, closeButton, remove } =
            addon.tab.createModal(editEleConfig ? msg('edit-title') : msg('create-title'), {
                isOpen: true,
                useEditorClasses: true
            });

        container.classList.add('sa-todo-popup');
        contentMain.classList.add('sa-todo-content');

        contentMain.appendChild(addContentForModal(remove));

        backdrop.addEventListener("click", remove);
        closeButton.addEventListener("click", remove);

    }


    let selectedGroup = null;
    const createSideBarElements = () => {
        const content = document.createElement('div');
        content.className = 'sa-todo';

        const title = document.createElement('h1');
        title.textContent = msg('title', { project: PROJECT_NAME.toString() });

        let groupBar = null;
        try {
            const groups = getTodoListContent().groups || [];
            if (groups.length > 0) {
                groupBar = document.createElement('div');
                groupBar.className = 'sa-todo-group-bar';

                const allBtn = document.createElement('button');
                allBtn.className = 'sa-todo-group-btn';
                allBtn.textContent = msg('all');
                if (selectedGroup === null) allBtn.classList.add('active');
                allBtn.onclick = () => {
                    selectedGroup = null;
                    SideBar.clearContent();
                    SideBar.setContent(createSideBarElements(msg));
                };
                groupBar.appendChild(allBtn);

                groups.forEach(group => {
                    const btn = document.createElement('button');
                    btn.className = 'sa-todo-group-btn';
                    btn.textContent = group.name;
                    if (selectedGroup === group.id) {
                        btn.classList.add('active');
                        btn.style.backgroundColor = group.color;
                    } else {
                        btn.style.backgroundColor = group.color + '60';
                    }
                    btn.onclick = () => {
                        selectedGroup = group.id;
                        SideBar.clearContent();
                        SideBar.setContent(createSideBarElements(msg));
                    };
                    groupBar.appendChild(btn);
                });
            }
        } catch (e) { }

        const todoList = document.createElement('ul');
        todoList.className = 'sa-todo-list';
        try {
            getTodoListContent().tasks.forEach((task, index) => {
                let currentTask = task;
                if (selectedGroup !== null && !(currentTask.groupId || []).includes(selectedGroup)) return;
                let isHide = true;
                const todoEle = document.createElement('li');
                todoEle.className = 'sa-todo-list-ele';
                let border = '';
                task.groupId.forEach((tag, index) => {
                    const groupIndex = getTodoListContent().groups.findIndex(group => group.id === tag);
                    const end = index == task.groupId.length - 1 ? '' : ', ';
                    border += `0 ${index * 6 + 6}px 0 0 ${getTodoListContent().groups[groupIndex].color}${end}`
                })
                todoEle.style.boxShadow = border;
                const todoEle_card = document.createElement('div')
                todoEle_card.className = 'sa-todo-list-ele-titleDiv';
                const todoEleName = document.createElement('span');
                todoEleName.className = 'sa-todo-list-ele-title';
                todoEleName.textContent = currentTask.name;

                const todoEleDelLine = document.createElement('div');
                todoEleDelLine.textContent = currentTask.name;
                todoEleDelLine.style.setProperty('--width', getTextWidth(currentTask.name, '30px', 15));
                if (currentTask.steps.length != 0) {
                    todoEleDelLine.style.marginLeft = '70px';
                } else {
                    todoEleDelLine.style.marginLeft = '40px';
                }
                todoEleDelLine.className = 'sa-todo-list-ele-title sa-todo-list-ele-title-rmLine';

                const todoEleSetDone = document.createElement('img');
                todoEleSetDone.src = getTodoListContent().tasks[index].done ? undone : done;
                todoEleSetDone.className = 'sa-todo-list-ele-done'
                todoEleSetDone.style.backgroundColor = currentTask.color;

                const todoEleEditButton = document.createElement('img');
                todoEleEditButton.src = edit;
                todoEleEditButton.className = 'sa-todo-list-ele-done'
                todoEleEditButton.style.backgroundColor = currentTask.color;
                todoEleEditButton.onclick = () => {
                    addModal(task);
                }
                const todoEleRemoveButton = document.createElement('img');
                todoEleRemoveButton.src = remove;
                todoEleRemoveButton.className = 'sa-todo-list-ele-done'
                todoEleRemoveButton.style.backgroundColor = currentTask.color;
                todoEleRemoveButton.onclick = () => {
                    const originTodo = getTodoListContent();
                    originTodo.tasks.splice(index, 1);
                    createCommentToStage(getFormatComment(originTodo));
                }

                const todoEleDate = document.createElement('span');
                todoEleDate.style.color = 'white';
                todoEleDate.textContent = getFormattedDateRange(currentTask.startTime, currentTask.endTime);
                // steps
                const todoEleStepsContent = document.createElement('ul');

                const spawnSteps = (needGetLatest = false) => {
                    if (needGetLatest) currentTask = getTodoListContent().tasks[index]
                    const todoEleStepsContentMain = document.createElement('li');
                    todoEleStepsContentMain.className = 'sa-todo-list-ele-steps-main'
                    todoEleStepsContent.className = 'sa-todo-list-ele-steps';
                    todoEleStepsContent.id = currentTask.id;
                    if (currentTask.steps.length != 0) {
                        // 让Done为true的移到末尾
                        for (let needDone = 0; needDone <= 1; needDone += 1) {
                            if (needDone && !!currentTask.steps.find(step => step.done)) { //分割线
                                const lineDiv = document.createElement('li');
                                lineDiv.className = 'sa-todo-list-ele-line';
                                const text = document.createElement('span');
                                text.className = 'sa-todo-list-ele-line-text';
                                text.textContent = msg('done');
                                const line = document.createElement('hr');
                                line.className = 'sa-todo-list-ele-line-line';

                                lineDiv.appendChild(text);
                                lineDiv.appendChild(line)
                                todoEleStepsContentMain.appendChild(lineDiv);
                            }
                            currentTask.steps.forEach((step, indexStep) => {
                                if (step.done == needDone) {
                                    const todoEleStep = document.createElement('li');
                                    todoEleStep.className = 'sa-todo-list-ele-steps-li';

                                    const todoEleSetDoneStep = document.createElement('img');
                                    todoEleSetDoneStep.src = needDone ? undone : done;
                                    todoEleSetDoneStep.className = 'sa-todo-list-ele-done';
                                    todoEleSetDoneStep.style.backgroundColor = currentTask.color;
                                    todoEleSetDoneStep.onclick = () => {
                                        const todos = getTodoListContent();
                                        todos.tasks[index].steps[indexStep].done = !todos.tasks[index].steps[indexStep].done;
                                        createCommentToStage(getFormatComment(todos), false);
                                        todoEleStepsContent.innerHTML = '';
                                        spawnSteps(true);
                                    }

                                    const todoEleStep_Text = document.createElement('span');
                                    todoEleStep_Text.textContent = `${indexStep + 1}.${step.text}`;
                                    if (needDone) todoEleStep_Text.style.opacity = 0.5;
                                    todoEleStep_Text.style.color = 'white';

                                    todoEleStep.appendChild(todoEleSetDoneStep);
                                    todoEleStep.appendChild(todoEleStep_Text);

                                    todoEleStepsContentMain.appendChild(todoEleStep);
                                }
                            });
                        }
                    }
                    todoEleStepsContent.appendChild(todoEleStepsContentMain);
                }
                spawnSteps();

                // display
                todoEle.style.backgroundColor = currentTask.color + alpha;
                // 刷新选择done后的状态
                const refreshTodoStyle = () => {
                    const isDone = getTodoListContent().tasks[index].done;
                    if (isDone) {
                        todoEleDelLine.style.width = '';
                        todoEleName.style.opacity = 0.5;
                    } else {
                        todoEleDelLine.style.width = '0px';
                        todoEleName.style.opacity = 1;
                    }
                }

                // dropdown
                const todoEleDropdown = document.createElement('img');
                todoEleDropdown.src = dropdown;
                todoEleDropdown.className = 'sa-todo-list-ele-titleDiv-dropdown';
                const refreshDropdown_Steps = () => {
                    todoEleDropdown.style.transform = isHide ? 'rotate(180deg)' : 'rotate(0deg)';
                    // steps
                    todoEleStepsContent.style.gridTemplateRows = isHide ? '0fr' : '1fr';
                }
                todoEleSetDone.onclick = () => {
                    const todos = getTodoListContent();
                    todos.tasks[index].done = !todos.tasks[index].done;
                    todoEleSetDone.src = todos.tasks[index].done ? undone : done;
                    createCommentToStage(getFormatComment(todos), false);
                    refreshTodoStyle()
                }
                todoEleDropdown.onclick = () => {
                    isHide = !isHide;
                    refreshDropdown_Steps()
                }
                // spawn
                if (currentTask.steps.length != 0) todoEle_card.appendChild(todoEleDropdown);
                todoEle_card.appendChild(todoEleSetDone);
                todoEle_card.appendChild(todoEleName);
                todoEle_card.appendChild(todoEleDelLine);
                todoEle_card.appendChild(todoEleRemoveButton);
                todoEle_card.appendChild(todoEleEditButton);

                todoEle.appendChild(todoEle_card);
                todoEle.appendChild(todoEleDate);
                todoEle.appendChild(todoEleStepsContent);
                refreshDropdown_Steps();
                refreshTodoStyle();
                todoList.appendChild(todoEle);
            });
        } catch (e) {
            console.warn('Todo List can\'t display: ' + e.stack)
        }
        const addButton = document.createElement('button');
        addButton.className = 'sa-todo-add-todo';
        const addButtonText_p = document.createElement('span');
        addButtonText_p.textContent = '+';
        addButtonText_p.className = 'sa-todo-add-todo-text_p';
        addButton.onclick = () => {
            addModal();
        }
        const addButtonText_t = document.createElement('span');
        addButtonText_t.textContent = msg('add');
        addButtonText_t.className = 'sa-todo-add-todo-text_t'
        addButtonText_t.style.setProperty('--width', getTextWidth(msg('add'), '16px'));
        addButton.onmouseenter = () => {
            addButtonText_t.classList.add('active');
        }
        addButton.onmouseleave = () => {
            addButtonText_t.classList.remove('active');
        }

        addButton.appendChild(addButtonText_p);
        addButton.appendChild(addButtonText_t);

        content.appendChild(title)
        if (groupBar) content.appendChild(groupBar);
        content.appendChild(todoList)
        content.appendChild(addButton)
        return content
    }

    const createCommentToStage = (content, needRefresh = true) => {
        const vm = addon.tab.traps.vm;
        // 删除之前的comment,它实际上不会替换
        try {
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
        } catch (e) {
            console.warn("Can't remove comment, may it's doesn't exist?")
        }

        // 刷新一下Tab
        if (needRefresh) {
            SideBar.clearContent();
            SideBar.setContent(createSideBarElements(msg))
        }
    }

    const getTodoList = () => {
        const vm = addon.tab.traps.vm;
        return vm.runtime.getTargetForStage().comments[COMMENT_ID] || getFormatComment(emptyTodo)
    }
    /**
     * 
     * @returns {object}
     */
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
     * @param {string} config.color - 显示的颜色
     * @param {object} config.task - 对todo的配置
     * @param {int} config.task.startTime - 开始时间
     * @param {int} config.task.endTime - 结束时间
     * @param {boolean} config.task.done - 是否完成
     * @param {[]} config.task.tags - 属于什么组
     * @param {int} config.task.priority - 优先级，越高越提前，默认为0
     * @param {[{ id: string, text: string, done: boolean }]} config.task.steps - 步骤
     * @param {object} config.group - 对组的配置
     */
    const addNewTodo = config => {
        const editTodo = getTodoListContent();
        // 这会破坏读取,所以我们需要替换
        // 事实上对于POINT是*不可能*不通过用户而出现的，所以就直接全替换了
        config = JSON.parse(JSON.stringify(config).replaceAll(POINT,
            // 这很神秘啊
            `Why? ${POINT.split('').join(' ')} is key word, how did you found it?`
        ));
        if (config.mode === 1) {
            // 对于group
            editTodo.groups = [
                ...editTodo.groups,
                {
                    id: config.id || generateId(),
                    name: config.name || msg("new-group"),
                    color: config.color || '#0099ff'
                }
            ]
        } else if (config.mode === 2) {
            // 对于Task
            editTodo.tasks = [
                ...editTodo.tasks,
                {
                    id: config.id || generateId(),
                    name: config.name || msg("new-task"),
                    startTime: config.task.startTime || Date.now(),
                    endTime: config.task.endTime || Date.now() + 100000086,
                    done: config.task.done || false,
                    groupId: config.task.tags || [],
                    color: config.color || "#0099ff",
                    steps: config.task.steps || []
                }
            ]
        }
        createCommentToStage(getFormatComment(editTodo))
    };

    // 替换todo,用于编辑
    const replaceTodo = config => {
        const editTodo = getTodoListContent();
        let editIndex = 0;
        config = JSON.parse(JSON.stringify(config).replaceAll(POINT,
            // 这很神秘啊
            `Why? ${POINT.split('').join(' ')} is key word, how did you found it?`
        ));
        editIndex = editTodo.tasks.findIndex(task => task.id === config.id);
        editTodo.tasks[editIndex] = {
            id: config.id || generateId(),
            name: config.name || msg("New Group"),
            startTime: config.task.startTime || Date.now(),
            endTime: config.task.endTime || Date.now() + 100000086,
            done: config.task.done || false,
            groupId: config.task.tags || [],
            color: config.color || "#0099ff",
            steps: config.task.steps || []
        }
        createCommentToStage(getFormatComment(editTodo))
    }

    if (isVSCodeLayout()) addButtonWithVSCodeLayout()
    else addButton()
}
