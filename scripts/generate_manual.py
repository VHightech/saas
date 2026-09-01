# Python script to generate manuale HTML and PDF
import os, base64, subprocess, urllib.parse

ROOT = os.path.abspath('.')
ASSETS_DIR = os.path.join(ROOT, 'presentations', 'manual_assets')
OUT_DIR = os.path.join(ROOT, 'out')
os.makedirs(OUT_DIR, exist_ok=True)

def get_b64(filename):
    p = os.path.join(ASSETS_DIR, filename)
    if not os.path.exists(p):
        print(f'Warning: {filename} missing')
        return ''
    ext = os.path.splitext(filename)[1].replace('.', '').lower()
    mime = 'image/png' if ext == 'png' else 'image/jpeg'
    with open(p, 'rb') as img_f:
        data = base64.b64encode(img_f.read()).decode('utf-8')
    return f'data:{mime};base64,{data}'

print('Encoding assets...')
logoImg = get_b64('page_1_img_1_9.jpeg')
loginAttivaImg = get_b64('page_2_img_2_46.png')
attivaFormImg = get_b64('page_2_img_3_47.png')
cedAlertImg = get_b64('page_3_img_2_50.png')
emailAssocImg = get_b64('page_3_img_3_51.png')
emailInvitoImg = get_b64('page_4_img_2_54.png')
impostaPwdImg = get_b64('page_4_img_3_55.png')
dashOverviewImg = get_b64('page_5_img_2_57.jpeg')
sidebarZoomImg = get_b64('page_5_img_3_58.png')
bolletteTableImg = get_b64('page_5_img_4_59.png')
filtroPeriodoImg = get_b64('page_6_img_2_62.jpeg')
confrontoChartImg = get_b64('page_6_img_3_63.png')
profiloCardImg = get_b64('page_7_img_2_70.png')
cambiaPwdImg = get_b64('page_7_img_3_71.png')
pwdAggiornataEmailImg = get_b64('page_8_img_2_73.png')
supportoPageImg = get_b64('page_8_img_3_74.png')
loginForgotImg = get_b64('page_10_img_2_77.png')
forgotAccountImg = get_b64('page_10_img_3_78.png')
accountFoundImg = get_b64('page_11_img_2_81.png')
otpEmailImg = get_b64('page_11_img_3_82.png')
otpFormImg = get_b64('page_11_img_4_83.png')
pwdSuccessImg = get_b64('page_12_img_2_86.png')
