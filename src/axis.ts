import { Logger } from "tuff-core/logging"
import { SvgBaseAttrs } from "tuff-core/svg"
import Trace, { InternalTrace, PlotTrace } from "./trace"
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
        case 'stack':
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
 * Get all unique values for the given column as strings.
 * @param data
    * @param col a column key in the trace data
 */
function computeStringValues<T extends {}>(axis: PlotAxis, data: T[], col: keyof T): Array<string> {
    if (axis.groups) {
        return axis.groups
    }
    const values: Record<string, boolean> = {}
    data.forEach(row => {
        const val = row[col]
        if (val) {
            values[val.toString()] = true
        }
    })
    return Object.keys(values)
}


/**
* Get all of the values for the given column as numbers.
* @param axis the axis that is used for computing numeric values (if it's grouped)
* @param data
* @param col a column key in the trace data
*/
function computeNumberValues<T extends {}>(axis: PlotAxis, data: T[], col: keyof T): Array<number | undefined> {
   if (axis && (axis.type == 'group' || axis.type == 'stack')) {
       const groups = computeStringValues(axis, data, col)
       const groupMap: Record<string,number> = {} // map value to index
       groups.forEach((val, index) => {
           if (val) {
               groupMap[val] = index
           }
       })
       return data.map(row => {
           const val = row[col]
           if (val) {
               return groupMap[val.toString()]
           } else {
               return undefined
           }
       })
   }

   return data.map(row => {
       const val = row[col]
       if (typeof val == 'number') {
           return val
       }
       else if (typeof val == 'string') {
           if (axis && axis.type == 'time') {
               return dayjs(val).valueOf()
           }
           else {
               return parseFloat(val.toString())
           }
       }
       else {
           return undefined
       }
   })
}

/**
 * Updates the range of an axis to fit data from the given trace column.
 * @param axis the axis to update
 * @param trace a trace providing data
 * @param col the trace column from which to pull the values
 * @param otherAxis the other axis on the plot
 * @param otherCol the column used in the other axis
 */
function updateRange<T extends {}>(axis: PlotAxis, trace: PlotTrace<T>, col: keyof T & string) {
    log.info(`Axis.updateRange for ${col}`, axis, trace, col)
    if (axis.range != 'auto') {
        // manual range
        axis.computedRange = axis.range
        return
    }

    // bar charts get integers for the virtual range
    if (axis.type == 'group' || axis.type == 'stack') {
        const stringValues = computeStringValues(axis, trace.data, col)
        axis.computedRange = {min: -0.5, max: stringValues.length-0.5}
        axis.groups ||= stringValues
        log.info(`${col.toString()} axis groups`, axis.groups)
        return
    }

    // regular auto range
    const values = Arrays.compact(computeNumberValues(axis, trace.data, col))
    const min = Arrays.min(values)
    let max = Arrays.max(values)
    axis.computedRange = extendRange({min, max}, axis.computedRange)
    log.info(`Updating axis range with ${col.toString()} to`, axis.computedRange)

}

/**
 * Assigns axis ranges for all axes on traces that use a stacked axis
 * @param axis the stacked axis
 * @param traces the traces that use the axis
 * @param valueKey the key for getting data from the traces to compute the range (the opposite of the orientation of the axis)
 */
function updateStackedRange<T extends {}>(axis: PlotAxis, traces: InternalTrace<T>[], valueKey: 'x' | 'y') {
    log.info(`Axis.updateStackedRange for ${valueKey}`, axis, traces, valueKey)
    const groupKey = valueKey == 'x' ? 'y' : 'x'
    
    // compute the max value for each group
    const maxes: Record<string, number> = {}
    for (const trace of traces) {
        trace.data.forEach(row => {
            const k = row[trace[groupKey]]
            const v = row[trace[valueKey]]
            if (k) {
                const ks = k.toString()
                maxes[ks] ||= 0
                const vn = parseFloat(v?.toString() || '0')
                if (!isNaN(vn)) {
                    maxes[ks] += vn
                }
            }
        })
    }
    log.info(`Computed max values`, maxes)

    const max = Arrays.max(Object.values(maxes)) || 0
    const otherAxisKey = valueKey == 'x' ? '_xAxis' : '_yAxis'
    for (const trace of traces) {
        const otherAxis = trace[otherAxisKey]
        if (otherAxis) {
            otherAxis.computedRange = {min: 0, max}
            log.info(`Updating stacked ${valueKey} axis range`, axis.computedRange, )
        }
    }
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
    if (axis.type == 'group' || axis.type == 'stack') {
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
    if (axis.type == 'group' || axis.type == 'stack') {
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

export type AxisType = 'number' | 'group' | 'stack' | 'time'

/**
 * Highlights a specific value on the axis, making a styled line and maybe a tooltip in the future.
 */
export type AxisAnnotation = {
    value: number | string
    style: AxisStyle
    title?: string
}

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
    annotations?: AxisAnnotation[]
}


const Axis = {
    roundRange,
    updateRange,
    updateStackedRange,
    valueTitle,
    computeTicks,
    computeStringValues,
    computeNumberValues
}

export default Axis