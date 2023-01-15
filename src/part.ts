import { Box} from "tuff-core/box"
import * as box from "tuff-core/box"
import { Logger } from "tuff-core/logging"
import { Mat } from "tuff-core/mat"
import { Part, PartTag } from "tuff-core/parts"
import { PlotLayout } from "./layout"
import { defaultColorPalette, PlotTrace, pointsString, segmentTraceValues } from "./trace"
import Axis, { PlotAxis } from "./axis"
import * as mat from "tuff-core/mat"
import { GTag, PolylineTagAttrs } from "tuff-core/svg"
import { objects } from "tuff-core"

const log = new Logger("PlotPart")

type Size = {width: number, height: number}
type Padding = {top: number, right: number, bottom: number, left: number}

export type PlotState = {
    layout: PlotLayout
    traces: PlotTrace<any>[]
}

export class PlotPart extends Part<PlotState> {
    
    render(parent: PartTag) {
		if (this.outerSize.width == 0) {
            return
        }
        parent.svg('.tuff-plot', svg => {
            svg.attrs({viewBox: {...this.outerSize, x: 0, y: 0}})
            this.state.traces.forEach((trace, index) => {
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

	traceTransforms: Record<string,Mat> = {}
    outerSize: Size = {width: 0, height: 0}
    padding: Padding = {top: 0, left: 0, right: 0, bottom: 0}
    viewport: Box = box.make(0, 0, 0, 0)

	private computeLayout(elem: HTMLElement) {
        log.info(`Computing plot layout`, elem)
        this.outerSize = {width: elem.clientWidth, height: elem.clientHeight}
        log.info(`Size is ${this.outerSize.width} x ${this.outerSize.height}`)

        // create default axes
        const axes = this.state.layout.axes || {}
        for (const trace of this.state.traces) {
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

        // size the viewport
        this.viewport = box.make(
            this.padding.left,
            this.padding.bottom,
            this.outerSize.width - this.padding.left - this.padding.right,
            this.outerSize.height - this.padding.top - this.padding.bottom
        )
        log.info("Viewport: ", this.viewport)

        // compute the axis ranges
        for (const trace of this.state.traces) {
            const xAxis = axes[trace.xAxis || 'bottom']!
            const yAxis = axes[trace.yAxis || 'left']!
            Axis.updateRange(xAxis, trace, trace.x)
            Axis.updateRange(yAxis, trace, trace.y)
        }
    
        // round the axis ranges
        for (const [_, axis] of Object.entries(axes)) {
            if (axis) {
                Axis.roundRange(axis)
            }
        }

        // compute the trace transforms
        for (const trace of this.state.traces) {
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


    private computeTraceTransform(trace: PlotTrace<any>, xAxis: PlotAxis, yAxis: PlotAxis) {
        log.info(`Computing ${trace.key} transform`, trace, xAxis, yAxis)
        const xRange = xAxis.computedRange || {min: 0, max: 1}
        const yRange = yAxis.computedRange || {min: 0, max: 1}
        // flip the y range because the SVG coordinate space is upside down
        const dataBox = box.make(xRange.min, yRange.max, xRange.max - xRange.min, yRange.min - yRange.max)
        let transform = mat.fromBoxes(dataBox, this.viewport)
        this.traceTransforms[trace.key] = transform
        log.info(`${trace.key} trace transform is: `, this.traceTransforms[trace.key])
    }


    private renderTrace<T extends {}>(parent: GTag, trace: PlotTrace<T>, index: number) {
        // break the trace into segments and transform them
        const transform = this.traceTransforms[trace.key] || mat.identity()
        const segments = segmentTraceValues(trace, transform)
        log.info(`trace ${trace.key} has ${segments.length} segments`, segments)

        // ensure it has either a stroke or fill
        const style = trace.style || {}
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

}