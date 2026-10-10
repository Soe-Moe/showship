/**
 * Small JSON Schema validator for references/report.schema.json (no dependencies).
 *
 * Supports the keywords that schema uses: type, enum, const, required, properties,
 * patternProperties (only to allow keys), additionalProperties: false, items, minItems,
 * maxItems, minimum, maximum, maxLength, pattern, anyOf, allOf, if/then and local $ref.
 * Anything else is ignored, so editors can use the full schema while this checks the core.
 *
 * validate(data, schema) -> [{ path, level: "error" | "warn", message }]
 *   error: wrong type, missing field, bad value, text longer than maxLength
 *   warn:  unknown field (usually a typo), with a "did you mean" suggestion
 */

function typeOf(v) {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  if (Number.isInteger(v)) return "integer";
  return typeof v;
}
const typeMatches = (v, t) => (t === "number" ? typeof v === "number" : t === "integer" ? Number.isInteger(v) : typeOf(v) === t);

function distance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

function validate(data, root) {
  const out = [];
  const resolve = (s) => {
    if (s && s.$ref) {
      const target = s.$ref.replace(/^#\//, "").split("/").reduce((o, k) => (o ? o[k] : undefined), root);
      if (!target) throw new Error(`Unresolved $ref ${s.$ref}`);
      return target;
    }
    return s;
  };
  const show = (v) => { const t = JSON.stringify(v); return t && t.length > 40 ? t.slice(0, 40) + "…" : t; };

  function check(v, schema, path, sink) {
    schema = resolve(schema);
    if (!schema || typeof schema !== "object") return;
    const err = (message, level = "error") => sink.push({ path, level, message });

    if (schema.if) {
      const probe = [];
      check(v, schema.if, path, probe);
      if (!probe.some((p) => p.level === "error") && schema.then) check(v, schema.then, path, sink);
    }
    if (schema.allOf) schema.allOf.forEach((s) => check(v, s, path, sink));
    if (schema.anyOf) {
      const attempts = schema.anyOf.map((s) => { const a = []; check(v, s, path, a); return a; });
      if (!attempts.some((a) => !a.some((p) => p.level === "error"))) {
        err(`does not match any allowed shape (${schema.anyOf.map((s) => resolve(s).type || "object").join(" or ")})`);
      }
    }
    if ("const" in schema && v !== schema.const) { err(`must be ${JSON.stringify(schema.const)}`); return; }
    if (schema.enum && !schema.enum.includes(v)) { err(`${show(v)} is not one of: ${schema.enum.join(", ")}`); return; }
    if (schema.type) {
      const types = [].concat(schema.type);
      if (!types.some((t) => typeMatches(v, t))) { err(`should be ${types.join(" or ")}, found ${typeOf(v)} ${show(v)}`); return; }
    }

    if (typeof v === "string") {
      const len = [...v].length;
      if (schema.maxLength !== undefined && len > schema.maxLength) err(`${len} characters, limit ${schema.maxLength}. Shorten it so it fits its slot`);
      if (schema.pattern && !new RegExp(schema.pattern).test(v)) err(`${show(v)} has the wrong format`);
    }
    if (typeof v === "number") {
      if (schema.minimum !== undefined && v < schema.minimum) err(`${v} is below the minimum ${schema.minimum}`);
      if (schema.maximum !== undefined && v > schema.maximum) err(`${v} is above the maximum ${schema.maximum}`);
    }
    if (Array.isArray(v)) {
      if (schema.minItems !== undefined && v.length < schema.minItems) err(`has ${v.length} item(s), needs at least ${schema.minItems}`);
      if (schema.maxItems !== undefined && v.length > schema.maxItems) err(`has ${v.length} items, at most ${schema.maxItems} fit`);
      if (schema.items) v.forEach((x, i) => check(x, schema.items, `${path}[${i}]`, sink));
    }
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const props = schema.properties || {};
      for (const k of schema.required || []) if (!(k in v)) sink.push({ path: path ? `${path}.${k}` : k, level: "error", message: "is required but missing" });
      for (const [k, x] of Object.entries(v)) {
        const sub = path ? `${path}.${k}` : k;
        if (k in props) check(x, props[k], sub, sink);
        else if (schema.additionalProperties === false) {
          if (Object.keys(schema.patternProperties || {}).some((re) => new RegExp(re).test(k))) continue;
          const near = Object.keys(props).filter((p) => distance(k.toLowerCase(), p.toLowerCase()) <= 2).sort((a, b) => distance(k, a) - distance(k, b))[0];
          sink.push({ path: sub, level: "warn", message: `unknown field, it will be ignored${near ? `. Did you mean "${near}"?` : ""}` });
        }
      }
    }
  }
  check(data, root, "", out);
  return out;
}

module.exports = { validate };
