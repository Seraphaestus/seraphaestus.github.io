window.addEventListener("load", setup, {once: true});

const tokenRegex = /\w+/g
//const uniformRegex = /uniform\s+(?<type>\w+)\s+(?<name>\w+)/g	// Basic uniform regex without any type hints
const floatRegex = String.raw`-?\s*(?:[0-9]+\.?[0-9]*|[0-9]*\.[0-9]+)\s*`;
const rangeHintRegex = String.raw`range\((?:${floatRegex},\s*){1,2}(?:${floatRegex})\)`
const uniformRegex = new RegExp(String.raw`uniform\s+(?<type>\w+)\s+(?<name>\w+)\s*(?<hints>(?:#(?:${rangeHintRegex}|color|ignore|display)\s*)*);`, "g");

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

let updateTimer
const initialTime = Date.now()
let time
let codeUsesTime = false

const runningLocally = (window.location.protocol == "file:");

const uvShader =
	"void main() {" +
	"	COLOR = vec4(RATIO, 1.0, 0.5);" +
	"}";
const targetImageShaders = {
	"_": {stickers: {stamp: "stamp.png"}},
	"1": {caption: "Alright, all packed and ready to go! Wish me luck.", stickers: {friend:"2024/stickers/silhouette.png", van:"2024/stickers/van_side.png"}, targetCode: "const vec3 sky_color = vec3(219.0, 237.0, 255.0) / 255.0;const vec3 road_color = vec3(100.0) / 255.0;const vec3 building_color = vec3(244.0, 207.0, 144.0) / 255.0;const float top_cutoff = 0.85;const float bottom_cutoff = 0.15;void main(){COLOR.a=1.0;vec2 coord=(COORD-vec2(0.5))*vec2(0.8,1.15);COLOR.rgb=building_color;if(RATIO.y>top_cutoff){COLOR.rgb=sky_color;}if(RATIO.y<bottom_cutoff){COLOR.rgb=road_color;}place_sticker(van, COORD * vec2(1.55, 1.85) - vec2(1.0, 0.1));}"},
	"2": {caption: "Isn't she a beaut? I'm glad she'll finally see some proper use.", stickers: {van:"2024/stickers/van_front.png"}, targetCode: "const vec3 sky_color = vec3(219.0, 237.0, 255.0) / 255.0;const vec3 road_color = vec3(199.0) / 255.0;const vec3 building_color = vec3(244.0, 207.0, 144.0) / 255.0;const float top_cutoff = 0.94;const float bottom_cutoff = 0.07;void main(){COLOR.a=1.0;vec2 coord=(COORD-vec2(0.5))*vec2(0.8,1.15);if(abs(coord.x)>abs(coord.y)){COLOR.rgb=building_color;if(coord.x>-0.5&&coord.x<0.5){COLOR.rgb*=0.975;}if(RATIO.y>top_cutoff){COLOR.rgb=sky_color;}if(RATIO.y<bottom_cutoff){COLOR.rgb=road_color;}}else{COLOR.rgb=mix(road_color,sky_color,(sign(coord.y)+1.0)*0.5);}}"},
	"3": {caption: "Remember how we'd come here after school? It tastes like it was yesterday.", targetCode: "const float plate_size = 0.95;const vec3 bg_color = vec3(122.0, 58.0, 51.0) / 255.0;const vec3 cake_color = vec3(238.0, 161.0, 73.0) / 255.0;const float cake_size = 0.7;const float cake_rotation = 0.125;const float cake_height = 0.2;const bool do_perspective = true;const float antialiasing = 0.1;float antialiased_step(float a, float b) {return smoothstep(b * (1.0 - antialiasing * 0.1), b * (1.0 + antialiasing * 0.1), a);}float in_circle(vec2 uv, vec2 center, float radius) {return antialiased_step(radius, distance(uv, center));}float in_segment(vec2 uv, vec2 center, float radius, float rotation, float size) {float angle = mod(atan(uv.y - center.y, uv.x - center.x) + rotation * TAU, TAU);return in_circle(uv, center, radius) * antialiased_step(angle, TAU / 6.0) * antialiased_step(TAU / 6.0 + TAU / 9.0, angle);}void main() {gl_FragColor.a = 1.0;vec2 uv = COORD;if (do_perspective) uv.y = (uv.y - 0.5) * 1.25 + 0.5;COLOR.rgb = mix(bg_color, vec3(1.0), in_circle(uv, vec2(0.5), plate_size / 2.0));gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.95), in_circle(uv, vec2(0.5), 0.8 * plate_size / 2.0));const float layers = 64.0;vec2 cake_offset = vec2(0.125);for (float i = 0.0; i < layers; i += 1.0) {gl_FragColor.rgb = mix(gl_FragColor.rgb, cake_color * 0.8, in_segment(uv + cake_offset, vec2(0.5, 0.5 + i * cake_height / layers), cake_size * plate_size / 2.0, cake_rotation, cake_size));}gl_FragColor.rgb = mix(gl_FragColor.rgb, cake_color, in_segment(uv + cake_offset, vec2(0.5, 0.5 + cake_height), cake_size * plate_size / 2.0, cake_rotation, cake_size));}"},
}
let targetImageShader = null

function setup(event) {
	"use strict";
	
	setupUniformSetterDialog();
	
	// Dynamically set page title depending on the day
	const title = document.querySelector("head title");
	const day = (new URLSearchParams(location.search)).get("day");
	if (day in targetImageShaders) {
		title.textContent = title.textContent.replace("Title", "Day " + day);
		targetImageShader = targetImageShaders[day]
		document.querySelector("#postcard-caption").innerText = targetImageShader.caption;
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
	
	const stickers = targetImageShaders[day]?.stickers ?? targetImageShaders["_"]?.stickers ?? {};
	for (let stickerName in stickers) {
			fragmentSourcePrependString += `uniform sampler2D ${stickerName} #display;\n`;
			fragmentSourcePrependLineCount++;
	}
	
	if (targetImageShader != null) {
		targetCanvas = new ShadeableCanvas(document.querySelector("#target-canvas"), paragraph, false);
		
		updateCanvas(targetCanvas, targetImageShaders[day].targetCode, false, false);
		
		for (let stickerName in stickers) {
			targetCanvas.setSamplerUniform(stickerName, stickers[stickerName], runningLocally);
		}
		targetCanvas.webGL.drawArrays(targetCanvas.webGL.TRIANGLE_STRIP, 0, 4);
	}
	editableCanvas = new ShadeableCanvas(document.querySelector("#editable-canvas"), paragraph);
	onCodeEdited(codeJar.toString(), false);
	for (let stickerName in stickers) {
		editableCanvas.setSamplerUniform(stickerName, stickers[stickerName], runningLocally);
	}
	editableCanvas.webGL.drawArrays(editableCanvas.webGL.TRIANGLE_STRIP, 0, 4);
	
	// UpdateCanvas parses the source and creates uniform handles, we can now load values and set them
	const loadedUniformValues = JSON.parse(localStorage.getItem('uniforms')) ?? {};
	//console.log("Loaded uniforms:", loadedUniformValues);
	for (let varName in loadedUniformValues) {
		updateOrCreateEntry(uniformValues, varName, loadedUniformValues[varName]);
		const uniformInput = document.querySelector(`[for=${varName}]`)
		if (!uniformInput) continue;
		const uniformInputs = uniformInput.querySelectorAll("input");
		for (let i = 0; i < Math.min(uniformInputs.length, uniformValues[varName].htmlValues.length); i++) {
			setInputValue(uniformInputs[i], uniformValues[varName].htmlValues[i])
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
	if (!editableCanvas.program || !codeUsesTime) return;
	
	time = (Date.now() - initialTime) / 1000.0;
	editableCanvas.redrawShader();
}



function onCodeEdited(code, saveCode = true) {
	codeUsesTime = code.indexOf("TIME") != -1;
	codeVariables = getCodeVariables(code);
	updateCanvas(editableCanvas, code, true, false);
	if (saveCode) {
		localStorage.setItem('code', code);
	}
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
			const uniformInputs = uniformInputContainer.querySelectorAll("input");
			for (let i = 0; i < uniformInputs.length; i++) {
				const uniformInput = uniformInputs[i];
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
				
				const mainMatch = code.match(/void\s+main\s*\(\s*\)\s*{/);
				const mainPos = mainMatch.index + mainMatch[0].length;
				try {
					const cursorPos = codeJar.save().start;
					if (cursorPos < code.length && cursorPos > mainPos) {
						codeJar.updateCode(code.slice(0, cursorPos) + codeToInsert + code.slice(cursorPos));
						return;
					}
				} catch(e) {}
				
				const cursorPos = code.length - 2;
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
	let spanCallbacks = {}
	for (let inputID = 0; inputID < attributesArray.length; inputID++) {
		const attributes = attributesArray[inputID];
		const input = document.createElement("input");
		for (let attributeID in attributes) {
			input.setAttribute(attributeID, attributes[attributeID]);
		}
		div.appendChild(input);
		uniformInputs.push(input);
		
		if (attributesArray.length > 1 && input.type == "range") {
			const label = document.createElement("span");
			div.appendChild(label);
			label.className = "unselectable overlay thumb-label";
			label.innerHTML = attributes.id.split(".")[1];
			if (label.innerHTML == "w" && attributesArray[inputID - 1]?.type == "color") label.innerHTML = "a"
			const labelPadding = 8;
			spanCallbacks[input] = (input) => {
				if (input?.parentElement?.parentElement == null) return;
				const leftMargin = input.parentElement.parentElement.getBoundingClientRect().left;
				const left = input.getBoundingClientRect().left + labelPadding;
				const right = input.getBoundingClientRect().right - labelPadding;
				const t = (input.value - input.min) / (input.max - input.min);
				input.nextSibling.style.left = `${left + (right - left) * t - leftMargin}px`;
			};
		}
	}
	
	const boundCallback = callback.bind(null, uniformInputs);
	for (let inputID = 0; inputID < uniformInputs.length; inputID++) {
		const input = uniformInputs[inputID];
		if (input.type == "button") {
			input.onclick = boundCallback;
		} else {
			if (spanCallbacks[input]) {
				input.oninput = (spanOnly = false) => {
					spanCallbacks[input](input);
					if (spanOnly != true) boundCallback();
				};
			} else {
				input.oninput = boundCallback;
			}
		}
		
		if (varName in uniformValues && uniformValues[varName].htmlValues) {
			setInputValue(input, uniformValues[varName].htmlValues[inputID])
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
		if (input.oninput) input.oninput(true);
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


function setupUniformSetterDialog() {
	const setterDialog = document.getElementById("setter-dialog");
	let setterCallbacks;
	document.oncontextmenu = (event) => {
		const target = event.target;
		
		if (setterDialog.open && (!target.closest("form"))) {
			event.preventDefault();
			setterDialog.close();
			return;
		}
		
		if (target.nodeName == "INPUT" && target.type == "range") {
			event.preventDefault();
			const form = setterDialog.querySelector("#inputs");
			const formInputs = target.parentElement.querySelectorAll("input");
			const varName = target.parentElement.getAttribute("for");
			setterCallbacks = []
			form.innerHTML = "";
			
			const groupLabel = document.createElement("label");
			groupLabel.className = "unselectable";
			groupLabel.style = "position:relative; top:-10px;";
			groupLabel.innerHTML = varName + ":";
			form.appendChild(groupLabel);
			
			for (let i = 0; i < formInputs.length; i++) {
				const componentInput = formInputs[i];
				if (componentInput.type == "range") {
					createUniformFormInput(form, formInputs.length, setterCallbacks, varName, componentInput, i, target);
				}
			}
			setterDialog.showModal();
		}
	};
	document.addEventListener("click", (event) => {
		if (setterDialog.open && !inRect(setterDialog.getBoundingClientRect(), {x: event.x, y: event.y})) {
			setterDialog.close();
		}
	});
	setterDialog.querySelector("button[type=reset]").addEventListener("click", () => {
		setterDialog.close();
	});
	setterDialog.addEventListener("submit", () => {
		setterCallbacks.forEach(f => f());
	});
}

function createUniformFormInput(formInputs, numInputs, setterCallbacks, varName, uniformInput, i, target) {
	let component
	if (numInputs == 1) {
		component = varName;
	} else {
		const isAlpha = (component == "w" && target.parentElement.children[i - 1]?.getAttribute("type") == "color");
		component = isAlpha ? "alpha" : uniformInput.id.split(".")[1];
	}
	
	const group = document.createElement("div");
	formInputs.appendChild(group);
	
	if (numInputs > 1) {
		const label = document.createElement("label");
		label.className = "unselectable";
		label.innerHTML = component + ":&nbsp;";
		group.appendChild(label);
	}
	
	const formInput = document.createElement("input");
	formInput.type = "text";
	formInput.pattern = floatRegex;
	formInput.value = uniformValues[varName]?.htmlValues[i] ?? 0;
	// Set the cursor position of autofocused form to the end of the value
	formInput.onfocus = () => {var temp_value=this.value; this.value=''; this.value=temp_value;} // https://stackoverflow.com/questions/17780756/put-cursor-at-end-of-text-inputs-value
	// Add functionality to increment/decrement on arrow keys, by whatever precision the number is already at
	formInput.onkeydown = (event, test) => {
		const precision = (event.target.value.indexOf(".") == -1) ? 0 : `${parseInt(event.target.value.split(".")[1])}`.length;
		const delta = (precision == 0) ? 1 : parseFloat(`0.${"0".repeat(precision - 1)}1`);
		if (event.keyCode == 38) {
			event.preventDefault();
			event.target.value = (parseFloat(event.target.value) + delta).toFixed(precision);
		} else if (event.keyCode == 40) {
			event.preventDefault();
			event.target.value = (parseFloat(event.target.value) - delta).toFixed(precision);
		}
	};
	if (uniformInput == target) formInput.autofocus = true;
	group.appendChild(formInput);
	
	setterCallbacks.push(() => {
		uniformInput.value = parseFloat(formInput.value);
		uniformInput.oninput();
	});
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
		editor.insertAdjacentHTML('afterend', `<div class="error unselectable overlay">${message}</div>`);
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

function inRect(rect, p) {
	return p.x >= rect.left && p.x <= rect.right && p.y >= rect.top && p.y <= rect.bottom;
}