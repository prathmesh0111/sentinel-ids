import pymupdf
doc = pymupdf.open('SecureMart-Security-Documentation.pdf')
for i, page in enumerate(doc):
    pix = page.get_pixmap(dpi=110)
    pix.save(f'page_{i+1:02d}.png')
print('rendered', len(doc), 'pages')
