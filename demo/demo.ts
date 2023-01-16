import { arrays } from "tuff-core"
import { Part, PartTag } from "tuff-core/parts"
import { PlotPart } from "../src/part"
import "./style.css"

export class App extends Part<{}> {

	plots: Record<string,PlotPart> = {}

	lineData: {x: number, foo: number, bar: number}[] = []

	async init() {
		this.lineData = arrays.range(0, 100).map(i => {
			return {
				x: i/10,
				foo: Math.sin(i/20) * 1.5,
				bar: Math.cos(i/15),
				baz: Math.cos(i/12-2) * 1.25
			}
		})

		const simpleStyle = {
			strokeWidth: 2
		} as const
		this.plots['simple'] = this.makePart(PlotPart, {
			layout: {},
			traces: [
				{
					key: 'foo',
					data: this.lineData,
					x: 'x',
					y: 'foo',
					style: simpleStyle
				},
				{
					key: 'bar',
					data: this.lineData,
					x: 'x',
					y: 'bar',
					style: simpleStyle
				},
				{
					key: 'baz',
					data: this.lineData,
					x: 'x',
					y: 'baz',
					style: simpleStyle
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
