import Arrays from "tuff-core/arrays"
import { Part, PartTag } from "tuff-core/parts"
import { PlotPart } from "../src/part"
import "./style.css"
import dayjs from "dayjs"

const baseAxis = {
	type: 'number' as const,
	range: 'auto' as const,
	tickLength: 10,
	gridStyle: {stroke: '#ffffff44', strokeWidth: 1}
}

const lineStyle = {
	strokeWidth: 2
} as const

export class App extends Part<{}> {

	plots: Record<string,PlotPart> = {}

	async init() {

		this.makeSimple()

		this.makeBar()

		this.makeDates()

		this.dirty()
	}

	render(parent: PartTag) {
		parent.h1({ text: "Tuff Plot" })
		for (const [key, plot] of Object.entries(this.plots)) {
			parent.h2({text: key})
			parent.part(plot)
		}
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
					left: {...baseAxis, title: 'X'},
					bottom: {...baseAxis, title: 'Y'}
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
					style: lineStyle
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
			{name: 'baz', branch1: 5800, branch2: 3200},
			{name: 'fab', branch1: 2400, branch2: 1300}
		]

		const barStyle = {
			strokeWidth: 2
		} as const
		this.plots['bar'] = this.makePart(PlotPart, {
			layout: {
				axes: {
					left: {
						...baseAxis,
						title: 'Value',
						tickFormat: '($0a)'
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
					style: barStyle
				},
				{
					data: barData,
					type: 'bar',
					x: 'name',
					y: 'branch2',
					style: barStyle
				}
			]
		})

	}

	makeDates() {
		// random walk time-based data
		let foo = 0
		let bar = 0
		const dateData = Arrays.range(0, 60).map(i => {
			foo += (Math.random() - 0.5)
			bar += (Math.random() - 0.5)
			return {
				date: dayjs().add(i, 'days').format(),
				foo: foo,
				bar: bar
			}
		})

		const dateStyle = {
			strokeWidth: 2
		} as const

		this.plots['dates'] = this.makePart(PlotPart, {
			layout: {
				axes: {
					left: {...baseAxis, title: 'Value'},
					bottom: {
						...baseAxis,
						type: 'time',
						title: 'Date',
						tickFormat: 'MM/DD/YY'
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
