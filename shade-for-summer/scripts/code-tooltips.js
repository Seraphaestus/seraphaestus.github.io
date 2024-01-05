let highlighterGrammarModified = false
let showSpecificTooltips = {}

const vectorRegex = /[ibdu]?vec[234]/
const typeRegex = String.raw`(?:float|double|int|bool|d?mat[234](?:x[234])?|[ibdu]?vec[234]|uint|[iu]?sampler[123]D|[iu]?samplerCube|sampler[12]DShadow|samplerCubeShadow|[iu]?sampler[12]DArray|sampler[12]DArrayShadow|[iu]?sampler2DRect|sampler2DRectShadow|[iu]?samplerBuffer|[iu]?sampler2DMS(?:Array)?|[iu]?samplerCubeArray|samplerCubeArrayShadow|[iu]?image[123]D|[iu]?image2DRect|[iu]?imageCube|[iu]?imageBuffer|[iu]?image[12]DArray|[iu]?imageCubeArray|[iu]?image2DMS(?:Array)?|struct|hvec[234]|fvec[234]|sampler3DRect|filter)`

window.addEventListener("load", () => {
	const settingsData = JSON.parse(localStorage.getItem("settings")) ?? {};
	const showCodeTooltips = settingsData["show-code-tooltips"] ?? true;
	for (let option of ["keywords", "types", "functions", "constants", "operators", "hints"]) {
		showSpecificTooltips[option] = settingsData["show-code-tooltips." + option] ?? true;
	}
	
	if (showCodeTooltips) insertionQ('.token:before').every(onTokenTooltipAdded);
	
	Prism.hooks.add('before-highlight', modifyHighlighterGrammar);
	
	// I don't know why, but neither of the above callbacks are running on the live site (while working fine on local)
	// until each .editor element is updated somewhow, so here:
	for (let editor of document.getElementsByClassName("editor")) {
		editor.innerHTML = editor.innerHTML
	}

}, {once: true});

function modifyHighlighterGrammar(env) {
	if (highlighterGrammarModified) return;
	Prism.languages.insertBefore('glsl', 'keyword', {
		'component_accessor': {
			pattern: /\b\.[_a-zA-Z]\w*\b/,
			alias: "punctuation"
		},
		'shader_output': {
			pattern: /\b(?:COLOR)\b/,
			alias: "keyword"
		},
		'shader_input': {
			pattern: /\b(?:UV|RATIO|COORD|TIME)\b/,
			alias: "keyword"
		},
		'constant': {
			pattern: /\b(?:PI|TAU|E|true|false)\b/
		},
		'uniform_hint': {
			pattern: /#(?:range|color|ignore)\b/
		},
		'reserved': {
			pattern: /\b(?:gl_\w*|long|short|double|sizeof|cast|namespace|using|output)\b/,
			alias: "keyword"
		},
		'return_type': {
			pattern: new RegExp(String.raw`\b${typeRegex}\b(?=\s+\w+\s*\()`),
			alias: "type"
		},
		'constructor_type': {
			pattern: new RegExp(String.raw`\b${typeRegex}\b(?=\s*\()`),
			alias: "type"
		},
		'type': {
			pattern: new RegExp(String.raw`\b${typeRegex}\b`)
		},
		'keyword_main': {
			pattern: /\b(?:main)\b/,
			alias: "keyword"
		},
		'operator_ternary': {
			pattern: /[:]/,
			alias: "operator"
		},
	});
	Prism.languages.glsl['variable'] = {
		pattern: /\b[_a-zA-Z]\w*\b/
	};
	// Edited to extract reserved terms and types
	// keyword =(how?) \b(?:attribute|const|uniform|varying|buffer|shared|coherent|volatile|restrict|readonly|writeonly|atomic_uint|layout|centroid|flat|smooth|noperspective|patch|sample|break|continue|do|for|while|switch|case|default|if|else|subroutine|in|out|inout|void|invariant|precise|discard|return|lowp|mediump|highp|precision|common|partition|active|asm|class|union|enum|typedef|template|this|resource|goto|inline|noinline|public|static|extern|external|interface|half|fixed|unsigned|superp|input|output)\b/
	highlighterGrammarModified = true;
}

function onTokenTooltipAdded(token) {
	const tooltipText = getCodeTooltip(token);
	if (tooltipText == null) return;
	
	token.setAttribute('data-before', tooltipText);
	// Set style to prevent it going off screen
	const rect = token.getBoundingClientRect();
	const parentRect = token.parentElement.getBoundingClientRect();
	
	const tooltipLines = tooltipText.split("\n")
	const longestLine = tooltipLines.sort((a, b) => { return b.length - a.length; })[0];
	const tooltipWidth = Math.min(512, getTextWidth(longestLine, getCanvasFont(token)));
	const tooltipLeft = (rect.left + rect.width / 2.0) - tooltipWidth / 2.0;
	const tooltipRight = (rect.left + rect.width / 2.0) + tooltipWidth / 2.0;
	const marginRight = 18;
	const marginLeft = 50;
	if (tooltipLeft < parentRect.left) {
		token.style.setProperty("--offset-x", (parentRect.left - tooltipLeft + marginLeft) + "px");
	} else if (tooltipRight > parentRect.right) {
		token.style.setProperty("--offset-x", (parentRect.right - tooltipRight - marginRight) + "px");
	}
}

function getCodeTooltip(token) {
	if (token.classList.contains("constant") && showSpecificTooltips["constants"]) {
		switch (token.innerText) {
			case "true": return "Boolean True constant";
			case "false": return "Boolean False constant";
			case "PI": return "Pi constant: 180° around a circle in radians\nPI  ≡  3.14159265359";
			case "TAU": return "Tau constant: 360° around a circle in radians\nTAU  ≡  6.28318530718";
			case "E": return "Euler's number constant: the base of natural logorithms\nE  ≡  2.71828182846";
		}
	}
	const constructorType = token.classList.contains("constructor_type");
	const returnType = token.classList.contains("return_type");
	if (token.classList.contains("type") && showSpecificTooltips["types"]) {
		let prefix = "";
		let tooltip = "";
		switch (token.innerText) {
			case "float":  tooltip = "represents a decimal number\ne.g. 1.0, 2.345, 999.999"; break;
			case "vec2":   tooltip = "represents a 2-dimensional vector\ne.g. 2D coordinate\nIt consists of 2 floats: xy\ne.g. vec2(1.0, 2.0).x  ≡  1.0"; break;
			case "vec3":   tooltip = "represents a 3-dimensional vector\ne.g. RGB color\nIt consists of 3 floats: xyz aka rgb\ne.g. vec3(1.0, 2.0, 3.0).z  ≡  3.0"; break;
			case "vec4":   tooltip = "represents a 4-dimensional vector\ne.g. RGBA color with transparency\nIt consists of 4 floats: xyzw aka rgba\ne.g. vec4(1.0, 2.0, 3.0, 4.0).yz  ≡  vec2(2.0, 3.0)"; break;
			case "int":    tooltip = "represents a whole number\ne.g. 1, 2, 999"; prefix = "[Advanced] "; break;
			case "ivec2":  tooltip = "represents a 2-dimensional vector of whole numbers\nIt consists of 2 ints: xy\ne.g. ivec2(1, 2).x  ≡  1"; prefix = "[Advanced] "; break;
			case "ivec3":  tooltip = "represents a 3-dimensional vector of whole numbers\nIt consists of 3 ints: xyz aka rgb\ne.g. ivec3(1, 2, 3).z  ≡  3"; prefix = "[Advanced] "; break;
			case "ivec4":  tooltip = "represents a 4-dimensional vector of whole numbers\nIt consists of 4 ints: xyzw aka rgba\ne.g. ivec4(1, 2, 3, 4).yz  ≡  ivec2(2, 3)"; prefix = "[Advanced] "; break;
			case "bool":   tooltip = "represents a boolean value\nA boolean can be either true or false"; break;
			case "mat2":   tooltip = "represents a 2-dimensional matrix, i.e. a 2x2 array of floats"; prefix = "[Advanced] "; break;
			case "mat3":   tooltip = "represents a 3-dimensional matrix, i.e. a 3x3 array of floats"; prefix = "[Advanced] "; break;
			case "mat4":   tooltip = "represents a 4-dimensional matrix, i.e. a 4x4 array of floats"; prefix = "[Advanced] "; break;
			case "struct": tooltip = "groups variables as one object.\ne.g. struct example { float f; bool b; };\ne.g. example x = example(0.0, true);\nStruct variables can also be declared inline after the struct definition. e.g. struct example {float f;} x;"; prefix = "[Advanced] "; break;
			default: return "I don't know what you're doing with this but good luck!";
		}
		if (token.classList.contains("constructor_type")) {
			return prefix + "A constructor which takes parameters to create a value of the given type. e.g. vec2 x = vec2(0.0, 1.0);\nThis data type " + tooltip;
		} else if (token.classList.contains("return_type")) {
			return prefix + `Specifies what type of value the function ${getNextToken(token).innerText} returns\nThis data type ` + tooltip;
		} else {
			return prefix + "A data type which " + tooltip;
		}
	}
	if (token.classList.contains("keyword") && showSpecificTooltips["keywords"]) {
		switch (token.innerText) {
			case "main": return "This is the main function, which will be automatically run for each pixel of the canvas";
			case "void": return "The output type void means this function does not return a value";
			
			case "break": return "A statement which causes the code to instantly exit the current loop";
			case "continue": return "A statement which causes the code to instantly exit the current iteration of a loop and skip to the next iteration";
			case "return": return "A statement which causes the code to instantly exit the current function and output the following value, which the function will thereby evaluate to when called.";
			case "discard": return "[Advanced] A statement which causes the code to instantly exit the fragment shader and discard the current pixel of the canvas.";
			
			case "if": return "A branch which will only run the code within it if its condition is true\nThe following brackets must contain an expression which evaluates to a boolean true-false value:\nif (true) {}\nif (a < b && a < c) {}";
			case "else": return "A follow-up to an if statement which runs the code within it only if the previous if statement evaluated to false\nif (false) {} else {}\nIt can also chain further if statements like so:\nif (false) {} else if (false) {} else {}"
			case "for": return "A loop which will run the code within it multiple times\nIn the following brackets you must define an iterator variable, its starting value, looping condition, and increment:\nfor (int i = 0; i < n; i += 1) {}\ni starts at 0, and while less than n, increments by 1";
			case "while": return "[Unavailable] A loop which will keep running the code within it until its condition is no longer true\nWhile loops are not available in WebGL  :(";
			
			case "const": return "Modifies a variable to be constant for efficiency\nOnce initialized, it cannot be given a new value";
			case "uniform": return "Modifies a variable to allow constant values to be externally passed into the shader, using input fields that will be automatically generated above the code box\nUniforms must be declared at the top level, outside of functions";
			
			case "COLOR": return "A vec4 output representing the RGBA color of the given pixel\nCOLOR  ≡  gl_FragColor";
			case "RATIO":
			case "UV": return "A vec2 input representing the position of the pixel on the canvas\nGoes from (0.0, 0.0) at ⇱ to (1.0, 1.0) at ⇲\nRATIO  ≡  UV";
			case "COORD": return "A vec2 input representing the position of the pixel on the canvas\nNormalized to ignore the canvas' aspect ratio\nGoes from (-0.25, 0.0) at ⇱ to (1.25, 1.0) at ⇲\nCOORD  ≡  (RATIO - 0.5) * vec2(<aspect ratio>, 1.0) + 0.5";
			case "TIME": return "A float input representing the number of seconds since the page was loaded";
		}
	} else if (token.classList.contains("function") && showSpecificTooltips["functions"]) {
		switch (token.innerText) {
			// Maths functions
			case "step": return "Discriminates a boundary.\nCan be thought of returning if a and b are in sorted order\nx = step(a, b);  ≡  if (a <= b) { x = 1.0; } else { x = 0.0; }\nSee also steps(a, b, c)";
			case "steps": return "Discrimates an upper and lower boundary.\nCan be thought of returning if (a and b) and (b and c) are in sorted order\nsteps(a, b, c)  ≡  step(a, b) * step(b, c)";
			case "mix": 
			case "lerp": return "Linearly interpolates between two inputs\ne.g. mix(a, b, 0.5) returns 50% of the way from a to b\nmix(a, b, t)  ≡  lerp(a, b, t)  ≡  a + t * (b - a)";
			case "min": return "Returns the minimum of two inputs\nx = min(a, b);  ≡  if (a < b) { x = a; } else { x = b; }";
			case "max": return "Returns the minimum of two inputs\nx = max(a, b);  ≡  if (a > b) { x = a; } else { x = b; }";
			case "clamp": return "Contrains the input between two values\nclamp(x, minimum, maxmimum)  ≡  min(maximum, max(x, minimum))";
			case "floor": return "Rounds to the next whole number less than or equal to the input\nfloor(x)  ≡  float(int(x))";
			case "ceil": return "Rounds to the next whole number greater than or equal to the input\nceil(x)  ≡  float(int(x + 1.0))";
			case "pow": return "Calculates the result of raising a value to a given exponent\ne.g. pow(x, 0.5)  ≡  sqrt(x)\n   pow(x, 2.0)  ≡  x * x";
			case "log": return "Returns the natural logorithm of the value\nTo get logorithms of any base, use log(x) / log(base)\npow(E, log(x))  ≡  x";
			case "mod": return "Modulo function, returning the remainder of a division\nEffectively constrains a value into a repeating range (0, n)\nmod(x, n)  ≡  x - n * floor(x / n)";
			case "sqrt": return "Returns the square root of a value\nsqrt(x) * sqrt(x)  ≡  x";
			case "abs": return "Absolute function, returning the positive version of the value regardless of its sign\ne.g. nabs(-1)  ≡  1\nabs(x)  ≡  sign(x) * x";
			case "sign": return "Returns the sign of the value regardless of its magnitude\nsign(83)  ≡  1\nsign(-7)  ≡  -1\nsign(x)  ≡  x / abs(x)";
			// Trigonometry functions
			case "sin": return "Sine trigonometric function\nOscillates between -1 and 1 over a period of TAU, starting at 0\nsin(x)  ≡  cos(x - TAU / 4.0)";
			case "cos": return "Cosine trigonometric function\nOscillates between -1 and 1 over a period of TAU, starting at 1\ncos(x)  ≡  sin(x + TAU / 4.0)";
			case "tan": return "Tangent trigonometric function\ntan(x)  ≡  sin(x) / cos(x)";
			case "degrees": return "Converts an angle from radians to degrees\ndegrees(a)  ≡  360 * a / TAU";
			case "radians": return "Converts an angle from degrees to radians\nradians(a)  ≡  TAU * a / 360";
			// Vector functions
			case "normalize": return "Returns a vector with the same direction and a length of 1.0\nnormalize(v)  ≡  v / length(v)";
			case "length": return "Calculates the length of a vector\nlength(v)  ≡  sqrt(v.x * v.x + v.y * v.y)";
			case "distance": return "Calculates the distance between two vectors\ndistance(a, b)  ≡  length(b - a)";
			case "dot": return "Calculates the dot product between two vectors\nThe dot product is a measure of the angle between two vectors\nPerpendicular vectors -> 0.0\nCodirectional vectors -> length(a) * length(b)\ndot(a, b)  ≡  a.x * b.x + a.y * b.y + ...";
			// Custom functions
			case "placeSticker":
			case "place_sticker": return "Places the specified sticker at the given uv position\nplace_sticker(sticker, uv);  ≡  placeSticker(sticker, uv);  ≡  COLOR = overlay(COLOR, texture2D(sticker, uv));";
			case "overlay": return "Returns the result of drawing the 2nd RGBA color over the 1st\noverlay(color1, color2)  ≡  mix(color1, color2, color2.a)";
		}
	} else if (token.classList.contains("operator") && showSpecificTooltips["operators"]) {
		// Handle double operators
		let operator = token.innerText;
		const prevToken = getPrevToken(token);
		if (prevToken.classList.contains("operator") && (token.innerText == "=" || token.innerText == prevToken.innerText)) {
			operator = prevToken.innerText + token.innerText;
		} else {
			const nextToken = getNextToken(token);
			if (nextToken.classList.contains("operator") && (nextToken.innerText == "=" || token.innerText == nextToken.innerText)) {
				operator = token.innerText + nextToken.innerText;
			}
		}
		//
		switch (operator) {
			case "=": return "Assignment operator\nEvaluates the expression on the right and assigns it to the variable on the left.";
			case "+": return "Addition operator\n1.0 + 2.0  ≡  3.0";
			case "-": return "Subtraction operator\n3.0 - 2.0  ≡  1.0";
			case "*": return "Multiplication operator\n2.0 * 3.0  ≡  6.0";
			case "/": return "Division operator\n6.0 / 3.0  ≡  2.0";
			case "++": return "Increment operator\na++;  ≡  a = a + 1;";
			case "--": return "Decrement operator\na--;  ≡  na = a - 1;";
			case "+=": return "Addition-assignment operator\na += b;  ≡  a = a + b;";
			case "-=": return "Subtraction-assignment operator\na -= b;  ≡  a = a - b;";
			case "*=": return "Multiplication-assignment operator\na *= b;  ≡  a = a * b;";
			case "/=": return "Division-assignment operator\na /= b;  ≡  a = a / b;";
			case "?":
			case ":": return "[Advanced] Part of a ternary operator\nx = boolean ? 1.0 : 2.0;  ≡  if (boolean) { x = 1.0; } else { x = 2.0; }";
			case "||": return "Boolean Or operator\nReturns true if either operand is true, else returns false";
			case "&&": return "Boolean And operator\nReturns true only if both operands are true, else returns false";
			case "!": return "Boolean Negation operator\nReturns false if the following boolean is true and vice versa";
			case "==": return "Equals operator\nReturns true if the operands have the same value, else false";
			case "!=": return "Not Equals operator\nReturns false if the operands have the same value, else true";
			case "<": return "Less Than operator\nReturns true if the number on the left is less than the number on the right, else false";
			case "<=": return "Less Than Or Equal To operator\nReturns true if the number on the left is less than or equal to the number on the right, else false";
			case ">": return "Greater Than operator\nReturns true if the number on the left is greater than the number on the right, else false";
			case ">=": return "Greater Than Or Equal To operator\nReturns true if the number on the left is greater than or equal to the number on the right, else false";
		}
	} else if (token.classList.contains("uniform_hint") && showSpecificTooltips["hints"]) {
		switch (token.innerText) {
			case "#ignore": return "[Advanced] A uniform hint that specifies no input should be created for this uniform";
			case "#range": return "A uniform hint that specifies the range of input sliders\ne.g. #range(0, 1, 0.01)  gives the slider a range of 0 to 1 with a step of 0.01\nThe step parameter is optional";
			case "#color": return "A uniform hint that specifies that a vec3 or vec4 should be interpreted as a color for the purposes of HTML input controls";
		}
	} else if (token.classList.contains("component_accessor")) {
		const prevToken = getPrevToken(token).innerText;
		const parts = token.innerText.slice(1).split("");
		if (isSwizzle(parts)) {
			if (parts.length == 1) return `Accesses the ${parts[0]} component of ${prevToken}`;
			
			let components = "";
			for (let i = 0; i < parts.length; i++) {
				components += parts[i];
				if (i < parts.length - 1) components += ", ";
			}
			
			if (getNextToken(token).innerText == "=") {
				return `Assigns the ${parts.length}D vector on the right of the\nassignment to the (${components}) components of ${prevToken}`;
			}
			return `Creates a ${parts.length}D vector from the components (${components}) of ${prevToken}\nThis type of access is called swizzling, as you can mix and match\ne.g. v.xyz  or  v.xxx  or  v.zxy`;
		} else {
			return `Accesses the ${token.innerText.slice(1)} field of ${prevToken}`;
		}
	} else if (token.classList.contains("variable")) {
		const variableData = codeVariables[token.innerText];
		if (variableData.type == "struct") return "A custom data type defined by struct";
		const type = variableData?.type ?? "unknown";
		switch (variableData?.varType) {
			case "Uniform": return `Uniform of type ${type}\nA uniform is a top-level variable which allows values to be externally passed into the shader via autogenerated input fields`;
			case "Iterator": return `Iterator of type ${type}\nThis variable is defined in a for loop, and represents a number which increments with each loop`;
			default: return `Variable of type ${type}`;
		}
	}
	return null
}

function getPrevToken(token) {
	return document.evaluate("preceding-sibling::span[contains(@class, 'token')][1]", token, null, XPathResult.FIRST_ORDERED_NODE_TYPE).singleNodeValue;
}
function getNextToken(token) {
	return document.evaluate("following-sibling::span[contains(@class, 'token')]", token, null, XPathResult.FIRST_ORDERED_NODE_TYPE).singleNodeValue;
}

function isSwizzle(parts) {
	let isXYZW = true;
	let isRGBA = true;
	for (let part of parts) {
		if (part != "x" && part != "y" && part != "z" && part != "w") isXYZW = false;
		if (part != "r" && part != "g" && part != "b" && part != "a") isRGBA = false;
	}
	return isXYZW || isRGBA;
}