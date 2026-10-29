---
name: update-venues
description: 更新唯鸡百科 Live Statistics 的 Venue Atlas 场馆地图与档案，核对现有及未来 Live 的场馆、名称别名、坐标、官方容量和简介，并生成与验证场馆数据。用户要求更新场馆足迹、Venue Atlas 或演出场馆履历时使用。
---

# 更新场馆足迹

适用于 MujicaTimeLineWeb 项目。先定位仓库根目录，阅读 `_data/_docs/venue-atlas.md`；场馆数据维护在 `_data/venues.json`，演出来源为 `_data/data.xlsx` 的 `lives` 表。用户不需要提供坐标、容量或简介，由你检索并补齐。

1. 查看当前工作区改动，运行 `python sync_venues.py --check`，读取 `lives` 中所有不同场馆及日期，包含已举行和未来演出。日常“更新场馆”以现有演出档案为范围；用户同时要求搜寻新增演出时，再根据官方公告更新 `lives`。不可自动改动无关工作表。
2. 为新增场馆查找官网、运营方或地方政府资料，补充中文简短介绍、地区、近似定位、容量口径和来源链接。为场馆补实景图片，优先使用可核验许可的 Wikimedia Commons 图片或场馆官方图片，保存本地 WebP、作者、来源及许可信息；检查图片确属该场馆，不能用 Logo、同园区其他场馆或其他 Zepp 分馆充数。所在设施概览须在图注说明，未知 Studio 不猜图。已有场馆出现新冠名时核实并补别名；对用户要求重新核验的场馆更新资料和 `checked`。不得凭印象填写容量。暂时查不到官方容量就留 null；户外／复合音乐节不使用累计入场人次作为容量。
3. 维护稳定 ID。武蔵野の森総合スポーツプラザ与京王アリーナ TOKYO 已归并；同城不同 Zepp、同一建筑不同厅保持独立。不要把未明确舞台的复合场地随意定位到某个舞台。Studio 或未公布地点保留 unknown。海外使用 overseas，只有日本场馆需要地图坐标，不新增海外地图。
4. 不存储手工维护的场次或“过去／未来”字段；浏览器依据日本日期和现有演出类型筛选自动汇总；当天计入未来，没有单独的今日分类。不得根据 description 中的“非全场”“Opening Act”等字样排除演出。
5. 运行 `python sync_venues.py` 生成 `js/venue-atlas-data.js`，再运行 `python sync_venues.py --check`。若修改了 Excel 演出数据，先检查 `generate_all.py --help`，使用项目歌曲／演出既有生成流程同步 Live 数据；仅修改场馆档案无需重新生成其他模块。
6. 必要时运行 `python -m unittest discover -s tests -p test_venue_catalogue.py`。检查日本、海外、未来、同场馆多次演出以及既有类型筛选；运行 `python build_site.py` 更新本地预览。不要自行部署、提交或推送。
7. 汇报新增／归并场馆、官方容量来源和仍未确认的项，链接本地预览。普通场馆数据维护无需重新打包 EXE。

仅在用户要求更改地图交互时编辑 `js/venue-atlas.js`、`css/venue-atlas.css`、`live/page.js`。地图几何数据通常无需更新，保留四岛示意和拖动／缩放边界。视觉复用 Live Statistics 的 --stats-* 配色和字体。

地图只显示北海道、本州、四国、九州四个主要岛屿的抽象轮廓，主图与缩略图共用 `_data/venue-map-outline.json` 生成的数据。不得恢复县界、周边离岛（含冲绳）或争议岛屿，也不直接导入完整地理地图；这只是场馆示意范围。需重建时运行 `python sync_venues.py --build-map`，并验证鼠标、键盘、缩放、区域切换及场馆定位都不会越过视窗边界；范围外场馆继续保留列表与详情。不要添加抒情式宣传文案；默认提示沿用用户指定的“欢迎来到，Ave Mujica 的世界。”。
