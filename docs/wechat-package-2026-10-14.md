# 微信主包分包优化 · 2026-10-14

微信包超限来自主包内的整个场景资源集合。按 Cocos Creator 3.8 官方分包机制，构建配置 `mainBundleCompressionType` 改为 `subpackage`，禁用远程主包和首场景单独抽包。引擎自动生成 main / internal 分包声明，并按启动依赖加载。无需手写资源搬迁或下载服务器。

## 体积与产物

所有数字均为实际未压缩文件总字节数，包含全部原生模型 / 动画二进制，不按 ZIP 大小判断限额。

| 包 | 字节 | MiB |
| --- | ---: | ---: |
| 原主包 | 8,642,642 | 8.24 |
| 当前主包 | 2,253,521 | 2.15 |
| main 场景分包 | 5,986,906 | 5.71 |
| internal 内置分包 | 405,194 | 0.39 |
| 当前总量 | 8,645,621 | 8.24 |

主包余量 1,940,783 字节，低于 4 MiB 限制及项目 3891 KiB 安全线。分包主要改变资源所属包，因此总资源量基本不变。

- 导入目录：`game/build/kitchen-chaos-wechat-optimized-20261014/`。
- 为方便导入，另存相同工程到桌面 `Kitchen-Chaos-WeChat-Optimized-20261014/`，所有文件逐字节校验一致。
- ZIP：`game/build/packages/kitchen-chaos-wechat-optimized-20261014.zip`，2,515,978 字节。
- SHA-256：`83cfcc57e3288a9541aec8b916ee625624acc2ba1f6673f9bbe5ddc81b65361c`。
- 解压后导入包含 `project.config.json` 的整目录；必须保留 `subpackages/`。不要继续导入上一轮超限目录。

## 可复跑判据

- 构建：CocosCreator.exe `--project <game绝对路径> --build configPath=<tools/build-wechat.json绝对路径>`。使用 Cocos Creator 3.8.8，入口 main.scene，非调试横屏，沿用已有 appid。
- 包体：`pnpm size game/build/kitchen-chaos-wechat-optimized-20261014`；可追加一个 JSON 输出路径。统计每个声明分包与主包全部文件，校验 engine / game.json 的分包声明一致及入口文件存在；超预算或缺文件退出失败。
- `pnpm check`：18:46 复核 515 项 / 40 文件通过，含类型检查、6 个包体及 4 个启动回归判据。
- 旧产物在新包体检查中退出 1，新产物退出 0。
- 场景 main 分包的 105 个配置 / 脚本 / 模型 / 材质 / 动画文件与优化前逐字节一致；引擎、适配器、game.js、application.js 逐字节一致。
- ZIP CRC、根目录入口与压缩包内每个文件相对构建目录逐字节校验通过。
- 微信开发者工具 Nightly 2.01.2601082 已实际加载分包并显示厨房场景，两次确认启动成功。此结论限于场景启动；交互与真机验收仍待完成。最新状态见同目录 `wechat-package-2026-10-14-check.json`。
- 本轮后台复核：6 个包体回归判据通过；主包 / 分包完整、ZIP 的 170 个文件 CRC 和字节一致、桌面工程一致，模板 / 构建 / 桌面基础库均为 3.17.2。

## 黑屏修复

黑屏来自微信开发者工具下载基础库 3.17.3 时发生 EPERM 文件改名失败，随后运行时返回 HTTP 500。切换到本机已有的 3.17.2 后，实际模拟器成功显示厨房；重建后再次确认场景启动。

新增 `game/build-templates/wechatgame/project.config.json`，通过 Cocos JSON 合并模板将 `libVersion` 固定为 3.17.2，避免重新构建丢失修复。最终构建于 18:07:43 完成；相对前一个优化包，169 个交付文件中仅 `project.config.json` 有变化。旧 ZIP 已保留为 `kitchen-chaos-wechat-optimized-20261014-before-library-fix.zip`。

## 文件清单

- `tools/build-wechat.json`：可复现微信分包构建配置。
- `game/build-templates/wechatgame/project.config.json`：持久化微信基础库版本。
- `tools/check-wechat-package.mjs`、`tests/wechat-package.test.ts`、`package.json`：实际主包 / 分包计数、超限退出与回归检查。
- `ROADMAP.md`、本记录及 check JSON：当前断点与验收。
- `game/build/kitchen-chaos-wechat-optimized-20261014/` 及 ZIP：本地构建产物，按现有规则忽略。

## 不要报成 bug 的清单与遗留

- main 单个场景分包大于 4 MiB，不属于主包；主包按 game.json 声明排除分包后的实际总量计算。未把场景文件从交付工程中删掉。
- 初始加载需先加载引擎内置分包，再加载场景分包，是 Cocos 官方分包路径。游戏仍用同一入口和模型。
- 原 `tools/pkgsize.ts` 留作历史工具，不再作为 `pnpm size` 入口，禁止根据其旧“孤儿”提示直接删资源。
- 上一轮 Web 包与旧微信产物保留；新包使用独立输出目录。本次没有修改模型、场景、玩法或 Web 构建。
- 模拟器仍出现洋葱纹理 Error 16352（`mipmapLevelDataSize` of null），以及 WAGame.js 的 `jsbridge not ready`；已确认它们未阻止厨房场景显示，本轮未修。
- 前台自动化已停止，后台调试端口未启用；本轮后台只复核产物，没有重新操作模拟器或验收交互。
- 本次未上传 / 发布；手机真实性能与触控仍需真机验收。

官方资料：[Cocos 小游戏分包](https://docs.cocos.com/creator/3.8/manual/en/editor/publish/subpackage.html)、[命令行构建](https://docs.cocos.com/creator/3.8/manual/en/editor/publish/publish-in-command-line.html)、[JSON 构建模板](https://docs.cocos.com/creator/3.8/manual/en/editor/publish/custom-project-build-template.html)。

## 启动错误修复包（18:32）

微信启动模板在宏初始化前保留共享图片缓存（CLEANUP_IMAGE_CACHE=false），避免后续模型纹理读取已释放的原生图片；保留其他宏和原先关闭的动态合图。无头 Web 未复现原微信 Error 16352，因此本轮属于针对图片提前释放路径的修复，不能报成微信运行错误已清零。21 个交付纹理在保留缓存时均加载并创建 GPU 纹理成功。

启动时优先用 getDeviceInfo / getAppBaseInfo / getWindowInfo 向 Cocos 的旧同步适配器提供真实数据；窗口尺寸每次读取，旧基础库保留原接口。4 个回归判据覆盖绕开旧桥调用、窗口变化、兼容回退和错误不被吞掉；6 个包体判据及类型检查通过。未修改开发者工具 WAGame.js，若其自身初始化仍报 jsbridge not ready，需要在工具侧继续核验。

Cocos 构建于 18:32:19 完成；最后的启动函数从更新后的 game.ejs 同步至 game.js 并逐字节核对，application.js 恢复为原默认文件。实际启动函数测试确认宏覆盖发生在场景前，其他宏不丢失、动态合图保持关闭。最终相对旧 ZIP 仅 game.js 与新增 wechat-system-info.js 两处不同；资源 / 引擎不变。旧包保存为 before-runtime-fix.zip。桌面工程和 170 个 ZIP 文件一致。

本轮文件：game/build-templates/wechatgame/game.ejs、wechat-system-info.js；tests/wechat-startup.test.ts；tools/verify-wechat-textures.cjs；ROADMAP.md、本记录与 check JSON。保持后台工作，本版尚未重新验收微信模拟器；上传前需在工具中重新编译确认两条错误是否消失，真机性能 / 触控仍待验收。
