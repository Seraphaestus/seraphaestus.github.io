class ShadeableCanvas {
	
	constructor(canvas, fallbackText, useAlpha = true) {
		this.canvas = canvas
		const contextParams = useAlpha ? {premultipliedAlpha: false, antialias: false} : {alpha: false, antialias: false}
		this.webGL = canvas.getContext("webgl", contextParams) || canvas.getContext("experimental-webgl", contextParams);
		if (!this.webGL) {
			fallbackText.innerHTML =
				"Failed to get WebGL context. " +
				"Your browser or device may not support WebGL.";
			return;
		}
		
		this.webGL.viewport(0, 0, this.webGL.drawingBufferWidth, this.webGL.drawingBufferHeight);
		this.webGL.clearColor(0.2, 0.2, 0.2, 1.0);
		this.webGL.clear(this.webGL.COLOR_BUFFER_BIT);
		
		// Variables
		this.program = null;
		this.vertexShader = null;
		this.fragmentShaderSource = null // To keep track of if it has actually changed
		this.fragmentInfoLog = null
		
		this.vertexShaderSource = 
			"attribute vec2 a_position;\n" +
			"attribute vec2 a_uv;\n" +
			"varying mediump vec2 RATIO;\n" +
			"varying mediump vec2 COORD;\n" +
			
			"void main() {\n" + 
			"	gl_Position = vec4(a_position, 0.0, 1.0);\n" +
			"	RATIO = a_uv;\n" +
			"	COORD = (a_uv - 0.5) * vec2(1.5, 1.0) + 0.5;\n" +
			"}";
	}
	
	hasSourceChanged(source) {
		if (this.fragmentShaderSource == source) return false
		this.fragmentShaderSource = source
		return true
	}
	
	recreateShader(source) {
		this.createShaderProgram(this.vertexShaderSource, source);
		
		if (!this.webGL.getProgramParameter(this.program, this.webGL.LINK_STATUS)) {
			const linkErrorLog = this.webGL.getProgramInfoLog(this.program);
			this.program = null;
			return this.fragmentInfoLog;
		}
		
		this.webGL.useProgram(this.program);
		
		// Attributes
		WebGLUtils.setBuffersAndAttributes(this.webGL, this.program, WebGLUtils.createBuffersForScreenQuad(this.webGL))
		
		// Uniforms
		let uniforms = {TIME: [0.0]}
		for (let varName in uniformValues) {
			if (!uniformValues[varName].shaderValue) continue;
			uniforms[varName] = uniformValues[varName].shaderValue;
		}
		WebGLUtils.setUniforms(this.webGL, this.program, uniforms);
		
		this.webGL.drawArrays(this.webGL.TRIANGLE_STRIP, 0, 4);
	}
	
	redrawShader() {
		// Uniforms
		let uniforms = {TIME: [time]}
		for (let varName in uniformValues) {
			if (!uniformValues[varName].shaderValue) continue;
			uniforms[varName] = uniformValues[varName].shaderValue;
		}
		WebGLUtils.setUniforms(this.webGL, this.program, uniforms);
		
		this.webGL.drawArrays(this.webGL.TRIANGLE_STRIP, 0, 4);
	}

	createShaderProgram(vertexSource, fragmentSource) {
		//console.log("Vertex source: " + vertexSource)
		//console.log("Fragment source: " + fragmentSource)
		this.program = this.webGL.createProgram();
		
		if (!this.vertexShader) this.vertexShader = WebGLUtils.createShader(this.webGL, this.webGL.VERTEX_SHADER, vertexSource);
		this.webGL.attachShader(this.program, this.vertexShader);
		
		const fragmentShader = WebGLUtils.createShader(this.webGL, this.webGL.FRAGMENT_SHADER, fragmentSource);
		this.fragmentInfoLog = this.webGL.getShaderInfoLog(fragmentShader);
		this.webGL.attachShader(this.program, fragmentShader);
		
		this.webGL.linkProgram(this.program);
		
		// Clean up shaders from program
		this.webGL.detachShader(this.program, fragmentShader);
		this.webGL.detachShader(this.program, this.vertexShader);
		this.webGL.deleteShader(fragmentShader);
	}
}