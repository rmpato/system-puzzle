// Chat at Scale copy. Keep it short: playable without reading.

export const QUESTIONS = [
  { q: '1:1 only, or groups too?', a: 'Both. Groups up to 256.', good: true },
  { q: 'How fast must messages arrive?', a: 'Under a second when online.', good: true },
  { q: 'What if the recipient is offline?', a: 'Store it, push a notification.', good: true },
  { q: 'Is message order important?', a: 'Yes, per conversation.', good: true },
  { q: 'Keep history forever?', a: 'Yes, synced across devices.', good: true },
  { q: 'Photos and voice notes?', a: 'Yes, mostly on mobile.', good: true },
  { q: 'Multi-region active-active day one?', a: '"We launch in one country…"', good: false, flag: 'Over-engineering before requirements' },
  { q: 'Which emoji set?', a: 'Not a backend question.', good: false },
];

const o = (t, good, why) => ({ t, good, why });

export const CARDS = {
  start: { icon: '📡', title: 'How do messages reach clients?', text: 'Must feel instant.', fix: 'ws', opts: [
    o('Persistent WebSockets via a gateway', true, 'Server pushes the moment it arrives.'),
    o('Clients poll every second', false, 'Mostly empty, costly requests.'),
    o('Email-style fetch on open', false, 'Not real time.')] },
  media: { icon: '🖼️', title: 'Photos through chat servers', text: 'Sockets choke on big uploads.', fix: 'cdn', opts: [
    o('Upload to object storage, send a link', true, 'Bytes skip the chat path; CDN serves.'),
    o('Base64 inside the message', false, 'Huge rows, slow sockets.'),
    o('Add more chat servers', false, 'Paying compute to move bytes.')] },
  presence: { icon: '🟢', title: 'Typing events hit the DB', text: 'Thousands per second, useless in 5s.', fix: 'presence', opts: [
    o('In-memory store with TTL', true, 'Ephemeral data, never persisted.'),
    o('Write them to the message DB', false, 'Durable writes for throwaway data.'),
    o('Drop typing indicators', false, 'Product asked for them.')] },
  dbload: { icon: '🔥', title: 'Message DB at 100%', text: 'Users reopen chats constantly.', fix: 'cache', opts: [
    o('Cache recent messages per chat', true, 'Most reads are the last page.'),
    o('Load full history on open', false, 'Paginate: newest 50 first.'),
    o('Move messages to Postgres', false, 'Same load, weaker write scaling.')] },
  double: { icon: '👯', title: 'Message shown twice', text: 'Flaky 4G: the client retried.', fix: 'idem', opts: [
    o('Client message ID, dedupe on server', true, 'Retries become no-ops.'),
    o('Never retry sends', false, 'Then messages get lost.'),
    o('Dedupe by text + time', false, '"ok" "ok" is a real pair.')] },
  race: { icon: '🔀', title: 'Messages out of order', text: 'Two sends, two servers, same chat.', fix: 'seq', opts: [
    o('Per-conversation sequence numbers', true, 'One counter per chat orders it.'),
    o('Sort by client clock', false, 'Phone clocks drift.'),
    o('One global counter', false, 'Single bottleneck for everyone.')] },
  timeout: { icon: '📭', title: 'Message never arrived', text: 'Recipient switched networks mid-send.', fix: 'acks', opts: [
    o('Acks + retry until delivered', true, 'At-least-once delivery.'),
    o('Fire and forget', false, 'At-most-once loses messages.'),
    o('Ask users to resend', false, 'Not a delivery guarantee.')] },
  push: { icon: '🔕', title: 'APNs is down', text: 'Offline users get no alert.', fix: 'queue', opts: [
    o('Queue pushes, retry when it recovers', true, 'Nothing lost, delivered late.'),
    o('Retry inline in the send path', false, 'Sends now fail with APNs.'),
    o('Build our own push protocol', false, 'Phones only wake for APNs/FCM.')] },
  groups: { icon: '👥', title: 'Group messages are heavy', text: '1 send → 200 inbox writes.', opts: [
    o('Ack once, fan out async via a queue', true, 'Sender isn\'t blocked by members.'),
    o('Write all inboxes before acking', false, 'Latency grows with group size.'),
    o('Clients poll the group', false, 'Polling again, ×200.')] },
  spike: { icon: '🎆', title: 'New Year\'s midnight', text: '10× messages in one minute.', fix: 'queue', opts: [
    o('Queue absorbs it, scale consumers', true, 'Buffer, then drain.'),
    o('Reject sends over a limit', false, 'Worst moment to fail users.'),
    o('Sync fan-out, bigger servers', false, 'Peaks beat any box.')] },
  // whiteboard cards
  storage: { icon: '🗄️', title: 'Store billions of messages', text: 'Write-heavy, read by chat.', opts: [
    o('Wide-column, partition by conversation', true, 'One chat = one partition, sorted by seq.'),
    o('One Postgres table, index later', false, 'Single writer won\'t keep up.'),
    o('Partition by sender', false, 'A chat spans many partitions.')] },
  pagination: { icon: '📜', title: 'Scroll up in a chat', text: 'Years of history.', opts: [
    o('Cursor: messages before seq N', true, 'Stable pages, one partition.'),
    o('OFFSET 5000 LIMIT 50', false, 'Scans everything it skips.'),
    o('Send the whole history', false, 'Megabytes per open.')] },
  e2e: { icon: '🔐', title: 'End-to-end encryption', text: 'Legal wants server-side search.', opts: [
    o('Search on device; server sees ciphertext', true, 'E2E means the server can\'t read.'),
    o('Keep a decrypted copy to index', false, 'Then it isn\'t end-to-end.'),
    o('Encrypt only in transit', false, 'TLS isn\'t E2E.')] },
  bigroup: { icon: '📣', title: '100K-member channel', text: 'Fan-out on write explodes.', opts: [
    o('Fan-out on read for huge groups', true, 'Members pull one shared timeline.'),
    o('Same fan-out, more workers', false, '100K writes per message.'),
    o('Disallow big groups', false, 'Product wants channels.')] },
  sticky: { icon: '🔗', title: 'Which gateway holds Bob?', text: 'Alice is on gateway 3.', opts: [
    o('Session registry: user → gateway', true, 'Route to the right socket.'),
    o('Broadcast to every gateway', false, 'N× traffic per message.'),
    o('Force everyone onto one gateway', false, 'Can\'t scale connections.')] },
  final: { icon: '🎯', title: 'MVP in a month, 4 people', text: 'What do you keep?', opts: [
    o('WebSockets, message IDs, seq, push queue', true, 'Correct delivery first.'),
    o('Multi-region and own push first', false, 'Scale before users.'),
    o('Skip dedupe and ordering', false, 'Users notice instantly.')] },
  reverse: { icon: '↩️', title: 'Hardest to reverse?', text: 'Of everything you chose today.', opts: [
    o('Partition key and message IDs', true, 'Every row and client depends on them.'),
    o('The cache library', false, 'Swappable behind an interface.'),
    o('The CDN vendor', false, 'Mostly configuration.')] },
};

export const PUZZLES = {
  flow: {
    kind: 'order', icon: '🧭', title: 'Send a message', text: 'Tap the steps in order.',
    items: ['Client sends with message ID', 'Gateway forwards over socket', 'Store with next seq', 'Ack sender: sent ✓', 'Fan out to recipients', 'Recipient acks: delivered ✓✓'],
    signal: 'Walked the send path end to end', flag: 'Shaky on the message send flow',
  },
  schema: {
    kind: 'pick', icon: '📝', title: 'Message row', text: 'Pick the 4 fields to store.', pick: 4,
    items: [
      { t: 'conversation_id', good: true },
      { t: 'seq', good: true },
      { t: 'message_id (client)', good: true },
      { t: 'sender_id', good: true },
      { t: 'sender_name', good: false, why: 'Changes; look it up' },
      { t: 'is_online', good: false, why: 'Presence, not message data' },
      { t: 'global auto-increment id', good: false, why: 'One counter for the planet' },
    ],
    signal: 'Designed a sound message schema', flag: 'Message schema can\'t order or dedupe',
  },
  routing: {
    kind: 'sort', icon: '🔀', title: 'Memory or durable?', text: 'Where does each piece live?',
    buckets: ['⚡ In-memory TTL', '💾 Durable DB'],
    items: [
      { t: 'Typing indicator', a: 0 },
      { t: 'Online heartbeat', a: 0 },
      { t: 'User → gateway map', a: 0, why: 'Rebuilt on reconnect' },
      { t: 'Message body', a: 1 },
      { t: 'Group members', a: 1 },
      { t: 'Delivered receipts', a: 1, why: 'Must survive restarts' },
    ],
    signal: 'Separates ephemeral from durable data', flag: 'Would persist ephemeral data (or lose durable)',
  },
};

export const BREAKS = {
  1: ['flow', 'schema', 'storage'],
  2: ['routing', 'sticky', 'pagination'],
  3: ['bigroup', 'e2e'],
};
export const FINALS = ['final', 'reverse'];
