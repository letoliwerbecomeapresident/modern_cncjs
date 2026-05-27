const crypto = require('crypto');
const path = require('path');
const boolean = require('boolean');
const dotenv = require('dotenv');
const zlib = require('zlib');
const CompressionPlugin = require('compression-webpack-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const without = require('lodash/without');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const webpack = require('webpack');
const babelConfig = require('./babel.config');
const buildConfig = require('./build.config');
const pkg = require('./src/package.json');

dotenv.config({
  path: path.resolve('webpack.config.production.env'),
});

// Use publicPath for production
const publicPath = ((payload) => {
  const algorithm = 'sha1';
  const buf = String(payload);
  const hash = crypto.createHash(algorithm).update(buf).digest('hex');
  return '/' + hash.substring(0, 8) + '/'; // 8 digits
})(pkg.version);
const buildVersion = pkg.version;

module.exports = {
  mode: 'production',
  cache: true,
  target: 'web',
  context: path.resolve(__dirname, 'src/app'),
  devtool: false,
  entry: {
    main: [
      path.resolve(__dirname, 'src/app/index.jsx')
    ],
  },
  output: {
    path: path.resolve(__dirname, 'dist/cncjs/app'),
    filename: '[name].[contenthash].bundle.js',
    chunkFilename: '[name].[contenthash].bundle.js',
    publicPath: publicPath
  },
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        loader: 'babel-loader',
        options: {
          ...babelConfig(),
        },
        exclude: /node_modules/
      },
      {
        test: /\.styl$/,
        use: [
          MiniCssExtractPlugin.loader,
          {
            loader: 'css-loader',
            options: {
              localsConvention: 'camelCase',
              modules: {
                localIdentName: '[path][name]__[local]--[hash:base64:5]',
              },
              importLoaders: 1,
            }
          },
          {
            loader: 'stylus-loader',
            options: {
              stylusOptions: {
                use: ['nib'],
                import: ['nib'],
              }
            }
          }
        ],
        exclude: [
          path.resolve(__dirname, 'src/app/styles'),
        ]
      },
      {
        test: /\.styl$/,
        use: [
          MiniCssExtractPlugin.loader,
          {
            loader: 'css-loader',
            options: {
              localsConvention: 'camelCase',
              modules: false,
              url: (url) => {
                if (/fontawesome-webfont\.(eot|ttf|svg|woff)([?#]|$)/.test(url)) {
                  return false;
                }
                return true;
              },
            }
          },
          'stylus-loader',
        ],
        include: [
          path.resolve(__dirname, 'src/app/styles'),
        ]
      },
      {
        test: /\.css$/,
        use: [
          'style-loader',
          'css-loader',
        ]
      },
      {
        test: /\.(png|jpg|svg)$/,
        loader: 'url-loader',
        options: {
          limit: 8192,
          esModule: false
        }
      },
      {
        test: /\.woff(2)?(\?v=[0-9]\.[0-9]\.[0-9])?$/,
        loader: 'url-loader',
        options: {
          limit: 10000,
          mimetype: 'application/font-woff',
          esModule: false
        }
      },
      {
        test: /\.(ttf|eot)(\?v=[0-9]\.[0-9]\.[0-9])?$/,
        loader: 'file-loader',
        options: {
          esModule: false
        }
      }
    ].filter(Boolean)
  },
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        parallel: true,
        terserOptions: {
          compress: {
            drop_console: true,
            passes: 2,
          },
          format: {
            comments: false,
          },
        },
        extractComments: false,
      }),
      new CssMinimizerPlugin(),
    ],
    runtimeChunk: 'single',
    splitChunks: {
      chunks: 'all',
      maxInitialRequests: 25,
      minSize: 20000,
      cacheGroups: {
        three: {
          test: /[\\/]node_modules[\\/]three[\\/]/,
          name: 'vendor.three',
          priority: 30,
        },
        react: {
          test: /[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|react-redux|redux|react-router-redux)[\\/]/,
          name: 'vendor.react',
          priority: 25,
        },
        trendmicro: {
          test: /[\\/]node_modules[\\/]@trendmicro[\\/]/,
          name: 'vendor.trendmicro',
          priority: 20,
        },
        lodash: {
          test: /[\\/]node_modules[\\/]lodash[\\/]/,
          name: 'vendor.lodash',
          priority: 20,
        },
        dayjs: {
          test: /[\\/]node_modules[\\/]dayjs[\\/]/,
          name: 'vendor.dayjs',
          priority: 20,
        },
        i18next: {
          test: /[\\/]node_modules[\\/](i18next|react-i18next)[\\/]/,
          name: 'vendor.i18next',
          priority: 20,
        },
        vendors: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendor.misc',
          priority: 10,
        },
      },
    },
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env': {
        NODE_ENV: JSON.stringify('production'),
        BUILD_VERSION: JSON.stringify(buildVersion),
        LANGUAGES: JSON.stringify(buildConfig.languages),
        TRACKING_ID: JSON.stringify(buildConfig.analytics.trackingId),
      }
    }),
    new webpack.ContextReplacementPlugin(
      /dayjs[\/\\]locale$/,
      new RegExp('^\\./(' + without(buildConfig.languages, 'en').join('|') + ')(\\.js)?$')
    ),
    new MiniCssExtractPlugin({
      filename: '[name].[contenthash].css',
      chunkFilename: '[id].[contenthash].css',
    }),
    new HtmlWebpackPlugin({
      filename: 'index.hbs',
      template: path.resolve(__dirname, 'index.hbs'),
    }),
    new CompressionPlugin({
      algorithm: 'gzip',
      test: /\.(js|css|html|svg)$/,
      threshold: 1024,
      minRatio: 0.8,
    }),
    new CompressionPlugin({
      algorithm: 'brotliCompress',
      filename: '[path][base].br',
      test: /\.(js|css|html|svg)$/,
      compressionOptions: {
        params: {
          [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
        },
      },
      threshold: 1024,
      minRatio: 0.8,
    }),
    ...(process.env.ANALYZE ? [
      new (require('webpack-bundle-analyzer').BundleAnalyzerPlugin)({
        analyzerMode: 'static',
        openAnalyzer: false,
        reportFilename: path.resolve(__dirname, 'dist/cncjs/bundle-report.html'),
      }),
    ] : []),
  ],
  resolve: {
    alias: {
      '@app': path.resolve(__dirname, 'src/app'),
    },
    extensions: ['.js', '.jsx'],
    fallback: {
      crypto: require.resolve('crypto-browserify'),
      fs: false,
      net: false,
      path: require.resolve('path-browserify'),
      stream: require.resolve('stream-browserify'),
      timers: require.resolve('timers-browserify'),
      tls: false,
    },
    modules: [
      path.resolve(__dirname, 'src'),
      'node_modules'
    ],
  },
};
