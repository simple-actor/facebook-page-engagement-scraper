// The latest posts of several public Facebook pages, ranked by the median
// reactions + comments + shares a post drew, with every post written to posts.csv.
//
//   APIFY_TOKEN=... node engagement.mjs https://www.facebook.com/tategallery https://www.facebook.com/britishmuseum
import { ApifyClient } from 'apify-client';
import { writeFileSync } from 'node:fs';

const urls = process.argv.slice(2);
if (!urls.length) throw new Error('Give one or more public Facebook page URLs');
const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

// 8 is the most one request to Facebook returns, so it is the most a page can give.
const run = await client.actor('simple.actor/facebook-page-posts').call({
    startUrls: urls.map((url) => ({ url })), maxPosts: 8,
});
const { items } = await client.dataset(run.defaultDatasetId).listItems();
// A page that cannot be read is a row with `error`; the run itself stays green.
for (const r of items.filter((i) => i.error)) console.error(`${r.facebookUrl}: ${r.error}`);
const posts = items.filter((i) => !i.error);

const eng = (p) => p.likes + p.comments + p.shares;
const median = (xs) => {
    const s = [...xs].sort((a, b) => a - b), m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
// Group by the URL you asked for: pageName is the page's own name, and a vanity URL
// can belong to a different page than the one you meant, so print both.
const pages = Map.groupBy(posts, (p) => p.facebookUrl);
const ranked = [...pages].map(([url, ps]) => ({
    url, name: ps[0].pageName, posts: ps.length,
    since: ps.map((p) => p.time).sort()[0].slice(0, 10), median: median(ps.map(eng)),
})).sort((a, b) => b.median - a.median);
for (const r of ranked) console.log(`${String(r.median).padStart(7)}  ${r.name} (${r.posts} posts since ${r.since}) ${r.url}`);

const cols = ['pageName', 'time', 'postType', 'likes', 'comments', 'shares', 'viewsCount', 'url', 'title'];
const cell = (v) => (v == null ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
writeFileSync('posts.csv', [cols.join(','), ...posts.map((p) => cols.map((c) => cell(p[c])).join(','))].join('\n') + '\n');
console.log(`${posts.length} posts written to posts.csv`);
