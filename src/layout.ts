import { PlotAxis } from "./axis"



export type PlotLayout = {
    axes?: {
        top?: PlotAxis
        bottom?: PlotAxis
        left?: PlotAxis
        right?: PlotAxis
    }
    
}