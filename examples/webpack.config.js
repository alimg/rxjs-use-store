var HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require("path");

module.exports = {
    mode: "development",
    devtool: "source-map",
    entry: './examples/index.tsx',
    module: {
      rules: [
        // all files with a `.ts` or `.tsx` extension will be handled by `ts-loader`
        { test: /\.tsx?$/, loader: "ts-loader" }
      ]
    },
    resolve: {
        extensions: ['.ts', '.js', '.json', ".tsx"]
    },
    output: {
        filename: "bundle.js"
    },

    devServer: {
        port: 4000,
        open: true,
        hot: true
    },

    plugins: [new HtmlWebpackPlugin({
        template: "examples/index.html",
        hash: true, // This is useful for cache busting
        filename: 'index.html'
    })]
}
