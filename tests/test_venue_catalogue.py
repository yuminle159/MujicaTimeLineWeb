import json
import unittest
from pathlib import Path
from sync_venues import normalize, validate, omit_disputed_polygon


class VenueCatalogueTests(unittest.TestCase):
    def setUp(self):
        self.data = json.loads((Path(__file__).resolve().parents[1] / '_data/venues.json').read_text(encoding='utf-8'))

    def test_historical_and_current_name_resolve_to_one_venue(self):
        venue = next(v for v in self.data['venues'] if v['id'] == 'keio')
        self.assertIn('武蔵野の森総合スポーツプラザ', venue['aliases'])
        self.assertEqual(validate(self.data, ['京王アリーナ TOKYO', '武蔵野の森総合スポーツプラザ']), [])

    def test_aliases_and_capacity_sources_are_valid(self):
        self.assertEqual(validate(self.data, []), [])
        self.assertEqual(normalize('Zepp Haneda（TOKYO）'), normalize('Zepp Haneda (TOKYO)'))

    def test_missing_venues_are_reported_not_assigned_fake_coordinates(self):
        self.assertEqual(validate(self.data, ['未公布的新场馆']), ['未公布的新场馆'])

    def test_located_venues_have_local_photos_and_attribution(self):
        root = Path(__file__).resolve().parents[1]
        for venue in self.data['venues']:
            if venue['region'] == 'unknown':
                continue
            for field in ('photo', 'photo_author', 'photo_source', 'photo_license', 'photo_license_url'):
                self.assertTrue(venue.get(field), (venue['id'], field))
            self.assertTrue((root / 'live' / venue['photo']).is_file(), venue['id'])

    def test_conflicting_alias_is_rejected(self):
        self.data['venues'][1]['aliases'].append(self.data['venues'][0]['name'])
        with self.assertRaises(AssertionError):
            validate(self.data, [])

    def test_schematic_contains_only_four_single_island_outlines(self):
        root = Path(__file__).resolve().parents[1]
        source = json.loads((root/'_data/venue-map-outline.json').read_text(encoding='utf-8'))
        script = (root/'js/venue-atlas-map.js').read_text(encoding='utf-8')
        shapes = json.loads(script.split(' = ', 1)[1].rstrip(';\n'))
        self.assertEqual({s['name'] for s in shapes}, {'北海道', '本州', '四国', '九州'})
        self.assertEqual(len(shapes), 4)
        for island, shape in zip(source['islands'], shapes):
            self.assertEqual(island['name'], shape['name'])
            self.assertEqual(island['ring'][0], island['ring'][-1])
            self.assertEqual(shape['path'].count('M'), 1)
            self.assertEqual(shape['path'].count('Z'), 1)
            for lon, lat in island['ring']:
                self.assertTrue(129.4 < lon < 146 and 30.9 < lat < 45.6)
        self.assertLess(sum(len(s['ring']) for s in source['islands']), 500)

    def test_schematic_contains_only_four_single_island_outlines(self):
        root = Path(__file__).resolve().parents[1]
        source = json.loads((root/'_data/venue-map-outline.json').read_text(encoding='utf-8'))
        script = (root/'js/venue-atlas-map.js').read_text(encoding='utf-8')
        shapes = json.loads(script.split(' = ', 1)[1].rstrip(';\n'))
        self.assertEqual({s['name'] for s in shapes}, {'北海道', '本州', '四国', '九州'})
        self.assertEqual(len(shapes), 4)
        for island, shape in zip(source['islands'], shapes):
            self.assertEqual(island['name'], shape['name'])
            self.assertEqual(island['ring'][0], island['ring'][-1])
            self.assertEqual(shape['path'].count('M'), 1)
            self.assertEqual(shape['path'].count('Z'), 1)
            for lon, lat in island['ring']:
                self.assertTrue(129.4 < lon < 146 and 30.9 < lat < 45.6)
        self.assertLess(sum(len(s['ring']) for s in source['islands']), 500)

    def test_capacity_without_source_is_rejected(self):
        self.data['venues'][1]['capacity_source'] = ''
        with self.assertRaises(AssertionError):
            validate(self.data, [])

    def test_disputed_islands_omitted_but_mainland_and_okinawa_retained(self):
        def island(w,s,e,n):
            return [[[w,s],[e,s],[e,n],[w,n],[w,s]]]
        for pref,box in [(1,(146.86,44.42,148.9,45.56)),(1,(145.4,43.658,146.58,44.52)),
                         (1,(146.58,43.7,146.93,43.9)),(1,(145.86,43.41,145.96,43.47)),
                         (47,(123.45,25.73,123.50,25.76)),(32,(131.86,37.23,131.88,37.25))]:
            self.assertTrue(omit_disputed_polygon(pref,island(*box)))
        for pref,box in [(1,(139.76,41.39,145.82,45.53)),(47,(127.6,26,128.4,26.9)),
                         (47,(123,24.3,123.1,24.5)),(32,(132,35,133,36))]:
            self.assertFalse(omit_disputed_polygon(pref,island(*box)))


if __name__ == '__main__':
    unittest.main()
