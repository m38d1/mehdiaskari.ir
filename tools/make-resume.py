#!/usr/bin/env python3
"""
make-resume.py — build resume-fa.pdf + resume-en.pdf from one data source.

Modern one-source resumes: Vazirmatn (subset, embedded), teal accents matching
the site, RTL Persian + LTR English. No images, fully selectable text.

Usage:
    python3 tools/make-resume.py            # write both PDFs
    python3 tools/make-resume.py --check    # exit 1 if a PDF is stale (CI)
"""
import hashlib
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FONT_DIR = ROOT / "fonts"

TEAL = (14, 168, 148)
INK = (16, 21, 28)
MUTED = (90, 102, 116)
RULE = (220, 228, 235)

CONTACT_FA = "۰۹۹۹۱۲۳۱۱۱۰  •  me@mehdiaskari.ir  •  github.com/m38d1  •  mehdiaskari.ir"
CONTACT_EN = "+98 999 123 1110  •  me@mehdiaskari.ir  •  github.com/m38d1  •  mehdiaskari.ir"

EXPERIENCE = [
    ("بهمن ۱۴۰۴ — اکنون", "Feb 2026 — Present",
     "برنامه‌ریزی و کنترل پروژه", "Project Planning & Control",
     "قرارگاه سازندگی خاتم‌الانبیا — نیروگاه اتمی بوشهر",
     "Khatam al-Anbia Construction HQ — Bushehr Nuclear Power Plant"),
    ("۱۴۰۳ — ۱۴۰۴", "2024 — 2025",
     "برنامه‌ریزی و کنترل پروژه", "Project Planning & Control",
     "مدیریت طرح‌های انرژی مهر پاسارگاد — پالایشگاه نفت سنگین پارس بهین قشم",
     "Mehr Pasargad Energy — Pars Behin Qeshm Heavy Oil Refinery"),
    ("۱۴۰۱ — ۱۴۰۳", "2022 — 2024",
     "فناوری اطلاعات / برنامه‌ریزی و کنترل پروژه", "IT / Project Planning & Control",
     "کیمیا صنعت مبنا (گروه باختر) — توسعه پتروشیمی نگین مکران",
     "Kimia Sanat Mabna (Bakhtar Group) — Negin Makran Petrochemical"),
    ("۱۳۹۹ — ۱۴۰۱", "2020 — 2022",
     "فناوری اطلاعات / برنامه‌ریزی و کنترل پروژه", "IT / Project Planning & Control",
     "پترو پارس قدرت — پتروشیمی آرین متانول",
     "Petro Pars Ghodrat — Arian Methanol Petrochemical"),
    ("۱۳۹۶ — ۱۳۹۹", "2017 — 2020",
     "فناوری اطلاعات / برنامه‌ریزی و کنترل پروژه", "IT / Project Planning & Control",
     "نیرو پژوه — نیروگاه سیکل ترکیبی مپنا",
     "Niroo Pajooh — Mapna Combined-Cycle Power Plant"),
    ("۱۳۹۵ — ۱۳۹۶", "2016 — 2017",
     "فناوری اطلاعات / برنامه‌ریزی و کنترل پروژه", "IT / Project Planning & Control",
     "IGC — فاز ۱۴ پارس جنوبی",
     "IGC — South Pars Phase 14"),
    ("۱۳۹۲ — ۱۳۹۴", "2013 — 2015",
     "برنامه‌ریزی و کنترل پروژه / کارشناس کالا", "Project Planning & Control / Materials Specialist",
     "نیروی برق اصفهان — نیروگاه سیکل ترکیبی مپنا",
     "Isfahan Regional Electric Co. — Mapna Combined-Cycle Power Plant"),
]

EDUCATION_FA = [
    ("۱۴۰۵", "مدیریت پروژه شناختی در هوش مصنوعی (CPMAI) — موسسه PMI"),
    ("۱۴۰۵", "هفت الگوی پروژه‌های هوش مصنوعی — موسسه PMI"),
    ("۱۴۰۵", "هوش مصنوعی مولد برای مدیران پروژه — موسسه PMI"),
    ("۱۴۰۵", "دوره‌های PMP — موسسه PMI"),
    ("۱۴۰۲", "Google Cloud Skills Boost — گوگل"),
    ("۱۳۹۸", "Responsive Web Design — freeCodeCamp"),
    ("۱۳۹۲–۱۳۹۴", "کارشناسی مهندسی فناوری اطلاعات"),
    ("۱۳۸۹–۱۳۹۱", "کاردانی فناوری اطلاعات"),
]
EDUCATION_EN = [
    ("2026", "Cognitive Project Mgmt in AI (CPMAI) — PMI"),
    ("2026", "Seven AI Project Patterns — PMI"),
    ("2026", "Generative AI for PMs — PMI"),
    ("2026", "PMP Online Courses — PMI"),
    ("2023", "Google Cloud Skills Boost — Google"),
    ("2019", "Responsive Web Design — freeCodeCamp"),
    ("2013–2015", "B.Sc. Information Technology"),
    ("2010–2012", "Associate Degree, Information Technology"),
]

SKILLS_FA = ["Primavera P6", "MS Project", "برنامه‌ریزی و کنترل پروژه",
             "توسعه وب (Frontend/Backend)", "شبکه و امنیت (Network/Security)",
             "گزارش‌دهی دوره‌ای"]
SKILLS_EN = ["Primavera P6", "MS Project", "Planning & Control",
             "Web Dev (Frontend / Backend)", "Network & Security",
             "Periodic Reporting"]


def need_rebuild() -> bool:
    """True when a PDF is missing or older than this script / fonts."""
    deps = [Path(__file__)] + sorted(FONT_DIR.glob("vazirmatn-*.woff2"))
    for name in ("resume-fa.pdf", "resume-en.pdf"):
        pdf = ROOT / name
        if not pdf.exists():
            return True
        if max(p.stat().st_mtime for p in deps) > pdf.stat().st_mtime:
            return True
    return False


def prepare_fonts():
    """Build static merged TTFs (Regular/Bold, arabic+latin) from the site's
    variable woff2 fonts into a gitignored cache dir. Returns (regular, bold)."""
    cache = ROOT / "tools" / ".fontcache"
    reg, bold = cache / "VZ-regular.ttf", cache / "VZ-bold.ttf"
    if reg.exists() and bold.exists():
        deps = sorted(FONT_DIR.glob("vazirmatn-*.woff2")) + [Path(__file__)]
        if max(p.stat().st_mtime for p in deps) <= min(reg.stat().st_mtime,
                                                        bold.stat().st_mtime):
            return str(reg), str(bold)
    try:
        from fontTools.merge import Merger
        from fontTools.ttLib import TTFont
        from fontTools.varLib.instancer import instantiateVariableFont
    except ImportError:
        raise SystemExit("pip install fonttools brotli   # needed once to build resume fonts")
    cache.mkdir(parents=True, exist_ok=True)
    for name, wt, out in (("Regular", 400, reg), ("Bold", 700, bold)):
        parts = []
        for sub in ("arabic", "latin"):
            t = TTFont(str(FONT_DIR / f"vazirmatn-{sub}.woff2"))
            inst = instantiateVariableFont(t, {"wght": wt})
            p = cache / f"tmp-{sub}-{name}.ttf"
            inst.save(str(p))
            parts.append(str(p))
        Merger().merge(parts).save(str(out))
        for p in parts:
            Path(p).unlink()
    return str(reg), str(bold)
    """True when a PDF is missing or older than this script / fonts."""
    deps = [Path(__file__)] + sorted(FONT_DIR.glob("vazirmatn-*.woff2"))
    for name in ("resume-fa.pdf", "resume-en.pdf"):
        pdf = ROOT / name
        if not pdf.exists():
            return True
        if max(p.stat().st_mtime for p in deps) > pdf.stat().st_mtime:
            return True
    return False


SIDEBG = (17, 22, 29)
STEXT = (232, 237, 242)
SMUTED = (154, 166, 178)


def build(lang: str):
    import arabic_reshaper
    from bidi.algorithm import get_display
    from fpdf import FPDF

    rtl = lang == "fa"
    reshaper = arabic_reshaper.ArabicReshaper(
        configuration={"delete_harakat": False, "support_ligatures": True})

    def T(s: str) -> str:
        if not rtl:
            return s
        return get_display(reshaper.reshape(s), base_dir="R")

    pdf = FPDF(orientation="P", unit="mm", format="A4")
    pdf.set_auto_page_break(True, margin=10)
    reg, bold = prepare_fonts()
    pdf.add_font("VZ", "", reg)
    pdf.add_font("VZ", "B", bold)
    pdf.add_page()

    SBW = 64  # sidebar width
    if rtl:
        sbx, mainx, mainw = pdf.w - SBW, 8, pdf.w - SBW - 14
        align = "R"
    else:
        sbx, mainx, mainw = 0, SBW + 6, pdf.w - SBW - 14
        align = "L"
    railx = mainx + mainw if rtl else mainx
    entryx = mainx
    entryw = mainw - 7

    # --- sidebar backdrop ---
    pdf.set_fill_color(*SIDEBG)
    pdf.rect(sbx, 0, SBW, 297, style="F")
    sx = sbx + 8
    sw = SBW - 16
    sy = [12]

    def side_label(text):
        pdf.set_xy(sx, sy[0])
        pdf.set_font("VZ", "B", 9)
        pdf.set_text_color(*TEAL)
        pdf.cell(sw, 6, T(text), align=align, new_x="LMARGIN", new_y="NEXT")
        sy[0] = pdf.get_y() + 1

    def side_line(text, size=8.3, color=STEXT, gap=4.4, bold=False):
        pdf.set_xy(sx, sy[0])
        pdf.set_font("VZ", "B" if bold else "", size)
        pdf.set_text_color(*color)
        pdf.multi_cell(sw, gap, text, align=align)
        sy[0] = pdf.get_y() + 0.6

    # --- sidebar: contact ---
    side_label("تماس" if rtl else "Contact")
    for line in ((CONTACT_FA.split("  •  ")) if rtl else (CONTACT_EN.split("  •  "))):
        side_line(line, size=7.8, color=SMUTED)
    sy[0] += 3
    # --- sidebar: skills ---
    side_label("مهارت‌ها" if rtl else "Skills")
    for s in (SKILLS_FA if rtl else SKILLS_EN):
        side_line(("•  " + s) if rtl else ("•  " + s))
    sy[0] += 3
    # --- sidebar: education ---
    side_label("تحصیلات" if rtl else "Education")
    for d, t in (EDUCATION_FA if rtl else EDUCATION_EN):
        side_line(d, size=8, color=TEAL)
        side_line(t, size=7.8)
        sy[0] += 1.2

    # --- main: name + role ---
    mx = [12]
    pdf.set_xy(mainx, 12)
    pdf.set_font("VZ", "B", 26)
    pdf.set_text_color(*INK)
    pdf.multi_cell(mainw, 11, T("مهدی عسکری" if rtl else "Mehdi Askari"),
                   align=align)
    pdf.set_x(mainx)
    pdf.set_font("VZ", "", 10.5)
    pdf.set_text_color(*TEAL)
    pdf.multi_cell(mainw, 6, T("برنامه‌ریزی و کنترل پروژه" if rtl else "Project Planning & Control"),
                   align=align)
    mx[0] = pdf.get_y() + 2
    pdf.set_fill_color(*TEAL)
    if rtl:
        pdf.rect(mainx + mainw - 26, mx[0], 26, 1, style="F")
    else:
        pdf.rect(mainx, mx[0], 26, 1, style="F")
    mx[0] += 5

    # --- main: experience timeline ---
    pdf.set_xy(mainx, mx[0])
    pdf.set_font("VZ", "B", 12.5)
    pdf.set_text_color(*INK)
    pdf.cell(mainw, 7, T("تجربه" if rtl else "Experience"),
             align=align, new_x="LMARGIN", new_y="NEXT")
    top = pdf.get_y() + 1
    dots = []
    y = top
    for fa_d, en_d, fa_r, en_r, fa_o, en_o in EXPERIENCE:
        d, r, o = (fa_d, fa_r, fa_o) if rtl else (en_d, en_r, en_o)
        dots.append(y + 2)
        pdf.set_xy(entryx, y)
        pdf.set_font("VZ", "B", 8.3)
        pdf.set_text_color(*TEAL)
        pdf.cell(entryw, 4.6, T(d), align=align, new_x="LMARGIN", new_y="NEXT")
        pdf.set_x(entryx)
        pdf.set_font("VZ", "B", 10.2)
        pdf.set_text_color(*INK)
        pdf.multi_cell(entryw, 5.2, T(r), align=align)
        pdf.set_x(entryx)
        pdf.set_font("VZ", "", 8.8)
        pdf.set_text_color(*MUTED)
        pdf.multi_cell(entryw, 4.6, T(o), align=align)
        y = pdf.get_y() + 2.6
    # rail + dots behind entries
    pdf.set_draw_color(*TEAL)
    pdf.set_line_width(0.5)
    pdf.line(railx, top, railx, y - 1)
    for dy in dots:
        pdf.set_fill_color(*TEAL)
        pdf.ellipse(railx - 1.6, dy - 1.6, 3.2, 3.2, style="F")
        pdf.set_fill_color(255, 255, 255)
        pdf.ellipse(railx - 0.7, dy - 0.7, 1.4, 1.4, style="F")

    out = ROOT / f"resume-{lang}.pdf"
    pdf.output(str(out))
    return out


def main():
    if "--check" in sys.argv:
        if need_rebuild():
            print("resume PDFs are stale — run: python3 tools/make-resume.py")
            return 1
        print("resume PDFs up to date")
        return 0
    for lang in ("fa", "en"):
        out = build(lang)
        print(f"wrote {out.relative_to(ROOT)} ({out.stat().st_size // 1024} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
