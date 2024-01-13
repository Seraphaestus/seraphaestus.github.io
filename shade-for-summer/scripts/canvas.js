const vertexShaderSource = 
	"attribute vec2 a_position;\n" +
	"attribute vec2 a_uv;\n" +
	"varying mediump vec2 RATIO;\n" +
	"varying mediump vec2 COORD;\n" +
	
	"void main() {\n" + 
	"	gl_Position = vec4(a_position, 0.0, 1.0);\n" +
	"	RATIO = a_uv;\n" +
	"	COORD = (a_uv - 0.5) * vec2(1.5, 1.0) + 0.5;\n" +
	"}";

class ShadeableCanvas {
	
	program = null;
	vertexShader = null;
	fragmentShaderSource = null; // To keep track of if it has actually changed
	fragmentInfoLog = null;
	
	constructor(canvas, fallbackText, useAlpha = true) {
		this.canvas = canvas
		const contextParams = useAlpha ? {premultipliedAlpha: false, antialias: false} : {alpha: false, antialias: false}
		this.webGL = canvas.getContext("webgl", contextParams) || canvas.getContext("experimental-webgl", contextParams);
		if (!this.webGL && fallbackText) {
			fallbackText.innerHTML =
				"Failed to get WebGL context. " +
				"Your browser or device may not support WebGL.";
			return;
		}
		
		this.webGL.viewport(0, 0, this.webGL.drawingBufferWidth, this.webGL.drawingBufferHeight);
		this.webGL.clearColor(0.2, 0.2, 0.2, 1.0);
		this.webGL.clear(this.webGL.COLOR_BUFFER_BIT);
	}
	
	hasSourceChanged(source) {
		if (this.fragmentShaderSource == source) return false
		this.fragmentShaderSource = source
		return true
	}
	
	recreateShader(source, uniformValues) {
		this.createShaderProgram(vertexShaderSource, source);
		
		if (!this.webGL.getProgramParameter(this.program, this.webGL.LINK_STATUS)) {
			const linkErrorLog = this.webGL.getProgramInfoLog(this.program);
			this.program = null;
			return this.fragmentInfoLog;
		}
		
		this.webGL.useProgram(this.program);
		
		// Attributes
		WebGLUtils.setBuffersAndAttributes(this.webGL, this.program, WebGLUtils.createBuffersForScreenQuad(this.webGL))
		
		// Uniforms
		this.setVectorUniform("TIME", [time ?? 0.0]);
		for (let varName in uniformValues) {
			if (!uniformValues[varName].shaderValue) continue;
			this.setVectorUniform(varName, uniformValues[varName].shaderValue, uniformValues[varName].isFloat ?? true);
		}
		
		this.webGL.drawArrays(this.webGL.TRIANGLE_STRIP, 0, 4);
	}
	
	redrawShader(uniformValues) {
		if (!this.program) return;
		
		// Uniforms
		this.setVectorUniform("TIME", [time ?? 0.0]);
		for (let varName in uniformValues) {
			if (!uniformValues[varName].shaderValue) continue;
			this.setVectorUniform(varName, uniformValues[varName].shaderValue, uniformValues[varName].isFloat ?? true);
		}
		
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
	
	setTextureUniforms(textures, runningLocally = false) {
		if (!this.program) return;
		this.textureIndex = 0;
		for (let textureName in textures) {
			this.setSamplerUniform(textureName, textures[textureName], runningLocally);
			this.textureIndex++;
		}
		this.webGL.drawArrays(this.webGL.TRIANGLE_STRIP, 0, 4);
	}
	
	setSamplerUniform(varName, textureUrl, runningLocally = false) {
		const uniformLocation = this.webGL.getUniformLocation(this.program, varName);
		
		this.webGL.uniform1i(uniformLocation, this.textureIndex);
		// Load texture
		const texture = WebGLUtils.loadTexture(this.webGL, textureUrl, this.textureIndex, runningLocally);
		// Flip image pixels into the bottom-to-top order that WebGL expects.
		this.webGL.pixelStorei(this.webGL.UNPACK_FLIP_Y_WEBGL, true);
	}
	
	setVectorUniform(varName, components, isFloat = true) {
		const uniformLocation = this.webGL.getUniformLocation(this.program, varName);
		if (isFloat) {
			switch (components.length) {
				case 1: this.webGL.uniform1fv(uniformLocation, components); break;
				case 2: this.webGL.uniform2fv(uniformLocation, components); break;
				case 3: this.webGL.uniform3fv(uniformLocation, components); break;
				case 4: this.webGL.uniform4fv(uniformLocation, components); break;
			}
		} else {
			switch (components.length) {
				case 1: this.webGL.uniform1iv(uniformLocation, components); break;
				case 2: this.webGL.uniform2iv(uniformLocation, components); break;
				case 3: this.webGL.uniform3iv(uniformLocation, components); break;
				case 4: this.webGL.uniform4iv(uniformLocation, components); break;
			}
		}
	}
}