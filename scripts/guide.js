document.addEventListener("DOMContentLoaded", () => {
  const nav = document.querySelector(".custom-nav");
  const scrollTop = document.getElementById("scrollTop");
  const year = document.getElementById("year");
  const checks = [...document.querySelectorAll(".check-item input")];
  const progressBar = document.getElementById("progressBar");
  const progressText = document.getElementById("progressText");
  const reset = document.getElementById("resetChecklist");

  if (year) year.textContent = new Date().getFullYear();

  function updateScrollUI() {
    if (window.scrollY > 20) nav?.classList.add("scrolled");
    else nav?.classList.remove("scrolled");
    if (window.scrollY > 450) scrollTop?.classList.add("show");
    else scrollTop?.classList.remove("show");
  }
  window.addEventListener("scroll", updateScrollUI, {passive:true});
  updateScrollUI();

  scrollTop?.addEventListener("click", () => window.scrollTo({top:0, behavior:"smooth"}));

  function updateChecklist() {
    const done = checks.filter(c => c.checked).length;
    const percent = checks.length ? Math.round(done / checks.length * 100) : 0;
    if (progressBar) progressBar.style.width = percent + "%";
    if (progressText) progressText.textContent = percent + "%";
    localStorage.setItem("silamGuideChecklist", JSON.stringify(checks.map(c => c.checked)));
  }

  try {
    const saved = JSON.parse(localStorage.getItem("silamGuideChecklist"));
    if (Array.isArray(saved)) checks.forEach((c,i) => { if (typeof saved[i] === "boolean") c.checked = saved[i]; });
  } catch(e) {}
  checks.forEach(c => c.addEventListener("change", updateChecklist));
  updateChecklist();

  reset?.addEventListener("click", () => {
    checks.forEach(c => c.checked = false);
    localStorage.removeItem("silamGuideChecklist");
    updateChecklist();
  });
});