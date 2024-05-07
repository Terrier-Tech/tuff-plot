import { Logger } from "tuff-core/logging"
import { SvgBaseAttrs } from "tuff-core/svg"
import Trace, { PlotTrace } from "./trace"
import dayjs from 'dayjs'
import numeral from "numeral"
import Arrays from "tuff-core/arrays"

const log = new Logger("PlotAxis")

export type AxisStyle = Pick<SvgBaseAttrs, 
    'opacity' | 'stroke' | 'strokeOpacity' | 'strokeWidth' | 'strokeDasharray' | 'strokeDashoffset' | 'strokeLinecap' | 'strokeLinejoin' | 'strokeMiterlimit'>

export type LabelStyle = Pick<SvgBaseAttrs,
    'fill' | 'textDecoration' | 'fontFamily' | 'fontSize' | 'fontSizeAdjust' | 'fontStretch' | 'fontStyle' | 'fontVariant' | 'fontWeight'>

export type AxisRange = {
    min: number
    max: number
}

const msPerMinute = 1000 * 60
const msPerHour = msPerMinute * 60
const msPerDay = msPerHour * 24

/**
 * Computes a nice step for things like axis rounding and ticks in the given range.
 * @param min the start of the range
 * @param max the stop of the range
 * @param scale a scale factor to apply (range is divided by scale, result is multuplied by it)
 */
function numberRangeStep(min: number, max: number, scale: number = 1): number {
    const span = max/scale - min/scale
    const step = (10 ** Math.floor(Math.log10(span)))
    if (span / step > 10) {
        return step * 2 * scale
    }
    if (span / step == 1) {
        return span / 10 * scale
    }
    return step * scale
}

/**
 * Computes a reasonable step by which to round or divide (for ticks) a range.
 */
function rangeStep(range: AxisRange, type: AxisType): number {
    switch (type) {
        case 'group':
            return 1
        case 'time':
            const dMin = dayjs(range.min)
            const dMax = dayjs(range.max)
            const diff = dMax.diff(dMin)
            // TODO: add more logic for other time spans
            if (diff > 100 * msPerDay) {
                // month-ish steps
                return numberRangeStep(range.min, range.max, msPerDay*30)
            }
            if (diff > 3 * msPerDay) {
                // day steps
                return numberRangeStep(range.min, range.max, msPerDay)
            }
            else {
                return numberRangeStep(range.min, range.max)
            }
        default: // number
            return numberRangeStep(range.min, range.max)
    }
}

/**
 * Updates the range of an axis to fit data from the given trace column.
 * @param axis the axis to update
 * @param trace a trace providing data
 * @param col the trace column from which to pull the values
 */
function updateRange<T extends {}>(axis: PlotAxis, trace: PlotTrace<T>, col: keyof T) {
    if (axis.range != 'auto') {
        // manual range
        axis.computedRange = axis.range
        return
    }

    if (axis.type == 'group') {
        const stringValues = Trace.getStringValues(trace, col)
        axis.computedRange = {min: -0.5, max: stringValues.length-0.5}
        axis.groups ||= stringValues
        log.info(`${col.toString()} axis groups`, axis.groups)
        return
    }

    const values = Trace.getNumberValues(trace, col, axis)
    const min = Arrays.min(Arrays.compact(values))
    const max = Arrays.max(Arrays.compact(values))
    axis.computedRange = extendRange({min, max}, axis.computedRange)
    log.info(`Updating axis range with ${col.toString()} to`, axis.computedRange)

}

/**
 * Extends an axis range to contain the second given range.
 * @param range1 a range to extend
 * @param range2 another range
 * @returns the extended range
 */
function extendRange(range1: AxisRange, range2?: AxisRange): AxisRange {
    if (!range2) {
        return range1
    }
    return {
        min: Math.min(range1.min, range2.min),
        max: Math.max(range1.max, range2.max)
    }
}

/**
 * Rounds the computedRange value out to nice numbers
 * @param axis 
 * @returns true if the range was actually rounded
 */
function roundRange(axis: PlotAxis): boolean {
    if (!axis.computedRange) {
        // nothing to round
        return false
    }
    if (axis.range != 'auto') {
        // don't round a manual range
        return false
    }
    const oldRange = {...axis.computedRange}
    const step = rangeStep(axis.computedRange, axis.type)
    axis.computedRange.min = Math.floor(axis.computedRange.min / step) * step
    axis.computedRange.max = Math.ceil(axis.computedRange.max / step) * step
    log.info(`Rounded range`, oldRange, axis.computedRange)
    return true
}

/**
 * Populates `axis.ticks` automatically based on the axis range.
 * @param axis
 * @return true if there are ticks, false if the range is invalid
 */
function computeTicks(axis: PlotAxis): boolean {
    if (!axis.computedRange) {
        // no range to use
        return false
    }
    if (axis.computedRange.max < axis.computedRange.min) {
        // range is inverted
        return false
    }

    // grouped
    if (axis.type == 'group') {
        axis.ticks = Arrays.range(Math.ceil(axis.computedRange.min), Math.floor(axis.computedRange.max))
        log.info('Computed group ticks', axis)
        return true
    }

    // don't compute manual
    const tickMode = axis.tickMode || 'auto'
    if (tickMode == 'manual') {
        return true
    }

    // months
    if (tickMode == 'months') {
        if (axis.type != 'time') {
            throw `tickMode=months can only be used with type=time, not ${axis.type}`
        }
        let d = dayjs(axis.computedRange.min).startOf('month')
        if (d.valueOf() < axis.computedRange.min) {
            // ensure that there's not a tick off the beginning of the axis
            d = d.add(1, 'month')
        }
        const months: number[] = []
        while (d.valueOf() < axis.computedRange.max) {
            months.push(d.valueOf())
            d = d.add(1, 'month')
        }
        axis.ticks = months
        log.info(`Computed month ticks for ${axis.computedRange.min} to ${axis.computedRange.max}`, months)
        return true
    }

    // number or time
    const step = rangeStep(axis.computedRange, axis.type)
    const numSteps = (axis.computedRange.max - axis.computedRange.min) / step
    axis.ticks = Arrays.range(axis.computedRange.min, axis.computedRange.max, step)
    log.info(`Step for ${axis.computedRange.min} to ${axis.computedRange.max} is ${step} (${numSteps} steps)`, axis)
    return true
}

/**
 * Computes a string that represents the given value on this axis.
 * @param axis
 * @param value
 * @param format an optional format string (should be dayjs for axis.type=='time' or numeral for axis.type=='number')
 */
function valueTitle(axis: PlotAxis, value: number, format?: string): string | undefined {
    if (axis.type == 'group') {
        if (axis.groups?.length) {
            return axis.groups[Math.round(value)]
        }
        return undefined
    }
    if (format) {
        if (axis.type == 'time') {
            // assume it's a dayjs format
            return dayjs(value).format(format)
        }
        else {
            // assume it's a numeral format
            return numeral(value).format(format)
        }
    }
    else {
        return value.toString()
    }
}

export type AxisType = 'number' | 'group' | 'time'

export type PlotAxis = {
    type: AxisType
    range: 'auto' | AxisRange
    tickMode?: 'auto' | 'manual' | 'months'
    tickFormat?: string
    ticks?: number[]
    hoverFormat?: string
    groups?: string[]
    computedRange?: AxisRange
    style?: AxisStyle
    tickLength?: number
    labelStyle?: LabelStyle
    barRatio?: number
    title?: string
    titleStyle?: LabelStyle
    gridStyle?: AxisStyle
}


const Axis = {
    roundRange,
    updateRange,
    valueTitle,
    computeTicks
}

export default Axis