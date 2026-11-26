import { copyFile, mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDirectory = process.argv[2];
const inventoryUrl =
  process.env.PRODUCTS_URL ||
  "https://repartofacil.onrender.com/api/cobrofacil/products";

if (!sourceDirectory) {
  throw new Error(
    "Uso: node scripts/import-product-images.mjs <carpeta-png-productos>"
  );
}

function normalizeName(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const response = await fetch(inventoryUrl);
if (!response.ok) {
  throw new Error(`No se pudo leer el inventario (${response.status}).`);
}

const inventory = await response.json();
if (!Array.isArray(inventory?.products) || inventory.products.length === 0) {
  throw new Error("Cobro Fácil no devolvió productos; no se copiará ninguna imagen.");
}

const sourceFiles = await readdir(sourceDirectory, { withFileTypes: true });
const candidatesByName = new Map();
for (const entry of sourceFiles) {
  if (!entry.isFile() || !/\.(png|jpe?g|webp)$/i.test(entry.name)) continue;
  const key = normalizeName(path.parse(entry.name).name);
  const candidates = candidatesByName.get(key) || [];
  candidates.push(entry.name);
  candidatesByName.set(key, candidates);
}

const outputDirectory = path.join(repositoryRoot, "public", "productos");
const manifestPath = path.join(
  repositoryRoot,
  "src",
  "data",
  "productImageManifest.json"
);
await mkdir(outputDirectory, { recursive: true });

const productNames = new Set(
  inventory.products
    .map((product) => normalizeName(product?.name))
    .filter(Boolean)
);
const manifest = {};
const ambiguous = [];
const pendingNames = [];
const failed = [];

for (const key of productNames) {
  const candidates = candidatesByName.get(key) || [];
  const baseFiles = candidates.filter(
    (filename) => !/_\d+$/.test(path.parse(filename).name)
  );

  if (baseFiles.length !== 1) {
    if (baseFiles.length > 1) ambiguous.push(key);
    else pendingNames.push(key);
    continue;
  }

  const sourceName = baseFiles[0];
  const extension = path.extname(sourceName).toLowerCase();
  const destinationName = `${key}${extension}`;
  try {
    await copyFile(
      path.join(sourceDirectory, sourceName),
      path.join(outputDirectory, destinationName)
    );
    manifest[key] = `/productos/${destinationName}`;
  } catch (error) {
    failed.push({ key, sourceName, error: String(error) });
    console.error(`No se pudo copiar ${sourceName}; se continúa con los demás.`, error);
  }
}

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

const matched = Object.keys(manifest).length;
const pendingCount = productNames.size - matched;
console.log(
  `Productos: ${inventory.products.length}; nombres únicos: ${productNames.size}; ` +
    `imágenes copiadas: ${matched}; fotos pendientes: ${pendingCount}; ` +
    `ambiguos: ${ambiguous.length}; fallos: ${failed.length}.`
);

if (ambiguous.length) {
  console.error("Nombres con más de una imagen base:", ambiguous.join(", "));
}
if (pendingNames.length) {
  console.warn("Sin coincidencia base exacta:", pendingNames.join(", "));
}
if (failed.length || ambiguous.length) process.exitCode = 1;
