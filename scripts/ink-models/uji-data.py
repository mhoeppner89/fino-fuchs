"""Parse UJI native pen strokes with writer-disjoint train/validation/audit."""
import json
from pathlib import Path
import zipfile
import urllib.request
import numpy as np

root=Path('/tmp/fino-ink-v3');root.mkdir(parents=True,exist_ok=True)
if not (root/'uji.zip').exists():
    urllib.request.urlretrieve('https://archive.ics.uci.edu/static/public/177/uji+pen+characters+version+2.zip',root/'uji.zip')
text=zipfile.ZipFile(root/'uji.zip').read('ujipenchars2.txt').decode('utf8')
lines=[line.strip() for line in text.splitlines() if line.strip() and not line.lstrip().startswith('//')]
rows=[];i=0
while i<len(lines):
    _,label,session=lines[i].split();i+=1
    count=int(lines[i].split()[1]);i+=1;strokes=[]
    for _ in range(count):
        tokens=lines[i].split();i+=1;coords=list(map(int,tokens[3:]));strokes.append([coords[j:j+2] for j in range(0,len(coords),2)])
    writer=session.rsplit('-',1)[0]
    rows.append({'source':'UJI Pen Characters v2','id':session+'-'+label,'writer':writer,'label':label,'strokes':strokes})
writers=sorted({r['writer'] for r in rows if r['writer'].startswith('trn_')})
rng=np.random.default_rng(27102026);rng.shuffle(writers);training=set(writers[:30]);validation=set(writers[30:])
assert len(training)==30 and len(validation)==10
for split in ['train','validation','audit']:
    chosen=[r for r in rows if (r['writer'] in training if split=='train' else r['writer'] in validation if split=='validation' else r['writer'].startswith('tst_'))]
    output=[]
    for row in chosen:
        label=row['label'];mode='numbers' if label in '0123456789' and len(label)==1 else 'letters' if label in 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' and len(label)==1 else None
        if mode is None:continue
        value=int(label) if mode=='numbers' and label in '1234' else ord(label)-64 if mode=='letters' and label in 'ABCD' else None
        output.append({**row,'mode':mode,'value':value})
    (root/('uji-'+split+'.json')).write_text(json.dumps(output,separators=(',',':')))
    print(split,len(output),'writers',len({r['writer'] for r in output}),flush=True)
