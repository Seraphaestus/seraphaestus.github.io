let highlighterGrammarModified = false

// Run everything inside window load event handler, to make sure
// DOM is fully loaded and styled before trying to manipulate it,
// and to not mess up the global scope. We are giving the event
// handler a name (setupWebGL) so that we can refer to the
// function object within the function itself.
window.addEventListener("load", () => {
	console.log("CodeTooltips: Loading")
	insertionQ('.token:before').every(onTokenTooltipAdded);
	Prism.hooks.add('before-highlight', modifyHighlighterGrammar);
	console.log("CodeTooltips: Finished loading")
}, {once: true});

function modifyHighlighterGrammar(env) {
	console.log("CodeTooltips: Trying to modify highlighter grammar - ", highlighterGrammarModified)
	if (highlighterGrammarModified) return;
	Prism.languages.insertBefore('glsl', 'keyword', {
		'shader_output': {
			pattern: /\b(?:COLOR)\b/,
			alias: 'keyword',
		},
		'shader_input': {
			pattern: /\b(?:UV|RATIO|COORD|TIME)\b/,
			alias: 'keyword',
		},
		'constant': {
			pattern: /\b(?:PI|TAU|E)\b/,
			alias: 'keyword',
		},
		'builtin_functions': {
			pattern: /\b(?:distance|length|dot)\b/,
			alias: 'function',
		},
	});
	highlighterGrammarModified = true;
}

function onTokenTooltipAdded(token) {
	console.log("CodeTooltips: On token tooltip added - ", token)
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
	const margin = 18;
	if (tooltipLeft < parentRect.left) {
		token.style.setProperty("--offset-x", (parentRect.left - tooltipLeft + margin) + "px");
	} else if (tooltipRight > parentRect.right) {
		token.style.setProperty("--offset-x", (parentRect.right - tooltipRight - margin) + "px");
	}
	if (rect.top < parentRect.top + margin) {
		//token.style.setProperty("--offset-y", "");
	}
}

function getCodeTooltip(token) {
	if (token.classList.contains("keyword")) {
		switch (token.innerText) {
			case "void": return "The output type void means this function does not return a value";
			case "float": return "A data type which represents a decimal number\ne.g. 1.0, 2.345, 999.999";
			case "vec2": return "A data type which represents a 2-dimensional vector\ne.g. 2D coordinate\nIt consists of 2 floats: xy\ne.g. vec2(1.0, 2.0).x  ≡  1.0";
			case "vec3": return "A data type which represents a 3-dimensional vector\ne.g. RGB color\nIt consists of 3 floats: xyz aka rgb\ne.g. vec3(1.0, 2.0, 3.0).z  ≡  3.0";
			case "vec4": return "A data type which represents a 4-dimensional vector\ne.g. RGBA color with transparency\nIt consists of 4 floats: xyzw aka rgba\ne.g. vec4(1.0, 2.0, 3.0, 4.0).yz  ≡  vec2(2.0, 3.0)";
			case "int": return "A data type which represents a whole number\ne.g. 1, 2, 999";
			case "bool": return "A data type which represents a boolean value\nA boolean can be either true or false";
			case "mat2": return "A data type which represents a 2-dimensional matrix, i.e. a 2x2 array of floats";
			case "mat3": return "A data type which represents a 3-dimensional matrix, i.e. a 3x3 array of floats";
			case "mat4": return "A data type which represents a 4-dimensional matrix, i.e. a 4x4 array of floats";
			case "COLOR": return "A vec4 output representing the RGBA color of the given pixel\nCOLOR  ≡  gl_FragColor";
			case "RATIO":
			case "UV": return "A vec2 input representing the position of the pixel on the canvas\nGoes from (0.0, 0.0) at ⇱ to (1.0, 1.0) at ⇲\nRATIO  ≡  UV";
			case "COORD": return "A vec2 input representing the position of the pixel on the canvas\nNormalized to ignore the canvas' aspect ratio\nGoes from (-0.25, 0.0) at ⇱ to (1.25, 1.0) at ⇲\nCOORD  ≡  (RATIO - 0.5) * vec2(<aspect ratio>, 1.0) + 0.5";
			case "TIME": return "A float input representing the number of seconds since the page was loaded";
			case "PI": return "Pi constant: 180° around a circle in radians\nPI  ≡  3.14159265359";
			case "TAU": return "Tau constant: 360° around a circle in radians\nTAU  ≡  6.28318530718";
			case "E": return "Euler's number constant: the base of natural logorithms\nE  ≡  2.71828182846";
			case "true": return "Boolean True constant";
			case "false": return "Boolean False constant";
			case "const": return "Modifies a variable to be constant for efficiency\nOnce initialized, it cannot be given a new value";
			case "uniform": return "Modifies a variable to allow constant values to be externally passed into the shader, using input fields that will be automatically generated above the code box\nUniforms must be declared at the top level, outside of functions\nSupported types: float, vec3 (as color), bool";
			case "continue": return "A statement which causes the code to instantly exit the current iteration of a loop and skip to the next iteration";
			case "break": return "A statement which causes the code to instantly exit the current loop";
			case "if": return "A branch which will only run the code within it if its condition is true\nThe following brackets must contain an expression which evaluates to a boolean true-false value:\nif (true) {}\nif (a < b && a < c) {}";
			case "else": return "A follow-up to an if statement which runs the code within it only if the previous if statement evaluated to false\nif (false) {} else {}\nIt can also chain further if statements like so:\nif (false) {} else if (false) {} else {}"
			case "for": return "A loop which will run the code within it multiple times\nIn the following brackets you must define an iterator variable, its starting value, looping condition, and increment:\nfor (int i = 0; i < n; i += 1) {}\ni starts at 0, and while less than n, increments by 1";
		}
	} else if (token.classList.contains("function")) {
		switch (token.innerText) {
			case "main": return "This is the main function, which will be automatically run for each pixel of the canvas";
			// Maths functions
			case "step": return "Discriminates a boundary.\nCan be thought of returning if a and b are in sorted order\nx = step(a, b);  ≡  if (a <= b) { x = 1.0; } else { x = 0.0; }";
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
		}
	} else if (token.classList.contains("operator")) {
		// Handle double operators
		let operator = token.innerText;
		const prevToken = document.evaluate("preceding-sibling::span[contains(@class, 'token')][1]", token, null, XPathResult.FIRST_ORDERED_NODE_TYPE).singleNodeValue
		console.log(prevToken)
		if (prevToken.classList.contains("operator") && (token.innerText == "=" || token.innerText == prevToken.innerText)) {
			operator = prevToken.innerText + token.innerText;
		} else {
			const nextToken = document.evaluate("following-sibling::span[contains(@class, 'token')]", token, null, XPathResult.FIRST_ORDERED_NODE_TYPE).singleNodeValue
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
			case ":": return 'Part of a ternary operator\nx = boolean ? 1.0 : 2.0;  ≡  if (boolean) { x = 1.0; } else { x = 2.0; }';
			case "||": return "Boolean Or operator\nReturns true if either operand is true, else returns false";
			case "&&": return "Boolean And operator\nReturns true only if both operands are true, else returns false";
			case "!": return "Boolean Negation operator\nReturns false if the boolean is true and vice versa";
			case "==": return "Equals operator\nReturns true if the operands have the same value, else false";
			case "!=": return "Not Equals operator\nReturns false if the operands have the same value, else true";
			case "<": return "Less Than operator\nReturns true if the number on the left is less than the number on the right, else false";
			case "<=": return "Less Than Or Equal To operator\nReturns true if the number on the left is less than or equal to the number on the right, else false";
			case ">": return "Greater Than operator\nReturns true if the number on the left is greater than the number on the right, else false";
			case ">=": return "Greater Than Or Equal To operator\nReturns true if the number on the left is greater than or equal to the number on the right, else false";
		}
	}
	return null
}