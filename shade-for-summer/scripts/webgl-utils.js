const WebGLUtils = {
	
	createShader: function(webGL, type, source) {
		const shader = webGL.createShader(type);
		webGL.shaderSource(shader, source);
		webGL.compileShader(shader);
		return shader;
	},
	
	createBuffersForScreenQuad: function(webGL) {
		let posBuffer = webGL.createBuffer();
		webGL.bindBuffer(webGL.ARRAY_BUFFER, posBuffer);
		let vertices = [-1, -1, 1, -1, -1, 1, 1, 1];
		webGL.bufferData(webGL.ARRAY_BUFFER, new Float32Array(vertices), webGL.STATIC_DRAW);
		posBuffer.itemSize = 2;
		posBuffer.numItems = 4;
		
		let uvBuffer = webGL.createBuffer();
		webGL.bindBuffer(webGL.ARRAY_BUFFER, uvBuffer);
		let uvs = [0, 0, 1, 0, 0, 1, 1, 1];
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
	
	// https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Tutorial/Using_textures_in_WebGL
	loadTexture: function(webGL, url, textureIndex = 0, runningLocally = false) {
		const texture = webGL.createTexture();
		
		const defaultColors = [ [255, 0, 0, 255], [0, 255, 0, 255], [0, 0, 255, 255], [0, 255, 255, 255], [255, 255, 0, 255], [255, 0, 255, 255] ];
		
		// Init image as random color
		webGL.activeTexture(webGL.TEXTURE0 + textureIndex);
		webGL.bindTexture(webGL.TEXTURE_2D, texture);
		webGL.texImage2D(webGL.TEXTURE_2D, 0, webGL.RGBA, 1, 1, 0, webGL.RGBA, webGL.UNSIGNED_BYTE, new Uint8Array(defaultColors[textureIndex]));
		
		if (!runningLocally) {
			const image = new Image();
			image.onload = () => {
				webGL.activeTexture(webGL.TEXTURE0 + textureIndex);
				webGL.bindTexture(webGL.TEXTURE_2D, texture);
				webGL.texImage2D(webGL.TEXTURE_2D, 0, webGL.RGBA, webGL.RGBA, webGL.UNSIGNED_BYTE, image);
				
				webGL.texParameteri(webGL.TEXTURE_2D, webGL.TEXTURE_MIN_FILTER, webGL.LINEAR); // or webGL.NEAREST
				// Prevents uv coordinate wrapping (repeating)
				webGL.texParameteri(webGL.TEXTURE_2D, webGL.TEXTURE_WRAP_S, webGL.CLAMP_TO_EDGE);
				webGL.texParameteri(webGL.TEXTURE_2D, webGL.TEXTURE_WRAP_T, webGL.CLAMP_TO_EDGE);
			};
			image.src = url;
		}
		return texture;
	},
}