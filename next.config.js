const BASEPATH = String(
  process.env.NEXT_PUBLIC_ZENDRO_BASEPATH
    ? process.env.NEXT_PUBLIC_ZENDRO_BASEPATH.replace(
        /\/*([a-zA-Z]+)\/*/g,
        '/$1'
      )
    : ''
);

const config = {
  reactStrictMode: false,
  staticPageGenerationTimeout: 1000,
  ...(BASEPATH && { basePath: BASEPATH }),
};

module.exports = config;