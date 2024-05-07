import { Logger } from "tuff-core/logging"
import { Part, PartTag } from "tuff-core/parts"
import Layout, { PlotLayout, PlotSide } from "./layout"
import Trace, { defaultColorPalette, PlotTrace } from "./trace"
import Axis, { AxisStyle, LabelStyle, PlotAxis } from "./axis"
import {GTag, LineTagAttrs, PolylineTagAttrs, TextTagAttrs} from "tuff-core/svg"
import Objects from "tuff-core/objects"
import Html, { DivTag } from "tuff-core/html"
import Mats, {Mat} from "tuff-core/mats"
import Messages from "tuff-core/messages"
import Boxes, {Box} from "tuff-core/boxes"
import Arrays from "tuff-core/arrays"
import { Vec } from "tuff-core/vecs"
import "./styles.css"

const log = new Logger("PlotPart")

/**
 * Keep a global counter of how many IDs have been generated.
 */
let _idCounter = 0

type Size = {width: number, height: number}
type Padding = {top: number, right: number, bottom: number, left: number}

type InternalTrace<T extends {}> = PlotTrace<T> & {
    transform?: Mat
    _xAxis?: PlotAxis
    _yAxis?: PlotAxis
}

type InternalAxis = PlotAxis & {
    side?: PlotSide
}

type HoverPoint = {
    trace: InternalTrace<any>
    x: string
    y: string
}

type HoverRect = {
    key: string
    x: number
    y: number
    width: number
    height: number
    label: string
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
    private hoverRects: HoverRect[] = []
    private hoverPoints: Record<string, HoverPoint[]> = {}

    private hoverEnterKey = Messages.typedKey<{key: string, label: string}>()

    // key for any global mouse events on the part
    globalMouseKey = Messages.untypedKey()

    defaultAxisStyle: AxisStyle = {
        strokeWidth: 1
    }

    defaultLabelStyle: LabelStyle = {
        fontSize: 12
    }

    defaultTitleStyle: LabelStyle = {
        fontSize: 14,
        fontWeight: 'bold'
    }

    defaultAxisSettings = {
        barRatio: 0.75
    }

    async init() {
        this.traces = this.state.traces

        this.onMouseOver(this.hoverEnterKey, m => {
            const points = this.hoverPoints[m.data.key] || []
            this.showTooltip(m.event, m.data.label, points)
        })

        this.onMouseLeave(this.globalMouseKey, m => {
            if (m.event.target == this.getPlotContainer()) {
                log.info(`Mouse leave`, m.event.target)
                this.clearTooltip()
            }
        })
    }
    
    render(parent: PartTag) {
		if (this.outerSize.width == 0) {
            return
        }
        parent.div('.tuff-plot-container', container => {
            container.emitMouseLeave(this.globalMouseKey)
            container.svg('.tuff-plot', svg => {
                svg.attrs({viewBox: {...this.outerSize, x: 0, y: 0}})

                // viewport background
                svg.rect('.viewport', {...this.viewport})

                // grid gets rendered first so that the axes are on top
                svg.g('.grids', axes => {
                    for (const axis of this.axes) {
                        axes.g('.grid', axisGroup => {
                            this.renderAxisGrid(axisGroup, axis)
                        }).class(axis.side || 'unknown')
                    }
                })

                // traces
                const numTraces = this.traces.length
                this.traces.forEach((trace, index) => {
                    svg.g(".trace", traceParent => {
                        const traceType = trace.type || 'scatter'
                        switch (traceType) {
                            case 'scatter':
                                this.renderScatterTrace(traceParent, trace, index, numTraces)
                                break
                            case 'bar':
                                this.renderBarTrace(traceParent, trace, index, numTraces)
                                break
                            default:
                                log.warn(`Don't know how to render trace type '${traceType}'`)
                        }
                    })
                })
                svg.g('.hover', hoverContainer => {
                    this.renderHoverRects(hoverContainer)
                })

                // axes last so that the bars don't cover them
                svg.g('.axes', axes => {
                    for (const axis of this.axes) {
                        axes.g('.axis', axisGroup => {
                            this.renderAxis(axisGroup, axis)
                        }).class(axis.side || 'unknown')
                    }
                })
            })
        })
    }

    /**
     * Only call this after it's been rendered at least once.
     * @returns the plot container element
     */
    getPlotContainer(): HTMLElement {
        return this.element!.getElementsByClassName('tuff-plot-container')[0] as HTMLElement
    }
    
	update(_elem: HTMLElement) {
		if (this.viewport.width == 0) {
			this.computeLayout(_elem)
		}
	}

    outerSize: Size = {width: 0, height: 0}
    padding: Padding = {top: 0, left: 0, right: 0, bottom: 0}
    viewport: Box = Boxes.make(0, 0, 0, 0)

    private computePad(): number {
        return this.state.layout.pad || Layout.Defaults.pad
    }

	private computeLayout(elem: HTMLElement) {
        const pad = this.computePad()
        this.traces = this.state.traces

        this.outerSize = {width: elem.clientWidth, height: elem.clientHeight}
        log.info(`Outer size is ${this.outerSize.width} x ${this.outerSize.height}`, elem)

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
            trace._xAxis = axes[xName]
            const yName = trace.yAxis || 'left'
            axes[yName] ||= {
                type: 'number',
                range: 'auto',
                style: {}
            }
            trace._yAxis = axes[yName]
        }

        // compute the padding
        for (const side of Layout.PlotSides) {
            let p = pad
            const axis = axes[side] as InternalAxis
            if (axis) {
                const style = axis.style || this.defaultAxisStyle
                const labelStyle = axis.labelStyle || this.defaultLabelStyle
                const titleStyle = axis.titleStyle || this.defaultTitleStyle
                axis.side = side as PlotSide
                if (style.strokeWidth) {
                    p += style.strokeWidth
                }
                if (axis.tickLength) {
                    p += axis.tickLength + pad
                }
                if (labelStyle.fontSize) {
                    p += labelStyle.fontSize + pad
                }
                if (axis.title?.length && titleStyle.fontSize) {
                    p += titleStyle.fontSize + pad
                }
            }
            else {
                // show double pad on sides without an axis
                p += pad
            }
            this.padding[side as keyof Padding] = p
        }
        this.axes = Object.values(axes)
        log.info("Padding: ", this.padding)

        // size the viewport
        this.viewport = Boxes.make(
            this.padding.left,
            this.padding.top,
            this.outerSize.width - this.padding.left - this.padding.right,
            this.outerSize.height - this.padding.top - this.padding.bottom
        )
        log.info("Viewport: ", this.viewport)

        // compute the axis ranges
        for (const trace of this.traces) {
            const xAxis = trace._xAxis!
            const yAxis = trace._yAxis!
            Axis.updateRange(xAxis, trace, trace.x)
            Axis.updateRange(yAxis, trace, trace.y)

            // force grouped axes to zero
            if (xAxis.type == 'group' && yAxis.range == 'auto') {
                yAxis.computedRange!.min = 0
            }
            if (yAxis.type == 'group' && xAxis.range == 'auto') {
                xAxis.computedRange!.min = 0
            }
        }
    
        // round the axes and compute the ticks
        for (const [_, axis] of Object.entries(axes)) {
            if (axis) {
                if (axis.type == 'number') {
                    Axis.roundRange(axis)
                }
                const tickMode = axis.tickMode || 'auto'
                if (tickMode == 'auto') {
                    Axis.computeTicks(axis)
                }
            }
        }

        // compute the trace transforms
        this.hoverPoints = {}
        this.traces.forEach((trace, index) => {
            const xAxis = axes[trace.xAxis || 'bottom']!
            const yAxis = axes[trace.yAxis || 'left']!
            this.computeTraceTransform(trace, xAxis, yAxis)
            this.applyTraceStyleDefaults(trace, index)
            this.accumulateHoverPoints(trace, xAxis, yAxis, this.hoverPoints)
        })

        // compute the hover rects
        log.info(`Computed ${Object.values(this.hoverPoints).length} hover points`, this.hoverPoints)
        this.hoverRects = this.computeHoverRects(this.hoverPoints)
        log.info(`Computed ${this.hoverRects.length} hover rects`, this.hoverRects)

        // TODO: figure out how to mark parts dirty during update
        setTimeout(
            () => this.dirty()
            , 10
        )
        
	}

    /**
     * Computes the transform to convert coordinates in the given trace's space to screen space.
     * @param trace 
     * @param xAxis 
     * @param yAxis 
     */
    private computeTraceTransform(trace: InternalTrace<any>, xAxis: PlotAxis, yAxis: PlotAxis) {
        log.info(`Computing ${trace.id} transform`, trace, xAxis, yAxis)
        const xRange = xAxis.computedRange || {min: 0, max: 1}
        const yRange = yAxis.computedRange || {min: 0, max: 1}
        // flip the y range because the SVG coordinate space is upside down
        const dataBox = Boxes.make(xRange.min, yRange.max, xRange.max - xRange.min, yRange.min - yRange.max)
        let transform = Mats.fromBoxes(dataBox, this.viewport)
        trace.transform = transform
    }

    /**
     * Ensures that the given trace has either a stroke or fill, and sets the color according the rendering index.
     * @param trace the trace receiving the default style
     * @param index the index of the trace in the list of traces to plot
     */
    private applyTraceStyleDefaults(trace: InternalTrace<any>, index: number) {
        const style = trace.style ? {...trace.style} : {}

        // ensure there's a trace type
        trace.type ||= 'scatter'

        const defaultColor = defaultColorPalette[index % defaultColorPalette.length]
        log.info(`Default color for trace  ${index} is ${defaultColor}`, style)
        // ensure it has either a stroke or fill
        if (style.strokeWidth && !style.stroke) {
            style.stroke = defaultColor
        }
        if ((trace.marker || trace.type=='bar') && !style.fill) {
            style.fill = defaultColor
        }
        trace.style = style
    }


    /**
     * Add hover points to `hoverPoints` based on all of the trace's x values
     * @param trace the current trace
     * @param xAxis the x axis on which the trace is plotted
     * @param yAxis the y axis on which the trace is plotted
     * @param hoverPoints an existing map of hover points
     */
    private accumulateHoverPoints(trace: InternalTrace<any>, xAxis: PlotAxis, yAxis: PlotAxis, hoverPoints: Record<string, HoverPoint[]>) {
        const xVals = Trace.getNumberValues(trace, trace.x, xAxis)
        const yVals = Trace.getNumberValues(trace, trace.y, yAxis)
        for (let i=0; i<xVals.length; i++) {
            const x = xVals[i]!
            const y = yVals[i]!
            const pScreen = Mats.transform(trace.transform!, {x, y})
            const xQuant = Trace.quantizeValue(pScreen.x)
            const xString = Axis.valueTitle(xAxis, x, xAxis.tickFormat) || ''
            const yString = Axis.valueTitle(yAxis, y, yAxis.tickFormat) || ''
            hoverPoints[xQuant] ||= []
            hoverPoints[xQuant].push({
                trace,
                x: xString,
                y: yString
            })
        }
    }

    /**
     * Computes a list of rectangle definitions used by `renderHoverRects()`
     * @param hoverPoints a collection of `HoverPoint`s mapped to x coordinates
     * @returns an array of rectangle definitions
     */
    private computeHoverRects(hoverPoints: Record<string, HoverPoint[]>): HoverRect[] {
        // for each set of hover points, make a rect that extends 
        // halfway to the next set of points
        const xs = Arrays.sortBy(Object.keys(hoverPoints).map(x => {return {screen: parseFloat(x), key: x}}), 'screen')
        const rects: HoverRect[] = []
        for (let i = 0; i<xs.length; i++) {
            const x = xs[i]
            const x1 = i == 0 ? this.viewport.x : (xs[i-1].screen+x.screen)/2
            const x2 = i == xs.length-1 ? this.viewport.width+this.viewport.x : (xs[i+1].screen+x.screen)/2
            const points = hoverPoints[x.key]
            rects.push({
                x: x1,
                y: this.viewport.y,
                width: x2 - x1,
                height: this.viewport.height,
                label: points[0].x,
                key: x.key
            })
        }
        return rects
    }

    /**
     * Renders the given trace as a scatter plot.
     * @param parent the containing g tag
     * @param trace the trace to render
     * @param _index the index of the trace in the render list
     * @param _numTraces the number of traces being rendered 
     */
    private renderScatterTrace<T extends {}>(parent: GTag, trace: InternalTrace<T>, _index: number, _numTraces: number) {
        // break the trace into segments and transform them
        const transform = trace.transform || Mats.identity()
        const xAxis = trace._xAxis!
        const yAxis = trace._yAxis!
        const segments = Trace.segmentValues(trace, transform, xAxis, yAxis)
        log.info(`trace ${trace.id} has ${segments.length} segments`, segments)

        const style = {...trace.style}

        if (style.stroke?.length) {
            for (const segment of segments) {
                const lineArgs: PolylineTagAttrs = Objects.slice(style || {}, 'stroke', 'strokeWidth', 'strokeDasharray', 'strokeLinecap', 'strokeLinejoin')
                lineArgs.fill = 'none'
                lineArgs.points = Trace.pointsString(segment)
                parent.polyline(lineArgs)
            }
        }

        if (trace.marker && style.fill?.length) {
            for (const segment of segments) {
                for (const point of segment) {
                    Trace.renderMarker(parent, point, trace.marker, style)
                }
            }
        }
    }

    /**
     * Renders the given trace as a bar plot.
     * @param parent the containing g tag
     * @param trace the trace to render
     * @param index the index of the trace in the render list
     * @param numTraces the number of traces being rendered 
     */
    private renderBarTrace<T extends {}>(parent: GTag, trace: InternalTrace<T>, index: number, numTraces: number) {
        const style = {...trace.style}

        // get the raw points
        const xAxis = trace._xAxis!
        const yAxis = trace._yAxis!
        const xValues = Trace.getNumberValues(trace, trace.x, xAxis)
        const yValues = Trace.getNumberValues(trace, trace.y, yAxis)
        const points = Arrays.range(0, xValues.length).map(i => {
            const x = xValues[i] || 0
            const y = yValues[i] || 0
            return {x, y}
        })

        // compute the geometry of the boxes
        const boxes: Box[] = []
        if (xAxis.type == 'group') {
            const ratio = xAxis.barRatio || this.defaultAxisSettings.barRatio
            const width = ratio * ratio / numTraces // ratio squared because we want the groups to be separate as well
            const dx = -ratio/2 + ((index+0.5) / numTraces)*ratio - width/2
            for (const p of points) {
                boxes.push({x: p.x+dx, y: 0, width: width, height: p.y})
            }
        }
        else if (yAxis.type == 'group') {
            const ratio = yAxis.barRatio || this.defaultAxisSettings.barRatio
            const height = ratio * ratio / numTraces // ratio squared because we want the groups to be separate as well
            const dy = -ratio / 2 + ((index + 0.5) / numTraces) * ratio - height / 2
            for (const p of points) {
                boxes.push({x: 0, y: p.y+dy, width: p.x, height: height})
            }
        }
        else {
            log.warn(`Unable to render a bar trace when neither axis has type=='group'`)
            return
        }

        // transform and render the boxes
        const transform = trace.transform || Mats.identity()
        for (const box of boxes) {
            let screenBox = Mats.transformBox(transform, box)
            if (screenBox.height < 0) {
                screenBox = {...screenBox, y: screenBox.y + screenBox.height, height: -screenBox.height}
            }
            const attrs = {...screenBox, ...style}
            parent.rect(attrs)
        }
    }

    /**
     * Compute axis rendering metrics.
     * @param axis 
     * @returns the measurements necessary to render both the axis and its grid
     */
    private computeAxisMetrics(axis: InternalAxis) {
        const vp = this.viewport
        const side = axis.side || 'bottom'
        const orientation = (side == 'bottom' || side == 'top') ? 'horizontal' : 'vertical'
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
        const screenSpan = orientation == 'horizontal' ? line.x2 - line.x1 : line.y2 - line.y1

        return {
            line,
            orientation,
            side,
            screenSpan
        }
    }

    private renderAxis(parent: GTag, axis: InternalAxis) {
        const vp = this.viewport
        const style = axis.style || this.defaultAxisStyle
        const pad = this.computePad()
        const m = this.computeAxisMetrics(axis)
        log.info(`Rendering axis on ${m.side}`, axis)

        // ticks and grid
        const tickLength = axis.tickLength || 0
        const range = axis.computedRange
        const labelStyle = axis.labelStyle || this.defaultLabelStyle
        if (tickLength && axis.ticks && range) {
            for (const t of axis.ticks) {
                let tScreen = (t-range.min)/(range.max-range.min) * m.screenSpan
                if (m.orientation == 'vertical') {
                    tScreen = m.screenSpan - tScreen
                }
                let tickPoints: LineTagAttrs | null = null
                switch (m.side) {
                    case 'left':
                        tickPoints = {x1: m.line.x1-tickLength, x2: m.line.x1, y1: m.line.y1+tScreen, y2: m.line.y1+tScreen}
                        break
                    case 'right':
                        tickPoints = {x1: m.line.x1, x2: m.line.x1+tickLength, y1: m.line.y1+tScreen, y2: m.line.y1+tScreen}
                        break
                    case 'top':
                        tickPoints = {x1: m.line.x1+tScreen, x2: m.line.x1+tScreen, y1: m.line.y1-tickLength, y2: m.line.y1}
                        break
                    case 'bottom':
                        tickPoints = {x1: m.line.x1+tScreen, x2: m.line.x1+tScreen, y1: m.line.y2 + tickLength, y2: m.line.y2}
                        break
                }
                if (tickPoints) {
                    parent.line('.tick', tickPoints, style)
                    const text = Axis.valueTitle(axis, t, axis.tickFormat)
                    if (text) {
                        this.renderTickLabel(parent, text, {x: tickPoints.x1!, y: tickPoints.y1!}, m.side, labelStyle)
                    }
                }
            }
        }

        // render the actual line
        parent.line('.axis-line', m.line, style)

        // title
        const titleStyle = axis.titleStyle || this.defaultTitleStyle
        if (axis.title?.length && titleStyle) {
            const titleAttrs: TextTagAttrs = {...titleStyle}
            titleAttrs.classes ||= []
            titleAttrs.classes.push('axis-title')
            titleAttrs.classes.push(m.orientation)
            titleAttrs.classes.push(m.side)
            const offset = pad * 2 + tickLength + (titleStyle.fontSize||0)/2 + (labelStyle?.fontSize || 0)
            switch (m.side) {
                case 'left':
                    titleAttrs.x = m.line.x1 - offset
                    break
                case 'right':
                    titleAttrs.x = m.line.x1 + offset
                    break
                case 'top':
                    titleAttrs.y = m.line.y1 - offset
                    break
                case 'bottom':
                    titleAttrs.y = m.line.y1 + offset
                    break
            }
            let css: Partial<CSSStyleDeclaration> = {}
            if (m.orientation == 'horizontal') {
                titleAttrs.x = vp.x + vp.width / 2
            } else { // vertical
                titleAttrs.y = vp.y + vp.height / 2
                css.transformOrigin = `${titleAttrs.x}px ${titleAttrs.y}px`
            }
            parent.text(titleAttrs).css(css).textContent(axis.title)
        }
    }

    private renderAxisGrid(parent: GTag, axis: InternalAxis) {
        const vp = this.viewport
        const m = this.computeAxisMetrics(axis)
        const range = axis.computedRange
        const gridStyle = axis.gridStyle || {}
        if (axis.ticks && range) {
            for (const t of axis.ticks) {
                let tScreen = (t-range.min)/(range.max-range.min) * m.screenSpan
                if (m.orientation == 'vertical') {
                    tScreen = m.screenSpan - tScreen
                }
                let gridPoints: LineTagAttrs | null = null
                switch (m.side) {
                    case 'left':
                        gridPoints = {x1: m.line.x1, x2: m.line.x1+vp.width, y1: m.line.y1+tScreen, y2: m.line.y1+tScreen}
                        break
                    case 'right':
                        gridPoints = {x1: m.line.x1, x2: m.line.x1-vp.width, y1: m.line.y1+tScreen, y2: m.line.y1+tScreen}
                        break
                    case 'top':
                        gridPoints = {x1: m.line.x1+tScreen, x2: m.line.x1+tScreen, y1: m.line.y1, y2: m.line.y1+vp.height}
                        break
                    case 'bottom':
                        gridPoints = {x1: m.line.x1+tScreen, x2: m.line.x1+tScreen, y1: m.line.y2, y2: m.line.y2-vp.height}
                        break
                }
                if (gridPoints) {
                    parent.line('.grid', gridPoints, gridStyle)
                }
            }
        }
    }

    renderTickLabel(parent: GTag, text: string, pos: Vec, side: PlotSide, style: LabelStyle) {
        const pad = this.computePad()
        let attrs: TextTagAttrs = {...pos, ...style}
        switch (side) {
            case 'left':
                attrs.textAnchor = 'end'
                attrs.alignmentBaseline = 'middle'
                attrs.x! -= pad
                break
            case 'right':
                attrs.textAnchor = 'start'
                attrs.alignmentBaseline = 'middle'
                attrs.x! += pad
                break
            case 'top':
                attrs.textAnchor = 'middle'
                attrs.alignmentBaseline = 'baseline'
                attrs.y! -= pad
                break
            case 'bottom':
                attrs.textAnchor = 'middle'
                attrs.alignmentBaseline = 'hanging'
                attrs.y! += pad
                break
        }
        parent.text(".label", {x: pos.x, y: pos.y, text: text}, attrs)
    }

    /**
     * Renders a series of transparent rectangles that emit mouseover events so we can track which points the user is hovering over.
     * @param parent the parent group tag
     */
    renderHoverRects(parent: GTag) {
        for (const rect of this.hoverRects) {
            parent.rect(Objects.slice(rect, 'x' ,'y', 'width', 'height'))
                .data({label: rect.label, key: rect.key})
                .emitMouseOver(this.hoverEnterKey, {key: rect.key, label: rect.label})
        }
    }

    /**
     * Removes any existing tooltip from the DOM.
     */
    clearTooltip() {
        const existing = this.element?.getElementsByClassName('tooltip')
        if (existing?.length) {
            for (let i=0; i<existing.length; i++) {
                existing.item(i)?.remove()
            }
        }
    }

    showTooltip(event: MouseEvent, label: string, points: HoverPoint[]) {
        this.clearTooltip()

        const root = this.element!

        // determine where the tooltip should be placed in the DOM
        const rootRect = root.getBoundingClientRect()
        const targetRect = (event.target as HTMLElement).getBoundingClientRect()
        const targetCenter = targetRect.x + targetRect.width/2
        const xDiff = targetCenter - rootRect.left

        // render the new tooltip
        const tooltip = Html.createElement('div', div => {
            div.css({left: `${xDiff}px`})
            this.renderTooltip(div, label, points)
        })
        this.getPlotContainer().append(tooltip)
    }

    renderTooltip(parent: DivTag, label: string, points: HoverPoint[]) {
        parent.class('tooltip')
        parent.div('.label').text(label)
        for (const point of points) {
            const trace = point.trace
            parent.div('.line', line => {
                line.div('.preview', preview => {
                    Trace.renderPreview(preview, trace)
                })
                const title = trace.title || trace.y.toString()
                line.div('.title').text(title)
                line.div('.value').text(point.y)
            })
        }
    }

}