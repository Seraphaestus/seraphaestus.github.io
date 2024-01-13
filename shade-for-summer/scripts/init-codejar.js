const initialTime = Date.now()
var time = 0.0;

let shaderEditors = [];

window.addEventListener("load", () => {
	setInterval(update, 50);
}, {once: true});

function initCodeEditors(CodeJar, withLineNumbers, prepend = []) {
	setHighlighterGrammar();
	
	const settingsData = JSON.parse(localStorage.getItem("settings")) ?? {};
	if (settingsData["show-code-tooltips"] ?? true) {
		Prism.hooks.add('complete', (context) => {
			$(context.element).children(".token").hover((event) => {setTokenTooltip(event.target);}, () => {removeTokenTooltip(event.target);});
		});
	}
	
	for (let editor of document.querySelectorAll(".editor")) {
		const shaderEditor = new ShaderEditor(CodeJar, withLineNumbers, editor, prepend);
		shaderEditors.push(shaderEditor);
	}
}

function update() {
	time = (Date.now() - initialTime) / 1000.0;
	for (let shaderEditor of shaderEditors) {
		if (shaderEditor.interactive && shaderEditor.canvas.program && shaderEditor.codeUsesTime) {
			shaderEditor.canvas.redrawShader(shaderEditor.uniformValues);
		}
	}
}