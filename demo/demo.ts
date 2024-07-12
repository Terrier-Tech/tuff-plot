import Arrays from "tuff-core/arrays"
import { Part, PartTag } from "tuff-core/parts"
import { PlotPart } from "../src/part"
import "./demo.css"
import dayjs from "dayjs"

const baseAxis = {
	type: 'number' as const,
	range: 'auto' as const,
	tickLength: 6
}

const lineStyle = {
	strokeWidth: 2
} as const

export class App extends Part<{}> {

	plots: Record<string,PlotPart> = {}

	async init() {

		this.makeSimple()

		this.makeDates()

		this.makeBar()

		this.dirty()
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
			return {
				x: i / 20,
				foo: Math.sin(i / 20) * 1.5,
				bar: Math.cos(i / 15)
			}
		})

		const pointData = Arrays.range(0, 100, 5).map(i => {
			return {
				x: i / 20,
				baz: Math.cos(i / 12 - 2) * 1.25
			}
		})

		this.plots['simple'] = this.makePart(PlotPart, {
			layout: {
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
			},
			traces: [
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
		})
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
		let foo = 0
		let bar = 0
		const startDate = dayjs().subtract(1, 'year')
		const dateData = Arrays.range(0, 52).map(i => {
			foo += (Math.random() - 0.5) * 100
			bar += (Math.random() - 0.5) * 100
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

		this.plots['dates'] = this.makePart(PlotPart, {
			layout: {
				axes: {
					left: {...baseAxis, 
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
			},
			traces: [
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
		})
	}

}

Part.mount(
	App, "app", {}, {}
);
