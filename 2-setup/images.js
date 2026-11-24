/* images.js: Contestant photos and background image: resize, clipboard/file chooser popup, dim slider. */

/* ---------- images: the file pickers and clipboard paste share the same resizing ---------- */
function load_image(file, done) {
  const r = new FileReader();
  r.onload = () => {
    const im = new Image();
    im.onload = () => done(im);
    im.src = r.result;
  };
  r.readAsDataURL(file);
}

function set_photo_from_file(i, file) {
  load_image(file, (im) => {
    if (!P[i]) return;
    const c = document.createElement("canvas");
    c.width = c.height = 96;
    const x = c.getContext("2d"),
      m = Math.min(im.width, im.height);
    x.drawImage(im, (im.width - m) / 2, (im.height - m) / 2, m, m, 0, 0, 96, 96);
    P[i].img = c.toDataURL("image/jpeg", 0.82);
    draw_people();
    save_soon();
  });
}

function set_bg_from_file(file) {
  load_image(file, (im) => {
    const k = Math.min(1, 1600 / Math.max(im.width, im.height)),
      c = document.createElement("canvas");
    c.width = im.width * k;
    c.height = im.height * k;
    c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
    set_bg(c.toDataURL("image/jpeg", 0.8));
  });
}

/* Choosing an image: click a photo circle (or the Background image button) to get a small
   popup with the image on your clipboard, plus "Show all files" for the normal file picker.
   While the popup is open, Ctrl+V / Cmd+V pastes a copied image straight in. */
let image_popup = null;

function close_image_popup() {
  if (!image_popup) return;
  if (image_popup.url) URL.revokeObjectURL(image_popup.url);
  image_popup.el.remove();
  image_popup = null;
}

async function read_clipboard_image() {
  if (!navigator.clipboard || !navigator.clipboard.read) return null;
  try {
    for (const item of await navigator.clipboard.read()) {
      const type = item.types.find((t) => t.startsWith("image/"));
      if (type) return await item.getType(type);
    }
  } catch (e) {
    /* permission denied, or the page is not focused */
  }
  return null;
}

function open_image_popup(anchor, use_image, show_files) {
  const same = image_popup && image_popup.anchor === anchor;
  close_image_popup();
  if (same) return;

  const el = document.createElement("div");
  el.className = "imgpop";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-label", "Choose an image");

  const files_btn = document.createElement("button");
  files_btn.className = "ghost";
  files_btn.textContent = "Show all files";
  const x_btn = document.createElement("button");
  x_btn.className = "ghost";
  x_btn.textContent = "\u00d7";
  x_btn.setAttribute("aria-label", "Close");
  const head = document.createElement("div");
  head.className = "imgpop-head";
  head.append(files_btn, x_btn);

  const title = document.createElement("h4");
  title.textContent = "Clipboard";
  const slot = document.createElement("div");
  slot.className = "imgpop-slot meta";
  slot.textContent = "Checking the clipboard\u2026";
  el.append(head, title, slot);
  document.body.appendChild(el);

  const place = () => {
    const r = anchor.getBoundingClientRect();
    el.style.top = Math.max(8, Math.min(r.bottom + 6, innerHeight - el.offsetHeight - 8)) + "px";
    el.style.left = Math.max(8, Math.min(r.left, innerWidth - el.offsetWidth - 8)) + "px";
  };
  place();

  image_popup = { el, anchor, url: null, use_image };
  files_btn.onclick = () => {
    close_image_popup();
    show_files();
  };
  x_btn.onclick = close_image_popup;

  read_clipboard_image().then((blob) => {
    if (!image_popup || image_popup.el !== el) return;
    if (!blob) {
      slot.textContent = "No image on the clipboard. Copy one, then press Ctrl+V here.";
      place();
      return;
    }
    image_popup.url = URL.createObjectURL(blob);
    const thumb = document.createElement("button");
    thumb.className = "imgpop-thumb";
    thumb.title = "Use this image";
    const im = document.createElement("img");
    im.alt = "Clipboard image";
    im.onload = place;
    im.src = image_popup.url;
    thumb.append(im);
    thumb.onclick = () => {
      close_image_popup();
      use_image(blob);
    };
    slot.replaceChildren(thumb);
    place();
  });
}

document.addEventListener("pointerdown", (e) => {
  if (image_popup && !image_popup.el.contains(e.target) && !image_popup.anchor.contains(e.target)) {
    close_image_popup();
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") close_image_popup();
});

window.addEventListener("scroll", close_image_popup, true);

document.addEventListener("paste", (e) => {
  const cb = e.clipboardData;
  if (!image_popup || !cb || cb.getData("text/plain")) return;
  const file = [...cb.files].find((f) => f.type.startsWith("image/"));
  if (!file) return;
  e.preventDefault();
  const use_image = image_popup.use_image;
  close_image_popup();
  use_image(file);
});

$("#teams").addEventListener("click", (e) => {
  const label = e.target.closest(".avl");
  if (!label || e.target.matches("input[type=file]")) return;
  e.preventDefault();
  const input = label.querySelector("input[data-img]");
  open_image_popup(
    label,
    (f) => set_photo_from_file(+input.dataset.img, f),
    () => input.click(),
  );
});

$("#bgf")
  .closest("label")
  .addEventListener("click", (e) => {
    if (e.target === $("#bgf")) return;
    e.preventDefault();
    open_image_popup(e.currentTarget, set_bg_from_file, () => $("#bgf").click());
  });

function set_bg(u) {
  current_bg = u;
  const r = document.documentElement;
  r.style.setProperty("--bgimg", u ? `url(${u})` : "none");
  r.classList.toggle("hasbg", !!u);
  save_soon();
}

$("#dim").oninput = (e) => {
  document.documentElement.style.setProperty("--dim", e.target.value);
  save_soon();
};

$("#bgx").onclick = () => set_bg("");

$("#bgf").addEventListener("change", (e) => {
  const f = e.target.files[0];
  if (f) set_bg_from_file(f);
});
