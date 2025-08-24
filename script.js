async function loadCollections() {
	const [codesRes, listRes] = await Promise.all([
		fetch("collection_codes.json").then(r => r.json()),
		fetch("collection_list.json").then(r => r.json())
	]);

	const codeMap = codesRes;  // short code → full name
	const collections = listRes; // full name → data

	// Example: player selects "2-3"
	let selectedCode = "2-3";
	let fullName = codeMap[selectedCode]; // "Dark Forest Collection III"
	let details = collections[fullName];  // { bonus: "...", items: [...] }

	console.log(fullName, details);
}
