---
name: update-ournotes
description: 更新唯鸡百科 timeline 的 organization/game 中 Ave Mujica 相关的 BanG Dream! Our Notes 活动，核对官方动态、活动与招募预告、成员及留影卡面并同步 Excel 和网页。用户说“请更新ournotes游戏”、更新 Our Notes 活动或卡面时使用。
---

# Our Notes 活动更新

在唯鸡百科项目根目录工作。源数据为 `_data/data.xlsx` 的 `timeline` 表；类别写 `organization`，标签写 `game`。任务是整理 Ave Mujica 相关活动，每期一个完整条目；不限于用户给的几个链接，也不扩展成所有乐队的游戏资讯。

## 发现和核对

- 主要来源：[OurNotesOfficial 官方动态](https://space.bilibili.com/3706946530052970/dynamic)，账号 mid `3706946530052970`。从现有记录找到更新边界，查阅之后的公告，补齐已有活动缺失的后续资料。置顶公告不能代表最新日期。
- 辅助来源：[haneoka 国际服简中](https://haneoka.org/intl/zh-CN/)，从 `/events/` 查活动，再沿关联招募、奖励卡牌链接核对。成员在 `/member-cards/<id>/`，留影在 `/support-cards/<id>/`。卡池普通出率列表里的旧卡不是本期新卡。
- 官方活动名优先；资料站可能使用短名，例如官方“月色之下流转之舞”对应站内“月下流转之舞”。通过关联招募、角色、日期共同确认，不凭名称近似直接合并。
- 日期采用实际活动开始日，公告中的“明日”要以该公告的北京时间发布时间解释。资料站无时区的服务端文本可能是 UTC；检查时间戳/页面时区，转成北京时间并与官方海报交叉核对。不要直接把 UTC 06:00 写成北京时间 06:00。
- 核实活动与招募各自结束时间，它们不一定同日。卡名、人物、稀有度、获取方式逐项核对。明确区分招募成员、招募留影、活动奖励成员、活动兑换留影。

- Ave Mujica 的舞台名与真名严格区分，以该张卡在官方公告／游戏中的称呼为准，不照搬资料站的“舞台名／真名”人物索引。舞台身份卡只写 Mortis、Amoris、Doloris、Oblivionis 等；日常身份卡保留官方真名或简称，不能一律换成舞台名。本期「过近的距离」保留“海铃＆若麦”。

## 资料读取与图片

可用 `scripts/read_source.py` 缓存公开来源，参数见 `--help`。需要 requests 和 Pillow。

- 视频普通页面的 `window.__INITIAL_STATE__` → `videoData` 包含 `title/pic/desc/pubdate/owner/bvid`；用 JSON 解码器解析，确认 `owner.mid` 是官方账号。`pic` 是招募封面来源。
- 动态详情公开接口：`https://api.bilibili.com/x/polymer/web-dynamic/v1/detail?id=<opus编号>`。先检查 `code == 0`；检查 `data.item.modules.module_author.mid`。图文图片可能在 `module_dynamic.major.draw.items[].src`，新版结构也可能为 `major.opus.pics[].url`；正文可能是 `desc.text` 或 `major.opus.summary.text`。`desc` 为 null 不代表无图片。
- 动态列表公开接口可尝试 `/x/polymer/web-dynamic/v1/feed/space?host_mid=3706946530052970`，按返回 offset 分页。接口若被限制，使用官方公开页面、公开搜索定位 opus 或视频，然后读取详情；不能宣称未读完的动态已全部检查。出现验证码不代用户解答，也不索取登录凭据。
- haneoka 卡牌详情页有实际大图链接。优先国际服简中完整卡面 `member_full(zh-Hans).png` / `snap_full(zh-Hans).png`；保留页面提供的 release 参数。不要误取 thumbnail、透明人物、单独背景、技能序列图，也不要假设不同活动的 ID 连续。
- 图片全部放项目 `images/` 根目录，使用 `活动名-01.webp` 等可读名称。文件名避开 URL 保留字符 #、? 等，例如 `A day-HalloweenSnap-01.webp`；展示标题仍保留原活动名。通常 01 活动图、02 招募视频封面，然后招募成员、招募留影、活动奖励。沿用已有编号，不覆盖已有不同内容。原比例、完整画面，转换 WebP（quality 94），不加水印、不拼装或生成卡面。
- 下载后检查文件可解码、像素尺寸，并看图确认人物、画面及活动图上的日期。保存来源 URL 与图片 caption 的对应清单到 `_reports/ournotes-<活动名>.json`，方便复核。

- 官方动态列表被限制时，可从官方小站公开搜索定位公告：`https://api.bilibili.com/x/tribee/v1/search/all?tribee_id=76&key_word=<活动关键词>&page_num=1&page_size=30&need_meta=true&type=1&order=0`。从 `data.contents[].dyn.dyn` 读取 dyn_id/title/meta.author，再用动态详情核对官方 mid；搜索列表的“几小时前”可能是最新回复时间，不能当作公告发布日期。

## 入库

一个活动按实际内容整理活动图、招募图、已有预告 video 和全部本期新卡。只有官方确实发布剧情预告时才添加；没有剧情的活动（例如 A day～#HalloweenSnap～）不查找或强凑剧情预告，也不把乐曲试玩当成剧情预告。示例有六张卡（2 招募成员 + 2 招募留影 + 1 奖励成员 + 1 兑换留影），未来按实际公告数量，不强制凑六张。

`timeline` 列名：`date,title,category,description,tag,media_type,media_src,media_caption,media_url,media_title,Group`。

- 标题示例：`BanG Dream! Our Notes「月色之下流转之舞」`。先按日期、活动名及别名查重；更新同一条，不因补发预告又创建窗体。
- date 用 `2026/11/8` 这样的开始日。description 用简洁客观介绍，写活动时间、招募时间与剧情概要；无需社交气泡作者标记。单日定位、持续时间放说明；不要为结束日额外加一个事件。
- 每个媒体占一行，所有行的 date/title/category/description/tag/Group 完全一致，否则生成器可能拆成多个窗体。通常 Group 留空。
- 图片 `media_type=image`，`media_src=images/活动名-01.webp`，caption 写清获取方式、稀有度、角色和卡名，例如 `招募成员 SSR Mortis「辉煌的步伐」`。
- 视频 `media_type=video`，`media_src=https://player.bilibili.com/player.html?bvid=<BV号>`，caption 区分招募预告与剧情预告。视频嵌入不能用普通视频网页 URL 代替。
- 保存前重新读取工作簿，备份，检查期间是否被用户改动；保留其余表、公式、样式及现有手改。如果 Excel 锁定，保留待导入资料并说明，不声称保存成功。

## 生成与验收

读项目当前生成器和体检入口，复用 `timeline_checks.check_timeline`。通过后保存 Excel，调用 `generate_all.generate_timeline(wb)`，再更新已有全局搜索索引。不要只编辑会被覆盖的 `timeline/data.js`。只做数据更新不必重建数据更新工具 exe。

核对新增活动只生成一个事件；图片数量、卡片种类与官方一致；所有图片存在、caption 完整；实际添加的视频 BV 号正确；旧数据没有丢失；体检未引入新错误。需要本地预览产物时使用项目 `build_site.py`，不自动部署。

完成后告诉用户新增/补齐了哪些活动、日期、图片与视频数量、未确认或缺失的内容。不要要求用户重复提供已可从公开来源核对的信息；无法核实的卡名或素材不要猜。
