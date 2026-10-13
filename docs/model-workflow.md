# 道具模型建模与验证（2026-10-12）

用户已确认角色动作验收通过。已完成原创灭火器和饮料机从 Blender 到 Cocos 的流程。

## 文件

- `art-source/fire-extinguisher.blend`：Blender 4.5.9 可编辑源文件，瓶身、软管、压力表、把手、标签为独立物件。
- `art-source/fire-extinguisher.png`：Blender 模型预览。
- `art-source/fire-extinguisher-in-game.jpg`：Cocos 3.8.8 浏览器预览实拍。
- `tools/build-extinguisher.py`：可重复建模、渲染与导出的脚本。
- `game/assets/art/kitchen/fireExtinguisher.glb` 及 `.meta`：游戏资源及稳定 UUID。
- `game/assets/scripts/StationView.ts`：新增 `extinguisherModel` 引用，实例化道具。
- `game/assets/main.scene`：Canvas / StationView 的模型引用已绑定 GLB 导入得到的场景 Prefab。
- `tests/extinguisher-model.test.ts`：GLB 格式、尺寸、面数及资源预算验收。

本模型由本项目脚本原创生成，没有外部贴图、品牌标识或付费素材。

## 规格与接入

539 个三角面、965 个导出顶点、39,032 字节，五种纯色材质 / 五个渲染子网格。
Blender 使用米与 Z 向上；导出 GLB 使用 Y 向上，瓶底为局部原点，模型总高约 0.787 米。
不含骨骼、动画或外部文件依赖。

工位仍在世界坐标 `(9.3, 0, -2.8)`，交互占地仍为 `0.5 × 0.5` 米。
模型子节点抵消工位宿主的 X/Z 缩放，保持实际米制尺寸；瓶底抬高 0.25 米，模拟墙挂摆放。
没有绑定模型时保留原圆柱占位。拿取、放回与灭火规则未改。
本次只替换工位上的外观；手持提示仍沿用现有游戏的气泡图标。

## 修改与重新导出

手工修改：用 Blender 打开 `.blend`，选择需要的物件编辑；导出选中的模型为 GLB，
保留米制尺寸、Y 向上、应用变换，不导出相机、灯光及动画。覆盖上述 GLB 即可。
保留现有 `.meta`，让场景中的 Prefab 引用继续有效。

脚本重新生成（会覆盖源模型和 GLB，请先保存手工修改的副本）：

```powershell
$blenderExe = 'C:/Users/12255/.codex/cache/blender-4.5.9/blender-4.5.9-windows-x64/blender.exe'
& $blenderExe --background --factory-startup --python tools/build-extinguisher.py
```

编辑器资源管理器点击刷新；如脚本属性没有更新，重启编辑器。
打开 `game/assets/main.scene` 并预览，按 WASD 移动到冷库门旁看实际尺寸与遮挡。
在营业中的游戏再检查 Space 拿取 / 放回、着火烤炉的灭火交互。

## 本次验证

- 模型规格测试先因资源不存在失败，生成 GLB 后通过。
- Khronos glTF Validator：0 errors / 0 warnings；五条 unused UV 信息不影响渲染。
- TypeScript 检查通过，475 项测试 / 33 个文件通过，包含既有灭火逻辑的四项测试。
- `pnpm scene`、`pnpm layout`、`pnpm cam` 通过。
- Cocos 实际浏览器预览显示瓶身、软管、标签；移动到工位后无控制台错误或警告。
- 本次没有在营业局内触发真实火灾，灭火行为由原有逻辑测试覆盖。

## 饮料机

新增文件：

- `art-source/drinks-machine.blend` / `.png`：可编辑源模型及 Blender 渲染图。
- `tools/build-drinks-machine.py`：可重复生成模型、保存源文件、渲染和导出 GLB。
- `game/assets/art/kitchen/drinksMachine.glb` / `.meta`：游戏资源及稳定 UUID。
- `tests/drinks-model.test.ts`：格式、外部依赖、尺寸、面数及材质数量验收。
- `game/assets/model-demo.scene` / `.meta`：两件道具的独立 Cocos 展示场景。
- `art-source/model-demo-in-cocos.jpg`：该展示场景的实际浏览器预览截图。
- `tools/build-model-demo.mjs`：使用本项目已有场景格式和模型导入数据生成展示场景。
- `StationView.ts` / `main.scene`：新增并绑定 `drinksModel` 场景 Prefab。

饮料机为本项目原创蓝白色机身，包含出液嘴、杯槽、按钮、接水盘和杯子标识。
622 个三角面、1,172 个导出顶点、35,280 字节，四种纯色材质；宽 0.72、深约 0.522、高 1.1 米。
不含贴图、UV、骨骼或动画，底面原点归零；对冲宿主的 X/Z 缩放后保持米制尺寸。
工位位置 `(5.9, 0, -2.7)` 和 `0.8 × 0.6` 米交互占地不变。

正常游戏中仍需 250 金币购买，下一天生效；未购买时隐藏机器。饮料制作、取杯、送餐和溢出规则未改。
杯槽为空，图标仅为机身标识；实际制作进度继续由现有 UI 表示。

重新生成（先保存手工修改副本；会覆盖模型）：

```powershell
& $blenderExe --background --factory-startup --python tools/build-drinks-machine.py
# 以下命令需要 Cocos 已导入两个 GLB，且编辑器已关闭：
node tools/build-model-demo.mjs
```

在 Cocos 里打开 `model-demo.scene`，点击预览即可看两件道具。
展示场景只包含静态模型、光源和相机，没有游戏脚本，不读取或写入金币和进度。
打开 `main.scene` 可返回正常游戏。

饮料机验证：模型规格测试从缺少资源失败到通过；glTF Validator 零错误、零警告、零提示信息；
TypeScript 检查、476 项测试 / 34 文件、主场景结构检查通过。
商店和饮料制作由既有自动测试覆盖；本次未在游戏内实际花费金币购买。
独立展示场景已在 Cocos 3.8.8 浏览器预览中确认两件模型正常渲染，控制台无错误或警告。

## 洋葱、酸黄瓜与培根

三件配料均由本项目 Blender 脚本原创生成，没有外部贴图或付费素材。
洋葱为紫白双色开口圆环，酸黄瓜为带表皮与籽的三片切片，培根为红白相间的三条波浪薄片。

| GLB | 三角面 | 字节 | 材质数 |
|---|---:|---:|---:|
| `game/assets/art/food/onion.glb` | 576 | 28,376 | 2 |
| `game/assets/art/food/pickle.glb` | 1,080 | 49,412 | 3 |
| `game/assets/art/food/bacon.glb` | 312 | 17,664 | 2 |

合计 95,452 字节；不含贴图、UV、骨骼、动画或外部文件依赖。
底面归零、水平居中，单件宽深小于 0.34 米，方便复用现有汉堡叠层缩放。
酸黄瓜切片高度错开，避免重叠部分出现共面闪烁。

文件清单：

- `art-source/burger-toppings.blend` / `.png`：三种配料的可编辑部件和 Blender 预览图。
- `tools/build-toppings.py`：生成源模型、渲染图和三个 GLB 的脚本。
- 三个食品 GLB / `.meta`：游戏资源与稳定 UUID。
- `game/assets/scripts/BurgerStack.ts`：优先使用专用配料模型，保留原材质；未绑定时沿用旧场景的替代素材。
- `game/assets/scripts/StationView.ts` / `main.scene`：新增并绑定三个配料 Prefab。
- `tests/topping-models.test.ts`：格式、底面、尺寸、面数、材质和资源预算验收。
- `game/assets/toppings-demo.scene` / `.meta`：三件配料和实际汉堡叠层展示。
- `art-source/toppings-demo-in-cocos.jpg`：实际 Cocos 浏览器预览截图。
- `game/assets/scripts/ToppingPreview.ts` / `.meta`：调用生产环境的 `BurgerStack`，使用现有面包、肉、芝士、蔬菜与三个新配料组装示例汉堡；不读取或写入游戏存档。
- `tools/build-topping-demo.mjs`：生成配料展示场景，可选绑定主场景 Prefab。

重新生成（会覆盖源模型和 GLB；先保存手工修改副本）：

```powershell
& $blenderExe --background --factory-startup --python tools/build-toppings.py
# Cocos 导入 GLB 后关闭编辑器，再生成展示场景：
node tools/build-topping-demo.mjs
# 仅在需要重新绑定主场景的三项引用时添加 --bind-main。
```

源文件中三种模型并排摆放；脚本导出的每个 GLB 会回到自身局部原点。
保留 `.meta`，重新导出不会破坏场景中的引用。
在 Cocos 打开 `toppings-demo.scene` 并预览，检查配料颜色和示例汉堡；打开 `main.scene` 返回正常游戏。

验证：三项规格测试先因缺少资源失败，生成后通过；三个 GLB 的 Khronos Validator 均零错误、零警告、零提示信息。
TypeScript 检查、479 项测试 / 35 文件、主场景结构检查通过。
Cocos 3.8.8 实际预览中，三个配料与示例汉堡均正常显示，无错误或警告；正常游戏主场景也已启动验证。
本次未在营业局内逐项手动取料组装；组装外观通过直接调用生产 `BurgerStack` 的独立展示验证。
游戏的配料顺序与叠层高度仍由原有代码控制，订单、取料、烹饪、价格和解锁规则未改。

### 不要报成 bug 的清单

- 这轮只替换汉堡叠层中的三种配料外观；冰箱选项和手持提示继续使用原有图标。
- 示例汉堡的面包外观来自现有 Kenney 面包模型；本轮没有更换面包。
- 展示场景的汉堡放大 2.2 倍便于验图；正常游戏沿用原来的 0.3 米尺度。
- 演示包含全部配料，只用于展示；不会生成订单或结算收入。
