import * as mat from "tuff-core/mat"
import { Mat } from "tuff-core/mat"
import { SvgBaseAttrs } from "tuff-core/svg"
import { Vec } from "tuff-core/vec"
import {PlotAxis} from "./axis"

export type XAxisName = 'top' | 'bottom'

export type YAxisName = 'left' | 'right'

export type TraceStyle = Pick<SvgBaseAttrs, 'fill' | 'fillOpacity' | 'fillRule' | 'opacity' | 'stroke' | 'strokeOpacity' | 'strokeWidth' | 'strokeDasharray' | 'strokeDashoffset' | 'strokeLinecap' | 'strokeLinejoin' | 'strokeMiterlimit'> & {
     

}

export const defaultColorPalette = [
    '#377eb8',
    '#4daf4a',
    '#e41a1c',
    '#984ea3',
    '#ff7f00',
    '#ffff33',
    '#a65628',
    '#f781bf'
]

export type TraceType = 'scatter' | 'bar'

export type PlotTrace<T extends {}> = {
    id?: string
    type?: TraceType
    x: keyof T
    y: keyof T
    xAxis?: XAxisName
    yAxis?: YAxisName
    data: T[]
    style?: TraceStyle
}

/**
 * Get all of the values for the given column as numbers.
 * @param trace
 * @param col a column key in the trace data
 * @param axis an optional axis that is used for computing numeric values (if it's grouped)
 */
function getNumberValues<T extends {}>(trace: PlotTrace<T>, col: keyof T, axis?: PlotAxis): Array<number | undefined> {
    if (axis && axis.type == 'group') {
        const groups = axis.groups || getStringValues(trace, col)
        const groupMap: Record<string,number> = {} // map value to index
        groups.forEach((val, index) => {
            if (val) {
                groupMap[val] = index
            }
        })
        return trace.data.map(row => {
            const val = row[col]
            if (val) {
                return groupMap[val.toString()]
            } else {
                return undefined
            }
        })
    }

    return trace.data.map(row => {
        const val = row[col]
        if (typeof val == 'number') {
            return val
        }
        else if (val) {
            return parseFloat(val.toString())
        }
        else {
            return undefined
        }
    })
}

/**
 * Get all unique values for the given column as strings.
 * @param trace
 * @param col a column key in the trace data
 */
function getStringValues<T extends {}>(trace: PlotTrace<T>, col: keyof T): Array<string> {
    const values: Record<string, boolean> = {}
    trace.data.forEach(row => {
        const val = row[col]
        if (val) {
            values[val.toString()] = true
        }
    })
    return Object.keys(values)
}


/**
 * Breaks trace values into contiguous segments separated by null values.
 * @param trace
 * @param transform a transform to apply to the segmented values
 */
function segmentValues<T extends {}>(trace: PlotTrace<T>, transform: Mat): Array<Vec[]> {
    const xValues = getNumberValues(trace, trace.x)
    const yValues = getNumberValues(trace, trace.y)
    let segment: Vec[] = []
    let segments: Array<Vec[]> = []
    xValues.forEach((x, index) => {
        const y = yValues[index]
        if (x == undefined || y == undefined) {
            if (index) {
                segments.push(segment)
                segment = []
            }
            else {
                // next
            }
        }
        else {
            segment.push(mat.transform(transform, {x, y}))
        }
    })
    segments.push(segment)
    return segments
}


export function pointsString(points: Vec[]): string {
    return points.map(p => {
        return `${p.x},${p.y}`
    }).join(' ')
}

const Trace = {
    getNumberValues,
    getStringValues,
    segmentValues
}

export default Trace