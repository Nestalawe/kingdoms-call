"""Shared layout for the Kingdoms Call reference PDFs (reportlab)."""
import datetime
import re

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate, Frame, KeepTogether, PageBreak, PageTemplate, Paragraph, Spacer, Table,
    TableStyle,
)

FONT_DIR = '/usr/share/fonts/truetype/dejavu/'
pdfmetrics.registerFont(TTFont('Sans', FONT_DIR + 'DejaVuSans.ttf'))
pdfmetrics.registerFont(TTFont('Sans-Bold', FONT_DIR + 'DejaVuSans-Bold.ttf'))
pdfmetrics.registerFont(TTFont('Sans-Italic', FONT_DIR + 'DejaVuSans.ttf'))
pdfmetrics.registerFont(TTFont('Sans-BoldItalic', FONT_DIR + 'DejaVuSans-Bold.ttf'))
pdfmetrics.registerFontFamily('Sans', normal='Sans', bold='Sans-Bold', italic='Sans-Italic',
                              boldItalic='Sans-BoldItalic')

INK = colors.HexColor('#1f1a14')
RULE = colors.HexColor('#8a7a6a')
HEAD_BG = colors.HexColor('#2f3f33')
ZEBRA = colors.HexColor('#f3efe6')
ACCENT = colors.HexColor('#7a4a12')
NOTE_BG = colors.HexColor('#fbf6ea')
GAP_BG = colors.HexColor('#f7ecec')

STYLES = {
    'title': ParagraphStyle('title', fontName='Sans-Bold', fontSize=22, leading=26, textColor=INK, spaceAfter=4),
    'subtitle': ParagraphStyle('subtitle', fontName='Sans', fontSize=11, leading=14, textColor=ACCENT, spaceAfter=10),
    'h1': ParagraphStyle('h1', fontName='Sans-Bold', fontSize=14, leading=17, textColor=HEAD_BG, spaceBefore=12, spaceAfter=6),
    'h2': ParagraphStyle('h2', fontName='Sans-Bold', fontSize=11, leading=14, textColor=ACCENT, spaceBefore=8, spaceAfter=4),
    'body': ParagraphStyle('body', fontName='Sans', fontSize=9, leading=12, textColor=INK, spaceAfter=4),
    'small': ParagraphStyle('small', fontName='Sans', fontSize=7.5, leading=9.5, textColor=INK),
    'cell': ParagraphStyle('cell', fontName='Sans', fontSize=7.4, leading=9.2, textColor=INK, alignment=TA_LEFT),
    'cellb': ParagraphStyle('cellb', fontName='Sans-Bold', fontSize=7.4, leading=9.2, textColor=INK),
    'head': ParagraphStyle('head', fontName='Sans-Bold', fontSize=7.6, leading=9.4, textColor=colors.white),
    'bullet': ParagraphStyle('bullet', fontName='Sans', fontSize=9, leading=12, textColor=INK, leftIndent=12,
                             bulletIndent=2, spaceAfter=2),
    'note': ParagraphStyle('note', fontName='Sans-Italic', fontSize=8.5, leading=11, textColor=INK,
                           backColor=NOTE_BG, borderPadding=4, spaceBefore=4, spaceAfter=8),
}

_STRIP = re.compile('[\U00010000-\U0010ffff☀-➿⬀-⯿️‍←-⇿]')


def clean(s):
    """Drop glyphs the font lacks (emoji, dingbats, arrows) and escape for Paragraph."""
    if s is None:
        return ''
    s = str(s)
    s = _STRIP.sub('', s)
    s = s.replace('→', ' to ').replace('↑', '')
    s = s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    return s.strip()


def P(text, style='body'):
    return Paragraph(clean(text), STYLES[style])


def PM(text, style='body'):
    """Paragraph that keeps simple <b>/<i> markup."""
    s = _STRIP.sub('', str(text or ''))
    s = s.replace('&', '&amp;')
    s = re.sub(r'<(?!/?(b|i|br/?)\b)', '&lt;', s)
    return Paragraph(s, STYLES[style])


def H1(t):
    return P(t, 'h1')


def H2(t):
    return P(t, 'h2')


def note(t):
    return PM(t, 'note')


def bullets(items):
    return [Paragraph(clean(i), STYLES['bullet'], bulletText='•') for i in items]


def spacer(h=6):
    return Spacer(1, h)


def table(columns, rows, widths=None, zebra=True, font=None, bold_first=True, repeat=1):
    """columns: list of header strings; rows: list of lists of strings. widths: fractions of page width."""
    page_w = landscape(A4)[0] - 2 * 1.3 * cm
    if widths is None:
        widths = [1.0 / len(columns)] * len(columns)
    tot = float(sum(widths))
    col_w = [page_w * w / tot for w in widths]
    cell_style = STYLES['cell'] if font is None else ParagraphStyle('c2', parent=STYLES['cell'], fontSize=font, leading=font + 1.8)
    cellb_style = STYLES['cellb'] if font is None else ParagraphStyle('cb2', parent=STYLES['cellb'], fontSize=font, leading=font + 1.8)
    data = [[Paragraph(clean(c), STYLES['head']) for c in columns]]
    for r in rows:
        cells = []
        for i, c in enumerate(r):
            st = cellb_style if (i == 0 and bold_first) else cell_style
            cells.append(Paragraph(clean(c), st))
        data.append(cells)
    t = Table(data, colWidths=col_w, repeatRows=repeat)
    ts = [
        ('BACKGROUND', (0, 0), (-1, 0), HEAD_BG),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LINEBELOW', (0, 0), (-1, 0), 0.8, HEAD_BG),
        ('GRID', (0, 1), (-1, -1), 0.3, RULE),
        ('LEFTPADDING', (0, 0), (-1, -1), 3),
        ('RIGHTPADDING', (0, 0), (-1, -1), 3),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
    ]
    if zebra:
        for i in range(1, len(data)):
            if i % 2 == 0:
                ts.append(('BACKGROUND', (0, i), (-1, i), ZEBRA))
    t.setStyle(TableStyle(ts))
    return t


def kv_table(pairs, widths=(0.22, 0.78)):
    return table(['Rule', 'What it is'], [[k, v] for k, v in pairs], widths)


def gaps(items, title='Gaps, questions and things to check'):
    """The closing section every document carries: observations for Toby, not rulings."""
    out = [H1(title),
           P('These are observations from reading the data files, the engine and the rulebook together. '
             'None of them is a ruling. Each is a question for Toby or a place where two sources disagree.')]
    rows = [[str(i + 1), g] for i, g in enumerate(items)]
    t = table(['#', 'Observation'], rows, widths=[0.04, 0.96], zebra=False)
    t.setStyle(TableStyle([('BACKGROUND', (0, 1), (-1, -1), GAP_BG)]))
    out.append(t)
    return out


class RefDoc:
    def __init__(self, path, title, subtitle, stamp):
        self.path = path
        self.title = title
        self.subtitle = subtitle
        self.stamp = stamp
        self.story = []

    def cover(self, intro, look_for, sources):
        s = self.story
        s.append(P(self.title, 'title'))
        s.append(P(self.subtitle, 'subtitle'))
        s.append(P('Kingdoms Call reference sheet. Data file v%s. Generated %s from the repository '
                   '(branch at that date). Numbers are what the engine uses today, read straight from its tables; '
                   'where a figure comes from the rulebook text instead, the section says so.'
                   % (self.stamp, datetime.date.today().isoformat()), 'small'))
        s.append(spacer(8))
        s.append(P(intro))
        if look_for:
            s.append(H2('What to look for when reviewing'))
            s.extend(bullets(look_for))
        if sources:
            s.append(H2('Where this comes from'))
            s.extend(bullets(sources))
        s.append(spacer(6))

    def add(self, *flowables):
        for f in flowables:
            if isinstance(f, list):
                self.story.extend(f)
            else:
                self.story.append(f)

    def page_break(self):
        self.story.append(PageBreak())

    def build(self):
        pagesize = landscape(A4)
        margin = 1.3 * cm
        doc = BaseDocTemplate(self.path, pagesize=pagesize, leftMargin=margin, rightMargin=margin,
                              topMargin=1.5 * cm, bottomMargin=1.3 * cm, title=self.title,
                              author='Kingdoms Call reference', subject=self.subtitle)
        frame = Frame(margin, 1.3 * cm, pagesize[0] - 2 * margin, pagesize[1] - 2.8 * cm, id='f',
                      leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
        title = self.title
        stamp = self.stamp

        def on_page(canvas, d):
            canvas.saveState()
            canvas.setFont('Sans', 7.5)
            canvas.setFillColor(RULE)
            canvas.drawString(margin, pagesize[1] - 1.0 * cm, 'Kingdoms Call  ·  ' + title)
            canvas.drawRightString(pagesize[0] - margin, pagesize[1] - 1.0 * cm, 'reference sheet')
            canvas.setStrokeColor(RULE)
            canvas.setLineWidth(0.4)
            canvas.line(margin, pagesize[1] - 1.15 * cm, pagesize[0] - margin, pagesize[1] - 1.15 * cm)
            canvas.drawString(margin, 0.7 * cm, 'Data file v' + stamp)
            canvas.drawRightString(pagesize[0] - margin, 0.7 * cm, 'Page %d' % d.page)
            canvas.restoreState()

        doc.addPageTemplates([PageTemplate(id='p', frames=[frame], onPage=on_page)])
        doc.build(self.story)
        return self.path
