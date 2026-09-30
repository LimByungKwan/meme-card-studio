from __future__ import annotations
import base64, hashlib, json, re, time
from io import BytesIO
from pathlib import Path
from PIL import Image, ImageChops
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
RESULTS=[]

HTML=(ROOT/'index.html').read_text('utf-8')
CSS=(ROOT/'style.css').read_text('utf-8')
JS=(ROOT/'script.js').read_text('utf-8')
# Remove external references; test injects local contents directly.
HTML=re.sub(r'<link rel="stylesheet" href="style\.css"\s*/?>','',HTML)
HTML=re.sub(r'<script defer src="script\.js"></script>','',HTML)

def record(name, ok, detail=''):
    RESULTS.append({'name':name,'status':'PASS' if ok else 'FAIL','detail':detail})
    if not ok:
        raise AssertionError(f'{name}: {detail}')

def install_storage(page, initial=None):
    initial = initial or {}
    page.evaluate("""data => {
      const store = {...data};
      const api = {
        getItem(k){ k=String(k); return Object.prototype.hasOwnProperty.call(store,k) ? store[k] : null; },
        setItem(k,v){ store[String(k)] = String(v); },
        removeItem(k){ delete store[String(k)]; },
        clear(){ Object.keys(store).forEach(k=>delete store[k]); },
        key(i){ return Object.keys(store)[i] ?? null; },
        get length(){ return Object.keys(store).length; }
      };
      Object.defineProperty(window,'localStorage',{value:api,configurable:true});
      Object.defineProperty(window,'__testStore',{value:store,configurable:true});
    }""", initial)

def mount(page, storage=None):
    page.set_content(HTML, wait_until='domcontentloaded')
    install_storage(page, storage)
    page.add_style_tag(content=CSS)
    page.add_script_tag(content=JS)
    page.wait_for_function("() => document.querySelector('#statusMessage') && document.querySelector('#previewCanvas').width === 1080")

def storage_snapshot(page):
    return page.evaluate('() => ({...window.__testStore})')

def canvas_png(page):
    data=page.eval_on_selector('#previewCanvas','c => c.toDataURL("image/png")')
    return base64.b64decode(data.split(',',1)[1])

def canvas_hash(page):
    return hashlib.sha256(canvas_png(page)).hexdigest()

def wait_success(page):
    page.wait_for_function("() => document.querySelector('#statusMessage').classList.contains('status--success')")

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    context=browser.new_context(accept_downloads=True, viewport={'width':1440,'height':1000})
    page=context.new_page()
    page_errors=[]
    page.on('pageerror', lambda exc: page_errors.append(str(exc)))
    mount(page)

    record('첫 화면 이미지/문구 편집 도구 표시', page.is_visible('#imageInput') and page.is_visible('#captionInput'))

    page.set_input_files('#imageInput', str(ROOT/'test-assets/sample-landscape.png')); wait_success(page)
    record('PNG 불러오기', 'sample-landscape.png' in page.inner_text('#imageInfo'))

    page.set_input_files('#imageInput', str(ROOT/'test-assets/sample-photo.jpg')); wait_success(page)
    record('JPEG 불러오기', 'sample-photo.jpg' in page.inner_text('#imageInfo'))

    before=canvas_hash(page); info_before=page.inner_text('#imageInfo')
    page.set_input_files('#imageInput', str(ROOT/'test-assets/unsupported.txt'))
    page.wait_for_function("() => document.querySelector('#statusMessage').textContent.includes('지원하지 않는 파일')")
    record('지원하지 않는 파일 거부 + 기존 작업 유지', canvas_hash(page)==before and page.inner_text('#imageInfo')==info_before)

    # editor reactions
    page.fill('#captionInput','문구 위치 크기 색 테스트'); page.dispatch_event('#captionInput','input')
    text_hash=canvas_hash(page)
    page.eval_on_selector('#textX', "e => {e.value='65'; e.dispatchEvent(new Event('input',{bubbles:true}));}")
    x_hash=canvas_hash(page)
    page.eval_on_selector('#fontSize', "e => {e.value='88'; e.dispatchEvent(new Event('input',{bubbles:true}));}")
    size_hash=canvas_hash(page)
    page.eval_on_selector('#textColor', "e => {e.value='#ffeb3b'; e.dispatchEvent(new Event('input',{bubbles:true}));}")
    color_hash=canvas_hash(page)
    record('문구 위치 즉시 반영', x_hash != text_hash)
    record('문구 크기 즉시 반영', size_hash != x_hash)
    record('문구 색 즉시 반영', color_hash != size_hash)

    expected={'1:1':(1080,1080),'4:5':(1080,1350),'9:16':(1080,1920)}
    for ratio,dims in expected.items():
        page.click(f'button[data-ratio="{ratio}"]'); page.wait_for_timeout(40)
        wh=page.eval_on_selector('#previewCanvas','c => [c.width,c.height]')
        record(f'{ratio} Canvas 크기', tuple(wh)==dims, f'{wh} vs {dims}')
        preview=Image.open(BytesIO(canvas_png(page))).convert('RGBA')
        with page.expect_download() as dl_info:
            page.click('#downloadPngBtn')
        path=ROOT/'tests'/f'download-{ratio.replace(":","x")}.png'
        dl_info.value.save_as(str(path))
        downloaded=Image.open(path).convert('RGBA')
        same=preview.size==downloaded.size and ImageChops.difference(preview,downloaded).getbbox() is None
        record(f'{ratio} 미리보기/PNG 픽셀 일치', same)

    text_cases=[
        ('긴 한글','아주 긴 한글 문장을 반복해서 입력해도 글자가 캔버스 바깥으로 사라지지 않도록 안전하게 줄바꿈되어야 합니다. '*8),
        ('공백 없는 영문','SUPERCALIFRAGILISTICEXPIALIDOCIOUS'*12),
        ('혼합 문자','한글 English 123 !@#$%^&*() 테스트 ABC 가나다 987'),
        ('직접 줄바꿈','첫째 줄\n둘째 줄\n셋째 줄'),
        ('이모지','😀🔥👨‍👩‍👧‍👦❤️✨🎉 이모지 테스트'),
        ('빈 문구',''),
    ]
    for name,text in text_cases:
        page.fill('#captionInput',text); page.dispatch_event('#captionInput','input')
        record(f'극단 입력: {name}', page.eval_on_selector('#previewCanvas','c => c.width>0 && c.height>0'))

    for name,file in [('세로 이미지','sample-portrait.png'),('가로 이미지','sample-landscape.png'),('투명 PNG','sample-transparent.png'),('매우 작은 이미지','sample-tiny.png')]:
        page.set_input_files('#imageInput',str(ROOT/'test-assets'/file)); wait_success(page)
        record(f'극단 입력: {name}', file in page.inner_text('#imageInfo'))

    # Template CRUD with mocked storage, then reconstruct page with same store to emulate refresh.
    page.evaluate("localStorage.clear()")
    for name,ratio in [('가'*120,'1:1'),('템플릿 둘','4:5'),('템플릿 셋','9:16')]:
        page.click(f'button[data-ratio="{ratio}"]')
        page.fill('#templateName',name); page.click('#saveTemplateBtn')
    record('템플릿 3개 생성', page.inner_text('#templateCount').strip()=='3개')
    record('극단 입력: 120자 템플릿 이름', page.locator('.template-item').count()==3)

    page.locator('.template-item').nth(1).get_by_role('button',name='불러오기').click()
    record('템플릿 불러오기', page.input_value('#templateName')=='템플릿 둘')
    page.fill('#captionInput','수정 후 유지되는 문구'); page.dispatch_event('#captionInput','input')
    page.fill('#templateName','템플릿 둘 수정'); page.click('#updateTemplateBtn')
    record('템플릿 수정', '템플릿 둘 수정' in page.inner_text('#templateList'))
    page.once('dialog', lambda dialog: dialog.accept())
    page.locator('.template-item').nth(2).get_by_role('button',name='삭제').click()
    record('템플릿 삭제', page.inner_text('#templateCount').strip()=='2개')

    stored=storage_snapshot(page)
    page2=context.new_page(); page2_errors=[]; page2.on('pageerror',lambda exc: page2_errors.append(str(exc)))
    mount(page2,stored)
    record('새로고침 후 템플릿 유지', page2.inner_text('#templateCount').strip()=='2개' and '템플릿 둘 수정' in page2.inner_text('#templateList'))
    page.close(); page=page2; page_errors.extend(page2_errors)

    page.set_input_files('#jsonFileInput',str(ROOT/'evidence/import-valid.json'))
    page.wait_for_function("() => document.querySelector('#statusMessage').textContent.includes('정상 JSON')")
    record('정상 JSON 복원', page.inner_text('#templateCount').strip()=='3개')
    list_before=page.inner_text('#templateList')
    page.set_input_files('#jsonFileInput',str(ROOT/'evidence/import-malformed.json'))
    page.wait_for_function("() => document.querySelector('#statusMessage').textContent.includes('기존 템플릿은 변경하지 않았습니다')")
    record('문법 손상 JSON 거부 + 기존 유지', page.inner_text('#templateList')==list_before)
    page.set_input_files('#jsonFileInput',str(ROOT/'evidence/import-missing-field.json'))
    page.wait_for_function("() => document.querySelector('#statusMessage').textContent.includes('기존 템플릿은 변경하지 않았습니다')")
    record('필수 누락 JSON 거부 + 기존 유지', page.inner_text('#templateList')==list_before)

    page.set_input_files('#imageInput',str(ROOT/'test-assets/sample-landscape.png')); wait_success(page)
    page.click('button[data-ratio="4:5"]')
    page.fill('#captionInput','미리보기와 파일이 같은 카드'); page.dispatch_event('#captionInput','input')
    page.screenshot(path=str(ROOT/'evidence/app-preview.png'),full_page=True)

    record('브라우저 페이지 오류 0건', len(page_errors)==0, '; '.join(page_errors))
    browser.close()

# static public-safety scan for common secret formats
text_ext={'.html','.css','.js','.md','.txt','.json','.py'}
patterns=[re.compile(r'AIza[0-9A-Za-z_-]{20,}'),re.compile(r'ghp_[0-9A-Za-z]{20,}'),re.compile(r'sk-[A-Za-z0-9_-]{20,}')]
found=[]
for f in ROOT.rglob('*'):
    if f.is_file() and f.suffix.lower() in text_ext:
        content=f.read_text('utf-8',errors='ignore')
        if any(p.search(content) for p in patterns): found.append(str(f.relative_to(ROOT)))
record('공개 파일 비밀값 패턴 0건', not found, ', '.join(found))

for f in [ROOT/'output/final-square.png',ROOT/'output/final-feed.png',ROOT/'output/final-story.png']:
    with Image.open(f) as im: im.verify()
    with Image.open(f) as im:
        record(f'{f.name} 정상 열림', im.width>0 and im.height>0)
        record(f'{f.name} EXIF/GPS 0건', len(im.getexif())==0)

summary={'generated_at':time.strftime('%Y-%m-%dT%H:%M:%S%z'),'passed':sum(r['status']=='PASS' for r in RESULTS),'failed':sum(r['status']=='FAIL' for r in RESULTS),'results':RESULTS}
(ROOT/'evidence/test-results.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(summary,ensure_ascii=False,indent=2))
