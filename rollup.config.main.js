import commonjs from '@rollup/plugin-commonjs'
import resolve from '@rollup/plugin-node-resolve'
import typescript from 'rollup-plugin-typescript2'

export default {
  input: 'src/index.ts',
  plugins: [typescript(), commonjs(), resolve()],
  output: {
    file: 'tabnine.novaextension/Scripts/index.js',
    sourcemap: true,
    format: 'cjs',
  },
}
