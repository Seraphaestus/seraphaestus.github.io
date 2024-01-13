const targetImageShaders = {
	"_": {stickers: {stamp: "stamp.png"}},
	"1": {caption: "Alright, all packed and ready to go! Wish me luck.", stickers: {friend:"2024/stickers/silhouette.png", van:"2024/stickers/van_side.png"}, targetCode: "const vec3 sky_color = vec3(219.0, 237.0, 255.0) / 255.0;const vec3 road_color = vec3(100.0) / 255.0;const vec3 building_color = vec3(244.0, 207.0, 144.0) / 255.0;const float top_cutoff = 0.85;const float bottom_cutoff = 0.15;void main(){COLOR.a=1.0;vec2 coord=(COORD-vec2(0.5))*vec2(0.8,1.15);COLOR.rgb=building_color;if(RATIO.y>top_cutoff){COLOR.rgb=sky_color;}if(RATIO.y<bottom_cutoff){COLOR.rgb=road_color;}place_sticker(van, COORD * vec2(1.55, 1.85) - vec2(1.0, 0.1));}"},
	"2": {caption: "Isn't she a beaut? I'm glad she'll finally see some proper use.", stickers: {van:"2024/stickers/van_front.png"}, targetCode: "const vec3 sky_color = vec3(219.0, 237.0, 255.0) / 255.0;const vec3 road_color = vec3(199.0) / 255.0;const vec3 building_color = vec3(244.0, 207.0, 144.0) / 255.0;const float top_cutoff = 0.94;const float bottom_cutoff = 0.07;void main(){COLOR.a=1.0;vec2 coord=(COORD-vec2(0.5))*vec2(0.8,1.15);if(abs(coord.x)>abs(coord.y)){COLOR.rgb=building_color;if(coord.x>-0.5&&coord.x<0.5){COLOR.rgb*=0.975;}if(RATIO.y>top_cutoff){COLOR.rgb=sky_color;}if(RATIO.y<bottom_cutoff){COLOR.rgb=road_color;}}else{COLOR.rgb=mix(road_color,sky_color,(sign(coord.y)+1.0)*0.5);}}"},
	"3": {caption: "Remember how we'd come here after school? It tastes like it was yesterday.", targetCode: "const float plate_size = 0.95;const vec3 bg_color = vec3(122.0, 58.0, 51.0) / 255.0;const vec3 cake_color = vec3(238.0, 161.0, 73.0) / 255.0;const float cake_size = 0.7;const float cake_rotation = 0.125;const float cake_height = 0.2;const bool do_perspective = true;const float antialiasing = 0.1;float antialiased_step(float a, float b) {return smoothstep(b * (1.0 - antialiasing * 0.1), b * (1.0 + antialiasing * 0.1), a);}float in_circle(vec2 uv, vec2 center, float radius) {return antialiased_step(radius, distance(uv, center));}float in_segment(vec2 uv, vec2 center, float radius, float rotation, float size) {float angle = mod(atan(uv.y - center.y, uv.x - center.x) + rotation * TAU, TAU);return in_circle(uv, center, radius) * antialiased_step(angle, TAU / 6.0) * antialiased_step(TAU / 6.0 + TAU / 9.0, angle);}void main() {gl_FragColor.a = 1.0;vec2 uv = COORD;if (do_perspective) uv.y = (uv.y - 0.5) * 1.25 + 0.5;COLOR.rgb = mix(bg_color, vec3(1.0), in_circle(uv, vec2(0.5), plate_size / 2.0));gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.95), in_circle(uv, vec2(0.5), 0.8 * plate_size / 2.0));const float layers = 64.0;vec2 cake_offset = vec2(0.125);for (float i = 0.0; i < layers; i += 1.0) {gl_FragColor.rgb = mix(gl_FragColor.rgb, cake_color * 0.8, in_segment(uv + cake_offset, vec2(0.5, 0.5 + i * cake_height / layers), cake_size * plate_size / 2.0, cake_rotation, cake_size));}gl_FragColor.rgb = mix(gl_FragColor.rgb, cake_color, in_segment(uv + cake_offset, vec2(0.5, 0.5 + cake_height), cake_size * plate_size / 2.0, cake_rotation, cake_size));}"},
};
let targetImageShader = null;

let advancedViewToggle;
let advancedViewOverlapSlider;
let canvasDeltaY;

window.addEventListener("load", (event) => {
	advancedViewToggle = document.querySelector("#canvas-view-toggle");
	advancedViewOverlapSlider = document.querySelector("#canvas-view-slider");
	setupAdvancedView();
}, {once: true});

function setup(CodeJar, withLineNumbers) {
	const day = (new URLSearchParams(location.search)).get("day");
	if (day in targetImageShaders) {
		targetImageShader = targetImageShaders[day];
		document.querySelector("#postcard-caption").innerText = targetImageShader.caption;
	}
	
	setPageTitle(day);
	
	const stickers = targetImageShader?.stickers ?? targetImageShaders["_"]?.stickers ?? {};
	let extraPrepend = [];
	for (let stickerName in stickers) {
		extraPrepend.push(`uniform sampler2D ${stickerName} #display;\n`);
	}
	
	initCodeEditors(CodeJar, withLineNumbers, extraPrepend);
			
	const runningLocally = (window.location.protocol == "file:");
	if (targetImageShader != null) {
		const target  = new Shader(extraPrepend);
		target.canvas = new ShadeableCanvas(document.querySelector("#target-canvas"), document.querySelector("p"), false);
		target.updateCanvas(targetImageShader.targetCode);
		target.setTextureUniforms(stickers, runningLocally);
	}
	shaderEditors[0].canvas.setTextureUniforms(stickers, runningLocally);
}


function setPageTitle(day) {
	const title = document.querySelector("head title");
	if (targetImageShader) {
		title.textContent = title.textContent.replace("Title", "Day " + day);
	} else {
		title.textContent = title.textContent.replace("Title", "Code Playground");
	}
}

function setupAdvancedView() {
	if (targetImageShader == null) {
		advancedViewToggle.parentElement.parentElement.style.visibility = "hidden";
		const postcard = document.querySelector("#postcard");
		const editableCanvasArea = document.querySelector("#editable-canvas-area");
		postcard.style.visibility = "hidden";
		updateFromViewSlider(postcard, editableCanvasArea, 1.0);
		return;
	}
	
	advancedViewToggle.oninput = toggleAdvancedView; // Toggling advanced mode shows the below slider
	advancedViewOverlapSlider.oninput = onViewSliderUpdated;
}

function toggleAdvancedView(advanced = advancedViewToggle.checked) {
	advancedViewOverlapSlider.style.visibility = advanced ? "visible" : "hidden";
	// Show/hide easel
	for (let easel of document.querySelectorAll(".easel")) {
		easel.style.visibility = advanced ? "hidden" : "visible";
	}
	// Set canvas transforms
	const postcard = document.querySelector("#postcard");
	postcard.style.rotate = advanced ? "0deg" : "5deg";
	shaderEditors[0].canvas.canvas.style.scale = advanced ? "100%" : "87.5%";
	
	const editableCanvasArea = document.querySelector("#editable-canvas-area");
	editableCanvasArea.style.translate = advanced ? "0 0em" : "0 -1em";
	moveElementsTowardsEachOther(postcard, editableCanvasArea, advanced ? advancedViewOverlapSlider.value / 100.0 : 0.0);
}

function onViewSliderUpdated() {
	const postcard = document.querySelector("#postcard");
	const editableCanvasArea = document.querySelector("#editable-canvas-area");
	moveElementsTowardsEachOther(postcard, editableCanvasArea, advancedViewOverlapSlider.value / 100.0);
}

function moveElementsTowardsEachOther(top, bottom, value) {
	if (!canvasDeltaY) {
		canvasDeltaY = Math.abs(top.getBoundingClientRect().top - bottom.getBoundingClientRect().top);
		canvasDeltaY -= 5; // Frustrating magic number  >:[
	}
	top.style["margin-top"]    = `${value * canvasDeltaY / 2.0}px`;
	bottom.style["margin-top"] = `${-value * canvasDeltaY}px`;
}