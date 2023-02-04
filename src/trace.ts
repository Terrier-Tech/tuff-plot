import * as mat from "tuff-core/mat"
import { Mat } from "tuff-core/mat"
import { SvgBaseAttrs } from "tuff-core/svg"
import { Vec } from "tuff-core/vec"

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

export type PlotTrace<T extends {}> = {
    id?: string
    x: keyof T
    y: keyof T
    xAxis?: XAxisName
    yAxis?: YAxisName
    data: T[]
    style?: TraceStyle
}


export function getTraceValues<T extends {}>(trace: PlotTrace<T>, col: keyof T): Array<number | undefined> {
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


export function segmentTraceValues<T extends {}>(trace: PlotTrace<T>, transform: Mat): Array<Vec[]> {
    const xValues = getTraceValues(trace, trace.x)
    const yValues = getTraceValues(trace, trace.y)
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