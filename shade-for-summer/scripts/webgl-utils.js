const WebGLUtils = {
	
	createShader: function(webGL, type, source) {
		const shader = webGL.createShader(type);
		webGL.shaderSource(shader, source);
		webGL.compileShader(shader);
		return shader;
	},
	
	createBuffersForScreenQuad: function(webGL) {
		var posBuffer = webGL.createBuffer();
		webGL.bindBuffer(webGL.ARRAY_BUFFER, posBuffer);
		var vertices = [-1, -1, 1, -1, -1, 1, 1, 1];
		webGL.bufferData(webGL.ARRAY_BUFFER, new Float32Array(vertices), webGL.STATIC_DRAW);
		posBuffer.itemSize = 2;
		posBuffer.numItems = 4;
		
		var uvBuffer = webGL.createBuffer();
		webGL.bindBuffer(webGL.ARRAY_BUFFER, uvBuffer);
		var uvs = [0, 0, 1, 0, 0, 1, 1, 1];
		webGL.bufferData(webGL.ARRAY_BUFFER, new Float32Array(vertices), webGL.STATIC_DRAW);
		uvBuffer.itemSize = 2;
		uvBuffer.numItems = 4;
		
		return {
			a_position: {buffer: posBuffer, numComponents: 2, array: vertices}, 
			a_uv: {buffer: uvBuffer, numComponents: 2, array: uvs},
		};
	},
	
	setBuffersAndAttributes: function(webGL, program, attributes) {
		for (const [name, attribute] of Object.entries(attributes)) {
			const attribLocation = webGL.getAttribLocation(program, name);
			webGL.enableVertexAttribArray(attribLocation);
			webGL.bindBuffer(webGL.ARRAY_BUFFER, attribute.buffer);
			webGL.bufferData(webGL.ARRAY_BUFFER, new Float32Array(attribute.array), webGL.STATIC_DRAW);
			webGL.vertexAttribPointer(attribLocation, attribute.numComponents, webGL.FLOAT, false, 0, 0);
		}
	},
	
	setUniforms: function(webGL, program, uniforms) {
		for (const [name, uniform] of Object.entries(uniforms)) {
			const uniformLocation = webGL.getUniformLocation(program, name);
			switch (uniform.length) {
				case 1: webGL.uniform1f(uniformLocation, uniform); break;
				case 2: webGL.uniform2fv(uniformLocation, uniform); break;
				case 3: webGL.uniform3fv(uniformLocation, uniform); break;
				case 4: webGL.uniform4fv(uniformLocation, uniform); break;
			}
		}
	},
}