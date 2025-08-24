document.addEventListener("DOMContentLoaded", () => {
  const setup = JSON.parse(localStorage.getItem("playerSetup")) || {};
  console.log("Loaded setup:", setup);

  // Example: show chosen equipment & collections on the page
  const logDiv = document.getElementById("battle-log");
  logDiv.innerHTML = `
    <h2>Your Setup</h2>
    <p><b>Equipment:</b> ${setup.equipment?.join(", ") || "None"}</p>
    <p><b>Collections:</b> ${setup.collections?.join(", ") || "None"}</p>
  `;

  // Later: put your battle logic here, using setup.equipment + setup.collections
});
