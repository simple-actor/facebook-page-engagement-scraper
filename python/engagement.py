"""The latest posts of several public Facebook pages, ranked by the median
reactions + comments + shares a post drew, with every post written to posts.csv.

    APIFY_TOKEN=... python engagement.py https://www.facebook.com/tategallery https://www.facebook.com/britishmuseum
"""
import csv
import os
import sys
from collections import defaultdict
from statistics import median

from apify_client import ApifyClient

urls = sys.argv[1:]
if not urls:
    sys.exit("Give one or more public Facebook page URLs")
client = ApifyClient(os.environ["APIFY_TOKEN"])

# 8 is the most one request to Facebook returns, so it is the most a page can give.
run = client.actor("simple.actor/facebook-page-posts").call(run_input={
    "startUrls": [{"url": u} for u in urls], "maxPosts": 8})
items = list(client.dataset(run.default_dataset_id).iterate_items())
# A page that cannot be read is a row with `error`; the run itself stays green.
for r in items:
    if r.get("error"):
        print(f"{r['facebookUrl']}: {r['error']}", file=sys.stderr)
posts = [r for r in items if not r.get("error")]

# Group by the URL you asked for: pageName is the page's own name, and a vanity URL
# can belong to a different page than the one you meant, so print both.
pages = defaultdict(list)
for p in posts:
    pages[p["facebookUrl"]].append(p)
ranked = sorted(((median(p["likes"] + p["comments"] + p["shares"] for p in ps), url, ps)
                 for url, ps in pages.items()), key=lambda r: -r[0])
for m, url, ps in ranked:
    since = min(p["time"] for p in ps)[:10]
    print(f"{m:>7}  {ps[0]['pageName']} ({len(ps)} posts since {since}) {url}")

cols = ["pageName", "time", "postType", "likes", "comments", "shares", "viewsCount", "url", "title"]
with open("posts.csv", "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(cols)
    w.writerows([p.get(c) for c in cols] for p in posts)
print(f"{len(posts)} posts written to posts.csv")
