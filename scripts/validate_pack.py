#!/usr/bin/env python3
"""Validate the supplied specification/configuration pack, not a running Kazi app."""
import json,re,sys,copy,hashlib
from pathlib import Path
from zoneinfo import ZoneInfo
ROOT=Path(__file__).resolve().parents[1]
errors=[]
def check(ok,message):
 if not ok:errors.append(message)
def load(p):
 return json.loads((ROOT/p).read_text(encoding='utf-8'))
def luminance(c):
 v=[int(c[i:i+2],16)/255 for i in (1,3,5)]
 v=[x/12.92 if x<=.04045 else ((x+.055)/1.055)**2.4 for x in v]
 return sum(a*b for a,b in zip(v,(.2126,.7152,.0722)))
def contrast(a,b):
 x,y=sorted((luminance(a),luminance(b)))
 return (y+.05)/(x+.05)
reg=load('config/registry.json');schema=load('config/theme.schema.json')
required=set(schema['properties']['colors']['required']);themes={}
for tid,rel in reg['themes'].items():
 t=load('config/'+rel);themes[tid]=t
 check(t['schemaVersion']==1,'Unsupported schema '+tid)
 check(t['themeId']==tid,'Theme identity mismatch '+tid)
 check(tid.endswith('@'+t['themeVersion']),'Theme version mismatch '+tid)
 check(set(t['colors'])==required,'Semantic token mismatch '+tid)
 for key,value in t['colors'].items():check(bool(re.fullmatch(r'#[0-9A-Fa-f]{6}',value)),'Invalid color '+tid+'/'+key)
 if set(t['colors'])!=required:continue
 c=t['colors']
 pairs=[('text','background',4.5),('text','surface',4.5),('textMuted','background',4.5),('textMuted','surface',4.5),('onPrimary','primary',4.5),('onPrimary','primaryHover',4.5),('onAccent','accent',4.5),('onSidebar','sidebar',4.5),('infoText','infoSurface',4.5),('successText','successSurface',4.5),('warningText','warningSurface',4.5),('dangerText','dangerSurface',4.5),('controlBorder','surface',3),('controlBorder','background',3),('focusRing','surface',3),('focusRing','background',3),('focusRingOnDark','sidebar',3)]
 for fg,bg,minimum in pairs:
  ratio=contrast(c[fg],c[bg]);check(ratio>=minimum,f'{tid}: {fg}/{bg} contrast {ratio:.2f} < {minimum}')
 print('Theme',tid,':',len(pairs),'declared contrast pairs checked')
for cid,rel in reg['countryConfigs'].items():
 co=load('config/'+rel)
 check(cid==co['countryCode']+'@'+co['configVersion'],'Country identity mismatch')
 check(co['defaultThemeId'] in themes,'Unknown default theme')
 check(co['fallbackThemeId'] in themes,'Unknown fallback theme')
 check(co['defaultLocale'] in co['supportedLocales'],'Default locale not supported')
 try:ZoneInfo(co['timezone'])
 except Exception:errors.append('Invalid timezone')
 check(not co['productionEnabled'],'Pack must not claim production launch enabled')
 check(all(not a['enabledForProduction'] for a in co['serviceAreas']),'Sample service areas must remain production disabled')
 if co['countryCode']=='GA':
  check(co['currency']['code']=='XAF' and co['currency']['minorUnitExponent']==0,'GA currency mismatch')
  check(co['phone']['callingPrefix']=='+241' and co['timezone']=='Africa/Libreville','GA region mismatch')
  check(co['defaultLocale']=='fr-GA','GA locale mismatch')
for code,cv in reg['activeCountryConfig'].items():check(cv in reg['countryConfigs'] and cv.startswith(code+'@'),'Unknown country activation')
# Config-level separation proof only: this is NOT an implementation/e2e test.
f=load('examples/prototype-fixtures.json');before=json.dumps(f,sort_keys=True)
for tid in themes:
 preview={'domain':copy.deepcopy(f),'presentation':{'themeId':tid}}
 check(json.dumps(preview['domain'],sort_keys=True)==before,'Theme preview mutated fixture')
for name in ['START_HERE','AGENTS','PRD','DESIGN','THEMING_AND_COUNTRIES','WORKFLOWS','ARCHITECTURE','DATABASE','API','IMPLEMENTATION_PLAN','QA_AND_RELEASE','VERSIONING','OPERATIONS_AND_SECURITY','DECISIONS','AGENT_WORKFLOWS','SOURCES']:
 check((ROOT/(name+'.md')).is_file(),'Missing required document '+name)
for p in ROOT.glob('*.md'):
 content=p.read_text()
 for label,target in re.findall(r'\[([^\]]+)\]\(([^)]+)\)',content):
  if '://' not in target and not target.startswith('#'):check((p.parent/target.split('#')[0]).exists(),f'Broken link {p.name}: {target}')
check(not reg['productionLaunchAuthorized'],'Registry must not imply launch authorization')
if errors:
 print('\nFAILED:');print('\n'.join('- '+e for e in errors));sys.exit(1)
print('PASS: themes, declared color pairs, GA config, fixture separation and document links.')
print('Not tested here: running UI, full accessibility, identity, database, APIs, providers or production readiness.')
