import { describe, it, expect } from 'vitest'
// schema 声明的是 draft 2020-12，ajv 的默认入口只带 draft-07，必须走这个子入口
import Ajv from 'ajv/dist/2020'
import schema from '../../../../pipeline/customer.schema.json'
import cards from './fixtures/customers.json'

/**
 * pipeline/customer.schema.json 与手写夹具的互验。
 *
 * 这两个产物会各自漂移：schema 是给 C2 的生成请求用的，夹具是给 M1–M4 的厨房用的。
 * 漂了之后症状很晚才出现 —— 生成 10000 张卡进包，跑起来才发现引擎读不了。
 */
const ajv = new Ajv({ allErrors: true, strict: false })
const validate = ajv.compile(schema)

/** 深拷贝。这些都是纯 JSON 数据，用 JSON 走一圈即可 —— 不为测试给 logic/ 引入 @types/node。 */
const clone = <T>(o: T): T => JSON.parse(JSON.stringify(o)) as T

const valid = {
  id: 'c_9999',
  order: { required: ['bun', 'patty'], banned: ['onion'], doneness: 'medium', patience: 45 },
  identity: '测试顾客',
  mood: 'deadpan',
  lines: {
    greet: '你好。',
    order: '不要洋葱，五分熟。',
    wait_nudge: '还要多久？',
    praise: '不错。',
    complain: '我说了不要洋葱。',
  },
  arc: null,
}

describe('customer.schema.json', () => {
  it('21 张手写夹具全部通过 schema', () => {
    for (const card of cards) {
      const ok = validate(card)
      expect({ id: card.id, ok, errors: validate.errors }).toEqual({
        id: card.id,
        ok: true,
        errors: null,
      })
    }
  })

  // ↓ 活性守卫：schema 若没真正加载（拿到空对象），上面那条会恒真报全绿。
  //   下面每一条都必须被拒，才能证明它真的在拦东西。

  it('自身样例通过 —— 先验正向锚点', () => {
    expect(validate(clone(valid))).toBe(true)
  })

  it('拦住词表外的食材', () => {
    const bad = clone(valid)
    bad.order.required.push('sunlight_tomato')
    expect(validate(bad)).toBe(false)
  })

  it('拦住 banned 里的骨架食材', () => {
    const bad = clone(valid)
    bad.order.banned = ['bun']
    expect(validate(bad)).toBe(false)
  })

  it('拦住超长台词', () => {
    const bad = clone(valid)
    bad.lines.order = '啊'.repeat(31)
    expect(validate(bad)).toBe(false)
  })

  it('拦住词表外的 mood', () => {
    const bad = clone(valid)
    bad.mood = 'excited'
    expect(validate(bad)).toBe(false)
  })

  it('拦住多余字段 —— 生成时多吐一个键，引擎会读到没约定的东西', () => {
    const bad = clone(valid) as Record<string, unknown>
    bad.extra = '多出来的'
    expect(validate(bad)).toBe(false)
  })

  it('拦住缺字段', () => {
    const bad = clone(valid) as Record<string, unknown>
    delete bad.arc
    expect(validate(bad)).toBe(false)
  })

  it('拦不住 required 与 banned 相交 —— 这条只能靠 validateOrderSpec', () => {
    // 记录一个已知的 schema 能力边界：JSON Schema 表达不了跨字段约束。
    // 生成管线必须在 schema 之外再过一遍 logic/order.ts 的 validateOrderSpec，
    // 否则「required 与 banned 同时含洋葱」这种永远做不出来的单会进包体。
    const conflicting = clone(valid)
    conflicting.order.required = ['bun', 'patty', 'onion']
    conflicting.order.banned = ['onion']
    expect(validate(conflicting)).toBe(true)
  })
})
