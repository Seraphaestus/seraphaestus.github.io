class ShadeableCanvas {
	
	constructor(canvas, fallbackText) {
		this.canvas = canvas
		this.webGL = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
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
		this.vertexShader = null;
		this.fragmentShaderSource = null // To keep track of if it has actually changed
		this.fragmentInfoLog = null
		
		this.vertexShaderSource = 
			"attribute vec2 a_position;\n" +
			"attribute vec2 a_uv;\n" +
			"varying mediump vec2 UV;\n\n" +
			
			"void main() {\n" + 
			"	gl_Position = vec4(a_position, 0.0, 1.0);\n" +
			"	UV = a_uv;\n" +
			"}";
		this.fragmentSourcePrepend =
			"varying mediump vec2 UV;\n";
	}
	
	hasSourceChanged(source) {
		if (this.fragmentShaderSource == source) return false
		this.fragmentShaderSource = source
		return true
	}
	
	updateShader(source) {
		const program = this.createShaderProgram(this.vertexShaderSource, this.fragmentSourcePrepend + source)
		
		if (!this.webGL.getProgramParameter(program, this.webGL.LINK_STATUS)) {
			const linkErrorLog = this.webGL.getProgramInfoLog(program);
			return this.fragmentInfoLog;
		}
		
		this.webGL.useProgram(program);
		
		// Attributes
		WebGLUtils.setBuffersAndAttributes(this.webGL, program, WebGLUtils.createBuffersForScreenQuad(this.webGL))
		
		// Uniforms
		WebGLUtils.setUniforms(this.webGL, program, {
			vertexScale: [1.0, this.canvas.width / this.canvas.height],
		});
		
		this.webGL.drawArrays(this.webGL.TRIANGLE_STRIP, 0, 4)
	}

	createShaderProgram(vertexSource, fragmentSource) {
		//console.log("Vertex source: " + vertexSource)
		//console.log("Fragment source: " + fragmentSource)
		const program = this.webGL.createProgram();
		
		if (!this.vertexShader) this.vertexShader = WebGLUtils.createShader(this.webGL, this.webGL.VERTEX_SHADER, vertexSource);
		this.webGL.attachShader(program, this.vertexShader);
		
		const fragmentShader = WebGLUtils.createShader(this.webGL, this.webGL.FRAGMENT_SHADER, fragmentSource);
		this.fragmentInfoLog = this.webGL.getShaderInfoLog(fragmentShader);
		this.webGL.attachShader(program, fragmentShader);
		
		this.webGL.linkProgram(program);
		
		// Clean up shaders from program
		this.webGL.detachShader(program, fragmentShader);
		this.webGL.detachShader(program, this.vertexShader);
		this.webGL.deleteShader(fragmentShader);
		
		return program
	}
}