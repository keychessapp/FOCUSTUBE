import { readFile, writeFile } from 'node:fs/promises';

const H = {
  'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
  Cookie: 'CONSENT=YES+1; SOCS=CAI',
};
const get = (u, o = {}) => fetch(u, { headers: H, ...o });
const dec = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

async function resolveId(line) {
  const direct = line.match(/UC[\w-]{22}/);
  if (direct) return direct[0];
  const url = line.startsWith('http') ? line : 'https://www.youtube.com/' + (line.startsWith('@') ? line : '@' + line);
  const html = await (await get(url)).text();
  const m = html.match(/itemprop="channelId" content="(UC[\w-]{22})"/) || html.match(/"externalId":"(UC[\w-]{22})"/) || html.match(/youtube\.com\/channel\/(UC[\w-]{22})/);
  if (!m) throw new Error('channel id not found');
  return m[1];
}

async function isShort(id) {
  const r = await get('https://www.youtube.com/shorts/' + id, { redirect: 'manual' });
  return r.status === 200;
}

async function latestOf(source) {
  const channelId = await resolveId(source);
  const res = await get('https://www.youtube.com/feeds/videos.xml?channel_id=' + channelId);
  if (!res.ok) throw new Error('feed ' + res.status);
  const xml = await res.text();
  const channel = dec(xml.match(/<title>(.*?)<\/title>/)[1]);
  for (const e of xml.split('<entry>').slice(1)) {
    const id = e.match(/<yt:videoId>(.*?)<\/yt:videoId>/)[1];
    if (await isShort(id)) continue;
    return {
      source, channelId, channel, id,
      title: dec(e.match(/<title>(.*?)<\/title>/)[1]),
      published: e.match(/<published>(.*?)<\/published>/)[1],
    };
  }
  throw new Error('no regular videos in feed');
}

const sources = (await readFile('channels.txt', 'utf8')).split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
let prev = [];
try { prev = JSON.parse(await readFile('latest.json', 'utf8')).items || []; } catch {}

const items = [];
for (const source of sources) {
  try {
    items.push(await latestOf(source));
  } catch (err) {
    console.log('Failed:', source, err.message);
    const old = prev.find((p) => p.source === source);
    if (old) items.push(old);
  }
}
await writeFile('latest.json', JSON.stringify({ updated: new Date().toISOString(), items }, null, 2));
console.log('Saved', items.length, 'channels');
