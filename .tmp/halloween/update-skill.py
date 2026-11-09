from pathlib import Path
p=Path('C:/Users/yumin/.codex/skills/update-ournotes/SKILL.md');s=p.read_text(encoding='utf-8')
s=s.replace('一个活动通常包含活动图、招募图、招募预告 video、剧情预告 video、全部本期新卡。','一个活动按实际内容整理活动图、招募图、已有预告 video 和全部本期新卡。只有官方确实发布剧情预告时才添加；没有剧情的活动（例如 A day～#HalloweenSnap～）不查找或强凑剧情预告，也不把乐曲试玩当成剧情预告。')
s=s.replace('两个视频 BV 号正确','实际添加的视频 BV 号正确')
s=s.replace('图片全部放项目 `images/` 根目录，使用 `活动名-01.webp` 等可读名称。','图片全部放项目 `images/` 根目录，使用 `活动名-01.webp` 等可读名称。文件名避开 URL 保留字符 #、? 等，例如 `A day-HalloweenSnap-01.webp`；展示标题仍保留原活动名。')
s=s.replace('## 入库','- 官方动态列表被限制时，可从官方小站公开搜索定位公告：`https://api.bilibili.com/x/tribee/v1/search/all?tribee_id=76&key_word=<活动关键词>&page_num=1&page_size=30&need_meta=true&type=1&order=0`。从 `data.contents[].dyn.dyn` 读取 dyn_id/title/meta.author，再用动态详情核对官方 mid；搜索列表的“几小时前”可能是最新回复时间，不能当作公告发布日期。\n\n## 入库')
Path('.tmp/update-ournotes/SKILL.md').write_text(s,encoding='utf-8')
