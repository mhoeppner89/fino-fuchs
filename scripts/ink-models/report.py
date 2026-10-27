"""Write the comparison report from frozen audit predictions, not training scores."""
import json
from pathlib import Path
import hashlib
import numpy as np

root = Path('/tmp/fino-ink-data')
rows = json.loads((root/'benchmark-final-scores.json').read_text())
metadata = json.loads(Path('assets/ink-models/models.json').read_text())


def raw_prediction(row):
    score, runner_up = row['scores']
    policy = metadata['policies'][row['mode']]
    labels = list('1234') if row['mode'] == 'numbers' else list('ABCD') if row['mode'] == 'letters' else ['circle','triangle','square','star']
    if score['label'] not in labels or score['score'] < policy['confidence'] or score['score']-runner_up['score'] < policy['margin']:
        return None
    return labels.index(score['label'])+1


def metrics(items, predictions):
    positive = [i for i,r in enumerate(items) if r['value']]
    negative = [i for i,r in enumerate(items) if not r['value']]
    correct = sum(predictions[i] == items[i]['value'] for i in positive)
    rejected = sum(predictions[i] is None for i in negative)
    return {'validSamples':len(positive), 'otherSamples':len(negative), 'correctValid':correct,
            'wrongValidClass':sum(predictions[i] is not None and predictions[i] != items[i]['value'] for i in positive),
            'rejectedOther':rejected, 'recall':correct/len(positive), 'specificity':rejected/len(negative),
            'balancedAccuracy':(correct/len(positive)+rejected/len(negative))/2}


report = {'weightsSha256':metadata['weightsSha256'], 'auditSamples':len(rows), 'data':{}, 'candidates':{}, 'training':{},
          'notes': [
              'All audit examples are excluded from training and from the earlier exploratory comparison.',
              'EMNIST audit vectors are reconstructed from held-out raster images by skeletonization; actual pen order is unavailable.',
              'Quick Draw audit uses native vectors, prompted labels and the source recognized=true flag; labels are not expert handwriting-quality ratings.',
              'DoodleNet pretrained training IDs are unavailable: its overlap with public Quick Draw cannot be ruled out.',
              'These results measure public-data recognition, not accuracy on children aged 5–8.',
          ]}
for mode in ['numbers','letters','symbols']:
    items = [r for r in rows if r['mode'] == mode]
    report['candidates'][mode] = {
        'previousMSE':metrics(items,[r['old'] for r in items]),
        'publicDataCNN':metrics(items,[raw_prediction(r) for r in items]),
        'hybrid':metrics(items,[r['cnn'] for r in items]),
    }
    report['data'][mode] = {'source':items[0]['source'], 'idsSha256':hashlib.sha256('\n'.join(str(r['id']) for r in items).encode()).hexdigest(),
                            'medianHybridMilliseconds':float(np.median([r['hybridMs'] for r in items]))}
    report['training'][mode] = json.loads((root/(mode+'-metrics.json')).read_text())
path = root/'doodlenet-final.json'
if path.exists():
    predictions = json.loads(path.read_text())
    items = [r for r in rows if r['mode']=='symbols']
    report['candidates']['symbols']['pretrainedDoodleNet'] = metrics(items,[predictions[str(r['id'])] for r in items])
challenges = json.loads((root/'challenge-scores.json').read_text())
report['handAuthoredRegressions'] = {'samples':len(challenges),
    'previousMSE':sum(r['old']==r['value'] for r in challenges),
    'publicDataCNN':sum(raw_prediction(r)==r['value'] for r in challenges),
    'hybrid':sum(r['cnn']==r['value'] for r in challenges)}
out = Path('scripts/ink-models/benchmark-report.json')
out.write_text(json.dumps(report,indent=2)+'\n')
for mode, results in report['candidates'].items():
    for name, result in results.items():
        print(mode, name, 'valid',round(result['recall']*100,1), 'other rejected',round(result['specificity']*100,1),'balanced',round(result['balancedAccuracy']*100,1))
