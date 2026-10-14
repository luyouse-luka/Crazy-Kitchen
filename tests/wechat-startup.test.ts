import { describe, expect, it, vi } from 'vitest'
// @ts-expect-error Node builtins are confined to test tooling.
import { readFileSync } from 'node:fs'
// @ts-expect-error Node builtins are confined to test tooling.
import { runInNewContext } from 'node:vm'

const install = () => {
  const context = { module: { exports: {} as any } }
  runInNewContext(readFileSync('game/build-templates/wechatgame/wechat-system-info.js', 'utf8'), context)
  return context.module.exports.install
}

describe('WeChat startup compatibility', () => {
  it('supplies real device, app and window data without calling the old bridge API', () => {
    const legacy = vi.fn(() => { throw Error('jsbridge not ready') })
    const api = {
      getDeviceInfo: () => ({ platform: 'android', system: 'Android 14', model: 'test device' }),
      getAppBaseInfo: () => ({ language: 'zh_CN', version: '8.0', SDKVersion: '3.17.2' }),
      getWindowInfo: () => ({ screenWidth: 1280, screenHeight: 720, windowWidth: 1280, pixelRatio: 2 }),
      getSystemInfoSync: legacy,
    }
    expect(install()(api)).toBe(true)
    expect(api.getSystemInfoSync()).toMatchObject({ platform: 'android', language: 'zh_CN', screenWidth: 1280, pixelRatio: 2 })
    expect(legacy).not.toHaveBeenCalled()
  })

  it('refreshes window dimensions after a resize', () => {
    let width = 1280
    const api = { getDeviceInfo: () => ({}), getAppBaseInfo: () => ({}), getWindowInfo: () => ({ windowWidth: width }), getSystemInfoSync: () => ({ windowWidth: 0 }) }
    install()(api)
    expect(api.getSystemInfoSync().windowWidth).toBe(1280)
    width = 960
    expect(api.getSystemInfoSync().windowWidth).toBe(960)
  })

  it('retains the original API on older libraries', () => {
    const original = vi.fn(() => ({ platform: 'ios' }))
    const api = { getSystemInfoSync: original }
    expect(install()(api)).toBe(false)
    expect(api.getSystemInfoSync).toBe(original)
  })

  it('does not hide an initialization failure or invent device data', () => {
    const original = vi.fn()
    const api = { getDeviceInfo: () => { throw Error('device info unavailable') }, getWindowInfo: () => ({}), getAppBaseInfo: () => ({}), getSystemInfoSync: original }
    expect(() => install()(api)).toThrow('device info unavailable')
    expect(api.getSystemInfoSync).toBe(original)
  })
})
