import { Box} from "tuff-core/box"
import * as box from "tuff-core/box"
import { Logger } from "tuff-core/logging"
import { Mat } from "tuff-core/mat"
import { Part, PartTag } from "tuff-core/parts"
import Layout, { PlotLayout, PlotSide } from "./layout"
import { defaultColorPalette, PlotTrace, pointsString, segmentTraceValues } from "./trace"
import Axis, { AxisStyle, PlotAxis } from "./axis"
import * as mat from "tuff-core/mat"
import { GTag, PolylineTagAttrs, SvgTagBase } from "tuff-core/svg"
import { objects } from "tuff-core"

const log = new Logger("PlotPart")

/**
 * Keep a global counter of how many IDs have been generated.
 */
let _idCounter = 0

type Size = {width: number, height: number}
type Padding = {top: number, right: number, bottom: number, left: number}

type InternalTrace<T extends {}> = PlotTrace<T> & {
    transform?: Mat
}

type InternalAxis = PlotAxis & {
    side?: PlotSide
}

function roundPixel(p: number): number {
    return Math.floor(p) + 0.5
}

export type PlotState = {
    layout: PlotLayout
    traces: PlotTrace<any>[]
}

export class PlotPart extends Part<PlotState> {

    private traces: InternalTrace<any>[] = []
    private axes: InternalAxis[] = []

    defaultAxisStyle: AxisStyle = {
        strokeWidth: 1
    }

    async init() {
        this.traces = this.state.traces
    }
    
    render(parent: PartTag) {
		if (this.outerSize.width == 0) {
            return
        }
        parent.svg('.tuff-plot', svg => {
            svg.attrs({viewBox: {...this.outerSize, x: 0, y: 0}})
            svg.g('.axes', axes => {
                for (const axis of this.axes) {
                    this.renderAxis(axes, axis)
                }
            })
            this.traces.forEach((trace, index) => {
                svg.g(".trace", traceParent => {
                    this.renderTrace(traceParent, trace, index)
                })
            })
        })
    }

    
	update(elem: HTMLElement) {
		if (this.viewport.width == 0) {
			this.computeLayout(elem)
		}
	}

    outerSize: Size = {width: 0, height: 0}
    padding: Padding = {top: 0, left: 0, right: 0, bottom: 0}
    viewport: Box = box.make(0, 0, 0, 0)

	private computeLayout(elem: HTMLElement) {
        const pad = this.state.layout.pad || Layout.Defaults.pad
        this.traces = this.state.traces

        log.info(`Computing plot layout`, elem)
        this.outerSize = {width: elem.clientWidth, height: elem.clientHeight}
        log.info(`Size is ${this.outerSize.width} x ${this.outerSize.height}`)

        // create default axes
        const axes = this.state.layout.axes || {}
        for (const trace of this.traces) {
            trace.id ||= `${String(trace.y)}-${_idCounter}`
            _idCounter += 1
            const xName = trace.xAxis || 'bottom'
            axes[xName] ||= {
                type: 'number',
                range: 'auto',
                style: {}
            }
            const yName = trace.yAxis || 'left'
            axes[yName] ||= {
                type: 'number',
                range: 'auto',
                style: {}
            }
        }

        // compute the padding
        for (const side of Layout.PlotSides) {
            let p = pad
            const axis = axes[side]
            if (axis) {
                const style = axis.style || this.defaultAxisStyle
                ;(axis as InternalAxis).side = side as PlotSide // ish
                if (style.strokeWidth) {
                    p += style.strokeWidth
                }
                if (axis.tickLength) {
                    p += axis.tickLength
                }
            }
            this.padding[side as keyof Padding] = p
        }
        this.axes = Object.values(axes)
        log.info("Padding: ", this.padding)

        // size the viewport
        this.viewport = box.make(
            this.padding.left,
            this.padding.top,
            this.outerSize.width - this.padding.left - this.padding.right,
            this.outerSize.height - this.padding.top - this.padding.bottom
        )
        log.info("Viewport: ", this.viewport)

        // compute the axis ranges
        for (const trace of this.traces) {
            const xAxis = axes[trace.xAxis || 'bottom']!
            const yAxis = axes[trace.yAxis || 'left']!
            Axis.updateRange(xAxis, trace, trace.x)
            Axis.updateRange(yAxis, trace, trace.y)
        }
    
        // round the axes and compute the ticks
        for (const [_, axis] of Object.entries(axes)) {
            if (axis) {
                Axis.roundRange(axis)
                if (axis.tickMode == 'auto') {
                    Axis.computeTicks(axis)
                }
            }
        }

        // compute the trace transforms
        for (const trace of this.traces) {
            const xAxis = axes[trace.xAxis || 'bottom']!
            const yAxis = axes[trace.yAxis || 'left']!
            this.computeTraceTransform(trace, xAxis, yAxis)
        }

        // TODO: figure out how to mark parts dirty during update
        setTimeout(
            () => this.dirty()
            , 10
        )
        
	}


    private computeTraceTransform(trace: InternalTrace<any>, xAxis: PlotAxis, yAxis: PlotAxis) {
        log.info(`Computing ${trace.id} transform`, trace, xAxis, yAxis)
        const xRange = xAxis.computedRange || {min: 0, max: 1}
        const yRange = yAxis.computedRange || {min: 0, max: 1}
        // flip the y range because the SVG coordinate space is upside down
        const dataBox = box.make(xRange.min, yRange.max, xRange.max - xRange.min, yRange.min - yRange.max)
        let transform = mat.fromBoxes(dataBox, this.viewport)
        trace.transform = transform
    }


    private renderTrace<T extends {}>(parent: GTag, trace: InternalTrace<T>, index: number) {
        // break the trace into segments and transform them
        const transform = trace.transform || mat.identity()
        const segments = segmentTraceValues(trace, transform)
        log.info(`trace ${trace.id} has ${segments.length} segments`, segments)

        // ensure it has either a stroke or fill
        const style = {...trace.style}
        if (!style.stroke && !style.fill) {
            style.stroke = defaultColorPalette[index % defaultColorPalette.length]
        }

        if (style.stroke?.length) {
            for (const segment of segments) {
                const lineArgs: PolylineTagAttrs = objects.slice(style || {}, 'stroke', 'strokeWidth', 'strokeDasharray', 'strokeLinecap', 'strokeLinejoin')
                lineArgs.fill = 'none'
                lineArgs.points = pointsString(segment)
                parent.polyline(lineArgs)
            }
        }
    }

    private renderAxis(parent: GTag, axis: InternalAxis) {
        const style = axis.style || this.defaultAxisStyle
        const side = axis.side || 'bottom'
        const orientation = (side == 'bottom' || side == 'top') ? 'horizontal' : 'vertical'
        log.info(`Rendering axis on ${side}`, axis)
        const vp = this.viewport
        const line = {
            x1: roundPixel(vp.x), 
            x2: roundPixel(vp.x + vp.width), 
            y1: roundPixel(vp.y), 
            y2: roundPixel(vp.y + vp.height)
        }
        
        switch (side) {
            case 'left':
                line.x2 = line.x1
                break
            case 'right':
                line.x1 = line.x2
                break
            case 'top':
                line.y2 = line.y1
                break
            case 'bottom':
                line.y1 = line.y2
                break
        }
        parent.line('.axis', line, style)
        const screenSpan = orientation == 'horizontal' ? line.x2 - line.x1 : line.y2 - line.y1

        const tickLength = axis.tickLength || 0
        const range = axis.computedRange
        if (tickLength && axis.ticks && range) {
            for (const t of axis.ticks) {
                const tScreen = (t-range.min)/(range.max-range.min) * screenSpan
                switch (side) {
                    case 'left':
                        parent.line('.tick', {x1: line.x1-tickLength, x2: line.x1, y1: line.y1+tScreen, y2: line.y1+tScreen}, style)
                        break
                    case 'right':
                        parent.line('.tick', {x1: line.x1, x2: line.x1+tickLength, y1: line.y1+tScreen, y2: line.y1+tScreen}, style)
                        break
                    case 'top':
                        parent.line('.tick', {x1: line.x1+tScreen, x2: line.x1+tScreen, y1: line.y1-tickLength, y2: line.y1}, style)
                        break
                    case 'bottom':
                        parent.line('.tick', {x1: line.x1+tScreen, x2: line.x1+tScreen, y1: line.y2, y2: line.y2+tickLength}, style)
                        break
                }
            }

        }
    }

}