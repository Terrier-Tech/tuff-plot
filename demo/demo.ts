import * as arrays from "tuff-core/arrays"
import { Part, PartTag } from "tuff-core/parts"
import { PlotPart } from "../src/part"
import "./style.css"
import dayjs from "dayjs"

export class App extends Part<{}> {

	plots: Record<string,PlotPart> = {}

	lineData: {x: number, foo: number, bar: number}[] = []
	pointData: {x: number, baz: number}[] = []

	async init() {
		this.lineData = arrays.range(0, 100).map(i => {
			return {
				x: i/20,
				foo: Math.sin(i/20) * 1.5,
				bar: Math.cos(i/15)
			}
		})
		this.pointData = arrays.range(0, 100, 5).map(i => {
			return {
				x: i/20,
				baz: Math.cos(i / 12 - 2) * 1.25
			}
		})

		const baseAxis = {
			type: 'number' as const,
			range: 'auto' as const,
			tickLength: 10,
			gridStyle: {stroke: '#ffffff44', strokeWidth: 1}
		}

		const lineStyle = {
			strokeWidth: 2
		} as const

		this.plots['simple'] = this.makePart(PlotPart, {
			layout: {
				axes: {
					left: {...baseAxis, title: 'X'},
					bottom: {...baseAxis, title: 'Y'}
				}
			},
			traces: [
				{
					data: this.lineData,
					x: 'x',
					y: 'foo',
					style: lineStyle
				},
				{
					data: this.lineData,
					x: 'x',
					y: 'bar',
					style: lineStyle
				},
				{
					data: this.pointData,
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

		const barData = [
			{name: 'foo', branch1: 3, branch2: 2},
			{name: 'bar', branch1: 1.2, branch2: 4.5},
			{name: 'baz', branch1: 5.8, branch2: 3.2},
			{name: 'fab', branch1: 2.4, branch2: 1.3}
		]

		const barStyle = {
			strokeWidth: 2
		} as const
		this.plots['bar'] = this.makePart(PlotPart, {
			layout: {
				axes: {
					left: {...baseAxis, title: 'Group'},
					bottom: {
						...baseAxis,
						type: 'group',
						title: 'Value'
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


		// random walk time-based data
		let foo = 0
		let bar = 0
		const dateData = arrays.range(0, 60).map(i => {
			return {
				date: dayjs().add(i, 'days').format(),
				foo: foo + (Math.random()-0.25),
				bar: bar + (Math.random()-0.75)
			}
		})

		const dateStyle = {
			strokeWidth: 2
		} as const

		this.plots['date'] = this.makePart(PlotPart, {
			layout: {
				axes: {
					left: {...baseAxis, title: 'Value'},
					bottom: {
						...baseAxis,
						type: 'time',
						title: 'Date'
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


		this.dirty()
	}

	render(parent: PartTag) {
		parent.h1({ text: "Tuff Plot" })
		for (const [key, plot] of Object.entries(this.plots)) {
			parent.h2({text: key})
			parent.part(plot)
		}
	}

}

Part.mount(
	App, "app", {}, {}
);
