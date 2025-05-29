import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import terser from '@rollup/plugin-terser';
// import dts from 'rollup-plugin-dts';

export default [
  // JS 构建
  {
    input: 'jspredict-dc.js',
    output: [
      {
        file: 'dist/jspredict-dc.esm.js',
        format: 'esm',
        sourcemap: true,
      },
      {
        file: 'dist/jspredict-dc.cjs.js',
        format: 'cjs',
        sourcemap: true,
        exports: 'default'
      },
      {
        file: 'dist/jspredict-dc.umd.js',
        format: 'umd',
        name: 'jspredict_dc',
        sourcemap: true,
      },
      {
        file: 'dist/jspredict-dc.amd.js',
        format: 'amd',
        sourcemap: true,
      }
    ],
    plugins: [
      resolve(),
      commonjs(),
      json(),
      terser()
    ]
  },
  // 类型声明构建
  // {
  //   input: 'types/jspredict-dc.d.ts',
  //   output: [{ file: 'dist/jspredict-dc.d.ts', format: 'es' }],
  //   plugins: [dts()]
  // }
];
