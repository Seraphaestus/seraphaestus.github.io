// Run everything inside window load event handler, to make sure
// DOM is fully loaded and styled before trying to manipulate it,
// and to not mess up the global scope. We are giving the event
// handler a name (setupWebGL) so that we can refer to the
// function object within the function itself.
window.addEventListener("load", setup, {once: true});

function setup(event) {
	copyDayList();
	
	const urlParts = document.URL.split("/")
	const year = urlParts[urlParts.length - 2];
	
	const firstTime = !(JSON.parse(localStorage.getItem(`${year}.started`)) ?? false);
	if (firstTime) {
		playCutscene();
		localStorage.setItem(`${year}.started`, "true");
	}
}

function copyDayList() {
	const dayTable = document.getElementById("day-list").firstChild
	for (let dayPin of document.getElementById("day-pins").children) {
		const dayLink = dayPin.firstChild
		if (dayPin.tagName !== "LI" || dayLink.firstChild === null) continue;
		var dayRow = document.createElement("tr");
		dayTable.appendChild(dayRow)
		const linkURL = dayLink.getAttribute("href")
		const prefixText = "Day " + dayLink.textContent.split('.')[0].substring(3)
		const html = `
			<td style='text-align: right;'><a href='${linkURL}'>${prefixText}:</a></td>
			<td>${dayLink.textContent.split('.')[1]}</td>
		`;
		dayRow.insertAdjacentHTML("beforeend", html);
	}
}

function playCutscene() {
	console.log("Test :)")
}