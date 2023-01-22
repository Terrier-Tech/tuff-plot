import { PlotAxis } from "./axis"



export type PlotLayout = {
    pad?: number
    axes?: {
        left?: PlotAxis
        top?: PlotAxis
        right?: PlotAxis
        bottom?: PlotAxis
    }
    
}

const Defaults = {
    pad: 8
}

const PlotSides = ['top', 'bottom', 'left', 'right'] as const

export type PlotSide = typeof PlotSides[number]

const Layout = {
    PlotSides,
    Defaults
}

export default Layout