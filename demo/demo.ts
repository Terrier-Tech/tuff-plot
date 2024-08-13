import Arrays from "tuff-core/arrays"
import { Part, PartTag } from "tuff-core/parts"
import { PlotPart } from "../src/part"
import "./demo.css"
import dayjs from "dayjs"
import { PlotTrace } from "../src/trace"
import { PlotLayout } from "../src/layout"

const baseAxis = {
	type: 'number' as const,
	range: 'auto' as const,
	tickLength: 6
}

const lineStyle = {
	strokeWidth: 2
} as const

/**
 * A cheap way to generate predictable pseudo-random numbers
 * @param seed 
 * @returns 
 */
function seededRandom(seed: number) {
    var x = Math.sin(seed++) * 10000
    return x - Math.floor(x)
}

export class App extends Part<{}> {

	plots: Record<string, PlotPart> = {}
	updateInterval: ReturnType<typeof setInterval> | null = null

	intervalOffset = 0

	async init() {

		this.makeSimple()

		this.makeDates()

		this.makeBar()

		this.dirty()

		// uncomment to see the plots update in real time
		// this.updateInterval = setInterval(() => {
		// 	this.intervalOffset += 1
		// 	this.makeSimple()
		// 	this.makeDates()
		// }, 1000)
	}

	render(parent: PartTag) {
		parent.h1({ text: "Tuff Plot" })
		parent.div('.plots', plotsContainer => {
			for (const [key, plot] of Object.entries(this.plots)) {
				plotsContainer.div('.plot', plotContainer => {
					plotContainer.h2({text: key})
					plotContainer.part(plot)
				})
			}
		})
	}


	makeSimple() {

		const lineData = Arrays.range(0, 100).map(i => {
			const x = (i + this.intervalOffset) / 20
			return {
				x,
				foo: Math.sin(x) * 1.5,
				bar: Math.cos(x * 1.5)
			}
		})

		const pointData = Arrays.range(0, 100, 5).map(i => {
			const x = (i + this.intervalOffset) / 20
			return {
				x,
				baz: Math.cos(x*0.75) * 1.25
			}
		})

		const layout: PlotLayout = {
			axes: {
				left: {
					...baseAxis,
					title: 'Y',
					tickFormat: '0.[00]'
				},
				bottom: {
					...baseAxis,
					title: 'X'
				}
			}
		}

		const traces: PlotTrace<any>[] = [
			{
				data: lineData,
				x: 'x',
				y: 'foo',
				style: lineStyle
			},
			{
				data: lineData,
				x: 'x',
				y: 'bar',
				title: "Bar",
				style: {...lineStyle, strokeDasharray: '6 6'}
			},
			{
				data: pointData,
				x: 'x',
				y: 'baz',
				style: {strokeWidth: 1},
				marker: {
					shape: 'circle',
					size: 8
				}
			}
		]

		if (this.plots['simple']) {
			this.plots['simple'].state = { layout, traces }
			this.plots['simple'].relayout()
		}
		else {
			this.plots['simple'] = this.makePart(PlotPart, { layout, traces })
		}
	}

	makeBar() {
		const barData = [
			{name: 'foo', branch1: 3000, branch2: 2000},
			{name: 'bar', branch1: 1200, branch2: 4500},
			{name: 'baz', branch1: 5300, branch2: 3200},
			{name: 'fab', branch1: 2400, branch2: 1300}
		]

		const barStyle = {
			strokeWidth: 2
		} as const

		this.plots['grouped bar'] = this.makePart(PlotPart, {
			layout: {
				axes: {
					left: {
						...baseAxis,
						title: 'Value',
						tickFormat: '($0.[0]a)'
					},
					bottom: {
						...baseAxis,
						type: 'group',
						title: 'Group'
					}
				}
			},
			traces: [
				{
					data: barData,
					type: 'bar',
					x: 'name',
					y: 'branch1',
					title: "Branch 1",
					style: barStyle
				},
				{
					data: barData,
					type: 'bar',
					x: 'name',
					y: 'branch2',
					title: "Branch 2",
					style: barStyle
				}
			]
		})

		this.plots['stacked bar'] = this.makePart(PlotPart, {
			layout: {
				axes: {
					left: {
						...baseAxis,
						title: 'Value',
						tickFormat: '($0.[0]a)'
					},
					bottom: {
						...baseAxis,
						type: 'stack',
						title: 'Stack'
					}
				}
			},
			traces: [
				{
					data: barData,
					type: 'bar',
					x: 'name',
					y: 'branch1',
					title: "Branch 1",
					style: barStyle
				},
				{
					data: barData,
					type: 'bar',
					x: 'name',
					y: 'branch2',
					title: "Branch 2",
					style: barStyle
				}
			]
		})

	}

	makeDates() {

		// random walk time-based data
		let foo = 300
		let bar = 250
		const startDate = dayjs().subtract(1, 'year').add(this.intervalOffset, 'days')
		const dateData = Arrays.range(0, 52).map(i => {
			foo += (seededRandom(i+this.intervalOffset) - 0.5) * 100
			bar += (seededRandom(i+this.intervalOffset+100) - 0.5) * 100
			return {
				date: startDate.add(i, 'weeks').format(),
				foo: foo,
				bar: bar
			}
		})

		// compute the beginning of the year for an annotation
		const newYears = dayjs().startOf('year')
		const annStyle = {
			stroke: '#aaa', 
			strokeWidth: 1
		}

		const dateStyle = {
			strokeWidth: 2
		} as const

		const layout: PlotLayout = {
			axes: {
				left: {
					...baseAxis, 
					range: 'auto_zero',
					title: 'Value',
					tickFormat: '0.[0]',
					annotations: [{
						value: 0,
						style: annStyle
					}]
				},
				bottom: {
					...baseAxis,
					type: 'time',
					title: 'Date',
					tickMode: 'months',
					tickFormat: 'MMM',
					hoverFormat: 'MM/DD/YY',
					annotations: [{
						value: newYears.format('YYYY-MM-DD'),
						style: annStyle
					}]
				}
			}
		}

		const traces: PlotTrace<any>[] = [
			{
				data: dateData,
				type: 'scatter',
				x: 'date',
				y: 'foo',
				style: dateStyle
			},
			{
				data: dateData,
				type: 'scatter',
				x: 'date',
				y: 'bar',
				style: dateStyle
			}
		]

		if (this.plots['dates']) {
			this.plots['dates'].state = { layout, traces }
			this.plots['dates'].relayout()
		}
		else {
			this.plots['dates'] = this.makePart(PlotPart, {
				layout,
				traces
			})
		}
	}

}

Part.mount(
	App, "app", {}, {}
);
