import { arrays } from "tuff-core"
import { Logger } from "tuff-core/logging"
import { SvgBaseAttrs } from "tuff-core/svg"
import { getTraceValues, PlotTrace } from "./trace"

const log = new Logger("PlotAxis")

export type AxisStyle = Pick<SvgBaseAttrs, 
    'opacity' | 'stroke' | 'strokeOpacity' | 'strokeWidth' | 'strokeDasharray' | 'strokeDashoffset' | 'strokeLinecap' | 'strokeLinejoin' | 'strokeMiterlimit'
    > & {
    tickLength?: number
}

export type LabelStyle = Pick<SvgBaseAttrs,
    'fill' | 'textDecoration' | 'fontFamily' | 'fontSize' | 'fontSizeAdjust' | 'fontStretch' | 'fontStyle' | 'fontVariant' | 'fontWeight'>

export type AxisRange = {
    min: number
    max: number
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

    const values = getTraceValues(trace, col)
    const min = arrays.min(arrays.compact(values))
    const max = arrays.max(arrays.compact(values))
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
    const span = axis.computedRange.max - axis.computedRange.min
    const step = (10**Math.round(Math.log10(span))) / 5
    axis.computedRange.min = Math.floor(axis.computedRange.min / step) * step
    axis.computedRange.max = Math.ceil(axis.computedRange.max / step) * step
    return true
}

export type PlotAxis = {
    type: 'number' | 'group'
    range: 'auto' | AxisRange
    computedRange?: AxisRange
    style: AxisStyle
}


const Axis = {
    roundRange,
    updateRange,
    extendRange
}

export default Axis