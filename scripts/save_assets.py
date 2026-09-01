import os, base64, json, subprocess, urllib.parse, urllib.request

ROOT = os.path.abspath('.')
ASSETS_DIR = os.path.join(ROOT, 'presentations', 'manual_assets')
OUT_DIR = os.path.join(ROOT, 'out')
os.makedirs(OUT_DIR, exist_ok=True)

def b64(fn):
    p = os.path.join(ASSETS_DIR, fn)
    if not os.path.exists(p): return ''
    ext = os.path.splitext(fn)[1].replace('.', '').lower()
    mime = 'image/png' if ext == 'png' else 'image/jpeg'
    with open(p, 'rb') as f:
        return f'data:{mime};base64,' + base64.b64encode(f.read()).decode('utf-8')

imgs = {
    'logo': b64('page_1_img_1_9.jpeg'),
    'login_attiva': b64('page_2_img_2_46.png'),
    'attiva_form': b64('page_2_img_3_47.png'),
    'ced_alert': b64('page_3_img_2_50.png'),
    'email_assoc': b64('page_3_img_3_51.png'),
    'email_invito': b64('page_4_img_2_54.png'),
    'imposta_pwd': b64('page_4_img_3_55.png'),
    'dash_full': b64('page_5_img_2_57.jpeg'),
    'sidebar': b64('page_5_img_3_58.png'),
    'bollette_table': b64('page_5_img_4_59.png'),
    'filtro_periodo': b64('page_6_img_2_62.jpeg'),
    'confronto_chart': b64('page_6_img_3_63.png'),
    'profilo_card': b64('page_7_img_2_70.png'),
    'cambia_pwd': b64('page_7_img_3_71.png'),
    'email_pwd_aggiornata': b64('page_8_img_2_73.png'),
    'supporto_page': b64('page_8_img_3_74.png'),
    'login_forgot': b64('page_10_img_2_77.png'),
    'forgot_account': b64('page_10_img_3_78.png'),
    'account_found': b64('page_11_img_2_81.png'),
    'otp_email': b64('page_11_img_3_82.png'),
    'otp_form': b64('page_11_img_4_83.png'),
    'pwd_success': b64('page_12_img_2_86.png')
}
with open('out/imgs.json', 'w', encoding='utf-8') as f:
    json.dump(imgs, f)
print('Assets JSON saved.')
