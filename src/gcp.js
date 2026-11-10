// Google Cloud product icons (official set from cloud.google.com/icons, stored in assets/gcp/).
// Every board part maps to the GCP product you would actually use for it, or to null when the part
// is a design pattern rather than a product (idempotency keys, locks, sequence numbers…), which keeps its emoji.
// A scenario can override per item/node with `gcp: 'memorystore'` (or `gcp: null`) and `cat: 'data'`.

import { url } from './base.js';

export const PRODUCTS = {
  'compute-engine': 'Compute Engine',
  'cloud-run': 'Cloud Run',
  'cloud-functions': 'Cloud Functions',
  gke: 'Google Kubernetes Engine',
  batch: 'Batch',
  'cloud-sql': 'Cloud SQL',
  spanner: 'Spanner',
  bigtable: 'Bigtable',
  firestore: 'Firestore',
  'cloud-storage': 'Cloud Storage',
  bigquery: 'BigQuery',
  memorystore: 'Memorystore',
  'cloud-cdn': 'Cloud CDN',
  'cloud-armor': 'Cloud Armor',
  'load-balancing': 'Cloud Load Balancing',
  'api-gateway': 'API Gateway',
  'service-mesh': 'Cloud Service Mesh',
  pubsub: 'Pub/Sub',
  'cloud-tasks': 'Cloud Tasks',
  dataflow: 'Dataflow',
  'cloud-scheduler': 'Cloud Scheduler',
  'cloud-logging': 'Cloud Logging',
  'vertex-ai': 'Vertex AI',
  maps: 'Google Maps Platform',
};

// Shop sections, in display order.
export const CATS = [
  ['core', 'Your system'],
  ['compute', 'Compute'],
  ['data', 'Data'],
  ['cache', 'Cache'],
  ['async', 'Async'],
  ['edge', 'Edge'],
  ['ai', 'AI'],
  ['pattern', 'Patterns'],
];

// key → [product | null, category]. Keys are item/node ids; 'scenario:key' wins over 'key'.
const MAP = {
  // compute
  instance: ['compute-engine', 'compute'], server: ['compute-engine', 'compute'], api: ['compute-engine', 'compute'],
  worker: ['cloud-run', 'compute'], fanout: ['cloud-run', 'compute'], transcode: ['batch', 'compute'],
  k8s: ['gke', 'compute'], micro: ['gke', 'compute'], codec: [null, 'compute'],
  notify: ['cloud-functions', 'compute'], email: ['cloud-functions', 'compute'], hooks: ['cloud-functions', 'compute'], push: ['cloud-functions', 'compute'],
  'chat:push': [null, 'edge'],
  // data
  db: ['cloud-sql', 'data'], replica: ['cloud-sql', 'data'], dbup: ['cloud-sql', 'data'], 'chat:db': ['bigtable', 'data'], dbnode: ['bigtable', 'data'],
  shard: ['spanner', 'data'], nosql: ['firestore', 'data'], storage: ['cloud-storage', 'data'], presign: ['cloud-storage', 'data'],
  stats: ['bigquery', 'data'], warehouse: ['bigquery', 'data'],
  pgbouncer: [null, 'data'], search: [null, 'data'], idgen: [null, 'data'], unique: [null, 'data'], graph: [null, 'data'], chain: [null, 'data'],
  // cache
  cache: ['memorystore', 'cache'], timeline: ['memorystore', 'cache'], trie: ['memorystore', 'cache'], counter: ['memorystore', 'cache'],
  presence: ['memorystore', 'cache'], geo: ['memorystore', 'cache'], etacache: ['memorystore', 'cache'],
  // async
  queue: ['pubsub', 'async'], outbox: ['pubsub', 'async'], 'video:queue': ['cloud-tasks', 'async'],
  trend: ['dataflow', 'async'], logs: ['cloud-logging', 'async'], recon: ['cloud-scheduler', 'async'],
  // edge
  cdn: ['cloud-cdn', 'edge'], ratelimit: ['cloud-armor', 'edge'], shield: ['cloud-armor', 'edge'],
  region: ['load-balancing', 'edge'], multi: ['load-balancing', 'edge'], ws: ['compute-engine', 'edge'], mesh: ['service-mesh', 'edge'],
  maps: ['maps', 'edge'], quota: ['maps', 'edge'], owncdn: [null, 'edge'], ownpush: [null, 'edge'], waitroom: [null, 'edge'],
  // ai
  personal: ['vertex-ai', 'ai'], ranker: ['vertex-ai', 'ai'], ml: ['vertex-ai', 'ai'], risk: ['vertex-ai', 'ai'],
};

/** { product: id|null, name: display name|null, cat, src: url|null } for a scenario item or node. */
export function gcpOf(sc, key, obj = {}) {
  if (obj.core) key = obj.core; // a core part ("core:db") looks like the node it builds
  let [product, cat] = MAP[`${sc.id}:${key}`] || MAP[key] || [null, 'pattern'];
  if ('gcp' in obj) product = obj.gcp;
  if (obj.cat) cat = obj.cat;
  return { product, name: product ? PRODUCTS[product] : null, cat, src: product ? url(`assets/gcp/${product}.svg`) : null };
}

/** Icon markup: the GCP product image, or the part's emoji when it is a pattern. */
export function iconHtml(sc, key, obj = {}, cls = 'gx') {
  const g = gcpOf(sc, key, obj);
  return g.src ? `<img class="${cls}" src="${g.src}" alt="" draggable="false">` : obj.icon ? `<span class="${cls} emo">${obj.icon}</span>` : '';
}
