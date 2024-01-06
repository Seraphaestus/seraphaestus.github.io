let codeJarPostInit = false
let showSpecificTooltips = {}
let codeVariables

const vectorRegex = /[ibdu]?vec[234]/
const typeRegex = String.raw`(?:float|double|int|bool|d?mat[234](?:x[234])?|[ibdu]?vec[234]|uint|[iu]?sampler[123]D|[iu]?samplerCube|sampler[12]DShadow|samplerCubeShadow|[iu]?sampler[12]DArray|sampler[12]DArrayShadow|[iu]?sampler2DRect|sampler2DRectShadow|[iu]?samplerBuffer|[iu]?sampler2DMS(?:Array)?|[iu]?samplerCubeArray|samplerCubeArrayShadow|[iu]?image[123]D|[iu]?image2DRect|[iu]?imageCube|[iu]?imageBuffer|[iu]?image[12]DArray|[iu]?imageCubeArray|[iu]?image2DMS(?:Array)?|struct|hvec[234]|fvec[234]|sampler3DRect|filter)`
const varDefRegex = new RegExp(String.raw`\b(uniform\s+|for\s*\(\s*)?(${typeRegex})\s+(\w+)\b`, "g");

window.addEventListener("load", () => {
	const settingsData = JSON.parse(localStorage.getItem("settings")) ?? {};
	const showCodeTooltips = settingsData["show-code-tooltips"] ?? true;
	
	if (showCodeTooltips) {
		// Load granular options
		for (let option of ["keywords", "types", "functions", "constants", "operators", "hints"]) {
			showSpecificTooltips[option] = settingsData["show-code-tooltips." + option] ?? true;
		}
		
		for (let codeJar of document.getElementsByClassName("codejar-wrap")) {
			const tooltipOrigin = document.createElement("div");
			tooltipOrigin.className = "tooltip-origin";
			tooltipOrigin.style = "display:none;";
			codeJar.appendChild(tooltipOrigin);
			
			const tooltip = document.createElement("div");
			tooltip.className = "tooltip";
			tooltipOrigin.appendChild(tooltip);
		}
		
		Prism.hooks.add('complete', (context) => {
			$(context.element).children(".token").hover((event) => {setTokenTooltip(event.target);}, () => {removeTokenTooltip(event.target);});
		});
	}
	
	Prism.hooks.add('before-highlight', onCodeJarPostInit);
	
	// I don't know why, but neither of the above callbacks are running on the live site (while working fine on local)
	// until each .editor element is updated somewhow, so here:
	for (let editor of document.getElementsByClassName("editor")) {
		editor.innerHTML = editor.innerHTML
	}

}, {once: true});

function onCodeJarPostInit(env) {
	if (!codeJarPostInit) {;
		modifyHighlighterGrammar(env);
		codeJarPostInit = true;
	}
}

function modifyHighlighterGrammar(env) {
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
}

function getTokenTooltip(token) {
	return token.closest(".codejar-wrap").querySelector(".tooltip-origin");
}

function setTokenTooltip(token) {
	const tooltipText = formatCodeTooltip(getCodeTooltip(token));
	if (tooltipText == null) return;
	
	const tooltipOrigin = getTokenTooltip(token);
	const tooltip = tooltipOrigin.firstElementChild;
	tooltip.innerHTML = tooltipText;
	tooltipOrigin.style.display = "block";
	
	const editor = token.parentElement;
	const bounds = editor.getBoundingClientRect();
	
	const tokenRect = token.getBoundingClientRect();
	const tokenPos = {x: tokenRect.left + tokenRect.width / 2, y: tokenRect.top + tokenRect.height / 2};
	let tooltipPos = {x: tokenPos.x - bounds.left, y: tokenPos.y - bounds.top};
	tooltipOrigin.style.inset = `${tooltipPos.y}px ${tooltipPos.x}px`;
	
	// Decreasing bounds by padding to account for linenumbers area
	const desiredPadding = 6;
	let padding = {};
	for (let dir of ["left", "right", "top", "bottom"]) {
		padding[dir] = parseInt(window.getComputedStyle(editor, null)?.getPropertyValue("padding-" + dir)) - (10 - desiredPadding) ?? 0;
	}
	
	const tooltipRect = tooltip.getBoundingClientRect();
	const tooltipRadius = {x: tooltipRect.width / 2, y: tooltipRect.height / 2};
	
	if (tooltipPos.x - tooltipRadius.x < bounds.left + padding.left) {
		tooltip.style.translate = `${-tooltipPos.x + tooltipRadius.x + padding.left}px 0`;
	} else if (tooltipPos.x + tooltipRadius.x > bounds.right - padding.right) {
		tooltip.style.translate = `${-tooltipPos.x + bounds.width - tooltipRadius.x - padding.right}px 0`;
	} else {
		tooltip.style.translate = "";
	}
	
}

function removeTokenTooltip(token) {
	getTokenTooltip(token).style.display = "none";
}

function formatCodeTooltip(tooltip) {
	if (tooltip == null) return tooltip;
	if (Array.isArray(tooltip)) tooltip = tooltip.join("\n");
	return tooltip.replace(/>/g, "</span>")
		.replace(/<low:/g, "<span class='tooltip-text-lesser'>")
		.replace(/<ex:/g,  "<span class='tooltip-text-example'>")
		.replace(/<c:/g,   "<span class='tooltip-text-code'>")
		.replace(/<eq:/g,  "<span class='tooltip-text-equivalence'>")
		.replace(/<tag:/g, "<span class='tooltip-text-tag'>");
}

function getCodeTooltip(token) {
	if (token.classList.contains("constant") && showSpecificTooltips["constants"]) {
		switch (token.innerText) {
			case "true": return "Boolean True constant";
			case "false": return "Boolean False constant";
			case "PI": return ["Pi constant: 180° around a circle in radians", "PI  ≡  3.14159265359"];
			case "TAU": return ["Tau constant: 360° around a circle in radians", "TAU  ≡  6.28318530718"];
			case "E": return ["Euler's number constant: the base of natural logorithms", "E  ≡  2.71828182846"];
		}
	}
	const constructorType = token.classList.contains("constructor_type");
	const returnType = token.classList.contains("return_type");
	if (token.classList.contains("type") && showSpecificTooltips["types"]) {
		let advanced = false;
		let tooltip = "";
		switch (token.innerText) {
			case "float":  tooltip = ["represents a decimal number", "<ex:e.g. 1.0, 2.345, 999.999>"]; break;
			case "vec2":   tooltip = ["represents a 2-dimensional vector", "<ex:e.g. 2D coordinate>", "It consists of 2 floats: xy", "<ex:e.g. <eq:vec2(1.0, 2.0).x  ≡  1.0>>"]; break;
			case "vec3":   tooltip = ["represents a 3-dimensional vector", "<ex:e.g. RGB color>", "It consists of 3 floats: xyz aka rgb", "<ex:e.g. <eq:vec3(1.0, 2.0, 3.0).z  ≡  3.0>>"]; break;
			case "vec4":   tooltip = ["represents a 4-dimensional vector", "<ex:e.g. RGBA color with transparency>", "It consists of 4 floats: xyzw aka rgba", "<ex:e.g. <eq:vec4(1.0, 2.0, 3.0, 4.0).yz  ≡  vec2(2.0, 3.0)>>"]; break;
			case "int":    advanced = true; tooltip = ["represents a whole number", "<ex:e.g. 1, 2, 999>"]; break;
			case "ivec2":  advanced = true; tooltip = ["represents a 2-dimensional vector of whole numbers", "It consists of 2 ints: xy", "<ex:e.g. <eq:ivec2(1, 2).x  ≡  1>>"]; break;
			case "ivec3":  advanced = true; tooltip = ["represents a 3-dimensional vector of whole numbers", "It consists of 3 ints: xyz aka rgb", "<ex:e.g. <eq:ivec3(1, 2, 3).z  ≡  3>>"]; break;
			case "ivec4":  advanced = true; tooltip = ["represents a 4-dimensional vector of whole numbers", "It consists of 4 ints: xyzw aka rgba", "<ex:e.g. <eq:ivec4(1, 2, 3, 4).yz  ≡  ivec2(2, 3)>>"]; break;
			case "bool":   tooltip = ["represents a boolean value", "A boolean can be either <c:true> or <c:false>"]; break;
			case "mat2":   advanced = true; tooltip = ["represents a 2-dimensional matrix, i.e. a 2x2 array of floats"]; break;
			case "mat3":   advanced = true; tooltip = ["represents a 3-dimensional matrix, i.e. a 3x3 array of floats"]; break;
			case "mat4":   advanced = true; tooltip = ["represents a 4-dimensional matrix, i.e. a 4x4 array of floats"]; break;
			case "struct": advanced = true; tooltip = ["groups variables as one object.", "<ex:e.g. <c:struct example { float f; bool b; };>>", "<ex:<c:example x = example(0.0, true);>>", "<low:Struct variables can also be declared inline after the struct definition.> <ex:e.g. <c:struct example {float f;} x;>>"]; break;
			default: return "I don't know what you're doing with this but good luck!";
		}
		let prefix = advanced ? "<tag:[Advanced]> " : "";
		if (token.classList.contains("constructor_type")) {
			tooltip[0] = prefix + "A constructor which takes parameters to create a value of the given type. <ex:e.g. <c:vec2 x = vec2(0.0, 1.0);>>\n<low:This data type " + tooltip[0] + ">";
		} else if (token.classList.contains("return_type")) {
			tooltip[0] = prefix + `Specifies what type of value the function ${getNextToken(token).innerText} returns\n<low:This data type ` + tooltip[0] + ">";
		} else {
			tooltip[0] = prefix + "A data type which " + tooltip[0];
		}
		return tooltip;
	}
	if (token.classList.contains("keyword") && showSpecificTooltips["keywords"]) {
		switch (token.innerText) {
			case "main": return "This is the main function, which will be automatically run for each pixel of the canvas";
			case "void": return "The output type void means this function does not return a value";
			
			case "break":    return "A statement which causes the code to instantly exit the current loop";
			case "continue": return "A statement which causes the code to instantly exit the current iteration of a loop and skip to the next iteration";
			case "return":   return "A statement which causes the code to instantly exit the current function and output the following value, which the function will thereby evaluate to when called.";
			case "discard":  return "<tag:[Advanced]> A statement which causes the code to instantly exit the fragment shader and discard the current pixel of the canvas.";
			
			case "if":    return ["A branch which will only run the code within it if its condition is true", "The following brackets must contain an expression which evaluates to a boolean true-false value:", "<ex:<c:if (true) {}\nif (a < b && a < c) {}>>"];
			case "else":  return ["A follow-up to an if statement which runs the code within it only if the previous if statement evaluated to false", "<ex:if (false) {} else {}>", "It can also chain further if statements like so:", "<ex:<c:if (false) {} else if (false) {} else {}]>>"];
			case "for":   return ["A loop which will run the code within it multiple times", "In the following brackets you must define an iterator variable, its starting value, looping condition, and increment:", "<ex:<c:for (int i = 0; i < n; i += 1) {}>>", "i starts at 0, and while less than n, increments by 1"];
			case "while": return ["<tag:[Unavailable]> A loop which will keep running the code within it until its condition is no longer true", "While loops are not available in WebGL  :("];
			
			case "const":   return ["Modifies a variable to be constant for efficiency", "Once initialized, it cannot be given a new value"];
			case "uniform": return ["Modifies a variable to allow constant values to be externally passed into the shader, using input fields that will be automatically generated above the code box", "<low:Uniforms must be declared at the top level, outside of functions>"];
			
			case "COLOR": return ["A vec4 output representing the RGBA color of the given pixel", "<eq:COLOR  ≡  gl_FragColor>"];
			case "RATIO":
			case "UV":    return ["A vec2 input representing the position of the pixel on the canvas", "Goes from <ex:(0.0, 0.0)> at ⇱ to <ex:(1.0, 1.0)> at ⇲", "<eq:RATIO  ≡  UV>"];
			case "COORD": return ["A vec2 input representing the position of the pixel on the canvas", "Normalized to ignore the canvas' aspect ratio", "Goes from <ex:(-0.25, 0.0)> at ⇱ to <ex:(1.25, 1.0)> at ⇲", "<eq:COORD  ≡  (RATIO - 0.5) * vec2(<aspect ratio>, 1.0) + 0.5>"];
			case "TIME":  return ["A float input representing the number of seconds since the page was loaded"];
		}
	} else if (token.classList.contains("function") && showSpecificTooltips["functions"]) {
		switch (token.innerText) {
			// Maths functions
			case "step":  return ["Discriminates a boundary.", "Can be thought of returning if a and b are in sorted order", "<eq:x = step(a, b);  ≡  if (a <= b) { x = 1.0; } else { x = 0.0; }>", "See also <c:steps(a, b, c)>"];
			case "steps": return ["Discrimates an upper and lower boundary.", "Can be thought of returning if (a and b) and (b and c) are in sorted order", "<eq:steps(a, b, c)  ≡  step(a, b) * step(b, c)>"];
			case "mix": 
			case "lerp":  return ["Linearly interpolates between two inputs", "<ex:e.g. <c:mix(a, b, 0.5)> returns 50% of the way from a to b>", "<eq:mix(a, b, t)  ≡  lerp(a, b, t)  ≡  a + t * (b - a)>"];
			case "min":   return ["Returns the minimum of two inputs", "<eq:x = min(a, b);  ≡  if (a < b) { x = a; } else { x = b; }>"];
			case "max":   return ["Returns the minimum of two inputs", "<eq:x = max(a, b);  ≡  if (a > b) { x = a; } else { x = b; }>"];
			case "clamp": return ["Contrains the input between two values", "<eq:clamp(x, minimum, maxmimum)  ≡  min(maximum, max(x, minimum))>"];
			case "floor": return ["Rounds to the next whole number less than or equal to the input", "<eq:floor(x)  ≡  float(int(x))>"];
			case "ceil":  return ["Rounds to the next whole number greater than or equal to the input", "<eq:ceil(x)  ≡  float(int(x + 1.0))>"];
			case "pow":   return ["Calculates the result of raising a value to a given exponent", "<ex:e.g. <eq:pow(x, 0.5)  ≡  sqrt(x)\n   pow(x, 2.0)  ≡  x * x>>"];
			case "log":   return ["Returns the natural logorithm of the value", "To get logorithms of any base, use <c:log(x) / log(base)>", "<eq:pow(E, log(x))  ≡  x>"];
			case "mod":   return ["Modulo function, returning the remainder of a division", "Effectively constrains a value into a repeating range (0, n)", "<eq:mod(x, n)  ≡  x - n * floor(x / n)>"];
			case "sqrt":  return ["Returns the square root of a value", "<eq:sqrt(x) * sqrt(x)  ≡  x>"];
			case "abs":   return ["Absolute function, returning the positive version of the value regardless of its sign", "<ex:e.g. <eq:nabs(-1)  ≡  1\nabs(x)  ≡  sign(x) * x>>"];
			case "sign":  return ["Returns the sign of the value regardless of its magnitude", "<eq:sign(83)  ≡  1\nsign(-7)  ≡  -1\nsign(x)  ≡  x / abs(x)>"];
			// Trigonometry functions
			case "sin": return ["Sine trigonometric function", "<low:Oscillates between -1 and 1 over a period of TAU, starting at 0>", "<eq:sin(x)  ≡  cos(x - TAU / 4.0)>"];
			case "cos": return ["Cosine trigonometric function", "<low:Oscillates between -1 and 1 over a period of TAU, starting at 1>", "<eq:cos(x)  ≡  sin(x + TAU / 4.0)>"];
			case "tan": return ["Tangent trigonometric function", "<eq:tan(x)  ≡  sin(x) / cos(x)>"];
			case "degrees": return ["Converts an angle from radians to degrees", "<eq:degrees(a)  ≡  360 * a / TAU>"];
			case "radians": return ["Converts an angle from degrees to radians", "<eq:radians(a)  ≡  TAU * a / 360>"];
			// Vector functions
			case "normalize": return ["Returns a vector with the same direction and a length of 1.0", "<eq:normalize(v)  ≡  v / length(v)>"];
			case "length":    return ["Calculates the length of a vector", "<eq:length(v)  ≡  sqrt(v.x * v.x + v.y * v.y)>"];
			case "distance":  return ["Calculates the distance between two vectors", "<eq:distance(a, b)  ≡  length(b - a)>"];
			case "dot":       return ["Calculates the dot product between two vectors", "<low:The dot product is a measure of the angle between two vectors>", "<ex:Perpendicular vectors → 0.0                  >", "<ex:Codirectional vectors → length(a) * length(b)>", "<eq:dot(a, b)  ≡  a.x * b.x + a.y * b.y + ...>"];
			// Custom functions
			case "placeSticker":
			case "place_sticker": return ["Places the specified sticker at the given uv position", "<eq:place_sticker(sticker, uv);  ≡  placeSticker(sticker, uv);  ≡  COLOR = overlay(COLOR, texture2D(sticker, uv));>"];
			case "overlay":       return ["Returns the result of drawing the 2nd RGBA color over the 1st", "<eq:overlay(color1, color2)  ≡  mix(color1, color2, color2.a)>"];
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
			case "=": return ["Assignment operator", "Evaluates the expression on the right and assigns it to the variable on the left."];
			case "+": return ["Addition operator", "<eq:1.0 + 2.0  ≡  3.0>"];
			case "-": return ["Subtraction operator", "<eq:3.0 - 2.0  ≡  1.0>"];
			case "*": return ["Multiplication operator", "<eq:2.0 * 3.0  ≡  6.0>"];
			case "/": return ["Division operator", "<eq:6.0 / 3.0  ≡  2.0>"];
			case "++": return ["Increment operator", "<eq:a++;  ≡  a = a + 1;>"];
			case "--": return ["Decrement operator", "<eq:a--;  ≡  na = a - 1;>"];
			case "+=": return ["Addition-assignment operator", "<eq:a += b;  ≡  a = a + b;>"];
			case "-=": return ["Subtraction-assignment operator", "<eq:a -= b;  ≡  a = a - b;>"];
			case "*=": return ["Multiplication-assignment operator", "<eq:a *= b;  ≡  a = a * b;>"];
			case "/=": return ["Division-assignment operator", "<eq:a /= b;  ≡  a = a / b;>"];
			case "?":
			case ":":  return ["<tag:[Advanced]> Part of a ternary operator", "<eq:x = boolean ? 1.0 : 2.0;  ≡  if (boolean) { x = 1.0; } else { x = 2.0; }>"];
			case "||": return ["Boolean Or operator", "<low:Returns <c:true> if either operand is <c:true>, else returns <c:false>>"];
			case "&&": return ["Boolean And operator", "<low:Returns <c:true> only if both operands are <c:true>, else returns <c:false>>"];
			case "!":  return ["Boolean Negation operator", "<low:Returns <c:false> if the following boolean is <c:true> and vice versa>"];
			case "==": return ["Equals operator", "<low:Returns <c:true> if the operands have the same value, else <c:false>>"];
			case "!=": return ["Not Equals operator", "<low:Returns <c:false> if the operands have the same value, else <c:true>>"];
			case "<":  return ["Less Than operator", "<low:Returns <c:true> if the number on the left is less than the number on the right, else <c:false>>"];
			case "<=": return ["Less Than Or Equal To operator", "<low:Returns <c:true> if the number on the left is less than or equal to the number on the right, else <c:false>>"];
			case ">":  return ["Greater Than operator", "<low:Returns <c:true> if the number on the left is greater than the number on the right, else <c:false>>"];
			case ">=": return ["Greater Than Or Equal To operator", "<low:Returns <c:true> if the number on the left is greater than or equal to the number on the right, else <c:false>>"];
		}
	} else if (token.classList.contains("uniform_hint") && showSpecificTooltips["hints"]) {
		switch (token.innerText) {
			case "#ignore": return "<tag:[Advanced]> A uniform hint that specifies no input should be created for this uniform";
			case "#range": return ["A uniform hint that specifies the range of input sliders", "<ex:e.g. <c:#range(0, 1, 0.01)> gives the slider a range of 0 to 1 with a step of 0.01>", "<low:The step parameter is optional>"];
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
				return [`Assigns the ${parts.length}D vector on the right of the`, `assignment to the (${components}) components of ${prevToken}`];
			}
			return [`Creates a ${parts.length}D vector from the components (${components}) of ${prevToken}`, "<low:This type of access is called swizzling, as you can mix and match>", "<ex:e.g. <c:v.xyz>  or  <c:v.xxx>  or  <c:v.zxy>>"];
		} else {
			return `Accesses the ${token.innerText.slice(1)} field of ${prevToken}`;
		}
	} else if (token.classList.contains("variable")) {;
		const variableData = codeVariables[token.innerText];
		if (variableData?.type == "struct") return "A custom data type defined by struct";
		const type = variableData?.type ?? "unknown";
		switch (variableData?.varType) {
			case "Uniform": return [`Uniform of type ${type}`, "<low:A uniform is a top-level variable which allows values to be externally passed into the shader via autogenerated input fields>"];
			case "Iterator": return `Iterator of type ${type}`, "<low:This variable is defined in a for loop, and represents a number which increments with each loop>";
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

function getCodeVariables(code) {
	let output = {}
	for (let varDefMatch of code.matchAll(varDefRegex)) {
		let varType = null;
		if (varDefMatch[1]?.startsWith("uniform")) varType = "Uniform";
		else if (varDefMatch[1]?.startsWith("for")) varType = "Iterator";
		output[varDefMatch[3]] = {type: varDefMatch[2], varType: varType};
	}
	return output;
}