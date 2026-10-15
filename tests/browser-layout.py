"""Run against `npm run preview -- --port 4173`; requires Python Playwright."""
import argparse
import json
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument('--url', default='http://127.0.0.1:4173/')
parser.add_argument('--browser', help='Optional Chromium-based browser executable')
args = parser.parse_args()
results = {}
errors = []

with sync_playwright() as p:
    options = {'headless': True}
    if args.browser:
        options['executable_path'] = args.browser
    browser = p.chromium.launch(**options)
    for name, width, height, zoom in [
        ('normal', 960, 540, 1),
        ('zoom_150', 960, 540, 1.5),
        ('zoom_200', 960, 540, 2),
        ('legacy_viewport', 960, 540, 1),
        ('mobile', 320, 640, 1),
        ('landscape', 844, 390, 1),
        ('4k', 3840, 2160, 1),
    ]:
        context = browser.new_context(viewport={'width': width, 'height': height})
        if name == 'legacy_viewport':
            context.add_init_script('''
              Object.defineProperty(window, 'visualViewport', {value: undefined});
              window.ResizeObserver = undefined;
              Element.prototype.animate = undefined;
            ''')
        page = context.new_page()
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(args.url, wait_until='networkidle')
        if zoom != 1:
            context.new_cdp_session(page).send('Emulation.setPageScaleFactor', {'pageScaleFactor': zoom})
        page.wait_for_timeout(100)
        # Exercise a real hit target after zoom, rather than only checking CSS.
        blue = page.get_by_role('button', name='파란색 계열', exact=True)
        blue.click()
        results[name] = page.evaluate('''() => {
          const viewport = window.visualViewport;
          const left = viewport?.offsetLeft || 0, top = viewport?.offsetTop || 0;
          const width = viewport?.width || innerWidth, height = viewport?.height || innerHeight;
          const toolbar = document.querySelector('.toolbar');
          const canvas = document.querySelector('.smoke-canvas').getBoundingClientRect();
          const buttons = [...toolbar.querySelectorAll('button')];
          return {
            visible: getComputedStyle(toolbar).opacity === '1',
            all_buttons_fit: buttons.length === 8 && buttons.every(button => {
              const b = button.getBoundingClientRect();
              return b.left >= left - 1 && b.right <= left + width + 1
                && b.top >= top - 1 && b.bottom <= top + height + 1;
            }),
            canvas_fits: Math.abs(canvas.left-left) < 1 && Math.abs(canvas.top-top) < 1
              && Math.abs(canvas.width-width) < 1 && Math.abs(canvas.height-height) < 1,
          };
        }''')
        results[name]['palette_click_works'] = blue.get_attribute('aria-pressed') == 'true'
        context.close()
    print(json.dumps({'cases': results, 'errors': errors}, indent=2), flush=True)
    assert not errors, errors
    assert all(all(checks.values()) for checks in results.values()), results
    browser.close()
