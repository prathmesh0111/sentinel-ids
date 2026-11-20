"""Render cover (ReportLab engine) and merge with body -> final PDF."""
import sys, os
PDF_SKILL_DIR = r'C:\Users\Asus\.zcode\cli\plugins\cache\zcode-plugins-official\pdf\0.2.2\skills\pdf'
sys.path.insert(0, os.path.join(PDF_SKILL_DIR, 'scripts'))
from cover_render import render_cover, detect_fonts
from pypdf import PdfReader, PdfWriter, Transformation

A4_W, A4_H = 595.28, 841.89

fonts = detect_fonts()
content = {
    'kicker': 'TECHNICAL DOCUMENTATION  ·  SECURITY',
    'hero': 'SecureMart',
    'summary': 'How every request to SecureMart is inspected, risk-scored and blocked: the request '
               'pipeline, eight rule-based detectors, IP and location-spoofing intelligence, and the '
               'Random Forest + Isolation Forest models that learn from real traffic.',
    'meta': 'SecureMart Engineering  ·  November 2026',
    'footer': 'SECUREMART  ·  SECURITY-DOC-001',
    'year': '2026',
    'word': 'SECURITY',
}
palette = {'primary': '#d24f23', 'text': '#212325', 'muted': '#73797f', 'bg': '#ffffff'}
render_cover('01', content, 'cover.pdf', palette=palette, fonts=fonts)
print('cover rendered')

def normalize(page):
    w, h = float(page.mediabox.width), float(page.mediabox.height)
    if abs(w - A4_W) > 2 or abs(h - A4_H) > 2:
        page.add_transformation(Transformation().scale(sx=A4_W / w, sy=A4_H / h))
        page.mediabox.lower_left = (0, 0)
        page.mediabox.upper_right = (A4_W, A4_H)
    return page

writer = PdfWriter()
writer.add_page(normalize(PdfReader('cover.pdf').pages[0]))
for page in PdfReader('security_body.pdf').pages:
    writer.add_page(normalize(page))
writer.add_metadata({
    '/Title': 'SecureMart - Fraud & IP Anomaly Detection System: Technical Documentation',
    '/Author': 'Z.ai', '/Creator': 'Z.ai',
    '/Subject': 'Detection pipeline, blocking, spoofing intelligence and ML models of the SecureMart security system',
})
with open('SecureMart-Security-Documentation.pdf', 'wb') as f:
    writer.write(f)
print('merged: SecureMart-Security-Documentation.pdf, pages =', len(writer.pages))
