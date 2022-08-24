const GRAPHQL_URL = String(process.env.NEXT_PUBLIC_ZENDRO_GRAPHQL_URL ?? '');
const METAQUERY_URL = String(
  process.env.NEXT_PUBLIC_ZENDRO_METAQUERY_URL ?? ''
);
const BASEPATH = String(
  process.env.NEXT_PUBLIC_ZENDRO_BASEPATH
    ? process.env.NEXT_PUBLIC_ZENDRO_BASEPATH.replace(
        /\/*([a-zA-Z]+)\/*/g,
        '/$1'
      )
    : ''
);

const config = {
  GRAPHQL_URL,
  METAQUERY_URL,
  BASEPATH,
};

if (
  !GRAPHQL_URL ||
  !METAQUERY_URL
) {
  console.error(JSON.stringify(config, null, 2));
  throw new Error('Some mandatory variables in `env.local` are not being set');
}

export {
  GRAPHQL_URL,
  METAQUERY_URL,
  BASEPATH,
};

export default config;
