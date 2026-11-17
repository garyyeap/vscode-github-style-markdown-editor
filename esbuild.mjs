import * as esbuild from 'esbuild';

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

/** @type {esbuild.BuildOptions[]} */
const builds = [
    {
        entryPoints: ['src/extension.ts'],
        outfile: 'dist/extension.js',
        bundle: true,
        platform: 'node',
        format: 'cjs',
        target: 'node20',
        external: ['vscode'],
    },
    {
        entryPoints: { main: 'src/webview/main.ts' },
        outdir: 'dist/webview',
        bundle: true,
        platform: 'browser',
        format: 'esm',
        target: 'es2022',
        splitting: true,
        chunkNames: 'chunks/[name]-[hash]',
        assetNames: 'assets/[name]-[hash]',
        loader: {
            '.woff': 'file',
            '.woff2': 'file',
            '.ttf': 'file',
        },
    },
];

const contexts = await Promise.all(builds.map(options => esbuild.context({
    ...options,
    minify: production,
    sourcemap: !production,
    logLevel: 'info',
})));

if (watch) {
    await Promise.all(contexts.map(ctx => ctx.watch()));
} else {
    await Promise.all(contexts.map(ctx => ctx.rebuild()));
    await Promise.all(contexts.map(ctx => ctx.dispose()));
}
