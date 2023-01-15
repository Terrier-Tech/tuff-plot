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

export type AxisRange = {
    min: number
    max: number
}

export function updateAxisRange<T extends {}>(axis: PlotAxis, trace: PlotTrace<T>, col: keyof T) {
    if (axis.range != 'auto') {
        // manual range
        axis.computedRange = axis.range
        return
    }

    const values = getTraceValues(trace, col)
    const min = arrays.min(arrays.compact(values))
    const max = arrays.max(arrays.compact(values))
    axis.computedRange = extendAxisRange({min, max}, axis.computedRange)
    log.info(`Updating axis range with ${col.toString()} to`, axis.computedRange)

}

export function extendAxisRange(range1: AxisRange, range2?: AxisRange): AxisRange {
    if (!range2) {
        return range1
    }
    return {
        min: Math.min(range1.min, range2.min),
        max: Math.max(range1.max, range2.max)
    }
}

export type PlotAxis = {
    type: 'number' | 'group'
    range: 'auto' | AxisRange
    computedRange?: AxisRange
    style: AxisStyle
}

