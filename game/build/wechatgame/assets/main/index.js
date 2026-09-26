System.register("chunks:///_virtual/a7-check.ts", ['cc', './types.ts', './recipe.ts', './order.ts', './rng.ts', './difficulty.ts', './collision.ts', './vec2.ts', './sim.ts'], function (exports) {
  var cclegacy, INGREDIENTS, COOK_LEVELS, MOODS, STATION_KINDS, addIngredient, addCookedPatty, cookLevelAt, hasCore, createBurger, judge, nextInt, createRng, starsFor, difficultyForDay, LAST_DAY, circleOverlapsAABB, inTriggerRange, set, rotateY, dist, runDay, defaultSimConfig;
  return {
    setters: [function (module) {
      cclegacy = module.cclegacy;
    }, function (module) {
      INGREDIENTS = module.INGREDIENTS;
      COOK_LEVELS = module.COOK_LEVELS;
      MOODS = module.MOODS;
      STATION_KINDS = module.STATION_KINDS;
    }, function (module) {
      addIngredient = module.addIngredient;
      addCookedPatty = module.addCookedPatty;
      cookLevelAt = module.cookLevelAt;
      hasCore = module.hasCore;
      createBurger = module.createBurger;
    }, function (module) {
      judge = module.judge;
    }, function (module) {
      nextInt = module.nextInt;
      createRng = module.createRng;
    }, function (module) {
      starsFor = module.starsFor;
      difficultyForDay = module.difficultyForDay;
      LAST_DAY = module.LAST_DAY;
    }, function (module) {
      circleOverlapsAABB = module.circleOverlapsAABB;
      inTriggerRange = module.inTriggerRange;
    }, function (module) {
      set = module.set;
      rotateY = module.rotateY;
      dist = module.dist;
    }, function (module) {
      runDay = module.runDay;
      defaultSimConfig = module.defaultSimConfig;
    }],
    execute: function () {
      exports('a7Lines', a7Lines);
      cclegacy._RF.push({}, "fe308KK/9BHgq/BlqNpXlmx", "a7-check", undefined);

      /** Grep anchor in the build artifact. Renaming it breaks the ROADMAP §A7 check. */
      var A7_MARKER = exports('A7_MARKER', 'A7_LOGIC_LINKED_KITCHEN_CHAOS');
      var WINDOWS = {
        rareAt: 4,
        mediumAt: 7,
        wellAt: 10,
        burntAt: 14
      };
      var SPEC = {
        required: ['bun', 'patty', 'cheese'],
        banned: ['pickle'],
        doneness: 'medium',
        patience: 45
      };

      /** One line per module, so a mismatch names the module that broke. */
      function a7Lines() {
        var out = [A7_MARKER];
        out.push("types ing=" + INGREDIENTS.length + " cook=" + COOK_LEVELS.join('/') + " mood=" + MOODS.length + " station=" + STATION_KINDS.join('/'));
        var burger = createBurger();
        addIngredient(burger, 'bun');
        addIngredient(burger, 'cheese');
        addCookedPatty(burger, cookLevelAt(8, WINDOWS));
        out.push("recipe core=" + hasCore(burger) + " cook=" + burger.cook + " n=" + burger.ingredients.length);
        var v = judge(burger, SPEC);
        out.push("order ok=" + v.ok + " cookOk=" + v.cookOk + " missing=[" + v.missing + "] forbidden=[" + v.forbidden + "]");
        var rng = createRng(1234);
        out.push("rng " + nextInt(rng, 100) + "," + nextInt(rng, 100) + "," + nextInt(rng, 100) + "," + nextInt(rng, 100));
        var a = set({
          x: 0,
          z: 0
        }, 3, 4);
        var rot = rotateY({
          x: 0,
          z: 0
        }, a, Math.PI / 2);
        var box = {
          center: {
            x: 1.5,
            z: 1.5
          },
          halfX: 0.5,
          halfZ: 0.5
        };
        out.push("vec2/collision dist=" + dist(a, {
          x: 0,
          z: 0
        }).toFixed(3) + " rot=" + rot.x.toFixed(3) + "," + rot.z.toFixed(3) + " hit=" + circleOverlapsAABB({
          x: 0,
          z: 0
        }, 1.5, box) + " reach=" + inTriggerRange({
          x: 0,
          z: 0
        }, a, 5));
        var d = difficultyForDay(LAST_DAY);
        out.push("difficulty lastDay=" + d.day + " stars=" + d.stars.one + "/" + d.stars.two + "/" + d.stars.three + " got=" + starsFor(9, LAST_DAY));
        var r = runDay(defaultSimConfig());
        out.push("sim arrived=" + r.arrived + " served=" + r.served + " wrong=" + r.wrong + " timedOut=" + r.timedOut + " burnt=" + r.burnt + " peak=" + r.peakConcurrent + " rate=" + r.completionRate.toFixed(4));
        return out;
      }
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/A7Probe.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc', './a7-check.ts'], function (exports) {
  var _inheritsLoose, _createForOfIteratorHelperLoose, cclegacy, _decorator, Component, a7Lines, A7_MARKER;
  return {
    setters: [function (module) {
      _inheritsLoose = module.inheritsLoose;
      _createForOfIteratorHelperLoose = module.createForOfIteratorHelperLoose;
    }, function (module) {
      cclegacy = module.cclegacy;
      _decorator = module._decorator;
      Component = module.Component;
    }, function (module) {
      a7Lines = module.a7Lines;
      A7_MARKER = module.A7_MARKER;
    }],
    execute: function () {
      var _dec, _class;
      cclegacy._RF.push({}, "a593aDWLeVCMpCXeg3boMJD", "A7Probe", undefined);
      var ccclass = _decorator.ccclass;

      /**
       * A7 layering probe. Drop this on any node in the scene, build, and compare the
       * devtools console against `pnpm a7`. Delete once A7 is signed off.
       */
      var A7Probe = exports('A7Probe', (_dec = ccclass('A7Probe'), _dec(_class = /*#__PURE__*/function (_Component) {
        _inheritsLoose(A7Probe, _Component);
        function A7Probe() {
          return _Component.apply(this, arguments) || this;
        }
        var _proto = A7Probe.prototype;
        _proto.start = function start() {
          for (var _iterator = _createForOfIteratorHelperLoose(a7Lines()), _step; !(_step = _iterator()).done;) {
            var line = _step.value;
            console.log(line);
          }
          console.log(A7_MARKER + " DONE");
        };
        return A7Probe;
      }(Component)) || _class));
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/Bubble.ts", ['cc'], function (exports) {
  var cclegacy, Vec3, Node, UITransform, Sprite, Label, Color;
  return {
    setters: [function (module) {
      cclegacy = module.cclegacy;
      Vec3 = module.Vec3;
      Node = module.Node;
      UITransform = module.UITransform;
      Sprite = module.Sprite;
      Label = module.Label;
      Color = module.Color;
    }],
    execute: function () {
      cclegacy._RF.push({}, "8cfacIzIkxNppjsOFyBtXR2", "Bubble", undefined);
      var ICON = 44;
      var GAP = 4;
      /** Keeps an edge-pinned bubble's icons and caption fully on screen */
      var EDGE = 60;

      /**
       * A HUD chip pinned over a 3D point: a row of icons with an optional caption under it.
       * Redraws only when `key` changes — Label.string relayouts on every assignment, and a numeric
       * key keeps the per-frame check allocation-free.
       */
      var Bubble = exports('Bubble', /*#__PURE__*/function () {
        function Bubble(parent, name, maxIcons) {
          this.node = void 0;
          this.icons = [];
          this.label = void 0;
          this.key = -1;
          this.world = new Vec3();
          this.ui = new Vec3();
          this.node = new Node(name);
          this.node.layer = parent.layer;
          parent.addChild(this.node);
          for (var i = 0; i < maxIcons; i++) {
            var n = new Node("Icon_" + i);
            n.layer = parent.layer;
            this.node.addChild(n);
            n.addComponent(UITransform).setContentSize(ICON, ICON);
            var s = n.addComponent(Sprite);
            s.sizeMode = Sprite.SizeMode.CUSTOM;
            n.active = false;
            this.icons.push(s);
          }
          var t = new Node('Caption');
          t.layer = parent.layer;
          this.node.addChild(t);
          t.setPosition(0, -ICON / 2 - 14, 0);
          this.label = t.addComponent(Label);
          this.label.fontSize = 22;
          this.label.lineHeight = 24;
          this.label.enableOutline = true;
          this.label.outlineWidth = 3;
          this.label.outlineColor = Color.BLACK;
          this.node.active = false;
        }

        /** `frames[0..count)` are drawn left to right; `text` may be empty. Returns whether it redrew. */
        var _proto = Bubble.prototype;
        _proto.show = function show(key, frames, count, text, color) {
          if (!this.node.active) this.node.active = true;
          if (key === this.key) return false;
          this.key = key;
          var n = Math.min(count, this.icons.length);
          var x0 = -((n - 1) * (ICON + GAP)) / 2;
          for (var i = 0; i < this.icons.length; i++) {
            var _frames$i;
            var s = this.icons[i];
            var on = i < n;
            s.node.active = on;
            if (!on) continue;
            s.spriteFrame = (_frames$i = frames[i]) != null ? _frames$i : null;
            s.node.setPosition(x0 + i * (ICON + GAP), 0, 0);
          }
          this.label.string = text;
          this.label.color = color;
          return true;
        };
        _proto.hide = function hide() {
          if (this.node.active) this.node.active = false;
          this.key = -1;
        }

        /** Pinned inside ±halfW/±halfH (canvas units) so an off-screen station still shows its state at the edge. */;
        _proto.follow = function follow(cam, x, y, z, halfW, halfH) {
          if (halfW === void 0) {
            halfW = Infinity;
          }
          if (halfH === void 0) {
            halfH = Infinity;
          }
          this.world.set(x, y, z);
          cam.convertToUINode(this.world, this.node.parent, this.ui);
          var mx = halfW - EDGE;
          var my = halfH - EDGE;
          this.ui.x = Math.max(-mx, Math.min(mx, this.ui.x));
          this.ui.y = Math.max(-my, Math.min(my, this.ui.y));
          this.node.setPosition(this.ui);
        };
        return Bubble;
      }());
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/BurgerStack.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc'], function (exports) {
  var _createForOfIteratorHelperLoose, cclegacy, Color, Node, instantiate, Vec3, MeshRenderer;
  return {
    setters: [function (module) {
      _createForOfIteratorHelperLoose = module.createForOfIteratorHelperLoose;
    }, function (module) {
      cclegacy = module.cclegacy;
      Color = module.Color;
      Node = module.Node;
      instantiate = module.instantiate;
      Vec3 = module.Vec3;
      MeshRenderer = module.MeshRenderer;
    }],
    execute: function () {
      cclegacy._RF.push({}, "09d2bB/NMJKNr6ndukf9a/3", "BurgerStack", undefined);

      /** Scene nodes cloned as layer art; the stack squashes each into a disc, so any food model works */

      var D = 0.3;
      var PLATE_H = 0.025;
      var BUN_H = 0.06;
      /** onion / pickle / bacon have no model yet: a recoloured stand-in */
      var LAYERS = {
        patty: {
          art: 'meat',
          h: 0.05
        },
        cheese: {
          art: 'cheese',
          h: 0.015
        },
        lettuce: {
          art: 'cabbage',
          h: 0.02
        },
        tomato: {
          art: 'tomato',
          h: 0.02
        },
        onion: {
          art: 'plate',
          h: 0.015,
          tint: new Color(235, 215, 240, 255)
        },
        pickle: {
          art: 'cabbage',
          h: 0.012,
          tint: new Color(90, 130, 50, 255)
        },
        bacon: {
          art: 'meat',
          h: 0.015,
          tint: new Color(190, 90, 80, 255)
        }
      };
      var COOK_TINT = {
        raw: new Color(255, 255, 255, 255),
        rare: new Color(210, 130, 115, 255),
        medium: new Color(160, 95, 65, 255),
        well: new Color(115, 72, 48, 255),
        burnt: new Color(45, 36, 32, 255)
      };

      /** The burger as a 3D stack: plate, bottom bun, toppings in the order they went on, top bun */
      var BurgerStack = exports('BurgerStack', /*#__PURE__*/function () {
        function BurgerStack(parent, art) {
          this.node = void 0;
          this.plate = void 0;
          this.bottom = void 0;
          this.top = void 0;
          this.layers = new Map();
          this.patty2 = void 0;
          this.key = '';
          this.node = new Node('BurgerStack');
          this.node.layer = art.bread.layer;
          parent.addChild(this.node);
          this.plate = this.layer(art.plate, D * 1.4, PLATE_H);
          this.bottom = this.layer(art.bread, D, BUN_H * 0.8);
          this.top = this.layer(art.bread, D, BUN_H);
          for (var _i = 0, _arr = Object.entries(LAYERS); _i < _arr.length; _i++) {
            var _arr$_i = _arr[_i],
              ing = _arr$_i[0],
              s = _arr$_i[1];
            var n = this.layer(art[s.art], ing === 'patty' ? D * 0.95 : D * 1.05, s.h);
            if (s.tint) tint(n, s.tint);
            this.layers.set(ing, n);
          }
          this.patty2 = this.layer(art.meat, D * 0.95, LAYERS.patty.h);
          this.node.active = false;
        }
        var _proto = BurgerStack.prototype;
        _proto.hide = function hide() {
          this.node.active = false;
        };
        _proto.show = function show(b, plated, x, y, z) {
          this.node.active = true;
          this.node.setPosition(x, y, z);
          var ings = b.ingredients;
          var cook = b.cook;
          var key = ings.join() + "|" + cook + "|" + (b["double"] ? b.cook2 : '-') + "|" + plated;
          if (key === this.key) return;
          this.key = key;
          for (var _iterator = _createForOfIteratorHelperLoose(this.node.children), _step; !(_step = _iterator()).done;) {
            var n = _step.value;
            n.active = false;
          }
          var h = 0;
          var put = function put(n, dy) {
            n.active = true;
            n.setPosition(n.position.x, h, n.position.z);
            h += dy;
          };
          if (plated) put(this.plate, PLATE_H);
          var bun = ings.includes('bun');
          if (bun) put(this.bottom, BUN_H * 0.8);
          for (var _iterator2 = _createForOfIteratorHelperLoose(ings), _step2; !(_step2 = _iterator2()).done;) {
            var ing = _step2.value;
            if (ing === 'bun') continue;
            var s = LAYERS[ing];
            if (ing === 'patty' && cook) tint(this.layers.get(ing), COOK_TINT[cook]);
            put(this.layers.get(ing), s.h);
            if (ing === 'patty' && b["double"]) {
              if (b.cook2) tint(this.patty2, COOK_TINT[b.cook2]);
              put(this.patty2, s.h);
            }
          }
          if (bun) put(this.top, BUN_H);
        }

        /** A clone of `src` scaled to a w × h × w box whose bottom sits on y = 0 */;
        _proto.layer = function layer(src, w, h) {
          var holder = new Node(src.name);
          holder.layer = this.node.layer;
          this.node.addChild(holder);
          var art = instantiate(src);
          holder.addChild(art);
          art.setRotationFromEuler(0, 0, 0);
          art.setScale(1, 1, 1);
          art.setPosition(0, 0, 0);
          var lo = new Vec3(Infinity, Infinity, Infinity);
          var hi = new Vec3(-Infinity, -Infinity, -Infinity);
          // Kenney glbs nest one untransformed-or-offset mesh node; rotation inside is not expected
          for (var _iterator3 = _createForOfIteratorHelperLoose(art.getComponentsInChildren(MeshRenderer)), _step3; !(_step3 = _iterator3()).done;) {
            var _mr$mesh;
            var mr = _step3.value;
            var st = (_mr$mesh = mr.mesh) == null ? void 0 : _mr$mesh.struct;
            if (!(st != null && st.minPosition) || !st.maxPosition) continue;
            var p = mr.node === art ? Vec3.ZERO : mr.node.position;
            var k = mr.node === art ? Vec3.ONE : mr.node.scale;
            lo.set(Math.min(lo.x, p.x + st.minPosition.x * k.x), Math.min(lo.y, p.y + st.minPosition.y * k.y), Math.min(lo.z, p.z + st.minPosition.z * k.z));
            hi.set(Math.max(hi.x, p.x + st.maxPosition.x * k.x), Math.max(hi.y, p.y + st.maxPosition.y * k.y), Math.max(hi.z, p.z + st.maxPosition.z * k.z));
          }
          if (lo.x === Infinity) return holder;
          var sx = w / Math.max(1e-4, hi.x - lo.x);
          var sy = h / Math.max(1e-4, hi.y - lo.y);
          var sz = w / Math.max(1e-4, hi.z - lo.z);
          art.setScale(sx, sy, sz);
          art.setPosition(-((lo.x + hi.x) / 2) * sx, -lo.y * sy, -((lo.z + hi.z) / 2) * sz);
          return holder;
        };
        return BurgerStack;
      }());
      function tint(n, c) {
        for (var _iterator4 = _createForOfIteratorHelperLoose(n.getComponentsInChildren(MeshRenderer)), _step4; !(_step4 = _iterator4()).done;) {
          var mr = _step4.value;
          for (var i = 0; i < mr.sharedMaterials.length; i++) {
            var _mr$getMaterialInstan;
            (_mr$getMaterialInstan = mr.getMaterialInstance(i)) == null || _mr$getMaterialInstan.setProperty('mainColor', c);
          }
        }
      }
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/camera.ts", ['cc'], function (exports) {
  var cclegacy;
  return {
    setters: [function (module) {
      cclegacy = module.cclegacy;
    }],
    execute: function () {
      exports({
        effectiveOrthoHeight: effectiveOrthoHeight,
        focusBounds: focusBounds,
        focusForPlayer: focusForPlayer,
        hidesPoint: hidesPoint
      });
      cclegacy._RF.push({}, "7cd81KPQ45JXIwY5ysawA8R", "camera", undefined);
      /**
       * 相机跟随：玩家世界坐标 → 相机注视点。零 Cocos 依赖（铁律①）。
       *
       * 钳制发生在**相机视图坐标** (u, v) 里，不是世界 (x, z) 里。相机 yaw −45，
       * 画面的水平/垂直两条轴在世界里是斜的，用世界 AABB 夹 focus 表达不了
       * 「这一维装得下所以别动、那一维装不下所以跟住」—— 而这正是这套场景需要的。
       *
       * 可行域**必须运行时按屏幕比例算**，不能写成常量：4:3 的画面比 20:9 窄一半，
       * 同一套边界在宽屏上是「水平不动」，在窄屏上会把玩家夹出画面外（`pnpm cam` 验过）。
       */
      /** 相机相对 focus 的位置偏移，米。出处：main.scene 的 Main Camera _lpos（focus 在原点） */
      var CAMERA_OFFSET = exports('CAMERA_OFFSET', {
        x: -10.447,
        y: 10.505,
        z: 10.391
      });

      /** 画面右 / 画面上，世界单位向量。由 Main Camera 的 _lrot 算出，`pnpm cam` 会复算比对 */
      var CAMERA_RIGHT = exports('CAMERA_RIGHT', {
        x: 0.707107,
        y: 0,
        z: 0.707107
      });
      var CAMERA_UP = exports('CAMERA_UP', {
        x: 0.40558,
        y: 0.819152,
        z: -0.40558
      });

      /** 世界 (x,z) → 视图 (u,v)。u = (x+z)·UK，v = (x−z)·VK —— 成立的前提是相机 roll = 0 */
      var UK = exports('UK', CAMERA_RIGHT.x);
      var VK = exports('VK', CAMERA_UP.x);

      /** 正交半高，米。`pnpm cam` 的产物 */
      var ORTHO_HEIGHT = exports('ORTHO_HEIGHT', 3.0);
      /**
       * 场景内容（地板 + 东翼 + 库房 + 顾客区 + 外墙，含墙高）在视图坐标里的跨度 —— 跟随的边界。
       * 常量而非现算：logic/ 读不到场景。`pnpm cam` 从 scene-spec 复算并比对，改了场景这里会红。
       */
      var CONTENT_SPAN = exports('CONTENT_SPAN', {
        umin: -5.1619,
        umax: 9.6874,
        vmin: -4.1377,
        vmax: 8.9022
      });

      /**
       * 主厨房（Floor + 顾客区）的跨度 —— 只决定窄屏要不要拉远。
       * 按整个场景算的话，东翼一加宽，普通手机也会被拉远。
       */
      var CORE_SPAN = exports('CORE_SPAN', {
        umin: -4.9497,
        umax: 7.0711,
        vmin: -4.1377,
        vmax: 2.8391
      });
      var clamp = function clamp(x, lo, hi) {
        return x < lo ? lo : x > hi ? hi : x;
      };

      /**
       * 玩家身体离画面边缘的最小距离，米。贴着边走看不见前方。
       * 也是下面那条兜底的余量 —— 画面宽刚好等于场景宽时，水平跟随区间只剩几十厘米，
       * 跟着走反而把玩家顶到边上（实测 0.21m）。
       */
      var EDGE_MARGIN = exports('EDGE_MARGIN', 0.3);

      /**
       * 实际用的半高。屏幕越接近方形，同样的半高给出的画面越窄 —— 窄到装不下场景时
       * 水平跟随的幅度会把烤炉甩出画面（4:3 实测 41% 的位置看不见它）。
       * 那种比例下退回全景：半高抬到画面宽 ≥ 场景宽 + 两边余量，水平方向就此不动。
       */
      function effectiveOrthoHeight(aspect, content) {
        if (content === void 0) {
          content = CORE_SPAN;
        }
        var need = (content.umax - content.umin + 2 * EDGE_MARGIN) / (2 * aspect);
        return need > ORTHO_HEIGHT ? need : ORTHO_HEIGHT;
      }

      /**
       * focus 的可行域：让画面尽量留在内容里。
       * 某一维内容比画面还窄时区间会反转 —— 取中点，即那一维不跟随（动了只会露背景色）。
       */
      function focusBounds(orthoHeight, aspect, content) {
        if (content === void 0) {
          content = CONTENT_SPAN;
        }
        var halfU = aspect * orthoHeight;
        // Overshoot by the margin: a player hugging the outermost corner still gets breathing room,
        // and what shows past the content is Floor_Outer, not background.
        var ulo = content.umin - EDGE_MARGIN + halfU;
        var uhi = content.umax + EDGE_MARGIN - halfU;
        var vlo = content.vmin - EDGE_MARGIN + orthoHeight;
        var vhi = content.vmax + EDGE_MARGIN - orthoHeight;
        var um = (ulo + uhi) / 2;
        var vm = (vlo + vhi) / 2;
        return {
          umin: ulo > uhi ? um : ulo,
          umax: ulo > uhi ? um : uhi,
          vmin: vlo > vhi ? vm : vlo,
          vmax: vlo > vhi ? vm : vhi
        };
      }

      /**
       * 玩家位置 → 相机注视点（世界地面坐标）。组件每帧拿它 + CAMERA_OFFSET 写相机节点。
       * 不分配（铁律②）。
       */
      function focusForPlayer(out, p, b) {
        var u = clamp((p.x + p.z) * UK, b.umin, b.umax) / UK;
        var v = clamp((p.x - p.z) * VK, b.vmin, b.vmax) / VK;
        out.x = (u + v) / 2;
        out.z = (u - v) / 2;
      }

      /** World-space box, metres */

      /**
       * Does the box stand between the point and the camera? The camera is orthographic, so every
       * sight line runs parallel to CAMERA_OFFSET — no camera position needed. Slab test on the ray.
       */
      function hidesPoint(b, x, y, z, dir) {
        if (dir === void 0) {
          dir = CAMERA_OFFSET;
        }
        var t0 = 0;
        var t1 = Infinity;
        var o = [x, y, z];
        var d = [dir.x, dir.y, dir.z];
        var lo = [b.minX, b.minY, b.minZ];
        var hi = [b.maxX, b.maxY, b.maxZ];
        for (var i = 0; i < 3; i++) {
          if (Math.abs(d[i]) < 1e-9) {
            if (o[i] < lo[i] || o[i] > hi[i]) return false;
            continue;
          }
          var a = (lo[i] - o[i]) / d[i];
          var c = (hi[i] - o[i]) / d[i];
          if (a > c) {
            var _ref = [c, a];
            a = _ref[0];
            c = _ref[1];
          }
          t0 = Math.max(t0, a);
          t1 = Math.min(t1, c);
          if (t0 > t1) return false;
        }
        return true;
      }
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/cardLines.ts", ['cc'], function (exports) {
  var cclegacy;
  return {
    setters: [function (module) {
      cclegacy = module.cclegacy;
    }],
    execute: function () {
      cclegacy._RF.push({}, "a72393INepB1ZlyiR58EkM2", "cardLines", undefined); // Generated by `pnpm cards:export` from pipeline/handwritten/cards.json — do not edit.
      var CARD_LINES = exports('CARD_LINES', [{
        "identity": "选秀练习生",
        "wait_nudge": "第几步了？我忘了",
        "praise": "使用说明记录：本次操作完全符合第三页要求。我把它写进了本子",
        "complain": "故障报告：产品与说明书不符。也可能是我又记错了页码"
      }, {
        "identity": "相声演员",
        "wait_nudge": "他在等待，很煎熬",
        "praise": "赛后采访：他说很好吃，但说得很小声，采访只进行了四秒",
        "complain": "本场失误：他全程没敢指出问题，走到门口才小声说了句"
      }, {
        "identity": "捧哏的",
        "wait_nudge": "时光慢些，无妨",
        "praise": "清淡而有味，食毕忽觉腰围可容一指。此店可再来",
        "complain": "油重矣。吾三月之功，一餐尽废，然亦怪吾自己"
      }, {
        "identity": "高中班主任",
        "wait_nudge": "上课铃要响了",
        "praise": "这顿吃得明明白白，钱花在刀刃上。给你记个平时分",
        "complain": "超支了。我教了二十年书，没见过这么贵的一顿饭"
      }, {
        "identity": "小学生",
        "wait_nudge": "还有三秒，倒计时",
        "praise": "八样一样不少，五分熟不多不少。这家我给满分，上链接",
        "complain": "少了一样。我数过三遍。这条视频我会发出去"
      }, {
        "identity": "练习生",
        "wait_nudge": "不急……慢慢来",
        "praise": "全熟的……很安心呢。老板你气色也变好了……真的",
        "complain": "有点油……不过没关系……我明天多喝点热水就好"
      }, {
        "identity": "退役运动员",
        "wait_nudge": "还要多久？很久吗？",
        "praise": "这算干净吧？是不是很干净？我能再来一次吗？可以吗？",
        "complain": "这就是你说的干净？你自己看看？你敢吃吗？真的吗？"
      }, {
        "identity": "饲养员",
        "wait_nudge": "第几步来着",
        "praise": "步骤正确。已归档。明天我大概会忘记，但今天记得",
        "complain": "配方不符。我核对了三次。也可能核对的是别人的单子"
      }, {
        "identity": "健身教练",
        "wait_nudge": "逾期视为违约",
        "praise": "履约完毕。附则：这是我离婚后吃得最干净的一顿。谢谢",
        "complain": "第三条已违约。补充说明：她走的那天也是这样的番茄"
      }, {
        "identity": "唐朝人",
        "wait_nudge": "他不敢催，只看",
        "praise": "他吃完，郑重行了一礼。他说这是他来此千年最好的一餐",
        "complain": "他没说什么。他只是把碗推远了一点，然后说是他的错"
      }, {
        "identity": "练习生乙",
        "wait_nudge": "宽限期可延长",
        "praise": "合同履行完毕。备注：这是我本周唯一按时完成的事项",
        "complain": "条款不符。我保留追究的权利，但大概率不会去追究"
      }, {
        "identity": "剧组场务",
        "wait_nudge": "别慌……慢慢来",
        "praise": "做得对……我教过的人里你算快的。下次记得先切番茄",
        "complain": "你看……我早说了……不过没关系，年轻人都要交学费"
      }, {
        "identity": "深夜代驾",
        "wait_nudge": "他看了眼表，笑",
        "praise": "他说这是他今晚第七单，也是唯一一个让他想坐下来的地方",
        "complain": "他没生气。他只是说，差一点点的东西他这辈子见太多了"
      }, {
        "identity": "家用机器人",
        "wait_nudge": "等呀等，两拍子",
        "praise": "四四方方两两对，吃完电量一百分，明天还要来两次",
        "complain": "单数了单数了！我的齿轮转得不整齐了，好难受呀"
      }, {
        "identity": "扫地机器人",
        "wait_nudge": "预计到达时间？",
        "praise": "已到达目的地。本次行程零偏离，对称度百分之百",
        "complain": "路线偏离。正在重新规划。数量不是偶数，我很不安"
      }, {
        "identity": "探店博主",
        "wait_nudge": "从前上菜快些",
        "praise": "有那个味了。这条我发出去，但我不会说是哪家",
        "complain": "不是这个味。你们这代人不懂，从前不是这么做的"
      }, {
        "identity": "幼儿园老师",
        "wait_nudge": "还有几秒？几秒？",
        "praise": "三分钟拿到手，这个速度我给满分。孩子们还在等我",
        "complain": "太慢了。等你这一个汉堡，我班上二十个孩子已经醒了"
      }, {
        "identity": "外星交换生",
        "wait_nudge": "吉时将至！速速！",
        "praise": "六样齐备，吉星高照。本台宣布此店为地球最佳觅食点",
        "complain": "凶！数目不对。今晚我的飞船大概率发动不了了"
      }, {
        "identity": "快递分拣员",
        "wait_nudge": "在途中 停 无妨",
        "praise": "包裹完好 停 左右对称 停 我在梦里也这样摆过 停",
        "complain": "破损件 停 数目不齐 停 我今晚大概会梦见它 停"
      }, {
        "identity": "分拣员小陈",
        "wait_nudge": "亲还在排队吗？",
        "praise": "亲，本次服务五星好评呢。今晚我应该能睡个安稳觉了",
        "complain": "亲，这个真的不行呢。数目不对，我今晚会失眠的"
      }, {
        "identity": "三年级学生",
        "wait_nudge": "今天等了很久",
        "praise": "今天很干净。妈妈走了以后，这是我第一次不用洗两次手",
        "complain": "今天弄脏了。我没有哭。我只是不想再来这家店了"
      }, {
        "identity": "代驾老周",
        "wait_nudge": "他不催，全场安静",
        "praise": "全场起立！他说这是他今晚最不用道歉的一件事",
        "complain": "他摇头示意无碍。慢镜头显示，他其实想说的是别的"
      }, {
        "identity": "大班李老师",
        "wait_nudge": "还有多久，说",
        "praise": "营养均衡，火候到位。这个我可以拿去给孩子们做示范",
        "complain": "不合格。我会把这份汉堡拍下来，当反面教材用"
      }, {
        "identity": "图书管理员",
        "wait_nudge": "此番等候，亦记",
        "praise": "今日无过。前事既往，吾自当销去那一页记录",
        "complain": "又是此二物。吾已记在册上第三行，与上回同"
      }, {
        "identity": "夜班分拣员",
        "wait_nudge": "我等多久了？久吗？",
        "praise": "这是我点的吗？挺好的？我下次还会来吗？会吧？",
        "complain": "我说过不要生菜吧？说过吧？还是我又忘了说？是吗？"
      }]);
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/collision.ts", ['cc'], function (exports) {
  var cclegacy;
  return {
    setters: [function (module) {
      cclegacy = module.cclegacy;
    }],
    execute: function () {
      exports({
        circleOverlapsAABB: circleOverlapsAABB,
        circleOverlapsCircle: circleOverlapsCircle,
        closestPointOnAABB: closestPointOnAABB,
        inTriggerRange: inTriggerRange,
        resolveCircleAABB: resolveCircleAABB
      });
      cclegacy._RF.push({}, "301e8V+14ZB2L2JIw05cEL7", "collision", undefined);
      /**
       * 手写碰撞 —— 不引入物理引擎（ROADMAP §1「轻 3D」的精确落点）。
       *
       * Cocos 的 ammo 物理模块 wasm 约 1.2MB / js 约 0.7MB，对 4MB 主包是一大块；
       * 而这个游戏需要的全部碰撞就是「角色别穿过灶台」和「角色进入工位触发范围」。
       * 放在这一层的额外收益：「角色卡在灶台里」这类 bug 也能写成单测。
       *
       * 全部函数零分配（out 参数写回 + 局部 number），见 vec2.ts 顶部说明。
       */
      /** 轴对齐包围盒。用 center + 半宽半深，对应编辑器里工位方块的 position + size/2。 */
      /**
       * 推出后额外留的余量。
       * 不留的话推出结果刚好落在「距离 == radius」上，浮点误差会让下一帧的重叠判定
       * 时真时假，表现为角色贴着灶台边抖动。
       */
      var SKIN = 1e-6;
      function clamp(v, lo, hi) {
        return v < lo ? lo : v > hi ? hi : v;
      }

      /** 盒面上离 p 最近的点。p 在盒内时返回 p 自己。 */
      function closestPointOnAABB(out, p, box) {
        out.x = clamp(p.x, box.center.x - box.halfX, box.center.x + box.halfX);
        out.z = clamp(p.z, box.center.z - box.halfZ, box.center.z + box.halfZ);
        return out;
      }

      /**
       * 圆与盒是否重叠（相切不算）。
       *
       * 走「到最近点的距离」而不是分轴比较 —— 后者在盒的斜角外会误判，
       * 表现是角色在灶台斜角外被无形的墙挡住。
       */
      function circleOverlapsAABB(pos, radius, box) {
        var cx = clamp(pos.x, box.center.x - box.halfX, box.center.x + box.halfX);
        var cz = clamp(pos.z, box.center.z - box.halfZ, box.center.z + box.halfZ);
        var dx = pos.x - cx;
        var dz = pos.z - cz;
        return dx * dx + dz * dz < radius * radius;
      }

      /** 圆与圆是否重叠（相切不算）。角色之间、角色与顾客用。 */
      function circleOverlapsCircle(a, ra, b, rb) {
        var dx = a.x - b.x;
        var dz = a.z - b.z;
        var r = ra + rb;
        return dx * dx + dz * dz < r * r;
      }

      /**
       * 把圆推出盒子，结果写进 out；没重叠则原样写回并返回 false。
       *
       * out 可以就是 pos 本身（原地解算）—— 分量先取进局部变量再写回。
       */
      function resolveCircleAABB(out, pos, radius, box) {
        var px = pos.x;
        var pz = pos.z;
        var minX = box.center.x - box.halfX;
        var maxX = box.center.x + box.halfX;
        var minZ = box.center.z - box.halfZ;
        var maxZ = box.center.z + box.halfZ;
        var cx = clamp(px, minX, maxX);
        var cz = clamp(pz, minZ, maxZ);

        // 圆心在盒外：沿「最近点 → 圆心」这个方向推到刚好不接触
        if (cx !== px || cz !== pz) {
          var dx = px - cx;
          var dz = pz - cz;
          var d2 = dx * dx + dz * dz;
          if (d2 >= radius * radius) {
            out.x = px;
            out.z = pz;
            return false;
          }
          var k = (radius + SKIN) / Math.sqrt(d2);
          out.x = cx + dx * k;
          out.z = cz + dz * k;
          return true;
        }

        // 圆心陷在盒内：没有可用的方向向量（那会是零向量 → NaN），改推向最近的那条边
        var toRight = maxX - px;
        var toLeft = px - minX;
        var toFar = maxZ - pz;
        var toNear = pz - minZ;
        var best = toRight;
        var bx = maxX + radius + SKIN;
        var bz = pz;
        if (toLeft < best) {
          best = toLeft;
          bx = minX - radius - SKIN;
          bz = pz;
        }
        if (toFar < best) {
          best = toFar;
          bx = px;
          bz = maxZ + radius + SKIN;
        }
        if (toNear < best) {
          bx = px;
          bz = minZ - radius - SKIN;
        }
        out.x = bx;
        out.z = bz;
        return true;
      }

      /**
       * 角色够不够得着工位。边界上算够得着 —— 与碰撞的严格不等号相反：
       * 碰撞判「有没有插进去」，触发判「够不够得着」，两者的边界语义本来就不同。
       */
      function inTriggerRange(pos, target, range) {
        var dx = pos.x - target.x;
        var dz = pos.z - target.z;
        return dx * dx + dz * dz <= range * range;
      }
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/Controls.ts", ['cc', './Feel.ts'], function (exports) {
  var cclegacy, Graphics, Color, Node, UITransform, Sprite, Label, pop, pressTo;
  return {
    setters: [function (module) {
      cclegacy = module.cclegacy;
      Graphics = module.Graphics;
      Color = module.Color;
      Node = module.Node;
      UITransform = module.UITransform;
      Sprite = module.Sprite;
      Label = module.Label;
    }, function (module) {
      pop = module.pop;
      pressTo = module.pressTo;
    }],
    execute: function () {
      cclegacy._RF.push({}, "f029510fUFFBZrSI4I5CuR7", "Controls", undefined);
      var STICK_R = 90;
      var KNOB_R = 36;
      var KNOB_TRAVEL = 54;
      var ACTION_R = 78;
      var DISCARD_R = 58;
      function art(host) {
        // A node can hold one renderer, and the host already has its placeholder Sprite
        host.getComponent(Sprite).enabled = false;
        var n = new Node('Art');
        n.layer = host.layer;
        host.addChild(n);
        n.addComponent(UITransform);
        return n.addComponent(Graphics);
      }
      function label(host, size, y) {
        if (y === void 0) {
          y = 0;
        }
        var n = new Node('Glyph');
        n.layer = host.layer;
        host.addChild(n);
        n.setPosition(0, y, 0);
        var l = n.addComponent(Label);
        l.fontSize = size;
        l.lineHeight = size + 4;
        l.enableOutline = true;
        l.outlineWidth = 2;
        l.outlineColor = new Color(0, 0, 0, 160);
        return l;
      }

      /** Draws the on-screen controls over the scene's placeholder nodes; layout stays with the scene's Widgets */
      var Controls = exports('Controls', /*#__PURE__*/function () {
        function Controls(joystick, action, discard) {
          this.knob = void 0;
          this.actionNode = void 0;
          this.actionText = void 0;
          this.actionShown = "\0";
          this.pressed = false;
          var g = art(joystick);
          g.fillColor = new Color(0, 0, 0, 80);
          g.circle(0, 0, STICK_R);
          g.fill();
          g.lineWidth = 4;
          g.strokeColor = new Color(255, 255, 255, 120);
          g.circle(0, 0, STICK_R - 2);
          g.stroke();
          this.knob = new Node('Knob');
          this.knob.layer = joystick.layer;
          joystick.addChild(this.knob);
          this.knob.addComponent(UITransform);
          var k = this.knob.addComponent(Graphics);
          k.fillColor = new Color(255, 255, 255, 210);
          k.circle(0, 0, KNOB_R);
          k.fill();
          var a = art(action);
          a.fillColor = new Color(255, 255, 255, 60);
          a.circle(0, 0, ACTION_R);
          a.fill();
          a.lineWidth = 5;
          a.strokeColor = new Color(255, 255, 255, 170);
          a.circle(0, 0, ACTION_R - 3);
          a.stroke();
          this.actionNode = action;
          this.actionText = label(action, 34);
          var d = art(discard);
          d.fillColor = new Color(200, 60, 50, 220);
          d.circle(0, 0, DISCARD_R);
          d.fill();
          label(discard, 40, 8).string = '🗑';
          label(discard, 18, -30).string = '长按丢弃';
        }

        /** Stick direction is screen space, y up; magnitude 0–1 */
        var _proto = Controls.prototype;
        _proto.syncStick = function syncStick(dirX, dirY, magnitude) {
          this.knob.setPosition(dirX * magnitude * KNOB_TRAVEL, dirY * magnitude * KNOB_TRAVEL, 0);
        }

        /** What the action key would do right now; empty = nothing in reach */;
        _proto.setAction = function setAction(text) {
          if (text === this.actionShown) return;
          this.actionShown = text;
          this.actionText.string = text || '·';
          if (text) pop(this.actionText.node);
        };
        _proto.setPressed = function setPressed(down) {
          if (down === this.pressed) return;
          this.pressed = down;
          pressTo(this.actionNode, down);
        };
        return Controls;
      }());
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/customer.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc', './order.ts', './rng.ts', './types.ts'], function (exports) {
  var _createForOfIteratorHelperLoose, cclegacy, judge, nextInt, chance, DONENESS;
  return {
    setters: [function (module) {
      _createForOfIteratorHelperLoose = module.createForOfIteratorHelperLoose;
    }, function (module) {
      cclegacy = module.cclegacy;
    }, function (module) {
      judge = module.judge;
    }, function (module) {
      nextInt = module.nextInt;
      chance = module.chance;
    }, function (module) {
      DONENESS = module.DONENESS;
    }],
    execute: function () {
      exports({
        closeShop: closeShop,
        createCustomerFlow: createCustomerFlow,
        matchCustomer: matchCustomer,
        matchFries: matchFries,
        matchSide: matchSide,
        moodTier: moodTier,
        orderPatienceLeft: orderPatienceLeft,
        patienceRatio: patienceRatio,
        queueIndex: queueIndex,
        releaseCustomer: releaseCustomer,
        resetCustomerFlow: resetCustomerFlow,
        rollSpec: rollSpec,
        stepCustomerFlow: stepCustomerFlow,
        takeNextOrder: takeNextOrder,
        takeReadyOrders: takeReadyOrders
      });
      cclegacy._RF.push({}, "48aa1RqCO9AKIdiJmnGcefm", "customer", undefined);
      /** ⏳ Self-chosen: double orders show up from this day, this often */
      var DOUBLE_FROM_DAY = exports('DOUBLE_FROM_DAY', 4);
      var DOUBLE_CHANCE = exports('DOUBLE_CHANCE', 0.25);
      /** bun/patty 之外可点的。顺序是洗牌池的初始顺序，改它会改变同 seed 下的出题 */
      var OPTIONAL = exports('OPTIONAL', ['cheese', 'lettuce', 'tomato', 'onion', 'pickle', 'bacon']);
      function createCustomerFlow(flow, orders, rng) {
        var st = {
          customers: [],
          activeCount: 0,
          nextArrivalAt: 0,
          nextId: 1,
          arrived: 0,
          timedOut: 0,
          walkedOut: 0,
          leftLate: 0,
          peakConcurrent: 0,
          flow: flow,
          orders: orders,
          rng: rng,
          pool: OPTIONAL.slice()
        };
        resetCustomerFlow(st, flow, orders);
        return st;
      }

      /** 重开一局。槽位不释放，只标记为空 */
      function resetCustomerFlow(st, flow, orders) {
        st.flow = flow;
        st.orders = orders;
        while (st.customers.length < flow.maxConcurrent) {
          st.customers.push({
            active: false,
            id: 0,
            patienceLeft: 0,
            patienceMax: 0,
            late: false,
            ordered: false,
            orderWait: 0,
            spec: {
              required: [],
              banned: [],
              doneness: 'medium',
              patience: 0
            },
            friesDue: false,
            drinkDue: false,
            burgerVerdict: null,
            burger: {
              ingredients: [],
              cook: null
            }
          });
        }
        for (var _iterator = _createForOfIteratorHelperLoose(st.customers), _step; !(_step = _iterator()).done;) {
          var _c = _step.value;
          _c.active = false;
        }
        // 洗牌池必须复位：rollOrder 是原地洗的，不还原的话重开一局同一个 seed 出的是另一批单，
        // 而「同 seed 可复现」正是难度标定站得住的前提
        for (var i = 0; i < OPTIONAL.length; i++) st.pool[i] = OPTIONAL[i];
        st.activeCount = 0;
        st.nextArrivalAt = 0;
        st.nextId = 1;
        st.arrived = 0;
        st.timedOut = 0;
        st.walkedOut = 0;
        st.leftLate = 0;
        st.peakConcurrent = 0;
      }
      function rollOrder(st, spec) {
        var _st$orders$friesChanc, _st$orders$doubleChan, _st$orders$drinkChanc;
        rollSpec(st.rng, st.orders, st.pool, st.flow.patienceSec, spec);
        var k = (_st$orders$friesChanc = st.orders.friesChance) != null ? _st$orders$friesChanc : 0;
        spec.fries = k > 0 && chance(st.rng, k);
        // After fries, so a fries-only stream stays as it was
        var kd = (_st$orders$doubleChan = st.orders.doubleChance) != null ? _st$orders$doubleChan : 0;
        spec["double"] = kd > 0 && chance(st.rng, kd);
        var kk = (_st$orders$drinkChanc = st.orders.drinkChance) != null ? _st$orders$drinkChanc : 0;
        spec.drink = kk > 0 && chance(st.rng, kk);
      }

      /**
       * 出一张单，写进 spec。`pool` 是 OPTIONAL 的一份拷贝，原地洗、复用不分配。
       * 外卖用它自己的 rng 和 pool 调这里 —— 不能借顾客流的 rng，否则堂食每一单都错位。
       */
      function rollSpec(rng, d, pool, patienceSec, spec) {
        spec.required.length = 0;
        spec.required.push('bun', 'patty');

        // 部分 Fisher-Yates：洗前 n 个就够，池子复用不分配
        var extras = d.extraMin + nextInt(rng, d.extraMax - d.extraMin + 1);
        for (var i = 0; i < extras && i < pool.length; i++) {
          var j = i + nextInt(rng, pool.length - i);
          var tmp = pool[i];
          pool[i] = pool[j];
          pool[j] = tmp;
          spec.required.push(pool[i]);
        }
        spec.banned.length = 0;
        if (chance(rng, d.bannedChance) && extras < pool.length) {
          // 从没被选进 required 的那部分里挑，保证不相交
          var idx = extras + nextInt(rng, pool.length - extras);
          spec.banned.push(pool[idx]);
        }
        spec.doneness = DONENESS[nextInt(rng, DONENESS.length)];
        spec.patience = patienceSec;
      }

      /** 顾客离店。槽位回到空闲，手上的进度作废 */
      function releaseCustomer(st, c) {
        if (!c.active) return;
        c.active = false;
        c.burger.ingredients.length = 0;
        c.burger.cook = null;
        st.activeCount--;
      }

      /**
       * 一帧。先到达再倒耐心，顺序与 RNG 调用都锁死（见文件头）。
       *
       * `onTimeout` 在顾客被释放**之前**调用 —— 调用方要清掉挂在这位顾客身上的东西
       * （模拟器的烤炉预留、端在手上的那一盘）。
       * `onWalkOut` fires for both kinds of leaving with a grievance: nobody took the order, or late and gave up.
       */
      function stepCustomerFlow(st, t, dt, onTimeout, onArrive, onWalkOut) {
        var cap = st.flow.maxArrivals;
        while (t >= st.nextArrivalAt && st.activeCount < st.flow.maxConcurrent && (cap === undefined || st.arrived < cap)) {
          for (var _iterator2 = _createForOfIteratorHelperLoose(st.customers), _step2; !(_step2 = _iterator2()).done;) {
            var _c2 = _step2.value;
            if (_c2.active) continue;
            _c2.active = true;
            _c2.id = st.nextId++;
            _c2.patienceLeft = st.flow.patienceSec;
            _c2.patienceMax = st.flow.patienceSec;
            _c2.late = false;
            _c2.ordered = st.flow.takeOrder === undefined;
            _c2.orderWait = 0;
            _c2.burger.ingredients.length = 0;
            _c2.burger.cook = null;
            rollOrder(st, _c2.spec);
            _c2.friesDue = _c2.spec.fries === true;
            _c2.drinkDue = _c2.spec.drink === true;
            _c2.burgerVerdict = null;
            st.activeCount++;
            st.arrived++;
            onArrive == null || onArrive(_c2);
            break;
          }
          var jitter = st.flow.intervalJitter;
          var factor = jitter > 0 ? 1 - jitter + nextInt(st.rng, 2001) * (jitter / 1000) : 1;
          st.nextArrivalAt += st.flow.intervalSec * factor;
        }
        if (st.activeCount > st.peakConcurrent) st.peakConcurrent = st.activeCount;
        var take = st.flow.takeOrder;
        for (var _iterator3 = _createForOfIteratorHelperLoose(st.customers), _step3; !(_step3 = _iterator3()).done;) {
          var _c3 = _step3.value;
          if (!_c3.active) continue;
          if (!_c3.ordered) {
            _c3.orderWait += dt;
            if (take && _c3.orderWait >= take.walkInSec + take.patienceSec) {
              st.walkedOut++;
              onWalkOut == null || onWalkOut(_c3);
              releaseCustomer(st, _c3);
            }
            continue;
          }
          _c3.patienceLeft -= dt;
          if (_c3.late) {
            var give = st.flow.lateLeaveSec;
            if (give !== undefined && _c3.patienceLeft <= -give) {
              st.leftLate++;
              onWalkOut == null || onWalkOut(_c3);
              releaseCustomer(st, _c3);
            }
            continue;
          }
          if (_c3.patienceLeft > 0) continue;
          st.timedOut++;
          onTimeout == null || onTimeout(_c3);
          if (st.flow.stayWhenLate) _c3.late = true;else releaseCustomer(st, _c3);
        }
      }

      /** 打烊：在场的一律记超时。`onLeave` 同 stepCustomerFlow 的 onTimeout */
      function closeShop(st, onLeave) {
        for (var _iterator4 = _createForOfIteratorHelperLoose(st.customers), _step4; !(_step4 = _iterator4()).done;) {
          var _c4 = _step4.value;
          if (!_c4.active) continue;
          st.timedOut++;
          onLeave == null || onLeave(_c4);
          releaseCustomer(st, _c4);
        }
      }

      /**
       * 端着这个汉堡走到出餐口，算给了谁。
       *
       * 先找吃得下它的人，找不到就砸在最急的那位头上 —— 玩家看着订单做，做完不该再点一次
       * 「这是给谁的」。**没有匹配也一定要有人接**，否则做错了没有代价，判定形同虚设。
       * 多个都吃得下时给最急的：让玩家先做通用单再做刁钻单是合理策略，不该被惩罚。
       */
      function matchCustomer(st, burger) {
        var _fit;
        var fit = null;
        var urgent = null;
        for (var _iterator5 = _createForOfIteratorHelperLoose(st.customers), _step5; !(_step5 = _iterator5()).done;) {
          var _c5 = _step5.value;
          if (!_c5.active || !_c5.ordered || _c5.burgerVerdict) continue;
          if (!urgent || _c5.patienceLeft < urgent.patienceLeft) urgent = _c5;
          if (!judge(burger, _c5.spec).ok) continue;
          if (!fit || _c5.patienceLeft < fit.patienceLeft) fit = _c5;
        }
        return (_fit = fit) != null ? _fit : urgent;
      }

      /**
       * Fries in hand at the pass: who gets them. Someone already holding their burger first (they are
       * only waiting on this), then the most urgent. Nobody owed fries → null; fries cannot be served wrong.
       */
      function matchFries(st) {
        return matchSide(st, 'fries');
      }
      /** Same rule as matchFries, for any side */
      function matchSide(st, side) {
        var best = null;
        for (var _iterator6 = _createForOfIteratorHelperLoose(st.customers), _step6; !(_step6 = _iterator6()).done;) {
          var _c6 = _step6.value;
          if (!_c6.active || !_c6.ordered || !(side === 'fries' ? _c6.friesDue : _c6.drinkDue)) continue;
          if (!best || (!!_c6.burgerVerdict !== !!best.burgerVerdict ? !!_c6.burgerVerdict : _c6.patienceLeft < best.patienceLeft)) best = _c6;
        }
        return best;
      }

      /** 排队的顺序：没接单的按到店先后。0 = 站在点单台前那位。已接单或不在场返回 -1 */
      function queueIndex(st, c) {
        if (!c.active || c.ordered) return -1;
        var ahead = 0;
        for (var _iterator7 = _createForOfIteratorHelperLoose(st.customers), _step7; !(_step7 = _iterator7()).done;) {
          var o = _step7.value;
          if (o.active && !o.ordered && o.id < c.id) ahead++;
        }
        return ahead;
      }

      /** 等接单还剩几秒；还在走向柜台时返回满值。没开 takeOrder 返回 0 */
      function orderPatienceLeft(st, c) {
        var take = st.flow.takeOrder;
        if (!take) return 0;
        return Math.min(take.patienceSec, take.walkInSec + take.patienceSec - c.orderWait);
      }

      /**
       * 当前那段耐心还剩几成，0–1。没接单时是等接单那段，接了是等餐那段；
       * 走到柜台之前那段不倒计时，算满格。late 为 0。
       */
      function patienceRatio(st, c) {
        if (c.late) return 0;
        if (c.ordered) return c.patienceMax > 0 ? Math.max(0, c.patienceLeft / c.patienceMax) : 0;
        var take = st.flow.takeOrder;
        return take ? Math.max(0, Math.min(1, orderPatienceLeft(st, c) / take.patienceSec)) : 1;
      }
      /** 头顶情绪五档：0 开心 … 4 暴怒（GDD §12.5）。与卡片的 `mood`（人设情绪）无关 */
      function moodTier(st, c) {
        if (c.late) return 4;
        var k = patienceRatio(st, c);
        if (k > 0.75) return 0;
        if (k > 0.5) return 1;
        if (k > 0.25) return 2;
        if (k > 0) return 3;
        return 4;
      }

      /**
       * 在点单台按一下：接排在最前、已经走到柜台的那位的单。接了才开始倒等餐耐心。
       * 没人可接返回 null。
       */
      function takeNextOrder(st) {
        var take = st.flow.takeOrder;
        if (!take) return null;
        var front = null;
        for (var _iterator8 = _createForOfIteratorHelperLoose(st.customers), _step8; !(_step8 = _iterator8()).done;) {
          var _c7 = _step8.value;
          if (_c7.active && !_c7.ordered && (!front || _c7.id < front.id)) front = _c7;
        }
        if (!front || front.orderWait < take.walkInSec) return null;
        front.ordered = true;
        front.patienceLeft = front.patienceMax;
        return front;
      }

      /** 点单台按一下，把已经走到柜台的全接了（按到店先后）。返回接了几位 */
      function takeReadyOrders(st) {
        var n = 0;
        while (takeNextOrder(st)) n++;
        return n;
      }
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/decor.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc'], function (exports) {
  var _createForOfIteratorHelperLoose, cclegacy;
  return {
    setters: [function (module) {
      _createForOfIteratorHelperLoose = module.createForOfIteratorHelperLoose;
    }, function (module) {
      cclegacy = module.cclegacy;
    }],
    execute: function () {
      exports({
        newDecor: newDecor,
        paint: paint,
        parseDecor: parseDecor,
        place: place
      });
      cclegacy._RF.push({}, "817d6N4oN5AYLTFXpt6Po5C", "decor", undefined);
      /**
       * Decoration (ROADMAP batch 6, A tier): fixed slots in the shop, each shows one item or nothing, plus wall / floor
       * colours. Bought on a rest day, kept in the save. Purely cosmetic for now. Zero Cocos (铁律①).
       * ⏳ Slots, items, colours and prices are placeholders until the user's models arrive.
       */
      var DECOR_ITEMS = exports('DECOR_ITEMS', [{
        id: 'plant',
        name: '盆栽',
        price: 60
      }, {
        id: 'plant-small',
        name: '小盆栽',
        price: 50
      }, {
        id: 'bookcase',
        name: '书架',
        price: 100
      }]);
      var DECOR_SLOTS = exports('DECOR_SLOTS', [{
        id: 'wait-left',
        name: '等候区左边',
        allowed: ['plant', 'plant-small'],
        initial: 'plant'
      }, {
        id: 'wait-right',
        name: '等候区右边',
        allowed: ['plant', 'plant-small'],
        initial: 'plant'
      }, {
        id: 'counter',
        name: '出餐台上',
        allowed: ['plant-small'],
        initial: 'plant-small'
      }, {
        id: 'wall-n',
        name: '厨房北墙',
        allowed: ['bookcase', 'plant'],
        initial: null
      }]);
      /** Index 0 = the scene's own material colour */
      var WALL_COLORS = exports('WALL_COLORS', [{
        name: '原色',
        rgb: [230, 230, 230]
      }, {
        name: '奶黄',
        rgb: [240, 225, 190]
      }, {
        name: '薄荷',
        rgb: [200, 230, 215]
      }, {
        name: '樱粉',
        rgb: [240, 210, 210]
      }]);
      var FLOOR_COLORS = exports('FLOOR_COLORS', [{
        name: '原色',
        rgb: [200, 200, 200]
      }, {
        name: '木色',
        rgb: [205, 170, 130]
      }, {
        name: '浅蓝',
        rgb: [185, 205, 225]
      }, {
        name: '暖灰',
        rgb: [190, 180, 170]
      }]);
      var COLOR_PRICE = exports('COLOR_PRICE', 30);
      function newDecor() {
        var placed = {};
        var owned = [];
        for (var _iterator = _createForOfIteratorHelperLoose(DECOR_SLOTS), _step; !(_step = _iterator()).done;) {
          var s = _step.value;
          placed[s.id] = s.initial;
          if (s.initial && !owned.includes(s.initial)) owned.push(s.initial);
        }
        return {
          placed: placed,
          owned: owned,
          wall: 0,
          floor: 0
        };
      }
      var item = function item(id) {
        return DECOR_ITEMS.find(function (x) {
          return x.id === id;
        });
      };

      /** Anything unknown or out of range falls back to the fresh value, so a hand-edited save still loads */
      function parseDecor(o) {
        var d = newDecor();
        if (!o || typeof o !== 'object') return d;
        var r = o;
        if (Array.isArray(r.owned)) {
          for (var _iterator2 = _createForOfIteratorHelperLoose(r.owned), _step2; !(_step2 = _iterator2()).done;) {
            var id = _step2.value;
            if (item(id) && !d.owned.includes(id)) d.owned.push(id);
          }
        }
        if (r.placed && typeof r.placed === 'object') {
          for (var _iterator3 = _createForOfIteratorHelperLoose(DECOR_SLOTS), _step3; !(_step3 = _iterator3()).done;) {
            var s = _step3.value;
            if (!(s.id in r.placed)) continue;
            var v = r.placed[s.id];
            if (v === null) d.placed[s.id] = null;else if (s.allowed.includes(v) && d.owned.includes(v)) d.placed[s.id] = v;
          }
        }
        var idx = function idx(v, n) {
          return Number.isInteger(v) && v >= 0 && v < n ? v : 0;
        };
        d.wall = idx(r.wall, WALL_COLORS.length);
        d.floor = idx(r.floor, FLOOR_COLORS.length);
        return d;
      }
      /** Put `id` (or nothing) in a slot, buying it first if not owned */
      function place(p, slotId, id) {
        var slot = DECOR_SLOTS.find(function (s) {
          return s.id === slotId;
        });
        if (!slot) return 'unknown';
        var d = p.decor;
        if (d.placed[slotId] === id) return 'same';
        if (id !== null) {
          var it = item(id);
          if (!it) return 'unknown';
          if (!slot.allowed.includes(id)) return 'not-allowed';
          if (!d.owned.includes(id)) {
            if (p.coins < it.price) return 'poor';
            p.coins -= it.price;
            d.owned.push(id);
          }
        }
        d.placed[slotId] = id;
        return 'ok';
      }

      /** Repaint walls or floor; every change costs COLOR_PRICE, going back to a colour included */
      function paint(p, which, index) {
        var list = which === 'wall' ? WALL_COLORS : FLOOR_COLORS;
        if (!Number.isInteger(index) || index < 0 || index >= list.length) return 'unknown';
        if (p.decor[which] === index) return 'same';
        if (p.coins < COLOR_PRICE) return 'poor';
        p.coins -= COLOR_PRICE;
        p.decor[which] = index;
        return 'ok';
      }
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/delivery.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc', './customer.ts', './order.ts', './rng.ts'], function (exports) {
  var _createForOfIteratorHelperLoose, cclegacy, OPTIONAL, rollSpec, judge, reseed, createRng;
  return {
    setters: [function (module) {
      _createForOfIteratorHelperLoose = module.createForOfIteratorHelperLoose;
    }, function (module) {
      cclegacy = module.cclegacy;
    }, function (module) {
      OPTIONAL = module.OPTIONAL;
      rollSpec = module.rollSpec;
    }, function (module) {
      judge = module.judge;
    }, function (module) {
      reseed = module.reseed;
      createRng = module.createRng;
    }],
    execute: function () {
      exports({
        acceptDelivery: acceptDelivery,
        countStatus: countStatus,
        createDesk: createDesk,
        deskBusy: deskBusy,
        matchDelivery: matchDelivery,
        rejectDelivery: rejectDelivery,
        resetDesk: resetDesk,
        settleDelivery: settleDelivery,
        stepDesk: stepDesk
      });
      cclegacy._RF.push({}, "556dc8ztFNJnKKrYU12vxsM", "delivery", undefined);
      function createDesk(params, orders, seed) {
        var slots = [];
        for (var i = 0; i < params.maxOffers + params.maxActive; i++) {
          slots.push({
            status: 'idle',
            id: 0,
            left: 0,
            max: 0,
            spec: {
              required: [],
              banned: [],
              doneness: 'medium',
              patience: 0
            }
          });
        }
        var desk = {
          slots: slots,
          params: params,
          orders: orders,
          rng: createRng(seed),
          pool: OPTIONAL.slice(),
          t: 0,
          nextAt: 0,
          nextId: 1,
          open: true,
          delivered: 0,
          wrong: 0,
          late: 0,
          rejected: 0
        };
        resetDesk(desk, seed);
        return desk;
      }
      function resetDesk(desk, seed) {
        reseed(desk.rng, seed);
        for (var i = 0; i < OPTIONAL.length; i++) desk.pool[i] = OPTIONAL[i];
        for (var _iterator = _createForOfIteratorHelperLoose(desk.slots), _step; !(_step = _iterator()).done;) {
          var _d = _step.value;
          _d.status = 'idle';
        }
        desk.t = 0;
        desk.nextAt = desk.params.intervalSec;
        desk.nextId = 1;
        desk.open = true;
        desk.delivered = desk.wrong = desk.late = desk.rejected = 0;
      }
      function countStatus(desk, s) {
        var n = 0;
        for (var _iterator2 = _createForOfIteratorHelperLoose(desk.slots), _step2; !(_step2 = _iterator2()).done;) {
          var _d2 = _step2.value;
          if (_d2.status === s) n++;
        }
        return n;
      }
      function stepDesk(desk, dt, ev) {
        desk.t += dt;
        if (desk.open && desk.t >= desk.nextAt) {
          desk.nextAt += desk.params.intervalSec;
          if (countStatus(desk, 'offer') < desk.params.maxOffers) {
            var _d3 = desk.slots.find(function (x) {
              return x.status === 'idle';
            });
            if (_d3) {
              _d3.status = 'offer';
              _d3.id = desk.nextId++;
              _d3.left = _d3.max = desk.params.offerSec;
              rollSpec(desk.rng, desk.orders, desk.pool, desk.params.deadlineSec, _d3.spec);
            }
          }
        }
        for (var _iterator3 = _createForOfIteratorHelperLoose(desk.slots), _step3; !(_step3 = _iterator3()).done;) {
          var _d4 = _step3.value;
          if (_d4.status === 'idle') continue;
          _d4.left -= dt;
          if (_d4.left > 0) continue;
          if (_d4.status === 'offer') {
            desk.rejected++;
            ev == null || ev.onExpire == null || ev.onExpire(_d4);
          } else {
            desk.late++;
            ev == null || ev.onLate == null || ev.onLate(_d4);
          }
          _d4.status = 'idle';
        }
      }

      /** 接单。做不过来（已接满）返回 false，单子留在电脑上 */
      function acceptDelivery(desk, d) {
        if (d.status !== 'offer' || countStatus(desk, 'accepted') >= desk.params.maxActive) return false;
        d.status = 'accepted';
        d.left = d.max = desk.params.deadlineSec;
        return true;
      }
      function rejectDelivery(desk, d) {
        if (d.status !== 'offer') return;
        desk.rejected++;
        d.status = 'idle';
      }

      /** 放上取餐口的这一盘给谁：同 matchCustomer —— 先找对得上的，没有就砸给最急的 */
      function matchDelivery(desk, burger) {
        var _fit;
        var fit = null;
        var urgent = null;
        for (var _iterator4 = _createForOfIteratorHelperLoose(desk.slots), _step4; !(_step4 = _iterator4()).done;) {
          var _d5 = _step4.value;
          if (_d5.status !== 'accepted') continue;
          if (!urgent || _d5.left < urgent.left) urgent = _d5;
          if (!judge(burger, _d5.spec).ok) continue;
          if (!fit || _d5.left < fit.left) fit = _d5;
        }
        return (_fit = fit) != null ? _fit : urgent;
      }
      function settleDelivery(desk, d, ok) {
        if (ok) desk.delivered++;else desk.wrong++;
        d.status = 'idle';
      }

      /** 还有没送完的（打烊结算要等它们） */
      function deskBusy(desk) {
        return countStatus(desk, 'accepted') > 0;
      }
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/difficulty.ts", ['cc'], function (exports) {
  var cclegacy;
  return {
    setters: [function (module) {
      cclegacy = module.cclegacy;
    }],
    execute: function () {
      exports({
        difficultyForDay: difficultyForDay,
        starsFor: starsFor
      });
      cclegacy._RF.push({}, "f5d2c3sMXNM0p0wc+guVSwe", "difficulty", undefined);
      /**
       * 难度曲线：第 1 天 → 第 20 天各参数取值。M1 的交付物，M3/M4 直接调。
       *
       * ## 设计目标
       *
       * **理想玩家的完成率全程保持在 78%–98%。** 不是让他崩 —— 他崩了真人就毫无希望。
       * 真人比理想玩家差 30–50%（M3 会实测这个差值），压力就是从这个差里来的。
       *
       * ## 选哪几个旋钮，是实测挑出来的（`pnpm sim sweep <维度>`）
       *
       * | 旋钮 | 基准 53% 出发的跨度 | 判断 |
       * |---|---|---|
       * | 工位间距 0.5→2 | 89% → 6% | 最强，但**这是升级项不是难度**（M4 花钱买「工位更近」），不进曲线 |
       * | 额外配料数 0→4 | 75% → 9% | 极陡，加一样掉 20pt+，**只在中后期慢慢加** |
       * | 客流间隔 25→6s | 89% → 16% | 主旋钮，手感最平滑 |
       * | 单次操作耗时 0.2→1s | 72% → 7% | 手感参数，不该拿来调难度 |
       * | **顾客耐心 90→25s** | **63% → 40%** | ⚠ **最弱的旋钮，只有 23pt** —— 见下 |
       *
       * ### ⚠ 反直觉的两条，别照直觉改回去
       *
       * **① 顾客耐心几乎调不动难度。** 耐心从 90 秒砍到 25 秒（3.6 倍）只掉 23pt。
       * 因为瓶颈是玩家的**操作吞吐量**，不是顾客肯等多久：客流 12 秒来一个、玩家做一单要 15 秒，
       * 队伍必然堆积，给再多耐心也做不完。**耐心只在客流不饱和时才是有效旋钮。**
       * 所以曲线里它只做小幅收紧（60→45s），指望它扛难度是白费。
       *
       * **② `bannedChance` 对理想玩家完全零成本** —— 他不会放错，所以这一维怎么加都不影响上面的曲线。
       * 但它对真人是主要出错源（「我都说了不要洋葱」）。**这是唯一一个只压真人、不压理想玩家的旋钮**，
       * 因此可以放心地一路加到 0.5，不会把曲线带崩。
       */
      var LAST_DAY = exports('LAST_DAY', 20);

      /**
       * IDEAL_SERVED 那张表是在多长的一局上测出来的，秒。= `defaultSimConfig().durationSec`。
       * 星级线按它标定，所以**局长换了必须按比例缩**，否则 60 秒的短局用 210 秒的门槛，
       * 玩家永远拿不到一颗星，而判据只会看到「完成率偏低」。
       */
      var CALIBRATION_SEC = exports('CALIBRATION_SEC', 210);
      /**
       * 每天的理想玩家完成单数（`pnpm sim curve` 实测，32 局取平均后向下取整）。
       * 星级线按它的比例定，所以这张表变了星级线要跟着重算。
       */
      var IDEAL_SERVED = [9, 9, 10, 10, 10, 10, 10, 11, 11, 11, 11, 12, 12, 12, 12, 12, 13, 13, 13, 12];
      // 注意第 20 天反而回落（13 → 12）：后期订单变复杂，理想玩家自己也开始丢单。
      // 这不是表填错了 —— 星级线跟着回落是对的，否则最难的三天三星会变成天堑。

      /**
       * 星级门槛占理想完成数的比例。
       *
       * 三星 0.72 —— ROADMAP 要求「三星要理想玩家也得打起精神才够得着」，
       * 但真人比理想玩家差 30–50%，定成 0.9 就没人拿得到，定成 0.5 又白送。
       * 0.72 让手熟的玩家够得着、手生的够不着。M3 拿真人数据回来后要重新校。
       */
      var STAR_RATIO = {
        three: 0.72,
        two: 0.5,
        one: 0.3
      };
      function lerp(a, b, t) {
        return a + (b - a) * t;
      }
      function difficultyForDay(day) {
        var d = Math.max(1, Math.min(LAST_DAY, Math.floor(day)));
        var t = (d - 1) / (LAST_DAY - 1);

        // 额外配料是最陡的一维（加一样掉 20pt+），所以压到最后：
        // 12 天前一样不加，第 16 天才到 1，第 20 天才到 2。
        // 早期版本让它在第 17 天从 1 跳到 2，完成率当场掉 11pt 并一路跌到 60% —— 那一跳太狠了。
        var extraT = Math.max(0, (d - 12) / (LAST_DAY - 12));
        var extraMax = Math.round(lerp(0, 2, extraT));
        var ideal = IDEAL_SERVED[d - 1];
        return {
          day: d,
          flow: {
            // 只压到 14s 不再往下 —— 订单在后期变复杂了，客流就得同步放松，
            // 两条都压满会把理想玩家直接推下 78% 那条线。
            // 原为 15.5s；手上能拿两样后跑冰箱少了一半，后期完成率涨了 ~8pt，收紧到 14s 抵回来
            intervalSec: lerp(22, 14, t),
            intervalJitter: lerp(0, 0.25, t),
            maxConcurrent: Math.round(lerp(3, 6, t)),
            patienceSec: lerp(60, 45, t)
          },
          orders: {
            extraMin: 0,
            extraMax: extraMax,
            // 只压真人、不压理想玩家的那一维，放心加满
            bannedChance: lerp(0, 0.5, t)
          },
          stars: {
            three: Math.max(1, Math.round(ideal * STAR_RATIO.three)),
            two: Math.max(1, Math.round(ideal * STAR_RATIO.two)),
            one: Math.max(1, Math.round(ideal * STAR_RATIO.one))
          }
        };
      }

      /**
       * 当天完成 served 单该给几颗星。0 = 不及格。
       * `durationSec` 不是标定局长时按比例缩门槛 —— 至少 1 单，短局也不能白送。
       */
      function starsFor(served, day, durationSec) {
        if (durationSec === void 0) {
          durationSec = CALIBRATION_SEC;
        }
        var _difficultyForDay = difficultyForDay(day),
          stars = _difficultyForDay.stars;
        var k = durationSec / CALIBRATION_SEC;
        var line = function line(v) {
          return Math.max(1, Math.round(v * k));
        };
        if (served >= line(stars.three)) return 3;
        if (served >= line(stars.two)) return 2;
        if (served >= line(stars.one)) return 1;
        return 0;
      }
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/economy.ts", ['cc'], function (exports) {
  var cclegacy;
  return {
    setters: [function (module) {
      cclegacy = module.cclegacy;
    }],
    execute: function () {
      exports({
        createLedger: createLedger,
        earn: earn,
        ledgerTotal: ledgerTotal,
        resetLedger: resetLedger,
        tipFor: tipFor
      });
      cclegacy._RF.push({}, "6ecf9VQON1KPqMMJ+cGrgTS", "economy", undefined);
      /**
       * Money for one day: what the till takes. Service quality → tips → coins → unlocks (batch 4), the
       * Burgie's-style loop (ROADMAP ①). Zero Cocos (铁律①). Every number here is ⏳ self-chosen until tuned on device.
       */

      /** Paid for a correct burger served on time */
      var PRICE = exports('PRICE', 10);
      /** Delivery pays a bit more: the rider waits, and it takes a trip to the pickup counter */
      var DELIVERY_PRICE = exports('DELIVERY_PRICE', 12);
      /** Added when the order came with fries */
      var FRIES_PRICE = exports('FRIES_PRICE', 4);
      var DRINK_PRICE = exports('DRINK_PRICE', 3);

      /** Tip by review stars. Only a burger served right and on time earns one */
      function tipFor(stars) {
        return stars >= 5 ? 5 : stars >= 4 ? 3 : stars >= 3 ? 1 : 0;
      }
      function createLedger() {
        return {
          sales: 0,
          tips: 0,
          paid: 0,
          fries: 0,
          drinks: 0
        };
      }
      function resetLedger(l) {
        l.sales = 0;
        l.tips = 0;
        l.paid = 0;
        l.fries = 0;
        l.drinks = 0;
      }

      /** One order completed. Wrong or late earns nothing (免单). Returns what came in, for the floater */
      function earn(l, ok, late, stars, delivery, fries, drink) {
        if (fries === void 0) {
          fries = false;
        }
        if (drink === void 0) {
          drink = false;
        }
        if (!ok || late) return 0;
        var price = (delivery ? DELIVERY_PRICE : PRICE) + (fries ? FRIES_PRICE : 0) + (drink ? DRINK_PRICE : 0);
        var tip = tipFor(stars);
        l.sales += price;
        l.tips += tip;
        l.paid++;
        if (fries) l.fries++;
        if (drink) l.drinks++;
        return price + tip;
      }
      function ledgerTotal(l) {
        return l.sales + l.tips;
      }
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/Feel.ts", ['cc'], function (exports) {
  var cclegacy, Vec3, Tween, tween, game, Node, Label, Color, UIOpacity;
  return {
    setters: [function (module) {
      cclegacy = module.cclegacy;
      Vec3 = module.Vec3;
      Tween = module.Tween;
      tween = module.tween;
      game = module.game;
      Node = module.Node;
      Label = module.Label;
      Color = module.Color;
      UIOpacity = module.UIOpacity;
    }],
    execute: function () {
      exports({
        pop: pop,
        popIn: popIn,
        pressTo: pressTo
      });
      cclegacy._RF.push({}, "89a0fVbs3NFlLcxxyhYYFx1", "Feel", undefined);

      /**
       * Every timing and amount for interaction feedback lives here; components reference it and never
       * write their own 0.2s. ⏳ All self-chosen, not from any design source — tune on device.
       */
      var FEEL = exports('FEEL', {
        popSec: 0.18,
        popScale: 1.18,
        pressSec: 0.08,
        pressScale: 0.9,
        panelSec: 0.22,
        floatSec: 0.9,
        floatRise: 70,
        fadeSec: 0.2,
        /** Same hint again within this window is dropped, so holding into a wall does not spam */
        hintRepeatSec: 0.8,
        shakeSec: 0.3,
        /** Camera shake amplitude, metres */
        shakeSmall: 0.06,
        shakeBig: 0.14,
        scrubTickSec: 0.35
      });
      var ONE = new Vec3(1, 1, 1);

      /** Quick grow-and-settle. Restarts cleanly when fired again mid-pop */
      function pop(node, scale) {
        if (scale === void 0) {
          scale = FEEL.popScale;
        }
        Tween.stopAllByTarget(node);
        node.setScale(ONE);
        tween(node).to(FEEL.popSec / 2, {
          scale: new Vec3(scale, scale, 1)
        }, {
          easing: 'quadOut'
        }).to(FEEL.popSec / 2, {
          scale: ONE
        }, {
          easing: 'quadIn'
        }).start();
      }

      /** Panel open: scale in from slightly small with a little overshoot */
      function popIn(node) {
        Tween.stopAllByTarget(node);
        node.setScale(0.85, 0.85, 1);
        tween(node).to(FEEL.panelSec, {
          scale: ONE
        }, {
          easing: 'backOut'
        }).start();
      }
      function pressTo(node, down) {
        Tween.stopAllByTarget(node);
        var s = down ? FEEL.pressScale : 1;
        tween(node).to(FEEL.pressSec, {
          scale: new Vec3(s, s, 1)
        }, {
          easing: 'quadOut'
        }).start();
      }
      /** Short text that pops up over a spot and drifts away: "+★★★★★", "糊了", hints. Pooled, oldest reused */
      var Floaters = exports('Floaters', /*#__PURE__*/function () {
        function Floaters(parent, size) {
          if (size === void 0) {
            size = 8;
          }
          this.pool = [];
          this.next = 0;
          this.world = new Vec3();
          this.ui = new Vec3();
          this.lastText = '';
          this.lastAt = -Infinity;
          this.parent = parent;
          for (var i = 0; i < size; i++) {
            var node = new Node("Float_" + i);
            node.layer = parent.layer;
            parent.addChild(node);
            var label = node.addComponent(Label);
            label.fontSize = 30;
            label.lineHeight = 34;
            label.enableOutline = true;
            label.outlineWidth = 3;
            label.outlineColor = Color.BLACK;
            var op = node.addComponent(UIOpacity);
            node.active = false;
            this.pool.push({
              node: node,
              label: label,
              op: op
            });
          }
        }

        /** Over a world point */
        var _proto = Floaters.prototype;
        _proto.spawn = function spawn(cam, x, y, z, text, color, size) {
          if (size === void 0) {
            size = 30;
          }
          this.world.set(x, y, z);
          cam.convertToUINode(this.world, this.parent, this.ui);
          this.spawnAt(this.ui.x, this.ui.y, text, color, size);
        }

        /** At a canvas point */;
        _proto.spawnAt = function spawnAt(x, y, text, color, size) {
          if (size === void 0) {
            size = 30;
          }
          // Wall clock, not the shift's: that one restarts at 0 every day
          var now = game.totalTime / 1000;
          if (text === this.lastText && now - this.lastAt < FEEL.hintRepeatSec) return;
          this.lastText = text;
          this.lastAt = now;
          var f = this.pool[this.next++ % this.pool.length];
          Tween.stopAllByTarget(f.node);
          Tween.stopAllByTarget(f.op);
          f.label.string = text;
          f.label.color = color;
          f.label.fontSize = size;
          f.label.lineHeight = size + 4;
          f.node.setPosition(x, y, 0);
          f.node.setScale(0.6, 0.6, 1);
          f.op.opacity = 255;
          f.node.active = true;
          f.node.setSiblingIndex(this.parent.children.length - 1);
          tween(f.node).to(FEEL.popSec, {
            scale: ONE
          }, {
            easing: 'backOut'
          }).by(FEEL.floatSec, {
            position: new Vec3(0, FEEL.floatRise, 0)
          }, {
            easing: 'quadOut'
          }).call(function () {
            return f.node.active = false;
          }).start();
          tween(f.op).delay(FEEL.popSec + FEEL.floatSec / 2).to(FEEL.floatSec / 2, {
            opacity: 0
          }).start();
        };
        return Floaters;
      }());
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/input.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc', './vec2.ts'], function (exports) {
  var _createClass, cclegacy, rotateY;
  return {
    setters: [function (module) {
      _createClass = module.createClass;
    }, function (module) {
      cclegacy = module.cclegacy;
    }, function (module) {
      rotateY = module.rotateY;
    }],
    execute: function () {
      exports({
        panelChildZone: panelChildZone,
        screenToCanvasX: screenToCanvasX,
        screenToCanvasY: screenToCanvasY,
        stickToVelocity: stickToVelocity,
        stickToWorld: stickToWorld,
        uiRectToCaptureZone: uiRectToCaptureZone
      });
      cclegacy._RF.push({}, "5fddcUxezpFfZYwuJhLaPNu", "input", undefined);

      // ─────────────────────────── 摇杆 ───────────────────────────

      /** 真机上再调。radius 按 720 高的屏取的经验值，deadzone 偏保守。 */
      var DEFAULT_STICK = exports('DEFAULT_STICK', {
        radius: 90,
        deadzone: 0.15
      });

      // ─────────────────────────── 动作键 ───────────────────────────
      /**
       * 一个键区分点按与长按，而不是摆两个键。
       *
       * ROADMAP §M2 把「右手一个键还是两个」留到这里定：两个键会挤占右下角，
       * 而拇指在横屏下的可达区本来就窄。取放走点按、烤炉与洗碗池走长按，一个键够用。
       */
      var DEFAULT_ACTION = exports('DEFAULT_ACTION', {
        holdSeconds: 0.3
      });

      // ─────────────────────────── 路由 ───────────────────────────
      /**
       * 优先捕获矩形（UI 面板的格子、丢弃键）。屏幕像素，**左下角为原点、y 向上**，与 onDown 同系。
       *
       * 存在的理由：本路由按左右半屏分路，右半屏**任何一点**按下都算动作键。
       * 冰箱面板的 8 个格子横跨屏幕中线、丢弃键落在右半屏 —— 不先把它们从分路里摘出来，
       * 点格子会推摇杆、按丢弃键会同时取一次料。
       */
      /** 一路输入的内部记账。id 为 -1 表示这一路空着 */
      function emptySlot() {
        return {
          id: -1,
          originX: 0,
          originY: 0,
          curX: 0,
          curY: 0
        };
      }
      function emptyAction() {
        return {
          down: false,
          holding: false,
          tapped: false,
          holdStarted: false,
          heldSeconds: 0
        };
      }

      /**
       * 把多点触摸分派到左半屏（摇杆）与右半屏（动作键）。
       *
       * ⚠ **归属在按下那一刻定死，之后只认手指 id 不认位置。**
       * 按位置实时判归属的话，拇指从左半屏划过中线，摇杆会当场失灵、动作键会莫名触发
       * —— 横屏下左拇指外推本来就容易越过中线，这不是边缘情况。
       *
       * 一路已被占用时，后来的手指整根忽略：三指按屏不该把已在推的摇杆抢走。
       */
      var TouchRouter = exports('TouchRouter', /*#__PURE__*/function () {
        /**
         * @param splitX 左右分界的屏幕 x（像素）。通常是屏宽的一半
         * @param stickCfg 摇杆参数
         * @param actionCfg 动作键参数
         */
        function TouchRouter(splitX, stickCfg, actionCfg) {
          if (stickCfg === void 0) {
            stickCfg = DEFAULT_STICK;
          }
          if (actionCfg === void 0) {
            actionCfg = DEFAULT_ACTION;
          }
          this.left = emptySlot();
          this.right = emptySlot();
          this.stick = {
            dirX: 0,
            dirY: 0,
            magnitude: 0,
            active: false
          };
          this.action = emptyAction();
          /** 三张平行表，同序。分开存是为了 tick 能按索引遍历、不产生临时对象（铁律②） */
          this.zones = [];
          this.zoneSlots = [];
          this.zoneStates = [];
          this.zoneIndex = new Map();
          this.splitX = splitX;
          this.stickCfg = stickCfg;
          this.actionCfg = actionCfg;
        }

        /** 屏幕尺寸变了要跟着改（横屏转向、微信下拉工具栏收放都会触发） */
        var _proto = TouchRouter.prototype;
        _proto.setSplitX = function setSplitX(x) {
          this.splitX = x;
        }

        /**
         * 换一批捕获区（打开/关闭冰箱面板、丢弃键显隐）。
         *
         * ⚠ 正按在旧区上的手指整根作废，不迁移到新区、也不回落到左右分路 ——
         * 面板关闭那一刻按着的格子若留着，下次开面板会凭空触发一次。
         * 那根手指迟到的 onUp 找不到归属，会被直接丢掉。
         */;
        _proto.setCaptureZones = function setCaptureZones(zones) {
          this.zones = zones.slice();
          this.zoneSlots = this.zones.map(emptySlot);
          this.zoneStates = this.zones.map(emptyAction);
          this.zoneIndex.clear();
          for (var i = 0; i < this.zones.length; i++) {
            // 重名时先登记的赢，与 hitZone 的重叠规则一致
            if (!this.zoneIndex.has(this.zones[i].id)) this.zoneIndex.set(this.zones[i].id, i);
          }
        }

        /** 读某个区的状态。语义与 action 完全一致（tapped / holdStarted 都是单帧脉冲） */;
        _proto.zone = function zone(id) {
          var i = this.zoneIndex.get(id);
          return i === undefined ? undefined : this.zoneStates[i];
        }

        /**
         * Where the stick finger went down, in screen pixels. Meaningless unless stick.active.
         * The floating joystick visual needs it; deciding "left half" in the component would
         * be a second copy of the routing, and ownership is locked at press time here.
         */;
        /** 命中的区索引，没有则 -1。含左下边、不含右上边 —— 相邻格子共边时只会中一个 */
        _proto.hitZone = function hitZone(x, y) {
          for (var i = 0; i < this.zones.length; i++) {
            var z = this.zones[i];
            if (x >= z.x && x < z.x + z.w && y >= z.y && y < z.y + z.h) return i;
          }
          return -1;
        };
        _proto.onDown = function onDown(id, x, y) {
          var zi = this.hitZone(x, y);
          if (zi >= 0) {
            var z = this.zoneSlots[zi];
            if (z.id !== -1) return; // 那个区已经有手指了，忽略这根
            z.id = id;
            z.originX = x;
            z.originY = y;
            z.curX = x;
            z.curY = y;
            var st = this.zoneStates[zi];
            st.down = true;
            st.heldSeconds = 0;
            st.holding = false;
            return; // 不再进左右分路
          }

          var slot = x < this.splitX ? this.left : this.right;
          if (slot.id !== -1) return; // 那一路已经有手指了，忽略这根
          slot.id = id;
          slot.originX = x;
          slot.originY = y;
          slot.curX = x;
          slot.curY = y;
          if (slot === this.right) {
            this.action.down = true;
            this.action.heldSeconds = 0;
            this.action.holding = false;
          }
          this.recomputeStick();
        };
        _proto.onMove = function onMove(id, x, y) {
          for (var i = 0; i < this.zoneSlots.length; i++) {
            if (this.zoneSlots[i].id !== id) continue;
            var z = this.zones[i];
            var inside = x >= z.x && x < z.x + z.w && y >= z.y && y < z.y + z.h;
            if (inside) {
              this.zoneSlots[i].curX = x;
              this.zoneSlots[i].curY = y;
            } else {
              // 滑出即作废，且不复活 —— 玩家点错格子后划开松手是唯一的反悔手段。
              // 作废后这根手指不在任何一路里，后续 onMove/onUp 都会被丢掉。
              this.zoneSlots[i].id = -1;
              var st = this.zoneStates[i];
              st.down = false;
              st.holding = false;
              st.heldSeconds = 0;
            }
            return;
          }
          if (this.left.id === id) {
            this.left.curX = x;
            this.left.curY = y;
            this.recomputeStick();
          } else if (this.right.id === id) {
            this.right.curX = x;
            this.right.curY = y;
          }
          // 不属于任何一路的手指（第三根、或按下时那一路已满）直接丢掉
        };

        _proto.onUp = function onUp(id) {
          for (var i = 0; i < this.zoneSlots.length; i++) {
            if (this.zoneSlots[i].id !== id) continue;
            this.zoneSlots[i].id = -1;
            var st = this.zoneStates[i];
            if (!st.holding) st.tapped = true;
            st.down = false;
            st.holding = false;
            st.heldSeconds = 0;
            return;
          }
          if (this.left.id === id) {
            this.left.id = -1;
            this.recomputeStick();
          } else if (this.right.id === id) {
            this.right.id = -1;
            // 没到长按阈值就抬手 → 这是一次点按
            if (!this.action.holding) this.action.tapped = true;
            this.action.down = false;
            this.action.holding = false;
            this.action.heldSeconds = 0;
          }
        }

        /**
         * 触摸被系统抢走（来电、微信侧滑返回、切后台）。
         *
         * 必须有这条：这些情况下 onUp 不一定会来，不清状态的话摇杆会永久卡在最后的方向上，
         * 玩家回到游戏发现角色一直往一边走。组件里挂 TOUCH_CANCEL 和 onHide。
         */;
        _proto.cancelAll = function cancelAll() {
          for (var i = 0; i < this.zoneSlots.length; i++) {
            this.zoneSlots[i].id = -1;
            var st = this.zoneStates[i];
            st.down = false;
            st.holding = false;
            st.tapped = false;
            st.holdStarted = false;
            st.heldSeconds = 0;
          }
          this.left = emptySlot();
          this.right = emptySlot();
          this.stick.dirX = 0;
          this.stick.dirY = 0;
          this.stick.magnitude = 0;
          this.stick.active = false;
          this.action.down = false;
          this.action.holding = false;
          this.action.tapped = false;
          this.action.holdStarted = false;
          this.action.heldSeconds = 0;
        }

        /**
         * 每帧调一次，**在读完 action / zone 之后**。
         *
         * tapped / holdStarted 是单帧脉冲，而触摸事件是在两帧之间到达的。tick 进门先清掉上一帧的
         * 脉冲 —— 所以「先 tick 再读」读到的永远是刚被清空的那份：**tapped 全部消失**。
         * 而 holdStarted 是 tick 自己产生的，同一帧内照样读得到，摇杆也照常工作（连续状态）
         * —— 于是症状是「能走、长按还灵、就是点不动」，看起来像某个按钮没接上。
         * 顺序反了写过一次，`tests/input.test.ts` 的「帧循环里的读写顺序」一节钉住了这条。
         */;
        _proto.tick = function tick(dt) {
          this.advance(this.action, dt);
          for (var i = 0; i < this.zoneStates.length; i++) this.advance(this.zoneStates[i], dt);
        }

        /** 捕获区与动作键共用同一套点按/长按语义，改一处两边一起变 */;
        _proto.advance = function advance(st, dt) {
          st.tapped = false;
          st.holdStarted = false;
          if (!st.down) return;
          st.heldSeconds += dt;
          if (!st.holding && st.heldSeconds >= this.actionCfg.holdSeconds) {
            st.holding = true;
            st.holdStarted = true;
          }
        }

        /** 浮动原点：按下处即摇杆中心，拇指不用去够固定位置 —— 横屏单手时差别很明显 */;
        _proto.recomputeStick = function recomputeStick() {
          var s = this.stick;
          if (this.left.id === -1) {
            s.dirX = 0;
            s.dirY = 0;
            s.magnitude = 0;
            s.active = false;
            return;
          }
          s.active = true;
          var dx = this.left.curX - this.left.originX;
          var dy = this.left.curY - this.left.originY;
          var l2 = dx * dx + dy * dy;
          if (l2 === 0) {
            s.dirX = 0;
            s.dirY = 0;
            s.magnitude = 0;
            return;
          }
          var l = Math.sqrt(l2);
          // 先归一化再 clamp，不是「除以 radius」—— 后者在斜推到角落时会算出 >1 的量
          var m = l / this.stickCfg.radius;
          if (m < this.stickCfg.deadzone) {
            s.dirX = 0;
            s.dirY = 0;
            s.magnitude = 0;
            return;
          }
          var inv = 1 / l;
          s.dirX = dx * inv;
          s.dirY = dy * inv;
          s.magnitude = m > 1 ? 1 : m;
        };
        _createClass(TouchRouter, [{
          key: "stickOriginX",
          get: function get() {
            return this.left.originX;
          }
        }, {
          key: "stickOriginY",
          get: function get() {
            return this.left.originY;
          }
        }]);
        return TouchRouter;
      }());

      // ─────────────────────────── 相机相对映射 ───────────────────────────

      /** 斜 45° 相机绕 Y 轴的偏航角（弧度）。符号见 stickToWorld 的说明 */
      var ISO_CAMERA_YAW = exports('ISO_CAMERA_YAW', Math.PI / 4);

      /**
       * 摇杆方向 → 世界移动方向（ROADMAP §M2 的头号手感坑）。
       *
       * 不能把摇杆的 (x, y) 直接当世界的 (x, z)：相机绕 Y 转了 45°，
       * 玩家往上推、角色却斜着走。正解是先按相机 yaw 旋转再喂给移动。
       *
       * 屏幕「上」对应世界 -z（Cocos 默认相机朝 -z 看），所以先取 { x: dirX, z: -dirY }。
       *
       * ⚠ **yaw 的符号真机上验一次，别靠推理。** 四个方向各推一次看角色往哪走；
       * 前后反了就把传进来的 yaw 取负，左右反了说明相机是往另一边转的。
       * 这里锁死的是「先旋转再移动」这个结构，不是某个具体符号。
       *
       * out 可以就是复用的临时对象 —— 每帧调用，别在调用处 new（铁律②）。
       */
      function stickToWorld(out, stick, cameraYaw) {
        out.x = stick.dirX;
        out.z = -stick.dirY;
        return rotateY(out, out, cameraYaw);
      }

      /**
       * 摇杆 → 本帧位移。magnitude 参与进来，轻推走慢。
       *
       * 回中时写入零向量并返回 false，调用方可以据此跳过碰撞解算。
       */
      function stickToVelocity(out, stick, cameraYaw, speed) {
        if (stick.magnitude === 0) {
          out.x = 0;
          out.z = 0;
          return false;
        }
        stickToWorld(out, stick, cameraYaw);
        var v = speed * stick.magnitude;
        out.x *= v;
        out.z *= v;
        return true;
      }

      // ─────────────────────────── UI 矩形 → 捕获区 ───────────────────────────

      /**
       * UI node centre (Canvas-centre coords) -> capture zone (touch pixels, bottom-left origin).
       * The only place this conversion may happen. Two independent traps, either one alone
       * ruins the whole panel — see docs/m2-scene-guide.md §2.3:
       *
       * - origin differs by half a screen: Canvas x is -640..640, Touch.getLocation() is
       *   bottom-left. Feeding node positions straight in parks every zone in the lower left.
       * - units are real touch pixels, not design resolution. Wide screens run Fit Height
       *   (720 tall, 1.625x on a 2532x1170 phone); narrower than 16:9 runs Fit Width, where
       *   getVisibleSize() grows past 720 (960 on 4:3). Touches arrive in physical pixels.
       *
       * So screenW/screenH come from view.getVisibleSizeInPixel() and designH from
       * view.getVisibleSize().height, both read at runtime: 720 is wrong on every non-16:9 phone.
       */
      function uiRectToCaptureZone(id, centerX, centerY, w, h, screenW, screenH, designH) {
        if (designH === void 0) {
          designH = 720;
        }
        var k = screenH / designH; // physical pixels per visible design unit
        var sw = w * k;
        var sh = h * k;
        return {
          id: id,
          x: screenW / 2 + centerX * k - sw / 2,
          y: screenH / 2 + centerY * k - sh / 2,
          w: sw,
          h: sh
        };
      }

      /**
       * Same, for a node parented to the fridge panel. Slot positions read off the scene are
       * relative to the panel (-204, 68); uiRectToCaptureZone wants Canvas-absolute (-204, 128).
       * Feeding slot.position straight in drops all 8 hit areas by the panel offset, and every
       * judge stays green because both sides read the same number.
       *
       * Component-layer twin of localPos() in tools/scene-spec.ts, same trap, other direction.
       */
      function panelChildZone(id, panelX, panelY, childX, childY, w, h, screenW, screenH, designH) {
        if (designH === void 0) {
          designH = 720;
        }
        return uiRectToCaptureZone(id, panelX + childX, panelY + childY, w, h, screenW, screenH, designH);
      }

      /**
       * Inverse of uiRectToCaptureZone's mapping, for the floating joystick: touch pixel
       * -> Canvas-centre coords, so the visual lands exactly under the thumb on any device.
       * Two scalar functions rather than a point, to keep the per-frame path allocation-free.
       */
      function screenToCanvasX(x, screenW, screenH, designH) {
        if (designH === void 0) {
          designH = 720;
        }
        return (x - screenW / 2) * designH / screenH;
      }
      function screenToCanvasY(y, screenH, designH) {
        if (designH === void 0) {
          designH = 720;
        }
        return (y - screenH / 2) * designH / screenH;
      }
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/kitchen.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc', './collision.ts', './order.ts', './recipe.ts', './types.ts'], function (exports) {
  var _createForOfIteratorHelperLoose, cclegacy, inTriggerRange, judge, createBurger, cookLevelAt, addCookedPatty, addIngredient, hasCore, INGREDIENTS;
  return {
    setters: [function (module) {
      _createForOfIteratorHelperLoose = module.createForOfIteratorHelperLoose;
    }, function (module) {
      cclegacy = module.cclegacy;
    }, function (module) {
      inTriggerRange = module.inTriggerRange;
    }, function (module) {
      judge = module.judge;
    }, function (module) {
      createBurger = module.createBurger;
      cookLevelAt = module.cookLevelAt;
      addCookedPatty = module.addCookedPatty;
      addIngredient = module.addIngredient;
      hasCore = module.hasCore;
    }, function (module) {
      INGREDIENTS = module.INGREDIENTS;
    }],
    execute: function () {
      exports({
        bumpStack: bumpStack,
        carrySpeedFactor: carrySpeedFactor,
        createKitchen: createKitchen,
        discard: discard,
        grillCookLevel: grillCookLevel,
        interact: interact,
        plateOut: plateOut,
        releaseScrub: releaseScrub,
        resetKitchen: resetKitchen,
        scrubSink: scrubSink,
        stationInReach: stationInReach,
        stepKitchen: stepKitchen
      });
      cclegacy._RF.push({}, "91c69EX0BhEhbvZPRFm8hNg", "kitchen", undefined);

      // ─────────────────────────── 手持 ───────────────────────────
      /**
       * Raw patties from the fridge carry kind 'patty' too, with cook 'raw' —
       * one kind for meat everywhere, so the grill never has to special-case it.
       */
      // ─────────────────────────── 烤炉 ───────────────────────────
      // ─────────────────────────── 配置与状态 ───────────────────────────
      /** ⏳ Self-chosen until tuned on device */
      var FRY_SEC = exports('FRY_SEC', 5);
      /** ⏳ Self-chosen: a cup takes this long, and overflows if left this long once full */
      var DRINK_SEC = exports('DRINK_SEC', 3);
      var DRINK_SPILL_SEC = exports('DRINK_SPILL_SEC', 5);
      /** ⏳ Self-chosen: a burnt patty ignored this long starts a fire */
      var FIRE_SEC = exports('FIRE_SEC', 6);

      /** Done fries left in the basket this long burn. ⏳ Self-chosen */
      var FRY_BURN_SEC = exports('FRY_BURN_SEC', 8);

      /** 洗碗三段（GDD §12.5）：泡是被动的、刷要按住、晾是被动的 */

      /** ⏳ Shortened 2026-09-25 (was soak 4 / scrub 2 / dry 6): the user found the wash loop too slow */
      var DEFAULT_WASH = exports('DEFAULT_WASH', {
        soakSec: 2.5,
        scrubSec: 1.5,
        drySec: 4,
        returnSec: 8
      });

      /** Letting go of the scrub past this point racks the batch stained; before it, progress just waits (GDD §12.5) */
      var STAIN_MIN = exports('STAIN_MIN', 0.5);

      /** Plates carried from the rack in one trip; more than STACK_SLOW slows the chef and can crash on a wall */
      var STACK_MAX = exports('STACK_MAX', 5);
      var STACK_SLOW = exports('STACK_SLOW', 3);
      var STACK_SLOW_SPEED = exports('STACK_SLOW_SPEED', 0.7);
      /**
       * Share of a step lost to a wall that counts as walking into it (movement.impact = 1 - cos of the approach angle).
       * 0.2 ≈ 37°. Not higher: under the 45° camera, pushing screen-up into a counter meets it at 45° (0.29) —
       * that reads as a head-on hit on screen, and 0.6 let it slide by every time.
       */
      var CRASH_IMPACT = exports('CRASH_IMPACT', 0.2);

      /**
       * 洗碗池只收一批、架子只晾一批 —— 两批同时洗会让「先洗还是先攒」这个取舍消失。
       * stage: 'empty' → 'soaking'（倒计时）→ 'soaked'（等人来刷）→ 刷完进架子
       */

      function createKitchen(cfg) {
        var _cfg$plates, _cfg$sparePlates;
        var grill = [];
        for (var i = 0; i < cfg.grillSlots; i++) grill.push({
          busy: false,
          elapsed: 0
        });
        return {
          t: 0,
          carry: {
            kind: 'none',
            ingredient: 'bun',
            second: null,
            cook: 'raw',
            plated: false,
            stained: false,
            count: 0,
            countStained: 0
          },
          grill: grill,
          burger: createBurger(),
          assemblyOccupied: false,
          burgerPlated: false,
          burgerStained: false,
          stock: INGREDIENTS.map(function () {
            var _cfg$fridgeCap;
            return (_cfg$fridgeCap = cfg.fridgeCap) != null ? _cfg$fridgeCap : Infinity;
          }),
          burnt: 0,
          plates: (_cfg$plates = cfg.plates) != null ? _cfg$plates : Infinity,
          stained: 0,
          broken: 0,
          spare: (_cfg$sparePlates = cfg.sparePlates) != null ? _cfg$sparePlates : 0,
          crashed: 0,
          stainedServed: 0,
          dirty: 0,
          returning: [],
          sink: {
            stage: 'empty',
            count: 0,
            left: 0,
            scrub: 0
          },
          rack: {
            count: 0,
            left: 0,
            stained: false,
            ready: 0,
            readyStained: 0
          },
          fryer: {
            stage: 'empty',
            left: 0
          },
          drinks: {
            stage: 'empty',
            left: 0
          },
          spills: 0,
          burntFries: 0,
          fire: false,
          fires: 0,
          cfg: cfg
        };
      }

      // ─────────────────────────── 每帧 ───────────────────────────

      /**
       * ⚠ Burnt patties stay on the grill — sim.ts deletes them because its ideal
       * chef never lets that happen. A real player must walk over and bin it, and
       * M4 hangs the fire chain off that same stuck slot.
       */
      function stepKitchen(st, dt) {
        st.t += dt;
        for (var i = 0; i < st.grill.length; i++) {
          var slot = st.grill[i];
          if (!slot.busy) continue;
          var before = slot.elapsed;
          slot.elapsed += dt;
          if (before < st.cfg.cook.burntAt && slot.elapsed >= st.cfg.cook.burntAt) st.burnt++;
          var fireAt = st.cfg.fireSec === undefined ? Infinity : st.cfg.cook.burntAt + st.cfg.fireSec;
          if (!st.fire && slot.elapsed >= fireAt) {
            st.fire = true;
            st.fires++;
          }
        }
        for (var _i = 0; _i < st.returning.length; _i++) {
          if (st.returning[_i] <= 0) continue;
          st.returning[_i] -= dt;
          if (st.returning[_i] <= 0) st.dirty++;
        }
        var sink = st.sink;
        if (sink.stage === 'soaking') {
          sink.left -= dt;
          if (sink.left <= 0) sink.stage = 'soaked';
        }
        var fry = st.fryer;
        if (fry.stage === 'frying') {
          fry.left -= dt;
          if (fry.left <= 0) {
            fry.stage = 'ready';
            fry.left = FRY_BURN_SEC;
          }
        } else if (fry.stage === 'ready') {
          fry.left -= dt;
          if (fry.left <= 0) {
            fry.stage = 'burnt';
            st.burntFries++;
          }
        }
        var dr = st.drinks;
        if (dr.stage === 'pouring') {
          dr.left -= dt;
          if (dr.left <= 0) {
            dr.stage = 'ready';
            dr.left = DRINK_SPILL_SEC;
          }
        } else if (dr.stage === 'ready') {
          dr.left -= dt;
          if (dr.left <= 0) {
            dr.stage = 'spilled';
            st.spills++;
          }
        }
        var rack = st.rack;
        if (rack.count > 0) {
          rack.left -= dt;
          if (rack.left <= 0) {
            rack.ready += rack.count;
            if (rack.stained) rack.readyStained += rack.count;
            rack.count = 0;
          }
        }
      }

      /** 烤位当前火候。UI 画进度条用；空位返回 'raw' */
      function grillCookLevel(st, slot) {
        var g = st.grill[slot];
        if (!g || !g.busy) return 'raw';
        return cookLevelAt(g.elapsed, st.cfg.cook);
      }

      // ─────────────────────────── 工位查找 ───────────────────────────

      /** 够得着的最近工位，用于「进入范围 → 提示」。都够不着返回 null */
      function stationInReach(st, pos) {
        var best = null;
        var bestDist = Infinity;
        var list = st.cfg.stations;
        for (var i = 0; i < list.length; i++) {
          var s = list[i];
          if (!offers(st, s) || !inTriggerRange(pos, s.pos, s.triggerRange)) continue;
          var dx = pos.x - s.pos.x;
          var dz = pos.z - s.pos.z;
          var d = dx * dx + dz * dz;
          if (d < bestDist) {
            bestDist = d;
            best = s;
          }
        }
        return best;
      }

      /**
       * 晾碗架和放盘处紧挨着洗碗池、组装台，没事可做时不能抢走旁边工位的「最近」——
       * 否则站在洗碗池右半边按住刷，刷的其实是架子。
       */
      function offers(st, s) {
        if (s.kind === 'shelf') return st.carry.kind === 'stack';
        if (s.kind === 'fryer') return st.cfg.fryerSec !== undefined;
        if (s.kind === 'extinguisher') return st.cfg.fireSec !== undefined;
        if (s.kind === 'drinks') return st.cfg.drinkSec !== undefined;
        if (s.kind === 'rack') return st.rack.ready > 0 && (st.carry.kind === 'none' || st.carry.kind === 'stack');
        return true;
      }

      // ─────────────────────────── 交互 ───────────────────────────

      function blocked(reason) {
        return {
          kind: 'blocked',
          reason: reason,
          verdict: null,
          slot: -1
        };
      }
      function done(kind, slot, verdict) {
        if (slot === void 0) {
          slot = -1;
        }
        if (verdict === void 0) {
          verdict = null;
        }
        return {
          kind: kind,
          reason: 'none',
          verdict: verdict,
          slot: slot
        };
      }

      /**
       * 一个动作键的全部去处，按 station.kind 分派。
       *
       * 只在按键那一刻调用，不在每帧热路径上 —— 允许分配（与 order.judge 同）。
       */
      function interact(st, playerPos, station, req) {
        var _req$slot;
        if (req === void 0) {
          req = {};
        }
        if (!inTriggerRange(playerPos, station.pos, station.triggerRange)) {
          return blocked('out-of-range');
        }
        switch (station.kind) {
          case 'fridge':
            return takeFromFridge(st, req.ingredient);
          case 'grill':
            return useGrill(st, (_req$slot = req.slot) != null ? _req$slot : -1);
          case 'assembly':
            return useAssembly(st);
          case 'serve':
          case 'delivery':
            // Same hand-off; who it's for (diner or rider) is decided by the caller's spec
            return serveTo(st, req.spec, station.kind === 'serve');
          case 'storeroom':
            return req.plates ? takeFromRack(st, true) : takeCrate(st, req.ingredient);
          case 'sink':
            return loadSink(st);
          case 'rack':
            return takeFromRack(st);
          case 'shelf':
            return putOnShelf(st);
          case 'fryer':
            return useFryer(st);
          case 'extinguisher':
            return useExtinguisher(st);
          case 'drinks':
            return useDrinks(st);
          default:
            return blocked('unsupported');
        }
      }

      /**
       * 从冰箱取料。手上最多两样**不同**的配料；肉饼只能单独拿（它得先下锅）。
       * 拿满两样再点第三样 = 换掉后拿的那样；点肉饼 = 手上的全退回。
       * 点错不该逼玩家先跑一趟垃圾桶 —— 那趟路在 30 秒一局里是实打实的惩罚，而错因只是眼花。
       *
       * 盘子是唯一的例外：那是组装好的汉堡，换食材等于整个扔掉，
       * 代价和「拿错一片生菜」完全不是一回事，要丢得走 discard，让玩家自己按那一下。
       */
      function takeFromFridge(st, ing) {
        if (st.carry.kind === 'crate') return restock(st);
        if (ing === undefined) return blocked('unsupported');
        var c = st.carry;
        if (c.kind === 'plate' || c.kind === 'stack' || c.plated) return blocked('hands-full');
        if (c.kind === 'ingredient' && (ing === c.ingredient || ing === c.second)) return blocked('duplicate-ingredient');
        var i = INGREDIENTS.indexOf(ing);
        if (st.stock[i] <= 0) return blocked('out-of-stock');
        st.stock[i]--;
        if (ing !== 'patty' && c.kind === 'ingredient') {
          if (c.second !== null) giveBack(st, c.second);
          c.second = ing;
          return done('take-ingredient');
        }
        // Swapping hands the old pick back — a mis-tap must not cost stock either
        if (c.kind === 'ingredient') {
          giveBack(st, c.ingredient);
          if (c.second !== null) giveBack(st, c.second);
        } else if (c.kind === 'patty' && c.cook === 'raw') giveBack(st, 'patty');
        c.second = null;
        if (ing === 'patty') {
          c.kind = 'patty';
          c.cook = 'raw';
        } else {
          c.kind = 'ingredient';
          c.ingredient = ing;
        }
        return done('take-ingredient');
      }
      function giveBack(st, ing) {
        var _st$cfg$fridgeCap;
        var i = INGREDIENTS.indexOf(ing);
        st.stock[i] = Math.min(st.stock[i] + 1, (_st$cfg$fridgeCap = st.cfg.fridgeCap) != null ? _st$cfg$fridgeCap : Infinity);
      }
      function takeCrate(st, ing) {
        if (ing === undefined) return blocked('unsupported');
        if (st.carry.kind !== 'none') return blocked('hands-full');
        st.carry.kind = 'crate';
        st.carry.ingredient = ing;
        return done('take-crate');
      }

      /** Refused when already full, so the crate stays in hand instead of vanishing */
      function restock(st) {
        var _st$cfg$fridgeCap2;
        var i = INGREDIENTS.indexOf(st.carry.ingredient);
        var cap = (_st$cfg$fridgeCap2 = st.cfg.fridgeCap) != null ? _st$cfg$fridgeCap2 : Infinity;
        if (st.stock[i] >= cap) return blocked('stock-full');
        st.stock[i] = cap;
        st.carry.kind = 'none';
        return done('restock');
      }
      function useGrill(st, want) {
        if (st.carry.kind === 'extinguisher') {
          if (!st.fire) return blocked('no-fire');
          st.fire = false;
          for (var _iterator = _createForOfIteratorHelperLoose(st.grill), _step; !(_step = _iterator()).done;) {
            var _g = _step.value;
            _g.busy = false;
            _g.elapsed = 0;
          }
          st.carry.kind = 'none';
          return done('extinguish');
        }
        if (st.fire) return blocked('on-fire');
        // hands full with a raw patty → put it on
        if (st.carry.kind === 'patty') {
          if (st.carry.cook !== 'raw') return blocked('not-raw-patty');
          var free = firstFreeSlot(st);
          if (free < 0) return blocked('grill-full');
          st.grill[free].busy = true;
          st.grill[free].elapsed = 0;
          st.carry.kind = 'none';
          if (st.carry.plated) returnPlate(st, st.carry.stained);
          st.carry.plated = false;
          st.carry.stained = false;
          return done('place-patty', free);
        }
        if (st.carry.kind !== 'none') return blocked('hands-full');
        var slot = want >= 0 ? want : longestSlot(st);
        var g = st.grill[slot];
        if (!g || !g.busy) return blocked('grill-empty');
        if (st.plates <= 0) return blocked('no-plate');
        st.plates--;
        st.carry.stained = st.stained > 0;
        if (st.carry.stained) st.stained--;
        st.carry.plated = true;
        st.carry.kind = 'patty';
        st.carry.cook = cookLevelAt(g.elapsed, st.cfg.cook);
        g.busy = false;
        g.elapsed = 0;
        return done('take-patty', slot);
      }
      function firstFreeSlot(st) {
        for (var i = 0; i < st.grill.length; i++) if (!st.grill[i].busy) return i;
        return -1;
      }

      /** 烤最久的那块 —— 再等就过头，前面几步全白做（同 sim.ts 的取肉优先级） */
      function longestSlot(st) {
        var best = -1;
        var bestElapsed = -1;
        for (var i = 0; i < st.grill.length; i++) {
          var g = st.grill[i];
          if (g.busy && g.elapsed > bestElapsed) {
            bestElapsed = g.elapsed;
            best = i;
          }
        }
        return best;
      }
      function useAssembly(st) {
        switch (st.carry.kind) {
          case 'none':
            if (!st.assemblyOccupied) return blocked('no-burger');
            st.assemblyOccupied = false;
            st.carry.kind = 'plate';
            return done('pick-plate');
          case 'plate':
            st.assemblyOccupied = true;
            st.carry.kind = 'none';
            return done('put-plate');
          case 'ingredient':
            {
              startBurgerIfEmpty(st);
              var c = st.carry;
              var a = addIngredient(st.burger, c.ingredient);
              var b = c.second !== null && addIngredient(st.burger, c.second);
              if (!a && !b) return blocked('duplicate-ingredient');
              // Whatever the burger already had stays in hand
              if (c.second === null || a && b) c.kind = 'none';else if (a) c.ingredient = c.second;
              c.second = null;
              return done('add-to-burger');
            }
          case 'patty':
            {
              startBurgerIfEmpty(st);
              var second = st.burger.ingredients.includes('patty');
              // raw and burnt go on too — the burger is buildable, judge() fails it later
              if (!addCookedPatty(st.burger, st.carry.cook, st.cfg.doublePatty === true)) {
                return blocked('duplicate-ingredient');
              }
              // The burger already sits on the first patty's plate; the second one's plate goes back to the shelf
              if (second) {
                if (st.carry.plated) returnPlate(st, st.carry.stained);
              } else {
                st.burgerPlated = st.carry.plated;
                st.burgerStained = st.carry.stained;
              }
              st.carry.plated = false;
              st.carry.stained = false;
              st.carry.kind = 'none';
              return done('add-to-burger');
            }
          default:
            return blocked('unsupported');
        }
      }
      function startBurgerIfEmpty(st) {
        if (st.assemblyOccupied) return;
        resetBurger(st.burger);
        st.burgerPlated = false;
        st.burgerStained = false;
        st.assemblyOccupied = true;
      }
      function returnPlate(st, stained) {
        st.plates++;
        if (stained) st.stained++;
      }

      /** Empty-handed: drop a basket in, lift out the one that is done, or tip out a burnt one */
      function useFryer(st) {
        if (st.cfg.fryerSec === undefined) return blocked('unsupported');
        if (st.carry.kind !== 'none') return blocked('hands-full');
        var f = st.fryer;
        if (f.stage === 'frying') return blocked('still-frying');
        if (f.stage === 'burnt') {
          f.stage = 'empty';
          return done('dump-fries');
        }
        if (f.stage === 'ready') {
          f.stage = 'empty';
          st.carry.kind = 'fries';
          return done('take-fries');
        }
        f.stage = 'frying';
        f.left = st.cfg.fryerSec;
        return done('fry');
      }

      /** Empty-handed: start a cup, take the full one, or wipe up an overflowed one */
      function useDrinks(st) {
        if (st.cfg.drinkSec === undefined) return blocked('unsupported');
        if (st.carry.kind !== 'none') return blocked('hands-full');
        var d = st.drinks;
        if (d.stage === 'pouring') return blocked('still-pouring');
        if (d.stage === 'spilled') {
          d.stage = 'empty';
          return done('wipe-spill');
        }
        if (d.stage === 'ready') {
          d.stage = 'empty';
          st.carry.kind = 'drink';
          return done('take-drink');
        }
        d.stage = 'pouring';
        d.left = st.cfg.drinkSec;
        return done('pour');
      }

      /** Empty-handed: take it off the wall; holding it: hang it back */
      function useExtinguisher(st) {
        if (st.cfg.fireSec === undefined) return blocked('unsupported');
        if (st.carry.kind === 'extinguisher') {
          st.carry.kind = 'none';
          return done('return-extinguisher');
        }
        if (st.carry.kind !== 'none') return blocked('hands-full');
        st.carry.kind = 'extinguisher';
        return done('take-extinguisher');
      }

      /** 空手点洗碗池：把池边的脏盘全部泡进去 */
      function loadSink(st) {
        var _st$cfg$wash$soakSec, _st$cfg$wash;
        if (st.carry.kind !== 'none') return blocked('hands-full');
        var sink = st.sink;
        if (sink.stage === 'soaking') return blocked('still-soaking');
        if (sink.stage === 'soaked') return blocked('sink-busy');
        if (st.dirty <= 0) return blocked('nothing-to-wash');
        sink.stage = 'soaking';
        sink.count = st.dirty;
        sink.left = (_st$cfg$wash$soakSec = (_st$cfg$wash = st.cfg.wash) == null ? void 0 : _st$cfg$wash.soakSec) != null ? _st$cfg$wash$soakSec : DEFAULT_WASH.soakSec;
        sink.scrub = 0;
        st.dirty = 0;
        return done('soak');
      }

      /**
       * 按住动作键刷一帧。泡好了才能刷，刷满进架子晾（架子上那批没晾完就刷不完 —— 放不下）。
       * 返回这一帧有没有在刷，组件拿它播动画。
       */
      function scrubSink(st, dt) {
        var _st$cfg$wash2;
        var sink = st.sink;
        if (sink.stage !== 'soaked' || st.carry.kind !== 'none') return false;
        var w = (_st$cfg$wash2 = st.cfg.wash) != null ? _st$cfg$wash2 : DEFAULT_WASH;
        sink.scrub = Math.min(1, sink.scrub + dt / w.scrubSec);
        if (sink.scrub >= 1 && st.rack.count === 0) toRack(st, false);
        return true;
      }

      /**
       * 刷到一半松手：过了 STAIN_MIN 这批就带着污渍上架（偷工换时间，GDD §12.5）；
       * 没过就当没刷完，进度留着回来接着刷。架子还有一批在晾时放不上去，同样留着。返回是不是偷工上架了。
       */
      function releaseScrub(st) {
        var sink = st.sink;
        if (sink.stage !== 'soaked' || sink.scrub < STAIN_MIN || sink.scrub >= 1 || st.rack.count > 0) return false;
        toRack(st, true);
        return true;
      }
      function toRack(st, stained) {
        var _st$cfg$wash3;
        var sink = st.sink;
        st.rack.count = sink.count;
        st.rack.left = ((_st$cfg$wash3 = st.cfg.wash) != null ? _st$cfg$wash3 : DEFAULT_WASH).drySec;
        st.rack.stained = stained;
        sink.stage = 'empty';
        sink.count = 0;
        sink.scrub = 0;
      }

      /** 空手或手上的摞还没满：从架子上把晾好的拿走。带污渍的先拿。`spare` = from the storeroom's spares instead (never stained) */
      function takeFromRack(st, spare) {
        var _st$cfg$stackMax;
        if (spare === void 0) {
          spare = false;
        }
        var c = st.carry;
        if (c.kind !== 'none' && c.kind !== 'stack') return blocked('hands-full');
        var have = c.kind === 'stack' ? c.count : 0;
        var max = (_st$cfg$stackMax = st.cfg.stackMax) != null ? _st$cfg$stackMax : STACK_MAX;
        if (have >= max) return blocked('stack-full');
        var rack = st.rack;
        var avail = spare ? st.spare : rack.ready;
        if (avail <= 0) return blocked(spare ? 'out-of-stock' : 'rack-empty');
        var n = Math.min(avail, max - have);
        var ns = spare ? 0 : Math.min(rack.readyStained, n);
        if (spare) st.spare -= n;else {
          rack.ready -= n;
          rack.readyStained -= ns;
        }
        c.kind = 'stack';
        c.count = have + n;
        c.countStained = (have > 0 ? c.countStained : 0) + ns;
        return done('take-stack');
      }
      function putOnShelf(st) {
        var c = st.carry;
        if (c.kind !== 'stack') return blocked(c.kind === 'none' ? 'hands-empty' : 'hands-full');
        st.plates += c.count;
        st.stained += c.countStained;
        c.kind = 'none';
        c.count = 0;
        c.countStained = 0;
        return done('shelve');
      }

      /** 端着超过 STACK_SLOW 个盘子走得慢 */
      function carrySpeedFactor(st) {
        var _st$cfg$stackSlow;
        return st.carry.kind === 'stack' && st.carry.count > ((_st$cfg$stackSlow = st.cfg.stackSlow) != null ? _st$cfg$stackSlow : STACK_SLOW) ? STACK_SLOW_SPEED : 1;
      }

      /**
       * 这一帧撞上了东西（`impact` 取 movement.impact）。端着的摞超过 STACK_SLOW 个、且是迎面撞上
       * 而不是蹭着墙走，就全摔了。返回摔了几个。
       */
      function bumpStack(st, impact) {
        var _st$cfg$stackSlow2;
        var c = st.carry;
        if (c.kind !== 'stack' || c.count <= ((_st$cfg$stackSlow2 = st.cfg.stackSlow) != null ? _st$cfg$stackSlow2 : STACK_SLOW) || impact < CRASH_IMPACT) return 0;
        var n = c.count;
        st.broken += n;
        st.crashed++;
        c.kind = 'none';
        c.count = 0;
        c.countStained = 0;
        return n;
      }

      /**
       * 堂食上完菜：盘子在顾客手上，过一会儿脏着送回池边。外卖装袋带走，盘子当场回到放盘处。
       * 盘子无上限（模拟器）时什么都不做。
       */
      function plateOut(st, dineIn) {
        var _st$cfg$wash$returnSe, _st$cfg$wash4;
        if (st.plates === Infinity) return;
        if (!dineIn) {
          st.plates++;
          return;
        }
        var sec = (_st$cfg$wash$returnSe = (_st$cfg$wash4 = st.cfg.wash) == null ? void 0 : _st$cfg$wash4.returnSec) != null ? _st$cfg$wash$returnSe : DEFAULT_WASH.returnSec;
        var i = st.returning.findIndex(function (x) {
          return x <= 0;
        });
        if (i >= 0) st.returning[i] = sec;else st.returning.push(sec);
      }
      function serveTo(st, spec, dineIn) {
        if (st.carry.kind === 'fries') {
          // Deliveries never order fries, so the rider's spec never asks for them either
          if (!(spec != null && spec.fries)) return blocked('no-order');
          st.carry.kind = 'none';
          return done('serve-fries');
        }
        if (st.carry.kind === 'drink') {
          if (!(spec != null && spec.drink)) return blocked('no-order');
          st.carry.kind = 'none';
          return done('serve-drink');
        }
        if (st.carry.kind !== 'plate') return blocked('hands-empty');
        if (spec === undefined) return blocked('no-order');
        if (!hasCore(st.burger)) return blocked('incomplete-burger');
        var verdict = judge(st.burger, spec);
        st.carry.kind = 'none';
        resetBurger(st.burger);
        if (st.burgerPlated) {
          plateOut(st, dineIn);
          if (st.burgerStained && dineIn) st.stainedServed++;
        }
        st.burgerPlated = false;
        st.burgerStained = false;
        return done('serve', -1, verdict);
      }

      /**
       * 丢掉手上的东西。烤糊的肉只有这一条出路 —— 触发方式（长按 / 垃圾桶工位）由 UI 定。
       */
      /**
       * 重开一局：清空手上、组装台与全部烤位。
       *
       * 不重建对象，原地清 —— 结算面板上按「再来一局」是高频操作，
       * 每次重建 KitchenState 等于每局丢一批垃圾给 GC（铁律②）。
       */
      function resetKitchen(st) {
        var _st$cfg$fridgeCap3, _st$cfg$plates, _st$cfg$sparePlates;
        st.t = 0;
        st.carry.kind = 'none';
        st.carry.ingredient = 'bun';
        st.carry.second = null;
        st.carry.cook = 'raw';
        st.carry.plated = false;
        st.carry.stained = false;
        st.carry.count = 0;
        st.carry.countStained = 0;
        for (var _iterator2 = _createForOfIteratorHelperLoose(st.grill), _step2; !(_step2 = _iterator2()).done;) {
          var g = _step2.value;
          g.busy = false;
          g.elapsed = 0;
        }
        resetBurger(st.burger);
        st.assemblyOccupied = false;
        st.burgerPlated = false;
        st.burgerStained = false;
        st.stock.fill((_st$cfg$fridgeCap3 = st.cfg.fridgeCap) != null ? _st$cfg$fridgeCap3 : Infinity);
        st.burnt = 0;
        st.plates = (_st$cfg$plates = st.cfg.plates) != null ? _st$cfg$plates : Infinity;
        st.stained = 0;
        st.broken = 0;
        st.spare = (_st$cfg$sparePlates = st.cfg.sparePlates) != null ? _st$cfg$sparePlates : 0;
        st.crashed = 0;
        st.stainedServed = 0;
        st.dirty = 0;
        st.returning.fill(0);
        st.sink.stage = 'empty';
        st.sink.count = 0;
        st.sink.left = 0;
        st.sink.scrub = 0;
        st.rack.count = 0;
        st.rack.left = 0;
        st.rack.stained = false;
        st.rack.ready = 0;
        st.rack.readyStained = 0;
        st.fryer.stage = 'empty';
        st.fryer.left = 0;
        st.burntFries = 0;
        st.fire = false;
        st.fires = 0;
        st.drinks.stage = 'empty';
        st.drinks.left = 0;
        st.spills = 0;
      }
      function discard(st) {
        if (st.carry.kind === 'none') return blocked('hands-empty');
        // The food goes in the bin, the plate goes to the sink — clean ones too, they have been dropped
        if (st.carry.kind === 'stack') st.dirty += st.carry.count;
        var plated = st.carry.kind === 'plate' ? st.burgerPlated : st.carry.plated;
        if (plated && st.plates !== Infinity) st.dirty++;
        if (st.carry.kind === 'plate') {
          resetBurger(st.burger);
          st.burgerPlated = false;
          st.burgerStained = false;
        }
        st.carry.plated = false;
        st.carry.stained = false;
        st.carry.count = 0;
        st.carry.countStained = 0;
        st.carry.second = null;
        st.carry.kind = 'none';
        return done('discard');
      }
      function resetBurger(b) {
        b.ingredients.length = 0;
        b.cook = null;
        b["double"] = false;
        b.cook2 = null;
      }
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/main", ['./camera.ts', './collision.ts', './customer.ts', './decor.ts', './delivery.ts', './difficulty.ts', './economy.ts', './input.ts', './kitchen.ts', './movement.ts', './order.ts', './progress.ts', './recipe.ts', './reviews.ts', './rng.ts', './shift.ts', './shop.ts', './sim.ts', './tasks.ts', './types.ts', './vec2.ts', './vent.ts', './witness.ts', './A7Probe.ts', './Bubble.ts', './BurgerStack.ts', './Controls.ts', './Feel.ts', './ReviewUi.ts', './Ring.ts', './Sfx.ts', './ShopUi.ts', './StationView.ts', './TaskUi.ts', './WallCutaway.ts', './a7-check.ts', './cardLines.ts'], function () {
  return {
    setters: [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
    execute: function () {}
  };
});

System.register("chunks:///_virtual/movement.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc', './collision.ts', './input.ts', './vec2.ts'], function (exports) {
  var _createForOfIteratorHelperLoose, cclegacy, resolveCircleAABB, stickToVelocity, normalize, scale;
  return {
    setters: [function (module) {
      _createForOfIteratorHelperLoose = module.createForOfIteratorHelperLoose;
    }, function (module) {
      cclegacy = module.cclegacy;
    }, function (module) {
      resolveCircleAABB = module.resolveCircleAABB;
    }, function (module) {
      stickToVelocity = module.stickToVelocity;
    }, function (module) {
      normalize = module.normalize;
      scale = module.scale;
    }],
    execute: function () {
      exports({
        createMovement: createMovement,
        moveAndSlide: moveAndSlide,
        stepMovement: stepMovement,
        teleport: teleport
      });
      cclegacy._RF.push({}, "25a96bRXslK66Y+P/0czi2U", "movement", undefined);

      // ─────────────────────────── 常量 ───────────────────────────

      /** 玩家碰撞半径。出处：`Body` 的 scale (0.7, 0.6, 0.7) → 直径 0.7 m（m2-scene-guide §2.3） */
      var CHEF_RADIUS = exports('CHEF_RADIUS', 0.35);

      /**
       * 米/秒。与 `sim.ts` 的 `defaultSimConfig().chef.speed` 是同一个数 —— M1 的难度曲线
       * 就是按它标定的。两处漂移会让 M1 的参数对真游戏失效，`movement.test.ts` 有一条断言盯着。
       */
      var DEFAULT_CHEF_SPEED = exports('DEFAULT_CHEF_SPEED', 4);

      /**
       * 单帧 dt 上限，秒。切后台回来 / 长掉帧的那一帧 dt 可能有好几秒，
       * 不夹住角色会一步瞬移穿过灶台（连续碰撞检测的成本不值得为这一帧付）。
       */
      var MAX_STEP_DT = exports('MAX_STEP_DT', 0.1);

      /** 解算轮数。工位间隙 ≥1.5 m > 直径 0.7 m，同时嵌进两个工位不可能；2 轮是留给「工位 + 边界」的角落 */
      var RESOLVE_ITERATIONS = 2;

      // ─────────────────────────── 边界 ───────────────────────────

      /** 可走区域的矩形内沿（米）。圆心被夹进来时还要各让出一个半径 */
      /**
       * 地板外接矩形。出处：scene-spec 的 `Floor` / `Floor_East` / `Floor_Store` 三块并起来。
       * 库房那块只有北半边，南半边空着的角靠 Blockers 里的墙挡住，走不进去。
       */
      var FLOOR_BOUNDS = exports('FLOOR_BOUNDS', {
        xmin: -4,
        xmax: 13.5,
        zmin: -3,
        zmax: 3
      });

      /** 把圆心夹进边界，返回是否夹过。边界比半径还窄时取中点，不让 min 反超 max */
      function clampToBounds(out, radius, b) {
        var loX = b.xmin + radius;
        var hiX = b.xmax - radius;
        var loZ = b.zmin + radius;
        var hiZ = b.zmax - radius;
        var x = loX > hiX ? (b.xmin + b.xmax) / 2 : out.x < loX ? loX : out.x > hiX ? hiX : out.x;
        var z = loZ > hiZ ? (b.zmin + b.zmax) / 2 : out.z < loZ ? loZ : out.z > hiZ ? hiZ : out.z;
        var hit = x !== out.x || z !== out.z;
        out.x = x;
        out.z = z;
        return hit;
      }

      // ─────────────────────────── 通用解算 ───────────────────────────

      /**
       * 一步位移 → 合法位置。先推出所有盒子，再夹进边界，重复到不再动为止。
       *
       * `out` 可以就是 `pos`（原地解算）。返回本步是否被挡过 —— 组件拿去播撞墙反馈，
       * 顾客 AI 之后拿它判「路被堵住了」。
       */
      function moveAndSlide(out, pos, step, radius, boxes, bounds) {
        out.x = pos.x + step.x;
        out.z = pos.z + step.z;
        var blocked = false;
        for (var iter = 0; iter < RESOLVE_ITERATIONS; iter++) {
          var moved = false;
          for (var i = 0; i < boxes.length; i++) {
            if (resolveCircleAABB(out, out, radius, boxes[i])) moved = true;
          }
          if (clampToBounds(out, radius, bounds)) moved = true;
          if (!moved) break;
          blocked = true;
        }
        return blocked;
      }

      // ─────────────────────────── 玩家 ───────────────────────────

      function createMovement(init) {
        var _init$x, _init$z, _init$speed, _init$radius, _init$bounds;
        if (init === void 0) {
          init = {};
        }
        var boxes = [];
        if (init.stations) {
          for (var _iterator = _createForOfIteratorHelperLoose(init.stations), _step; !(_step = _iterator()).done;) {
            var s = _step.value;
            boxes.push(s.box);
          }
        }
        if (init.boxes) {
          for (var _iterator2 = _createForOfIteratorHelperLoose(init.boxes), _step2; !(_step2 = _iterator2()).done;) {
            var b = _step2.value;
            boxes.push(b);
          }
        }
        return {
          pos: {
            x: (_init$x = init.x) != null ? _init$x : 0,
            z: (_init$z = init.z) != null ? _init$z : 0
          },
          facing: {
            x: 0,
            z: 1
          },
          facingYaw: 0,
          moving: false,
          blocked: false,
          impact: 0,
          cfg: {
            speed: (_init$speed = init.speed) != null ? _init$speed : DEFAULT_CHEF_SPEED,
            radius: (_init$radius = init.radius) != null ? _init$radius : CHEF_RADIUS,
            bounds: (_init$bounds = init.bounds) != null ? _init$bounds : FLOOR_BOUNDS,
            boxes: boxes
          },
          _step: {
            x: 0,
            z: 0
          }
        };
      }

      /**
       * 玩家一帧。组件那边只需要：`tick(dt)` 摇杆 → 这里 → 把 `pos` / `facingYaw` 写回节点。
       *
       * 朝向取自**碰撞前**的方向：贴着灶台侧滑时解算后的位移是沿墙的，拿它算朝向
       * 会让角色在蹭墙时来回扭头。
       */
      function stepMovement(st, stick, cameraYaw, dt) {
        var clamped = dt > MAX_STEP_DT ? MAX_STEP_DT : dt;
        if (!stickToVelocity(st._step, stick, cameraYaw, st.cfg.speed) || clamped <= 0) {
          st.moving = false;
          st.blocked = false;
          st.impact = 0;
          return;
        }
        normalize(st.facing, st._step);
        st.facingYaw = Math.atan2(st.facing.x, st.facing.z);
        scale(st._step, st._step, clamped);
        var x0 = st.pos.x;
        var z0 = st.pos.z;
        st.blocked = moveAndSlide(st.pos, st.pos, st._step, st.cfg.radius, st.cfg.boxes, st.cfg.bounds);
        var want = Math.hypot(st._step.x, st._step.z);
        st.impact = st.blocked && want > 0 ? Math.max(0, 1 - Math.hypot(st.pos.x - x0, st.pos.z - z0) / want) : 0;
        st.moving = true;
      }

      /** 把角色放回某处（开局、重开一局）。不走碰撞解算，调用方自己保证位置合法 */
      function teleport(st, x, z) {
        st.pos.x = x;
        st.pos.z = z;
        st.moving = false;
        st.blocked = false;
        st.impact = 0;
      }
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/order.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc', './types.ts'], function (exports) {
  var _createForOfIteratorHelperLoose, cclegacy, CORE_INGREDIENTS, INGREDIENTS;
  return {
    setters: [function (module) {
      _createForOfIteratorHelperLoose = module.createForOfIteratorHelperLoose;
    }, function (module) {
      cclegacy = module.cclegacy;
    }, function (module) {
      CORE_INGREDIENTS = module.CORE_INGREDIENTS;
      INGREDIENTS = module.INGREDIENTS;
    }],
    execute: function () {
      exports({
        judge: judge,
        validateOrderSpec: validateOrderSpec
      });
      cclegacy._RF.push({}, "4c431Egvu5CR5fZ3YOfSi9b", "order", undefined);

      /**
       * 判定结果。逐项列全而不在第一个错误处短路 —— 评价系统要按具体错项挑 complain，
       * 「缺芝士又放了洋葱」只报一半就没法挑。
       */

      /**
       * 判一单。
       *
       * 额外食材（既不在 required 也不在 banned）**不算错** —— banned 是唯一的否定通道。
       * 顾客没说不要，就不能罚玩家。
       *
       * 会分配一个 verdict 与两个数组：只在上菜那一刻调用，不在每帧热路径上（铁律②）。
       */
      function judge(burger, spec) {
        var missing = [];
        for (var i = 0; i < spec.required.length; i++) {
          var ing = spec.required[i];
          if (!burger.ingredients.includes(ing)) missing.push(ing);
        }

        // A double order needs the second patty; an extra one on a single order is not an error (same rule as extras)
        if (spec["double"] && !burger["double"] && burger.ingredients.includes('patty')) missing.push('patty');
        var forbidden = [];
        for (var _i = 0; _i < spec.banned.length; _i++) {
          var _ing = spec.banned[_i];
          if (burger.ingredients.includes(_ing)) forbidden.push(_ing);
        }

        // cook 为 null（压根没放肉饼）时这里自然为 false，不需要特判
        var cookOk = burger.cook === spec.doneness && (!burger["double"] || burger.cook2 === spec.doneness);
        return {
          ok: missing.length === 0 && forbidden.length === 0 && cookOk,
          missing: missing,
          forbidden: forbidden,
          cookOk: cookOk
        };
      }

      /**
       * 校验一张顾客卡的机制层是否可解。
       *
       * 给内容管线用（pipeline/ 生成 10000 张卡时逐张过），不在运行时调用。
       * 返回问题描述列表，空数组 = 合法。
       *
       * 存在的理由：JSON Schema 能拦住词表外的取值，拦不住「required 与 banned 同时含洋葱」
       * 这种自相矛盾 —— 那种卡进了包体，玩家会遇到一单永远做不出来。
       */
      function validateOrderSpec(spec) {
        var problems = [];
        var vocabulary = INGREDIENTS;
        for (var _iterator = _createForOfIteratorHelperLoose(spec.required), _step; !(_step = _iterator()).done;) {
          var ing = _step.value;
          if (!vocabulary.includes(ing)) problems.push("required \u542B\u8BCD\u8868\u5916\u98DF\u6750\uFF1A" + ing);
        }
        for (var _iterator2 = _createForOfIteratorHelperLoose(spec.banned), _step2; !(_step2 = _iterator2()).done;) {
          var _ing2 = _step2.value;
          if (!vocabulary.includes(_ing2)) problems.push("banned \u542B\u8BCD\u8868\u5916\u98DF\u6750\uFF1A" + _ing2);
        }
        for (var _iterator3 = _createForOfIteratorHelperLoose(spec.required), _step3; !(_step3 = _iterator3()).done;) {
          var _ing3 = _step3.value;
          if (spec.banned.includes(_ing3)) {
            problems.push("required \u4E0E banned \u540C\u65F6\u542B " + _ing3 + "\uFF0C\u8FD9\u5355\u6C38\u8FDC\u505A\u4E0D\u51FA\u6765");
          }
        }
        for (var _iterator4 = _createForOfIteratorHelperLoose(CORE_INGREDIENTS), _step4; !(_step4 = _iterator4()).done;) {
          var core = _step4.value;
          if (!spec.required.includes(core)) problems.push("required \u7F3A\u9AA8\u67B6\u98DF\u6750 " + core);
          if (spec.banned.includes(core)) problems.push("banned \u542B\u9AA8\u67B6\u98DF\u6750 " + core + "\uFF0C\u4E0D\u6210\u5176\u4E3A\u6C49\u5821");
        }
        if (!(spec.patience > 0)) problems.push("patience \u5FC5\u987B\u4E3A\u6B63\u6570\uFF0C\u5F53\u524D " + spec.patience);
        return problems;
      }
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/progress.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc', './difficulty.ts', './decor.ts'], function (exports) {
  var _extends, cclegacy, difficultyForDay, newDecor, parseDecor;
  return {
    setters: [function (module) {
      _extends = module.extends;
    }, function (module) {
      cclegacy = module.cclegacy;
    }, function (module) {
      difficultyForDay = module.difficultyForDay;
    }, function (module) {
      newDecor = module.newDecor;
      parseDecor = module.parseDecor;
    }],
    execute: function () {
      exports({
        bank: bank,
        dayFlow: dayFlow,
        finishDay: finishDay,
        newProgress: newProgress,
        parseProgress: parseProgress,
        serializeProgress: serializeProgress
      });
      cclegacy._RF.push({}, "59453kr+35LBLmn4LN2g+Qj", "progress", undefined);
      var SAVE_KEY = exports('SAVE_KEY', 'kc.progress');
      /** v1 had no coins; it still loads, with coins 0 */
      var VERSION = 2;

      /** ⏳ 占位：一星就放行，等真人数据再定 */
      var PASS_STARS = exports('PASS_STARS', 1);
      function newProgress() {
        return {
          day: 1,
          best: [],
          coins: 0,
          owned: [],
          decor: newDecor()
        };
      }
      function parseProgress(raw) {
        if (!raw) return newProgress();
        var o;
        try {
          o = JSON.parse(raw);
        } catch (_unused) {
          return newProgress();
        }
        if (!o || o.v !== 1 && o.v !== VERSION || !Number.isInteger(o.day) || !Array.isArray(o.best)) return newProgress();
        return {
          day: Math.max(1, o.day),
          best: o.best.map(function (n) {
            return Number.isInteger(n) ? Math.max(0, Math.min(3, n)) : 0;
          }),
          coins: Number.isInteger(o.coins) ? Math.max(0, o.coins) : 0,
          owned: Array.isArray(o.owned) ? o.owned.filter(function (x) {
            return typeof x === 'string';
          }) : [],
          decor: parseDecor(o.decor)
        };
      }
      function serializeProgress(p) {
        return JSON.stringify({
          v: VERSION,
          day: p.day,
          best: p.best,
          coins: p.coins,
          owned: p.owned,
          decor: p.decor
        });
      }

      /** 打完第 day 天：记最好成绩，过线就解锁下一天。返回这一局是否过线 */
      function finishDay(p, day, stars) {
        while (p.best.length < day) p.best.push(0);
        p.best[day - 1] = Math.max(p.best[day - 1], stars);
        if (stars < PASS_STARS) return false;
        p.day = Math.max(p.day, day + 1);
        return true;
      }

      /** Put the day's takings in the bank. Earned whether or not the day passed */
      function bank(p, amount) {
        p.coins += Math.max(0, Math.floor(amount));
      }

      /**
       * 真人局某一天的客流。难度表是按理想厨师标定的，真人跟不上那个间隔 ——
       * `arrivalSec` 是第 1 天的真人间隔，之后各天按难度表的比例一起收紧。
       */
      function dayFlow(day, arrivalSec) {
        var d = difficultyForDay(day);
        var k = arrivalSec / difficultyForDay(1).flow.intervalSec;
        return {
          flow: _extends({}, d.flow, {
            intervalSec: d.flow.intervalSec * k
          }),
          orders: d.orders
        };
      }
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/recipe.ts", ['cc', './types.ts'], function (exports) {
  var cclegacy, CORE_INGREDIENTS;
  return {
    setters: [function (module) {
      cclegacy = module.cclegacy;
    }, function (module) {
      CORE_INGREDIENTS = module.CORE_INGREDIENTS;
    }],
    execute: function () {
      exports({
        addCookedPatty: addCookedPatty,
        addIngredient: addIngredient,
        cookLevelAt: cookLevelAt,
        createBurger: createBurger,
        hasCore: hasCore
      });
      cclegacy._RF.push({}, "238c4ksjU1JU6LZpeOSfkUk", "recipe", undefined);
      function createBurger() {
        return {
          ingredients: [],
          cook: null
        };
      }

      /**
       * 往汉堡里加一样食材。已经有了就拒绝（同一样加两次没有玩法意义，只会让判定含糊）。
       *
       * 传 'patty' 表示玩家跳过烤炉、直接夹了块生肉 —— 做得出来，判定会失败。
       * 从烤炉拿的肉饼走 addCookedPatty。
       */
      function addIngredient(burger, ing) {
        if (burger.ingredients.includes(ing)) return false;
        burger.ingredients.push(ing);
        if (ing === 'patty') burger.cook = 'raw';
        return true;
      }

      /** 放入烤好的肉饼，汉堡的火候跟着这块肉走。一个汉堡只能有一块。 */
      function addCookedPatty(burger, cook, allowDouble) {
        if (allowDouble === void 0) {
          allowDouble = false;
        }
        if (burger.ingredients.includes('patty')) {
          if (!allowDouble || burger["double"]) return false;
          burger["double"] = true;
          burger.cook2 = cook;
          return true;
        }
        burger.ingredients.push('patty');
        burger.cook = cook;
        return true;
      }

      /** 骨架食材齐不齐 —— 面包 + 肉饼，缺一样就不成其为汉堡。 */
      function hasCore(burger) {
        for (var i = 0; i < CORE_INGREDIENTS.length; i++) {
          if (!burger.ingredients.includes(CORE_INGREDIENTS[i])) return false;
        }
        return true;
      }

      /**
       * The calibrated grill timeline (M1 headless sweep). Single source: sim.ts's
       * defaultSimConfig and the runtime component both read it from here, because a
       * second copy is a game that plays differently from the one we tuned.
       */
      var DEFAULT_COOK = exports('DEFAULT_COOK', {
        rareAt: 3,
        mediumAt: 6,
        wellAt: 9,
        burntAt: 13
      });

      /**
       * 肉饼在烤炉上待了 elapsed 秒之后是什么火候。
       *
       * 一条单向时间轴：raw → rare → medium → well → burnt，糊了就回不去。
       * 窗口宽度是 M1 无头模拟器要扫的核心参数之一 —— 窗口越窄，玩家越要盯着烤炉，
       * 压力就越大；所以数值只能来自 CookWindows，不许在别处写死。
       */
      function cookLevelAt(elapsed, w) {
        if (elapsed >= w.burntAt) return 'burnt';
        if (elapsed >= w.wellAt) return 'well';
        if (elapsed >= w.mediumAt) return 'medium';
        if (elapsed >= w.rareAt) return 'rare';
        return 'raw';
      }
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/reviews.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc'], function (exports) {
  var _createForOfIteratorHelperLoose, cclegacy;
  return {
    setters: [function (module) {
      _createForOfIteratorHelperLoose = module.createForOfIteratorHelperLoose;
    }, function (module) {
      cclegacy = module.cclegacy;
    }],
    execute: function () {
      exports({
        addReview: addReview,
        averageStars: averageStars,
        createReviewLog: createReviewLog,
        resetReviewLog: resetReviewLog,
        serveReview: serveReview
      });
      cclegacy._RF.push({}, "a592aZuHqVBNKgssnwq4M2t", "reviews", undefined);
      /**
       * 评价：顾客离店时给的星级 + 营业中的吐槽，按时间记一份，给顶部弹窗和电脑上的评价列表用。
       * 台词是表演层，这里只记「谁、哪一类、几星」，文本由组件按顾客卡去取。
       */
      function createReviewLog(cap) {
        if (cap === void 0) {
          cap = 30;
        }
        return {
          items: [],
          cap: cap
        };
      }
      function resetReviewLog(log) {
        log.items.length = 0;
      }
      function addReview(log, r) {
        log.items.push(r);
        if (log.items.length > log.cap) log.items.shift();
      }

      /**
       * 上菜后的星级。`ratioLeft` 取上菜那一刻的 patienceRatio（顾客还没离场时读）。
       * 做对且等得不久 5 星，等久了 4、3；超时才上（免单）2 星；上错 1 星。
       */
      function serveReview(ok, late, ratioLeft) {
        if (!ok) return {
          kind: 'complain',
          stars: 1
        };
        if (late) return {
          kind: 'complain',
          stars: 2
        };
        return {
          kind: 'praise',
          stars: ratioLeft > 0.5 ? 5 : ratioLeft > 0.25 ? 4 : 3
        };
      }

      /** 没人接单走掉的；外卖接了没送到也是这一档 */
      var WALKOUT_STARS = exports('WALKOUT_STARS', 1);

      /** 外卖拒单 / 挂着没理：扣一点评分，比做砸了轻 */
      var REJECT_STARS = exports('REJECT_STARS', 3);

      /** 店铺评分：所有带星的评价取平均，吐槽不算。没有评价返回 0 */
      function averageStars(log) {
        var sum = 0;
        var n = 0;
        for (var _iterator = _createForOfIteratorHelperLoose(log.items), _step; !(_step = _iterator()).done;) {
          var r = _step.value;
          if (r.stars <= 0) continue;
          sum += r.stars;
          n++;
        }
        return n > 0 ? sum / n : 0;
      }
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/ReviewUi.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc', './Feel.ts'], function (exports) {
  var _createForOfIteratorHelperLoose, cclegacy, Color, tween, Tween, Node, UITransform, UIOpacity, Graphics, Label, FEEL;
  return {
    setters: [function (module) {
      _createForOfIteratorHelperLoose = module.createForOfIteratorHelperLoose;
    }, function (module) {
      cclegacy = module.cclegacy;
      Color = module.Color;
      tween = module.tween;
      Tween = module.Tween;
      Node = module.Node;
      UITransform = module.UITransform;
      UIOpacity = module.UIOpacity;
      Graphics = module.Graphics;
      Label = module.Label;
    }, function (module) {
      FEEL = module.FEEL;
    }],
    execute: function () {
      exports('starsText', starsText);
      cclegacy._RF.push({}, "388d5BG4QtMlYtHawQa8SWH", "ReviewUi", undefined);

      /** Placeholder avatars until the character art has portraits: a coloured disc with the first glyph */
      var AVATAR = [new Color(231, 111, 81, 255), new Color(42, 157, 143, 255), new Color(233, 196, 106, 255), new Color(106, 76, 147, 255), new Color(69, 123, 157, 255), new Color(230, 57, 70, 255)];
      var BG = new Color(20, 22, 28, 215);
      var NAME = new Color(255, 215, 120, 255);
      function starsText(n) {
        return n > 0 ? '★'.repeat(n) + '☆'.repeat(5 - n) : '';
      }
      function addLabel(parent, name, size, x, y, w, left) {
        var n = new Node(name);
        n.layer = parent.layer;
        parent.addChild(n);
        n.setPosition(x, y, 0);
        var t = n.addComponent(UITransform);
        t.setContentSize(w, size + 6);
        if (left) t.setAnchorPoint(0, 0.5);
        var l = n.addComponent(Label);
        l.fontSize = size;
        l.lineHeight = size + 4;
        l.overflow = Label.Overflow.SHRINK;
        if (left) l.horizontalAlign = Label.HorizontalAlign.LEFT;
        return l;
      }
      function drawAvatar(g, x, y, r, idx) {
        g.fillColor = AVATAR[idx % AVATAR.length];
        g.circle(x, y, r);
        g.fill();
      }
      var TOAST_W = exports('TOAST_W', 1000);
      var W = TOAST_W;
      /** One row so it fits the strip above the order cards */
      var TOAST_H = exports('TOAST_H', 54);
      var H = TOAST_H;
      var SHOW_SEC = 4.5;
      var QUEUE_MAX = 4;

      /** Top-of-screen popup, one line at a time: avatar · who · stars · what they said */
      var Toast = exports('Toast', /*#__PURE__*/function () {
        function Toast(parent) {
          this.node = void 0;
          this.g = void 0;
          this.initial = void 0;
          this.name = void 0;
          this.text = void 0;
          this.opacity = void 0;
          this.queue = [];
          this.left = 0;
          this.fading = false;
          this.node = new Node('UI_Toast');
          this.node.layer = parent.layer;
          parent.addChild(this.node);
          this.node.addComponent(UITransform).setContentSize(W, H);
          this.opacity = this.node.addComponent(UIOpacity);
          this.g = this.node.addComponent(Graphics);
          this.initial = addLabel(this.node, 'Initial', 24, -W / 2 + 32, 0, 44, false);
          this.name = addLabel(this.node, 'Name', 22, -W / 2 + 64, 0, 280, true);
          this.name.color = NAME;
          this.text = addLabel(this.node, 'Text', 24, -W / 2 + 356, 0, W - 372, true);
          this.node.active = false;
        }
        var _proto = Toast.prototype;
        _proto.push = function push(line) {
          if (this.queue.length >= QUEUE_MAX) this.queue.shift();
          this.queue.push(line);
        };
        _proto.clear = function clear() {
          this.queue.length = 0;
          this.left = 0;
          this.node.active = false;
        }

        /** (x, y) = canvas coords of the popup's centre */;
        _proto.tick = function tick(dt, x, y) {
          if (this.left > 0) {
            this.left -= dt;
            if (this.left <= FEEL.fadeSec && !this.fading) {
              this.fading = true;
              tween(this.opacity).to(FEEL.fadeSec, {
                opacity: 0
              }).start();
            }
            if (this.left > 0) return;
            this.node.active = false;
          }
          var next = this.queue.shift();
          if (!next) return;
          this.show(next);
          this.node.setPosition(x, y, 0);
          this.left = SHOW_SEC;
        };
        _proto.show = function show(r) {
          var g = this.g;
          g.clear();
          g.fillColor = BG;
          g.roundRect(-W / 2, -H / 2, W, H, H / 2);
          g.fill();
          drawAvatar(g, -W / 2 + 32, 0, 22, r.avatar);
          this.initial.string = r.name.charAt(0);
          var stars = starsText(r.stars);
          this.name.string = stars ? r.name + "  " + stars : r.name;
          this.text.string = r.text;
          this.node.active = true;
          this.fading = false;
          Tween.stopAllByTarget(this.opacity);
          this.opacity.opacity = 0;
          tween(this.opacity).to(FEEL.fadeSec, {
            opacity: 255
          }).start();
        };
        return Toast;
      }());
      var BW = 640;
      var BH = 560;
      var ROWS = 5;
      var BTN_W = 84;
      var BTN_H = 40;
      var OK = new Color(60, 160, 90, 255);
      var NO = new Color(170, 70, 60, 255);

      /** A tappable rect in panel-local coordinates; the caller turns it into a capture zone */

      /** The order-counter computer: delivery offers with accept/reject on top, reviews below */
      var ComputerPanel = exports('ComputerPanel', /*#__PURE__*/function () {
        function ComputerPanel(parent, maxOffers) {
          this.node = void 0;
          this.buttons = [];
          this.g = void 0;
          this.title = void 0;
          this.offerTexts = [];
          this.offerNone = void 0;
          this.rows = [];
          this.empty = void 0;
          this.offerKey = '';
          this.reviewLines = [];
          this.node = new Node('UI_Computer');
          this.node.layer = parent.layer;
          parent.addChild(this.node);
          this.node.addComponent(UITransform).setContentSize(BW, BH);
          this.g = this.node.addComponent(Graphics);
          this.title = addLabel(this.node, 'Title', 24, 0, BH / 2 - 28, BW - 40, false);
          var sub = addLabel(this.node, 'OffersTitle', 18, -BW / 2 + 24, BH / 2 - 64, 200, true);
          sub.string = '外卖单';
          sub.color = NAME;
          for (var i = 0; i < maxOffers; i++) {
            var y = BH / 2 - 104 - i * 56;
            this.offerTexts.push(addLabel(this.node, "Offer_" + i, 18, -BW / 2 + 24, y, BW - 2 * BTN_W - 72, true));
            this.buttons.push({
              id: "accept" + i,
              x: BW / 2 - BTN_W * 1.5 - 30,
              y: y,
              w: BTN_W,
              h: BTN_H
            });
            this.buttons.push({
              id: "reject" + i,
              x: BW / 2 - BTN_W / 2 - 20,
              y: y,
              w: BTN_W,
              h: BTN_H
            });
            addLabel(this.node, "Accept_" + i, 18, BW / 2 - BTN_W * 1.5 - 30, y, BTN_W, false).string = '接单';
            addLabel(this.node, "Reject_" + i, 18, BW / 2 - BTN_W / 2 - 20, y, BTN_W, false).string = '拒单';
          }
          this.offerNone = addLabel(this.node, 'OffersNone', 18, 0, BH / 2 - 104, BW, false);
          this.offerNone.string = '暂时没有外卖单';
          var sub2 = addLabel(this.node, 'ReviewsTitle', 18, -BW / 2 + 24, BH / 2 - 104 - maxOffers * 56 + 6, 200, true);
          sub2.string = '顾客评价';
          sub2.color = NAME;
          var top = BH / 2 - 150 - maxOffers * 56;
          for (var _i = 0; _i < ROWS; _i++) {
            var _y = top - _i * 52;
            this.rows.push({
              initial: addLabel(this.node, "Initial_" + _i, 18, -BW / 2 + 36, _y, 36, false),
              name: addLabel(this.node, "Name_" + _i, 16, -BW / 2 + 62, _y + 12, BW - 80, true),
              text: addLabel(this.node, "Text_" + _i, 18, -BW / 2 + 62, _y - 10, BW - 80, true)
            });
            this.rows[_i].name.color = NAME;
          }
          this.empty = addLabel(this.node, 'Empty', 18, 0, top - 40, BW, false);
          this.empty.string = '还没有评价';
          this.node.active = false;
        }

        /** Reviews newest first. Call once on open and whenever a review lands. */
        var _proto2 = ComputerPanel.prototype;
        _proto2.show = function show(rating, lines) {
          this.title.string = rating > 0 ? "\u5E97\u94FA\u8BC4\u5206 " + rating.toFixed(1) + " \u2605  \xB7  \u70B9\u7A7A\u767D\u5904\u5173\u95ED" : '店铺评分 —  ·  点空白处关闭';
          for (var i = 0; i < ROWS; i++) {
            var row = this.rows[i];
            var r = lines[i];
            row.initial.node.active = row.name.node.active = row.text.node.active = !!r;
            if (!r) continue;
            row.initial.string = r.name.charAt(0);
            var stars = starsText(r.stars);
            row.name.string = stars ? r.name + "  " + stars : r.name + "  \xB7 \u5410\u69FD";
            row.text.string = r.text;
          }
          this.empty.node.active = lines.length === 0;
          this.reviewLines = lines;
          this.offerKey = '';
          this.node.active = true;
        }

        /** Per frame while open; redraws only when an offer's text or whole second changes */;
        _proto2.syncOffers = function syncOffers(offers) {
          var key = '';
          for (var _iterator = _createForOfIteratorHelperLoose(offers), _step; !(_step = _iterator()).done;) {
            var _o = _step.value;
            key += _o ? _o.sec + "|" + _o.text + ";" : '-;';
          }
          if (key === this.offerKey) return;
          this.offerKey = key;
          var g = this.g;
          g.clear();
          g.fillColor = BG;
          g.roundRect(-BW / 2, -BH / 2, BW, BH, 18);
          g.fill();
          var any = false;
          for (var i = 0; i < this.offerTexts.length; i++) {
            var _offers$i;
            var o = (_offers$i = offers[i]) != null ? _offers$i : null;
            var label = this.offerTexts[i];
            label.node.active = !!o;
            this.node.getChildByName("Accept_" + i).active = !!o;
            this.node.getChildByName("Reject_" + i).active = !!o;
            if (!o) continue;
            any = true;
            label.string = o.text + "  \uFF08" + o.sec + "s\uFF09";
            var a = this.buttons[i * 2];
            var r = this.buttons[i * 2 + 1];
            g.fillColor = OK;
            g.roundRect(a.x - a.w / 2, a.y - a.h / 2, a.w, a.h, 8);
            g.fill();
            g.fillColor = NO;
            g.roundRect(r.x - r.w / 2, r.y - r.h / 2, r.w, r.h, 8);
            g.fill();
          }
          this.offerNone.node.active = !any;
          var top = BH / 2 - 150 - this.offerTexts.length * 56;
          for (var _i2 = 0; _i2 < ROWS; _i2++) {
            var _r = this.reviewLines[_i2];
            if (_r) drawAvatar(g, -BW / 2 + 36, top - _i2 * 52, 18, _r.avatar);
          }
        };
        _proto2.hide = function hide() {
          this.node.active = false;
        };
        return ComputerPanel;
      }());
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/Ring.ts", ['cc'], function (exports) {
  var cclegacy, Color, Vec3, Node, UITransform, Graphics, Label;
  return {
    setters: [function (module) {
      cclegacy = module.cclegacy;
      Color = module.Color;
      Vec3 = module.Vec3;
      Node = module.Node;
      UITransform = module.UITransform;
      Graphics = module.Graphics;
      Label = module.Label;
    }],
    execute: function () {
      cclegacy._RF.push({}, "e2124pvGkBJjZ2RD7HfCiKs", "Ring", undefined);
      var R = 22;
      var W = 5;
      /** Arc is redrawn only when its fill crosses one of these steps */
      var STEPS = 60;
      var EDGE = 40;
      var DISC = new Color(0, 0, 0, 150);
      var TRACK = new Color(255, 255, 255, 60);

      /**
       * A countdown ring pinned over a 3D point, with a short glyph in the middle.
       * The ring sits on top of the anchor (its bottom edge touches it), so anchor at the head top.
       */
      var Ring = exports('Ring', /*#__PURE__*/function () {
        function Ring(parent, name, fontSize) {
          if (fontSize === void 0) {
            fontSize = 26;
          }
          this.node = void 0;
          this.g = void 0;
          this.label = void 0;
          this.step = -2;
          this.color = new Color();
          this.text = '';
          this.world = new Vec3();
          this.ui = new Vec3();
          this.node = new Node(name);
          this.node.layer = parent.layer;
          parent.addChild(this.node);
          this.node.addComponent(UITransform).setContentSize(2 * (R + W), 2 * (R + W));
          this.g = this.node.addComponent(Graphics);
          this.g.lineWidth = W;
          var t = new Node('Glyph');
          t.layer = parent.layer;
          this.node.addChild(t);
          this.label = t.addComponent(Label);
          this.label.fontSize = fontSize;
          this.label.lineHeight = fontSize + 2;
          this.node.active = false;
        }

        /** `fill` 0–1 is the arc left (clockwise from 12 o'clock); below 0 draws no arc. */
        var _proto = Ring.prototype;
        _proto.show = function show(fill, color, text, textColor) {
          if (textColor === void 0) {
            textColor = Color.WHITE;
          }
          if (!this.node.active) this.node.active = true;
          var step = fill < 0 ? -1 : Math.round(Math.min(1, fill) * STEPS);
          if (step !== this.step || !this.color.equals(color)) {
            this.step = step;
            this.color.set(color);
            this.redraw();
          }
          if (text !== this.text) {
            this.text = text;
            this.label.string = text;
          }
          if (!this.label.color.equals(textColor)) this.label.color = textColor;
        };
        _proto.hide = function hide() {
          if (this.node.active) this.node.active = false;
        };
        _proto.follow = function follow(cam, x, y, z, halfW, halfH, dx) {
          if (halfW === void 0) {
            halfW = Infinity;
          }
          if (halfH === void 0) {
            halfH = Infinity;
          }
          if (dx === void 0) {
            dx = 0;
          }
          this.world.set(x, y, z);
          cam.convertToUINode(this.world, this.node.parent, this.ui);
          this.ui.x += dx;
          this.ui.y += R + W;
          var mx = halfW - EDGE;
          var my = halfH - EDGE;
          this.ui.x = Math.max(-mx, Math.min(mx, this.ui.x));
          this.ui.y = Math.max(-my, Math.min(my, this.ui.y));
          this.node.setPosition(this.ui);
        };
        _proto.redraw = function redraw() {
          var g = this.g;
          g.clear();
          g.fillColor = DISC;
          g.circle(0, 0, R + W / 2);
          g.fill();
          g.strokeColor = TRACK;
          g.circle(0, 0, R);
          g.stroke();
          if (this.step <= 0) return;
          g.strokeColor = this.color;
          g.moveTo(0, R);
          g.arc(0, 0, R, Math.PI / 2, Math.PI / 2 - 2 * Math.PI * this.step / STEPS, false);
          g.stroke();
        };
        return Ring;
      }());
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/rng.ts", ['cc'], function (exports) {
  var cclegacy;
  return {
    setters: [function (module) {
      cclegacy = module.cclegacy;
    }],
    execute: function () {
      exports({
        chance: chance,
        createRng: createRng,
        nextFloat: nextFloat,
        nextInt: nextInt,
        nextRange: nextRange,
        pick: pick,
        reseed: reseed
      });
      cclegacy._RF.push({}, "bf66aaKID5LXL8yzd1rgFm4", "rng", undefined);
      /**
       * 可复现的伪随机源（mulberry32）。
       *
       * **为什么不用 Math.random**：M1 要扫参数空间——「耐心 45 秒」和「耐心 50 秒」哪个更难，
       * 只有在两次跑的客流、订单完全一样时才比得出来。用 Math.random 的话，
       * 观测到的差异里混着随机噪声，参数结论全不可信（这正是「两个比对量共享污染源」那条铁律的反面：
       * 这里要的是**消除**变量，不是比不变量）。
       *
       * 状态是一个 number，除 createRng 外全程零分配（铁律②）。
       */
      function createRng(seed) {
        return {
          s: seed >>> 0
        };
      }

      /** 把已有的发生器拨回起点。跑上千局时复用同一个对象，不新建。 */
      function reseed(rng, seed) {
        rng.s = seed >>> 0;
      }

      /** [0, 1) */
      function nextFloat(rng) {
        rng.s = rng.s + 0x6d2b79f5 >>> 0;
        var t = rng.s;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
      }

      /** [0, maxExclusive) 的整数 */
      function nextInt(rng, maxExclusive) {
        return Math.floor(nextFloat(rng) * maxExclusive);
      }

      /** [lo, hi) 的浮点。lo === hi 时恒返回 lo —— 扫参数时经常把某一维锁死。 */
      function nextRange(rng, lo, hi) {
        return lo + nextFloat(rng) * (hi - lo);
      }

      /** 从数组里等概率取一个。空数组是调用方的错误。 */
      function pick(rng, arr) {
        return arr[nextInt(rng, arr.length)];
      }

      /** 以概率 p 返回 true。p ≤ 0 恒假，p ≥ 1 恒真。 */
      function chance(rng, p) {
        return nextFloat(rng) < p;
      }
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/Sfx.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc'], function (exports) {
  var _createForOfIteratorHelperLoose, cclegacy, AudioSource, resources, AudioClip;
  return {
    setters: [function (module) {
      _createForOfIteratorHelperLoose = module.createForOfIteratorHelperLoose;
    }, function (module) {
      cclegacy = module.cclegacy;
      AudioSource = module.AudioSource;
      resources = module.resources;
      AudioClip = module.AudioClip;
    }],
    execute: function () {
      cclegacy._RF.push({}, "f1365Ur2rdGpq+wmIJRyrDq", "Sfx", undefined);

      /** File names under assets/resources/sfx (tools/gen-sfx.py) */

      /**
       * One-shot sound effects, loaded from the resources bundle so no scene wiring is needed.
       * Sound is never load-bearing: a missing bundle or clip just stays silent.
       */
      var Sfx = exports('Sfx', /*#__PURE__*/function () {
        function Sfx(host) {
          var _this = this;
          this.src = void 0;
          this.clips = new Map();
          this.src = host.addComponent(AudioSource);
          if (!resources) {
            console.warn('[Sfx] no resources bundle — muted');
            return;
          }
          resources.loadDir('sfx', AudioClip, function (err, list) {
            if (err) {
              console.warn("[Sfx] load failed \u2014 muted: " + err.message);
              return;
            }
            for (var _iterator = _createForOfIteratorHelperLoose(list), _step; !(_step = _iterator()).done;) {
              var c = _step.value;
              _this.clips.set(c.name, c);
            }
          });
        }
        var _proto = Sfx.prototype;
        _proto.play = function play(name, volume) {
          if (volume === void 0) {
            volume = 1;
          }
          var c = this.clips.get(name);
          if (c) this.src.playOneShot(c, volume);
        };
        return Sfx;
      }());
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/shift.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc', './customer.ts', './rng.ts'], function (exports) {
  var _extends, cclegacy, createCustomerFlow, resetCustomerFlow, stepCustomerFlow, releaseCustomer, createRng, reseed;
  return {
    setters: [function (module) {
      _extends = module.extends;
    }, function (module) {
      cclegacy = module.cclegacy;
    }, function (module) {
      createCustomerFlow = module.createCustomerFlow;
      resetCustomerFlow = module.resetCustomerFlow;
      stepCustomerFlow = module.stepCustomerFlow;
      releaseCustomer = module.releaseCustomer;
    }, function (module) {
      createRng = module.createRng;
      reseed = module.reseed;
    }],
    execute: function () {
      exports({
        createShift: createShift,
        resetShift: resetShift,
        settleFries: settleFries,
        settleServe: settleServe,
        settleSide: settleSide,
        shiftResult: shiftResult,
        starsForShift: starsForShift,
        stepShift: stepShift
      });
      cclegacy._RF.push({}, "6e621DzyFJNbboHxrJOJN+M", "shift", undefined);
      /** 真人局的顾客流：超时不走，来满就停 */
      var shiftFlow = function shiftFlow(cfg) {
        return _extends({}, cfg.flow, {
          stayWhenLate: true,
          maxArrivals: cfg.customers
        });
      };
      function createShift(cfg) {
        var rng = createRng(cfg.seed);
        return {
          t: 0,
          over: false,
          flow: createCustomerFlow(shiftFlow(cfg), cfg.orders, rng),
          served: 0,
          lateServed: 0,
          wrong: 0,
          cfg: cfg,
          rng: rng
        };
      }

      /** 重开一局。槽位与 RNG 都复用 */
      function resetShift(st, cfg) {
        if (cfg === void 0) {
          cfg = st.cfg;
        }
        st.cfg = cfg;
        st.t = 0;
        st.over = false;
        st.served = 0;
        st.lateServed = 0;
        st.wrong = 0;
        reseed(st.rng, cfg.seed);
        resetCustomerFlow(st.flow, shiftFlow(cfg), cfg.orders);
      }

      /** 一帧。最后一位顾客离开的那一帧置 over */
      function stepShift(st, dt, onWalkOut) {
        if (st.over) return;
        st.t += dt;
        stepCustomerFlow(st.flow, st.t, dt, undefined, undefined, onWalkOut);
        if (st.flow.arrived >= st.cfg.customers && st.flow.activeCount === 0) st.over = true;
      }

      /**
       * 上菜记账。`verdict` 来自 `kitchen.interact(serve)`，`c` 来自 `matchCustomer()`。
       *
       * 顾客在这里离场（除非还等着薯条，返回 false）—— 对错都走，**上错菜不给第二次机会**：能重试的话玩家会拿出餐口
       * 当试错工具，一单一单试到对为止，banned 那一维就白设计了。
       */
      function settleServe(st, c, verdict) {
        // Right burger, a side still due: keep waiting. A wrong burger ends it now — nothing left to wait for
        if (verdict.ok && (c.friesDue || c.drinkDue)) {
          c.burgerVerdict = verdict;
          return false;
        }
        settle(st, c, verdict);
        return true;
      }

      /** Fries handed to `c` (from matchFries). Returns the order's verdict when that completes it, else null */
      function settleFries(st, c) {
        return settleSide(st, c, 'fries');
      }

      /** A side handed to `c` (from matchSide). Returns the order's verdict when that completes it, else null */
      function settleSide(st, c, side) {
        if (side === 'fries') c.friesDue = false;else c.drinkDue = false;
        var v = c.burgerVerdict;
        if (!v || c.friesDue || c.drinkDue) return null;
        settle(st, c, v);
        return v;
      }
      function settle(st, c, verdict) {
        if (!verdict.ok) st.wrong++;else if (c.late) st.lateServed++;else st.served++;
        releaseCustomer(st.flow, c);
        if (st.flow.arrived >= st.cfg.customers && st.flow.activeCount === 0) st.over = true;
      }
      function shiftResult(st) {
        var arrived = st.flow.arrived;
        return {
          arrived: arrived,
          served: st.served,
          lateServed: st.lateServed,
          wrong: st.wrong,
          timedOut: st.flow.timedOut,
          walkedOut: st.flow.walkedOut,
          leftLate: st.flow.leftLate,
          goodRate: arrived === 0 ? 1 : st.served / arrived
        };
      }

      /** 好评率 → 星级。⏳ 三条线是占位值，等真人数据再定 */
      function starsForShift(r) {
        if (r.goodRate >= 0.9) return 3;
        if (r.goodRate >= 0.7) return 2;
        if (r.goodRate >= 0.5) return 1;
        return 0;
      }
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/shop.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc'], function (exports) {
  var _createForOfIteratorHelperLoose, cclegacy;
  return {
    setters: [function (module) {
      _createForOfIteratorHelperLoose = module.createForOfIteratorHelperLoose;
    }, function (module) {
      cclegacy = module.cclegacy;
    }],
    execute: function () {
      exports({
        buy: buy,
        flowFactor: flowFactor,
        owns: owns
      });
      cclegacy._RF.push({}, "ac574ony+VNja9PGUIF43k1", "shop", undefined);
      /**
       * Shop (ROADMAP batch 4): coins buy stations and upgrades, kept in the save. Zero Cocos (铁律①).
       * ⚠ No "second grill": M1 measured the grill is not the bottleneck, walking is. Upgrades speed things up instead.
       * ⏳ Every price and effect size here is self-chosen until tuned on device.
       */
      var SHOP = exports('SHOP', [{
        id: 'fryer',
        name: '炸锅',
        price: 150,
        desc: '顾客会加点薯条，每份多收 ¥4'
      }, {
        id: 'drinks',
        name: '饮料机',
        price: 250,
        desc: '顾客会加点饮料，每杯多收 ¥3（接满不拿会溢出）'
      }, {
        id: 'fast-grill',
        name: '烤得更快',
        price: 120,
        desc: '烤肉快 20%（糊得也快），客人来得更勤'
      }, {
        id: 'fast-wash',
        name: '洗得更快',
        price: 100,
        desc: '泡、刷、晾都快 30%，客人来得更勤'
      }, {
        id: 'big-tray',
        name: '大托盘',
        price: 80,
        desc: '一趟搬 7 个盘子（5 个以上变慢），客人来得更勤'
      }]);

      /** Share of diners who add fries once the fryer is bought */
      var FRIES_CHANCE = exports('FRIES_CHANCE', 0.4);
      var DRINK_CHANCE = exports('DRINK_CHANCE', 0.35);
      var FAST_GRILL = exports('FAST_GRILL', 0.8);
      var FAST_WASH = exports('FAST_WASH', 0.7);
      var BIG_TRAY = exports('BIG_TRAY', {
        max: 7,
        slow: 5
      });
      /**
       * Arrival interval multiplier per upgrade: a faster kitchen also gets busier, or the game goes idle (GDD §12.2).
       * The fryer adds its own work, so it has none. ⏳ Self-chosen
       */
      var FLOW_UP = exports('FLOW_UP', {
        'fast-grill': 0.92,
        'fast-wash': 0.95,
        'big-tray': 0.95
      });

      /** Nothing bought = exactly 1, so the M1-calibrated flow is untouched */
      function flowFactor(p) {
        var k = 1;
        for (var _iterator = _createForOfIteratorHelperLoose(p.owned), _step; !(_step = _iterator()).done;) {
          var _FLOW_UP;
          var id = _step.value;
          k *= (_FLOW_UP = FLOW_UP[id]) != null ? _FLOW_UP : 1;
        }
        return k;
      }
      function owns(p, id) {
        return p.owned.includes(id);
      }
      function buy(p, id) {
        var item = SHOP.find(function (x) {
          return x.id === id;
        });
        if (!item) return 'unknown';
        if (p.owned.includes(item.id)) return 'owned';
        if (p.coins < item.price) return 'poor';
        p.coins -= item.price;
        p.owned.push(item.id);
        return 'ok';
      }
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/ShopUi.ts", ['cc'], function (exports) {
  var cclegacy, Color, UITransform, Node, Graphics, Label;
  return {
    setters: [function (module) {
      cclegacy = module.cclegacy;
      Color = module.Color;
      UITransform = module.UITransform;
      Node = module.Node;
      Graphics = module.Graphics;
      Label = module.Label;
    }],
    execute: function () {
      cclegacy._RF.push({}, "ad745oMc2dFgZsqQcVXEVML", "ShopUi", undefined);
      var W = 640;
      var ROW_H = 76;
      var HEAD_H = 72;
      var BTN_W = 96;
      var BTN_H = 44;
      var BG = new Color(20, 22, 28, 250);
      var NAME = new Color(255, 215, 120, 255);
      var ON = new Color(60, 160, 90, 255);
      var OFF = new Color(90, 90, 96, 255);
      function addLabel(parent, size, w, left) {
        var n = new Node('Label');
        n.layer = parent.layer;
        parent.addChild(n);
        var t = n.addComponent(UITransform);
        t.setContentSize(w, size + 6);
        if (left) t.setAnchorPoint(0, 0.5);
        var l = n.addComponent(Label);
        l.fontSize = size;
        l.lineHeight = size + 4;
        l.overflow = Label.Overflow.SHRINK;
        if (left) l.horizontalAlign = Label.HorizontalAlign.LEFT;
        return l;
      }

      /** Title plus rows of name / description / button: the shop, the counter menu, decorating. Buttons are panel-local rects, turned into capture zones by the caller */
      var ListPanel = exports('ListPanel', /*#__PURE__*/function () {
        function ListPanel(parent, maxRows) {
          this.node = void 0;
          this.buttons = [];
          this.g = void 0;
          this.title = void 0;
          this.names = [];
          this.descs = [];
          this.btnLabels = [];
          this.node = new Node('UI_List');
          this.node.layer = parent.layer;
          parent.addChild(this.node);
          this.node.addComponent(UITransform);
          this.g = this.node.addComponent(Graphics);
          this.title = addLabel(this.node, 24, W - 40, false);
          for (var i = 0; i < maxRows; i++) {
            var name = addLabel(this.node, 22, W - BTN_W - 72, true);
            name.color = NAME;
            this.names.push(name);
            this.descs.push(addLabel(this.node, 17, W - BTN_W - 72, true));
            this.btnLabels.push(addLabel(this.node, 18, BTN_W, false));
          }
          this.node.active = false;
        }

        /** Rows past maxRows are dropped */
        var _proto = ListPanel.prototype;
        _proto.show = function show(title, rows) {
          var n = Math.min(rows.length, this.names.length);
          var h = HEAD_H + n * ROW_H + 16;
          this.node.getComponent(UITransform).setContentSize(W, h);
          this.title.node.setPosition(0, h / 2 - 32, 0);
          this.title.string = title;
          var g = this.g;
          g.clear();
          g.fillColor = BG;
          g.roundRect(-W / 2, -h / 2, W, h, 18);
          g.fill();
          this.buttons = [];
          for (var i = 0; i < this.names.length; i++) {
            var r = rows[i];
            var vis = i < n && !!r;
            this.names[i].node.active = vis;
            this.descs[i].node.active = vis;
            this.btnLabels[i].node.active = vis;
            if (!vis || !r) continue;
            var y = h / 2 - HEAD_H - i * ROW_H - ROW_H / 2;
            var x = W / 2 - BTN_W / 2 - 24;
            this.names[i].node.setPosition(-W / 2 + 24, y + 12, 0);
            this.names[i].string = r.name;
            this.descs[i].node.setPosition(-W / 2 + 24, y - 14, 0);
            this.descs[i].string = r.desc;
            this.btnLabels[i].node.setPosition(x, y, 0);
            this.btnLabels[i].string = r.btn;
            this.buttons.push({
              id: "row" + i,
              x: x,
              y: y,
              w: BTN_W,
              h: BTN_H
            });
            g.fillColor = r.on ? ON : OFF;
            g.roundRect(x - BTN_W / 2, y - BTN_H / 2, BTN_W, BTN_H, 8);
            g.fill();
          }
          this.node.active = true;
        };
        _proto.hide = function hide() {
          this.node.active = false;
        };
        return ListPanel;
      }());
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/sim.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc', './rng.ts', './recipe.ts', './order.ts', './customer.ts', './vec2.ts'], function (exports) {
  var _extends, _createForOfIteratorHelperLoose, cclegacy, createRng, reseed, cookLevelAt, DEFAULT_COOK, addCookedPatty, addIngredient, judge, createCustomerFlow, resetCustomerFlow, closeShop, stepCustomerFlow, releaseCustomer$1, dist;
  return {
    setters: [function (module) {
      _extends = module.extends;
      _createForOfIteratorHelperLoose = module.createForOfIteratorHelperLoose;
    }, function (module) {
      cclegacy = module.cclegacy;
    }, function (module) {
      createRng = module.createRng;
      reseed = module.reseed;
    }, function (module) {
      cookLevelAt = module.cookLevelAt;
      DEFAULT_COOK = module.DEFAULT_COOK;
      addCookedPatty = module.addCookedPatty;
      addIngredient = module.addIngredient;
    }, function (module) {
      judge = module.judge;
    }, function (module) {
      createCustomerFlow = module.createCustomerFlow;
      resetCustomerFlow = module.resetCustomerFlow;
      closeShop = module.closeShop;
      stepCustomerFlow = module.stepCustomerFlow;
      releaseCustomer$1 = module.releaseCustomer;
    }, function (module) {
      dist = module.dist;
    }],
    execute: function () {
      exports({
        createSimState: createSimState,
        defaultSimConfig: defaultSimConfig,
        runDay: runDay,
        stepSim: stepSim
      });
      cclegacy._RF.push({}, "4394aqkJthFULcwN+WueAeU", "sim", undefined);

      // ─────────────────────────── 配置 ───────────────────────────

      /** 顾客流参数与真人局共用一份，定义在 customer.ts。这里原样转出，difficulty.ts 照旧 import */

      /**
       * 基准参数。**这些数字是 M1 要标定的对象，不是结论** ——
       * 布局取 8m×6m 厨房（ROADMAP §2.2 的粗算用的也是这个尺寸）。
       */
      function defaultSimConfig() {
        return {
          seed: 1,
          durationSec: 210,
          layout: {
            fridge: {
              x: -3,
              z: 2
            },
            grill: {
              x: 0,
              z: 2
            },
            assembly: {
              x: 3,
              z: 2
            },
            serve: {
              x: 3,
              z: -2
            },
            spread: 1
          },
          chef: {
            speed: 4,
            interactSec: 0.4
          },
          cook: _extends({}, DEFAULT_COOK),
          grillSlots: 2,
          flow: {
            intervalSec: 12,
            intervalJitter: 0,
            maxConcurrent: 6,
            patienceSec: 45
          },
          orders: {
            extraMin: 0,
            extraMax: 2,
            bannedChance: 0.3
          }
        };
      }

      // ─────────────────────────── 内部状态 ───────────────────────────

      var FRIDGE = 0;
      var GRILL = 1;
      var ASSEMBLY = 2;
      var SERVE = 3;
      function stationVec(layout, i) {
        return i === FRIDGE ? layout.fridge : i === GRILL ? layout.grill : i === ASSEMBLY ? layout.assembly : layout.serve;
      }
      function createSimState(config) {
        var rng = createRng(config.seed);
        var flow = createCustomerFlow(config.flow, config.orders, rng);
        var st = {
          t: 0,
          done: false,
          cfg: config,
          rng: rng,
          distance: new Array(16).fill(0),
          flow: flow,
          customers: flow.customers,
          grill: [],
          at: ASSEMBLY,
          phase: 'idle',
          phaseLeft: 0,
          carry: 'none',
          carryIng: 'bun',
          carryIng2: null,
          carryCook: 'medium',
          carryCustomer: -1,
          action: 'none',
          actionCustomer: -1,
          actionIng: 'bun',
          actionGrill: -1,
          result: {
            arrived: 0,
            served: 0,
            wrong: 0,
            timedOut: 0,
            completionRate: 0,
            badReviewRate: 0,
            peakConcurrent: 0,
            burnt: 0,
            idleSec: 0,
            trace: []
          },
          reset: function reset(cfg) {
            resetState(st, cfg);
          }
        };
        resetState(st, config);
        return st;
      }
      function resetState(st, cfg) {
        st.cfg = cfg;
        st.t = 0;
        st.done = false;
        reseed(st.rng, cfg.seed);

        // 距离矩阵：预计算，决策里不再开方
        for (var a = 0; a < 4; a++) {
          for (var b = 0; b < 4; b++) {
            st.distance[a * 4 + b] = dist(stationVec(cfg.layout, a), stationVec(cfg.layout, b)) * cfg.layout.spread;
          }
        }
        resetCustomerFlow(st.flow, cfg.flow, cfg.orders);
        st.customers = st.flow.customers;

        // 烤炉槽位按上限预分配一次，之后只复用
        while (st.grill.length < cfg.grillSlots) st.grill.push({
          busy: false,
          elapsed: 0,
          reservedFor: -1
        });
        for (var _iterator = _createForOfIteratorHelperLoose(st.grill), _step; !(_step = _iterator()).done;) {
          var g = _step.value;
          g.busy = false;
          g.elapsed = 0;
          g.reservedFor = -1;
        }
        st.at = ASSEMBLY;
        st.phase = 'idle';
        st.phaseLeft = 0;
        st.carry = 'none';
        st.carryIng2 = null;
        st.carryCustomer = -1;
        st.action = 'none';
        st.actionCustomer = -1;
        st.actionGrill = -1;
        var r = st.result;
        r.arrived = 0;
        r.served = 0;
        r.wrong = 0;
        r.timedOut = 0;
        r.completionRate = 0;
        r.badReviewRate = 0;
        r.peakConcurrent = 0;
        r.burnt = 0;
        r.idleSec = 0;
        r.trace.length = 0;
      }
      function trace(st, msg) {
        if (st.cfg.trace) st.result.trace.push("[" + st.t.toFixed(1) + "] " + msg);
      }

      // ─────────────────────────── 订单生成 ───────────────────────────

      // ─────────────────────────── 查询 ───────────────────────────

      function firstMissingIngredient(c, skip) {
        if (skip === void 0) {
          skip = null;
        }
        for (var i = 0; i < c.spec.required.length; i++) {
          var ing = c.spec.required[i];
          if (ing === 'patty' || ing === skip) continue;
          if (!c.burger.ingredients.includes(ing)) return ing;
        }
        return null;
      }
      function isComplete(c) {
        if (c.burger.cook !== c.spec.doneness) return false;
        return firstMissingIngredient(c) === null;
      }

      /** 最紧急（耐心剩得最少）且满足条件的 active 顾客索引，没有则 -1 */
      function mostUrgent(st, test) {
        var best = -1;
        var bestLeft = Infinity;
        for (var i = 0; i < st.customers.length; i++) {
          var _c = st.customers[i];
          if (!_c.active || !test(_c)) continue;
          if (_c.patienceLeft < bestLeft) {
            bestLeft = _c.patienceLeft;
            best = i;
          }
        }
        return best;
      }
      function freeGrillSlot(st) {
        for (var i = 0; i < st.grill.length; i++) if (!st.grill[i].busy) return i;
        return -1;
      }

      /** 已经有一块肉在为这一单烤着 */
      function hasPattyCooking(st, customerIdx) {
        for (var _iterator2 = _createForOfIteratorHelperLoose(st.grill), _step2; !(_step2 = _iterator2()).done;) {
          var g = _step2.value;
          if (g.busy && g.reservedFor === customerIdx) return true;
        }
        return false;
      }

      // ─────────────────────────── 决策 ───────────────────────────

      function beginTask(st, station, action) {
        st.action = action;
        var d = st.distance[st.at * 4 + station];
        if (station === st.at || d === 0) {
          st.phase = 'acting';
          st.phaseLeft = st.cfg.chef.interactSec;
        } else {
          st.phase = 'moving';
          st.phaseLeft = d / st.cfg.chef.speed;
          st.at = station; // 出发即视为「归属于目标工位」，到达时间由 phaseLeft 表达
        }
      }

      function decide(st) {
        // 手上有东西 → 先送出去
        switch (st.carry) {
          case 'raw_patty':
            beginTask(st, GRILL, 'put_grill');
            return;
          case 'ingredient':
          case 'cooked_patty':
            beginTask(st, ASSEMBLY, 'place_assembly');
            return;
          case 'plate':
            beginTask(st, SERVE, 'serve');
            return;
        }

        // 1) 烤好的肉优先取 —— 再等就烤过头，之前那几步全白做
        var _loop = function _loop() {
            var slot = st.grill[g];
            if (!slot.busy) return 0; // continue
            var level = cookLevelAt(slot.elapsed, st.cfg.cook);
            if (level === 'raw' || level === 'burnt') return 0; // continue
            var target = mostUrgent(st, function (c) {
              return c.burger.cook === null && c.spec.doneness === level;
            });
            if (target >= 0) {
              st.actionGrill = g;
              st.actionCustomer = target;
              beginTask(st, GRILL, 'take_grill');
              return {
                v: void 0
              };
            }
          },
          _ret;
        for (var g = 0; g < st.grill.length; g++) {
          _ret = _loop();
          if (_ret === 0) continue;
          if (_ret) return _ret.v;
        }

        // 2) 处理最紧急那一单 —— 但「最紧急」要在**还推得动**的单里挑。
        //
        //    ⚠ 这里曾经写错过，代价很直观：原先「缺肉且烤炉有空就去拿肉」是条不绑定订单的
        //    全局规则，于是槽位越多、玩家越忙着给一堆单铺肉、每单都做一半 ——
        //    实测 1 个槽位反而比 3 个完成率高一倍（56% vs 33%）。多一个烤炉不该让玩家变差，
        //    那是策略缺陷不是难度。理想玩家一次只推进一单，直到那单只能干等为止。
        var best = -1;
        var bestLeft = Infinity;
        var bestAction = 'none';
        for (var i = 0; i < st.customers.length; i++) {
          var _c2 = st.customers[i];
          if (!_c2.active || _c2.patienceLeft >= bestLeft) continue;
          var act = nextActionFor(st, _c2, i);
          if (act === 'none') continue;
          best = i;
          bestLeft = _c2.patienceLeft;
          bestAction = act;
        }
        if (best >= 0) {
          st.actionCustomer = best;
          switch (bestAction) {
            case 'take_plate':
              beginTask(st, ASSEMBLY, 'take_plate');
              return;
            case 'pick_patty':
              beginTask(st, FRIDGE, 'pick_patty');
              return;
            case 'pick_ingredient':
              st.actionIng = firstMissingIngredient(st.customers[best]);
              beginTask(st, FRIDGE, 'pick_ingredient');
              return;
          }
        }
        st.phase = 'idle';
        st.action = 'none';
      }

      /**
       * 这一单眼下能推进的下一步，'none' = 只能干等（缺肉但烤炉满了，或肉正在烤）。
       *
       * 顺序有讲究：**先把肉放上烤炉，再去拿配料** —— 烤肉那 3–9 秒是这个游戏里
       * 唯一的并行窗口，不先占上就白白串行了。
       */
      function nextActionFor(st, c, idx) {
        if (isComplete(c)) return 'take_plate';
        if (c.burger.cook === null && !hasPattyCooking(st, idx) && freeGrillSlot(st) >= 0) {
          return 'pick_patty';
        }
        if (firstMissingIngredient(c) !== null) return 'pick_ingredient';
        return 'none';
      }
      function finishAction(st) {
        switch (st.action) {
          case 'pick_ingredient':
            {
              if (st.carry === 'ingredient') {
                st.carryIng2 = st.actionIng;
                break;
              }
              st.carry = 'ingredient';
              st.carryIng = st.actionIng;
              st.carryIng2 = null;
              st.carryCustomer = st.actionCustomer;
              // Same fridge visit, one more tap: grab the order's next missing topping too
              var next = firstMissingIngredient(st.customers[st.actionCustomer], st.actionIng);
              if (next !== null) {
                st.actionIng = next;
                st.phaseLeft = st.cfg.chef.interactSec;
                return;
              }
              break;
            }
          case 'pick_patty':
            st.carry = 'raw_patty';
            st.carryCustomer = st.actionCustomer;
            break;
          case 'put_grill':
            {
              var g = freeGrillSlot(st);
              if (g >= 0) {
                st.grill[g].busy = true;
                st.grill[g].elapsed = 0;
                st.grill[g].reservedFor = st.carryCustomer;
                trace(st, "grill#" + g + " start");
              }
              st.carry = 'none';
              st.carryCustomer = -1;
              break;
            }
          case 'take_grill':
            {
              var slot = st.grill[st.actionGrill];
              var level = cookLevelAt(slot.elapsed, st.cfg.cook);
              slot.busy = false;
              slot.elapsed = 0;
              slot.reservedFor = -1;
              if (level === 'raw' || level === 'burnt') {
                // 走过来的这段时间里过火了，白跑一趟
                if (level === 'burnt') st.result.burnt++;
                st.carry = 'none';
              } else {
                st.carry = 'cooked_patty';
                st.carryCook = level;
                st.carryCustomer = st.actionCustomer;
              }
              break;
            }
          case 'place_assembly':
            {
              var _c3 = st.customers[st.carryCustomer];
              // 顾客可能在路上就走了，手上这份直接作废
              if (_c3 && _c3.active) {
                if (st.carry === 'cooked_patty') addCookedPatty(_c3.burger, st.carryCook);else {
                  addIngredient(_c3.burger, st.carryIng);
                  if (st.carryIng2 !== null) addIngredient(_c3.burger, st.carryIng2);
                }
              }
              st.carry = 'none';
              st.carryIng2 = null;
              st.carryCustomer = -1;
              break;
            }
          case 'take_plate':
            {
              var _c4 = st.customers[st.actionCustomer];
              if (_c4.active && isComplete(_c4)) {
                st.carry = 'plate';
                st.carryCustomer = st.actionCustomer;
              }
              break;
            }
          case 'serve':
            {
              var _c5 = st.customers[st.carryCustomer];
              if (_c5 && _c5.active) {
                var verdict = judge(_c5.burger, _c5.spec);
                if (verdict.ok) st.result.served++;else st.result.wrong++;
                trace(st, "serve #" + _c5.id + " " + (verdict.ok ? 'ok' : 'WRONG'));
                releaseCustomer(st, _c5);
              }
              st.carry = 'none';
              st.carryCustomer = -1;
              break;
            }
        }
        st.action = 'none';
        st.phase = 'idle';
      }

      /** 顾客离场时 sim 自己要清的东西。真正的释放由 customer.ts 做 */
      function detachCustomer(st, c) {
        var idx = st.customers.indexOf(c);
        for (var _iterator3 = _createForOfIteratorHelperLoose(st.grill), _step3; !(_step3 = _iterator3()).done;) {
          var g = _step3.value;
          if (g.reservedFor === idx) g.reservedFor = -1;
        }
      }
      function releaseCustomer(st, c) {
        detachCustomer(st, c);
        releaseCustomer$1(st.flow, c);
      }

      // ─────────────────────────── 主循环 ───────────────────────────

      function stepSim(state, dt) {
        var st = state;
        if (st.done) return;
        st.t += dt;
        if (st.t >= st.cfg.durationSec) {
          // 强制打烊：在场没做完的一律记超时
          closeShop(st.flow, function (c) {
            trace(st, "closing, #" + c.id + " left");
            detachCustomer(st, c);
          });
          syncCounts(st);
          st.done = true;
          finalize(st);
          return;
        }
        stepCustomerFlow(st.flow, st.t, dt, function (c) {
          trace(st, "timeout #" + c.id);
          // 端在手上的那一份也一起作废
          if (st.carry === 'plate' && st.customers[st.carryCustomer] === c) {
            st.carry = 'none';
            st.carryCustomer = -1;
            st.phase = 'idle';
            st.action = 'none';
          }
          detachCustomer(st, c);
        }, function (c) {
          return trace(st, "arrive #" + c.id + " req=" + c.spec.required.join('+') + " " + c.spec.doneness);
        });
        syncCounts(st);

        // 烤炉
        for (var g = 0; g < st.grill.length; g++) {
          var slot = st.grill[g];
          if (!slot.busy) continue;
          slot.elapsed += dt;
          if (cookLevelAt(slot.elapsed, st.cfg.cook) === 'burnt') {
            slot.busy = false;
            slot.elapsed = 0;
            slot.reservedFor = -1;
            st.result.burnt++;
            trace(st, "grill#" + g + " BURNT");
          }
        }

        // 厨师
        if (st.phase === 'idle') {
          decide(st);
          if (st.phase === 'idle') st.result.idleSec += dt;
        } else {
          st.phaseLeft -= dt;
          if (st.phaseLeft <= 0) {
            if (st.phase === 'moving') {
              st.phase = 'acting';
              st.phaseLeft = st.cfg.chef.interactSec;
            } else {
              finishAction(st);
            }
          }
        }
      }

      /** arrived / timedOut / peakConcurrent 由 customer.ts 记，DayResult 每帧同步一次 */
      function syncCounts(st) {
        st.result.arrived = st.flow.arrived;
        st.result.timedOut = st.flow.timedOut;
        st.result.peakConcurrent = st.flow.peakConcurrent;
      }
      function finalize(st) {
        var r = st.result;
        r.completionRate = r.arrived === 0 ? 1 : r.served / r.arrived;
        r.badReviewRate = r.arrived === 0 ? 0 : (r.wrong + r.timedOut) / r.arrived;
      }

      /** 逻辑帧步长。真机 30fps 也够跑逻辑，模拟器与它保持一致。 */
      var SIM_DT = exports('SIM_DT', 1 / 30);

      /** 跑完整一局。扫参数时上千次调用它。 */
      function runDay(config) {
        var st = createSimState(config);
        var steps = Math.ceil(config.durationSec / SIM_DT) + 2;
        for (var i = 0; i < steps && !st.done; i++) stepSim(st, SIM_DT);
        return st.result;
      }
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/StationView.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc', './input.ts', './camera.ts', './kitchen.ts', './shift.ts', './customer.ts', './progress.ts', './economy.ts', './shop.ts', './ShopUi.ts', './decor.ts', './tasks.ts', './TaskUi.ts', './types.ts', './Bubble.ts', './Ring.ts', './WallCutaway.ts', './vent.ts', './witness.ts', './Feel.ts', './Sfx.ts', './reviews.ts', './cardLines.ts', './ReviewUi.ts', './Controls.ts', './BurgerStack.ts', './delivery.ts', './movement.ts', './recipe.ts'], function (exports) {
  var _applyDecoratedDescriptor, _inheritsLoose, _initializerDefineProperty, _assertThisInitialized, _createForOfIteratorHelperLoose, _extends, cclegacy, _decorator, Color, Prefab, SpriteFrame, Vec3, Vec2, Camera, Sprite, UITransform, Label, utils, primitives, Node, Widget, view, input, Input, game, Game, MeshRenderer, instantiate, builtinResMgr, sys, SkeletalAnimation, find, KeyCode, ResolutionPolicy, Component, TouchRouter, DEFAULT_ACTION, panelChildZone, uiRectToCaptureZone, screenToCanvasX, screenToCanvasY, DEFAULT_STICK, focusBounds, ORTHO_HEIGHT, effectiveOrthoHeight, focusForPlayer, createKitchen, FIRE_SEC, DEFAULT_WASH, FRY_SEC, DRINK_SEC, stepKitchen, carrySpeedFactor, bumpStack, stationInReach, discard, releaseScrub, interact, scrubSink, FRY_BURN_SEC, DRINK_SPILL_SEC, STACK_SLOW, grillCookLevel, resetKitchen, createShift, stepShift, settleSide, settleServe, shiftResult, starsForShift, resetShift, DOUBLE_FROM_DAY, DOUBLE_CHANCE, takeReadyOrders, matchSide, matchCustomer, patienceRatio, moodTier, queueIndex, orderPatienceLeft, parseProgress, dayFlow, SAVE_KEY, serializeProgress, finishDay, bank, createLedger, earn, ledgerTotal, resetLedger, flowFactor, owns, FRIES_CHANCE, DRINK_CHANCE, FAST_GRILL, FAST_WASH, BIG_TRAY, SHOP, buy, ListPanel, DECOR_SLOTS, WALL_COLORS, FLOOR_COLORS, DECOR_ITEMS, COLOR_PRICE, paint, place, DAILY_TASKS, TASK_REWARD, ALL_DONE_BONUS, taskReward, rollTasks, collectStats, taskStatus, taskText, HighlightCard, TaskCard, TASK_CARD_W, INGREDIENTS, INGREDIENT_LABEL, COOK_LABEL, COOK_LEVELS, Bubble, Ring, WallCutaway, createVent, rantStars, stepVent, ventSpeedFactor, rantsLeft, startRant, VENT_HOLD_SEC, vent, endArgue, argueTap, ranting, resetVent, witnessMishap, Floaters, FEEL, popIn, pop, Sfx, createReviewLog, WALKOUT_STARS, REJECT_STARS, serveReview, addReview, averageStars, CARD_LINES, ComputerPanel, Toast, TOAST_H, TOAST_W, Controls, BurgerStack, createDesk, stepDesk, deskBusy, matchDelivery, settleDelivery, acceptDelivery, rejectDelivery, resetDesk, createMovement, stepMovement, teleport, DEFAULT_COOK;
  return {
    setters: [function (module) {
      _applyDecoratedDescriptor = module.applyDecoratedDescriptor;
      _inheritsLoose = module.inheritsLoose;
      _initializerDefineProperty = module.initializerDefineProperty;
      _assertThisInitialized = module.assertThisInitialized;
      _createForOfIteratorHelperLoose = module.createForOfIteratorHelperLoose;
      _extends = module.extends;
    }, function (module) {
      cclegacy = module.cclegacy;
      _decorator = module._decorator;
      Color = module.Color;
      Prefab = module.Prefab;
      SpriteFrame = module.SpriteFrame;
      Vec3 = module.Vec3;
      Vec2 = module.Vec2;
      Camera = module.Camera;
      Sprite = module.Sprite;
      UITransform = module.UITransform;
      Label = module.Label;
      utils = module.utils;
      primitives = module.primitives;
      Node = module.Node;
      Widget = module.Widget;
      view = module.view;
      input = module.input;
      Input = module.Input;
      game = module.game;
      Game = module.Game;
      MeshRenderer = module.MeshRenderer;
      instantiate = module.instantiate;
      builtinResMgr = module.builtinResMgr;
      sys = module.sys;
      SkeletalAnimation = module.SkeletalAnimation;
      find = module.find;
      KeyCode = module.KeyCode;
      ResolutionPolicy = module.ResolutionPolicy;
      Component = module.Component;
    }, function (module) {
      TouchRouter = module.TouchRouter;
      DEFAULT_ACTION = module.DEFAULT_ACTION;
      panelChildZone = module.panelChildZone;
      uiRectToCaptureZone = module.uiRectToCaptureZone;
      screenToCanvasX = module.screenToCanvasX;
      screenToCanvasY = module.screenToCanvasY;
      DEFAULT_STICK = module.DEFAULT_STICK;
    }, function (module) {
      focusBounds = module.focusBounds;
      ORTHO_HEIGHT = module.ORTHO_HEIGHT;
      effectiveOrthoHeight = module.effectiveOrthoHeight;
      focusForPlayer = module.focusForPlayer;
    }, function (module) {
      createKitchen = module.createKitchen;
      FIRE_SEC = module.FIRE_SEC;
      DEFAULT_WASH = module.DEFAULT_WASH;
      FRY_SEC = module.FRY_SEC;
      DRINK_SEC = module.DRINK_SEC;
      stepKitchen = module.stepKitchen;
      carrySpeedFactor = module.carrySpeedFactor;
      bumpStack = module.bumpStack;
      stationInReach = module.stationInReach;
      discard = module.discard;
      releaseScrub = module.releaseScrub;
      interact = module.interact;
      scrubSink = module.scrubSink;
      FRY_BURN_SEC = module.FRY_BURN_SEC;
      DRINK_SPILL_SEC = module.DRINK_SPILL_SEC;
      STACK_SLOW = module.STACK_SLOW;
      grillCookLevel = module.grillCookLevel;
      resetKitchen = module.resetKitchen;
    }, function (module) {
      createShift = module.createShift;
      stepShift = module.stepShift;
      settleSide = module.settleSide;
      settleServe = module.settleServe;
      shiftResult = module.shiftResult;
      starsForShift = module.starsForShift;
      resetShift = module.resetShift;
    }, function (module) {
      DOUBLE_FROM_DAY = module.DOUBLE_FROM_DAY;
      DOUBLE_CHANCE = module.DOUBLE_CHANCE;
      takeReadyOrders = module.takeReadyOrders;
      matchSide = module.matchSide;
      matchCustomer = module.matchCustomer;
      patienceRatio = module.patienceRatio;
      moodTier = module.moodTier;
      queueIndex = module.queueIndex;
      orderPatienceLeft = module.orderPatienceLeft;
    }, function (module) {
      parseProgress = module.parseProgress;
      dayFlow = module.dayFlow;
      SAVE_KEY = module.SAVE_KEY;
      serializeProgress = module.serializeProgress;
      finishDay = module.finishDay;
      bank = module.bank;
    }, function (module) {
      createLedger = module.createLedger;
      earn = module.earn;
      ledgerTotal = module.ledgerTotal;
      resetLedger = module.resetLedger;
    }, function (module) {
      flowFactor = module.flowFactor;
      owns = module.owns;
      FRIES_CHANCE = module.FRIES_CHANCE;
      DRINK_CHANCE = module.DRINK_CHANCE;
      FAST_GRILL = module.FAST_GRILL;
      FAST_WASH = module.FAST_WASH;
      BIG_TRAY = module.BIG_TRAY;
      SHOP = module.SHOP;
      buy = module.buy;
    }, function (module) {
      ListPanel = module.ListPanel;
    }, function (module) {
      DECOR_SLOTS = module.DECOR_SLOTS;
      WALL_COLORS = module.WALL_COLORS;
      FLOOR_COLORS = module.FLOOR_COLORS;
      DECOR_ITEMS = module.DECOR_ITEMS;
      COLOR_PRICE = module.COLOR_PRICE;
      paint = module.paint;
      place = module.place;
    }, function (module) {
      DAILY_TASKS = module.DAILY_TASKS;
      TASK_REWARD = module.TASK_REWARD;
      ALL_DONE_BONUS = module.ALL_DONE_BONUS;
      taskReward = module.taskReward;
      rollTasks = module.rollTasks;
      collectStats = module.collectStats;
      taskStatus = module.taskStatus;
      taskText = module.taskText;
    }, function (module) {
      HighlightCard = module.HighlightCard;
      TaskCard = module.TaskCard;
      TASK_CARD_W = module.TASK_CARD_W;
    }, function (module) {
      INGREDIENTS = module.INGREDIENTS;
      INGREDIENT_LABEL = module.INGREDIENT_LABEL;
      COOK_LABEL = module.COOK_LABEL;
      COOK_LEVELS = module.COOK_LEVELS;
    }, function (module) {
      Bubble = module.Bubble;
    }, function (module) {
      Ring = module.Ring;
    }, function (module) {
      WallCutaway = module.WallCutaway;
    }, function (module) {
      createVent = module.createVent;
      rantStars = module.rantStars;
      stepVent = module.stepVent;
      ventSpeedFactor = module.ventSpeedFactor;
      rantsLeft = module.rantsLeft;
      startRant = module.startRant;
      VENT_HOLD_SEC = module.VENT_HOLD_SEC;
      vent = module.vent;
      endArgue = module.endArgue;
      argueTap = module.argueTap;
      ranting = module.ranting;
      resetVent = module.resetVent;
    }, function (module) {
      witnessMishap = module.witnessMishap;
    }, function (module) {
      Floaters = module.Floaters;
      FEEL = module.FEEL;
      popIn = module.popIn;
      pop = module.pop;
    }, function (module) {
      Sfx = module.Sfx;
    }, function (module) {
      createReviewLog = module.createReviewLog;
      WALKOUT_STARS = module.WALKOUT_STARS;
      REJECT_STARS = module.REJECT_STARS;
      serveReview = module.serveReview;
      addReview = module.addReview;
      averageStars = module.averageStars;
    }, function (module) {
      CARD_LINES = module.CARD_LINES;
    }, function (module) {
      ComputerPanel = module.ComputerPanel;
      Toast = module.Toast;
      TOAST_H = module.TOAST_H;
      TOAST_W = module.TOAST_W;
    }, function (module) {
      Controls = module.Controls;
    }, function (module) {
      BurgerStack = module.BurgerStack;
    }, function (module) {
      createDesk = module.createDesk;
      stepDesk = module.stepDesk;
      deskBusy = module.deskBusy;
      matchDelivery = module.matchDelivery;
      settleDelivery = module.settleDelivery;
      acceptDelivery = module.acceptDelivery;
      rejectDelivery = module.rejectDelivery;
      resetDesk = module.resetDesk;
    }, function (module) {
      createMovement = module.createMovement;
      stepMovement = module.stepMovement;
      teleport = module.teleport;
    }, function (module) {
      DEFAULT_COOK = module.DEFAULT_COOK;
    }],
    execute: function () {
      var _dec, _dec2, _dec3, _dec4, _dec5, _dec6, _dec7, _dec8, _dec9, _dec10, _dec11, _dec12, _dec13, _dec14, _dec15, _dec16, _dec17, _dec18, _class, _class2, _descriptor, _descriptor2, _descriptor3, _descriptor4, _descriptor5, _descriptor6, _descriptor7, _descriptor8, _descriptor9, _descriptor10, _descriptor11, _descriptor12, _descriptor13, _descriptor14, _descriptor15, _descriptor16, _descriptor17;
      cclegacy._RF.push({}, "e70d4nyAMFBaoa7jaOWzAev", "StationView", undefined);
      var ccclass = _decorator.ccclass,
        property = _decorator.property;

      /** Scene node name -> logic station kind. Names are fixed by ROADMAP §6.2. */
      var STATION_KINDS = {
        Station_Fridge: 'fridge',
        Station_Grill: 'grill',
        Station_Assembly: 'assembly',
        Station_Serve: 'serve',
        Station_Storeroom: 'storeroom',
        Station_Order: 'register',
        Station_Delivery: 'delivery',
        Station_Sink: 'sink'
      };

      /** Scene paths resolved at start. `pnpm scene` checks every one of them against the
       *  actual .scene, so a rename shows up before the editor is even opened. */
      var NODES = {
        kitchen: 'Kitchen',
        blockers: 'Kitchen/Blockers',
        player: 'Actors/Player',
        customers: 'Actors/Customers',
        customerFloor: 'Kitchen/Floor_Customer',
        camera: 'Main Camera',
        joystick: 'Canvas/UI_Joystick',
        discard: 'Canvas/UI_DiscardButton',
        action: 'Canvas/UI_ActionButton',
        panel: 'Canvas/UI_FridgePanel',
        time: 'Canvas/UI_HUD/Label_Time',
        score: 'Canvas/UI_HUD/Label_Score',
        orders: 'Canvas/UI_HUD/UI_Orders',
        result: 'Canvas/UI_Result',
        resultTitle: 'Canvas/UI_Result/Panel/Title',
        resultBody: 'Canvas/UI_Result/Panel/Stats',
        again: 'Canvas/UI_Result/Panel/Btn_Again',
        rack: 'Kitchen/Blockers/Block_DishRack',
        shelf: 'Kitchen/Blockers/Block_Plate',
        fryer: 'Kitchen/Blockers/Block_Fryer'
      };

      /** 超时还在等的顾客，订单卡的进度条整条变成这个色 */
      var LATE_BAR_COLOR = new Color(231, 76, 60, 255);

      /** 火候字色。生与焦都是失败态，焦用红色报警 —— M4 的起火链从这里开始 */
      var COOK_COLOR = {
        raw: new Color(255, 160, 170, 255),
        rare: new Color(240, 130, 100, 255),
        medium: new Color(230, 170, 80, 255),
        well: new Color(190, 140, 90, 255),
        burnt: new Color(255, 60, 60, 255)
      };

      /** 气泡离地多高，米。玩家模型约 1.45m 高 */
      var BUBBLE_Y = {
        carry: 1.9,
        grill: 1.5,
        bench: 1.45
      };
      /** Where the carried burger rides: metres in front of the player, and height */
      var HAND = {
        reach: 0.45,
        y: 1.0
      };
      var MOOD_FACE = ['😀', '🙂', '😐', '😡', '🤬'];
      /** Ring colour by how much patience is left: plenty / hurry / about to go */
      var RING_OK = new Color(110, 210, 110, 255);
      var RING_WARN = new Color(245, 200, 70, 255);
      var ASK_COLOR = new Color(255, 215, 80, 255);
      /**
       * Placeholder until cards carry lines.witness (ROADMAP M4). `burnt` is copy from the V0.2 design brief;
       * the other two have no copy yet, so they are stage directions in brackets, not invented dialogue.
       */
      var WITNESS_LINES = {
        burnt: ['这东西是煤炭吗？', '我突然没那么饿了。', '这家店卫生评级多少来着？'],
        stained: ['（盘子没洗干净，被看见了）'],
        crash: ['（盘子摔了一地，被看见了）'],
        vent: ['（厨师在发火，被看见了）']
      };
      /** ⏳ Shouting-match copy: the first two lines are the user's, the rest are placeholders to review */
      /** 🚧 Placeholder hurry-up shouts (overhead, short); the card's own wait_nudge still goes up top */
      var URGE_ANGRY = ['快点行不行！', '还要多久啊！', '我赶时间！', '饿死了……'];
      var URGE_LATE = ['都超时了！', '我的汉堡呢？！', '还做不做了！'];
      var ARGUE_CHEF = ['催什么催！', '不买就滚！', '嫌慢你自己来做！', '爱吃不吃！', '门在那边！', '下次别来了！'];
      var ARGUE_CUSTOMER = ['你什么态度！', '我要投诉你！', '什么破店！', '叫你们老板出来！', '差评！必须差评！', '走就走！'];
      var HINT = {
        'hands-full': '手上拿满了',
        'hands-empty': '手上没东西',
        'grill-full': '烤位满了',
        'grill-empty': '烤炉上没肉',
        'not-raw-patty': '只有生肉能下锅',
        'duplicate-ingredient': '这样已经有了',
        'no-burger': '组装台是空的',
        'incomplete-burger': '汉堡还缺面包或肉',
        'no-order': '没人点这一单',
        'out-of-stock': '卖完了，去冷库搬一箱',
        'stock-full': '冰柜还是满的',
        'no-plate': '没有干净盘子了',
        'nothing-to-wash': '没有脏盘子',
        'sink-busy': '泡好了，按住刷',
        'still-soaking': '还在泡',
        'rack-empty': '架子上没有晾好的盘子',
        'stack-full': '一趟拿不了更多了',
        'still-frying': '还在炸',
        'on-fire': '着火了！去拿灭火器',
        'still-pouring': '还在接',
        'no-fire': '没着火',
        unsupported: '这里用不上'
      };
      var SFX_FOR = {
        'take-ingredient': 'pick',
        'take-patty': 'pick',
        'pick-plate': 'pick',
        'take-crate': 'pick',
        'take-stack': 'pick',
        'place-patty': 'drop',
        'add-to-burger': 'drop',
        'put-plate': 'drop',
        restock: 'drop',
        soak: 'drop',
        shelve: 'drop',
        fry: 'drop',
        'take-fries': 'pick',
        'serve-fries': 'serve',
        'dump-fries': 'trash',
        'take-extinguisher': 'pick',
        'return-extinguisher': 'drop',
        extinguish: 'scrub',
        pour: 'drop',
        'take-drink': 'pick',
        'serve-drink': 'serve',
        'wipe-spill': 'scrub',
        discard: 'trash'
      };
      var HINT_COLOR = new Color(255, 235, 170, 255);
      var GOOD_COLOR = new Color(255, 215, 80, 255);
      var BAD_COLOR = new Color(255, 110, 100, 255);
      /** 电脑上最多挂几张外卖单 / 同时最多做几张 */
      var DELIVERY_OFFERS = 2;
      /** One grid step (136) right of the grid's last column */
      var PLATE_SLOT_X = 340;
      var PANEL_GROW = 136;
      var DELIVERY_ACTIVE = 2;
      /** Riders wait just inside the door by the counter's east end, clear of the diners' standing spots. ⏳ tune by eye */
      var RIDER_SPOT = [-1.1, -0.9];
      var RIDER_GAP = 0.8;
      /** 外卖顾客的编号从这里起，和堂食错开（评价按编号取顾客卡） */
      var DELIVERY_ID_BASE = 1000;
      var PLATFORM_AVATAR = 5;
      /** Result panel buttons side by side (again / next / shop): each this wide, centres this far apart */
      var RESULT_BTN_W = 160;
      var RESULT_BTN_GAP = 176;

      /** 场景里建了几张订单卡。难度曲线的 maxConcurrent 上限是 6，卡按它备足 */
      var ORDER_CARDS = 6;

      /** 顾客小人池。走出去的还没消失、新的已经进门，所以是在场上限的两倍 */
      var FIGURES = ORDER_CARDS * 2;

      /** 顾客走路速度，米/秒。比厨师（4）慢得多，看得出是在溜达 */
      var CUSTOMER_SPEED = 1.6;

      /**
       * 坐下时把人抬多高，米。Kenney 的 sit 是坐在地上（髋部离地 0.05m），长凳座面实测 0.50m，
       * 不抬的话人整个陷进凳子里。
       */
      var SEAT_Y = 0.48;

      /** 排队时前后间距，米，沿柜台往东排 */
      var QUEUE_GAP = 0.9;
      /** Where upset customers stand to rant: west of the queue head, against the counter. ⏳ self-chosen */
      var RANT_DX = -0.6;
      var RANT_DZ = -0.5;

      /**
       * 接了单之后去哪儿等，顾客区坐标（相对 Floor_Customer 中心）。前四个是长凳（坐），
       * 后两个站着 —— 长凳在 scene 里的 Prop_Waiting，挪了长凳要跟着改这里。
       * 坐的 z 比长凳中线靠前 0.06：sit 动作的髋部在脚底后方 0.06m，这样髋部才落在座面中间。
       */
      var WAIT_SPOTS = [[-2.4, 0.94, true], [-0.8, 0.94, true], [0.8, 0.94, true], [2.4, 0.94, true], [3.3, -0.2, false], [2.5, -0.2, false]];

      /** Bookcase slot on the empty stretch of north wall between the fridge and the cold-room door. ⏳ tune by eye */
      var WALL_N_SPOT = [7, -2.45];
      var HUD_MARGIN = 12;
      var SIDE_ICON = {
        fries: '🍟',
        drink: '🥤'
      };
      /** Extinguisher on the north wall, east of the bookcase slot, west of the cold-room door. ⏳ tune by eye */
      var EXT_SPOT = [9.3, -2.8];
      /** Drink machine against the north wall just east of the fridge. ⏳ tune by eye */
      var DRINKS_SPOT = [5.9, -2.7];
      /** Fixed touch targets keep this far inside the safe area (ROADMAP M6) */
      var SAFE_GAP = 50;
      /** Visible size is polled, not read every frame — getVisibleSize() allocates. */
      var RESIZE_POLL_SEC = 0.25;

      /** Touch ids for the desktop fallbacks. Real touch ids start at 0 and go up. */
      var MOUSE_ID = -99;
      var KEY_STICK_ID = -98;
      var KEY_ACTION_ID = -97;

      /** Where the synthetic fingers press. Left half for the stick; upper right for the action
       *  key, clear of the action and discard buttons which both sit bottom-right. */
      var KEY_STICK_ORIGIN = [0.25, 0.4];
      var KEY_ACTION_POINT = [0.75, 0.8];

      /**
       * Wires logic/ to the scene: touch -> TouchRouter -> movement + kitchen -> nodes.
       *
       * Drop it on Canvas. Every node is looked up by the names in docs/m2-scene-guide.md §2.1;
       * a missing one disables the component with a console error rather than failing quietly.
       */
      var StationView = exports('StationView', (_dec = ccclass('StationView'), _dec2 = property({
        tooltip: '工位方块半径之外还能够着多少米。手感旋钮，真机上调'
      }), _dec3 = property({
        type: [Prefab],
        tooltip: '顾客外形，按站位轮换'
      }), _dec4 = property({
        type: [SpriteFrame],
        tooltip: '食材图标，顺序同 INGREDIENTS'
      }), _dec5 = property({
        type: SpriteFrame,
        tooltip: '盘子图标（手上端着汉堡时显示）'
      }), _dec6 = property({
        tooltip: '冰柜每样食材最多放几份。空了要去库房抱一箱回来补满'
      }), _dec7 = property({
        tooltip: '站着时头顶离脚底多少米（耐心圈贴在这里）。手感旋钮，预览里对着看'
      }), _dec8 = property({
        tooltip: '坐在长凳上时头顶离人物节点多少米（节点已抬了 SEAT_Y）'
      }), _dec9 = property({
        tooltip: '顾客走到点单台后等多少秒没人接单就走人（差评）'
      }), _dec10 = property({
        tooltip: '一局来几位顾客，接待完就结算'
      }), _dec11 = property({
        tooltip: '一开局有几个干净盘子。每做一个汉堡占一个，堂食吃完脏着送回洗碗池'
      }), _dec12 = property({
        tooltip: '冷库里的备用干净盘子（摔碎后去这里领一摞）'
      }), _dec13 = property({
        tooltip: '顾客超时后再等多少秒就走人（差评）'
      }), _dec14 = property({
        tooltip: '外卖单隔多少秒来一张（挂在点单台电脑上）'
      }), _dec15 = property({
        tooltip: '外卖单挂在电脑上多少秒没人理就算拒单'
      }), _dec16 = property({
        tooltip: '接了外卖后多少秒内要放上外卖取餐口'
      }), _dec17 = property({
        tooltip: '顾客平均隔多少秒来一位。真人局专用，模拟器仍按难度表'
      }), _dec18 = property({
        tooltip: '到达间隔的随机幅度，0.5 = 在 50%–150% 之间'
      }), _dec(_class = (_class2 = /*#__PURE__*/function (_Component) {
        _inheritsLoose(StationView, _Component);
        function StationView() {
          var _this;
          for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
            args[_key] = arguments[_key];
          }
          _this = _Component.call.apply(_Component, [this].concat(args)) || this;
          _initializerDefineProperty(_this, "reach", _descriptor, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "customerModels", _descriptor2, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "ingredientIcons", _descriptor3, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "plateIcon", _descriptor4, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "fridgeCap", _descriptor5, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "headStandY", _descriptor6, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "headSitY", _descriptor7, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "orderPatienceSec", _descriptor8, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "customersPerShift", _descriptor9, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "plateCount", _descriptor10, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "sparePlates", _descriptor11, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "lateLeaveSec", _descriptor12, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "deliveryIntervalSec", _descriptor13, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "deliveryOfferSec", _descriptor14, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "deliveryDeadlineSec", _descriptor15, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "arrivalSec", _descriptor16, _assertThisInitialized(_this));
          _initializerDefineProperty(_this, "arrivalJitter", _descriptor17, _assertThisInitialized(_this));
          /** Last blocked interaction. No toast node exists yet; HUD can read this later. */
          _this.lastBlock = 'none';
          /**
           * Read off Main Camera, never guessed: stickToWorld maps screen-up onto
           * (-sin yaw, -cos yaw), and the camera's own forward on XZ is (-sin eulerY, -cos eulerY),
           * so the two are equal exactly when yaw === eulerY in radians. Hardcoding +45 against a
           * -45 camera is a clean 90 degree error — W walks left — and rotating the camera later
           * would silently break movement again.
           */
          _this.cameraYaw = 0;
          _this.router = void 0;
          _this.kitchen = void 0;
          _this.movement = void 0;
          /** Which station the open panel picks for — fridge takes one, storeroom hands a crate */
          _this.panelStation = null;
          _this.slotIcons = [];
          _this.slotCounts = [];
          _this.panelTitle = void 0;
          _this.panelW = 0;
          _this.uiHalfW = Infinity;
          _this.uiHalfH = Infinity;
          _this.playerNode = void 0;
          _this.cameraNode = void 0;
          _this.cameraComp = void 0;
          /** Camera position when focus sits at the origin — i.e. whatever the scene was saved with. */
          _this.camOffset = new Vec3();
          _this.camBounds = focusBounds(ORTHO_HEIGHT, 16 / 9);
          _this.camFocus = {
            x: 0,
            z: 0
          };
          _this.joystickNode = void 0;
          _this.discardNode = void 0;
          /** Bottom-right buttons with their scene offsets, pushed in past a notch */
          _this.edgeWidgets = [];
          /** Screen edges hidden by a notch / rounded corner, design units */
          _this.inset = {
            left: 0,
            right: 0,
            top: 0,
            bottom: 0
          };
          _this.panelNode = void 0;
          _this.slotNodes = [];
          _this.shift = void 0;
          _this.orderCards = [];
          _this.orderTexts = [];
          _this.orderBars = [];
          _this.orderBarSprites = [];
          /** 进度条在场景里的原色，准时状态下用它 */
          _this.barColor = new Color();
          _this.barLate = [];
          /** 每张卡当前画的是哪位顾客。只在换人时重算文本，省掉每帧的字符串拼接（铁律②） */
          _this.orderShown = [];
          _this.figures = [];
          _this.seatOwner = WAIT_SPOTS.map(function () {
            return -1;
          });
          /** 顾客区中心、进出口，世界坐标 */
          _this.waitX = 0;
          _this.waitZ = 0;
          _this.doorX = 0;
          _this.doorZ = 0;
          /** 排队第一位站的位置 */
          _this.queueX = 0;
          _this.queueZ = 0;
          /** 每位在场顾客头顶的耐心圈，下标同 flow.customers */
          _this.customerRings = [];
          _this.seenBurnt = 0;
          _this.seenBurntFries = 0;
          _this.seenFires = 0;
          _this.witnessLine = 0;
          /** 各圈上的顾客已经催过单了（id），同一位只催一次 */
          _this.nudged = [];
          /** Delivery riders; `id` = the accepted delivery's id */
          _this.riders = [];
          _this.riderRings = [];
          _this.highlightCard = void 0;
          /** The day's most outrageous moment so far; a bigger score replaces it. null = a quiet day */
          _this.highlight = null;
          /** Lines traded in the current shouting match, for the highlight */
          _this.argueCount = 0;
          _this.urgedLate = [];
          _this.reviews = createReviewLog();
          /** 与 reviews.items 同序的台词，评价列表直接读 */
          _this.reviewLines = [];
          _this.toast = void 0;
          _this.board = void 0;
          _this.reviewsOpen = false;
          _this.desk = void 0;
          _this.deliverySeed = 1;
          /** 电脑面板上第 i 行对应的外卖单（null = 这行空着） */
          _this.offerRows = [];
          _this.offerView = [];
          _this.offerMask = '';
          _this.seenOffer = 1;
          _this.registerRing = void 0;
          _this.deliveryRing = void 0;
          _this.registerStation = null;
          _this.deliveryStation = null;
          _this.deliveryCards = [];
          _this.deliveryTexts = [];
          _this.deliveryBars = [];
          _this.deliveryShown = [];
          _this.controls = void 0;
          _this.plateRing = void 0;
          _this.sinkRing = void 0;
          _this.rackRing = void 0;
          _this.platePos = {
            x: 0,
            z: 0
          };
          /** Plate models on the shelf, bottom first; the first `kitchen.plates` are shown */
          _this.plateModels = [];
          _this.shownPlates = -1;
          _this.rackPos = {
            x: 0,
            z: 0
          };
          _this.sinkStation = null;
          /** 顾客从西边进门、东边出门（玩家视角左进右出） */
          _this.exitX = 0;
          _this.toastX = 0;
          _this.toastY = 0;
          _this.ordersRoot = void 0;
          _this.ordersY = 0;
          /** 出餐口的 x；顾客取餐站在柜台外 queueZ 那条线上 */
          _this.pickupX = 0;
          _this.playerAnim = null;
          _this.playerModel = null;
          _this.playerWalking = false;
          _this.carryBubble = void 0;
          _this.grillRings = [];
          _this.benchBubble = void 0;
          _this.burgerStack = null;
          _this.benchTopY = 1;
          _this.grillStation = null;
          _this.benchStation = null;
          _this.iconBuf = [];
          _this.resultNode = void 0;
          _this.resultTitle = void 0;
          _this.resultBody = void 0;
          _this.againNode = void 0;
          _this.resultOpen = false;
          _this.nextNode = null;
          _this.shopNode = null;
          /** One list panel for the shop, the counter menu and decorating; `menuKind` says which it shows */
          _this.menu = void 0;
          _this.menuKind = null;
          _this.menuRows = [];
          /** closed = day not started yet (choose at the counter), rest = rest day, no customers */
          _this.phase = 'closed';
          /** Runtime holders for each decor slot's model */
          _this.decorSlots = new Map();
          _this.decorTemplates = new Map();
          _this.wallRenderers = [];
          _this.floorRenderers = [];
          /** Result text above the money line, which changes as the shop spends */
          _this.resultHead = '';
          _this.fryerStation = null;
          _this.drinksStation = null;
          _this.drinksNode = null;
          _this.drinksRing = void 0;
          _this.seenSpills = 0;
          _this.fryerRing = void 0;
          _this.progress = void 0;
          /** 正在打的是第几天（重打旧的一天时小于 progress.day） */
          _this.day = 1;
          _this.passed = false;
          _this.sfx = void 0;
          _this.floaters = void 0;
          _this.shakeLeft = 0;
          _this.shakeAmp = 0;
          _this.seenCrash = 0;
          _this.seenStained = 0;
          _this.seenArrived = 0;
          _this.rackWasDrying = false;
          _this.scrubbing = false;
          _this.scrubTick = 0;
          _this.baseSpeed = 0;
          _this.spawn = {
            x: 0,
            z: 0
          };
          _this.cutaway = null;
          _this.venting = createVent();
          _this.ledger = createLedger();
          _this.tasks = [];
          _this.taskState = [];
          /** Last status + text drawn per line, so the card only redraws on change */
          _this.taskShown = [];
          _this.taskCard = void 0;
          _this.ventedThisPress = false;
          /** Customer id in the shouting match last frame, -1 = none */
          _this.arguing = -1;
          _this.seenVents = 0;
          /** Review each ranting customer leaves when done: kind + line, before any retort */
          _this.rantReview = new Map();
          _this.screenW = 0;
          _this.screenH = 0;
          /** Visible design-unit height. Fit Width grows it past 720 on narrow screens, and the
           *  capture-zone scale is screenH / designH — hardcoding 720 misses there. */
          _this.designH = 720;
          _this.fitHeight = null;
          _this.resizeIn = 0;
          _this.panelOpen = false;
          /** Which zone set is currently published. setCaptureZones voids in-flight fingers, so
           *  it must run on change only — every frame would kill the discard hold. */
          _this.zonesKey = '';
          _this.touchPoint = new Vec2();
          /** Real touches win: on a phone the mouse path never runs, so the two cannot double up. */
          _this.sawTouch = false;
          _this.mouseDown = false;
          _this.loggedInput = false;
          _this.keys = {
            w: false,
            a: false,
            s: false,
            d: false
          };
          _this.keyStickDown = false;
          _this.spaceDown = false;
          _this.onWalkOut = function (c) {
            var line = CARD_LINES[c.id % CARD_LINES.length].complain;
            _this.rant(c.id, 'walkout', WALKOUT_STARS, line);
            _this.markHighlight(30, "\u300C" + StationView.nameOf(c.id) + "\u300D\u6CA1\u4EBA\u63A5\u5355\uFF0C\u6C14\u8D70\u4E86", "\u4E34\u8D70\u524D\u8BF4\uFF1A\u300C" + line + "\u300D");
          };
          _this.onRantDone = function (r) {
            var rv = _this.rantReview.get(r.id);
            _this.rantReview["delete"](r.id);
            if (rv) _this.review(r.id, r.retorted ? 'complain' : rv.kind, rantStars(r), r.retorted ? rv.text + "\uFF08\u8FD8\u8DDF\u53A8\u5E08\u5BF9\u9A82\u4E86\u4E00\u573A\uFF09" : rv.text);
            for (var _iterator = _createForOfIteratorHelperLoose(_this.figures), _step; !(_step = _iterator()).done;) {
              var f = _step.value;
              if (f.id !== r.id || !f.leaving) continue;
              f.tx = _this.exitX;
              f.tz = _this.doorZ;
            }
          };
          _this.deskEvents = {
            onExpire: function onExpire(d) {
              return _this.review(DELIVERY_ID_BASE + d.id, 'reject', REJECT_STARS, '外卖单挂了半天没人接');
            },
            onLate: function onLate(d) {
              return _this.review(DELIVERY_ID_BASE + d.id, 'walkout', WALKOUT_STARS, '骑手等不到餐，单子作废了');
            }
          };
          return _this;
        }
        var _proto = StationView.prototype;
        _proto.start = function start() {
          var _panel$getComponent$w, _panel$getComponent, _stations$find, _stations$find2, _stations$find3, _ordersRoot$parent, _stations$find4;
          var kitchenRoot = this.need(NODES.kitchen);
          var camera = this.need(NODES.camera);
          var player = this.need(NODES.player);
          var joystick = this.need(NODES.joystick);
          var discardBtn = this.need(NODES.discard);
          var panel = this.need(NODES.panel);
          var ordersRoot = this.need(NODES.orders);
          var customersRoot = this.need(NODES.customers);
          var customerFloor = this.need(NODES.customerFloor);
          var result = this.need(NODES.result);
          var again = this.need(NODES.again);
          var timeLabel = this.label(NODES.time);
          var scoreLabel = this.label(NODES.score);
          var resultTitle = this.label(NODES.resultTitle);
          var resultBody = this.label(NODES.resultBody);
          if (!kitchenRoot || !camera || !player || !joystick || !discardBtn || !panel || !ordersRoot || !customersRoot || !customerFloor || !result || !again || !timeLabel || !scoreLabel || !resultTitle || !resultBody) {
            this.enabled = false;
            return;
          }
          StationView.flattenPlaceholders(this.node);
          this.resultNode = result;
          this.highlightCard = new HighlightCard(result);
          this.againNode = again;
          this.resultTitle = resultTitle;
          this.resultBody = resultBody;
          this.cameraYaw = camera.eulerAngles.y * Math.PI / 180;
          var camComp = camera.getComponent(Camera);
          if (!camComp) {
            console.error("[StationView] " + NODES.camera + " \u4E0A\u6CA1\u6709 cc.Camera");
            this.enabled = false;
            return;
          }
          this.cameraNode = camera;
          this.cameraComp = camComp;
          // Read off the node, not from the constant: moving the camera in the editor keeps
          // working, and `pnpm cam` is what stops logic/camera.ts drifting from the scene.
          this.camOffset.set(camera.position);
          this.playerNode = player;
          this.joystickNode = joystick;
          this.discardNode = discardBtn;
          this.panelNode = panel;
          for (var i = 0; i < INGREDIENTS.length; i++) {
            var _slot$getChildByName;
            var slot = panel.getChildByName("Slot_" + i);
            if (!slot) {
              console.error("[StationView] " + NODES.panel + " \u5E95\u4E0B\u6CA1\u6709 Slot_" + i);
              this.enabled = false;
              return;
            }
            var icon = (_slot$getChildByName = slot.getChildByName('Icon')) == null ? void 0 : _slot$getChildByName.getComponent(Sprite);
            if (!icon) {
              console.error("[StationView] " + NODES.panel + "/Slot_" + i + " \u5E95\u4E0B\u6CA1\u6709\u5E26 Sprite \u7684 Icon");
              this.enabled = false;
              return;
            }
            this.slotNodes.push(slot);
            this.slotIcons.push(icon);
            this.slotCounts.push(StationView.addLabel(slot, 'Count', 24, 0, -42));
          }
          this.buildPlateSlot(panel);
          this.panelW = (_panel$getComponent$w = (_panel$getComponent = panel.getComponent(UITransform)) == null ? void 0 : _panel$getComponent.width) != null ? _panel$getComponent$w : 0;
          this.panelTitle = StationView.addLabel(panel, 'Title', 28, 0, 144 + 26);
          for (var _i = 0; _i < ORDER_CARDS; _i++) {
            var _card$getChildByName;
            var card = ordersRoot.getChildByName("Order_" + _i);
            var text = card == null || (_card$getChildByName = card.getChildByName('Text')) == null ? void 0 : _card$getChildByName.getComponent(Label);
            var bar = card == null ? void 0 : card.getChildByName('Bar');
            var barSprite = bar == null ? void 0 : bar.getComponent(Sprite);
            if (!card || !text || !bar || !barSprite) {
              console.error("[StationView] " + NODES.orders + " \u5E95\u4E0B\u7684 Order_" + _i + " \u7ED3\u6784\u4E0D\u5BF9\uFF08\u8981 Text + Bar\uFF09");
              this.enabled = false;
              return;
            }
            this.orderCards.push(card);
            this.orderTexts.push(text);
            this.orderBars.push(bar);
            this.orderBarSprites.push(barSprite);
            this.barLate.push(false);
            if (_i === 0) this.barColor.set(barSprite.color);
            this.orderShown.push(-1);
          }
          if (!this.buildCustomers(player, customersRoot, customerFloor)) {
            this.enabled = false;
            return;
          }
          var stations = this.readStations(kitchenRoot);
          if (stations.length === 0) {
            console.error("[StationView] " + NODES.kitchen + " \u5E95\u4E0B\u4E00\u4E2A Station_* \u90FD\u6CA1\u6709");
            this.enabled = false;
            return;
          }
          var rackNode = this.need(NODES.rack);
          var shelfNode = this.need(NODES.shelf);
          var fryerNode = this.need(NODES.fryer);
          if (!rackNode || !shelfNode || !fryerNode) {
            this.enabled = false;
            return;
          }
          // Rack and shelf are counters that already block the way; they only gain a trigger range
          var rack = this.toStation(rackNode, 'rack');
          var shelf = this.toStation(shelfNode, 'shelf');
          // The fryer counter is scenery until bought: the kitchen offers nothing there without cfg.fryerSec
          this.fryerStation = this.toStation(fryerNode, 'fryer');
          stations.push(rack, shelf, this.fryerStation);
          // Extinguisher on the north wall by the cold-room door; drink machine east of the fridge, shown once bought
          var ext = this.colourBlock(kitchenRoot, 'Station_Extinguisher', EXT_SPOT[0], EXT_SPOT[1], 0.5, 0.5, utils.createMesh(primitives.cylinder(0.24, 0.24, 0.6)), 0.55, new Color(220, 40, 40, 255));
          if (ext) stations.push(this.toStation(ext, 'extinguisher'));
          this.drinksNode = this.colourBlock(kitchenRoot, 'Station_Drinks', DRINKS_SPOT[0], DRINKS_SPOT[1], 0.8, 0.6, utils.createMesh(primitives.box({
            width: 1,
            height: 1.1,
            length: 1
          })), 0.55, new Color(70, 170, 210, 255));
          if (this.drinksNode) {
            this.drinksStation = this.toStation(this.drinksNode, 'drinks');
            stations.push(this.drinksStation);
          }
          this.platePos = shelf.pos;
          this.rackPos = rack.pos;
          this.grillStation = (_stations$find = stations.find(function (s) {
            return s.kind === 'grill';
          })) != null ? _stations$find : null;
          this.benchStation = (_stations$find2 = stations.find(function (s) {
            return s.kind === 'assembly';
          })) != null ? _stations$find2 : null;
          var register = stations.find(function (s) {
            return s.kind === 'register';
          });
          if (!register) {
            console.error("[StationView] " + NODES.kitchen + " \u5E95\u4E0B\u6CA1\u6709 Station_Order\uFF08\u70B9\u5355\u53F0\uFF09");
            this.enabled = false;
            return;
          }
          // Diners order and pick up at the counter beside the computer, not in front of it
          var counter = kitchenRoot.getChildByPath('Blockers/Block_CounterW');
          this.queueX = counter ? counter.worldPosition.x : register.pos.x;
          if (this.ingredientIcons.length !== INGREDIENTS.length || !this.plateIcon) {
            console.error("[StationView] ingredientIcons \u8981 " + INGREDIENTS.length + " \u5F20\uFF08\u987A\u5E8F\u540C INGREDIENTS\uFF09\uFF0CplateIcon \u8981\u8BBE");
            this.enabled = false;
            return;
          }
          // Index 1 = right after the Canvas camera, so every panel and the result mask draw over it
          var world = new Node('UI_World');
          world.layer = this.node.layer;
          // convertToUINode leaves `out` untouched when the target has no UITransform — every bubble
          // then kept its stale position and the rings drifted up by their own offset each frame
          world.addComponent(UITransform);
          this.node.insertChild(world, 1);
          this.carryBubble = new Bubble(world, 'Carry', INGREDIENTS.length + 1);
          for (var _i2 = 0; _i2 < 2; _i2++) this.grillRings.push(new Ring(world, "Grill_" + _i2, 18));
          this.benchBubble = new Bubble(world, 'Bench', INGREDIENTS.length);
          this.buildBurgerStack(kitchenRoot);
          this.buildPlateModels(kitchenRoot);
          for (var _i3 = 0; _i3 < ORDER_CARDS; _i3++) {
            this.customerRings.push(new Ring(world, "Customer_" + _i3));
            this.nudged.push(-1);
            this.urgedLate.push(-1);
          }
          this.floaters = new Floaters(world);
          this.sfx = new Sfx(this.node);
          this.board = new ComputerPanel(this.node, DELIVERY_OFFERS);
          for (var _i4 = 0; _i4 < DELIVERY_OFFERS; _i4++) {
            this.offerRows.push(null);
            this.offerView.push(null);
          }
          for (var _i5 = 0; _i5 < DELIVERY_ACTIVE; _i5++) this.riderRings.push(new Ring(world, "Rider_" + _i5));
          this.registerRing = new Ring(world, 'Register');
          this.deliveryRing = new Ring(world, 'Delivery');
          this.registerStation = register;
          this.deliveryStation = (_stations$find3 = stations.find(function (s) {
            return s.kind === 'delivery';
          })) != null ? _stations$find3 : null;
          this.buildDeliveryCards(ordersRoot);
          this.taskCard = new TaskCard((_ordersRoot$parent = ordersRoot.parent) != null ? _ordersRoot$parent : this.node, DAILY_TASKS, TASK_REWARD, ALL_DONE_BONUS);
          this.ordersRoot = ordersRoot;
          this.ordersY = ordersRoot.position.y;
          // The strip above the diner order row: anything lower covers the kitchen
          var action = this.need(NODES.action);
          for (var _i6 = 0, _arr = [action, discardBtn]; _i6 < _arr.length; _i6++) {
            var n = _arr[_i6];
            var w = n == null ? void 0 : n.getComponent(Widget);
            if (w) this.edgeWidgets.push({
              w: w,
              right: w.right,
              bottom: w.bottom
            });
          }
          if (action) this.controls = new Controls(joystick, action, discardBtn);
          this.plateRing = new Ring(world, 'Plates');
          this.sinkRing = new Ring(world, 'Sink');
          this.rackRing = new Ring(world, 'Rack');
          this.fryerRing = new Ring(world, 'Fryer');
          this.drinksRing = new Ring(world, 'Drinks');
          this.sinkStation = (_stations$find4 = stations.find(function (s) {
            return s.kind === 'sink';
          })) != null ? _stations$find4 : null;
          this.toast = new Toast(this.node);
          timeLabel.node.active = false;
          scoreLabel.node.active = false;
          this.pickupX = this.queueX;
          this.kitchen = createKitchen({
            stations: stations,
            cook: _extends({}, DEFAULT_COOK),
            grillSlots: 2,
            fridgeCap: this.fridgeCap,
            plates: this.plateCount,
            sparePlates: this.sparePlates,
            fireSec: FIRE_SEC,
            doublePatty: true
          });
          this.progress = parseProgress(StationView.load());
          this.applyUpgrades();
          this.day = this.progress.day;
          // 每次进游戏换一批单；同一次游戏里重打同一天出的是同一批（seed 不变）
          var seed = Date.now() & 0x7fffffff || 1;
          this.deliverySeed = (seed ^ 0x5bd1e995) >>> 0 || 1;
          this.desk = createDesk({
            intervalSec: this.deliveryIntervalSec,
            offerSec: this.deliveryOfferSec,
            deadlineSec: this.deliveryDeadlineSec,
            maxOffers: DELIVERY_OFFERS,
            maxActive: DELIVERY_ACTIVE
          }, dayFlow(this.day, this.arrivalSec).orders, this.deliverySeed);
          this.shift = createShift(this.shiftConfig(this.day, seed));
          this.resultNode.active = false;
          this.buildResultButtons();
          this.menu = new ListPanel(this.node, DECOR_SLOTS.length + 3);
          this.buildDecor(kitchenRoot);
          var blockers = this.need(NODES.blockers);
          this.cutaway = new WallCutaway(blockers ? [kitchenRoot, blockers] : [kitchenRoot]);
          this.movement = createMovement({
            stations: stations,
            boxes: blockers ? StationView.readBoxes(blockers) : []
          });
          this.baseSpeed = this.movement.cfg.speed;
          this.spawn = {
            x: this.movement.pos.x,
            z: this.movement.pos.z
          };
          this.router = new TouchRouter(view.getVisibleSize().width / 2, undefined, DEFAULT_ACTION);
          this.syncScreen();
          this.openDay();
          input.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
          input.on(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
          input.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);
          input.on(Input.EventType.TOUCH_CANCEL, this.onTouchCancel, this);
          // Desktop preview: the global input does not turn mouse into touch, and without this
          // the editor preview looks dead while the phone build works.
          input.on(Input.EventType.MOUSE_DOWN, this.onMouseDown, this);
          input.on(Input.EventType.MOUSE_MOVE, this.onMouseMove, this);
          input.on(Input.EventType.MOUSE_UP, this.onMouseUp, this);
          input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
          input.on(Input.EventType.KEY_UP, this.onKeyUp, this);
          game.on(Game.EVENT_HIDE, this.onTouchCancel, this);
          console.log("[StationView] ready \u2014 stations=" + stations.length + " slots=" + this.slotNodes.length + (" screen=" + this.screenW + "x" + this.screenH + " cameraYaw=" + camera.eulerAngles.y + "\xB0") + (" orthoHeight=" + this.cameraComp.orthoHeight.toFixed(2)));
        };
        _proto.onDestroy = function onDestroy() {
          input.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
          input.off(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
          input.off(Input.EventType.TOUCH_END, this.onTouchEnd, this);
          input.off(Input.EventType.TOUCH_CANCEL, this.onTouchCancel, this);
          input.off(Input.EventType.MOUSE_DOWN, this.onMouseDown, this);
          input.off(Input.EventType.MOUSE_MOVE, this.onMouseMove, this);
          input.off(Input.EventType.MOUSE_UP, this.onMouseUp, this);
          input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
          input.off(Input.EventType.KEY_UP, this.onKeyUp, this);
          game.off(Game.EVENT_HIDE, this.onTouchCancel, this);
        }

        // ─────────────────────────── 场景 → logic ───────────────────────────

        /**
         * Stations come from the nodes, never from a second table of numbers: a box drawn in
         * the editor and an AABB written in code drift, and the symptom ("stuck on an invisible
         * wall" / "can't reach a counter I'm touching") looks nothing like a size mismatch.
         * Guide §8 — Cube mesh is 1m, so worldScale is metres.
         */;
        _proto.readStations = function readStations(root) {
          var out = [];
          for (var _iterator2 = _createForOfIteratorHelperLoose(root.children), _step2; !(_step2 = _iterator2()).done;) {
            var child = _step2.value;
            var kind = STATION_KINDS[child.name];
            if (kind) out.push(this.toStation(child, kind));
          }
          return out;
        }

        /**
         * A station with no model yet: a coloured primitive on the floor at (x, z). The host's scale is the station box
         * (sx × sz); the body is the mesh inside it. ⏳ swap for art when it arrives
         */;
        _proto.colourBlock = function colourBlock(kitchenRoot, name, x, z, sx, sz, mesh, y, color) {
          var _kitchenRoot$getChild, _mr$getMaterialInstan;
          // Not the wall / floor material: decorating repaints every renderer sharing those
          var mat = (_kitchenRoot$getChild = kitchenRoot.getChildByName('Station_Grill')) == null || (_kitchenRoot$getChild = _kitchenRoot$getChild.getComponent(MeshRenderer)) == null ? void 0 : _kitchenRoot$getChild.sharedMaterial;
          if (!mat) {
            console.warn("[StationView] \u627E\u4E0D\u5230 Station_Grill \u7684\u6750\u8D28\uFF0C" + name + " \u6CA1\u6446\u51FA\u6765");
            return null;
          }
          var host = new Node(name);
          host.layer = kitchenRoot.layer;
          kitchenRoot.addChild(host);
          host.setWorldPosition(x, 0, z);
          host.setScale(sx, 1, sz);
          var body = new Node('Body');
          body.layer = kitchenRoot.layer;
          host.addChild(body);
          body.setPosition(0, y, 0);
          var mr = body.addComponent(MeshRenderer);
          mr.mesh = mesh;
          mr.setSharedMaterial(mat, 0);
          (_mr$getMaterialInstan = mr.getMaterialInstance(0)) == null || _mr$getMaterialInstan.setProperty('mainColor', color);
          return host;
        };
        _proto.toStation = function toStation(node, kind) {
          var p = node.worldPosition;
          var s = node.worldScale;
          var halfX = Math.abs(s.x) / 2;
          var halfZ = Math.abs(s.z) / 2;
          return {
            id: node.name,
            kind: kind,
            pos: {
              x: p.x,
              z: p.z
            },
            box: {
              center: {
                x: p.x,
                z: p.z
              },
              halfX: halfX,
              halfZ: halfZ
            },
            triggerRange: Math.max(halfX, halfZ) + this.reach
          };
        };
        _proto.shiftConfig = function shiftConfig(day, seed) {
          var d = dayFlow(day, this.arrivalSec);
          return {
            seed: seed,
            customers: this.customersPerShift,
            flow: _extends({}, d.flow, {
              intervalSec: d.flow.intervalSec * flowFactor(this.progress),
              intervalJitter: this.arrivalJitter,
              lateLeaveSec: this.lateLeaveSec,
              // 走进来要多久由场景几何算，不是拍的：接单的时机要和小人真走到柜台对上
              takeOrder: {
                walkInSec: Math.hypot(this.queueX - this.doorX, this.queueZ - this.doorZ) / CUSTOMER_SPEED,
                patienceSec: this.orderPatienceSec
              }
            }),
            orders: _extends({}, d.orders, {
              friesChance: owns(this.progress, 'fryer') ? FRIES_CHANCE : 0,
              drinkChance: owns(this.progress, 'drinks') ? DRINK_CHANCE : 0,
              doubleChance: day >= DOUBLE_FROM_DAY ? DOUBLE_CHANCE : 0
            })
          };
        }

        /** Bought upgrades → kitchen config. Read at the start of every day */;
        _proto.applyUpgrades = function applyUpgrades() {
          var p = this.progress;
          var cfg = this.kitchen.cfg;
          var g = owns(p, 'fast-grill') ? FAST_GRILL : 1;
          cfg.cook = {
            rareAt: DEFAULT_COOK.rareAt * g,
            mediumAt: DEFAULT_COOK.mediumAt * g,
            wellAt: DEFAULT_COOK.wellAt * g,
            burntAt: DEFAULT_COOK.burntAt * g
          };
          var w = owns(p, 'fast-wash') ? FAST_WASH : 1;
          cfg.wash = {
            soakSec: DEFAULT_WASH.soakSec * w,
            scrubSec: DEFAULT_WASH.scrubSec * w,
            drySec: DEFAULT_WASH.drySec * w,
            returnSec: DEFAULT_WASH.returnSec
          };
          var tray = owns(p, 'big-tray');
          cfg.stackMax = tray ? BIG_TRAY.max : undefined;
          cfg.stackSlow = tray ? BIG_TRAY.slow : undefined;
          cfg.fryerSec = owns(p, 'fryer') ? FRY_SEC : undefined;
          cfg.drinkSec = owns(p, 'drinks') ? DRINK_SEC : undefined;
          if (this.drinksNode) this.drinksNode.active = cfg.drinkSec !== undefined;
        }

        /** Storeroom-only ninth slot: spare plates. A column right of the 4×2 grid; the panel widens rightward to hold it */;
        _proto.buildPlateSlot = function buildPlateSlot(panel) {
          var src = this.slotNodes[this.slotNodes.length - 1];
          var slot = instantiate(src);
          slot.name = 'Slot_Plates';
          panel.addChild(slot);
          slot.setPosition(PLATE_SLOT_X, 0, 0);
          var icon = slot.getChildByName('Icon').getComponent(Sprite);
          icon.spriteFrame = this.plateIcon;
          icon.grayscale = false;
          slot.active = false;
          this.slotNodes.push(slot);
          this.slotIcons.push(icon);
          this.slotCounts.push(slot.getChildByName('Count').getComponent(Label));
        }

        /** Next-day and shop buttons, cloned from Btn_Again so they match whatever the scene styles it as */;
        _proto.buildResultButtons = function buildResultButtons() {
          var again = this.againNode;
          var t = again.getComponent(UITransform);
          if (t) t.width = RESULT_BTN_W;
          var clone = function clone(name, text) {
            var _n$getChildByName;
            var n = instantiate(again);
            n.name = name;
            again.parent.addChild(n);
            var l = (_n$getChildByName = n.getChildByName('Label')) == null ? void 0 : _n$getChildByName.getComponent(Label);
            if (l) l.string = text;
            return n;
          };
          this.nextNode = clone('Btn_Next', '下一天');
          this.shopNode = clone('Btn_Shop', '商店');
        }

        /**
         * Scene UI still uses the engine's default_sprite, which stretches into a dark blob over button text.
         * Flat colour until real art lands (M6). packable=false: the white texture has no image source and crashes the dynamic atlas.
         */;
        StationView.flattenPlaceholders = function flattenPlaceholders(root) {
          var flat = new SpriteFrame();
          flat.texture = builtinResMgr.get('white-texture');
          flat.packable = false;
          for (var _iterator3 = _createForOfIteratorHelperLoose(root.getComponentsInChildren(Sprite)), _step3; !(_step3 = _iterator3()).done;) {
            var _s$spriteFrame;
            var s = _step3.value;
            if (((_s$spriteFrame = s.spriteFrame) == null ? void 0 : _s$spriteFrame.name) !== 'default_sprite') continue;
            s.sizeMode = Sprite.SizeMode.CUSTOM;
            s.spriteFrame = flat;
          }
        };
        StationView.load = function load() {
          try {
            return sys.localStorage.getItem(SAVE_KEY);
          } catch (_unused) {
            return null;
          }
        };
        StationView.save = function save(p) {
          try {
            sys.localStorage.setItem(SAVE_KEY, serializeProgress(p));
          } catch (e) {
            console.warn('[StationView] 存档写不进去', e);
          }
        }

        /** Same cube-is-metres rule as readStations, for things that only block the way. */;
        StationView.readBoxes = function readBoxes(root) {
          return root.children.map(function (c) {
            var p = c.worldPosition;
            var s = c.worldScale;
            return {
              center: {
                x: p.x,
                z: p.z
              },
              halfX: Math.abs(s.x) / 2,
              halfZ: Math.abs(s.z) / 2
            };
          });
        };
        StationView.addLabel = function addLabel(parent, name, size, x, y) {
          var n = new Node(name);
          n.layer = parent.layer;
          parent.addChild(n);
          n.setPosition(x, y, 0);
          var l = n.addComponent(Label);
          l.fontSize = size;
          l.lineHeight = size + 2;
          l.enableOutline = true;
          l.outlineWidth = 3;
          l.outlineColor = Color.BLACK;
          return l;
        }

        /**
         * 顾客按 `customerModels` 轮换实例化，编辑器里的 `Customers` 保持空（m2-scene-guide §2.2）。
         * 进出口在顾客区西边外 1.5m；尺寸跟玩家的 `Model` 走，玩家和顾客才是同一比例的人。
         */;
        _proto.buildCustomers = function buildCustomers(player, root, floor) {
          var model = player.getChildByName('Model');
          var shadow = player.getChildByName('Shadow');
          if (!model || !shadow || this.customerModels.length === 0) {
            console.error("[StationView] \u8981\u6709 " + NODES.player + "/Model\u3001" + NODES.player + "/Shadow\uFF0C\u4E14 customerModels \u81F3\u5C11\u4E00\u4E2A");
            return false;
          }
          this.playerModel = model;
          this.playerAnim = model.getComponent(SkeletalAnimation);
          this.waitX = floor.position.x;
          this.waitZ = floor.position.z;
          this.doorX = floor.position.x + floor.scale.x / 2 + 1.5;
          this.exitX = floor.position.x - floor.scale.x / 2 - 1.5;
          this.doorZ = floor.position.z;
          this.queueZ = floor.position.z - floor.scale.z / 2 + 1;
          for (var i = 0; i < FIGURES; i++) {
            var node = new Node("Customer_" + i);
            var body = instantiate(this.customerModels[i % this.customerModels.length]);
            body.setScale(model.scale);
            node.addChild(body);
            node.addChild(instantiate(shadow));
            node.active = false;
            root.addChild(node);
            this.figures.push({
              node: node,
              body: body,
              anim: body.getComponent(SkeletalAnimation),
              id: -1,
              tx: 0,
              tz: 0,
              seat: -1,
              leaving: false,
              pickup: false,
              clip: '',
              shouted: false
            });
          }
          // Delivery riders: one per accepted order, last models first so they rarely match the diner beside them
          for (var _i7 = 0; _i7 < DELIVERY_ACTIVE; _i7++) {
            var _node = new Node("Rider_" + _i7);
            var _body = instantiate(this.customerModels[this.customerModels.length - 1 - _i7 % this.customerModels.length]);
            _body.setScale(model.scale);
            _node.addChild(_body);
            _node.addChild(instantiate(shadow));
            _node.active = false;
            root.addChild(_node);
            this.riders.push({
              node: _node,
              body: _body,
              anim: _body.getComponent(SkeletalAnimation),
              id: -1,
              tx: 0,
              tz: 0,
              seat: -1,
              leaving: false,
              pickup: false,
              clip: '',
              shouted: false
            });
          }
          return true;
        };
        _proto.need = function need(path) {
          var n = find(path);
          if (!n) console.error("[StationView] \u573A\u666F\u91CC\u627E\u4E0D\u5230 " + path + "\uFF08\u540D\u5B57\u89C1 m2-scene-guide \xA72.1\uFF09");
          return n;
        };
        _proto.label = function label(path) {
          var n = this.need(path);
          if (!n) return null;
          var l = n.getComponent(Label);
          if (!l) console.error("[StationView] " + path + " \u4E0A\u6CA1\u6709 cc.Label");
          return l;
        }

        // ─────────────────────────── 触摸 ───────────────────────────
        ;

        _proto.route = function route(e, fn) {
          var touches = e.getTouches();
          if (touches && touches.length > 0) {
            for (var _iterator4 = _createForOfIteratorHelperLoose(touches), _step4; !(_step4 = _iterator4()).done;) {
              var _t = _step4.value;
              _t.getLocation(this.touchPoint);
              fn(_t.getID(), this.touchPoint.x, this.touchPoint.y);
            }
            return;
          }
          var t = e.touch;
          if (!t) return;
          t.getLocation(this.touchPoint);
          fn(t.getID(), this.touchPoint.x, this.touchPoint.y);
        };
        _proto.onTouchStart = function onTouchStart(e) {
          var _this2 = this;
          this.sawTouch = true;
          this.firstInput('touch');
          this.route(e, function (id, x, y) {
            return _this2.router.onDown(id, x, y);
          });
        };
        _proto.onTouchMove = function onTouchMove(e) {
          var _this3 = this;
          this.route(e, function (id, x, y) {
            return _this3.router.onMove(id, x, y);
          });
        };
        _proto.onTouchEnd = function onTouchEnd(e) {
          var _this4 = this;
          this.route(e, function (id) {
            return _this4.router.onUp(id);
          });
        };
        _proto.onTouchCancel = function onTouchCancel() {
          this.mouseDown = false;
          this.router.cancelAll();
        };
        _proto.onMouseDown = function onMouseDown(e) {
          if (this.sawTouch) return;
          this.firstInput('mouse');
          this.mouseDown = true;
          e.getLocation(this.touchPoint);
          this.router.onDown(MOUSE_ID, this.touchPoint.x, this.touchPoint.y);
        };
        _proto.onMouseMove = function onMouseMove(e) {
          if (this.sawTouch || !this.mouseDown) return;
          e.getLocation(this.touchPoint);
          this.router.onMove(MOUSE_ID, this.touchPoint.x, this.touchPoint.y);
        };
        _proto.onMouseUp = function onMouseUp() {
          if (this.sawTouch || !this.mouseDown) return;
          this.mouseDown = false;
          this.router.onUp(MOUSE_ID);
        }

        // ── 键盘（只为桌面预览好操作；真机上没人按，这几条路径不存在）
        ;

        _proto.keyFlag = function keyFlag(code, down) {
          if (code === KeyCode.KEY_W) this.keys.w = down;else if (code === KeyCode.KEY_A) this.keys.a = down;else if (code === KeyCode.KEY_S) this.keys.s = down;else if (code === KeyCode.KEY_D) this.keys.d = down;else return false;
          return true;
        };
        _proto.onKeyDown = function onKeyDown(e) {
          if (e.keyCode === KeyCode.SPACE) {
            if (this.spaceDown) return;
            this.spaceDown = true;
            this.firstInput('keyboard');
            this.router.onDown(KEY_ACTION_ID, this.screenW * KEY_ACTION_POINT[0], this.screenH * KEY_ACTION_POINT[1]);
            return;
          }
          if (this.keyFlag(e.keyCode, true)) this.firstInput('keyboard');
        };
        _proto.onKeyUp = function onKeyUp(e) {
          if (e.keyCode === KeyCode.SPACE) {
            if (!this.spaceDown) return;
            this.spaceDown = false;
            this.router.onUp(KEY_ACTION_ID);
            return;
          }
          this.keyFlag(e.keyCode, false);
        }

        /**
         * WASD -> a synthetic finger on the left half, so the keys go through the same router,
         * deadzone and camera mapping as a real thumb. Nothing downstream knows the difference.
         */;
        _proto.syncKeyStick = function syncKeyStick() {
          var dx = 0;
          var dy = 0;
          if (this.keys.a) dx -= 1;
          if (this.keys.d) dx += 1;
          if (this.keys.s) dy -= 1;
          if (this.keys.w) dy += 1;
          // The panel freezes movement anyway, and the full-screen cancel zone would swallow
          // this press and close the panel on a stray W.
          if (this.panelOpen || this.reviewsOpen || dx === 0 && dy === 0) {
            if (this.keyStickDown) {
              this.keyStickDown = false;
              this.router.onUp(KEY_STICK_ID);
            }
            return;
          }
          var ox = this.screenW * KEY_STICK_ORIGIN[0];
          var oy = this.screenH * KEY_STICK_ORIGIN[1];
          var len = Math.sqrt(dx * dx + dy * dy);
          // radius exactly saturates magnitude, so a key press is always a full push
          var r = DEFAULT_STICK.radius;
          if (!this.keyStickDown) {
            this.keyStickDown = true;
            this.router.onDown(KEY_STICK_ID, ox, oy);
          }
          this.router.onMove(KEY_STICK_ID, ox + dx / len * r, oy + dy / len * r);
        }

        /** One line the first time anything arrives — tells a dead preview from a dead component. */;
        _proto.firstInput = function firstInput(src) {
          if (this.loggedInput) return;
          this.loggedInput = true;
          console.log("[StationView] first input via " + src);
        }

        // ─────────────────────────── 每帧 ───────────────────────────
        ;

        _proto.update = function update(dt) {
          this.resizeIn -= dt;
          if (this.resizeIn <= 0) {
            this.resizeIn = RESIZE_POLL_SEC;
            this.syncScreen();
          }

          // Read the pulses BEFORE tick(), never after: touch events land between frames and
          // tick() clears last frame's pulses on the way in, so reading after it never sees a
          // tap. holdStarted still works (tick produces it), so the symptom is "walks fine,
          // long-press fine, taps dead" — which looks like one unwired button, not an ordering bug.
          //
          // 只有这一处 tick()，所有读都排在它前面 —— 分支里各调一次的话，`pnpm scene` 那条
          // 顺序判据只认第一处，剩下的静默失守。
          if (this.resultOpen) {
            var _this$router$zone, _this$router$zone2, _this$router$zone3;
            // 打烊后世界停住，只剩结算面板上的按钮
            if (this.menuKind) this.tickMenu();else if ((_this$router$zone = this.router.zone('again')) != null && _this$router$zone.tapped) this.restart(this.day);else if (this.passed && (_this$router$zone2 = this.router.zone('next')) != null && _this$router$zone2.tapped) this.restart(this.day + 1);else if ((_this$router$zone3 = this.router.zone('shop')) != null && _this$router$zone3.tapped) this.openMenu('shop');
          } else {
            this.syncKeyStick();
            // Before opening and on a rest day the shop is frozen: only walking and the counter menu
            if (this.phase === 'open') {
              stepKitchen(this.kitchen, dt);
              stepShift(this.shift, dt, this.onWalkOut);
              stepVent(this.venting, dt, this.onRantDone);
              this.desk.open = !this.shift.over && this.shift.flow.arrived < this.customersPerShift;
              stepDesk(this.desk, dt, this.deskEvents);
            }
            // World keeps running while the panel is open; the stick is frozen because every
            // touch lands in a capture zone, so this is a no-op then.
            this.movement.cfg.speed = this.baseSpeed * carrySpeedFactor(this.kitchen) * ventSpeedFactor(this.venting);
            stepMovement(this.movement, this.router.stick, this.cameraYaw, dt);
            if (this.movement.blocked) bumpStack(this.kitchen, this.movement.impact);
            this.tickEvents();
            this.syncTasks(false);
            if (this.menuKind) this.tickMenu();else if (this.reviewsOpen) this.tickComputer();else if (this.panelOpen) this.tickPanel();else this.tickPlay();
          }
          this.router.tick(dt);

          // Accepted deliveries still count after the last diner leaves
          if (this.shift.over && !deskBusy(this.desk) && rantsLeft(this.venting) === 0 && !this.resultOpen) {
            this.showResult();
            return;
          }
          this.refreshZones();
          if (this.resultOpen) return;
          this.syncNodes();
          this.syncHud();
          this.toast.tick(dt, this.toastX, this.toastY);
        };
        _proto.syncScreen = function syncScreen() {
          // Touch coords are physical pixels, getVisibleSize() is design units. They differ by
          // the view scale, so zones built from design units miss on device.
          var px = view.getVisibleSizeInPixel();
          if (px.width === this.screenW && px.height === this.screenH) return;
          this.screenW = px.width;
          this.screenH = px.height;

          // Keep the whole design box on screen: wider than 16:9 extends sideways (Fit Height),
          // narrower would clip the order row under Fit Height, so it extends upward instead.
          var d = view.getDesignResolutionSize();
          var dw = d.width;
          var dh = d.height;
          var fitHeight = px.width * dh >= px.height * dw;
          if (fitHeight !== this.fitHeight) {
            this.fitHeight = fitHeight;
            view.setDesignResolutionSize(dw, dh, fitHeight ? ResolutionPolicy.FIXED_HEIGHT : ResolutionPolicy.FIXED_WIDTH);
          }
          var vs = view.getVisibleSize();
          this.designH = vs.height;
          this.uiHalfW = vs.width / 2;
          this.uiHalfH = vs.height / 2;
          this.router.setSplitX(px.width / 2);
          this.zonesKey = '';
          // Same formulas as the engine's SafeArea component; with no notch the rect is the visible area and all insets are 0
          var safe = sys.getSafeAreaRect();
          this.inset = {
            left: Math.max(0, safe.x),
            right: Math.max(0, vs.width - safe.x - safe.width),
            top: Math.max(0, vs.height - safe.y - safe.height),
            bottom: Math.max(0, safe.y)
          };
          for (var _iterator5 = _createForOfIteratorHelperLoose(this.edgeWidgets), _step5; !(_step5 = _iterator5()).done;) {
            var e = _step5.value;
            e.w.right = Math.max(e.right, this.inset.right + SAFE_GAP);
            e.w.bottom = Math.max(e.bottom, this.inset.bottom + SAFE_GAP);
            e.w.updateAlignment();
          }
          this.layoutHud();

          // Ortho height comes from the real aspect, not from the editor value: a near-square
          // screen needs a wider frame, otherwise following throws the grill off-screen (`pnpm cam`).
          var aspect = px.width / px.height;
          var h = effectiveOrthoHeight(aspect);
          this.cameraComp.orthoHeight = h;
          this.camBounds = focusBounds(h, aspect);
        }

        /**
         * Task card in the top-right corner; the order row and the review popup share what is left of the top strip,
         * shrinking only when the screen is too narrow for both
         */;
        _proto.layoutHud = function layoutHud() {
          var _this$ordersRoot$getC, _this$ordersRoot$getC2, _getComponent$height, _getComponent;
          var t = this.taskCard;
          var left = Math.max(HUD_MARGIN, this.inset.left);
          var right = Math.max(HUD_MARGIN, this.inset.right);
          var top = Math.max(HUD_MARGIN, this.inset.top);
          t.node.setPosition(this.uiHalfW - right - TASK_CARD_W / 2, this.uiHalfH - top - t.height / 2, 0);
          var avail = this.uiHalfW * 2 - left - right - TASK_CARD_W - HUD_MARGIN;
          var row = (_this$ordersRoot$getC = (_this$ordersRoot$getC2 = this.ordersRoot.getComponent(UITransform)) == null ? void 0 : _this$ordersRoot$getC2.width) != null ? _this$ordersRoot$getC : 1120;
          var k = Math.min(1, avail / row);
          var cx = -this.uiHalfW + left + avail / 2;
          this.ordersRoot.setScale(k, k, 1);
          this.ordersRoot.setPosition(cx, this.ordersY, 0);
          var kt = Math.min(1, avail / TOAST_W);
          this.toast.node.setScale(kt, kt, 1);
          var cardH = (_getComponent$height = (_getComponent = this.orderCards[0].getComponent(UITransform)) == null ? void 0 : _getComponent.height) != null ? _getComponent$height : 96;
          this.toastX = cx;
          this.toastY = this.ordersY + cardH * k / 2 + 4 + TOAST_H * kt / 2;
        };
        _proto.tickPlay = function tickPlay() {
          var _this$router$zone4,
            _stationInReach2,
            _this5 = this;
          if (this.phase !== 'open') {
            var _stationInReach;
            if (this.router.action.tapped && ((_stationInReach = stationInReach(this.kitchen, this.movement.pos)) == null ? void 0 : _stationInReach.kind) === 'register') {
              this.openMenu(this.phase === 'rest' ? 'rest' : 'open');
            }
            return;
          }
          if ((_this$router$zone4 = this.router.zone('discard')) != null && _this$router$zone4.holdStarted) {
            this.act(discard(this.kitchen));
            return;
          }
          if (this.tickArgue()) return;
          if (this.tryVent()) return;
          if (this.router.action.holding && ((_stationInReach2 = stationInReach(this.kitchen, this.movement.pos)) == null ? void 0 : _stationInReach2.kind) === 'sink') {
            this.scrub();
            return;
          }
          if (this.scrubbing) {
            this.scrubbing = false;
            if (releaseScrub(this.kitchen) && this.sinkStation) {
              var s = this.sinkStation;
              this.floaters.spawn(this.cameraComp, s.pos.x, BUBBLE_Y.bench, s.pos.z, '没刷干净就上架了', BAD_COLOR, 26);
            }
          }
          if (!this.router.action.tapped) return;
          var station = stationInReach(this.kitchen, this.movement.pos);
          if (!station) return;
          var held = this.kitchen.carry.kind;
          if (station.kind === 'fridge') {
            // 抱着箱子点冰柜就是补货，不用开面板
            if (held === 'crate') return this.act(interact(this.kitchen, this.movement.pos, station));
            // 手上拿着生料也让开 —— 点错一样食材不该逼玩家先跑一趟垃圾桶。
            // 盘子例外，换食材等于把整个汉堡扔了，那一下要玩家自己按 discard。
            if (held === 'plate' || held === 'stack') return this.report('hands-full');
            this.openPanel(station);
            return;
          }
          if (station.kind === 'register') {
            // 一下接完柜台前所有人：排队的人多时逐个按太磨，接单本身也不该是难点
            if (takeReadyOrders(this.shift.flow) > 0) return this.sfx.play('pick');
            // Nobody waiting: the counter computer shows the reviews
            this.openReviews();
            return;
          }
          if (station.kind === 'delivery') {
            var d = matchDelivery(this.desk, this.kitchen.burger);
            var r = interact(this.kitchen, this.movement.pos, station, {
              spec: d == null ? void 0 : d.spec
            });
            if (r.kind === 'serve' && d && r.verdict) {
              var rv = serveReview(r.verdict.ok, false, d.max > 0 ? d.left / d.max : 0);
              var line = CARD_LINES[(DELIVERY_ID_BASE + d.id) % CARD_LINES.length];
              this.review(DELIVERY_ID_BASE + d.id, rv.kind, rv.stars, rv.kind === 'praise' ? line.praise : line.complain);
              settleDelivery(this.desk, d, r.verdict.ok);
              return this.served(station, r.verdict.ok, false, rv.stars);
            }
            return this.act(r, r.reason === 'hands-empty' ? '先端上做好的汉堡' : r.reason === 'no-order' ? '没有要送的外卖' : undefined);
          }
          if (station.kind === 'storeroom') {
            if (held !== 'none') return this.report('hands-full');
            this.openPanel(station);
            return;
          }
          if (station.kind === 'serve') {
            if (held === 'fries' || held === 'drink') {
              var side = held === 'fries' ? 'fries' : 'drink';
              var _c = matchSide(this.shift.flow, side);
              var _r = interact(this.kitchen, this.movement.pos, station, {
                spec: _c == null ? void 0 : _c.spec
              });
              if ((_r.kind === 'serve-fries' || _r.kind === 'serve-drink') && _c) {
                var v = _c.burgerVerdict;
                var otherDue = side === 'fries' ? _c.drinkDue : _c.friesDue;
                if (v && !otherDue) return this.finishOrder(_c, v.ok, station, function () {
                  return settleSide(_this5.shift, _c, side);
                });
                settleSide(this.shift, _c, side);
                return this.halfServed(station, SIDE_ICON[side] + " \u5230\u4E86\uFF0C\u8FD8\u5DEE" + StationView.stillDue(_c));
              }
              return this.act(_r, _r.reason === 'no-order' ? side === 'fries' ? '没人点薯条' : '没人点饮料' : undefined);
            }
            // 谁接这一盘是玩法规则，不在组件里挑：logic 先找吃得下的，找不到砸给最急的那位
            var c = matchCustomer(this.shift.flow, this.kitchen.burger);
            var _r2 = interact(this.kitchen, this.movement.pos, station, {
              spec: c == null ? void 0 : c.spec
            });
            if (_r2.kind === 'serve' && c && _r2.verdict) {
              var _v = _r2.verdict;
              if (_v.ok && (c.friesDue || c.drinkDue)) {
                settleServe(this.shift, c, _v);
                return this.halfServed(station, "\uD83C\uDF54 \u5230\u4E86\uFF0C\u8FD8\u5DEE" + StationView.stillDue(c));
              }
              return this.finishOrder(c, _v.ok, station, function () {
                return settleServe(_this5.shift, c, _v);
              });
            }
            return this.act(_r2, _r2.reason === 'hands-empty' ? '先端上做好的汉堡' : undefined);
          }
          this.act(interact(this.kitchen, this.movement.pos, station));
        }

        /** Holding the action key at the sink: scrub, with a brush sound every so often and a cheer when done */;
        _proto.scrub = function scrub() {
          var k = this.kitchen;
          this.scrubbing = scrubSink(k, game.deltaTime);
          if (!this.scrubbing) return;
          this.scrubTick -= game.deltaTime;
          if (this.scrubTick <= 0) {
            this.scrubTick = FEEL.scrubTickSec;
            this.sfx.play('scrub', 0.8);
          }
          if (k.sink.stage === 'empty' && this.sinkStation) {
            this.scrubbing = false;
            var s = this.sinkStation;
            this.floaters.spawn(this.cameraComp, s.pos.x, BUBBLE_Y.bench, s.pos.z, '✨ 洗干净了', GOOD_COLOR);
            this.sfx.play('ready');
          }
        }

        /** A diner's order is complete: review (or rant), then `settle` releases them. Review is read before settling */;
        _proto.finishOrder = function finishOrder(c, ok, station, settle) {
          var rv = serveReview(ok, c.late, patienceRatio(this.shift.flow, c));
          var line = CARD_LINES[c.id % CARD_LINES.length];
          var upset = rv.kind !== 'praise';
          if (upset) this.rant(c.id, rv.kind, rv.stars, line.complain);else this.review(c.id, rv.kind, rv.stars, line.praise);
          var late = c.late;
          var fries = c.spec.fries === true;
          var drink = c.spec.drink === true;
          settle();
          for (var _iterator6 = _createForOfIteratorHelperLoose(this.figures), _step6; !(_step6 = _iterator6()).done;) {
            var f = _step6.value;
            if (f.id === c.id && !f.leaving) f.pickup = !upset;
          }
          this.served(station, ok, late, rv.stars, fries, drink);
        }

        /** Half of a burger-and-fries order handed over; the diner keeps waiting */;
        _proto.halfServed = function halfServed(station, text) {
          this.sfx.play('drop');
          this.floaters.spawn(this.cameraComp, station.pos.x, BUBBLE_Y.grill, station.pos.z, text, HINT_COLOR, 28);
        }

        /** A plate handed over: sound plus a word over the counter */
        /** What this diner is still waiting for, burger first */;
        StationView.stillDue = function stillDue(c) {
          var due = [];
          if (!c.burgerVerdict) due.push('汉堡');
          if (c.friesDue) due.push('薯条');
          if (c.drinkDue) due.push('饮料');
          return due.join('、');
        };
        _proto.served = function served(station, ok, late, stars, fries, drink) {
          if (fries === void 0) {
            fries = false;
          }
          if (drink === void 0) {
            drink = false;
          }
          this.sfx.play(ok && !late ? 'serve' : 'wrong');
          var got = earn(this.ledger, ok, late, stars, station.kind === 'delivery', fries, drink);
          var text = !ok ? '上错了' : late ? '超时 免单' : '★'.repeat(stars) + "  +\xA5" + got;
          this.floaters.spawn(this.cameraComp, station.pos.x, BUBBLE_Y.grill, station.pos.z, text, ok && !late ? GOOD_COLOR : BAD_COLOR, 34);
        };
        _proto.act = function act(r, hint) {
          if (r.kind === 'blocked') return this.report(r.reason, hint);
          var s = SFX_FOR[r.kind];
          if (s) this.sfx.play(s);
        };
        _proto.tickPanel = function tickPanel() {
          var _this$router$zone6;
          for (var i = 0; i < this.slotNodes.length; i++) {
            var _this$router$zone5;
            if (!((_this$router$zone5 = this.router.zone("slot" + i)) != null && _this$router$zone5.tapped)) continue;
            var station = this.panelStation;
            this.closePanel();
            if (!station) return this.report('unsupported');
            if (i === INGREDIENTS.length) {
              var _r3 = interact(this.kitchen, this.movement.pos, station, {
                plates: true
              });
              return this.act(_r3, _r3.reason === 'out-of-stock' ? '备用盘子领完了' : undefined);
            }
            // Picking closes the panel, even when refused — except after a first topping, so the
            // second hand is one more tap (tap outside to leave with just the one)
            var r = interact(this.kitchen, this.movement.pos, station, {
              ingredient: INGREDIENTS[i]
            });
            this.act(r);
            var c = this.kitchen.carry;
            if (r.kind === 'take-ingredient' && station.kind === 'fridge' && c.kind === 'ingredient' && c.second === null) {
              this.openPanel(station);
            }
            return;
          }
          if ((_this$router$zone6 = this.router.zone('panel-outside')) != null && _this$router$zone6.tapped) {
            this.sfx.play('tap');
            this.closePanel();
          }
        };
        _proto.openPanel = function openPanel(station) {
          this.panelStation = station;
          var fridge = station.kind === 'fridge';
          this.panelTitle.string = fridge ? '冰柜' : '冷库 · 抱一箱回冰柜补满';
          // Stock only moves on a pick or a restock, never while the panel is up — draw it once here
          var stock = this.kitchen.stock;
          for (var i = 0; i < INGREDIENTS.length; i++) {
            this.slotCounts[i].string = stock[i] + "/" + this.fridgeCap;
            this.slotIcons[i].grayscale = fridge && stock[i] <= 0;
          }
          var plates = this.slotNodes[INGREDIENTS.length];
          plates.active = !fridge;
          this.slotCounts[INGREDIENTS.length].string = "\u76D8\u5B50 " + this.kitchen.spare;
          this.slotIcons[INGREDIENTS.length].grayscale = this.kitchen.spare <= 0;
          // Grow rightward only, so the grid stays where the thumb learned it
          var t = this.panelNode.getComponent(UITransform);
          if (t) {
            t.width = fridge ? this.panelW : this.panelW + PANEL_GROW;
            t.anchorX = fridge ? 0.5 : this.panelW / 2 / (this.panelW + PANEL_GROW);
          }
          if (!this.panelOpen) {
            popIn(this.panelNode);
            this.sfx.play('tap');
          }
          this.panelOpen = true;
          // Freezes the stick: the thumb still on screen is dropped and cannot re-arm, since
          // the next press lands on the full-screen cancel zone.
          this.router.cancelAll();
        };
        _proto.closePanel = function closePanel() {
          this.panelOpen = false;
          this.router.cancelAll();
        }

        /** A refused action: a short hint over the chef's head. Walking out of reach is not worth a word */;
        _proto.report = function report(reason, hint) {
          this.lastBlock = reason;
          if (reason === 'none' || reason === 'out-of-range') return;
          console.log("[StationView] blocked: " + reason);
          var text = hint != null ? hint : HINT[reason];
          if (!text) return;
          this.sfx.play('deny', 0.7);
          var m = this.movement.pos;
          this.floaters.spawn(this.cameraComp, m.x, BUBBLE_Y.carry + 0.4, m.z, text, HINT_COLOR, 26);
        }

        // ─────────────────────────── logic → 场景 ───────────────────────────
        ;

        _proto.refreshZones = function refreshZones() {
          var _this$panelStation;
          var carrying = this.kitchen.carry.kind !== 'none';
          var mode = this.resultOpen ? 'result' : this.reviewsOpen ? 'reviews' : this.panelOpen ? 'panel' : carrying ? 'discard' : 'none';
          var key = mode + "|" + (this.reviewsOpen ? this.offerMask : '') + "|" + ((_this$panelStation = this.panelStation) == null ? void 0 : _this$panelStation.kind) + "|" + this.passed + "|" + this.menuKind + ":" + this.menuRows.length + "|" + this.screenW + "x" + this.screenH;
          if (key === this.zonesKey) return;
          this.zonesKey = key;

          // Widgets only align on active nodes, and the zone is built from the aligned position.
          this.panelNode.active = this.panelOpen && !this.resultOpen;
          this.discardNode.active = carrying && !this.panelOpen && !this.reviewsOpen && !this.resultOpen;
          var zones = [];
          if (this.menuKind) {
            var p = this.menu.node.position;
            for (var _iterator7 = _createForOfIteratorHelperLoose(this.menu.buttons), _step7; !(_step7 = _iterator7()).done;) {
              var b = _step7.value;
              zones.push(panelChildZone(b.id, p.x, p.y, b.x, b.y, b.w, b.h, this.screenW, this.screenH, this.designH));
            }
            zones.push({
              id: 'menu-outside',
              x: 0,
              y: 0,
              w: this.screenW,
              h: this.screenH
            });
          } else if (this.resultOpen) {
            var btns = [['again', this.againNode], ['next', this.passed ? this.nextNode : null], ['shop', this.shopNode]];
            for (var _i8 = 0, _btns = btns; _i8 < _btns.length; _i8++) {
              var _btns$_i = _btns[_i8],
                _id = _btns$_i[0],
                n = _btns$_i[1];
              var t = n == null ? void 0 : n.getComponent(UITransform);
              var _p = n == null ? void 0 : n.parent;
              if (!n || !t || !_p) continue;
              zones.push(panelChildZone(_id, _p.position.x, _p.position.y, n.position.x, n.position.y, t.width, t.height, this.screenW, this.screenH, this.designH));
            }
            // 兜底吞掉其余触摸：打烊了还能走路会让人以为局没结束
            zones.push({
              id: 'result-outside',
              x: 0,
              y: 0,
              w: this.screenW,
              h: this.screenH
            });
          } else if (this.reviewsOpen) {
            var _p2 = this.board.node.position;
            for (var _iterator8 = _createForOfIteratorHelperLoose(this.board.buttons), _step8; !(_step8 = _iterator8()).done;) {
              var _b = _step8.value;
              var row = Number(_b.id.slice(6));
              if (!this.offerRows[row]) continue;
              zones.push(panelChildZone(_b.id, _p2.x, _p2.y, _b.x, _b.y, _b.w, _b.h, this.screenW, this.screenH, this.designH));
            }
            // Last, so the buttons win the hit test
            zones.push({
              id: 'reviews-outside',
              x: 0,
              y: 0,
              w: this.screenW,
              h: this.screenH
            });
          } else if (this.panelOpen) {
            var _p3 = this.panelNode.position;
            for (var i = 0; i < this.slotNodes.length; i++) {
              var slot = this.slotNodes[i];
              var _t2 = slot.getComponent(UITransform);
              if (!_t2 || !slot.active) continue;
              zones.push(panelChildZone("slot" + i, _p3.x, _p3.y, slot.position.x, slot.position.y, _t2.width, _t2.height, this.screenW, this.screenH, this.designH));
            }
            // Last, so slots win the hit test: anywhere else cancels.
            zones.push({
              id: 'panel-outside',
              x: 0,
              y: 0,
              w: this.screenW,
              h: this.screenH
            });
          } else if (carrying) {
            var _this$discardNode$get;
            (_this$discardNode$get = this.discardNode.getComponent(Widget)) == null || _this$discardNode$get.updateAlignment();
            var _t3 = this.discardNode.getComponent(UITransform);
            var d = this.discardNode.position;
            if (_t3) {
              zones.push(uiRectToCaptureZone('discard', d.x, d.y, _t3.width, _t3.height, this.screenW, this.screenH, this.designH));
            }
          }
          this.router.setCaptureZones(zones);
        }

        /**
         * Things the logic counted since last frame. Mishaps → witnesses lose a mood tier (logic/witness.ts)
         * and the speaker's remark pops up top; each also gets its sound and a word on the spot.
         */;
        _proto.tickEvents = function tickEvents() {
          var k = this.kitchen;
          var cam = this.cameraComp;
          var cs = this.shift.flow.customers;
          while (this.seenBurnt < k.burnt) {
            this.seenBurnt++;
            this.mishap('burnt');
            var g = this.grillStation;
            if (g) this.floaters.spawn(cam, g.pos.x, BUBBLE_Y.grill, g.pos.z, '🔥 糊了', BAD_COLOR);
            this.markHighlight(20, '烤糊了一块肉', '厨房里飘着一股焦味');
            this.sfx.play('burnt');
            this.shake(FEEL.shakeSmall);
          }
          if (this.seenFires < k.fires) {
            this.seenFires = k.fires;
            var _g = this.grillStation;
            if (_g) this.floaters.spawn(cam, _g.pos.x, BUBBLE_Y.grill + 0.4, _g.pos.z, '🔥 着火了！去拿灭火器', BAD_COLOR, 34);
            this.mishap('burnt');
            this.sfx.play('crash');
            this.shake(FEEL.shakeBig);
            this.markHighlight(90, '烤炉着火了', '一块烤糊的肉没人管，整个烤炉烧了起来');
          }
          if (this.seenSpills < k.spills) {
            this.seenSpills = k.spills;
            var d = this.drinksStation;
            if (d) this.floaters.spawn(cam, d.pos.x, BUBBLE_Y.grill, d.pos.z, '💦 饮料洒了', BAD_COLOR);
            this.sfx.play('wrong');
          }
          if (this.seenBurntFries < k.burntFries) {
            this.seenBurntFries = k.burntFries;
            var f = this.fryerStation;
            if (f) this.floaters.spawn(cam, f.pos.x, BUBBLE_Y.grill, f.pos.z, '🔥 薯条炸糊了', BAD_COLOR);
            this.sfx.play('burnt');
          }
          while (this.seenCrash < k.crashed) {
            this.seenCrash++;
            this.mishap('crash');
            var m = this.movement.pos;
            this.floaters.spawn(cam, m.x, BUBBLE_Y.carry, m.z, '💥 盘子全摔了', BAD_COLOR);
            this.markHighlight(50, '一整摞盘子摔了个粉碎', '端着一摞盘子迎面撞上了墙');
            this.sfx.play('crash');
            this.shake(FEEL.shakeBig);
          }
          while (this.seenStained < k.stainedServed) {
            this.seenStained++;
            this.mishap('stained');
          }
          while (this.seenVents < this.venting.vents) {
            this.seenVents++;
            this.mishap('vent');
          }
          var drying = k.rack.count > 0;
          if (this.rackWasDrying && !drying) {
            this.floaters.spawn(cam, this.rackPos.x, BUBBLE_Y.bench, this.rackPos.z, '🍽 晾好了', GOOD_COLOR);
            this.sfx.play('ready');
          }
          this.rackWasDrying = drying;
          if (this.shift.flow.arrived > this.seenArrived) {
            this.seenArrived = this.shift.flow.arrived;
            this.sfx.play('ding', 0.6);
          }
          // Hurry-ups: once when a diner first turns 😡 (their card line up top plus a shout overhead), once more on going late
          for (var i = 0; i < cs.length; i++) {
            var c = cs[i];
            if (!c.active || !c.ordered) continue;
            if (this.nudged[i] !== c.id && moodTier(this.shift.flow, c) >= 3) {
              this.nudged[i] = c.id;
              this.review(c.id, 'witness', 0, CARD_LINES[c.id % CARD_LINES.length].wait_nudge);
              this.urge(c.id, URGE_ANGRY);
            }
            if (this.urgedLate[i] !== c.id && c.late) {
              this.urgedLate[i] = c.id;
              this.urge(c.id, URGE_LATE);
            }
          }
        };
        _proto.urge = function urge(id, lines) {
          var f = this.figureOf(id);
          if (!f) return;
          var p = f.node.position;
          var head = p.y + (p.y > 0 ? this.headSitY : this.headStandY);
          this.floaters.spawn(this.cameraComp, p.x, head + 0.45, p.z, lines[id % lines.length], BAD_COLOR, 26);
          this.sfx.play('deny', 0.6);
        };
        _proto.mishap = function mishap(kind) {
          var who = witnessMishap(this.shift.flow);
          var lines = WITNESS_LINES[kind];
          if (who) this.review(who.id, 'witness', 0, lines[this.witnessLine++ % lines.length]);
        };
        _proto.shake = function shake(amp) {
          this.shakeAmp = Math.max(amp, this.shakeLeft > 0 ? this.shakeAmp : 0);
          this.shakeLeft = FEEL.shakeSec;
        };
        /** An upset customer: rant at the desk first, review on the way out (logic/vent.ts) */
        _proto.rant = function rant(id, kind, stars, text) {
          this.rantReview.set(id, {
            kind: kind,
            text: text
          });
          startRant(this.venting, id, stars);
        };
        _proto.toRantSpot = function toRantSpot(f) {
          var i = Math.max(0, this.venting.rants.findIndex(function (r) {
            return r.id === f.id;
          }));
          f.pickup = false;
          f.tx = this.queueX + RANT_DX * (i + 1);
          f.tz = this.queueZ + RANT_DZ;
        }

        /** Long press at the fridge or at a ranting customer: vent (logic/vent.ts). True = this press is spent on it */;
        _proto.tryVent = function tryVent() {
          var a = this.router.action;
          if (!a.down) this.ventedThisPress = false;
          if (!a.down || this.ventedThisPress || a.heldSeconds < VENT_HOLD_SEC) return false;
          var st = stationInReach(this.kitchen, this.movement.pos);
          var spot = (st == null ? void 0 : st.kind) === 'fridge' ? 'fridge' : (st == null ? void 0 : st.kind) === 'register' ? 'register' : null;
          if (!spot || !st) return false;
          this.ventedThisPress = true;
          var r = vent(this.venting, spot);
          var m = this.movement.pos;
          if (r === null) {
            this.report('unsupported', '没人在前台发火');
            return true;
          }
          this.floaters.spawn(this.cameraComp, m.x, BUBBLE_Y.carry, m.z, r === true ? '💢 砰！' : '💢 狂点对骂！', BAD_COLOR, 30);
          if (r === true) this.markHighlight(60, '狠狠摔了一下冰柜门', '「砰！」整个后厨都听见了');
          this.sfx.play(r === true ? 'trash' : 'wrong');
          this.shake(FEEL.shakeSmall);
          return true;
        }

        /** In a shouting match: every tap trades a line; walking off ends it. True = this frame belongs to the match */;
        _proto.tickArgue = function tickArgue() {
          var _stationInReach3;
          var r = this.venting.argue;
          // Ends in logic (last tap, gone quiet, walked off); the storm-off shows the frame after
          if (this.arguing >= 0 && (r == null ? void 0 : r.id) !== this.arguing) {
            this.argueEnded(this.arguing);
            this.arguing = -1;
          }
          if (!r) return false;
          var id = r.id;
          this.arguing = id;
          if (((_stationInReach3 = stationInReach(this.kitchen, this.movement.pos)) == null ? void 0 : _stationInReach3.kind) !== 'register') {
            endArgue(this.venting);
            return false;
          }
          if (!this.router.action.tapped) return true;
          var i = argueTap(this.venting);
          this.argueCount = i + 1;
          var m = this.movement.pos;
          // Alternate sides so rapid taps do not stack on one spot
          var dx = i % 2 === 0 ? -0.35 : 0.35;
          this.floaters.spawn(this.cameraComp, m.x + dx, BUBBLE_Y.carry + 0.2, m.z, ARGUE_CHEF[i % ARGUE_CHEF.length], HINT_COLOR, 28);
          var f = this.figureOf(id);
          if (f) {
            var p = f.node.position;
            this.floaters.spawn(this.cameraComp, p.x - dx, this.headStandY + 0.5, p.z, ARGUE_CUSTOMER[i % ARGUE_CUSTOMER.length], BAD_COLOR, 26);
          }
          this.sfx.play('wrong', 0.6);
          this.shake(FEEL.shakeSmall);
          return true;
        };
        _proto.argueEnded = function argueEnded(id) {
          var n = this.argueCount;
          this.argueCount = 0;
          if (n > 0) {
            var last = n - 1;
            this.markHighlight(100 + n * 10, "\u548C\u300C" + StationView.nameOf(id) + "\u300D\u5BF9\u9A82\u4E86 " + n + " \u56DE\u5408", "\u4F60\uFF1A\u300C" + ARGUE_CHEF[last % ARGUE_CHEF.length] + "\u300D\n\u5BF9\u65B9\uFF1A\u300C" + ARGUE_CUSTOMER[last % ARGUE_CUSTOMER.length] + "\u300D\u7136\u540E\u6454\u95E8\u8D70\u4E86");
          }
          var f = this.figureOf(id);
          if (f) this.floaters.spawn(this.cameraComp, f.node.position.x, this.headStandY + 0.9, f.node.position.z, '（摔门走了）', BAD_COLOR, 26);
          this.sfx.play('trash');
        };
        _proto.markHighlight = function markHighlight(score, title, quote) {
          if (this.highlight && this.highlight.score >= score) return;
          this.highlight = {
            score: score,
            title: title,
            quote: quote
          };
        };
        StationView.nameOf = function nameOf(customerId) {
          return CARD_LINES[customerId % CARD_LINES.length].identity;
        };
        _proto.figureOf = function figureOf(id) {
          for (var _iterator9 = _createForOfIteratorHelperLoose(this.figures), _step9; !(_step9 = _iterator9()).done;) {
            var f = _step9.value;
            if (f.id === id) return f;
          }
          return null;
        };
        _proto.review = function review(customerId, kind, stars, text) {
          var card = customerId % CARD_LINES.length;
          var r = {
            customerId: customerId,
            kind: kind,
            stars: stars,
            t: this.shift.t
          };
          addReview(this.reviews, r);
          var name = CARD_LINES[card].identity + (customerId >= DELIVERY_ID_BASE ? '（外卖）' : '');
          var line = {
            name: name,
            avatar: card,
            stars: stars,
            text: text
          };
          this.reviewLines.push(line);
          if (this.reviewLines.length > this.reviews.cap) this.reviewLines.shift();
          this.toast.push(line);
        };
        _proto.openReviews = function openReviews() {
          var newest = [];
          for (var i = this.reviewLines.length - 1; i >= 0; i--) newest.push(this.reviewLines[i]);
          this.board.show(averageStars(this.reviews), newest);
          popIn(this.board.node);
          this.sfx.play('tap');
          this.reviewsOpen = true;
          this.syncOffers();
          this.router.cancelAll();
        }

        /** Map desk offers onto panel rows and redraw; the mask feeds the zone key */;
        _proto.syncOffers = function syncOffers() {
          var j = 0;
          var mask = '';
          for (var _iterator10 = _createForOfIteratorHelperLoose(this.desk.slots), _step10; !(_step10 = _iterator10()).done;) {
            var _this$offerView$j;
            var d = _step10.value;
            if (d.status !== 'offer' || j >= this.offerRows.length) continue;
            this.offerRows[j] = d;
            var v = (_this$offerView$j = this.offerView[j]) != null ? _this$offerView$j : {
              text: '',
              sec: 0
            };
            v.text = StationView.specText(d.spec);
            v.sec = Math.ceil(d.left);
            this.offerView[j] = v;
            j++;
          }
          for (var i = 0; i < this.offerRows.length; i++) {
            if (i >= j) {
              this.offerRows[i] = null;
              this.offerView[i] = null;
            }
            mask += this.offerRows[i] ? '1' : '0';
          }
          this.offerMask = mask;
          this.board.syncOffers(this.offerView);
        };
        _proto.tickComputer = function tickComputer() {
          var _this$router$zone9;
          for (var i = 0; i < this.offerRows.length; i++) {
            var _this$router$zone7, _this$router$zone8;
            var d = this.offerRows[i];
            if (!d) continue;
            if ((_this$router$zone7 = this.router.zone("accept" + i)) != null && _this$router$zone7.tapped) {
              if (acceptDelivery(this.desk, d)) this.sfx.play('pick');else this.report('hands-full', "\u5916\u5356\u540C\u65F6\u6700\u591A\u505A " + DELIVERY_ACTIVE + " \u5355");
              return this.syncOffers();
            }
            if ((_this$router$zone8 = this.router.zone("reject" + i)) != null && _this$router$zone8.tapped) {
              this.sfx.play('tap');
              rejectDelivery(this.desk, d);
              this.review(DELIVERY_ID_BASE + d.id, 'reject', REJECT_STARS, '外卖单被拒了');
              return this.syncOffers();
            }
          }
          if ((_this$router$zone9 = this.router.zone('reviews-outside')) != null && _this$router$zone9.tapped) {
            this.sfx.play('tap');
            return this.closeReviews();
          }
          this.syncOffers();
        };
        /** Two extra HUD cards for accepted deliveries, cloned from Order_0 */
        _proto.buildDeliveryCards = function buildDeliveryCards(root) {
          var _src$getComponent$hei, _src$getComponent;
          var src = this.orderCards[0];
          var h = (_src$getComponent$hei = (_src$getComponent = src.getComponent(UITransform)) == null ? void 0 : _src$getComponent.height) != null ? _src$getComponent$hei : 80;
          for (var i = 0; i < DELIVERY_ACTIVE; i++) {
            var card = instantiate(src);
            card.name = "Delivery_" + i;
            root.addChild(card);
            // Left column under the diner row
            card.setPosition(this.orderCards[0].position.x, -(h + 12) * (i + 1), 0);
            card.active = false;
            this.deliveryCards.push(card);
            this.deliveryTexts.push(card.getChildByName('Text').getComponent(Label));
            this.deliveryBars.push(card.getChildByName('Bar'));
            this.deliveryShown.push(-1);
          }
        }

        /** Rings over the counter computer (offers waiting) and the takeaway shelf (orders due) */;
        _proto.syncDeliveryRings = function syncDeliveryRings() {
          var _this6 = this;
          var cam = this.cameraComp;
          var soonest = function soonest(status) {
            var k = 2;
            for (var _iterator11 = _createForOfIteratorHelperLoose(_this6.desk.slots), _step11; !(_step11 = _iterator11()).done;) {
              var d = _step11.value;
              if (d.status === status && d.max > 0) k = Math.min(k, d.left / d.max);
            }
            return k;
          };
          var r = this.registerStation;
          var offer = soonest('offer');
          if (r && offer <= 1) {
            this.registerRing.show(offer, StationView.ringColor(offer), '🛵');
            this.registerRing.follow(cam, r.pos.x, BUBBLE_Y.grill, r.pos.z, this.uiHalfW, this.uiHalfH);
          } else this.registerRing.hide();
          var s = this.deliveryStation;
          var due = soonest('accepted');
          if (s && due <= 1) {
            this.deliveryRing.show(due, StationView.ringColor(due), '🛍');
            this.deliveryRing.follow(cam, s.pos.x, BUBBLE_Y.grill, s.pos.z, this.uiHalfW, this.uiHalfH);
          } else this.deliveryRing.hide();
          if (this.desk.nextId !== this.seenOffer) {
            this.seenOffer = this.desk.nextId;
            this.toast.push({
              name: '外卖平台',
              avatar: PLATFORM_AVATAR,
              stars: 0,
              text: '新外卖单，去点单台电脑接单'
            });
          }
        };
        _proto.closeReviews = function closeReviews() {
          this.reviewsOpen = false;
          this.board.hide();
          this.router.cancelAll();
        }

        /** What a tap (or hold) on the action key would do here, shown on the key */;
        _proto.actionVerb = function actionVerb() {
          var st = stationInReach(this.kitchen, this.movement.pos);
          if (!st) return '';
          if (this.phase !== 'open') return st.kind === 'register' ? this.phase === 'rest' ? '装修' : '开门' : '';
          var k = this.kitchen;
          var held = k.carry.kind;
          switch (st.kind) {
            case 'fridge':
              return held === 'crate' ? '补货' : '取料';
            case 'grill':
              if (k.fire) return held === 'extinguisher' ? '灭火' : '着火了';
              return held === 'patty' && k.carry.cook === 'raw' ? '下锅' : '取肉';
            case 'assembly':
              return held === 'none' ? '端盘' : held === 'plate' ? '放下' : '组装';
            case 'serve':
              return '上菜';
            case 'delivery':
              return '交外卖';
            case 'register':
              return this.venting.argue ? '狂点骂' : rantsLeft(this.venting) > 0 ? '长按怼' : '接单';
            case 'storeroom':
              return '搬箱';
            case 'sink':
              return k.sink.stage === 'soaked' ? '按住刷' : k.sink.stage === 'soaking' ? '泡着' : '泡碗';
            case 'rack':
              return '拿盘子';
            case 'shelf':
              return held === 'stack' ? '放盘子' : '';
            case 'extinguisher':
              return held === 'extinguisher' ? '放回' : '灭火器';
            case 'drinks':
              return k.drinks.stage === 'ready' ? '取饮料' : k.drinks.stage === 'pouring' ? '接着' : k.drinks.stage === 'spilled' ? '擦干净' : '接饮料';
            case 'fryer':
              return k.fryer.stage === 'ready' ? '取薯条' : k.fryer.stage === 'frying' ? '炸着' : k.fryer.stage === 'burnt' ? '倒掉' : '下薯条';
            default:
              return '';
          }
        }

        /** Clean plates over the shelf, the sink's soak/scrub progress, the rack drying */;
        _proto.syncKitchenRings = function syncKitchenRings() {
          var _k$cfg$wash2;
          var k = this.kitchen;
          var cam = this.cameraComp;
          if (k.plates !== this.shownPlates && this.plateModels.length > 0) {
            this.shownPlates = k.plates;
            for (var i = 0; i < this.plateModels.length; i++) this.plateModels[i].active = i < k.plates;
          }
          if (k.plates !== Infinity) {
            var fill = Math.min(1, k.plates / this.plateCount);
            this.plateRing.show(fill, StationView.ringColor(fill), '🍽');
            this.plateRing.follow(cam, this.platePos.x, BUBBLE_Y.bench, this.platePos.z, this.uiHalfW, this.uiHalfH);
          }
          var s = this.sinkStation;
          if (s) {
            var _k$cfg$wash;
            var sink = k.sink;
            var w = (_k$cfg$wash = k.cfg.wash) != null ? _k$cfg$wash : DEFAULT_WASH;
            if (sink.stage === 'soaking') this.sinkRing.show(1 - sink.left / w.soakSec, ASK_COLOR, '💧');else if (sink.stage === 'soaked') this.sinkRing.show(sink.scrub, RING_OK, '🧽');else if (k.dirty > 0) this.sinkRing.show(-1, RING_OK, "\u810F" + k.dirty, LATE_BAR_COLOR);else this.sinkRing.hide();
            if (sink.stage !== 'empty' || k.dirty > 0) this.sinkRing.follow(cam, s.pos.x, BUBBLE_Y.bench, s.pos.z, this.uiHalfW, this.uiHalfH);
          }
          if (k.rack.count > 0) this.rackRing.show(1 - k.rack.left / ((_k$cfg$wash2 = k.cfg.wash) != null ? _k$cfg$wash2 : DEFAULT_WASH).drySec, RING_OK, "" + k.rack.count);
          // Dried and waiting to be carried over: the number in the "come and get it" colour
          else if (k.rack.ready > 0) this.rackRing.show(-1, RING_OK, "\uD83C\uDF7D" + k.rack.ready, ASK_COLOR);else this.rackRing.hide();
          if (k.rack.count > 0 || k.rack.ready > 0) {
            this.rackRing.follow(cam, this.rackPos.x, BUBBLE_Y.bench, this.rackPos.z, this.uiHalfW, this.uiHalfH);
          }
          var fr = this.fryerStation;
          var fs = k.cfg.fryerSec;
          if (fr && fs !== undefined && k.fryer.stage !== 'empty') {
            if (k.fryer.stage === 'frying') this.fryerRing.show(1 - k.fryer.left / fs, ASK_COLOR, '🍟');else if (k.fryer.stage === 'burnt') this.fryerRing.show(1, BAD_COLOR, '🔥');else {
              // Ready: the ring drains towards burning
              var left = k.fryer.left / FRY_BURN_SEC;
              this.fryerRing.show(left, StationView.ringColor(left), '🍟');
            }
            this.fryerRing.follow(cam, fr.pos.x, BUBBLE_Y.grill, fr.pos.z, this.uiHalfW, this.uiHalfH);
          } else this.fryerRing.hide();
          var dm = this.drinksStation;
          var ds = k.cfg.drinkSec;
          if (dm && ds !== undefined && k.drinks.stage !== 'empty') {
            if (k.drinks.stage === 'pouring') this.drinksRing.show(1 - k.drinks.left / ds, ASK_COLOR, '🥤');else if (k.drinks.stage === 'spilled') this.drinksRing.show(1, BAD_COLOR, '💦');else {
              var _left = k.drinks.left / DRINK_SPILL_SEC;
              this.drinksRing.show(_left, StationView.ringColor(_left), '🥤');
            }
            this.drinksRing.follow(cam, dm.pos.x, BUBBLE_Y.grill, dm.pos.z, this.uiHalfW, this.uiHalfH);
          } else this.drinksRing.hide();
        };
        StationView.ringColor = function ringColor(k) {
          return k > 0.5 ? RING_OK : k > 0.25 ? RING_WARN : LATE_BAR_COLOR;
        }

        /** 订单卡文本。只在换人时调用，不在每帧热路径上 */;
        StationView.orderText = function orderText(c) {
          if (c.burgerVerdict) return ("\uD83C\uDF54 \u5DF2\u4E0A\n\u7B49 " + (c.friesDue ? '🍟 薯条 ' : '') + (c.drinkDue ? '🥤 饮料' : '')).trimEnd();
          var fries = c.spec.fries ? c.friesDue ? ' +薯条' : ' 🍟已上' : '';
          var drink = c.spec.drink ? c.drinkDue ? ' +饮料' : ' 🥤已上' : '';
          return StationView.specText(c.spec, '\n', fries + drink);
        };
        StationView.specText = function specText(spec, sep, tail) {
          if (sep === void 0) {
            sep = ' ';
          }
          if (tail === void 0) {
            tail = '';
          }
          var req = spec.required.map(function (i) {
            return INGREDIENT_LABEL[i];
          }).join(' ');
          var ban = spec.banned.length > 0 ? sep + "\u5FCC " + spec.banned.map(function (i) {
            return INGREDIENT_LABEL[i];
          }).join(' ') : '';
          return "" + (spec["double"] ? '双层 ' : '') + req + sep + COOK_LABEL[spec.doneness] + tail + ban;
        };
        _proto.icon = function icon(i) {
          var _this$ingredientIcons;
          return (_this$ingredientIcons = this.ingredientIcons[INGREDIENTS.indexOf(i)]) != null ? _this$ingredientIcons : null;
        }

        /** 手上 / 烤炉 / 组装台各一个气泡。key 编码状态，没变就不重画（铁律②：这里每帧都跑） */;
        _proto.syncBubbles = function syncBubbles() {
          var cam = this.cameraComp;
          var k = this.kitchen;
          var buf = this.iconBuf;
          var m = this.movement.pos;
          var carry = k.carry;
          if (carry.kind === 'none') this.carryBubble.hide();else if (carry.kind === 'fries') {
            if (this.carryBubble.show(600, buf, 0, '🍟 薯条', GOOD_COLOR)) pop(this.carryBubble.node);
          } else if (carry.kind === 'drink') {
            if (this.carryBubble.show(602, buf, 0, '🥤 饮料', GOOD_COLOR)) pop(this.carryBubble.node);
          } else if (carry.kind === 'extinguisher') {
            if (this.carryBubble.show(601, buf, 0, '🧯 灭火器', BAD_COLOR)) pop(this.carryBubble.node);
          } else if (carry.kind === 'ingredient') {
            buf[0] = this.icon(carry.ingredient);
            var n = carry.second === null ? 1 : 2;
            if (carry.second !== null) buf[1] = this.icon(carry.second);
            var key = 100 + INGREDIENTS.indexOf(carry.ingredient) * 10 + (carry.second === null ? 9 : INGREDIENTS.indexOf(carry.second));
            if (this.carryBubble.show(key, buf, n, '', Color.WHITE)) pop(this.carryBubble.node);
          } else if (carry.kind === 'crate') {
            buf[0] = this.icon(carry.ingredient);
            if (this.carryBubble.show(400 + INGREDIENTS.indexOf(carry.ingredient), buf, 1, '整箱', Color.WHITE)) pop(this.carryBubble.node);
          } else if (carry.kind === 'stack') {
            var _k$cfg$stackSlow;
            for (var i = 0; i < carry.count; i++) buf[i] = this.plateIcon;
            var heavy = carry.count > ((_k$cfg$stackSlow = k.cfg.stackSlow) != null ? _k$cfg$stackSlow : STACK_SLOW);
            if (this.carryBubble.show(500 + carry.count, buf, carry.count, heavy ? '太重了 · 别撞墙' : '', heavy ? BAD_COLOR : Color.WHITE)) {
              pop(this.carryBubble.node);
            }
          } else if (carry.kind === 'patty') {
            var _n = carry.plated ? 2 : 1;
            buf[0] = this.plateIcon;
            buf[_n - 1] = this.icon('patty');
            var caption = COOK_LABEL[carry.cook] + (carry.stained ? ' · 脏盘' : '');
            if (this.carryBubble.show(200 + _n * 10 + COOK_LEVELS.indexOf(carry.cook) + (carry.stained ? 50 : 0), buf, _n, caption, COOK_COLOR[carry.cook])) {
              pop(this.carryBubble.node);
            }
          } else {
            var cook = k.burger.cook;
            // The 3D stack already shows what is on it: doneness caption only
            var _n2 = this.burgerStack ? 0 : k.burger.ingredients.length + 1;
            if (_n2 > 0) {
              this.fillBurger(1);
              buf[0] = this.plateIcon;
            }
            var redrawn = this.carryBubble.show(300 + k.burger.ingredients.length * 10 + (cook ? COOK_LEVELS.indexOf(cook) : 9), buf, _n2, cook ? COOK_LABEL[cook] : '', cook ? COOK_COLOR[cook] : Color.WHITE);
            if (redrawn) pop(this.carryBubble.node);
          }
          if (carry.kind !== 'none') this.carryBubble.follow(cam, m.x, BUBBLE_Y.carry, m.z, this.uiHalfW, this.uiHalfH);
          var g = this.grillStation;
          if (g) {
            var w = k.cfg.cook;
            for (var _i9 = 0; _i9 < this.grillRings.length; _i9++) {
              var ring = this.grillRings[_i9];
              var slot = k.grill[_i9];
              if (k.fire) {
                ring.show(1, BAD_COLOR, '🔥');
                ring.follow(cam, g.pos.x, BUBBLE_Y.grill, g.pos.z, this.uiHalfW, this.uiHalfH, (_i9 - 0.5) * 64);
                continue;
              }
              if (!slot || !slot.busy) {
                ring.hide();
                continue;
              }
              var lv = grillCookLevel(k, _i9);
              var fs = k.cfg.fireSec;
              // Full ring = burnt, so the arc racing towards 12 o'clock is the warning; once burnt it drains towards the fire
              if (lv === 'burnt' && fs !== undefined) ring.show(Math.max(0, 1 - (slot.elapsed - w.burntAt) / fs), BAD_COLOR, COOK_LABEL[lv]);else ring.show(slot.elapsed / w.burntAt, COOK_COLOR[lv], COOK_LABEL[lv]);
              ring.follow(cam, g.pos.x, BUBBLE_Y.grill, g.pos.z, this.uiHalfW, this.uiHalfH, (_i9 - 0.5) * 64);
            }
          }
          var b = this.benchStation;
          if (b) {
            if (!k.assemblyOccupied) this.benchBubble.hide();else {
              var _n3 = this.burgerStack ? 0 : k.burger.ingredients.length;
              if (_n3 > 0) this.fillBurger(0);
              var _cook = k.burger.cook;
              var _redrawn = this.benchBubble.show(k.burger.ingredients.length * 10 + (_cook ? COOK_LEVELS.indexOf(_cook) : 9), buf, _n3, _cook ? COOK_LABEL[_cook] : '', _cook ? COOK_COLOR[_cook] : Color.WHITE);
              if (_redrawn) pop(this.benchBubble.node);
              this.benchBubble.follow(cam, b.pos.x, BUBBLE_Y.bench, b.pos.z, this.uiHalfW, this.uiHalfH);
            }
          }
          var bs = this.burgerStack;
          if (bs) {
            var burger = k.burger;
            if (carry.kind === 'plate') {
              var yaw = this.movement.facingYaw;
              bs.show(burger, k.burgerPlated, m.x + Math.sin(yaw) * HAND.reach, HAND.y, m.z + Math.cos(yaw) * HAND.reach);
            } else if (k.assemblyOccupied && b) bs.show(burger, false, b.pos.x, this.benchTopY, b.pos.z);else bs.hide();
          }
        }

        /** Decor slots take over the scene's own plants: a holder at each original's spot, the originals become templates */;
        _proto.buildDecor = function buildDecor(kitchenRoot) {
          var _props$getChildByName, _props$getChildByName2, _kitchenRoot$getChild2, _kitchenRoot$getChild3;
          var props = kitchenRoot.getChildByName('Props');
          var plants = (_props$getChildByName = props == null || (_props$getChildByName2 = props.getChildByName('Prop_Waiting')) == null ? void 0 : _props$getChildByName2.children.filter(function (c) {
            return c.name === 'pottedPlant';
          })) != null ? _props$getChildByName : [];
          var left = plants.find(function (c) {
            return c.worldPosition.x < 0;
          });
          var right = plants.find(function (c) {
            return c.worldPosition.x > 0;
          });
          var small = props == null ? void 0 : props.getChildByPath('Prop_Serve/plantSmall1');
          var book = props == null ? void 0 : props.getChildByPath('Prop_Shelf_0/bookcaseOpen');
          if (!props || !left || !right || !small || !book) {
            console.warn('[StationView] 装饰模板没找齐（等候区两盆盆栽 / 出餐台小盆栽 / 库房书架），装修不生效');
            return;
          }
          this.decorTemplates.set('plant', left).set('plant-small', small).set('bookcase', book);
          var spots = {
            'wait-left': left.worldPosition.clone(),
            'wait-right': right.worldPosition.clone(),
            counter: small.worldPosition.clone(),
            'wall-n': new Vec3(WALL_N_SPOT[0], 0, WALL_N_SPOT[1])
          };
          for (var _iterator12 = _createForOfIteratorHelperLoose(DECOR_SLOTS), _step12; !(_step12 = _iterator12()).done;) {
            var sl = _step12.value;
            var h = new Node("Decor_" + sl.id);
            h.layer = props.layer;
            props.addChild(h);
            h.setWorldPosition(spots[sl.id]);
            this.decorSlots.set(sl.id, h);
          }
          left.active = false;
          right.active = false;
          small.active = false;
          var wallMat = (_kitchenRoot$getChild2 = kitchenRoot.getChildByName('Wall_N')) == null || (_kitchenRoot$getChild2 = _kitchenRoot$getChild2.getComponent(MeshRenderer)) == null ? void 0 : _kitchenRoot$getChild2.sharedMaterial;
          var floorMat = (_kitchenRoot$getChild3 = kitchenRoot.getChildByName('Floor')) == null || (_kitchenRoot$getChild3 = _kitchenRoot$getChild3.getComponent(MeshRenderer)) == null ? void 0 : _kitchenRoot$getChild3.sharedMaterial;
          for (var _iterator13 = _createForOfIteratorHelperLoose(kitchenRoot.getComponentsInChildren(MeshRenderer)), _step13; !(_step13 = _iterator13()).done;) {
            var mr = _step13.value;
            if (wallMat && mr.sharedMaterial === wallMat) this.wallRenderers.push(mr);else if (floorMat && mr.sharedMaterial === floorMat) this.floorRenderers.push(mr);
          }
          this.applyDecor();
        };
        _proto.applyDecor = function applyDecor() {
          var d = this.progress.decor;
          for (var _iterator14 = _createForOfIteratorHelperLoose(DECOR_SLOTS), _step14; !(_step14 = _iterator14()).done;) {
            var _h$children$0$name, _h$children$;
            var sl = _step14.value;
            var h = this.decorSlots.get(sl.id);
            var want = d.placed[sl.id];
            if (!h || ((_h$children$0$name = (_h$children$ = h.children[0]) == null ? void 0 : _h$children$.name) != null ? _h$children$0$name : null) === want) continue;
            h.destroyAllChildren();
            var tpl = want ? this.decorTemplates.get(want) : undefined;
            if (!want || !tpl) continue;
            var n = instantiate(tpl);
            n.name = want;
            n.active = true;
            h.addChild(n);
            n.setPosition(0, 0, 0);
            n.setRotationFromEuler(0, 0, 0);
          }
          var w = WALL_COLORS[d.wall].rgb;
          var f = FLOOR_COLORS[d.floor].rgb;
          for (var _iterator15 = _createForOfIteratorHelperLoose(this.wallRenderers), _step15; !(_step15 = _iterator15()).done;) {
            var _mr$material;
            var mr = _step15.value;
            (_mr$material = mr.material) == null || _mr$material.setProperty('mainColor', new Color(w[0], w[1], w[2], 255));
          }
          for (var _iterator16 = _createForOfIteratorHelperLoose(this.floorRenderers), _step16; !(_step16 = _iterator16()).done;) {
            var _mr$material2;
            var _mr = _step16.value;
            (_mr$material2 = _mr.material) == null || _mr$material2.setProperty('mainColor', new Color(f[0], f[1], f[2], 255));
          }
        }

        /** Shelf stack from the scene's Prop_Plate plates: extra ones cloned at the same spacing, up to every plate there is */;
        _proto.buildPlateModels = function buildPlateModels(kitchenRoot) {
          var root = kitchenRoot.getChildByPath('Props/Prop_Plate');
          var own = root ? root.children.filter(function (c) {
            return c.name === 'plate';
          }).sort(function (a, b) {
            return a.position.y - b.position.y;
          }) : [];
          if (own.length < 2) {
            console.warn('[StationView] Props/Prop_Plate 底下的盘子少于 2 个，盘子堆不随数量变化');
            return;
          }
          var step = own[1].position.y - own[0].position.y;
          var base = own[0];
          while (own.length < this.plateCount + this.sparePlates) {
            var n = instantiate(base);
            root.addChild(n);
            n.setPosition(base.position.x, base.position.y + step * own.length, base.position.z);
            own.push(n);
          }
          this.plateModels = own;
        }

        /** Layer art is cloned from food props already in the scene, so no new asset wiring is needed */;
        _proto.buildBurgerStack = function buildBurgerStack(kitchenRoot) {
          var find = function find(p) {
            return kitchenRoot.getChildByPath("Props/" + p);
          };
          var benchPlate = find('Prop_AssemblyPlate/plate');
          var art = {
            bread: find('Prop_Crates/bread'),
            meat: find('Prop_Crates/meat-raw'),
            cheese: find('Prop_Crates/cheese'),
            cabbage: find('Prop_Crates/cabbage'),
            tomato: find('Prop_Crates/tomato'),
            plate: benchPlate
          };
          for (var _i10 = 0, _Object$entries = Object.entries(art); _i10 < _Object$entries.length; _i10++) {
            var _Object$entries$_i = _Object$entries[_i10],
              k = _Object$entries$_i[0],
              v = _Object$entries$_i[1];
            if (!v) {
              console.warn("[StationView] \u6C49\u5821\u53E0\u5C42\u7F3A\u7D20\u6750 " + k + "\uFF0C\u9000\u56DE\u5E73\u94FA\u56FE\u6807");
              return;
            }
          }
          this.burgerStack = new BurgerStack(kitchenRoot.scene, art);
          // Sits on the bench's decor plate
          this.benchTopY = benchPlate.worldPosition.y + 0.02;
        }

        /**
         * 顾客小人：进门 → 排队 → 接单后去长凳 → 离店走出去。位置是纯表现，规则全在 customer.ts；
         * 小人按顾客 id 认人，不按槽位 —— 槽位一空就会被新来的复用，而走的那位还在路上。
         */
        /** A rider walks in when a delivery is accepted, waits outside the pickup counter, and leaves once it is settled either way */;
        _proto.syncRiders = function syncRiders(dt) {
          var _this7 = this;
          var pick = this.deliveryStation;
          if (!pick) return;
          var _loop2 = function _loop2() {
            var r = _step17.value;
            if (r.id >= 0 && !r.leaving && !_this7.desk.slots.some(function (d) {
              return d.status === 'accepted' && d.id === r.id;
            })) {
              r.leaving = true;
              r.tx = _this7.doorX;
              r.tz = _this7.doorZ;
            }
          };
          for (var _iterator17 = _createForOfIteratorHelperLoose(this.riders), _step17; !(_step17 = _iterator17()).done;) {
            _loop2();
          }
          var _loop3 = function _loop3() {
              var d = _step18.value;
              if (d.status !== 'accepted' || _this7.riders.some(function (r) {
                return r.id === d.id;
              })) return 0; // continue
              var r = _this7.riders.find(function (x) {
                return x.id < 0;
              });
              if (!r) return 1; // break
              r.id = d.id;
              r.leaving = false;
              r.node.active = true;
              r.node.setPosition(_this7.doorX, 0, _this7.doorZ);
              var i = _this7.riders.indexOf(r);
              r.tx = _this7.doorX + RIDER_SPOT[0];
              r.tz = _this7.doorZ + RIDER_SPOT[1] + RIDER_GAP * i;
            },
            _ret2;
          for (var _iterator18 = _createForOfIteratorHelperLoose(this.desk.slots), _step18; !(_step18 = _iterator18()).done;) {
            _ret2 = _loop3();
            if (_ret2 === 0) continue;
            if (_ret2 === 1) break;
          }
          for (var _iterator19 = _createForOfIteratorHelperLoose(this.riders), _step19; !(_step19 = _iterator19()).done;) {
            var r = _step19.value;
            if (r.id < 0) continue;
            var p = r.node.position;
            var dx = r.tx - p.x;
            var dz = r.tz - p.z;
            var d = Math.hypot(dx, dz);
            var step = CUSTOMER_SPEED * dt;
            var clip = 'idle';
            if (d > step) {
              r.node.setPosition(p.x + dx / d * step, 0, p.z + dz / d * step);
              r.body.setRotationFromEuler(0, Math.atan2(dx, dz) * 180 / Math.PI, 0);
              clip = 'walk';
            } else if (r.leaving) {
              r.id = -1;
              r.leaving = false;
              r.node.active = false;
              continue;
            } else {
              r.node.setPosition(r.tx, 0, r.tz);
              r.body.setRotationFromEuler(0, -90, 0); // facing the counter, west
            }

            if (clip !== r.clip) {
              var _r$anim;
              r.clip = clip;
              (_r$anim = r.anim) == null || _r$anim.crossFade(clip, 0.15);
            }
          }
          var _loop = function _loop() {
              var r = _this7.riders[i];
              var ring = _this7.riderRings[i];
              var d = r.id >= 0 && !r.leaving ? _this7.desk.slots.find(function (x) {
                return x.id === r.id;
              }) : undefined;
              if (!ring) return 0; // continue
              if (!d || !r.node.active) {
                ring.hide();
                return 0; // continue
              }

              var k = d.max > 0 ? Math.max(0, d.left / d.max) : 0;
              ring.show(k, StationView.ringColor(k), '🛵');
              var p = r.node.position;
              ring.follow(_this7.cameraComp, p.x, p.y + _this7.headStandY, p.z);
            },
            _ret;
          for (var i = 0; i < this.riders.length; i++) {
            _ret = _loop();
            if (_ret === 0) continue;
          }
        };
        _proto.syncCustomers = function syncCustomers() {
          var dt = game.deltaTime;
          this.syncRiders(dt);
          var flow = this.shift.flow;
          var cs = flow.customers;
          for (var _iterator20 = _createForOfIteratorHelperLoose(this.figures), _step20; !(_step20 = _iterator20()).done;) {
            var _f = _step20.value;
            if (_f.id < 0 || _f.leaving) continue;
            var here = false;
            for (var _iterator24 = _createForOfIteratorHelperLoose(cs), _step24; !(_step24 = _iterator24()).done;) {
              var _c2 = _step24.value;
              if (_c2.active && _c2.id === _f.id) here = true;
            }
            if (here) continue;
            _f.leaving = true;
            if (_f.seat >= 0) this.seatOwner[_f.seat] = -1;
            _f.seat = -1;
            _f.tx = _f.pickup ? this.pickupX : this.exitX;
            _f.tz = _f.pickup ? this.queueZ : this.doorZ;
            if (ranting(this.venting, _f.id)) this.toRantSpot(_f);
          }
          for (var i = 0; i < cs.length; i++) {
            var c = cs[i];
            var b = this.customerRings[i];
            if (!c.active) {
              b.hide();
              continue;
            }
            var f = null;
            for (var _iterator21 = _createForOfIteratorHelperLoose(this.figures), _step21; !(_step21 = _iterator21()).done;) {
              var _g2 = _step21.value;
              if (_g2.id === c.id && !_g2.leaving) f = _g2;
            }
            if (!f) {
              for (var _iterator22 = _createForOfIteratorHelperLoose(this.figures), _step22; !(_step22 = _iterator22()).done;) {
                var g = _step22.value;
                if (g.id < 0) f = g;
              }
              if (!f) continue;
              f.id = c.id;
              f.leaving = false;
              f.pickup = false;
              f.shouted = false;
              f.seat = -1;
              f.clip = '';
              f.node.setPosition(this.doorX, 0, this.doorZ);
              f.node.active = true;
            }
            if (!c.ordered) {
              var k = queueIndex(flow, c);
              f.tx = this.queueX + k * QUEUE_GAP;
              f.tz = this.queueZ;
              // Walking in: just the "!" so the player sees someone is coming; the ring starts at the counter
              var walking = orderPatienceLeft(flow, c) >= this.orderPatienceSec;
              var left = patienceRatio(flow, c);
              b.show(walking ? -1 : left, StationView.ringColor(left), '❗', ASK_COLOR);
            } else {
              var _left2 = patienceRatio(flow, c);
              b.show(c.late ? 1 : _left2, c.late ? LATE_BAR_COLOR : StationView.ringColor(_left2), MOOD_FACE[moodTier(flow, c)]);
              if (f.seat < 0) {
                var s = this.seatOwner.indexOf(-1);
                if (s >= 0) {
                  this.seatOwner[s] = c.id;
                  f.seat = s;
                }
              }
              var spot = f.seat >= 0 ? WAIT_SPOTS[f.seat] : null;
              f.tx = spot ? this.waitX + spot[0] : this.queueX;
              f.tz = spot ? this.waitZ + spot[1] : this.queueZ;
            }
            var p = f.node.position;
            var head = f.clip === 'sit' ? this.headSitY : this.headStandY;
            // Not pinned to the screen edge: the ring belongs to the head, off-screen with it
            b.follow(this.cameraComp, p.x, p.y + head, p.z);
          }
          for (var _iterator23 = _createForOfIteratorHelperLoose(this.figures), _step23; !(_step23 = _iterator23()).done;) {
            var _f2 = _step23.value;
            if (_f2.id < 0) continue;
            var _p4 = _f2.node.position;
            var dx = _f2.tx - _p4.x;
            var dz = _f2.tz - _p4.z;
            var d = Math.hypot(dx, dz);
            var step = CUSTOMER_SPEED * dt;
            var clip = void 0;
            if (d > step) {
              _f2.node.setPosition(_p4.x + dx / d * step, 0, _p4.z + dz / d * step);
              _f2.body.setRotationFromEuler(0, Math.atan2(dx, dz) * 180 / Math.PI, 0);
              clip = 'walk';
            } else {
              if (_f2.pickup && _f2.leaving) {
                _f2.pickup = false;
                _f2.tx = this.exitX;
                _f2.tz = this.doorZ;
                continue;
              }
              if (_f2.leaving && ranting(this.venting, _f2.id)) {
                if (!_f2.shouted) {
                  _f2.shouted = true;
                  this.floaters.spawn(this.cameraComp, _p4.x, this.headStandY + 0.3, _p4.z, '😡 投诉！', BAD_COLOR, 28);
                }
                _f2.body.setRotationFromEuler(0, 180, 0);
                if (_f2.clip !== 'idle') {
                  var _f2$anim;
                  _f2.clip = 'idle';
                  (_f2$anim = _f2.anim) == null || _f2$anim.crossFade('idle', 0.15);
                }
                continue;
              }
              if (_f2.leaving) {
                _f2.id = -1;
                _f2.leaving = false;
                _f2.node.active = false;
                continue;
              }
              var sit = _f2.seat >= 0 && WAIT_SPOTS[_f2.seat][2];
              _f2.node.setPosition(_f2.tx, sit ? SEAT_Y : 0, _f2.tz);
              _f2.body.setRotationFromEuler(0, 180, 0); // 面朝柜台（北）
              clip = sit ? 'sit' : 'idle';
            }
            if (clip !== _f2.clip) {
              var _f2$anim2;
              _f2.clip = clip;
              (_f2$anim2 = _f2.anim) == null || _f2$anim2.crossFade(clip, 0.15);
            }
          }
        }

        /** 把当前汉堡的食材图标写进 iconBuf[from..] */;
        _proto.fillBurger = function fillBurger(from) {
          var ing = this.kitchen.burger.ingredients;
          for (var i = 0; i < ing.length; i++) this.iconBuf[from + i] = this.icon(ing[i]);
        };
        _proto.syncHud = function syncHud() {
          var j = 0;
          for (var _iterator25 = _createForOfIteratorHelperLoose(this.desk.slots), _step25; !(_step25 = _iterator25()).done;) {
            var d = _step25.value;
            if (d.status !== 'accepted' || j >= this.deliveryCards.length) continue;
            var _card = this.deliveryCards[j];
            if (!_card.active) _card.active = true;
            if (this.deliveryShown[j] !== d.id) {
              this.deliveryShown[j] = d.id;
              this.deliveryTexts[j].string = "\uD83D\uDEF5 " + StationView.specText(d.spec, '\n');
              pop(_card, 1.1);
            }
            this.deliveryBars[j].setScale(d.max > 0 ? Math.max(0, d.left / d.max) : 0, 1, 1);
            j++;
          }
          for (; j < this.deliveryCards.length; j++) {
            if (this.deliveryCards[j].active) this.deliveryCards[j].active = false;
            this.deliveryShown[j] = -1;
          }
          this.syncDeliveryRings();
          var cs = this.shift.flow.customers;
          for (var i = 0; i < this.orderCards.length; i++) {
            var c = i < cs.length ? cs[i] : undefined;
            var card = this.orderCards[i];
            // 没接单之前需求是看不见的 —— 要玩家去点单台问
            var on = c !== undefined && c.active && c.ordered;
            if (card.active !== on) card.active = on;
            if (!on || !c) {
              this.orderShown[i] = -1;
              continue;
            }
            // Key carries the sides too, so handing over part of an order redraws the card
            var shown = c.id * 8 + (c.friesDue ? 1 : 0) + (c.drinkDue ? 2 : 0) + (c.burgerVerdict ? 4 : 0);
            if (this.orderShown[i] !== shown) {
              this.orderShown[i] = shown;
              this.orderTexts[i].string = StationView.orderText(c);
              pop(card, 1.1);
            }
            // 超时的整条变红，比「空条」一眼更好认：这位还在等，但已经拿不到钱了
            if (this.barLate[i] !== c.late) {
              this.barLate[i] = c.late;
              this.orderBarSprites[i].color = c.late ? LATE_BAR_COLOR : this.barColor;
            }
            // Bar 的锚点在左端，所以缩 x 就是从左往右退
            var k = c.late ? 1 : c.patienceMax > 0 ? c.patienceLeft / c.patienceMax : 0;
            this.orderBars[i].setScale(k > 0 ? k : 0, 1, 1);
          }
        };
        _proto.showResult = function showResult() {
          var _again$getChildByName, _panel$getComponent$w2, _panel$getComponent2, _panel$position$x, _panel$position$y;
          // The HUD stops syncing once the result is up; without this the last order card stays frozen behind it
          this.syncHud();
          this.resultOpen = true;
          this.panelOpen = false;
          if (this.reviewsOpen) this.closeReviews();
          this.toast.clear();
          this.router.cancelAll();
          var r = shiftResult(this.shift);
          var stars = starsForShift(r);
          this.passed = finishDay(this.progress, this.day, stars);
          var takings = ledgerTotal(this.ledger);
          var states = this.syncTasks(true);
          var done = states.filter(function (x) {
            return x === 'done';
          }).length;
          var reward = taskReward(states);
          bank(this.progress, takings + reward);
          StationView.save(this.progress);
          this.resultTitle.string = "\u7B2C " + this.day + " \u5929  " + (stars > 0 ? '★'.repeat(stars) : '打烊');
          this.resultHead = "\u6765\u5BA2 " + r.arrived + "    \u597D\u8BC4 " + r.served + "\n" + ("\u8D85\u65F6\u514D\u5355 " + r.lateServed + "    \u4E0A\u9519 " + r.wrong + "\n") + ("\u6CA1\u4EBA\u63A5\u5355\u8D70\u4E86 " + r.walkedOut + "    \u7B49\u592A\u4E45\u8D70\u4E86 " + r.leftLate + "    \u6454\u788E\u76D8\u5B50 " + this.kitchen.broken + "\n") + ("\u5916\u5356 \u9001\u8FBE " + this.desk.delivered + "  \u505A\u9519 " + this.desk.wrong + "  \u8D85\u65F6 " + this.desk.late + "  \u62D2 " + this.desk.rejected + "\n") + ("\u597D\u8BC4\u7387 " + Math.round(r.goodRate * 100) + "%") + (stars === 0 ? '    拿到一颗星才能进下一天' : '') + ("\n\u4ECA\u65E5\u6536\u5165 \xA5" + takings + "\uFF08\u5C0F\u8D39 \xA5" + this.ledger.tips + "\uFF09") + ("\n\u4ECA\u65E5\u4EFB\u52A1 \u5B8C\u6210 " + done + "/" + states.length + "  \u5956\u52B1 \xA5" + reward) + (done === states.length ? '（含全部完成奖励）' : '');
          this.syncResultMoney();
          var again = this.againNode;
          var againLabel = (_again$getChildByName = again.getChildByName('Label')) == null ? void 0 : _again$getChildByName.getComponent(Label);
          if (againLabel) againLabel.string = this.passed ? '重打这一天' : '再来一局';
          if (this.nextNode) this.nextNode.active = this.passed;
          var row = [again, this.passed ? this.nextNode : null, this.shopNode].filter(function (n) {
            return !!n;
          });
          for (var i = 0; i < row.length; i++) row[i].setPosition((i - (row.length - 1) / 2) * RESULT_BTN_GAP, again.position.y, 0);
          var h = this.highlight;
          this.highlightCard.show(h ? h.title : '今天风平浪静', h ? h.quote : '没吵架、没着火、没摔盘子，难得的一天');
          var panel = again.parent;
          var pw = (_panel$getComponent$w2 = panel == null || (_panel$getComponent2 = panel.getComponent(UITransform)) == null ? void 0 : _panel$getComponent2.width) != null ? _panel$getComponent$w2 : 520;
          this.highlightCard.node.setPosition(((_panel$position$x = panel == null ? void 0 : panel.position.x) != null ? _panel$position$x : 0) + pw / 2 + 16 + this.highlightCard.width / 2, (_panel$position$y = panel == null ? void 0 : panel.position.y) != null ? _panel$position$y : 0, 0);
          this.resultNode.active = true;
          if (again.parent) popIn(again.parent);
          this.sfx.play('result');
          this.zonesKey = '';
          this.refreshZones();
          console.log("[StationView] \u6253\u70CA \u2014 day=" + this.day + " " + JSON.stringify(r) + " stars=" + stars + " passed=" + this.passed);
        };
        _proto.syncResultMoney = function syncResultMoney() {
          this.resultBody.string = this.resultHead + "    \u5B58\u6B3E \xA5" + this.progress.coins;
        };
        _proto.openMenu = function openMenu(kind) {
          this.sfx.play('tap');
          this.menuKind = kind;
          this.refreshMenu();
          popIn(this.menu.node);
          this.router.cancelAll();
        };
        _proto.refreshMenu = function refreshMenu() {
          if (!this.menuKind) return;
          var _this$buildMenu = this.buildMenu(this.menuKind),
            title = _this$buildMenu.title,
            rows = _this$buildMenu.rows;
          this.menuRows = rows;
          this.menu.show(title, rows);
          this.zonesKey = '';
        };
        _proto.closeMenu = function closeMenu() {
          this.menuKind = null;
          this.menuRows = [];
          this.menu.hide();
          this.router.cancelAll();
        };
        _proto.tickMenu = function tickMenu() {
          var _this$router$zone11;
          for (var i = 0; i < this.menuRows.length; i++) {
            var _this$router$zone10;
            if (!((_this$router$zone10 = this.router.zone("row" + i)) != null && _this$router$zone10.tapped)) continue;
            var r = this.menuRows[i];
            if (r.on) r.run();else this.sfx.play('deny', 0.7);
            return;
          }
          if ((_this$router$zone11 = this.router.zone('menu-outside')) != null && _this$router$zone11.tapped) {
            this.sfx.play('tap');
            this.closeMenu();
          }
        }

        /** A purchase went through: save, cheer, redraw the money */;
        _proto.spent = function spent() {
          StationView.save(this.progress);
          this.sfx.play('serve');
          if (this.resultOpen) this.syncResultMoney();
        };
        _proto.buildMenu = function buildMenu(kind) {
          var _this8 = this;
          var p = this.progress;
          var coins = p.coins;
          var money = "\u5B58\u6B3E \xA5" + coins + " \xB7 \u70B9\u7A7A\u767D\u5904\u5173\u95ED";
          if (kind === 'shop') {
            // Bought items take effect from the next day started (applyUpgrades in restart)
            return {
              title: "\u5546\u5E97 \xB7 " + money,
              rows: SHOP.map(function (it) {
                var have = owns(p, it.id);
                return {
                  name: it.name + "  \xA5" + it.price,
                  desc: it.desc,
                  btn: have ? '已拥有' : coins >= it.price ? '购买' : '钱不够',
                  on: !have && coins >= it.price,
                  run: function run() {
                    if (buy(p, it.id) === 'ok') _this8.spent();
                    _this8.refreshMenu();
                  }
                };
              })
            };
          }
          if (kind === 'open') {
            return {
              title: "\u7B2C " + this.day + " \u5929 \xB7 \u8FD8\u6CA1\u5F00\u95E8",
              rows: [{
                name: '开门营业',
                desc: '顾客开始上门',
                btn: '开门',
                on: true,
                run: function run() {
                  return _this8.openForBusiness();
                }
              }, {
                name: '今天打烊休息',
                desc: '今天不开门，可以装修店面；不算天数',
                btn: '休息',
                on: true,
                run: function run() {
                  return _this8.startRest();
                }
              }]
            };
          }
          if (kind === 'rest') {
            var rows = DECOR_SLOTS.map(function (sl) {
              var cur = p.decor.placed[sl.id];
              return {
                name: sl.name + "\uFF1A" + (cur ? DECOR_ITEMS.find(function (x) {
                  return x.id === cur;
                }).name : '空着'),
                desc: '换一样摆设',
                btn: '换',
                on: true,
                run: function run() {
                  return _this8.openMenu("slot:" + sl.id);
                }
              };
            });
            rows.push({
              name: "\u5899\u9762\u989C\u8272\uFF1A" + WALL_COLORS[p.decor.wall].name,
              desc: "\u6BCF\u6362\u4E00\u6B21 \xA5" + COLOR_PRICE,
              btn: '换',
              on: true,
              run: function run() {
                return _this8.openMenu('wall');
              }
            }, {
              name: "\u5730\u677F\u989C\u8272\uFF1A" + FLOOR_COLORS[p.decor.floor].name,
              desc: "\u6BCF\u6362\u4E00\u6B21 \xA5" + COLOR_PRICE,
              btn: '换',
              on: true,
              run: function run() {
                return _this8.openMenu('floor');
              }
            }, {
              name: '休息结束',
              desc: "\u5F00\u95E8\u8425\u4E1A\u7B2C " + this.day + " \u5929",
              btn: '开门',
              on: true,
              run: function run() {
                return _this8.openForBusiness();
              }
            });
            return {
              title: "\u4F11\u606F\u65E5 \xB7 " + money,
              rows: rows
            };
          }
          if (kind === 'wall' || kind === 'floor') {
            var list = kind === 'wall' ? WALL_COLORS : FLOOR_COLORS;
            return {
              title: (kind === 'wall' ? '墙面' : '地板') + "\u989C\u8272 \xB7 " + money,
              rows: list.map(function (c, i) {
                var cur = p.decor[kind] === i;
                return {
                  name: c.name,
                  desc: '',
                  btn: cur ? '当前' : coins >= COLOR_PRICE ? "\xA5" + COLOR_PRICE : '钱不够',
                  on: !cur && coins >= COLOR_PRICE,
                  run: function run() {
                    if (paint(p, kind, i) === 'ok') {
                      _this8.spent();
                      _this8.applyDecor();
                    }
                    _this8.openMenu('rest');
                  }
                };
              })
            };
          }
          var slot = DECOR_SLOTS.find(function (x) {
            return "slot:" + x.id === kind;
          });
          var cur = p.decor.placed[slot.id];
          var choices = [null].concat(slot.allowed);
          return {
            title: slot.name + " \xB7 " + money,
            rows: choices.map(function (id) {
              var it = id ? DECOR_ITEMS.find(function (x) {
                return x.id === id;
              }) : null;
              var have = !it || p.decor.owned.includes(it.id);
              var afford = have || coins >= it.price;
              return {
                name: it ? it.name : '空着',
                desc: !it ? '什么都不摆' : have ? '已经买过，摆上不要钱' : "\xA5" + it.price + "\uFF0C\u4E70\u4E00\u6B21\u54EA\u4E2A\u4F4D\u5B50\u90FD\u80FD\u6446",
                btn: cur === id ? '当前' : !afford ? '钱不够' : have ? it ? '摆上' : '撤掉' : '买下',
                on: cur !== id && afford,
                run: function run() {
                  if (place(p, slot.id, id) === 'ok') {
                    if (have) _this8.sfx.play('drop');else _this8.spent();
                    StationView.save(p);
                    _this8.applyDecor();
                  }
                  _this8.openMenu('rest');
                }
              };
            })
          };
        };
        _proto.openForBusiness = function openForBusiness() {
          this.closeMenu();
          this.phase = 'open';
          this.taskCard.node.active = true;
          this.floaters.spawnAt(0, 60, "\u7B2C " + this.day + " \u5929 \xB7 \u5F00\u95E8\u8425\u4E1A\uFF01", GOOD_COLOR, 44);
          this.zonesKey = '';
        };
        _proto.startRest = function startRest() {
          this.closeMenu();
          this.phase = 'rest';
          this.taskCard.node.active = false;
          this.floaters.spawnAt(0, 60, '今天休息 · 去前台装修', GOOD_COLOR, 40);
          this.zonesKey = '';
        }

        /** The day's opening banner */;
        _proto.openDay = function openDay() {
          this.phase = 'closed';
          this.taskCard.node.active = true;
          this.floaters.spawnAt(0, 60, "\u7B2C " + this.day + " \u5929 \xB7 \u53BB\u524D\u53F0\u5F00\u95E8", GOOD_COLOR, 44);
          this.tasks = rollTasks(this.day, this.customersPerShift, owns(this.progress, 'fryer'));
          this.taskState = this.tasks.map(function () {
            return 'open';
          });
          this.taskShown = this.tasks.map(function () {
            return '';
          });
          this.syncTasks(false);
        }

        /** Re-reads the day's counters into the task card. `closed` settles open tasks. A task done mid-shift pops a floater */;
        _proto.syncTasks = function syncTasks(closed) {
          var s = collectStats(shiftResult(this.shift), this.kitchen, this.desk, this.ledger);
          for (var i = 0; i < this.tasks.length; i++) {
            var t = this.tasks[i];
            var st = taskStatus(t, s, closed);
            if (!closed && st === 'done' && this.taskState[i] === 'open') this.floaters.spawnAt(0, 20, "\u2714 \u4EFB\u52A1\u5B8C\u6210 +\xA5" + TASK_REWARD, GOOD_COLOR, 36);
            this.taskState[i] = st;
            var text = taskText(t, s);
            if (this.taskShown[i] !== st + text) {
              this.taskShown[i] = st + text;
              this.taskCard.set(i, text, st);
            }
          }
          return this.taskState;
        }

        /** Start `day` over: the same day replays the same orders (seed unchanged), a new day tightens the flow */;
        _proto.restart = function restart(day) {
          this.sfx.play('tap');
          this.day = day;
          this.passed = false;
          this.resultOpen = false;
          this.resultNode.active = false;
          if (this.menuKind) this.closeMenu();
          this.applyUpgrades();
          var cfg = this.shiftConfig(day, this.shift.cfg.seed);
          resetShift(this.shift, cfg);
          this.desk.orders = cfg.orders;
          resetDesk(this.desk, this.deliverySeed);
          this.seenOffer = 1;
          resetKitchen(this.kitchen);
          resetVent(this.venting);
          resetLedger(this.ledger);
          this.rantReview.clear();
          this.seenVents = 0;
          this.ventedThisPress = false;
          this.arguing = -1;
          this.argueCount = 0;
          this.highlight = null;
          teleport(this.movement, this.spawn.x, this.spawn.z);
          this.seenBurnt = 0;
          this.seenBurntFries = 0;
          this.seenSpills = 0;
          this.seenFires = 0;
          this.seenCrash = 0;
          this.seenStained = 0;
          this.seenArrived = 0;
          this.rackWasDrying = false;
          this.scrubbing = false;
          this.shakeLeft = 0;
          this.nudged.fill(-1);
          this.urgedLate.fill(-1);
          for (var _i11 = 0, _arr2 = [].concat(this.figures, this.riders); _i11 < _arr2.length; _i11++) {
            var f = _arr2[_i11];
            f.id = -1;
            f.pickup = false;
            f.leaving = false;
            f.node.active = false;
          }
          this.seatOwner.fill(-1);
          for (var i = 0; i < this.orderShown.length; i++) this.orderShown[i] = -1;
          this.router.cancelAll();
          this.zonesKey = '';
          this.openDay();
        };
        _proto.syncNodes = function syncNodes() {
          var _this$cutaway;
          var m = this.movement.pos;
          this.playerNode.setPosition(m.x, this.playerNode.position.y, m.z);
          if (this.playerModel) {
            this.playerModel.setRotationFromEuler(0, this.movement.facingYaw * 180 / Math.PI, 0);
            if (this.playerWalking !== this.movement.moving) {
              var _this$playerAnim;
              this.playerWalking = this.movement.moving;
              (_this$playerAnim = this.playerAnim) == null || _this$playerAnim.crossFade(this.playerWalking ? 'walk' : 'idle', 0.15);
            }
          }
          focusForPlayer(this.camFocus, m, this.camBounds);
          (_this$cutaway = this.cutaway) == null || _this$cutaway.update(m.x, m.z, game.deltaTime);
          var sx = 0;
          var sz = 0;
          if (this.shakeLeft > 0) {
            this.shakeLeft -= game.deltaTime;
            var a = this.shakeAmp * Math.max(0, this.shakeLeft) / FEEL.shakeSec;
            sx = Math.sin(this.shift.t * 90) * a;
            sz = Math.cos(this.shift.t * 77) * a;
          }
          this.cameraNode.setPosition(this.camFocus.x + this.camOffset.x + sx, this.camOffset.y, this.camFocus.z + this.camOffset.z + sz);
          this.syncBubbles();
          this.syncCustomers();
          this.syncKitchenRings();
          var stick = this.router.stick;
          if (this.controls) {
            this.controls.syncStick(stick.dirX, stick.dirY, stick.magnitude);
            this.controls.setPressed(this.router.action.down);
            this.controls.setAction(this.actionVerb());
          }
          if (this.joystickNode.active !== stick.active) this.joystickNode.active = stick.active;
          if (stick.active) {
            this.joystickNode.setPosition(screenToCanvasX(this.router.stickOriginX, this.screenW, this.screenH, this.designH), screenToCanvasY(this.router.stickOriginY, this.screenH, this.designH), 0);
          }
        };
        return StationView;
      }(Component), (_descriptor = _applyDecoratedDescriptor(_class2.prototype, "reach", [_dec2], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 0.7;
        }
      }), _descriptor2 = _applyDecoratedDescriptor(_class2.prototype, "customerModels", [_dec3], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return [];
        }
      }), _descriptor3 = _applyDecoratedDescriptor(_class2.prototype, "ingredientIcons", [_dec4], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return [];
        }
      }), _descriptor4 = _applyDecoratedDescriptor(_class2.prototype, "plateIcon", [_dec5], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor5 = _applyDecoratedDescriptor(_class2.prototype, "fridgeCap", [_dec6], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 4;
        }
      }), _descriptor6 = _applyDecoratedDescriptor(_class2.prototype, "headStandY", [_dec7], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 1.45;
        }
      }), _descriptor7 = _applyDecoratedDescriptor(_class2.prototype, "headSitY", [_dec8], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 0.76;
        }
      }), _descriptor8 = _applyDecoratedDescriptor(_class2.prototype, "orderPatienceSec", [_dec9], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 25;
        }
      }), _descriptor9 = _applyDecoratedDescriptor(_class2.prototype, "customersPerShift", [_dec10], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 10;
        }
      }), _descriptor10 = _applyDecoratedDescriptor(_class2.prototype, "plateCount", [_dec11], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 6;
        }
      }), _descriptor11 = _applyDecoratedDescriptor(_class2.prototype, "sparePlates", [_dec12], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 4;
        }
      }), _descriptor12 = _applyDecoratedDescriptor(_class2.prototype, "lateLeaveSec", [_dec13], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 20;
        }
      }), _descriptor13 = _applyDecoratedDescriptor(_class2.prototype, "deliveryIntervalSec", [_dec14], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 40;
        }
      }), _descriptor14 = _applyDecoratedDescriptor(_class2.prototype, "deliveryOfferSec", [_dec15], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 15;
        }
      }), _descriptor15 = _applyDecoratedDescriptor(_class2.prototype, "deliveryDeadlineSec", [_dec16], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 75;
        }
      }), _descriptor16 = _applyDecoratedDescriptor(_class2.prototype, "arrivalSec", [_dec17], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 30;
        }
      }), _descriptor17 = _applyDecoratedDescriptor(_class2.prototype, "arrivalJitter", [_dec18], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 0.5;
        }
      })), _class2)) || _class));
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/tasks.ts", ['cc', './rng.ts', './economy.ts'], function (exports) {
  var cclegacy, nextInt, createRng, ledgerTotal;
  return {
    setters: [function (module) {
      cclegacy = module.cclegacy;
    }, function (module) {
      nextInt = module.nextInt;
      createRng = module.createRng;
    }, function (module) {
      ledgerTotal = module.ledgerTotal;
    }],
    execute: function () {
      exports({
        collectStats: collectStats,
        rollTasks: rollTasks,
        taskReward: taskReward,
        taskStatus: taskStatus,
        taskText: taskText
      });
      cclegacy._RF.push({}, "915f6GxjfFIHpTkWFC8R0+T", "tasks", undefined);
      var DAILY_TASKS = exports('DAILY_TASKS', 3);
      var TASK_REWARD = exports('TASK_REWARD', 20);
      var ALL_DONE_BONUS = exports('ALL_DONE_BONUS', 30);
      var STAT = {
        good: 'good',
        'no-wrong': 'wrong',
        'no-burnt': 'burnt',
        'no-broken': 'broken',
        delivered: 'delivered',
        income: 'income',
        fries: 'fries'
      };

      /** "Never do X" tasks: failed the moment X happens, done only at closing */
      var isZero = function isZero(id) {
        return id === 'no-wrong' || id === 'no-burnt' || id === 'no-broken';
      };
      function targetFor(id, customers) {
        switch (id) {
          case 'good':
            return Math.ceil(customers * 0.6);
          case 'delivered':
            return 2;
          case 'income':
            return customers * 8;
          case 'fries':
            return Math.ceil(customers * 0.2);
          default:
            return 0;
        }
      }

      /** Same day → same tasks. Fries only once the fryer is owned */
      function rollTasks(day, customers, fryer) {
        var pool = ['good', 'no-wrong', 'no-burnt', 'no-broken', 'delivered', 'income'];
        if (fryer) pool.push('fries');
        var rng = createRng(Math.imul(day, 0x9e3779b1) ^ 0x7a5c3);
        var out = [];
        for (var i = 0; i < DAILY_TASKS; i++) {
          var id = pool.splice(nextInt(rng, pool.length), 1)[0];
          out.push({
            id: id,
            target: targetFor(id, customers)
          });
        }
        return out;
      }
      function collectStats(r, k, desk, l) {
        return {
          good: r.served,
          wrong: r.wrong + desk.wrong,
          burnt: k.burnt,
          broken: k.broken,
          delivered: desk.delivered,
          income: ledgerTotal(l),
          fries: l.fries
        };
      }

      /** `closed` = the day is over: open tasks settle either way */
      function taskStatus(t, s, closed) {
        var v = s[STAT[t.id]];
        if (isZero(t.id)) return v > 0 ? 'failed' : closed ? 'done' : 'open';
        return v >= t.target ? 'done' : closed ? 'failed' : 'open';
      }
      function taskText(t, s) {
        var v = Math.min(s[STAT[t.id]], t.target);
        switch (t.id) {
          case 'good':
            return "\u597D\u8BC4 " + v + "/" + t.target + " \u76D8";
          case 'no-wrong':
            return '一盘都不上错';
          case 'no-burnt':
            return '一个肉饼都不烤糊';
          case 'no-broken':
            return '一个盘子都不摔';
          case 'delivered':
            return "\u9001\u8FBE\u5916\u5356 " + v + "/" + t.target + " \u5355";
          case 'income':
            return "\u6536\u5165 \xA5" + v + "/\xA5" + t.target;
          case 'fries':
            return "\u5356\u51FA\u85AF\u6761 " + v + "/" + t.target + " \u4EFD";
        }
      }
      function taskReward(statuses) {
        var done = statuses.filter(function (x) {
          return x === 'done';
        }).length;
        return done * TASK_REWARD + (done === statuses.length && done > 0 ? ALL_DONE_BONUS : 0);
      }
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/TaskUi.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc'], function (exports) {
  var _createClass, cclegacy, Color, Node, UITransform, Graphics, Label;
  return {
    setters: [function (module) {
      _createClass = module.createClass;
    }, function (module) {
      cclegacy = module.cclegacy;
      Color = module.Color;
      Node = module.Node;
      UITransform = module.UITransform;
      Graphics = module.Graphics;
      Label = module.Label;
    }],
    execute: function () {
      cclegacy._RF.push({}, "08ea478nMhG751FrfwqyBWH", "TaskUi", undefined);
      var TASK_CARD_W = exports('TASK_CARD_W', 300);
      var LINE_H = 28;
      var HEAD_H = 32;
      var PAD = 8;
      var BG = new Color(20, 22, 28, 200);
      var HEAD = new Color(255, 215, 120, 255);
      var COLOR = {
        open: new Color(255, 255, 255, 255),
        done: new Color(120, 220, 120, 255),
        failed: new Color(150, 150, 156, 255)
      };
      var MARK = {
        open: '○',
        done: '✔',
        failed: '✘'
      };
      function addLabel(parent, size, w, anchorX) {
        var n = new Node('Label');
        n.layer = parent.layer;
        parent.addChild(n);
        var t = n.addComponent(UITransform);
        t.setContentSize(w, size + 6);
        t.setAnchorPoint(anchorX, 0.5);
        var l = n.addComponent(Label);
        l.fontSize = size;
        l.lineHeight = size + 4;
        l.overflow = Label.Overflow.SHRINK;
        l.horizontalAlign = anchorX === 0 ? Label.HorizontalAlign.LEFT : Label.HorizontalAlign.RIGHT;
        return l;
      }

      /** HUD card pinned to the screen's top-right corner: title, then one line per task with its reward at the end */
      var TaskCard = exports('TaskCard', /*#__PURE__*/function () {
        function TaskCard(parent, count, reward, bonus) {
          this.node = void 0;
          this.height = void 0;
          this.lines = [];
          this.rewards = [];
          var W = TASK_CARD_W;
          var h = this.height = HEAD_H + count * LINE_H + PAD * 2;
          this.node = new Node('UI_Tasks');
          this.node.layer = parent.layer;
          parent.addChild(this.node);
          this.node.addComponent(UITransform).setContentSize(W, h);
          var g = this.node.addComponent(Graphics);
          g.fillColor = BG;
          g.roundRect(-W / 2, -h / 2, W, h, 10);
          g.fill();
          var left = -W / 2 + PAD + 4;
          var right = W / 2 - PAD - 4;
          var headY = h / 2 - PAD - HEAD_H / 2;
          var title = addLabel(this.node, 20, 120, 0);
          title.node.setPosition(left, headY, 0);
          title.string = '每日任务';
          title.color = HEAD;
          var all = addLabel(this.node, 16, W - 140, 1);
          all.node.setPosition(right, headY, 0);
          all.string = "\u5168\u90E8\u5B8C\u6210\u518D +\xA5" + bonus;
          all.color = HEAD;
          for (var i = 0; i < count; i++) {
            var y = headY - HEAD_H / 2 - LINE_H * (i + 0.5);
            var l = addLabel(this.node, 18, W - 90, 0);
            l.node.setPosition(left, y, 0);
            this.lines.push(l);
            var r = addLabel(this.node, 18, 60, 1);
            r.node.setPosition(right, y, 0);
            r.string = "+\xA5" + reward;
            this.rewards.push(r);
          }
        }
        var _proto = TaskCard.prototype;
        _proto.set = function set(i, text, status) {
          var l = this.lines[i];
          var r = this.rewards[i];
          if (!l || !r) return;
          l.string = MARK[status] + " " + text;
          l.color = COLOR[status];
          r.color = status === 'open' ? HEAD : COLOR[status];
        };
        return TaskCard;
      }());
      var HL_W = 300;
      var HL_H = 170;

      /** Result-screen card: the day's most outrageous moment, set beside the result panel */
      var HighlightCard = exports('HighlightCard', /*#__PURE__*/function () {
        function HighlightCard(parent) {
          this.node = void 0;
          this.title = void 0;
          this.quote = void 0;
          this.node = new Node('UI_Highlight');
          this.node.layer = parent.layer;
          parent.addChild(this.node);
          this.node.addComponent(UITransform).setContentSize(HL_W, HL_H);
          var g = this.node.addComponent(Graphics);
          g.fillColor = new Color(20, 22, 28, 235);
          g.roundRect(-HL_W / 2, -HL_H / 2, HL_W, HL_H, 14);
          g.fill();
          var head = addLabel(this.node, 22, HL_W - 24, 0);
          head.node.setPosition(-HL_W / 2 + 14, HL_H / 2 - 22, 0);
          head.string = '🎬 今日名场面';
          head.color = HEAD;
          this.title = addLabel(this.node, 20, HL_W - 28, 0);
          this.title.node.setPosition(-HL_W / 2 + 14, HL_H / 2 - 58, 0);
          this.quote = addLabel(this.node, 18, HL_W - 28, 0);
          this.quote.node.setPosition(-HL_W / 2 + 14, -18, 0);
          this.quote.node.getComponent(UITransform).setContentSize(HL_W - 28, 84);
          this.quote.overflow = Label.Overflow.SHRINK;
          this.quote.enableWrapText = true;
          this.quote.color = COLOR.open;
        }
        var _proto2 = HighlightCard.prototype;
        _proto2.show = function show(title, quote) {
          this.title.string = title;
          this.quote.string = quote;
        };
        _createClass(HighlightCard, [{
          key: "width",
          get: function get() {
            return HL_W;
          }
        }]);
        return HighlightCard;
      }());
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/types.ts", ['cc'], function (exports) {
  var cclegacy;
  return {
    setters: [function (module) {
      cclegacy = module.cclegacy;
    }],
    execute: function () {
      cclegacy._RF.push({}, "f3230WEVL9KX7/dJs5CqY1s", "types", undefined);
      /**
       * 全部游戏数据结构。零 Cocos 依赖（铁律①）。
       *
       * 词表是**封闭**的 —— 这是 docs/ai-customer-v1.md §1「机制层 / 表演层分离」的地基：
       * AI 能生成的需求 ≠ 引擎能判定的需求。机制层只认这里的枚举，表演层（lines.*）随便写。
       *
       * 混乱事件（chaos）的类型留到 M4 随 chaos.ts 一起定，现在写只能是猜。
       */
      // ─────────────────────────── 食材 ───────────────────────────
      /**
       * V1 食材词表。GDD 原稿只有 面包/牛肉/芝士 三种，这里扩到 8 种是刻意的：
       * 只有三种时 banned 毫无意义（禁掉任一样汉堡就不成立），
       * 而「我都说了不要洋葱」正是评价系统最有梗的一类反馈。
       */
      var INGREDIENTS = exports('INGREDIENTS', ['bun', 'patty', 'cheese', 'lettuce', 'tomato', 'onion', 'pickle', 'bacon']);
      /** 骨架食材：任何汉堡都必须有，生成顾客卡时恒在 required。 */
      var CORE_INGREDIENTS = exports('CORE_INGREDIENTS', ['bun', 'patty']);

      // ─────────────────────────── 火候 ───────────────────────────

      /**
       * 烤炉上的一条时间轴：raw → rare → medium → well → burnt。
       *
       * 顾客只会要求中间三档（见 DONENESS）；raw 和 burnt 都是失败状态，
       * burnt 同时是 M4「烤糊 → 起火 → 灭火器」那条混乱链的起点。
       */
      var COOK_LEVELS = exports('COOK_LEVELS', ['raw', 'rare', 'medium', 'well', 'burnt']);
      /** 顾客能点的火候。三档对应烤炉计时窗口，也是「牛肉火候完美 +20」这条评价的机制来源。 */
      var DONENESS = exports('DONENESS', ['rare', 'medium', 'well']);

      /** 烤炉三档的时间窗口（秒）。M1 的无头模拟器会扫这组参数，别把数值写死在别处。 */

      // ─────────────────────────── 订单 ───────────────────────────
      /** 机制层：引擎据此判定成败，取值受词表约束。 */
      // ─────────────────────────── 顾客卡 ───────────────────────────
      /**
       * 表演层：玩家阅读，纯展示，不参与判定。
       *
       * 字数上限不是排版洁癖 —— 玩家一边跑冰箱一边烤肉时没有一秒能读长台词。
       * 笑点必须压进 `order` 那一句，因为那句玩家**必须**读（不读做不出来）。
       */
      /**
       * 台词字数上限（字符数）。生成管线与夹具都按这个收，超了就是塞不进 UI。
       * 数值来自 docs/ai-customer-v1.md §3 —— 那里论证了为什么这不是排版洁癖。
       */
      var LINE_LIMITS = exports('LINE_LIMITS', {
        identity: 10,
        greet: 12,
        order: 30,
        wait_nudge: 15,
        // praise/complain are read after the customer leaves and again on the closing
        // screen, where the player is idle — the in-play limits do not apply to them.
        praise: 40,
        complain: 40
      });
      var MOODS = exports('MOODS', ['cheerful', 'grumpy', 'anxious', 'dreamy', 'menacing', 'heartbroken', 'manic', 'deadpan']);

      /** 长线剧情：一条 arc 是一组共享 series_id、按 chapter 排序的卡，由 unlock_day 控制出现时机。 */

      // ─────────────────────────── 成品 ───────────────────────────
      /** 玩家手上/盘子里的那个汉堡。 */
      // ─────────────────────────── 场地 ───────────────────────────

      var STATION_KINDS = exports('STATION_KINDS', ['fridge', 'grill', 'assembly', 'serve', 'sink', 'storeroom', 'register', 'delivery', 'rack', 'shelf', 'fryer', 'extinguisher', 'drinks']);

      /**
       * 工位。`box` 用于「角色别穿过灶台」，`triggerRange` 用于「够不够得着」——
       * 两者是不同的判定，边界语义也不同（见 collision.ts）。
       *
       * 命名对应编辑器里的 `Station_<名>` 节点（ROADMAP §6.2）。
       */

      // ─────────────────────────── 显示名 ───────────────────────────
      /**
       * 词表 → 中文。放在这里而不是组件里：同一个词在订单卡、结算面板、
       * 将来的顾客台词里都要出现，散在三处早晚会不一致。
       * 键是封闭词表，漏一个 TypeScript 当场报错。
       */
      var INGREDIENT_LABEL = exports('INGREDIENT_LABEL', {
        bun: '面包',
        patty: '肉饼',
        cheese: '芝士',
        lettuce: '生菜',
        tomato: '番茄',
        onion: '洋葱',
        pickle: '酸黄瓜',
        bacon: '培根'
      });
      var COOK_LABEL = exports('COOK_LABEL', {
        raw: '生的',
        rare: '三分',
        medium: '五分',
        well: '全熟',
        burnt: '糊了'
      });
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/vec2.ts", ['cc'], function (exports) {
  var cclegacy;
  return {
    setters: [function (module) {
      cclegacy = module.cclegacy;
    }],
    execute: function () {
      exports({
        add: add,
        copy: copy,
        dist: dist,
        dist2: dist2,
        lenSq: lenSq,
        normalize: normalize,
        rotateY: rotateY,
        scale: scale,
        set: set
      });
      cclegacy._RF.push({}, "c01b6U4d/9APqWAc+adF0L1", "vec2", undefined);
      /**
       * XZ 平面上的二维向量。
       *
       * 玩法空间是 2D（角色在 XZ 平面移动，Y 恒定），所以 logic/ 里的坐标一律 { x, z }，
       * 不出现 Cocos 的 Vec3 —— 铁律①（ROADMAP §3.2）。
       *
       * 全部函数走 out 参数写回，不返回新对象 —— 铁律②热路径零分配（ROADMAP §2.6）。
       * 每帧要遍历顾客耐心、烤炉火候、玩家与工位距离，这里 new 一个对象就是每帧几十次分配，
       * 会触发频繁 GC → 帧时间尖刺 → 手感一卡一卡，且 draw call 完全健康时也会发生。
       */
      function set(out, x, z) {
        out.x = x;
        out.z = z;
        return out;
      }
      function copy(out, src) {
        out.x = src.x;
        out.z = src.z;
        return out;
      }
      function add(out, a, b) {
        out.x = a.x + b.x;
        out.z = a.z + b.z;
        return out;
      }
      function scale(out, a, s) {
        out.x = a.x * s;
        out.z = a.z * s;
        return out;
      }
      function lenSq(a) {
        return a.x * a.x + a.z * a.z;
      }

      /** 平方距离。比大小时用这个，省一次 sqrt —— 触发范围判定每帧对每个工位都要算一次。 */
      function dist2(a, b) {
        var dx = a.x - b.x;
        var dz = a.z - b.z;
        return dx * dx + dz * dz;
      }
      function dist(a, b) {
        return Math.sqrt(dist2(a, b));
      }

      /** 零向量归一化后仍是零向量（摇杆回中每帧都会走到这里，除零会把坐标污染成 NaN）。 */
      function normalize(out, a) {
        var l2 = a.x * a.x + a.z * a.z;
        if (l2 === 0) {
          out.x = 0;
          out.z = 0;
          return out;
        }
        var inv = 1 / Math.sqrt(l2);
        out.x = a.x * inv;
        out.z = a.z * inv;
        return out;
      }

      /**
       * 绕 Y 轴旋转（从上往下看为顺时针）。
       *
       * 斜 45° 固定相机的头号手感坑（ROADMAP §M2）：摇杆的 (x, y) 不能直接当世界的 (x, z)，
       * 因为相机绕 Y 轴转了 45°，玩家往上推、角色却斜着走。正解是先把输入向量按相机 yaw
       * 旋转再喂给移动（camera-relative movement）。
       *
       * out 可以就是 a 本身：先把分量取进局部变量，再写回。
       */
      function rotateY(out, a, radians) {
        var c = Math.cos(radians);
        var s = Math.sin(radians);
        var x = a.x;
        var z = a.z;
        out.x = x * c + z * s;
        out.z = -x * s + z * c;
        return out;
      }
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/vent.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc'], function (exports) {
  var _createForOfIteratorHelperLoose, cclegacy;
  return {
    setters: [function (module) {
      _createForOfIteratorHelperLoose = module.createForOfIteratorHelperLoose;
    }, function (module) {
      cclegacy = module.cclegacy;
    }],
    execute: function () {
      exports({
        argueTap: argueTap,
        createVent: createVent,
        endArgue: endArgue,
        rantStars: rantStars,
        ranting: ranting,
        rantsLeft: rantsLeft,
        resetVent: resetVent,
        startRant: startRant,
        stepVent: stepVent,
        vent: vent,
        ventSpeedFactor: ventSpeedFactor
      });
      cclegacy._RF.push({}, "92e8fAbkwRPzq/ZhGWGO662", "vent", undefined);
      /**
       * Venting (GDD §12.5, reworked 2026-09-25 with the user): an unhappy customer does not just vanish —
       * they rant at the order desk for a while, then leave their review. The chef may start a shouting match
       * there (tap to trade insults; the customer storms off) or slam the fridge anywhere: a short speed boost,
       * paid for by a worse review and by witnesses.
       * Zero Cocos (铁律①). Witness penalties stay in witness.ts; the view reports `vents` increments there.
       */

      /** Long-press this long at a vent spot. Longer than the scrub hold so a sink press never vents */
      var VENT_HOLD_SEC = exports('VENT_HOLD_SEC', 0.6);
      var VENT_BOOST_SEC = exports('VENT_BOOST_SEC', 4);
      var VENT_SPEED = exports('VENT_SPEED', 1.3);
      /** ⏳ How long an upset customer rants at the desk before leaving */
      var RANT_SEC = exports('RANT_SEC', 5);
      /** Arguing back costs this many review stars (floored at 0) */
      var RETORT_PENALTY = exports('RETORT_PENALTY', 1);
      /** ⏳ Taps in a shouting match before the customer storms off */
      var ARGUE_TAPS = exports('ARGUE_TAPS', 6);
      /** ⏳ Stop tapping this long and the customer gets the last word and leaves */
      var ARGUE_IDLE_SEC = exports('ARGUE_IDLE_SEC', 1.5);
      function createVent() {
        return {
          boostLeft: 0,
          rants: [],
          vents: 0,
          retorts: 0,
          argue: null,
          taps: 0,
          idle: 0
        };
      }
      function resetVent(st) {
        st.boostLeft = 0;
        st.vents = 0;
        st.retorts = 0;
        st.argue = null;
        st.taps = 0;
        st.idle = 0;
        for (var _iterator = _createForOfIteratorHelperLoose(st.rants), _step; !(_step = _iterator()).done;) {
          var _r = _step.value;
          _r.id = -1;
        }
      }

      /** An upset customer heads for the desk to rant. `stars` = the review they would leave anyway */
      function startRant(st, id, stars) {
        var r = st.rants.find(function (x) {
          return x.id < 0;
        });
        if (!r) {
          r = {
            id: -1,
            left: 0,
            stars: 0,
            retorted: false
          };
          st.rants.push(r);
        }
        r.id = id;
        r.left = RANT_SEC;
        r.stars = stars;
        r.retorted = false;
      }
      function ranting(st, id) {
        return st.rants.some(function (r) {
          return r.id === id;
        });
      }
      function rantsLeft(st) {
        var n = 0;
        for (var _iterator2 = _createForOfIteratorHelperLoose(st.rants), _step2; !(_step2 = _iterator2()).done;) {
          var _r2 = _step2.value;
          if (_r2.id >= 0) n++;
        }
        return n;
      }

      /** Stars the rant ends with */
      function rantStars(r) {
        return r.retorted ? Math.max(0, r.stars - RETORT_PENALTY) : r.stars;
      }

      /** One frame. `onDone` fires as a rant ends, before its slot is freed — post the review there */
      function stepVent(st, dt, onDone) {
        st.boostLeft = Math.max(0, st.boostLeft - dt);
        if (st.argue) {
          st.idle += dt;
          if (st.idle >= ARGUE_IDLE_SEC) endArgue(st);
        }
        for (var _iterator3 = _createForOfIteratorHelperLoose(st.rants), _step3; !(_step3 = _iterator3()).done;) {
          var _r3 = _step3.value;
          if (_r3.id < 0 || _r3 === st.argue) continue;
          _r3.left -= dt;
          if (_r3.left > 0) continue;
          onDone == null || onDone(_r3);
          _r3.id = -1;
        }
      }

      /**
       * Vent at a spot. At the desk it opens a shouting match with the oldest rant nobody has answered —
       * the chef then taps (argueTap) and the customer storms off when it ends. Returns the rant argued with,
       * `true` for a fridge slam, `null` = nothing to vent at. The boost is paid when the match ends.
       */
      function vent(st, spot) {
        if (spot === 'register') {
          if (st.argue) return null;
          var target = null;
          for (var _iterator4 = _createForOfIteratorHelperLoose(st.rants), _step4; !(_step4 = _iterator4()).done;) {
            var _r4 = _step4.value;
            if (_r4.id >= 0 && !_r4.retorted && (!target || _r4.left < target.left)) target = _r4;
          }
          if (!target) return null;
          target.retorted = true;
          st.retorts++;
          st.argue = target;
          st.taps = 0;
          st.idle = 0;
          return target;
        }
        boost(st);
        return true;
      }

      /** One tap in the match. Returns the tap's index (picks the line), or -1 when no match is on */
      function argueTap(st) {
        if (!st.argue) return -1;
        var i = st.taps++;
        st.idle = 0;
        if (st.taps >= ARGUE_TAPS) endArgue(st);
        return i;
      }

      /** Walked off, or out of taps / went quiet: the customer leaves on the next step */
      function endArgue(st) {
        if (!st.argue) return;
        st.argue.left = 0;
        st.argue = null;
        boost(st);
      }
      function boost(st) {
        st.vents++;
        st.boostLeft = VENT_BOOST_SEC;
      }
      function ventSpeedFactor(st) {
        return st.boostLeft > 0 ? VENT_SPEED : 1;
      }
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/WallCutaway.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc', './camera.ts'], function (exports) {
  var _createForOfIteratorHelperLoose, cclegacy, hidesPoint;
  return {
    setters: [function (module) {
      _createForOfIteratorHelperLoose = module.createForOfIteratorHelperLoose;
    }, function (module) {
      cclegacy = module.cclegacy;
    }, function (module) {
      hidesPoint = module.hidesPoint;
    }],
    execute: function () {
      cclegacy._RF.push({}, "1e941kV71JNc6lRF4A7ss7S", "WallCutaway", undefined);
      /** Share of a wall's height left standing while cut away. ⏳ self-chosen */
      var LOW = 0.12;
      /** Full height ↔ stub in 1/SPEED seconds */
      var SPEED = 6;
      /** Chef sample heights: feet and chest, so a waist-high wall still counts */
      var SAMPLE_Y = [0.3, 1.2];
      /**
       * Walls between the chef and the camera drop to a stub and rise again once clear.
       * Lowered rather than faded: fading needs a transparent pass per wall material and sorts badly.
       * Assumes the scene's wall convention — a centred 1m cube scaled to size under an unscaled parent.
       */
      var WallCutaway = exports('WallCutaway', /*#__PURE__*/function () {
        function WallCutaway(roots) {
          this.walls = [];
          for (var _iterator = _createForOfIteratorHelperLoose(roots), _step; !(_step = _iterator()).done;) {
            var r = _step.value;
            for (var _iterator2 = _createForOfIteratorHelperLoose(r.children), _step2; !(_step2 = _iterator2()).done;) {
              var n = _step2.value;
              if (!n.name.startsWith('Wall_')) continue;
              var p = n.worldPosition;
              var s = n.worldScale;
              var hx = Math.abs(s.x) / 2;
              var hy = Math.abs(s.y) / 2;
              var hz = Math.abs(s.z) / 2;
              this.walls.push({
                node: n,
                box: {
                  minX: p.x - hx,
                  minY: p.y - hy,
                  minZ: p.z - hz,
                  maxX: p.x + hx,
                  maxY: p.y + hy,
                  maxZ: p.z + hz
                },
                sy: n.scale.y,
                baseY: n.position.y - n.scale.y / 2,
                k: 1
              });
            }
          }
        }
        var _proto = WallCutaway.prototype;
        _proto.update = function update(x, z, dt) {
          var _loop = function _loop() {
            var w = _step3.value;
            var hidden = SAMPLE_Y.some(function (y) {
              return hidesPoint(w.box, x, y, z);
            });
            var target = hidden ? LOW : 1;
            if (w.k === target) return 1; // continue
            var step = dt * SPEED;
            w.k = w.k < target ? Math.min(target, w.k + step) : Math.max(target, w.k - step);
            var sy = w.sy * w.k;
            var s = w.node.scale;
            var p = w.node.position;
            w.node.setScale(s.x, sy, s.z);
            w.node.setPosition(p.x, w.baseY + sy / 2, p.z);
          };
          for (var _iterator3 = _createForOfIteratorHelperLoose(this.walls), _step3; !(_step3 = _iterator3()).done;) {
            if (_loop()) continue;
          }
        };
        return WallCutaway;
      }());
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/witness.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc', './customer.ts'], function (exports) {
  var _createForOfIteratorHelperLoose, cclegacy, orderPatienceLeft, patienceRatio;
  return {
    setters: [function (module) {
      _createForOfIteratorHelperLoose = module.createForOfIteratorHelperLoose;
    }, function (module) {
      cclegacy = module.cclegacy;
    }, function (module) {
      orderPatienceLeft = module.orderPatienceLeft;
      patienceRatio = module.patienceRatio;
    }],
    execute: function () {
      exports({
        canWitness: canWitness,
        witnessMishap: witnessMishap
      });
      cclegacy._RF.push({}, "fbab1WpYT1Iyalmwo7PUWlZ", "witness", undefined);
      /** 一次事故 = 当前那段耐心掉 1/4，正好是 moodTier 的一档 */
      var WITNESS_PENALTY = exports('WITNESS_PENALTY', 0.25);

      /** 进门到柜台之前那段在店外，看不见厨房 */
      function canWitness(st, c) {
        if (!c.active || c.late) return false;
        if (c.ordered) return true;
        var take = st.flow.takeOrder;
        return !take || orderPatienceLeft(st, c) < take.patienceSec;
      }

      /**
       * 记一次事故：每位看得见的顾客扣耐心，返回开口吐槽的那位（没人看见返回 null）。
       * 开口的是扣之前最满意的那位 —— 他掉得最明显，吐槽也最有落差。并列取排在前面的。
       * 扣到 0 不在这里结算，下一帧 stepCustomerFlow 照常按超时处理。
       */
      function witnessMishap(st, _kind) {
        var speaker = null;
        var best = -1;
        var take = st.flow.takeOrder;
        for (var _iterator = _createForOfIteratorHelperLoose(st.customers), _step; !(_step = _iterator()).done;) {
          var c = _step.value;
          if (!canWitness(st, c)) continue;
          var k = patienceRatio(st, c);
          if (k > best) {
            best = k;
            speaker = c;
          }
          if (c.ordered) c.patienceLeft = Math.max(0, c.patienceLeft - WITNESS_PENALTY * c.patienceMax);else if (take) c.orderWait += WITNESS_PENALTY * take.patienceSec;
        }
        return speaker;
      }
      cclegacy._RF.pop();
    }
  };
});

(function(r) {
  r('virtual:///prerequisite-imports/main', 'chunks:///_virtual/main'); 
})(function(mid, cid) {
    System.register(mid, [cid], function (_export, _context) {
    return {
        setters: [function(_m) {
            var _exportObj = {};

            for (var _key in _m) {
              if (_key !== "default" && _key !== "__esModule") _exportObj[_key] = _m[_key];
            }
      
            _export(_exportObj);
        }],
        execute: function () { }
    };
    });
});