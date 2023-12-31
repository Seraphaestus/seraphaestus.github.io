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
	loadTexture: function(webGL, url) {
		const texture = webGL.createTexture();
		webGL.bindTexture(webGL.TEXTURE_2D, texture);
		
		const level = 0, width = 1, height = 1, border = 0;
		const internalFormat = webGL.RGBA, srcFormat = webGL.RGBA;
		const srcType = webGL.UNSIGNED_BYTE;
		const pixel = new Uint8Array([0, 0, 255, 255]); // opaque blue
		
		webGL.texImage2D(webGL.TEXTURE_2D, level, internalFormat, width, height, border, srcFormat, srcType, pixel);
		
		const image = new Image();
		image.onload = () => {
			webGL.bindTexture(webGL.TEXTURE_2D, texture);
			webGL.texImage2D(webGL.TEXTURE_2D, level, internalFormat, srcFormat, srcType, image);
			
			// TODO: add alternative handling for non-pow2 images
			webGL.generateMipmap(webGL.TEXTURE_2D);
		};
		image.src = url;
		return texture;
	},
}