import tempfile
import unittest
from pathlib import Path
from PIL import Image
from image_conversion import convert_image_files_to_webp
from build_gui import convert_images_to_webp


class ConversionTests(unittest.TestCase):
    def test_remove_only_successfully_converted_originals(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder)
            good=root/'good.png';conflict=root/'conflict.jpg';bad=root/'bad.png'
            Image.new('RGB',(20,10)).save(good)
            Image.new('RGB',(20,10)).save(conflict)
            (root/'conflict.webp').write_bytes(b'keep')
            bad.write_bytes(b'broken')
            result=convert_image_files_to_webp([good,conflict,bad],lambda _:None,remove_originals=True)
            self.assertEqual(result['removed'],[good])
            self.assertFalse(good.exists())
            with Image.open(root/'good.webp') as im:im.load()
            self.assertTrue(conflict.exists());self.assertTrue(bad.exists())
            self.assertEqual((root/'conflict.webp').read_bytes(),b'keep')

    def test_selected_files_only_preserves_original_and_resize(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);selected=root/'本批次-01.png';other=root/'无关.jpg'
            Image.new('RGBA',(2400,1200),(30,50,70,128)).save(selected)
            Image.new('RGB',(20,10)).save(other)
            original=selected.read_bytes()
            result=convert_image_files_to_webp([selected],lambda _:None)
            self.assertEqual(result['created'],[selected.with_suffix('.webp')])
            with Image.open(result['created'][0]) as im:
                self.assertEqual(im.size,(1920,960));self.assertIn('A',im.mode)
            self.assertEqual(selected.read_bytes(),original)
            self.assertFalse(other.with_suffix('.webp').exists())

    def test_same_output_as_folder_tool_and_no_upscale(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);a=root/'a';b=root/'b';a.mkdir();b.mkdir()
            Image.new('RGB',(100,80),'blue').save(a/'image.jpg')
            (b/'image.jpg').write_bytes((a/'image.jpg').read_bytes())
            self.assertEqual(convert_images_to_webp(str(a),lambda _:None),1)
            convert_image_files_to_webp([b/'image.jpg'],lambda _:None)
            self.assertEqual((a/'image.webp').read_bytes(),(b/'image.webp').read_bytes())
            with Image.open(b/'image.webp') as im:self.assertEqual(im.size,(100,80))

    def test_existing_unsupported_and_failure(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder)
            Image.new('RGB',(10,10)).save(root/'image.jpg')
            (root/'image.webp').write_bytes(b'keep')
            (root/'bad.png').write_bytes(b'broken')
            (root/'animation.gif').write_bytes(b'not-supported-by-original-tool')
            result=convert_image_files_to_webp([root/'image.jpg',root/'image.webp',root/'animation.gif',root/'bad.png'],lambda _:None)
            self.assertEqual(len(result['created']),0);self.assertEqual(len(result['skipped']),3)
            self.assertEqual(len(result['failed']),1)
            self.assertEqual((root/'image.webp').read_bytes(),b'keep')
            self.assertFalse(list(root.glob('.webp-*.tmp')))

if __name__=='__main__':unittest.main()
