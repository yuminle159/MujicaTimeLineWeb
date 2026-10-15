"""Batch image renaming and its workflow-tool dialog."""
import os
import re
import uuid
import threading
import queue
from pathlib import Path
import tkinter as tk
from tkinter import ttk, filedialog, messagebox
from tkinterdnd2 import DND_FILES
from image_conversion import convert_image_files_to_webp

EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tif', '.tiff', '.avif', '.heic', '.heif'}

def natural_key(path):
    return [int(s) if s.isdigit() else s.casefold() for s in re.split(r'(\d+)', Path(path).name)]

def key(path):
    return os.path.normcase(str(Path(path).absolute()))

def make_plan(paths, prefix):
    if not prefix or prefix != prefix.strip() or re.search(r'[<>:"/\\|?*\x00-\x1f]', prefix) or prefix.endswith('.'):
        raise ValueError('请输入有效名称，不能含路径符号、首尾空格或末尾句点。')
    plan=[]
    for number, path in enumerate(paths, 1):
        path=Path(path).absolute()
        if path.suffix.lower() not in EXTENSIONS:
            raise ValueError(f'不支持的图片格式：{path.name}')
        target=path.with_name(f'{prefix}-{number:02d}{path.suffix}')
        if len(target.name)>255:raise ValueError('名称过长，请缩短名称。')
        plan.append((path,target))
    validate(plan)
    return plan

def validate(plan):
    sources={key(s) for s,_ in plan}
    targets={key(t) for _,t in plan}
    if len(sources)!=len(plan) or len(targets)!=len(plan):raise ValueError('列表存在重复文件或重复目标名称。')
    for source,target in plan:
        if source.is_symlink() or not source.is_file():raise ValueError(f'图片不存在或为链接：{source}')
        if source.parent!=target.parent:raise ValueError('仅支持在原文件夹重命名。')
        if os.path.lexists(target) and key(target) not in sources:raise ValueError(f'已有同名文件，不会覆盖：{target}')

def move(source,target):
    if os.path.lexists(target):raise FileExistsError(f'已有同名文件：{target}')
    # Windows rename also refuses a destination created between this check and rename.
    os.rename(source,target)

def execute(plan):
    validate(plan)
    active=[(s,t) for s,t in plan if str(s)!=str(t)]
    staged=[]; finished=[]
    try:
        for source,target in active:
            temp=source.with_name('.rename-'+uuid.uuid4().hex+'.tmp')
            move(source,temp);staged.append((source,temp,target))
        for source,temp,target in staged:
            move(temp,target);finished.append((source,temp,target))
    except Exception as exc:
        errors=[]
        for source,temp,target in reversed(finished):
            try:move(target,temp)
            except OSError as err:errors.append(str(err))
        for source,temp,target in reversed(staged):
            if temp.exists():
                try:move(temp,source)
                except OSError as err:errors.append(str(err))
        if errors:raise RuntimeError(f'重命名失败：{exc}\n部分文件未能恢复，请保留目录中的 .rename 临时文件：\n'+ '\n'.join(errors)) from exc
        raise
    return [(target,source) for source,target in plan]

class RenameDialog(tk.Toplevel):
    def __init__(self,parent):
        super().__init__(parent)
        self.title('图片批量重命名');self.geometry('960x600');self.minsize(760,460)
        self.configure(bg='#141414');self.paths=[];self.undo_plan=[];self.plan=[]
        self.busy=False;self.created_webp=[]
        self.protocol('WM_DELETE_WINDOW',self.close)
        tk.Label(self,text='拖入图片 → 输入名称 → 按列表顺序重命名',bg='#141414',fg='#eeeeee',font=('Microsoft YaHei',13,'bold')).pack(anchor='w',padx=20,pady=(18,8))
        tk.Label(self,text='保留原文件夹与扩展名；每次加入的图片按原文件名排序，可用上移／下移调整。',bg='#141414',fg='#aaaaaa').pack(anchor='w',padx=20)
        bar=tk.Frame(self,bg='#141414');bar.pack(fill='x',padx=20,pady=12)
        for label,command in [('添加图片',self.choose),('移除选中',self.remove),('清空',self.clear),('上移',lambda:self.shift(-1)),('下移',lambda:self.shift(1))]:
            ttk.Button(bar,text=label,command=command).pack(side='left',padx=(0,8))
        frame=tk.Frame(self);frame.pack(fill='both',expand=True,padx=20)
        self.table=ttk.Treeview(frame,columns=('old','new','folder'),show='headings',selectmode='extended')
        for column,title,width in [('old','原文件名（将图片拖到这里）',300),('new','重命名预览',300),('folder','所在文件夹',220)]:
            self.table.heading(column,text=title);self.table.column(column,width=width,minwidth=120)
        scroll=ttk.Scrollbar(frame,orient='vertical',command=self.table.yview)
        self.table.configure(yscrollcommand=scroll.set);scroll.pack(side='right',fill='y');self.table.pack(fill='both',expand=True)
        for widget in (self,self.table):
            widget.drop_target_register(DND_FILES);widget.dnd_bind('<<Drop>>',self.drop)
        self.convert_webp=tk.BooleanVar(value=True)
        tk.Checkbutton(self,text='重命名后同时转为 WebP（成功后删除原图，不支持撤销；已有同名 WebP 跳过）',
                       variable=self.convert_webp,bg='#141414',fg='#dddddd',selectcolor='#252525',
                       activebackground='#141414',activeforeground='#ffffff').pack(anchor='w',padx=20,pady=(10,0))
        controls=tk.Frame(self,bg='#141414');controls.pack(fill='x',padx=20,pady=14)
        tk.Label(controls,text='统一名称',bg='#141414',fg='#dddddd').pack(side='left')
        self.prefix=tk.StringVar();entry=ttk.Entry(controls,textvariable=self.prefix);entry.pack(side='left',fill='x',expand=True,padx=10)
        self.run_button=ttk.Button(controls,text='开始重命名',command=self.run);self.run_button.pack(side='left',padx=5)
        self.undo_button=ttk.Button(controls,text='撤销上次重命名',command=self.undo,state='disabled');self.undo_button.pack(side='left')
        self.status=tk.StringVar(value='拖入图片或点击“添加图片”。')
        tk.Label(self,textvariable=self.status,bg='#141414',fg='#bbbbbb',anchor='w',wraplength=900).pack(fill='x',padx=20,pady=(0,16))
        self.prefix.trace_add('write',lambda *_:self.refresh());self.refresh();entry.focus_set()

    def add(self,paths):
        if self.busy:return
        known={key(p) for p in self.paths};added=[];skipped=0
        for raw in paths:
            path=Path(raw).absolute()
            if path.is_file() and not path.is_symlink() and path.suffix.lower() in EXTENSIONS:
                if key(path) not in known:added.append(path);known.add(key(path))
            else:skipped+=1
        self.paths.extend(sorted(added,key=natural_key));self.refresh()
        if skipped:self.status.set(self.status.get()+f' · 跳过 {skipped} 个非图片或文件夹')

    def drop(self,event):
        self.add(self.tk.splitlist(event.data));return 'copy'

    def choose(self):
        self.add(filedialog.askopenfilenames(parent=self,title='选择需要重命名的图片',filetypes=[('图片',' '.join('*'+s for s in sorted(EXTENSIONS))),('所有文件','*.*')]))

    def refresh(self,selection=()):
        self.plan=[]
        try:
            self.plan=make_plan(self.paths,self.prefix.get())
            text=f'共 {len(self.paths)} 张 · 将在原文件夹重命名'
        except ValueError as exc:text=str(exc) if self.prefix.get() else f'共 {len(self.paths)} 张 · 请输入统一名称，例如 20240411邦tv212'
        self.table.delete(*self.table.get_children())
        for i,path in enumerate(self.paths):
            self.table.insert('', 'end',iid=str(i),values=(path.name,self.plan[i][1].name if self.plan else '—',str(path.parent)))
        self.table.selection_set([str(i) for i in selection])
        self.status.set(text);self.run_button.configure(state='normal' if self.plan and not self.busy else 'disabled')

    def remove(self):
        if self.busy:return
        selected={int(i) for i in self.table.selection()};self.paths=[p for i,p in enumerate(self.paths) if i not in selected];self.refresh()

    def clear(self):
        if self.busy:return
        self.paths=[];self.refresh()

    def shift(self,direction):
        if self.busy:return
        selected={int(i) for i in self.table.selection()}
        for i in sorted(selected,reverse=direction>0):
            other=i+direction
            if 0<=other<len(self.paths) and other not in selected:
                self.paths[i],self.paths[other]=self.paths[other],self.paths[i];selected.remove(i);selected.add(other)
        self.refresh(selected)

    def run(self):
        if self.busy:return
        do_webp=self.convert_webp.get()
        try:
            plan=make_plan(self.paths,self.prefix.get())
            undo=execute(plan)
        except Exception as exc:messagebox.showerror('重命名失败',str(exc),parent=self);return
        self.undo_plan=undo;self.paths=[target for _,target in plan];self.created_webp=[];self.refresh()
        self.undo_button.configure(state='normal');self.status.set(f'已重命名 {len(plan)} 张图片，可撤销上次操作。')
        if do_webp:
            self.busy=True;self.run_button.configure(state='disabled');self.undo_button.configure(state='disabled')
            self.status.set(f'已重命名 {len(plan)} 张图片，正在转换本批次 WebP…')
            results=queue.Queue();paths=list(self.paths)
            def work():
                try:results.put(convert_image_files_to_webp(paths,lambda _:None,remove_originals=True))
                except Exception as exc:results.put(exc)
            threading.Thread(target=work,daemon=True).start()
            self.after(100,lambda:self.finish_conversion(results,len(plan)))

    def finish_conversion(self,results,count):
        try:result=results.get_nowait()
        except queue.Empty:
            self.after(100,lambda:self.finish_conversion(results,count));return
        self.busy=False;self.refresh();self.undo_button.configure(state='normal')
        if isinstance(result,Exception):
            self.status.set('重命名已完成，WebP 转换发生错误。')
            messagebox.showerror('WebP 转换失败',str(result),parent=self);return
        self.created_webp=result['created']
        removed=set(result['removed'])
        self.paths=[p.with_suffix('.webp') if p in removed else p for p in self.paths]
        if removed:
            self.undo_plan=[];self.undo_button.configure(state='disabled')
        self.refresh()
        self.status.set(f'已重命名 {count} 张 · 生成 WebP {len(result["created"])} 张、删除原图 {len(removed)} 张、跳过 {len(result["skipped"])} 张、失败 {len(result["failed"])} 张。')
        if result['failed']:
            messagebox.showwarning('部分 WebP 转换失败','重命名已完成；转换失败的原图仍保留。\n'+ '\n'.join(f'{p.name}: {error}' for p,error in result['failed']),parent=self)

    def close(self):
        if self.busy:
            messagebox.showinfo('正在转换','请等待本批次 WebP 转换完成后再关闭。',parent=self);return
        self.destroy()

    def undo(self):
        if self.busy or not self.undo_plan:return
        try:execute(self.undo_plan)
        except Exception as exc:messagebox.showerror('撤销失败',str(exc),parent=self);return
        self.paths=[original for _,original in self.undo_plan];self.undo_plan=[];self.refresh()
        self.undo_button.configure(state='disabled');self.status.set('已恢复上次重命名前的文件名。'+('生成的 WebP 保留。' if self.created_webp else ''))
