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
				foo: Math.sin(i/10) * 1.5,
				bar: Math.cos(i/20)
			}
		})

		this.plots['simple'] = this.makePart(PlotPart, {
			layout: {},
			traces: [
				{
					key: 'foo',
					data: this.lineData,
					x: 'x',
					y: 'foo',
					style: {
						strokeWidth: 2
					}
				},
				{
					key: 'bar',
					data: this.lineData,
					x: 'x',
					y: 'bar',
					style: {
						strokeWidth: 2
					}
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
