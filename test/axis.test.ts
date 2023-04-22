import { describe, expect, it } from 'vitest'
import Axis, {AxisRange, AxisType, PlotAxis} from '../src/axis'
import dayjs from "dayjs"

describe('Axis Rounding', () => {

    function makeAxis(type: AxisType, range: 'auto' | AxisRange, computedRange?: AxisRange): PlotAxis {
        return {
            type: type,
            range,
            computedRange,
            style: {}
        }
    }

    it('should not round manual ranges', () => {
        const axis = makeAxis('number', {min: 0, max: 1})
        expect(Axis.roundRange(axis)).toBe(false)
        expect(axis.computedRange).toBeUndefined()
    })

    it('should round to integers for small ranges', () => {
        const axis = makeAxis('number', 'auto', {min: -0.2, max: 0.9})
        expect(Axis.roundRange(axis)).toBe(true)
        expect(axis.computedRange).toBeDefined()
        expect(axis.computedRange!.min).toBe(-1)
        expect(axis.computedRange!.max).toBe(1)
    })

    it('should compute ticks', () => {
        const axis = makeAxis('number', 'auto', {min: 0, max: 1})
        Axis.computeTicks(axis)
        expect(axis.ticks).toStrictEqual([0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1])
    })

    it("should compute day ticks", () => {
        const startDate = dayjs('2023-04-01')
        const numDays = 10
        const computedRange = {
            min: startDate.valueOf(),
            max: startDate.add(numDays, 'day').valueOf()
        }
        console.log("computed range", computedRange)
        const axis = makeAxis('time', 'auto', computedRange)
        Axis.computeTicks(axis)
        expect(axis.ticks!.length).toBe(numDays + 1)
    })

})