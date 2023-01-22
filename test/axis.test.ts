import { describe, expect, it } from 'vitest'
import Axis, { AxisRange, PlotAxis } from '../src/axis'

describe('Axis Rounding', () => {

    function makeAxis(range: 'auto' | AxisRange, computedRange?: AxisRange): PlotAxis {
        return {
            type: 'number',
            range,
            computedRange,
            style: {}
        }
    }

    it('should not round manual ranges', () => {
        const axis = makeAxis({min: 0, max: 1})
        expect(Axis.roundRange(axis)).toBe(false)
        expect(axis.computedRange).toBeUndefined()
    })

    it('should round to integers for small ranges', () => {
        const axis = makeAxis('auto', {min: -0.1, max: 0.9})
        expect(Axis.roundRange(axis)).toBe(true)
        expect(axis.computedRange.min).toBe(-0.2)
        expect(axis.computedRange.max).toBe(1)
    })

    it('should compute ticks', () => {
        const axis = makeAxis('auto', {min: 0, max: 1})
        Axis.computeTicks(axis)
        expect(axis.ticks).toStrictEqual([0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1])
    })

})