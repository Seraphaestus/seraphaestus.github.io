class PlotlyGraph {
	
	constructor(showLegend = false, title = null) {
		this.showLegend = showLegend;
		this.plots = [];
		this.style = {
			margin: {t: 0, l: 10, r: 10, b: 30},
		};
		if (title) this.style.title = title;
		this.yIndex = 1;
	}
	
	addPlot(trace) {
		if (this.yIndex > 1) trace.yaxis = `y${this.yIndex}`
		this.yIndex++
		this.plots.push(trace);
	}
	
	addHistogram(data, binSize, color, gridColor) {
		this.style[this.getYAxisKey()] = {
			showline: true,
			linecolor: gridColor,
			mirror: true,
			showticklabels: false,
			gridwidth: binSize,
		};
		
		if (!this.style.xaxis) this.style.xaxis = {}
		this.style.xaxis.showline = true;
		this.style.xaxis.showgrid = true;
		this.style.xaxis.gridcolor = gridColor;
		
		let tickVals = [];
		let tickText = [];
		for (let i = 0; i <= 1; i += binSize) {
			tickVals.push(i);
			const label = (i * 100 % 25 === 0) ? `${i}` : "";
			tickText.push(label);
		}
		this.style.xaxis.ticks = "outside";
		this.style.xaxis.tickmode = "array";
		this.style.xaxis.tickvals = tickVals;
		this.style.xaxis.ticktext = tickText;
		
		this.addPlot({
			x: data,
			type: "histogram",
			xbins: {start: 0, end: 1, size: binSize},
			marker: {color: color},
			showlegend: this.showLegend,
		});
	}
	
	addVerticalLine(xPos, color, width) {
		this.style[this.getYAxisKey()] = {
			fixedrange: true,
			range: [0, 1],
			visible: false,
			overlaying: 'y',
		};
		
		this.addPlot({
			x: [xPos, xPos],
			y: [0, 1],
			type: "scatter",
			mode: "lines",
			line: {color: color, width: width},
			showlegend: false,
		});
	}
	
	getYAxisKey() {
		return (this.yIndex === 1) ? "yaxis" : `yaxis${this.yIndex}`
	}
}