# Scratch 虚拟机 (VM) 探索指南

## 1. 核心概念

Scratch 虚拟机是 Scratch 项目的运行引擎，负责执行用户编写的积木脚本，管理目标（sprites和stage），以及处理各种输入/输出操作。

### 1.1 主要组件
- **Runtime**: 核心运行时，管理目标、线程和执行环境
- **Sequencer**: 负责调度和执行线程
- **Blocks**: 管理积木定义和执行
- **Target**: 代表舞台或角色
- **Thread**: 表示正在执行的脚本线程

## 2. Runtime API 详解

### 2.1 脚本控制 API

| API | 描述 | 参数 | 示例 |
|-----|------|------|------|
| `greenFlag()` | 启动所有绿旗脚本 | 无 | `runtime.greenFlag()` |
| `stopAll()` | 停止所有脚本 | 无 | `runtime.stopAll()` |
| `toggleScript(topBlockId, opts)` | 切换脚本运行状态 | topBlockId: 脚本顶积木ID<br>opts: 选项对象 | `runtime.toggleScript('block123', {target: sprite})` |
| `addMonitorScript(topBlockId, optTarget)` | 添加监控脚本 | topBlockId: 脚本顶积木ID<br>optTarget: 目标对象 | `runtime.addMonitorScript('block456', sprite)` |
| `startHats(requestedHatOpcode, optMatchFields, optTarget)` | 启动特定帽子积木脚本 | requestedHatOpcode: 帽子积木opcode<br>optMatchFields: 匹配字段<br>optTarget: 目标对象 | `runtime.startHats('event_whenflagclicked')` |
| `allScriptsDo(f, optTarget)` | 对所有脚本执行函数 | f: 回调函数<br>optTarget: 目标对象 | `runtime.allScriptsDo((blockId, target) => console.log(blockId))` |
| `allScriptsByOpcodeDo(opcode, f, optTarget)` | 对特定opcode脚本执行函数 | opcode: 积木opcode<br>f: 回调函数<br>optTarget: 目标对象 | `runtime.allScriptsByOpcodeDo('motion_movesteps', (blockId, target) => console.log(blockId))` |

### 2.2 目标管理 API

| API | 描述 | 参数 | 示例 |
|-----|------|------|------|
| `addTarget(target)` | 添加目标 | target: 目标对象 | `runtime.addTarget(sprite)` |
| `removeExecutable(executableTarget)` | 移除可执行目标 | executableTarget: 目标对象 | `runtime.removeExecutable(sprite)` |
| `disposeTarget(disposingTarget)` | 释放目标 | disposingTarget: 目标对象 | `runtime.disposeTarget(sprite)` |
| `moveExecutable(executableTarget, delta)` | 移动目标执行顺序 | executableTarget: 目标对象<br>delta: 移动位置 | `runtime.moveExecutable(sprite, 1)` |
| `setExecutablePosition(executableTarget, newIndex)` | 设置目标执行位置 | executableTarget: 目标对象<br>newIndex: 新位置 | `runtime.setExecutablePosition(sprite, 0)` |

### 2.3 积木相关 API

| API | 描述 | 参数 | 示例 |
|-----|------|------|------|
| `getOpcodeFunction(opcode)` | 获取积木函数 | opcode: 积木opcode | `const func = runtime.getOpcodeFunction('motion_movesteps')` |
| `getIsHat(opcode)` | 判断是否为帽子积木 | opcode: 积木opcode | `const isHat = runtime.getIsHat('event_whenflagclicked')` |
| `getIsEdgeActivatedHat(opcode)` | 判断是否为边缘激活帽子积木 | opcode: 积木opcode | `const isEdge = runtime.getIsEdgeActivatedHat('event_whenkeypressed')` |
| `getBlocksXML(target)` | 获取积木XML表示 | target: 目标对象 | `const xml = runtime.getBlocksXML(sprite)` |
| `getBlocksJSON()` | 获取积木JSON表示 | 无 | `const json = runtime.getBlocksJSON()` |
| `addAddonBlock(options)` | 添加附加积木 | options: 积木选项 | `runtime.addAddonBlock({procedureCode: 'custom_block', callback: () => {}})` |
| `getAddonBlock(procedureCode)` | 获取附加积木 | procedureCode: 积木代码 | `const block = runtime.getAddonBlock('custom_block')` |

### 2.4 扩展相关 API

| API | 描述 | 参数 | 示例 |
|-----|------|------|------|
| `registerPeripheralExtension(extensionId, extension)` | 注册外设扩展 | extensionId: 扩展ID<br>extension: 扩展对象 | `runtime.registerPeripheralExtension('ev3', ev3Extension)` |
| `scanForPeripheral(extensionId)` | 扫描外设 | extensionId: 扩展ID | `runtime.scanForPeripheral('ev3')` |
| `connectPeripheral(extensionId, peripheralId)` | 连接外设 | extensionId: 扩展ID<br>peripheralId: 外设ID | `runtime.connectPeripheral('ev3', 'device123')` |
| `disconnectPeripheral(extensionId)` | 断开外设连接 | extensionId: 扩展ID | `runtime.disconnectPeripheral('ev3')` |
| `getPeripheralIsConnected(extensionId)` | 检查外设是否连接 | extensionId: 扩展ID | `const isConnected = runtime.getPeripheralIsConnected('ev3')` |

### 2.5 配置相关 API

| API | 描述 | 参数 | 示例 |
|-----|------|------|------|
| `setCompatibilityMode(compatibilityModeOn)` | 设置兼容模式 | compatibilityModeOn: 布尔值 | `runtime.setCompatibilityMode(true)` |
| `setFramerate(framerate)` | 设置帧率 | framerate: 数字 | `runtime.setFramerate(60)` |
| `setInterpolation(interpolationEnabled)` | 启用/禁用插值 | interpolationEnabled: 布尔值 | `runtime.setInterpolation(true)` |
| `setRuntimeOptions(runtimeOptions)` | 更新运行时选项 | runtimeOptions: 选项对象 | `runtime.setRuntimeOptions({maxClones: 500})` |
| `setCompilerOptions(compilerOptions)` | 更新编译器选项 | compilerOptions: 选项对象 | `runtime.setCompilerOptions({enabled: true})` |
| `setStageSize(width, height)` | 更改舞台大小 | width: 宽度<br>height: 高度 | `runtime.setStageSize(800, 600)` |

## 3. 积木执行流程

1. **积木注册**：通过 `_registerBlockPackages()` 和 `_registerExtensionPrimitives()` 注册积木
2. **脚本启动**：通过 `greenFlag()` 或 `startHats()` 启动脚本
3. **线程创建**：为每个脚本创建 `Thread` 对象
4. **积木执行**：序列器通过 `getOpcodeFunction()` 获取积木函数并执行
5. **视觉反馈**：通过 `glowBlock()` 和 `visualReport()` 提供视觉反馈
6. **脚本管理**：通过 `toggleScript()` 和 `stopAll()` 管理脚本状态

## 4. 核心数据结构

- **_primitives**: 存储积木opcode到实现函数的映射
- **_hats**: 存储帽子积木的元数据
- **_blockInfo**: 存储所有积木类别的信息
- **addonBlocks**: 存储附加积木的信息
- **monitorBlockInfo**: 存储监控积木的信息
- **targets**: 存储所有目标（舞台和角色）
- **threads**: 存储所有正在执行的线程

## 5. 扩展开发指南

```javascript
// 扩展示例
class MyExtension {
    constructor(runtime) {
        this.runtime = runtime;
    }
    
    getInfo() {
        return {
            id: 'myextension',
            name: 'My Extension',
            blocks: [
                {
                    opcode: 'myblock',
                    blockType: Scratch.BlockType.REPORTER,
                    text: 'my block',
                    arguments: {}
                }
            ]
        };
    }
    
    myblock() {
        return 'Hello from extension!';
    }
}

// 注册扩展
Scratch.extensions.register(new MyExtension());
```

### 5.3 使用 Runtime API

```javascript
// 在扩展中使用 Runtime API
class MyExtension {
    constructor(runtime) {
        this.runtime = runtime;
    }
    
    // 示例：触发广播
    broadcast(message) {
        this.runtime.startHats('event_whenbroadcastreceived', {
            BROADCAST_OPTION: message
        });
    }
    
    // 示例：获取所有目标
    getAllTargets() {
        return this.runtime.targets;
    }
}
```

## 6. 性能优化

### 6.1 编译模式

TurboWarp 的 Scratch VM 支持编译模式，可以将积木脚本编译为 JavaScript 代码以提高执行效率：

```javascript
// 启用编译模式
runtime.setCompilerOptions({enabled: true});

// 预编译所有脚本
runtime.precompile();
```

### 6.2 帧率控制

通过调整帧率可以平衡性能和流畅度：

```javascript
// 设置帧率为 60 FPS
runtime.setFramerate(60);

// 启用插值以获得更流畅的动画
runtime.setInterpolation(true);
```

## 7. 监控与调试

### 7.1 监控积木值

```javascript
// 添加监控
runtime.requestAddMonitor({
    id: 'monitor1',
    mode: 'default',
    opcode: 'data_variable',
    params: {VARIABLE: 'myVariable'},
    value: 0,
    visible: true,
    x: 100,
    y: 100,
    width: 100,
    height: 20
});

// 更新监控值
runtime.requestUpdateMonitor({
    id: 'monitor1',
    value: 42
});
```

### 7.2 调试技巧

```javascript
// 启用调试模式
runtime.enableDebug();

// 监听执行事件
runtime.on('BEFORE_EXECUTE', () => {
    console.log('Before execute');
});

runtime.on('AFTER_EXECUTE', () => {
    console.log('After execute');
});
```

## 8. 常见问题与解决方案

### 8.1 积木执行顺序

**问题**：脚本执行顺序不符合预期

**解决方案**：使用 `moveExecutable()` 或 `setExecutablePosition()` 调整目标执行顺序

### 8.2 性能问题

**问题**：项目运行缓慢

**解决方案**：
- 启用编译模式
- 减少克隆数量
- 优化循环结构
- 调整帧率

### 8.3 扩展兼容性

**问题**：扩展在不同版本的 Scratch 中不兼容

**解决方案**：
- 遵循 Scratch 扩展规范
- 测试不同版本的兼容性
- 使用版本检测

## 9. 示例：创建自定义积木

### 9.1 使用 addAddonBlock

```javascript
// 创建自定义积木
runtime.addAddonBlock({
    procedureCode: 'custom_math',
    arguments: ['a', 'b'],
    callback: (args, util) => {
        const a = parseFloat(args.a) || 0;
        const b = parseFloat(args.b) || 0;
        return a + b;
    },
    return: 1 // 1 for round reporter
});
```

### 9.2 创建扩展积木

```javascript
// 创建完整扩展
class MathExtension {
    constructor(runtime) {
        this.runtime = runtime;
    }
    
    getInfo() {
        return {
            id: 'mathextension',
            name: 'Math Tools',
            blocks: [
                {
                    opcode: 'add',
                    blockType: Scratch.BlockType.REPORTER,
                    text: 'add [A] and [B]',
                    arguments: {
                        A: {type: Scratch.ArgumentType.NUMBER},
                        B: {type: Scratch.ArgumentType.NUMBER}
                    }
                }
            ]
        };
    }
    
    add(args) {
        return args.A + args.B;
    }
}

// 注册扩展
Scratch.extensions.register(new MathExtension());
```

## 10. 总结

Scratch 虚拟机提供了丰富的 API，使开发者能够：

1. **控制脚本执行**：启动、停止和管理脚本
2. **管理目标**：添加、移除和排序角色和舞台
3. **扩展功能**：创建自定义积木和扩展
4. **优化性能**：调整帧率、启用编译模式
5. **监控状态**：添加和更新监控

通过深入了解这些 API，开发者可以创建更复杂、更高效的 Scratch 项目，以及开发功能丰富的扩展。

## 11. 进一步探索

- **源码分析**：查看 `scratch-vm/src/engine/runtime.js` 了解核心实现
- **扩展开发**：参考现有扩展的实现方式
- **插件开发**：通用使用类似的 API 实现
- **性能测试**：使用内置的 profiler 分析性能瓶颈
- **社区资源**：参与 Scratch 社区，分享和学习扩展开发经验

---

**提示**：本指南基于当前版本 AE 使用的 TurboWarp Scratch VM 的核心功能，具体 API 可能因版本而异。在开发扩展时，请参考当前版本的官方文档。
