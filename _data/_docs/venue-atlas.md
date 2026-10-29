# Venue Atlas 场馆足迹

Live Statistics 的第五个页签。复用现有 ALL / ONE MAN / FES / BANG DREAM! 筛选。场馆履历直接关联 `live/data.js`，不另存场次、日期、演出名或未来状态。

## 数据与更新

- `_data/data.xlsx` 的 `lives` 表是演出来源；普通数据生成流程更新 `live/data.js` 后，地图自动重新汇总履历。
- `_data/venues.json` 是场馆档案来源；`js/venue-atlas-data.js` 是生成文件。修改档案后运行 `python sync_venues.py`。
- `python sync_venues.py --check` 校验表中每个场馆的覆盖情况、ID、别名冲突、地理位置及容量来源，不修改 Excel。
- 日期按照日本时间，在浏览器中分为已举行（日期早于今天）、未来（当天及以后）和日期待定。每日刷新沿用 Live 页原有机制。此状态根据档案日期计算；取消或延期需先更正演出档案。
- 顶部已举行／未来场次数按全局演出类型筛选统计；日本场馆与都道府县数还随时间筛选变化。海外和未定位记录不计入日本场馆数。

## 场馆字段

每条记录含 `id`、`name`、`aliases`、`region`（`jp` / `overseas` / `unknown`）、`area`、`lon`、`lat`、`kind`、`description`、`capacity`、`capacity_source`、`source`、`checked`。

`id` 稳定不随冠名变化。名称匹配使用 NFKC、忽略空白及大小写。新旧冠名可归入 `aliases`，不同厅、不同 Zepp 分馆不可合并。演出履历显示档案中的历史场馆名。日本场馆经纬度为附近定位点，不作为入口导航；海外不绘制地图。

容量是场馆官方规格，不是单场上座人数。保留站席／坐席／最大容量等口径，来源链接必须支持数字；场馆官网、运营方或地方政府资料优先。未确认时使用 null，户外场地显示“依活动配置”。复合音乐节会场暂按整个区域记录，不能未经核实指定某个舞台。Studio 保留未定位履历。

## 地图与实现

地图数据：国土地理院「地球地図日本」，经 [dataofjapan/land](https://github.com/dataofjapan/land) 转换，合并县界后，仅保留北海道、本州、四国、九州四个主要岛屿并进一步简化为示意 SVG 轮廓。页面保留出典和加工说明。原始数据及许可说明见 [上游 README](https://github.com/dataofjapan/land/blob/master/README.md) 与 [国土地理院](https://www.gsi.go.jp/kankyochiri/gm_jpn.html)，不将日本地图数据误标为 Public Domain。

已生成的 `js/venue-atlas-map.js` 直接纳入发布目录。示意轮廓源文件是 `_data/venue-map-outline.json`，运行 `python sync_venues.py --build-map` 可重新生成。`--map-source` 只接受同格式的四岛轮廓 JSON，不再接入完整 GeoJSON；不要在场馆日常更新中恢复县界、精细海岸线或其他岛屿。

交互在 `js/venue-atlas.js`，样式在 `css/venue-atlas.css`。默认首都圈，支持四岛概览、区域切换、有边界的拖动、按钮和键盘缩放、重叠点聚合、场馆搜索、来源链接和现有演出详情跳转。海外场馆独立列出。

全部新增浏览器资源位于原有发布白名单的 `js/`、`css/` 中；不用修改数据更新 EXE，也不需要地图 API key。构建 `python build_site.py` 会同步资源到 `dist/`。

视觉沿用 Live Statistics 的 `--stats-*` 配色及字体变量，不单独使用暖金色主题。当天演出计入未来，不提供今日筛选。

页面直接从场馆／演出统计开始，时间筛选在同一行右侧，窄屏自动换行。桌面右侧场馆介绍有独立滚动区，高度随统计页可用空间调整。点击履历中的演出名，通过 `OverlayManager` 在统计页上方打开 Live 详情；关闭详情后保留场馆选择、地图视野及滚动位置。

## 图片与地图显示范围

已定位场馆配本地 `images/venues/<id>.webp` 图片。`photo`、`photo_caption`、`photo_author`、`photo_source`、`photo_license`、`photo_license_url`、`photo_original` 保存图注、署名、来源和许可。图片经缩放与 WebP 转换；Commons 图片遵循记录的许可，虹馆图片来自场馆官网并保留出处。设施概览或非演出照片须用图注明确，不将其他活动照片描述为乐队现场。Studio 未公布地点，不配猜测图片。

按用户要求，生成地图前用 `omit_disputed_polygon` 排除南千岛群岛四岛区域（国后、择捉、色丹及齿舞群岛）、钓鱼岛／尖阁诸岛、独岛／竹岛轮廓。这是本场馆地图的显示范围选择，不绘制替代归属或边界。主图与缩略图共同使用过滤后的 `js/venue-atlas-map.js`。当前版本进一步收窄为四岛示意：其他岛屿（包括冲绳本岛及其他非争议离岛）也不绘制。这是演出地图的展示范围，不是行政或领土全图。所有交互入口统一限制视窗边界，范围外场馆保留列表和详情，不带动地图移出范围。旧版 `omit_disputed_polygon` 保留用于原始数据过滤校验；不得用原始全图覆盖当前示意数据。
