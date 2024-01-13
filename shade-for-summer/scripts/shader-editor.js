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
	
	return string;
}

function replaceSubstring(string, start, end, from, to) {
	return string.substring(0, start) + string.substring(start, end).replace(from, to) + string.substring(end)
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

function inRect(rect, p) {
	return p.x >= rect.left && p.x <= rect.right && p.y >= rect.top && p.y <= rect.bottom;
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

const tokenRegex = /\w+/g
//const uniformRegex = /uniform\s+(?<type>\w+)\s+(?<name>\w+)/g	// Basic uniform regex without any type hints
const floatRegex = String.raw`-?\s*(?:[0-9]+\.?[0-9]*|[0-9]*\.[0-9]+)\s*`;
const rangeHintRegex = String.raw`range\((?:${floatRegex},\s*){1,2}(?:${floatRegex})\)`
const uniformRegex = new RegExp(String.raw`uniform\s+(?<type>\w+)\s+(?<name>\w+)\s*(?<hints>(?:#(?:${rangeHintRegex}|color|ignore|display)\s*)*);`, "g");


const fragmentSourcePrependLines = [
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

const error_dictionary = [
	{from: "gl_FragColor", to: "COLOR"},
	{from: "RATIO", to: "RATIO/UV"},
	{from: "mix", to: "mix/lerp"},
]

const rangeableUniformTypes = ["float", "vec2", "vec3", "vec4", "int", "ivec2", "ivec3", "ivec4"];

class Shader {
	fragmentSourcePrependLineCount = fragmentSourcePrependLines.length;
	fragmentSourcePrepend = "";
	uniformValues = {}
	
	constructor(prepend = []) {
		for (let line of fragmentSourcePrependLines) {
			this.fragmentSourcePrepend += line + "\n";
		}
		for (let line of prepend) {
			this.fragmentSourcePrepend += line + "\n";
			this.fragmentSourcePrependLineCount += 1;
		}
	}
	
	updateCanvas(code) {
		let validCode = this.fragmentSourcePrepend + code;
		validCode = this.stripUniforms(validCode);
		this.canvas.recreateShader(validCode, this.uniformValues);
	}
	
	stripUniforms(code) {
		let validCode = code;
		let indexOffset = 0;
		for (let uniform of code.matchAll(uniformRegex)) {
			const type = uniform.groups.type;
			const varName = uniform.groups.name;
			let hints = uniform.groups.hints;
			
			if (hints != "") {
				const hintsIndex = uniform.index + indexOffset + uniform[0].indexOf(hints);
				validCode = validCode.slice(0, hintsIndex) + validCode.slice(hintsIndex + hints.length);
				indexOffset -= hints.length;
			}
		}
		return validCode;
	}
	
	setTextureUniforms(textures) {
		for (let textureName in textures) {
			this.fragmentSourcePrepend += `uniform sampler2D ${textureName} #display;\n`;
			this.fragmentSourcePrependLineCount++;
		}
	}
}

class ShaderEditor extends Shader {
	
	constructor(CodeJar, withLineNumbers, editor, prepend = []) {
		super(prepend);
		
		this.editor = editor;
		
		// Initialize the editor based on flags
		this.interactive =  this.hasFlag("interactive");
		this.saveCode =     this.hasFlag("save-code");
		this.saveUniforms = this.hasFlag("save-uniforms");
		this.showErrors =  !this.hasFlag("hide-errors");
		const allowAlpha = !this.hasFlag("opaque");
		
		const highlighter = this.hasFlag("line-numbers") ? withLineNumbers(Prism.highlightElement) : (el => Prism.highlightElement(el));
		this.codeJar = new CodeJar(editor, highlighter);
		
		if (this.interactive) {
			this.wrapper = editor.closest(".codejar-wrap");
			
			if (editor.getAttribute("canvas")) {
				var canvas = document.getElementById(editor.getAttribute("canvas"));
			} else {
				// Add canvas for interactive tutorials
				const canvasOrigin = document.createElement("div");
				canvasOrigin.style = "position:absolute; bottom:0; right:0; height:100%; display:flex; flex-direction:column-reverse;";
				this.wrapper.appendChild(canvasOrigin);
				
				var canvas = document.createElement("canvas");
				canvas.width = 300;
				canvas.height = 200;
				canvas.style = "width:300px; height:200px; margin:0.5em; position:sticky; bottom:1em;";
				canvasOrigin.appendChild(canvas);
				
				editor.style["min-height"] = canvas.getBoundingClientRect().height + "px";
				editor.style.width = "inherit";
			}
			
			this.uniformArea = document.createElement("div");
			this.uniformArea.className = "uniform-area";
			this.wrapper.parentElement.insertBefore(this.uniformArea, this.wrapper);
			this.setupUniformSetterDialog();
		}
		
		if (this.interactive || this.saveCode) {
			this.codeJar.onUpdate((code) => this.onCodeEdited(code));
		}
		
		// Load saved code from local storage
		if (this.saveCode) {
			var loaded_code = localStorage.getItem('code');
			if (loaded_code) this.codeJar.updateCode(loaded_code);
		}
		
		// Init canvas
		if (this.interactive) {
			this.canvas = new ShadeableCanvas(canvas, null, allowAlpha);
			this.onCodeEdited(this.codeJar.toString(), false);
			
			// updateCanvas in onCodeEdited parses the source and creates uniform handles, we can now load values and set them
			this.loadUniforms();
			this.canvas.redrawShader(this.uniformValues);
		}
	}
	
	hasFlag(id) {
		return this.editor.classList.contains("flag-" + id);
	}
	
	loadUniforms() {
		// Load from HTML attributes
		const dataUniforms = this.editor.getAttribute("data-uniforms") ?? "";
		for (let dataUniform of dataUniforms.split(";")) {
			if (dataUniform.indexOf(":") == -1) continue;
			const varName  = dataUniform.split(":")[0].replace(" ", "");
			const value    = dataUniform.split(":")[1].replace(" ", "");
			updateOrCreateEntry(this.uniformValues, varName, {htmlValues: [value]});
		}
		
		// Load from local storage
		if (this.hasFlag("save-uniforms")) {
			const loadedUniformValues = JSON.parse(localStorage.getItem('uniforms')) ?? {};
			for (let varName in loadedUniformValues) {
				updateOrCreateEntry(this.uniformValues, varName, loadedUniformValues[varName]);
			}
		}
		
		// Update uniform inputs with loaded values
		for (let varName in this.uniformValues) {
			const uniformInput = this.uniformArea.querySelector(`[for=${varName}]`);
			if (!uniformInput) continue;
			const uniformInputs = uniformInput.querySelectorAll("input");
			
			for (let i = 0; i < Math.min(uniformInputs.length, this.uniformValues[varName].htmlValues?.length ?? 0); i++) {
				this.setInputValue(uniformInputs[i], this.uniformValues[varName].htmlValues[i]);
			}
		}
	}
	
	onCodeEdited(code) {
		if (this.interactive) {
			this.codeUsesTime = code.indexOf("TIME") != -1;
			this.typeData = getTypeData(code);
			this.updateCanvas(code, false);
		}
		if (this.saveCode) {
			localStorage.setItem('code', code);
		}
	}
	
	updateCanvas(code, check_similarity = true) {
		let validCode = this.fragmentSourcePrepend + code;
		validCode = this.createCustomUniformInput(validCode);
		
		const errorLog = this.canvas.recreateShader(validCode, this.uniformValues);
		const noErrors = this.handleCompileErrors(errorLog)
		if (noErrors && check_similarity) {
			// TODO
		}
	}
	
	handleCompileErrors(errorLog) {
		while (this.wrapper.nextElementSibling && this.wrapper.nextElementSibling.classList.contains("error")) {
			this.wrapper.nextElementSibling.remove();
		}
		
		if (!errorLog) return true;
		
		if (this.showErrors) {
			let errors = errorLog.split("\n").reverse().filter(e => e.startsWith("ERROR"));
			errors = errors.slice(errors.length - 1); //Force 1-error limit to increase accessibility
			for (let error of errors) {
				const parts = error.split(" ");
				const lineNumber = parseInt(parts[1].split(":")[1]) - this.fragmentSourcePrependLineCount;
				let message = parts.slice(2).join(" ");
				message = replaceTokensFromDictionary(message, error_dictionary);
				this.wrapper.insertAdjacentHTML('afterend', `<div class="error unselectable">
						<span>Line ${lineNumber}</span>
						<span style="flex-grow:1; border-left:none;">${message}</span>
					</div>`);
			}
		}
		return false;
	}
	
	createCustomUniformInput(code) {
		// Remove existing HTML inputs
		for (let uniformInputContainer of this.uniformArea.querySelectorAll(".uniform-input")) {
			const varName = uniformInputContainer.getAttribute("for");
			let htmlValues = []
			const uniformInputs = uniformInputContainer.querySelectorAll("input");
			for (let i = 0; i < uniformInputs.length; i++) {
				const uniformInput = uniformInputs[i];
				htmlValues.push(this.getInputValue(uniformInput));
			}
			updateOrCreateEntry(this.uniformValues, varName, {htmlValues: htmlValues});
			uniformInputContainer.remove();
		}
		
		let validCode = code;
		let indexOffset = 0;
		for (let uniform of code.matchAll(uniformRegex)) {
			const type = uniform.groups.type;
			const varName = uniform.groups.name;
			let hints = uniform.groups.hints;
			
			// Remove the custom uniform hints from the source code so it doesn't error, and extract the actual hint data
			if (hints != "") {
				const hintsIndex = uniform.index + indexOffset + uniform[0].indexOf(hints);
				validCode = validCode.slice(0, hintsIndex) + validCode.slice(hintsIndex + hints.length);
				indexOffset -= hints.length;
				
				const hints_copy = hints.replace(" ", "").split("#").filter(n => n);
				hints = {}
				for (let hint of hints_copy) {
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
			
			if ("ignore" in hints) continue;
			
			// Add HTML inputs for uniform, e.g. 1 checkbox for a bool uniform, 2 ranges for a vec2 uniform, 1 color + 1 range for a vec4 #color uniform
			if (type == "sampler2D" && "display" in hints) {
				const attributes = {id: varName, type: "button", style: "min-width: 80px"};
				const self = this;
				const callback = function(inputs) {
					const code = self.codeJar.toString();
					const codeToInsert = `place_sticker(${varName}, COORD);`;
					let newCode;
					
					const mainMatch = code.match(/void\s+main\s*\(\s*\)\s*{/);
					const mainPos = mainMatch.index + mainMatch[0].length;
					try {
						const cursorPos = self.codeJar.save().start;
						if (cursorPos < code.length && cursorPos > mainPos) {
							newCode = code.slice(0, cursorPos) + codeToInsert + code.slice(cursorPos);
						}
					} catch(e) {}
					
					if (!newCode) {
						const cursorPos = code.length - 2;
						newCode = code.slice(0, cursorPos) + "\n\t" + codeToInsert + code.slice(cursorPos);
					}
					self.codeJar.updateCode(newCode);
					self.onCodeEdited(newCode);
				}
				this.createUniformInput(varName, [attributes], callback);
			} else if (type == "bool") {
				const attributes = {id: varName, type: "checkbox", style: "scale: 1.2;"};
				const self = this;
				const callback = function(inputs) {
					const checked = inputs[0].checked;
					updateOrCreateEntry(self.uniformValues, varName, {htmlValues: [checked], shaderValue: [checked ? 1.0 : 0.0], isFloat: true})
					if (self.saveUniforms) self.saveUniformValues();
					if (self.canvas.program) {
						self.canvas.webGL.uniform1f(self.canvas.webGL.getUniformLocation(self.canvas.program, varName), checked ? 1.0 : 0.0);
						self.canvas.redrawShader(self.uniformValues);
					}
				}
				this.createUniformInput(varName, [attributes], callback);
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
				const self = this;
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
					
					updateOrCreateEntry(self.uniformValues, varName, {htmlValues: inputs.map(i => i.value), shaderValue: components, isFloat: isFloat})
					if (self.saveUniforms) self.saveUniformValues();
					if (self.canvas.program) {
						self.canvas.setVectorUniform(varName, components, isFloat);
						self.canvas.redrawShader(self.uniformValues);
					}
				}
				this.createUniformInput(varName, attributesArray, callback);
			}
		}
		
		return validCode;
	}

	createUniformInput(varName, attributesArray, callback) {
		let div = document.createElement("label");
		div.setAttribute("class", "uniform-input unselectable");
		div.setAttribute("for", varName);
		this.uniformArea.appendChild(div);
		const formattedVarName = varName.replace("_", " ");
		div.innerHTML = attributesArray[0].type == "button" ? `Place Sticker (${formattedVarName})` : formattedVarName;
		div.innerHTML += ":&nbsp;";
		
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
			
			if (varName in this.uniformValues && this.uniformValues[varName].htmlValues) {
				this.setInputValue(input, this.uniformValues[varName].htmlValues[inputID])
			}
		}
	}

	getInputValue(input) {
		return (input.getAttribute("type") == "checkbox") ? input.checked : input.value;
	}

	setInputValue(input, value) {
		if (input.getAttribute("type") == "checkbox") {
			input.checked = value;
		} else {
			input.value = value;
			if (input.oninput) input.oninput(true);
		}
	}

	saveUniformValues() {
		// First remove any uniforms which are set to default values
		let strippedUniformValues = {}
		for (let varName in this.uniformValues) {
			if (this.uniformHasDefaultValue(varName)) continue;
			strippedUniformValues[varName] = this.uniformValues[varName];
		}
		//
		if (this.hasFlag("save-uniforms")) localStorage.setItem('uniforms', JSON.stringify(strippedUniformValues));
	}

	uniformHasDefaultValue(varName) {
		for (let v of this.uniformValues[varName].htmlValues) {
			if (v == "0" || v == "#000000" || v == "false") continue;
			return false;
		}
		return true;
	}

	setupUniformSetterDialog() {
		const setterDialog = this.uniformArea.querySelector("setter-dialog");
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
				const form = setterDialog.querySelector(".inputs");
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
						this.createUniformFormInput(form, formInputs.length, setterCallbacks, varName, componentInput, i, target);
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

	createUniformFormInput(formInputs, numInputs, setterCallbacks, varName, uniformInput, i, target) {
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
		formInput.value = this.uniformValues[varName]?.htmlValues[i] ?? 0;
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
	
	setupUniformSetterDialog() {
		const setterDialog = document.createElement("dialog");
		setterDialog.className = "setter-dialog";
		this.uniformArea.appendChild(setterDialog);
		
		setterDialog.insertAdjacentHTML('beforeend', 
			`<form method="dialog">
				<p class="inputs"></p>
				<div class="unselectable" style="text-align:center";>
					<button type="submit" style="display:inline-block">Confirm</button>
					<button type="reset" style="display:inline-block">Cancel</button>
				</div>
			</form>`);
		
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
				const form = setterDialog.querySelector(".inputs");
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
						this.createUniformFormInput(form, formInputs.length, setterCallbacks, varName, componentInput, i, target);
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

	createUniformFormInput(formInputs, numInputs, setterCallbacks, varName, uniformInput, i, target) {
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
		formInput.value = this.uniformValues[varName]?.htmlValues[i] ?? 0;
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
}