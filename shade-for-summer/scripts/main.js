// Run everything inside window load event handler, to make sure
// DOM is fully loaded and styled before trying to manipulate it,
// and to not mess up the global scope. We are giving the event
// handler a name (setupWebGL) so that we can refer to the
// function object within the function itself.
window.addEventListener("load", setup, {once: true});

const tokenRegex = /\w+/g
const uniformRegex = /uniform(\s)+(\w+)(\s)+(\w+)/g
const error_dictionary = [
	{from: "gl_FragColor", to: "COLOR"},
]

const fragmentSourcePrepend =
	"#define COLOR gl_FragColor\n" +
	"#define UV RATIO\n" +
	"#define PI  3.14159265359\n" +
	"#define TAU 6.28318530718\n" +
	"#define E   2.71828182846\n" +
	"precision mediump float;\n" +
	"varying mediump vec2 RATIO;\n" +
	"varying mediump vec2 COORD;\n" +
	"uniform float TIME;\n";
const fragmentSourcePrependLineCount = 9;

let uniformValues = {}

let codeJar
let editor
let targetCanvas
let editableCanvas

let doUpdateTime = true
let updateTimer
const initialTime = Date.now()
let time

const uvShader =
	"void main() {" +
	"	COLOR = vec4(RATIO, 1.0, 0.5);" +
	"}";
const cakeShader =
	"const float plate_size = 0.95;const vec3 bg_color = vec3(122.0, 58.0, 51.0) / 255.0;const vec3 cake_color = vec3(238.0, 161.0, 73.0) / 255.0;const float cake_size = 0.7;const float cake_rotation = 0.125;const float cake_height = 0.2;const bool do_perspective = true;const float antialiasing = 0.1;float antialiased_step(float a, float b) {return smoothstep(b * (1.0 - antialiasing * 0.1), b * (1.0 + antialiasing * 0.1), a);}float in_circle(vec2 uv, vec2 center, float radius) {return antialiased_step(radius, distance(uv, center));}float in_segment(vec2 uv, vec2 center, float radius, float rotation, float size) {float angle = mod(atan(uv.y - center.y, uv.x - center.x) + rotation * TAU, TAU);return in_circle(uv, center, radius) * antialiased_step(angle, TAU / 6.0) * antialiased_step(TAU / 6.0 + TAU / 9.0, angle);}void main() {gl_FragColor.a = 1.0;vec2 uv = COORD;if (do_perspective) uv.y = (uv.y - 0.5) * 1.25 + 0.5;COLOR.rgb = mix(bg_color, vec3(1.0), in_circle(uv, vec2(0.5), plate_size / 2.0));gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.95), in_circle(uv, vec2(0.5), 0.8 * plate_size / 2.0));const float layers = 64.0;vec2 cake_offset = vec2(0.125);for (float i = 0.0; i < layers; i += 1.0) {gl_FragColor.rgb = mix(gl_FragColor.rgb, cake_color * 0.8, in_segment(uv + cake_offset, vec2(0.5, 0.5 + i * cake_height / layers), cake_size * plate_size / 2.0, cake_rotation, cake_size));}gl_FragColor.rgb = mix(gl_FragColor.rgb, cake_color, in_segment(uv + cake_offset, vec2(0.5, 0.5 + cake_height), cake_size * plate_size / 2.0, cake_rotation, cake_size));}"
const targetImageShader = cakeShader;



function setup(event) {
	"use strict";
	
	const paragraph = document.querySelector("p");
	editor = document.querySelector(".editor");
	targetCanvas   = new ShadeableCanvas(document.querySelector("#target-canvas"), paragraph, false);
	editableCanvas = new ShadeableCanvas(document.querySelector("#editable-canvas"), paragraph);
	
	updateCanvas(targetCanvas, targetImageShader, false);
	updateCanvas(editableCanvas, codeJar.toString(), false);
	
	// UpdateCanvas parses the source and creates uniform handles, we can now load values and set them
	const loadedUniformValues = JSON.parse(localStorage.getItem('uniforms')) ?? {};
	console.log("Loaded uniforms:", loadedUniformValues);
	for (let varName in loadedUniformValues) {
		updateOrCreateEntry(uniformValues, varName, loadedUniformValues[varName]);
		const uniformInput = document.querySelector(`#${varName}`)
		if (uniformInput) {
			setUniformInputValue(uniformInput, uniformValues[varName].htmlValue)
		}
	}
	editableCanvas.redrawShader();
	
	updateTimer = setInterval(update, 50);
	
	const canvasViewToggle = document.querySelector("#canvas-view-toggle")
	const canvasViewSlider = document.querySelector("#canvas-view-slider");
	const updateFromSlider = function(top, bottom, value) {
		const canvasHeight = 16.0 + 2.2;
		top.style["margin-top"] = `${value * canvasHeight / 2.0}em`;
		bottom.style["margin-top"] = `${-value * canvasHeight}em`;
	}
	canvasViewToggle.oninput = function() {
		const advancedMode = canvasViewToggle.checked;
		canvasViewSlider.style.visibility = advancedMode ? "visible" : "hidden";
		for (let easel of document.querySelectorAll(".easel")) {
			easel.style.visibility = advancedMode ? "hidden" : "visible";
		}
		
		const postcard = document.querySelector("#postcard")
		postcard.style.rotate = advancedMode ? "0deg" : "5deg";
		editableCanvas.canvas.style.scale = advancedMode ? "100%" : "87.5%";
		editableCanvas.canvas.style.background = advancedMode ? "none" : "white";
		
		const editableCanvasArea = document.querySelector("#editable-canvas-area")
		editableCanvasArea.style.translate = advancedMode ? "0 0em" : "0 -1em";
		updateFromSlider(postcard, editableCanvasArea, advancedMode ? canvasViewSlider.value / 100.0 : 0.0);
	}
	canvasViewSlider.oninput = function() {
		const postcard = document.querySelector("#postcard")
		const editableCanvasArea = document.querySelector("#editable-canvas-area")
		updateFromSlider(postcard, editableCanvasArea, canvasViewSlider.value / 100.0);
	}
	
	console.log("Initialized");
}

function update() {
	if (!editableCanvas.program || !doUpdateTime) return
	
	time = (Date.now() - initialTime) / 1000.0;
	editableCanvas.redrawShader();
}

function updateCanvas(canvas, source, check_similarity = true) {
	const validSource = fragmentSourcePrepend + source;
	createCustomUniformInput(validSource);
	const errorLog = canvas.recreateShader(validSource);
	const noErrors = handleCompileErrors(canvas, source, errorLog)
	if (noErrors && check_similarity) {
		//
	}
}

function formatVarName(varName) {
	return varName.replace("_", " ");
}

function updateOrCreateEntry(object, key, toUpdate) {
	if (!(key in object)) {
		object[key] = toUpdate;
	} else {
		for (id in toUpdate) {
			object[key][id] = toUpdate[id];
		}
	}
}

function createCustomUniformInput(source) {
	for (let uniformInputContainer of document.querySelectorAll(".uniform-input")) {
		const uniformInput = uniformInputContainer.firstElementChild;
		
		const varName = uniformInputContainer.getAttribute("id");
		updateOrCreateEntry(uniformValues, varName, {htmlValue: getUniformInputValue(uniformInput)})
		uniformInputContainer.remove();
	}
	
	for (let uniform of source.matchAll(uniformRegex)) {
		const type = uniform[2];
		const varName = uniform[4];
		if (varName == "TIME") continue;
		let callback = null;
		let attributes = null;
		switch (type) {
			case "bool":
				attributes = {id: varName, type: "checkbox"}
				callback = function() {
					updateOrCreateEntry(uniformValues, varName, {htmlValue: this.checked, shaderValue: [this.checked ? 1.0 : 0.0]})
					saveUniformValues();
					if (editableCanvas.program) {
						editableCanvas.webGL.uniform1f(editableCanvas.webGL.getUniformLocation(editableCanvas.program, varName), this.checked ? 1.0 : 0.0);
						editableCanvas.redrawShader();
					}
				}
				break;
			case "float":
				attributes = {id: varName, type: "range", min: "0", max: "100", value: "0", style: "flex-grow: 1;"}
				callback = function() {
					updateOrCreateEntry(uniformValues, varName, {htmlValue: this.value, shaderValue: [this.value / 100.0]})
					saveUniformValues();
					if (editableCanvas.program) {
						editableCanvas.webGL.uniform1f(editableCanvas.webGL.getUniformLocation(editableCanvas.program, varName), this.value / 100.0);
						editableCanvas.redrawShader();
					}
				}
				break;
			case "vec3":
				attributes = {id: varName, type: "color", style: "flex-grow: 1;"}
				callback = function() {
					const color = hexToRgb(this.value);
					updateOrCreateEntry(uniformValues, varName, {htmlValue: this.value, shaderValue: [color.r, color.g, color.b]})
					saveUniformValues();
					if (editableCanvas.program) {
						editableCanvas.webGL.uniform3f(editableCanvas.webGL.getUniformLocation(editableCanvas.program, varName), color.r, color.g, color.b);
						editableCanvas.redrawShader();
					}
				}
				break;
		}
		if (callback) {
			let div = document.createElement("label");
			div.setAttribute("class", "uniform-input unselectable");
			div.setAttribute("for", varName);
			document.querySelector("#uniform-area").appendChild(div);
			const formattedVarName = formatVarName(varName);
			div.innerHTML = `${formattedVarName}:&nbsp;`;
			let uniformInput = document.createElement("input");
			for (let attributeID in attributes) {
				uniformInput.setAttribute(attributeID, attributes[attributeID]);
			}
			div.appendChild(uniformInput);
			
			if (varName in uniformValues) {
				setUniformInputValue(uniformInput, uniformValues[varName].htmlValue)
			}
			
			uniformInput.oninput = callback;
		}
	}
}

function getUniformInputValue(uniformInput) {
	if (uniformInput.getAttribute("type") == "checkbox") 
		return uniformInput.checked
	return uniformInput.value
}

function setUniformInputValue(uniformInput, value) {
	if (uniformInput.getAttribute("type") == "checkbox") {
		uniformInput.checked = value;
	} else {
		uniformInput.value = value;
	}
}

function saveUniformValues() {
	// First remove any uniforms which are set to default values
	let strippedUniformValues = {}
	for (varName in uniformValues) {
		let v = uniformValues[varName].htmlValue;
		if (v == "0" || v == "#000000" || v == "false") continue;
		
		strippedUniformValues[varName] = uniformValues[varName];
	}
	//
	localStorage.setItem('uniforms', JSON.stringify(strippedUniformValues));
}

function handleCompileErrors(canvas, source, errorLog) {
	for (let errorHTML of document.querySelectorAll(".error")) {
		errorHTML.remove()
	}
	
	if (!errorLog) return true;
	
	console.log("Canvas:", canvas, " Error:", errorLog);
	
	let errors = errorLog.split("\n");
	for (let error of errors) {
		let parts = error.split(" ");
		let lineNumber = parseInt(parts[1].split(":")[1]) - fragmentSourcePrependLineCount;
		let message = parts.slice(2).join(" ");
		message = replaceTokensFromDictionary(message, error_dictionary);
		message = `Line ${lineNumber}: ${message}`;
		// position:absolute; top:${2.2 + 1.075 * (lineNumber + 1)}em; left:37em; 
		editor.insertAdjacentHTML('afterend', `<span class="error unselectable overlay">${message}</span>`);
		return false;
	}
	return true;
}

function replaceTokensFromDictionary(string, dictionary) {
	let instancesToReplace = []
	for (const token of string.matchAll(tokenRegex)) {
		for (const replacement of dictionary) {
			if (token[0] != replacement.from) continue
			if (replacement.on_declare_var && string.substr(token.index).search(new RegExp(token[0] + " +")) != 0) continue
			instancesToReplace.push({start:token.index, end:token.index+replacement.from.length, replacement:replacement})
		}
	}
	
	let offset = 0
	for (const toReplace of instancesToReplace) {
		const initial_length = string.length
		const replacement = toReplace.replacement.to ?? (toReplace.replacement.prepend + toReplace.replacement.from)
		string = replaceSubstring(string, toReplace.start + offset, toReplace.end + offset, toReplace.replacement.from, replacement)
		offset += (string.length - initial_length)
	}
	
	return string
}

function replaceSubstring(string, start, end, from, to) {
	return string.substring(0, start) + string.substring(start, end).replace(from, to) + string.substring(end)
}

// https://stackoverflow.com/questions/5623838/rgb-to-hex-and-hex-to-rgb
function hexToRgb(hex) {
  let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16) / 256.0,
    g: parseInt(result[2], 16) / 256.0,
    b: parseInt(result[3], 16) / 256.0
  } : null;
}