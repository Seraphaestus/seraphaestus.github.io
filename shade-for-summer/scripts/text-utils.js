/**
  * Uses canvas.measureText to compute and return the position (top-left) of the given text of given font in pixels.
  * 
  * @param {String} text The text to be rendered.
  * @param {String} font The css font descriptor that text is to be rendered with (e.g. "bold 14px verdana").
  * 
  * @see https://stackoverflow.com/questions/118241/calculate-text-width-with-javascript/21015393#21015393
  
  * Usage: const fontSize = getTextWidth(text, getCanvasFont(element));
  */
function getTextWidth(text, font) {
	var metrics = getTextMetrics(text, font);
	return metrics.width;
}

function getTextPosition(text, font) {
	var metrics = getTextMetrics(text, font);
	return [metrics.actualBoundingBoxLeft, metrics.alphabeticBaseline + metrics.fontBoundingBoxAscent];
}

function getTextMetrics(text, font) {
	// re-use canvas object for better performance
	const canvas = getTextWidth.canvas || (getTextWidth.canvas = document.createElement("canvas"));
	const context = canvas.getContext("2d");
	context.font = font;
	return context.measureText(text);
}

function getCssStyle(element, prop) {
	return window.getComputedStyle(element, null).getPropertyValue(prop);
}

function getCanvasFont(element = document.body) {
	const fontWeight = getCssStyle(element, 'font-weight') || 'normal';
	const fontSize = getCssStyle(element, 'font-size') || '16px';
	const fontFamily = getCssStyle(element, 'font-family') || 'Times New Roman';
	
	return `${fontWeight} ${fontSize} ${fontFamily}`;
}


function getMaxLineWidth(font, text, maxWidth = 1000000) {
	const lines = text.split("\n")
	const longestLine = lines.sort((a, b) => { return b.length - a.length; })[0];
	return Math.min(maxWidth, getTextWidth(longestLine, font));
}