/* main.js: Start-up. Must load last. */

load();

sync();

update_mode_ui();

document.documentElement.style.setProperty("--dim", $("#dim").value);

apply_theme();

try {
  draw_events();
} catch (e) {
  console.error("event editor:", e);
}

try {
  draw_tsr();
} catch (e) {
  console.error("trait editor:", e);
}

try {
  draw_people();
} catch (e) {
  console.error("people editor:", e);
}
