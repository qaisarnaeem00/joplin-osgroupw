const { build } = require('../../../app-desktop/node_modules/esbuild');
const { join, basename } = require('path');
const { readFileSync } = require('fs');

// Regenerate when updating Kysely. Keep this compiler-only bundle compatible
// with CommonJS and app runtimes that lack the recent standard library methods.
const compatibility = {
	name: 'compiler-runtime-compatibility',
	setup(builder) {
		builder.onLoad({ filter: /\/kysely\/dist\/(query-compiler\/(default-query-compiler|compiled-query)|operation-node\/unique-constraint-node)\.js$/ }, args => {
			let contents = readFileSync(args.path, 'utf8');
			if (basename(args.path) === 'default-query-compiler.js') contents = contents.replace('arr.toSorted(', 'arr.slice().sort(');
			if (basename(args.path) === 'unique-constraint-node.js') contents = contents.replace('columns.at(0)', 'columns[0]');
			if (basename(args.path) === 'compiled-query.js') contents = contents.replace(/Object\.hasOwn\(/g, 'Object.prototype.hasOwnProperty.call(');
			return { contents, loader: 'js' };
		});
	},
};

build({
	entryPoints: [join(__dirname, 'kyselyRuntime.ts')],
	outfile: join(__dirname, 'vendor/kysely.cjs'),
	bundle: true,
	platform: 'neutral',
	format: 'cjs',
	target: 'es2017',
	minify: true,
	legalComments: 'inline',
	plugins: [compatibility],
	banner: { js: '/* Generated from Kysely 0.29.6 by buildKysely.js. See LICENSE. */\n/* eslint-disable */\n/* cSpell:disable */' },
}).catch(error => {
	console.error(error);
	process.exitCode = 1;
});
