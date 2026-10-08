// Kysely is ESM-only. The library and its Jest tests currently use CommonJS.
// Transform only Kysely in Jest; production Node and app bundlers load it normally.
const ts = require('typescript');
module.exports = {
	process(source, filename) {
		return { code: ts.transpileModule(source, {
			fileName: filename,
			compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
		}).outputText };
	},
};
