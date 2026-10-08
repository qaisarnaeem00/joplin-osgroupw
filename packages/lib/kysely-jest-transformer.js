// Kysely 0.29 is ESM-only. Transform only this dependency for our CommonJS
// compiled-JavaScript tests, without changing the application's module format.
const ts = require('typescript');

module.exports = {
	process(source, filename) {
		return {
			code: ts.transpileModule(source, {
				fileName: filename,
				compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, allowJs: true },
			}).outputText,
		};
	},
};
