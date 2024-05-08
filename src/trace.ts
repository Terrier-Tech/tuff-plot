import Mats, {Mat} from "tuff-core/mats"
import {GTag, SvgBaseAttrs} from "tuff-core/svg"
import { Vec } from "tuff-core/vecs"
import {PlotAxis} from "./axis"
import dayjs from "dayjs"
import { PartTag } from "tuff-core/parts"
import { Logger } from "tuff-core/logging"

export type InternalTrace<T extends {}> = PlotTrace<T> & {
    transform?: Mat
    _xAxis?: PlotAxis
    _yAxis?: PlotAxis
}

const log = new Logger("Trace")

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

export type MarkerStyle = {
    shape: 'circle' | 'square' | 'triangle_up' | 'triangle_down' | 'diamond'
    size: number
}

export type PlotTrace<T extends {}> = {
    id?: string
    type?: TraceType
    x: keyof T
    y: keyof T
    xAxis?: XAxisName
    yAxis?: YAxisName
    data: T[]
    style?: TraceStyle
    marker?: MarkerStyle
    title?: string
}

/**
 * Quantizes a number to within a reasonable precision.
 * @param num a number
 * @returns the quantized number
 */
function quantizeValue(num: number): string {
    return num.toString()
}


/**
 * Get all of the values for the given column as numbers.
 * @param trace
 * @param col a column key in the trace data
 * @param axis an optional axis that is used for computing numeric values (if it's grouped)
 */
function getNumberValues<T extends {}>(trace: PlotTrace<T>, col: keyof T, axis?: PlotAxis): Array<number | undefined> {
    if (axis && (axis.type == 'group' || axis.type == 'stack')) {
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
 * Computes the max valueCol value for each groupCol value
 * @param trace 
 * @param valueCol the column that maps to the values
 * @param groupCol the column by which to group the data
 */
function getGroupMaxes<T extends {}>(trace: PlotTrace<T>, valueCol: keyof T, groupCol: keyof T): Record<string, number> {
    const maxes: Record<string, number> = {}
    trace.data.forEach(row => {
        const k = row[groupCol]
        const v = row[valueCol]
        if (k) {
            const ks = k.toString()
            maxes[ks] ||= 0
            const vn = parseFloat(v?.toString() || '0')
            if (!isNaN(vn)) {
                maxes[ks] += vn
            }
        }
    })
    return maxes
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
function segmentValues<T extends {}>(trace: PlotTrace<T>, transform: Mat, xAxis: PlotAxis, yAxis: PlotAxis): Array<Vec[]> {
    const xValues = getNumberValues(trace, trace.x, xAxis)
    const yValues = getNumberValues(trace, trace.y, yAxis)
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
            segment.push(Mats.transform(transform, {x, y}))
        }
    })
    segments.push(segment)
    log.debug(`Segmented values`, xValues, yValues, segments)
    return segments
}

/**
 * Converts an array of points into an SVG polyline `points` string.
 * @param points
 */
function pointsString(points: Vec[]): string {
    return points.map(p => {
        return `${p.x},${p.y}`
    }).join(' ')
}

function renderMarker(parent: GTag, p: Vec, marker: MarkerStyle, style: TraceStyle) {
    const s = marker.size
    const d = s * Math.sqrt(2) / 2
    switch (marker.shape) {
        case 'square':
            parent.rect({x: p.x - s/2, y: p.y - s/2, width: s, height: s}, style)
            break
        case 'circle':
            parent.circle({cx: p.x, cy: p.y, r: s/2}, style)
            break
        case 'diamond':
            parent.rect({x: p.x - s/2, y: p.y - s / 2, width: s, height: s, transform: "rotate(45)"}, style)
                .css({transformOrigin: `${p.x}px ${p.y}px`})
            break
        case 'triangle_up':
            const upPoints = [
                {x: p.x, y: p.y-d},
                {x: p.x-d, y: p.y+s/2},
                {x: p.x+d, y: p.y+s/2}
            ]
            parent.polygon({points: pointsString(upPoints)}, style)
            break
        case 'triangle_down':
            const downPoints = [
                {x: p.x, y: p.y+d},
                {x: p.x-d, y: p.y-s/2},
                {x: p.x+d, y: p.y-s/2}
            ]
            parent.polygon({points: pointsString(downPoints)}, style)
            break
        default:
            throw `Don't know how to render marker shape '${marker.shape}'`
    }
}

function renderPreview(parent: PartTag, trace: PlotTrace<any>) {
    const style = trace.style || {}
    switch (trace.type) {
        case 'bar':
            parent.div('.bar').css({backgroundColor: style.fill})
            return
        case 'scatter':
            if (style.stroke) {
                parent.div('.stroke').css({backgroundColor: style.stroke, height: `${style.strokeWidth}px`})
            }
            if (trace.marker) {
                parent.svg('.marker', svg => {
                    const size = trace.marker?.size || 10
                    svg.attrs({viewBox: {width: size*2, height: size*2, x: 0, y: 0}})
                    svg.attrs({width: size*2, height: size*2})
                    svg.g(g => {
                        renderMarker(g, {x: size, y: size}, trace.marker!, style)
                    })
                })
            }
            return

    }
}

const Trace = {
    quantizeValue,
    getNumberValues,
    getStringValues,
    getGroupMaxes,
    segmentValues,
    pointsString,
    renderMarker,
    renderPreview
}

export default Trace