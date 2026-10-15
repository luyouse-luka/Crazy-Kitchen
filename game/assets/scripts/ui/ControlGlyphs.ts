import { Graphics } from 'cc'
import type { ActionIcon, Gesture } from './UiModel'
import { UI_THEME, uiColor } from './UiTheme'

export function drawControlGlyph(g: Graphics, icon: ActionIcon, enabled = true): void {
  g.clear(); g.lineWidth = 4; g.strokeColor = uiColor(enabled ? UI_THEME.accent : UI_THEME.muted); g.fillColor = g.strokeColor
  const line = (...p: number[]): void => { g.moveTo(p[0]!, p[1]!); for (let i = 2; i < p.length; i += 2) g.lineTo(p[i]!, p[i + 1]!); g.stroke() }
  const rect = (x: number, y: number, w: number, h: number): void => { g.roundRect(x, y, w, h, 4); g.stroke() }
  const circle = (x: number, y: number, r: number): void => { g.circle(x, y, r); g.stroke() }
  const arrow = (x: number, y: number, up: boolean): void => { const d = up ? 1 : -1; line(x, y - 12 * d, x, y + 12 * d); line(x - 7, y + 5 * d, x, y + 12 * d, x + 7, y + 5 * d) }
  switch (icon) {
    case 'fridge': rect(-21, -30, 42, 60); line(-21, 6, 21, 6); line(-11, 17, -11, 11); line(-11, -6, -11, -18); break
    case 'pan-in': case 'pan-out':
      g.ellipse(-5, -14, 25, 10); g.stroke(); line(18, -12, 36, -3); arrow(-5, 14, icon === 'pan-out'); break
    case 'burger': case 'assemble': case 'serve':
      g.arc(0, 2, 24, 0, Math.PI, false); g.stroke(); line(-25, 0, 25, 0); line(-23, -8, 23, -8); line(-21, -16, 21, -16); line(-28, -24, 28, -24)
      if (icon === 'assemble') { line(19, 27, 35, 27); line(27, 19, 27, 35) }
      if (icon === 'serve') { line(-25, -31, 11, -31, 23, -26) }
      break
    case 'order':
      rect(-22, -28, 44, 56); rect(-10, 22, 20, 10); line(-11, 10, 11, 10); line(-11, 0, 11, 0); line(-11, -10, 4, -10); break
    case 'box':
      rect(-25, -23, 50, 46); line(-25, 8, 25, 8); line(0, 8, 0, -23); line(-25, 23, 0, 8, 25, 23); break
    case 'wash':
      line(-29, -8, -22, -25, 22, -25, 29, -8, -29, -8); line(-6, -6, -6, 16, 8, 22, 21, 15, 21, 8); circle(-20, 12, 5); circle(-14, 26, 3); break
    case 'plate': g.ellipse(0, -15, 28, 10); g.stroke(); g.ellipse(0, -5, 28, 10); g.stroke(); g.ellipse(0, 5, 28, 10); g.stroke(); break
    case 'fire':
      rect(-13, -28, 26, 43); line(-3, 15, -3, 28, 15, 28); line(12, 19, 26, 17, 30, -3); line(-7, 24, -17, 24); break
    case 'drink':
      line(-18, 11, -13, -27, 13, -27, 18, 11, -18, 11); line(2, 11, 9, 31, 24, 31); line(-21, 13, 21, 13); break
    case 'fryer':
      rect(-24, -26, 48, 34); line(24, -4, 34, 13); for (const x of [-14, -3, 8]) line(x, 9, x - 3, 27); line(-17, -6, 17, -6); line(-17, -16, 17, -16); break
    case 'door': rect(-23, -29, 46, 58); line(-10, -29, -10, 22, 17, 29); circle(4, -3, 2); break
    case 'gear':
      circle(0, 0, 19); circle(0, 0, 7); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; line(Math.cos(a) * 20, Math.sin(a) * 20, Math.cos(a) * 29, Math.sin(a) * 29) }; break
    case 'talk': rect(-28, -11, 56, 35); line(-17, -12, -19, -26, -3, -12); circle(-13, 6, 2); circle(0, 6, 2); circle(13, 6, 2); break
    case 'wait': circle(0, 0, 27); line(0, 19, 0, 0, 13, -9); break
    case 'blocked': circle(0, 0, 27); line(-18, -18, 18, 18); break
    case 'pick': case 'place':
      line(-28, -17, -17, -27, 13, -27, 28, -13); arrow(0, 9, icon === 'pick'); break
    case 'throw':
      line(-27, -22, -10, -26, -3, -17); g.moveTo(-9, -7); g.quadraticCurveTo(6, 33, 31, 22); g.stroke(); line(20, 25, 31, 22, 26, 12); circle(-18, 0, 6); break
    case 'trash': rect(-18, -26, 36, 43); line(-25, 21, 25, 21); line(-10, 28, 10, 28); line(-7, 8, -7, -15); line(7, 8, 7, -15); break
    default:
      line(0, -26, 0, 26); line(-26, 0, 26, 0)
      line(-7, 19, 0, 26, 7, 19); line(-7, -19, 0, -26, 7, -19)
      line(-19, -7, -26, 0, -19, 7); line(19, -7, 26, 0, 19, 7)
  }
}

export function drawGestureGlyph(g: Graphics, gesture: Gesture): void {
  g.clear(); g.lineWidth = 2.5; g.strokeColor = uiColor(UI_THEME.accent)
  g.circle(0, 0, gesture === 'hold' ? 9 : 5); g.stroke()
  if (gesture === 'hold') { g.arc(0, 0, 13, -.5, 4, false); g.stroke(); g.moveTo(0, 5); g.lineTo(0, 0); g.lineTo(4, -2); g.stroke() }
  else if (gesture === 'tap') { for (const x of [-11, 11]) { g.moveTo(x, 6); g.lineTo(x * .7, 4); g.stroke() } }
}
