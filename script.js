const equipmentTypes = [
	"Coin", "Bait", "Hex", "Weapon", "Head", "Chest", "Hands", "Feet",
	"Power", "Emblem", "Coffin", "Accessory", "Mount", "Retainer"
];

let equipmentData = {};
let collectionData = {};
let collectionCodes = {}; // shortCode → fullName mapping

function createDropdown(type, index = null) {
	const label = document.createElement("label");
	label.textContent = index ? `${type} ${index}: ` : `${type}: `;

	const select = document.createElement("select");
	select.id = index ? `select-${type}-${index}` : `select-${type}`;

	const defaultOption = document.createElement("option");
	defaultOption.value = "";
	defaultOption.textContent = "-- Select " + type + " --";
	select.appendChild(defaultOption);

	for (const [name, info] of Object.entries(equipmentData)) {
		if (info.type === type) {
			const option = document.createElement("option");
			option.value = name;
			option.textContent = name;
			select.appendChild(option);
		}
	}

	select.addEventListener("change", updateSkills);

	const container = document.getElementById("equipment-selectors");
	container.appendChild(label);
	container.appendChild(select);
	container.appendChild(document.createElement("br"));
}

function createCollectionCheckboxes() {
	const container = document.getElementById("collection-selectors");

	for (const [code, fullName] of Object.entries(collectionCodes)) {
		const div = document.createElement("div");

		const checkbox = document.createElement("input");
		checkbox.type = "checkbox";
		checkbox.id = "collection-" + code; // use short code
		checkbox.value = code;
		checkbox.addEventListener("change", updateSkills);

		const label
