import { nodeResolve } from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'

export default {
  input: 'src/index.js',
  output: {
    file: 'tabnine.novaextension/Scripts/main.js',
    format: 'cjs',
  },
  plugins: [commonjs(), nodeResolve()],
}
