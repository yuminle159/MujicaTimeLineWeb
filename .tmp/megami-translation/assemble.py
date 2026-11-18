from pathlib import Path
import re

folder = Path(__file__).parent
target = next(Path('_data/mc').glob('megami26*12*.md'))
baseline = (folder / 'baseline.md').read_bytes()
groups = {
    1: ['三角初华', '初华', 'Doloris', '李子亲', '佐佐木李子', '佐佐木'],
    2: ['若叶睦', '小睦', '睦', 'Mortis', '渡濑结月', '渡濑'],
    3: ['八幡海铃', '海铃', 'Timoris', '冈田梦以', '冈田', '梅香'],
    4: ['祐天寺若麦', '若麦', 'Amoris', '米泽茜', '米泽', '茜'],
    5: ['丰川祥子', '祥子', '小祥', 'Oblivionis', '高尾奏音', '高尾'],
    6: ["BanG Dream! It's MyGO!!!!!", 'MyGO!!!!!'],
    7: ['BanG Dream! Ave Mujica', 'Ave Mujica', 'Mujica'],
}
names = {name: num for num, names in groups.items() for name in names}
pattern = re.compile('|'.join(re.escape(n) for n in sorted(names, key=len, reverse=True)))
songs = ['神の名を', 'BADDY BADDY', 'A Song Of Romance Pt. 2', 'A Song Of Romance pt.2',
         'ASong Of Romance Pt.2', 'ASong Of Romance', 'A Song Of Romance', 'Pt.2',
         'Imprisoned XII', 'Georgette Me, Georgette You', '顔', '天球のMujica']
song_pattern = re.compile('「(' + '|'.join(re.escape(n) for n in sorted(songs, key=len, reverse=True)) + ')」')

def color(text):
    def mark(m):
        if m.group() == '睦' and m.start() and text[m.start()-1] == '和':
            return m.group()
        return f'[c{names[m.group()]}]{m.group()}[/c{names[m.group()]}]'
    return pattern.sub(mark, text)

translations = []
for i in range(1, 6):
    draft = (folder / f'{i}.txt').read_text(encoding='utf-8')
    output = []
    seen_question = False
    for line in draft.splitlines():
        if not line.strip():
            continue
        question = line.startswith('——') or line.startswith('听说 TV动画')
        if question:
            if seen_question:
                output.append('[br]')
            output.append('**' + line + '**')
            seen_question = True
            continue
        protected = []
        def song(m):
            protected.append('「**' + m.group(1) + '**」')
            return f'@@SONG{len(protected)-1}@@'
        line = song_pattern.sub(song, line)
        speaker = re.match(r'^(冈田|米泽|众人)　', line)
        if speaker:
            label = speaker.group(1)
            line = '**' + color(label) + '**　' + color(line[speaker.end():])
        else:
            line = color(line)
        for n, value in enumerate(protected):
            line = line.replace(f'@@SONG{n}@@', value)
        output.append(line)
    translations.append('\n\n'.join(output).encode('utf-8'))

placeholder = '（中文）'.encode('utf-8')
assert baseline.count(placeholder) == len(translations)
parts = baseline.split(placeholder)
result = parts[0]
newline = b'\r\n' if b'\r\n' in baseline else b'\n'
for translated, part in zip(translations, parts[1:]):
    result += translated.replace(b'\n', newline) + part

originals = lambda data: re.findall(rb'\[original\].*?\[/original\]', data, re.S)
assert originals(result) == originals(baseline)
# Removing the additions must recover every byte outside the placeholders too.
restored = result
for translated in translations:
    restored = restored.replace(translated.replace(b'\n', newline), placeholder, 1)
assert restored == baseline
assert placeholder not in result
target.write_bytes(result)
print('Translated 5 blocks; all original blocks and protected content unchanged.')
