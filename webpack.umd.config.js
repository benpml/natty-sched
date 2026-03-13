const path = require('path');

module.exports = {
  mode: 'production',
  target: 'web',
  entry: './index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'natty-sched.umd.js',
    library: {
      name: 'NattySched',
      type: 'var'
    }
  }
};
