import type { StationKind } from './types'
import type { Vec2 } from './vec2'

export const LAYOUT_IDS = [
  'fridge', 'grill', 'assembly', 'shelf', 'sink', 'rack', 'fryer', 'drinks',
  'extinguisher', 'register', 'serve', 'delivery',
] as const

export type LayoutId = (typeof LAYOUT_IDS)[number]
export type QuarterTurn = 0 | 1 | 2 | 3
export interface LayoutPose { x: number; z: number; quarterTurn: QuarterTurn }
export interface LayoutConfig { version: 1; stations: Record<LayoutId, LayoutPose> }

export interface LayoutArt {
  readonly node: string
  readonly offset: readonly [number, number, number]
  readonly yaw?: number
}

export interface LayoutFixture {
  readonly node: string
  readonly kind: StationKind
  readonly label: string
  readonly pose: Readonly<LayoutPose>
  readonly width: number
  readonly depth: number
  readonly front: Readonly<Vec2> | null
  readonly mode: 'free' | 'move' | 'slide'
  readonly purchase?: 'fryer' | 'drinks'
  readonly runtime?: boolean
  readonly triggerOffset?: Readonly<Vec2>
  readonly triggerSize?: readonly [number, number]
  readonly art: readonly LayoutArt[]
}

export const LAYOUT_FIXTURES: Readonly<Record<LayoutId, LayoutFixture>> = {
  fridge: {
    node: 'Station_Fridge', kind: 'fridge', label: '冰箱', pose: { x: -3.5, z: 0, quarterTurn: 0 },
    width: 1, depth: 1, front: { x: 1, z: 0 }, mode: 'free',
    art: [{ node: 'Prop_Fridge', offset: [0, 0, 0], yaw: 90 }],
  },
  grill: {
    node: 'Station_Grill', kind: 'grill', label: '烤炉', pose: { x: .5, z: -2.5, quarterTurn: 0 },
    width: 2, depth: 1, front: { x: 0, z: 1 }, mode: 'free',
    art: [{ node: 'Prop_Grill', offset: [0, 0, 0] }],
  },
  assembly: {
    node: 'Station_Assembly', kind: 'assembly', label: '制作台', pose: { x: -3.5, z: -1.5, quarterTurn: 0 },
    width: 1, depth: 2, front: { x: 1, z: 0 }, mode: 'free',
    art: [
      { node: 'Prop_Assembly', offset: [0, 0, -.5], yaw: 90 },
      { node: 'Prop_AssemblyEast', offset: [0, 0, .5], yaw: 90 },
      { node: 'Prop_AssemblyPlate', offset: [0, 1, 0] },
    ],
  },
  shelf: {
    node: 'Block_Plate', kind: 'shelf', label: '取盘架', pose: { x: -3.5, z: 1, quarterTurn: 0 },
    width: 1, depth: 1, front: { x: 1, z: 0 }, mode: 'free',
    art: [{ node: 'Prop_Plate', offset: [0, 0, 0], yaw: 90 }],
  },
  sink: {
    node: 'Station_Sink', kind: 'sink', label: '洗碗台', pose: { x: 7.5, z: .5, quarterTurn: 0 },
    width: 1, depth: 2, front: { x: -1, z: 0 }, mode: 'free',
    art: [{ node: 'Prop_Sink_0', offset: [0, 0, -.5], yaw: 90 }, { node: 'Prop_Sink_1', offset: [0, 0, .5], yaw: 90 }],
  },
  rack: {
    node: 'Block_DishRack', kind: 'rack', label: '晾盘架', pose: { x: 7.5, z: 2, quarterTurn: 0 },
    width: 1, depth: 1, front: { x: -1, z: 0 }, mode: 'free',
    art: [{ node: 'Prop_WashRack', offset: [0, 0, 0], yaw: 90 }],
  },
  fryer: {
    node: 'Block_Fryer', kind: 'fryer', label: '炸锅', pose: { x: 2, z: -2.5, quarterTurn: 0 },
    width: 1, depth: 1, front: { x: 0, z: 1 }, mode: 'free', purchase: 'fryer',
    art: [{ node: 'Prop_Fryer', offset: [0, 0, 0] }],
  },
  drinks: {
    node: 'Station_Drinks', kind: 'drinks', label: '饮料机', pose: { x: 3.5, z: -2.5, quarterTurn: 0 },
    width: 1, depth: 1, front: { x: 0, z: 1 }, mode: 'free', purchase: 'drinks', runtime: true,
    triggerOffset: { x: 0, z: -.2 }, triggerSize: [.8, .6],
    art: [{ node: 'Prop_DrinkBase', offset: [0, 0, 0] }],
  },
  extinguisher: {
    node: 'Station_Extinguisher', kind: 'extinguisher', label: '灭火器', pose: { x: 4.5, z: 3.25, quarterTurn: 0 },
    width: .5, depth: .5, front: null, mode: 'move', runtime: true, art: [],
  },
  register: {
    node: 'Station_Order', kind: 'register', label: '接单', pose: { x: -3.5, z: 3.1, quarterTurn: 0 },
    width: 1, depth: 1, front: { x: 0, z: -1 }, mode: 'slide', art: [],
  },
  serve: {
    node: 'Station_Serve', kind: 'serve', label: '出餐', pose: { x: -1, z: 3.1, quarterTurn: 0 },
    width: 2, depth: 1, front: { x: 0, z: -1 }, mode: 'slide',
    art: [{ node: 'Prop_Pack', offset: [-1.5, 0, 0], yaw: 0 }],
  },
  delivery: {
    node: 'Station_Delivery', kind: 'delivery', label: '外卖交付', pose: { x: 3, z: 3.1, quarterTurn: 0 },
    width: 1, depth: 1, front: { x: 0, z: -1 }, mode: 'slide', art: [],
  },
}

export interface FixedLayoutObstacle {
  readonly node: string
  readonly x: number
  readonly z: number
  readonly width: number
  readonly depth: number
}

export const LAYOUT_FIXED = {
  spawn: { x: 0, z: 1.55 },
  placementBounds: { xmin: -4, xmax: 8, zmin: -3, zmax: 3.6 },
  navigationBounds: { xmin: -4, xmax: 8, zmin: -6, zmax: 3.6 },
  obstacles: [
    { node: 'FrontCounter', x: -.25, z: 3.1, width: 7.5, depth: 1 },
    { node: 'Wall_N', x: .5, z: -3.1, width: 9.2, depth: .2 },
    { node: 'Wall_E', x: 8.1, z: -1.2, width: .2, depth: 9.6 },
    { node: 'Wall_StoreBack', x: 6.5, z: -6.1, width: 3.2, depth: .2 },
    { node: 'Wall_Store_W1', x: 4.9, z: -4.5, width: .2, depth: 3 },
    { node: 'Wall_Store_W2', x: 5.25, z: -3.1, width: .5, depth: .2 },
    { node: 'Wall_Store_S', x: 7.5, z: -3.1, width: 1, depth: .2 },
    { node: 'Wall_Kitchen_W', x: -4.1, z: -1.25, width: .2, depth: 3.5 },
    { node: 'Block_VoidNorth', x: .5, z: -4.5, width: 9, depth: 3 },
    { node: 'Block_BackCounter', x: -1.25, z: -2.5, width: 1.5, depth: 1 },
    { node: 'Block_BackCounterE', x: 2.75, z: -2.5, width: .5, depth: 1 },
    { node: 'Block_StoreShelves', x: 7.5, z: -4.5, width: 1, depth: 3 },
    { node: 'Station_Storeroom', x: 6.5, z: -5.5, width: 1, depth: 1 },
  ] satisfies readonly FixedLayoutObstacle[],
} as const

export const RUNTIME_SPOTS = {
  drinks: [LAYOUT_FIXTURES.drinks.pose.x, LAYOUT_FIXTURES.drinks.pose.z + LAYOUT_FIXTURES.drinks.triggerOffset!.z],
  extinguisher: [LAYOUT_FIXTURES.extinguisher.pose.x, LAYOUT_FIXTURES.extinguisher.pose.z],
  decor: [7.1, -1.8],
} as const

export const DRINKS_BASE_Y = 1
