window.addEventListener("load", setup, {once: true});

const tokenRegex = /\w+/g
//const uniformRegex = /uniform\s+(?<type>\w+)\s+(?<name>\w+)/g	// Basic uniform regex without any type hints
const uniformRegex = /uniform\s+(?<type>\w+)\s+(?<name>\w+)\s*(?<hints>(?:#(?:range\((?:-?\s*[0-9]+\.?[0-9]*\s*,\s*){1,2}(?:-?\s*[0-9]+\.?[0-9]*\s*)\)|color|ignore|display)\s*)*);/g
const error_dictionary = [
	{from: "gl_FragColor", to: "COLOR"},
	{from: "RATIO", to: "RATIO/UV"},
	{from: "mix", to: "mix/lerp"},
]

const rangeableUniformTypes = ["float", "vec2", "vec3", "vec4", "int", "ivec2", "ivec3", "ivec4"];

const fragmentSourcePrepend = [
	"precision mediump float;",
	"#define COLOR gl_FragColor",
	"#define UV RATIO",
	"#define PI  3.14159265359",
	"#define TAU 6.28318530718",
	"#define E   2.71828182846",
	"#define lerp mix",
	"#define steps(a, b, c) step(a, b) * step(b, c)",
	"#define placeSticker place_sticker",
	"#define place_sticker(texture, uv) COLOR = overlay(COLOR, texture2D(texture, uv), steps(0.0, (uv).x, 1.0) * steps(0.0, (uv).y, 1.0))",
	"varying mediump vec2 RATIO;",
	"varying mediump vec2 COORD;",
	"uniform float TIME #ignore;",
	"vec4 overlay(vec4 color1, vec4 color2) { return mix(color1, color2, color2.a); }",
	"vec4 overlay(vec4 color1, vec4 color2, float m) { return mix(color1, color2, color2.a * m); }",
];
let fragmentSourcePrependLineCount;
let fragmentSourcePrependString = "";

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
const targetImageShaders = {
	"1": {stickers: {sticker: "stamp.png"}, targetCode: "const float plate_size = 0.95;const vec3 bg_color = vec3(122.0, 58.0, 51.0) / 255.0;const vec3 cake_color = vec3(238.0, 161.0, 73.0) / 255.0;const float cake_size = 0.7;const float cake_rotation = 0.125;const float cake_height = 0.2;const bool do_perspective = true;const float antialiasing = 0.1;float antialiased_step(float a, float b) {return smoothstep(b * (1.0 - antialiasing * 0.1), b * (1.0 + antialiasing * 0.1), a);}float in_circle(vec2 uv, vec2 center, float radius) {return antialiased_step(radius, distance(uv, center));}float in_segment(vec2 uv, vec2 center, float radius, float rotation, float size) {float angle = mod(atan(uv.y - center.y, uv.x - center.x) + rotation * TAU, TAU);return in_circle(uv, center, radius) * antialiased_step(angle, TAU / 6.0) * antialiased_step(TAU / 6.0 + TAU / 9.0, angle);}void main() {gl_FragColor.a = 1.0;vec2 uv = COORD;if (do_perspective) uv.y = (uv.y - 0.5) * 1.25 + 0.5;COLOR.rgb = mix(bg_color, vec3(1.0), in_circle(uv, vec2(0.5), plate_size / 2.0));gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.95), in_circle(uv, vec2(0.5), 0.8 * plate_size / 2.0));const float layers = 64.0;vec2 cake_offset = vec2(0.125);for (float i = 0.0; i < layers; i += 1.0) {gl_FragColor.rgb = mix(gl_FragColor.rgb, cake_color * 0.8, in_segment(uv + cake_offset, vec2(0.5, 0.5 + i * cake_height / layers), cake_size * plate_size / 2.0, cake_rotation, cake_size));}gl_FragColor.rgb = mix(gl_FragColor.rgb, cake_color, in_segment(uv + cake_offset, vec2(0.5, 0.5 + cake_height), cake_size * plate_size / 2.0, cake_rotation, cake_size));}"},
}
let targetImageShader = null

function setup(event) {
	"use strict";
	
	// Dynamically set page title depending on the day
	const title = document.querySelector("head title");
	const day = (new URLSearchParams(location.search)).get("day");
	if (day in targetImageShaders) {
		title.textContent = title.textContent.replace("Title", "Day " + day);
		targetImageShader = targetImageShaders[day]
	} else {
		title.textContent = title.textContent.replace("Title", "Code Playground");
	}
	
	//
	for (let line of fragmentSourcePrepend) {
		fragmentSourcePrependString += line + "\n";
	}
	fragmentSourcePrependLineCount = fragmentSourcePrepend.length;
	
	// Init canvases
	const paragraph = document.querySelector("p");
	editor = document.querySelector(".editor");
	const stickers = targetImageShaders[day].stickers ?? {};
	if (targetImageShader != null) {
		targetCanvas = new ShadeableCanvas(document.querySelector("#target-canvas"), paragraph, false);
		
		let targetCode = ""
		for (let stickerName in stickers) {
			fragmentSourcePrependString += `uniform sampler2D ${stickerName} #display;\n`;
			fragmentSourcePrependLineCount++;
		}
		targetCode += targetImageShaders[day].targetCode;
		updateCanvas(targetCanvas, targetCode, false, false);
		
		for (let stickerName in stickers) {
			targetCanvas.setSamplerUniform(stickerName, stickers[stickerName]);
		}
	}
	editableCanvas = new ShadeableCanvas(document.querySelector("#editable-canvas"), paragraph);
	updateCanvas(editableCanvas, codeJar.toString(), true, false);
	for (let stickerName in stickers) {
		editableCanvas.setSamplerUniform(stickerName, stickers[stickerName]);
	}
	
	// UpdateCanvas parses the source and creates uniform handles, we can now load values and set them
	const loadedUniformValues = JSON.parse(localStorage.getItem('uniforms')) ?? {};
	//console.log("Loaded uniforms:", loadedUniformValues);
	for (let varName in loadedUniformValues) {
		updateOrCreateEntry(uniformValues, varName, loadedUniformValues[varName]);
		const uniformInput = document.querySelector(`[for=${varName}]`)
		if (!uniformInput) continue;
		for (let i = 0; i < Math.min(uniformInput.children.length, uniformValues[varName].htmlValues.length); i++) {
			setInputValue(uniformInput.children[i], uniformValues[varName].htmlValues[i])
		}
	}
	editableCanvas.redrawShader();
	
	updateTimer = setInterval(update, 50);
	
	const canvasViewToggle = document.querySelector("#canvas-view-toggle")
	const canvasViewSlider = document.querySelector("#canvas-view-slider");
	if (targetImageShader != null) {
		// On pressing the toggle button to enable/disable advanced mode (showing the below slider)
		canvasViewToggle.oninput = function() {
			const advancedMode = canvasViewToggle.checked;
			canvasViewSlider.style.visibility = advancedMode ? "visible" : "hidden";
			for (let easel of document.querySelectorAll(".easel")) {
				easel.style.visibility = advancedMode ? "hidden" : "visible";
			}
			
			const postcard = document.querySelector("#postcard");
			postcard.style.rotate = advancedMode ? "0deg" : "5deg";
			editableCanvas.canvas.style.scale = advancedMode ? "100%" : "87.5%";
			
			const editableCanvasArea = document.querySelector("#editable-canvas-area");
			editableCanvasArea.style.translate = advancedMode ? "0 0em" : "0 -1em";
			updateFromViewSlider(postcard, editableCanvasArea, advancedMode ? canvasViewSlider.value / 100.0 : 0.0);
		}
		// On moving the slider
		canvasViewSlider.oninput = function() {
			const postcard = document.querySelector("#postcard");
			const editableCanvasArea = document.querySelector("#editable-canvas-area");
			updateFromViewSlider(postcard, editableCanvasArea, canvasViewSlider.value / 100.0);
		}
	} else {
		canvasViewToggle.parentElement.parentElement.style.visibility = "hidden";
		const postcard = document.querySelector("#postcard");
		const editableCanvasArea = document.querySelector("#editable-canvas-area");
		postcard.style.visibility = "hidden";
		updateFromViewSlider(postcard, editableCanvasArea, 1.0);
	}
	console.log("Initialized");
}

function update() {
	if (!editableCanvas.program || !doUpdateTime) return
	
	time = (Date.now() - initialTime) / 1000.0;
	editableCanvas.redrawShader();
}

function updateCanvas(canvas, source, createUniformInputs = false, check_similarity = true) {
	let validSource = fragmentSourcePrependString + source;
	validSource = createCustomUniformInput(validSource, createUniformInputs);
	const errorLog = canvas.recreateShader(validSource);
	const noErrors = handleCompileErrors(canvas, source, errorLog)
	if (noErrors && check_similarity) {
		// TODO
	}
}

function updateFromViewSlider(top, bottom, value) {
	const canvasHeight = 16.0 + 2.2;
	top.style["margin-top"] = `${value * canvasHeight / 2.0}em`;
	bottom.style["margin-top"] = `${-value * canvasHeight}em`;
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

function createCustomUniformInput(source, createInputs = true) {
	if (createInputs) {
		// Remove existing HTML inputs
		for (let uniformInputContainer of document.querySelectorAll(".uniform-input")) {
			const varName = uniformInputContainer.getAttribute("for");
			let htmlValues = []
			for (let i = 0; i < uniformInputContainer.children.length; i++) {
				const uniformInput = uniformInputContainer.children[i];
				htmlValues.push(getInputValue(uniformInput));
			}
			updateOrCreateEntry(uniformValues, varName, {htmlValues: htmlValues});
			uniformInputContainer.remove();
		}
	}
	
	const uniformArea = document.querySelector("#uniform-area");
	let validSource = source;
	let indexOffset = 0;
	for (let uniform of source.matchAll(uniformRegex)) {
		const type = uniform.groups.type;
		const varName = uniform.groups.name;
		let hints = uniform.groups.hints;
		
		// Remove the custom uniform hints from the source code so it doesn't error, and extract the actual hint data
		if (hints != "") {
			const hintsIndex = uniform.index + indexOffset + uniform[0].indexOf(hints);
			validSource = validSource.slice(0, hintsIndex) + validSource.slice(hintsIndex + hints.length);
			indexOffset -= hints.length;
			
			const hints_copy = hints.replace(" ", "").split("#").filter(n => n);
			hints = {}
			for (hint of hints_copy) {
				const parts = hint.split("(");
				if (parts.length == 1) {
					hints[parts[0]] = null;
				} else {
					hints[parts[0]] = parts[1].replace(")", "").split(",").map(s => s.replace(" ", ""));
				}
			}
		} else {
			hints = {}
		}
		
		if ("ignore" in hints || !createInputs) continue;
		
		// Add HTML inputs for uniform, e.g. 1 checkbox for a bool uniform, 2 ranges for a vec2 uniform, 1 color + 1 range for a vec4 #color uniform
		if (type == "sampler2D" && "display" in hints) {
			const attributes = {id: varName, type: "button", style: "min-width: 80px"};
			const callback = function(inputs) {
				const code = codeJar.toString();
				const codeToInsert = `place_sticker(${varName}, COORD);`;
				try {
					const cursorPos = codeJar.save().start;
					if (cursorPos < code.length) {
						codeJar.updateCode(code.slice(0, cursorPos) + codeToInsert + code.slice(cursorPos));
						return
					}
				} catch(e) {}
				const mainMatch = code.match(/void\s+main\s*\(\s*\)\s*{/);
				const cursorPos = mainMatch.index + mainMatch[0].length;
				codeJar.updateCode(code.slice(0, cursorPos) + "\n\t" + codeToInsert + code.slice(cursorPos));
			}
			createUniformInput(uniformArea, varName, [attributes], callback);
		} else if (type == "bool") {
			const attributes = {id: varName, type: "checkbox", style: "scale: 1.2;"};
			const callback = function(inputs) {
				const checked = inputs[0].checked;
				updateOrCreateEntry(uniformValues, varName, {htmlValues: [checked], shaderValue: [checked ? 1.0 : 0.0], isFloat: true})
				saveUniformValues();
				if (editableCanvas.program) {
					editableCanvas.webGL.uniform1f(editableCanvas.webGL.getUniformLocation(editableCanvas.program, varName), checked ? 1.0 : 0.0);
					editableCanvas.redrawShader();
				}
			}
			createUniformInput(uniformArea, varName, [attributes], callback);
		} else if (rangeableUniformTypes.includes(type)) {
			let min = 0.0, max = 1.0, step = 0.01;
			if ("range" in hints) {
				min = hints.range[0];
				max = hints.range[1];
				if (hints.range.length > 2) step = hints.range[2];
			}
			
			let isFloat = (type.slice(0, 1) != "i");
			if (!isFloat) step = Math.ceil(step);
			let size = isNaN(type.slice(-1)) ? 1 : parseInt(type.slice(-1));
			let attributesArray = []
			if (size >= 3 && "color" in hints) {
				attributesArray.push({id: varName + ".xyz", type: "color", style: "flex-grow: 1;"});
				if (size == 4) attributesArray.push({id: varName + ".w", type: "range", min: min, max: max, step: step, value: "0", style: "flex-grow: 1; max-width: 100px"});
			} else {
				const width = 155 - 25 * size;
				for (let i = 1; i <= size; i++) {
					let component = (i == 1) ? "x" : (i == 2) ? "y" : (i == 3) ? "z" : "w";
					attributesArray.push({id: `${varName}.${component}`, type: "range", min: min, max: max, step: step, value: "0", style: `flex-grow: 1; max-width: ${width}px`});
				}
			}
			const callback = function(inputs) {
				let components = []
				if (inputs[0].type == "color") {
					const color = hexToRgb(inputs[0].value);
					components.push(color.r);
					components.push(color.g);
					components.push(color.b);
					if (inputs.length > 1) components.push(inputs[1].value);
				} else {
					components = inputs.map(i => i.value);
				}
				
				updateOrCreateEntry(uniformValues, varName, {htmlValues: inputs.map(i => i.value), shaderValue: components, isFloat: isFloat})
				saveUniformValues();
				if (editableCanvas.program) {
					editableCanvas.setVectorUniform(varName, components, isFloat);
					editableCanvas.redrawShader();
				}
			}
			createUniformInput(uniformArea, varName, attributesArray, callback);
		}
	}
	return validSource;
}

function createUniformInput(uniformArea, varName, attributesArray, callback) {
	let div = document.createElement("label");
	div.setAttribute("class", "uniform-input unselectable");
	div.setAttribute("for", varName);
	uniformArea.appendChild(div);
	const formattedVarName = formatVarName(varName);
	div.innerHTML = `${formattedVarName}:&nbsp;`;
	
	let uniformInputs = []
	for (let inputID = 0; inputID < attributesArray.length; inputID++) {
		const attributes = attributesArray[inputID];
		let input = document.createElement("input");
		for (let attributeID in attributes) {
			input.setAttribute(attributeID, attributes[attributeID]);
		}
		div.appendChild(input);
		uniformInputs.push(input);
		
		if (varName in uniformValues && uniformValues[varName].htmlValues) {
			setInputValue(input, uniformValues[varName].htmlValues[inputID])
		}
	}
	
	const boundCallback = callback.bind(null, uniformInputs);
	for (let input of uniformInputs) {
		if (input.type == "button") {
			input.onclick = boundCallback;
		} else {
			input.oninput = boundCallback;
		}
	}
}

function getInputValue(input) {
	if (input.getAttribute("type") == "checkbox") 
		return input.checked
	return input.value
}

function setInputValue(input, value) {
	if (input.getAttribute("type") == "checkbox") {
		input.checked = value;
	} else {
		input.value = value;
	}
}

function saveUniformValues() {
	// First remove any uniforms which are set to default values
	let strippedUniformValues = {}
	for (let varName in uniformValues) {
		if (uniformHasDefaultValue(varName)) continue;
		strippedUniformValues[varName] = uniformValues[varName];
	}
	//
	localStorage.setItem('uniforms', JSON.stringify(strippedUniformValues));
}

function uniformHasDefaultValue(varName) {
	for (let v of uniformValues[varName].htmlValues) {
		if (v == "0" || v == "#000000" || v == "false") continue;
		return false;
	}
	return true;
}

function handleCompileErrors(canvas, source, errorLog) {
	for (let errorHTML of document.querySelectorAll(".error")) {
		errorHTML.remove()
	}
	
	if (!errorLog) return true;
	
	//console.log("Canvas:", canvas, " Error:", errorLog);
	
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