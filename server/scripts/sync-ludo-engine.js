// Keeps ONE Ludo rules engine.
//
// The server (CommonJS) owns the engine in server/src/games/ludo/. The client
// (ES modules, built separately and deployed separately) needs the very same
// rules for Local Ludo and for animating the server's results, and a file shared
// across the two deployments would not exist on one side. So the client copy is
// GENERATED from the server files by this script, never edited by hand:
//
//   node scripts/sync-ludo-engine.js           regenerate client/src/games/ludo/*
//   node scripts/sync-ludo-engine.js --check   exit 1 if the client copy is stale
//
// The engine files follow two conventions this script relies on: dependencies are
// `const { a, b } = require("./file");` and the file ends with a single
// `module.exports = { a, b, ... };`. tests/ludo/sync.test.js runs --check, so a
// change to the engine that isn't synced fails the test suite.

const fs = require("fs");
const path = require("path");

const SOURCE = path.join(__dirname, "..", "src", "games", "ludo");
const TARGET = path.join(__dirname, "..", "..", "client", "src", "games", "ludo");
const FILES = ["board", "rng", "rules", "variants", "engine"];

const HEADER = (name) =>
  `// GENERATED FILE — do not edit. Source: server/src/games/ludo/${name}.js\n` +
  "// Regenerate with `npm run sync:ludo` in server/ (see server/scripts/sync-ludo-engine.js).\n\n";

function toModule(source, name) {
  let output = source.replace(/const\s*\{([^}]*)\}\s*=\s*require\("\.\/([^"]+)"\);/g, (_, names, file) => {
    const list = names.split(",").map((item) => item.trim()).filter(Boolean).join(", ");
    return `import { ${list} } from "./${file}.js";`;
  });

  const exportMatch = output.match(/module\.exports\s*=\s*\{([\s\S]*?)\};\s*$/);
  if (!exportMatch) throw new Error(`${name}.js must end with a single module.exports = { ... };`);
  const exported = exportMatch[1].split(",").map((item) => item.trim()).filter(Boolean);
  if (exported.some((item) => !/^[A-Za-z_$][\w$]*$/.test(item))) throw new Error(`${name}.js: module.exports may only list plain names.`);
  output = output.replace(exportMatch[0], `export { ${exported.join(", ")} };\n`);

  if (/\brequire\(/.test(output) || /module\.exports/.test(output)) throw new Error(`${name}.js has CommonJS left over after conversion.`);
  return HEADER(name) + output;
}

function run(check) {
  const stale = [];
  fs.mkdirSync(TARGET, { recursive: true });
  for (const name of FILES) {
    const generated = toModule(fs.readFileSync(path.join(SOURCE, `${name}.js`), "utf8").replace(/\r\n/g, "\n"), name);
    const targetFile = path.join(TARGET, `${name}.js`);
    const current = fs.existsSync(targetFile) ? fs.readFileSync(targetFile, "utf8").replace(/\r\n/g, "\n") : null;
    if (current !== generated) {
      stale.push(name);
      if (!check) fs.writeFileSync(targetFile, generated);
    }
  }
  return stale;
}

if (require.main === module) {
  const check = process.argv.includes("--check");
  const stale = run(check);
  if (check) {
    if (stale.length) {
      console.error(`Ludo engine copy in the client is out of date: ${stale.join(", ")}. Run \`npm run sync:ludo\` in server/.`);
      process.exit(1);
    }
    console.log("Ludo engine copy is up to date.");
  } else {
    console.log(stale.length ? `Updated: ${stale.join(", ")}` : "Already up to date.");
  }
}

module.exports = { run, toModule, FILES };
