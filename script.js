const CSV_SHEET_URL =
	"https://docs.google.com/spreadsheets/d/e/2PACX-1vSSOy2bT4N1kKaI4dAqeUOII5Jg9c96JwBI5ZKsln9BlPWayyHjUcZB3pzTjLkKnAyod0kuBGjlL-hA/pub?output=csv";
const INSTAGRAM_DM_LINK = "https://ig.me/m/mishtusart";

// ──────── IMAGE LINK UTILITY (Google Drive, Dropbox, Data URLs) ────────
function toDirectImageUrl(url) {
	if (!url) return { direct: "", thumbnail: "" };
	// Data URL: return as is
	if (url.startsWith("data:image/")) {
		return { direct: url, thumbnail: url };
	}
	// Dropbox: convert www.dropbox.com to dl.dropboxusercontent.com and remove dl=0/dl=1
	if (url.includes("dropbox.com")) {
		let direct = url.replace("www.dropbox.com", "dl.dropboxusercontent.com");
		direct = direct.replace(/([?&])dl=0/, "$1");
		direct = direct.replace(/([?&])dl=1/, "$1");
		// Remove any trailing ? or & if left
		direct = direct.replace(/[?&]$/, "");
		return { direct, thumbnail: direct };
	}
	// Default: return as is
	return { direct: url, thumbnail: url };
}
let allDesigns = [];
let activeCategory = "All";
loadDemo();

// ──────── EXTRACT SHEET ID ────────
function extractSheetId(url) {
	const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
	return m ? m[1] : null;
}

// ──────── NORMALIZE HEADER ────────
function normalizeKey(h) {
	return h.toLowerCase().replace(/\s+/g, "");
}

function findCol(headers, ...aliases) {
	for (const alias of aliases) {
		const idx = headers.findIndex(
			(h) =>
				normalizeKey(h) === normalizeKey(alias) ||
				normalizeKey(h).includes(normalizeKey(alias)),
		);
		if (idx !== -1) return idx;
	}
	return -1;
}

// ──────── PARSE CSV ────────
function parseCSV(text) {
	const lines = text.trim().split("\n");
	console.log("CSV lines count:", lines.length);

	if (lines.length < 2) {
		console.warn("CSV has less than 2 lines (header + data)");
		return [];
	}

	const headers = lines[0]
		.split(",")
		.map((h) => h.replace(/^"|"$/g, "").trim());
	console.log("Headers:", headers);

	const rows = lines.slice(1).map((line) => {
		const cells = [];
		let current = "";
		let inQ = false;
		for (let i = 0; i < line.length; i++) {
			const c = line[i];
			if (c === '"') {
				inQ = !inQ;
			} else if (c === "," && !inQ) {
				cells.push(current.trim());
				current = "";
			} else {
				current += c;
			}
		}
		cells.push(current.trim());
		return cells;
	});

	const iName = findCol(headers, "name", "title", "design");
	const iPrice = findCol(headers, "price", "cost", "rate", "amount");
	const iTime = findCol(headers, "time", "duration", "hours", "timereq");
	const iCat = findCol(headers, "category", "type", "style");
	const iImg = findCol(
		headers,
		"image",
		"img",
		"photo",
		"pic",
		"imageurl",
		"imgurl",
		"photourl",
	);
	const iDesc = findCol(headers, "description", "desc", "about", "detail");
	const iRat = findCol(headers, "rating", "stars", "review");

	console.log(
		"Column indices - Name:",
		iName,
		"Price:",
		iPrice,
		"Time:",
		iTime,
		"Cat:",
		iCat,
		"Img:",
		iImg,
		"Desc:",
		iDesc,
		"Rating:",
		iRat,
	);

	const filtered = rows.filter((r) => r.some((c) => c));
	console.log("Rows after filtering empty:", filtered.length);

	return filtered.map((r, idx) => ({
		id: idx,
		name: r[iName] || "Untitled Design",
		price: r[iPrice] || "",
		time: r[iTime] || "",
		category: r[iCat] || "General",
		image: r[iImg] || "",
		description: r[iDesc] || "",
		rating: r[iRat] || "",
	}));
}

// ──────── LOAD SHEET ────────
async function loadSheet() {
	const url = document.getElementById("sheetUrl").value.trim();
	if (!url) {
		showError("Please enter a Google Sheets URL.");
		return;
	}

	const id = extractSheetId(url);
	if (!id) {
		showError(
			"Could not find a valid Sheet ID in the URL. Make sure you paste the full Google Sheets link.",
		);
		return;
	}

	const csvUrl = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=0`;

	showStatus('<span class="spinner"></span> Loading your sheet…');
	hideError();

	try {
		const resp = await fetch(csvUrl);
		if (!resp.ok)
			throw new Error(
				`HTTP ${resp.status}: The sheet may not be publicly accessible.`,
			);
		const text = await resp.text();
		if (text.includes("<html"))
			throw new Error(
				'The sheet is not public. Please set sharing to "Anyone with link can view".',
			);

		allDesigns = parseCSV(text);
		if (allDesigns.length === 0)
			throw new Error(
				"No data rows found. Check that your sheet has data below the header row.",
			);

		hideStatus();
		document.getElementById("instructions").style.display = "none";
		renderCatalog();
	} catch (err) {
		hideStatus();
		showError(`<strong>Could not load sheet:</strong> ${err.message}`);
	}
}

// ──────── DEMO DATA ────────
async function loadDemo() {
	// Use the provided Google Sheets CSV URL for designs
	const csvUrl = CSV_SHEET_URL;
	try {
		const resp = await fetch(csvUrl);
		if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
		const text = await resp.text();
		console.log("CSV Response length:", text.length);
		console.log("First 200 chars:", text.substring(0, 200));

		if (!text || text.trim().length === 0) throw new Error("Empty response");
		if (text.includes("<html") || text.includes("<HTML"))
			throw new Error("HTML response received - sheet may not be public");

		const parsed = parseCSV(text);
		console.log("Parsed rows:", parsed.length, "First item:", parsed[0]);

		if (!parsed || parsed.length === 0)
			throw new Error("CSV parsing returned no results");

		allDesigns = parsed;
		// document.getElementById("instructions").style.display = "none";
		renderCatalog();
	} catch (err) {
		console.error("Sheet load error:", err.message);
		// Fallback to complete demo data
		allDesigns = [
			{
				id: 0,
				name: "Full Bridal Set",
				price: "₹3500",
				time: "4–5 hrs",
				category: "Bridal",
				image:
					"https://images.unsplash.com/photo-1620925133711-1499d68a3ff8?w=600&q=80",
				description:
					"Elaborate full-hand and foot mehndi for the perfect bridal look.",
				rating: "4.9",
			},
			{
				id: 1,
				name: "Arabic Florals",
				price: "₹800",
				time: "1 hr",
				category: "Arabic",
				image:
					"https://images.unsplash.com/photo-1586074299757-5a03b2e1f8ce?w=600&q=80",
				description: "Flowing Arabic floral patterns from fingertips to wrist.",
				rating: "4.7",
			},
			{
				id: 2,
				name: "Indo-Western Blend",
				price: "₹1200",
				time: "1.5 hrs",
				category: "Indo-Western",
				image:
					"https://images.unsplash.com/photo-1604881991720-f91add269bed?w=600&q=80",
				description:
					"Modern geometric lines mixed with traditional Indian motifs.",
				rating: "4.8",
			},
			{
				id: 3,
				name: "Simple Finger Art",
				price: "₹350",
				time: "30 min",
				category: "Simple",
				image:
					"https://images.unsplash.com/photo-1600267165477-6d4cc741b379?w=600&q=80",
				description: "Quick and elegant finger-only mehndi for festivals.",
				rating: "4.5",
			},
			{
				id: 4,
				name: "Pakistani Heritage",
				price: "₹2000",
				time: "2.5 hrs",
				category: "Pakistani",
				image:
					"https://images.unsplash.com/photo-1616004655123-818cbd4b3143?w=600&q=80",
				description: "Fine line Pakistani style with intricate border work.",
				rating: "5.0",
			},
			{
				id: 5,
				name: "Mandala Sleeve",
				price: "₹1800",
				time: "2 hrs",
				category: "Mandala",
				image:
					"https://images.unsplash.com/photo-1631549916768-4119b2e5f926?w=600&q=80",
				description: "Geometric mandala pattern flowing up the forearm.",
				rating: "4.6",
			},
			{
				id: 6,
				name: "Rajasthani Classic",
				price: "₹2500",
				time: "3 hrs",
				category: "Bridal",
				image:
					"https://images.unsplash.com/photo-1583263101898-e3c6c1f76f05?w=600&q=80",
				description:
					"Traditional Rajasthani style with peacock and groom motifs.",
				rating: "4.8",
			},
			{
				id: 7,
				name: "Minimalist Lines",
				price: "₹400",
				time: "40 min",
				category: "Simple",
				image:
					"https://images.unsplash.com/photo-1581812426773-00fefa3b5e34?w=600&q=80",
				description: "Clean, modern lines for the contemporary minimalist.",
				rating: "4.4",
			},
		];
		renderCatalog();
	}
}

// ──────── RENDER ────────
function renderCatalog() {
	// Title
	const title = document.getElementById("catalog-title");
	title.innerHTML = `Your <span>Mehndi Catalog</span> <small style="font-size:.6em;color:#8a6a4a;font-style:normal">(${allDesigns.length} designs)</small>`;
	document.getElementById("catalog-header").style.display = "block";

	// Categories
	const categories = [
		"All",
		...new Set(allDesigns.map((d) => d.category).filter(Boolean)),
	];
	const chipsEl = document.getElementById("filterChips");
	chipsEl.innerHTML = categories
		.map(
			(c) =>
				`<button class="chip${
					c === "All" ? " active" : ""
				}" onclick="setCategory('${c}')">${c}</button>`,
		)
		.join("");

	document.getElementById("controls").style.display = "block";
	document.getElementById("grid").style.display = "grid";
	filterCards();
}

function setCategory(cat) {
	activeCategory = cat;
	document.querySelectorAll(".chip").forEach((c) => {
		c.classList.toggle("active", c.textContent === cat);
	});
	filterCards();
}

function filterCards() {
	const q = document.getElementById("searchInput").value.toLowerCase();
	const sort = document.getElementById("sortSelect").value;

	let filtered = allDesigns.filter((d) => {
		const matchCat = activeCategory === "All" || d.category === activeCategory;
		const matchText =
			!q ||
			d.name.toLowerCase().includes(q) ||
			d.category.toLowerCase().includes(q) ||
			d.description.toLowerCase().includes(q);
		return matchCat && matchText;
	});

	if (sort === "price-asc")
		filtered.sort((a, b) => parsePrice(a.price) - parsePrice(b.price));
	if (sort === "price-desc")
		filtered.sort((a, b) => parsePrice(b.price) - parsePrice(a.price));
	if (sort === "name-asc")
		filtered.sort((a, b) => a.name.localeCompare(b.name));
	if (sort === "time-asc")
		filtered.sort((a, b) => parseTime(a.time) - parseTime(b.time));

	document.getElementById("resultCount").textContent = `${
		filtered.length
	} design${filtered.length !== 1 ? "s" : ""}`;

	const grid = document.getElementById("grid");
	const empty = document.getElementById("empty");

	if (filtered.length === 0) {
		grid.innerHTML = "";
		empty.style.display = "block";
	} else {
		empty.style.display = "none";
		grid.innerHTML = filtered.map((d) => cardHTML(d)).join("");
	}
}

function parsePrice(p) {
	const n = parseFloat(String(p).replace(/[^0-9.]/g, ""));
	return isNaN(n) ? 0 : n;
}
function parseTime(t) {
	const m = String(t).match(/(\d+(\.\d+)?)/);
	return m ? parseFloat(m[1]) : 999;
}

function cardHTML(d) {
	const imgUrls = toDirectImageUrl(d.image);
	const imgPart = d.image
		? `<img src="${imgUrls.direct}" alt="${d.name}" loading="lazy" onerror="if(this.src!=='${imgUrls.thumbnail}'){this.src='${imgUrls.thumbnail}'}else{this.parentElement.innerHTML='<div class=\\'card-img-placeholder\\'>✿</div>'}">`
		: `<div class="card-img-placeholder">✿</div>`;
	const stars = d.rating ? `<span class="meta-icon">★</span> ${d.rating}` : "";
	return `
  <div class="card" onclick="openModal(${d.id})">
    <div class="card-img-wrap">
      ${imgPart}
      <span class="card-badge">${d.category}</span>
    </div>
    <div class="card-body">
      <div class="card-category">${d.category}</div>
      <div class="card-name">${d.name}</div>
      <div class="card-meta">
        ${
					d.time
						? `<span class="meta-item"><span class="meta-icon">⏱</span>${d.time}</span>`
						: ""
				}
        ${
					d.rating
						? `<span class="meta-item"><span class="meta-icon">★</span>${d.rating}</span>`
						: ""
				}
      </div>
      <div class="card-footer">
        <span class="card-price">${d.price || "—"}</span>
        <button class="btn-book">Book</button>
      </div>
    </div>
  </div>`;
}

// ──────── MODAL ────────
function openModal(id) {
	const d = allDesigns.find((x) => x.id === id);
	if (!d) return;

	const imgWrap = document.getElementById("modal-img-wrap");
	const imgUrls = toDirectImageUrl(d.image);
	imgWrap.innerHTML = d.image
		? `<img src="${imgUrls.direct}" alt="${d.name}" onerror="if(this.src!=='${imgUrls.thumbnail}'){this.src='${imgUrls.thumbnail}'}else{this.parentElement.innerHTML='<div class=\\'card-img-placeholder\\'>✿</div>'}">`
		: `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:5rem;color:#e8c8a0;background:linear-gradient(135deg,#f8ede0,#f0d5b0)">✿</div>`;

	const stars = d.rating
		? `<span style="color:#c8922a">★</span> ${d.rating} / 5`
		: "";
	document.getElementById("modal-content").innerHTML = `
    <div class="modal-category">${d.category}</div>
    <div class="modal-name">${d.name}</div>
    ${d.description ? `<p class="modal-desc">${d.description}</p>` : ""}
    <div class="modal-details">
      ${
				d.time
					? `<div class="detail-box"><div class="label">Time Required</div><div class="value">⏱ ${d.time}</div></div>`
					: ""
			}
      ${
				d.rating
					? `<div class="detail-box"><div class="label">Rating</div><div class="value">★ ${d.rating}/5</div></div>`
					: ""
			}
    </div>
    <div class="modal-price-big">${d.price || "Price on request"}</div>
    <div class="modal-actions">
      <button class="btn-primary" onclick="bookNow('${
				d.name
			}')">Book This Design</button>
      <button class="btn-close-modal" onclick="document.getElementById('modal-overlay').classList.remove('open')">✕</button>
    </div>
  `;

	document.getElementById("modal-overlay").classList.add("open");
}

function closeModal(e) {
	if (e.target === document.getElementById("modal-overlay")) {
		document.getElementById("modal-overlay").classList.remove("open");
	}
}

function bookNow(name) {
	window.open("https://ig.me/m/mishtusart", "_blank");
}

document.addEventListener("keydown", (e) => {
	if (e.key === "Escape")
		document.getElementById("modal-overlay").classList.remove("open");
});

// ──────── HELPERS ────────
function showStatus(msg) {
	const s = document.getElementById("status");
	s.innerHTML = msg;
	s.style.display = "block";
}
function hideStatus() {
	document.getElementById("status").style.display = "none";
}
function showError(msg) {
	const e = document.getElementById("error-msg");
	e.innerHTML = msg;
	e.style.display = "block";
}
function hideError() {
	document.getElementById("error-msg").style.display = "none";
}

// Allow Enter key to trigger load
document.getElementById("sheetUrl").addEventListener("keydown", (e) => {
	if (e.key === "Enter") loadSheet();
});
