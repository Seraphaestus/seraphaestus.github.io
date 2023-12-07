// Run everything inside window load event handler, to make sure
// DOM is fully loaded and styled before trying to manipulate it,
// and to not mess up the global scope. We are giving the event
// handler a name (setupWebGL) so that we can refer to the
// function object within the function itself.
window.addEventListener("load", setup, {once: true});

const tokenRegex = /\w+/g
const dictionary = [
	{from: "COLOR", to: "gl_FragColor"},
	{from: "PI",  to: "3.14159"},
	{from: "TAU", to: "6.28319"},
	{from: "float", prepend: "mediump ", on_declare_var: true},
	{from: "vec2",  prepend: "mediump ", on_declare_var: true},
	{from: "vec3",  prepend: "mediump ", on_declare_var: true},
	{from: "vec4",  prepend: "mediump ", on_declare_var: true},
]

const dictionary_depr = [
	{regex: /\bCOLOR\b/g,          from: "COLOR", to: "gl_FragColor"},
	{regex: /\bfloat +(\w)+ *=/g,  from: "float", to: "mediump float"},
	{regex: /\bvec2 +(\w)+ *=/g,   from: "vec2",  to: "mediump vec2"},
	{regex: /\bvec3 +(\w)+ *=/g,   from: "vec3",  to: "mediump vec3"},
	{regex: /\bvec4 +(\w)+ *=/g,   from: "vec4",  to: "mediump vec4"},
	{regex: /\bPI\b/g,          from: "PI", to: "3.14159"},
	{regex: /\bTAU\b/g,          from: "TAU", to: "6.28319"},
]

let targetCanvas
let editableCanvas

const targetImageShader =
	"void main() {" +
	"	COLOR = vec4(UV, 1.0, 1.0);" +
	"}";

function setup(event) {
	"use strict";
	
	const paragraph = document.querySelector("p")
	targetCanvas   = new ShadeableCanvas(document.querySelector("#target-canvas"), paragraph);
	editableCanvas = new ShadeableCanvas(document.querySelector("#editable-canvas"), paragraph);
	
	updateCanvas(targetCanvas, targetImageShader, false)
}

function updateCanvas(canvas, source, check_similarity = true) {
	const errorLog = canvas.updateShader(convertSource(source))
	document.querySelector("p").innerHTML = errorLog ?? "Postcard Caption x";
	
	if (check_similarity) {
		//
	}
}

function drag(event) {
	console.info(event)
	editableCanvas.canvas.style.top = event.offsetY
}

function replaceSubstring(string, start, end, from, to) {
	return string.substring(0, start) + string.substring(start, end).replace(from, to) + string.substring(end)
}

// Pass over source code to convert custom tokens to valid GLSL
function convertSource(source) {
	var instancesToReplace = []
	for (const token of source.matchAll(tokenRegex)) {
		for (const replacement of dictionary) {
			if (token[0] != replacement.from) continue
			if (replacement.on_declare_var && source.substr(token.index).search(new RegExp(token[0] + " +")) != 0) continue
			instancesToReplace.push({start:token.index, end:token.index+replacement.from.length, replacement:replacement})
		}
	}
	
	var offset = 0
	for (const toReplace of instancesToReplace) {
		const initial_length = source.length
		const replacement = toReplace.replacement.to ?? (toReplace.replacement.prepend + toReplace.replacement.from)
		source = replaceSubstring(source, toReplace.start + offset, toReplace.end + offset, toReplace.replacement.from, replacement)
		offset += (source.length - initial_length)
	}
	
	return source
}