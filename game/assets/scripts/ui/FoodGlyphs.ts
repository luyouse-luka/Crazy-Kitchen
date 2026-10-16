import { Graphics } from 'cc'
import type { Ingredient } from '../../logic/types'
import { uiColor } from './UiTheme'

export function drawFoodGlyph(g: Graphics, ingredient: Ingredient | 'plate', empty = false): void {
  g.clear()
  const ellipse = (x: number, y: number, rx: number, ry: number, color: string): void => {
    g.fillColor = uiColor(empty ? '#B8AF9F' : color); g.ellipse(x, y, rx, ry); g.fill()
  }
  const line = (x: number, y: number, xx: number, yy: number, color: string, width = 2): void => {
    g.strokeColor = uiColor(empty ? '#E5DDD0' : color); g.lineWidth = width; g.moveTo(x, y); g.lineTo(xx, yy); g.stroke()
  }
  const polygon = (points: number[][], color: string): void => {
    g.fillColor = uiColor(empty ? '#B8AF9F' : color); g.moveTo(points[0]![0]!, points[0]![1]!)
    for (const p of points.slice(1)) g.lineTo(p[0]!, p[1]!)
    g.close(); g.fill()
  }
  ellipse(0, -22, 30, 7, '#D4C3A6')
  switch (ingredient) {
    case 'bun':
      ellipse(0, -9, 31, 14, '#A65E2C'); ellipse(0, -4, 31, 15, '#E7A34C')
      ellipse(0, 6, 30, 22, '#C88135'); ellipse(-1, 10, 28, 20, '#F1BD69'); ellipse(-8, 17, 16, 8, '#F8D69A')
      for (const [x, y] of [[-18, 10], [-10, 23], [2, 17], [17, 9], [12, 23], [-1, 3]]) line(x!, y!, x! + 3, y! + 2, '#FFF3C8', 2.5)
      break
    case 'patty':
      ellipse(0, -5, 31, 21, '#803A32'); ellipse(0, 1, 31, 21, '#BF6860'); ellipse(-2, 5, 27, 16, '#DA9183')
      for (const [x, y, xx, yy] of [[-21, 5, -9, 10], [0, -7, 12, -4], [10, 8, 22, 13], [-13, -8, -7, -2], [-5, 17, 1, 11]]) line(x!, y!, xx!, yy!, '#F1BEA4', 3)
      ellipse(-19, -2, 2, 1.5, '#A04C44'); ellipse(16, 2, 2.5, 1.5, '#A04C44')
      break
    case 'cheese':
      polygon([[-30, -10], [-6, -25], [31, -7], [31, -1], [-6, -19], [-30, -4]], '#D68C26')
      polygon([[-30, -4], [-6, -19], [31, -1], [8, 18]], '#F4BA45')
      polygon([[-30, 5], [-4, -11], [29, 7], [5, 26]], '#FFD773')
      line(-25, 7, 4, 22, '#FFF0AC', 2); ellipse(7, 5, 4, 3, '#E9AA35'); ellipse(-10, 5, 2.5, 2, '#E9AA35')
      break
    case 'lettuce':
      for (let i = 0; i < 9; i++) {
        const a = i * Math.PI * 2 / 9
        ellipse(Math.cos(a) * 17, Math.sin(a) * 14, 15, 12, i % 2 ? '#568C42' : '#77AB50')
      }
      ellipse(0, 3, 21, 17, '#91BD62'); line(-15, -17, 12, 18, '#D0DD92', 3)
      for (let i = 0; i < 3; i++) { line(-8 + i * 6, -7 + i * 8, -18 + i * 5, -1 + i * 8, '#BDD686'); line(-8 + i * 6, -7 + i * 8, 5 + i * 7, -8 + i * 7, '#BDD686') }
      break
    case 'tomato':
      ellipse(0, -3, 30, 24, '#A13D30'); ellipse(0, 2, 30, 24, '#D85B42'); ellipse(0, 4, 25, 19, '#F18A62')
      for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5; ellipse(Math.cos(a) * 14, 4 + Math.sin(a) * 10, 6, 5, '#D24B38'); ellipse(Math.cos(a) * 16, 4 + Math.sin(a) * 12, 2, 1.5, '#F8D68B') }
      ellipse(0, 4, 5, 4, '#FFBE8A'); line(-17, 17, -8, 21, '#FFC3A0', 3)
      break
    case 'onion':
      for (const [x, y, rx, ry] of [[-6, -3, 25, 20], [8, 8, 23, 18]]) {
        ellipse(x!, y!, rx!, ry!, '#85477B'); ellipse(x!, y! + 3, rx! - 3, ry! - 3, '#E5B9D5')
        ellipse(x!, y! + 3, rx! - 7, ry! - 7, '#A66694'); ellipse(x!, y! + 3, rx! - 10, ry! - 10, '#FFF0DF')
        ellipse(x!, y! + 3, rx! - 14, ry! - 13, '#EACBD7')
      }
      break
    case 'pickle':
      for (const [x, y] of [[-13, -5], [13, 0], [0, 16]]) {
        ellipse(x!, y! - 2, 17, 12, '#4B6B36'); ellipse(x!, y! + 1, 16, 11, '#A5B65F'); ellipse(x!, y! + 2, 12, 8, '#BCC87B')
        for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; ellipse(x! + Math.cos(a) * 6, y! + 2 + Math.sin(a) * 4, 2, 1.5, '#EDF0BB') }
      }
      break
    case 'bacon':
      for (const y of [-10, 8]) {
        const p = [[-28, y], [-19, y + 5], [-7, y + 1], [7, y + 6], [20, y + 2], [29, y + 6], [27, y + 18], [17, y + 15], [5, y + 18], [-8, y + 13], [-20, y + 17], [-29, y + 12]]
        polygon(p.map(([x, yy]) => [x!, yy! - 3]), '#8D4937'); polygon(p, '#C96C50')
        for (const k of [4, 9]) { line(-25, y + k, -9, y + k + 1, '#F2C19B', 3); line(-9, y + k + 1, 7, y + k + 5, '#F2C19B', 3); line(7, y + k + 5, 25, y + k + 4, '#F2C19B', 3) }
      }
      break
    case 'plate':
      ellipse(0, -4, 32, 22, '#A8B6AE'); ellipse(0, 0, 32, 22, '#FAF8EE'); ellipse(0, 1, 25, 16, '#D9E4DC'); ellipse(0, 2, 21, 13, '#FFFDF5')
      break
  }
}

export function drawDishGlyph(g: Graphics, stage: 'dirty' | 'soaking' | 'scrub'): void {
  g.clear(); g.lineWidth = 2; g.strokeColor = uiColor('#FFF4D9')
  g.ellipse(-2, -1, 14, 10); g.stroke(); g.ellipse(-2, -1, 10, 6); g.stroke()
  g.fillColor = uiColor(stage === 'dirty' ? '#D99E55' : '#92CFD0')
  if (stage === 'dirty') {
    for (const [x, y, r] of [[-5, 1, 3], [3, -4, 2], [1, 4, 2]]) { g.circle(x!, y!, r!); g.fill() }
  } else if (stage === 'soaking') {
    g.moveTo(10, 17); g.bezierCurveTo(0, 6, 3, 2, 10, 2); g.bezierCurveTo(17, 2, 20, 6, 10, 17); g.fill()
  } else {
    g.roundRect(0, 3, 16, 9, 3); g.fill(); g.strokeColor = uiColor('#D1EDF0')
    for (const [x, y, r] of [[-9, 13, 3], [0, 18, 2], [17, -4, 2]]) { g.circle(x!, y!, r!); g.stroke() }
  }
}
