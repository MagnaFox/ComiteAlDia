/**
 * Comité al Día - Calculadora de Gastos Comunes
 * Lógica de cálculo, persistencia en localStorage y manipulación del DOM
 */

// Formateadores de moneda y números (CLP y decimales es-CL)
const fmt = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0
});

const nf = new Intl.NumberFormat("es-CL", {
  maximumFractionDigits: 2
});

const parseNum = (s) => {
  if (typeof s !== "string") return Number(s) || 0;
  const cleaned = s
    .replace(/\$/g, "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const n = parseFloat(cleaned);
  return isFinite(n) ? n : 0;
};

// Estado inicial
let method = "alicuota"; // "alicuota" | "m2" | "iguales"
let units = [
  { name: "Depto. 101", alicuota: "22", m2: "62" },
  { name: "Depto. 102", alicuota: "28", m2: "78" },
  { name: "Depto. 201", alicuota: "22", m2: "62" },
  { name: "Depto. 202", alicuota: "28", m2: "78" }
];
let lastResult = [];

const STORAGE_KEY = "comite-al-dia-v1";
const rowsEl = document.getElementById("rows");

/**
 * Carga datos previos almacenados en localStorage
 */
function loadStorage() {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (s && Array.isArray(s.units) && s.units.length) {
      units = s.units;
      method = s.method || method;
      document.getElementById("total").value = s.total || "";
      document.getElementById("reserva").value = s.reserva ?? "5";
    }
  } catch (e) {
    console.error("Error al cargar localStorage:", e);
  }

  // Sincroniza estado de los botones de método
  document.querySelectorAll(".seg button").forEach((btn) => {
    btn.setAttribute("aria-pressed", String(btn.dataset.m === method));
  });
}

/**
 * Guarda el estado actual en localStorage
 */
function save() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        units,
        method,
        total: document.getElementById("total").value,
        reserva: document.getElementById("reserva").value
      })
    );
  } catch (e) {
    console.error("Error al guardar en localStorage:", e);
  }
}

/**
 * Renderiza la lista de unidades en la tabla
 */
function renderRows() {
  rowsEl.innerHTML = "";

  units.forEach((u, i) => {
    const tr = document.createElement("tr");
    const valCell =
      method === "iguales"
        ? `<td class="num">—</td>`
        : `<td class="val num">
            <input 
              aria-label="${method === "m2" ? "Metros cuadrados" : "Alícuota"} de ${u.name || "unidad"}" 
              inputmode="decimal" 
              data-i="${i}" 
              data-f="${method}" 
              value="${method === "m2" ? u.m2 : u.alicuota}">
           </td>`;

    tr.innerHTML = `
      <td class="name">
        <input aria-label="Nombre de la unidad" data-i="${i}" data-f="name">
      </td>
      ${valCell}
      <td class="num" data-o="gc"></td>
      <td class="num" data-o="fr"></td>
      <td class="num total" data-o="tot"></td>
      <td>
        <button type="button" class="del" data-del="${i}" aria-label="Quitar ${u.name || "unidad"}">×</button>
      </td>
    `;

    tr.querySelector('[data-f="name"]').value = u.name;
    rowsEl.appendChild(tr);
  });

  document.getElementById("val-head").textContent =
    method === "m2" ? "m²" : method === "iguales" ? "Reparto" : "Alícuota %";

  compute();
}

/**
 * Realiza el cálculo del gasto común y fondo de reserva por unidad
 */
function compute() {
  const total = parseNum(document.getElementById("total").value);
  const pct = parseNum(document.getElementById("reserva").value);
  const n = units.length;
  let shares;
  let sumVal = 0;

  if (method === "iguales") {
    shares = units.map(() => (n ? 1 / n : 0));
  } else if (method === "m2") {
    const v = units.map((u) => parseNum(u.m2));
    sumVal = v.reduce((a, b) => a + b, 0);
    shares = v.map((x) => (sumVal ? x / sumVal : 0));
  } else {
    const v = units.map((u) => parseNum(u.alicuota));
    sumVal = v.reduce((a, b) => a + b, 0);
    shares = v.map((x) => x / 100);
  }

  let sGc = 0;
  let sFr = 0;

  lastResult = units.map((u, i) => {
    const gc = Math.round(total * shares[i]);
    const fr = Math.round((gc * pct) / 100);
    sGc += gc;
    sFr += fr;
    return {
      name: u.name || `Unidad ${i + 1}`,
      gc,
      fr,
      tot: gc + fr
    };
  });

  [...rowsEl.children].forEach((tr, i) => {
    const r = lastResult[i];
    tr.querySelector('[data-o="gc"]').textContent = fmt.format(r.gc);
    tr.querySelector('[data-o="fr"]').textContent = fmt.format(r.fr);
    tr.querySelector('[data-o="tot"]').textContent = fmt.format(r.tot);
  });

  document.getElementById("sum-val").textContent =
    method === "iguales"
      ? ""
      : method === "m2"
      ? nf.format(sumVal) + " m²"
      : nf.format(sumVal) + " %";

  document.getElementById("sum-gc").textContent = fmt.format(sGc);
  document.getElementById("sum-fr").textContent = fmt.format(sFr);
  document.getElementById("sum-tot").textContent = fmt.format(sGc + sFr);
  document.getElementById("big-total").textContent = fmt.format(sGc + sFr);
  document.getElementById("big-fr").textContent = fmt.format(sFr);
  document.getElementById("big-n").textContent = n;

  // Avisos y validaciones
  const msg = document.getElementById("msg");
  msg.className = "note";
  let t = "";

  if (method === "alicuota" && n && Math.abs(sumVal - 100) > 0.01) {
    msg.classList.add("warn");
    t = `Las alícuotas suman ${nf.format(sumVal)}%, no 100%. Revisa el reglamento: con estos valores se recaudaría ${fmt.format(sGc)} en vez de ${fmt.format(total)}.`;
  } else if (pct < 5 && n) {
    msg.classList.add("warn");
    t = `El recargo del fondo de reserva está bajo el 5% mínimo que exige la Ley 21.442.`;
  } else if (n && Math.abs(sGc - total) >= 1) {
    t = `Por el redondeo al peso, la suma difiere del total en ${fmt.format(Math.abs(sGc - total))}.`;
  }

  msg.textContent = t;
  save();
}

/**
 * Event Listeners
 */

// Edición de valores en las filas
rowsEl.addEventListener("input", (e) => {
  const el = e.target;
  const i = +el.dataset.i;
  const f = el.dataset.f;
  if (!f || isNaN(i)) return;
  units[i][f] = el.value;
  compute();
});

// Eliminación de una fila
rowsEl.addEventListener("click", (e) => {
  const b = e.target.closest("[data-del]");
  if (!b) return;
  units.splice(+b.dataset.del, 1);
  renderRows();
});

// Agregar nueva unidad
document.getElementById("add").addEventListener("click", () => {
  units.push({
    name: `Unidad ${units.length + 1}`,
    alicuota: "",
    m2: ""
  });
  renderRows();
  const ins = rowsEl.querySelectorAll('[data-f="name"]');
  ins[ins.length - 1]?.focus();
});

// Inputs de total y fondo de reserva
["total", "reserva"].forEach((id) => {
  document.getElementById(id).addEventListener("input", compute);
});

// Formateo del monto total al perder el foco
document.getElementById("total").addEventListener("blur", (e) => {
  const n = parseNum(e.target.value);
  if (n) {
    e.target.value = new Intl.NumberFormat("es-CL").format(n);
  }
});

// Selector de método de cálculo
document.querySelectorAll(".seg button").forEach((b) => {
  b.addEventListener("click", () => {
    method = b.dataset.m;
    document.querySelectorAll(".seg button").forEach((x) => {
      x.setAttribute("aria-pressed", String(x === b));
    });
    renderRows();
  });
});

// Copiar desglose al portapapeles
document.getElementById("copy").addEventListener("click", async () => {
  const pct = document.getElementById("reserva").value;
  const lines = [
    "Gastos comunes del mes",
    ...lastResult.map(
      (r) => `${r.name}: ${fmt.format(r.tot)} (incluye ${fmt.format(r.fr)} de fondo de reserva)`
    ),
    `Recargo fondo de reserva: ${pct}%`
  ];
  const text = lines.join("\n");
  const msg = document.getElementById("msg");

  try {
    await navigator.clipboard.writeText(text);
    msg.className = "note";
    msg.textContent = "Resultado copiado. Pégalo donde lo necesites.";
  } catch (e) {
    msg.className = "note";
    msg.textContent =
      "Tu navegador no permitió copiar automáticamente. Selecciona la tabla y cópiala manualmente.";
  }
});

// Inicialización
loadStorage();
renderRows();
