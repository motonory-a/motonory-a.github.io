#!/usr/bin/env python3
"""UFOミステリーマップの都道府県別ページとサイトマップを作る。
data.js を更新したら、このスクリプトを実行する:  python3 tools/build_ufo_pages.py
"""
import html, json, os, datetime

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "ufo")
BASE = "https://motonory-a.github.io/ufo/"
PREFS = [("北海道","hokkaido"),("青森県","aomori"),("岩手県","iwate"),("宮城県","miyagi"),("秋田県","akita"),("山形県","yamagata"),("福島県","fukushima"),
 ("茨城県","ibaraki"),("栃木県","tochigi"),("群馬県","gunma"),("埼玉県","saitama"),("千葉県","chiba"),("東京都","tokyo"),("神奈川県","kanagawa"),
 ("新潟県","niigata"),("富山県","toyama"),("石川県","ishikawa"),("福井県","fukui"),("山梨県","yamanashi"),("長野県","nagano"),("岐阜県","gifu"),
 ("静岡県","shizuoka"),("愛知県","aichi"),("三重県","mie"),("滋賀県","shiga"),("京都府","kyoto"),("大阪府","osaka"),("兵庫県","hyogo"),("奈良県","nara"),
 ("和歌山県","wakayama"),("鳥取県","tottori"),("島根県","shimane"),("岡山県","okayama"),("広島県","hiroshima"),("山口県","yamaguchi"),("徳島県","tokushima"),
 ("香川県","kagawa"),("愛媛県","ehime"),("高知県","kochi"),("福岡県","fukuoka"),("佐賀県","saga"),("長崎県","nagasaki"),("熊本県","kumamoto"),
 ("大分県","oita"),("宮崎県","miyazaki"),("鹿児島県","kagoshima"),("沖縄県","okinawa")]
STATUS = {"official": "公式情報あり", "press": "報道あり", "archive": "記録あり", "unverified": "真偽不明"}
e = html.escape

def load():
    t = open(os.path.join(ROOT, "data.js"), encoding="utf-8").read()
    return json.loads(t[t.index("{"):t.rindex("}") + 1])

STYLE = """<style>body{margin:0;background:#090c27;color:#e8eaf6;font:16px/1.85 'Noto Sans JP',sans-serif}a{color:#9fd8ff}main{max-width:860px;margin:0 auto;padding:28px 22px 60px}
h1{font-size:27px;line-height:1.5}h2{font-size:20px;margin-top:34px;border-top:1px solid rgba(160,180,255,.25);padding-top:16px}article{border-bottom:1px solid rgba(160,180,255,.18);padding:12px 0}
article h3{font-size:18px;margin:0}.m{font-size:12px;color:#a9b3d6}.n{font-size:13px;color:#a9b3d6}nav a{margin-right:12px;font-size:14px;display:inline-block}.src a{font-size:12px;margin-right:10px}</style>"""

def page(title, desc, canonical, body):
    return f"""<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{e(title)}</title><meta name="description" content="{e(desc)}"><link rel="canonical" href="{canonical}">
<meta property="og:title" content="{e(title)}"><meta property="og:description" content="{e(desc)}"><meta property="og:type" content="website">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap" rel="stylesheet">{STYLE}</head>
<body><main>{body}
<p class="n">このページは目撃談・伝承・イベントを調査して紹介するものです。UFOの出現や宇宙人との遭遇を保証するものではありません。立入禁止の場所や私有地には入らないでください。</p>
<p class="n"><a href="{BASE}">日本全国UFOミステリーマップ（地図で見る）</a>／<a href="https://motonory-a.github.io/">高次元ネゴシエイター アッキー</a></p></main></body></html>"""

def main():
    d = load()
    cats = {c["id"]: c["label"] for c in d["categories"]}
    os.makedirs(os.path.join(ROOT, "p"), exist_ok=True)
    today = datetime.date.today().isoformat()
    by = {}
    for s in d["spots"]:
        by.setdefault(s["pref"], []).append(s)
    made = []
    for pref, slug in PREFS:
        spots = by.get(pref)
        if not spots:
            continue
        spots.sort(key=lambda s: (not s.get("featured"), s["name"]))
        title = f"{pref}のUFOスポット・目撃談・観測会 {len(spots)}件｜UFOミステリーマップ"
        desc = f"{pref}のUFO目撃談のある場所、遭遇事件、観測会、都市伝説など{len(spots)}件を、出典つきで紹介。"
        arts = []
        for s in spots:
            meta = " ／ ".join(x for x in [s.get("city", ""), cats.get(s.get("kind"), ""), STATUS.get(s.get("status"), ""), s.get("era", "")] if x)
            src = "".join(f'<a href="{e(u)}" rel="nofollow noopener" target="_blank">{e(n)}</a>' for n, u in (s.get("sources") or [])[:3])
            arts.append(f'<article><h3><a href="../#spot={e(s["id"])}">{e(s["name"])}</a></h3><p class="m">{e(meta)}</p>'
                        f'<p>{e(s.get("lead", ""))}</p><p>{e(s.get("story", ""))}</p>'
                        + (f'<p class="m">訪問の目安：{e(s.get("access", ""))}</p>' if s.get("access") else "")
                        + (f'<p class="src">出典：{src}</p>' if src else "") + "</article>")
        body = (f'<p class="n"><a href="index.html">都道府県一覧</a></p><h1>{e(pref)}のUFOスポット・目撃談・観測会 {len(spots)}件</h1>'
                f'<p>{e(pref)}に伝わるUFOの目撃談、遭遇事件、観測会、都市伝説をまとめました。地図で見るときは、名前を押してください。</p>' + "".join(arts))
        open(os.path.join(ROOT, "p", f"{slug}.html"), "w", encoding="utf-8").write(page(title, desc, f"{BASE}p/{slug}.html", body))
        made.append((pref, slug, len(spots)))
    links = "".join(f'<a href="{slug}.html">{e(pref)}（{n}）</a>' for pref, slug, n in made)
    idx = page("都道府県別 UFOスポット一覧｜日本全国UFOミステリーマップ", f"全国{len(d['spots'])}件のUFO目撃談・遭遇事件・観測会を、都道府県別に一覧で紹介。",
               f"{BASE}p/index.html", f'<h1>都道府県別 UFOスポット一覧</h1><p>全国{len(d["spots"])}件を、都道府県ごとにまとめました（{e(d.get("reviewedAt", today))} 更新）。</p><nav>{links}</nav>')
    open(os.path.join(ROOT, "p", "index.html"), "w", encoding="utf-8").write(idx)
    urls = [(BASE, "1.0"), (f"{BASE}p/index.html", "0.9")] + [(f"{BASE}p/{slug}.html", "0.8") for _, slug, _ in made]
    sm = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + "".join(
        f"<url><loc>{u}</loc><lastmod>{today}</lastmod><priority>{p}</priority></url>\n" for u, p in urls) + "</urlset>\n"
    open(os.path.join(ROOT, "sitemap.xml"), "w", encoding="utf-8").write(sm)
    print(f"{len(made)} pages, {len(d['spots'])} spots")

if __name__ == "__main__":
    main()
