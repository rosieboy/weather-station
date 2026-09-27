"""Bounded SMTP delivery; credentials are read only from a root-owned file."""
import json
import smtplib
import ssl
from datetime import datetime
from html import escape
from pathlib import Path
from email.message import EmailMessage
from email.utils import formatdate
from zoneinfo import ZoneInfo

CONFIG = Path('/etc/weather-station-health/smtp.json')
STOCKHOLM = ZoneInfo('Europe/Stockholm')


def local_time(value):
    try:
        moment = datetime.fromisoformat(value.replace('Z', '+00:00')).astimezone(STOCKHOLM)
        month = ('jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec')[moment.month - 1]
        return f'{moment.day} {month} {moment:%H:%M}'
    except (AttributeError, ValueError):
        return str(value)


def build_message(queue, sender, recipient):
    msg = EmailMessage()
    msg['From'] = 'Väderstationen <' + sender + '>'
    msg['To'] = recipient
    msg['Subject'] = '[Väderstation] ' + ('Larm' if any(e['event'] == 'ALERT' for e in queue) else 'Status / återhämtning')
    msg['Date'] = formatdate(localtime=True)
    msg.set_content('\n\n'.join(f"{local_time(e['time'])} · {e['event']} · {e['name']}\n{e['message']}" for e in queue))
    rows = []
    for event in queue:
        kind = event['event']
        label = {'ALERT': 'LARM', 'RECOVERED': 'ÅTERSTÄLLT', 'READY': 'AKTIVERAT'}.get(kind, kind)
        tone = '#a6382a' if kind == 'ALERT' else '#27664c'
        rows.append(
            '<tr><td style="padding:18px 20px;border-top:1px solid #e5e9e4">'
            f'<div style="font-size:12px;color:#52675c">{escape(local_time(event["time"]))} · Europe/Stockholm</div>'
            f'<div style="margin-top:8px;font-size:12px;font-weight:700;letter-spacing:.08em;color:{tone}">{escape(label)}</div>'
            f'<div style="margin-top:5px;font-size:17px;font-weight:700;color:#1b3025">{escape(str(event["name"]))}</div>'
            f'<div style="margin-top:5px;font-size:15px;line-height:1.45;color:#394c40">{escape(str(event["message"]))}</div>'
            '</td></tr>'
        )
    heading = 'Larm från väderstationen' if any(e['event'] == 'ALERT' for e in queue) else 'Status från väderstationen'
    html = (
        '<!doctype html><html lang="sv"><body style="margin:0;padding:24px;background:#f2f5f1;font-family:Arial,sans-serif">'
        '<table role="presentation" style="width:100%;max-width:560px;margin:auto;border-collapse:collapse;background:#fff;border:1px solid #d4dfd5;border-radius:10px">'
        '<tr><td style="padding:20px;background:#173d2b;color:#fff">'
        '<div style="font-size:12px;letter-spacing:.12em">VÄDERSTATIONEN</div>'
        f'<div style="margin-top:8px;font-size:22px;font-weight:700">{escape(heading)}</div>'
        '</td></tr>' + ''.join(rows) + '</table>'
        '<p style="max-width:560px;margin:14px auto;color:#52675c;font-size:12px">Automatisk hälsokontroll på Raspberry Pi.</p>'
        '</body></html>'
    )
    msg.add_alternative(html, subtype='html')
    return msg


def deliver(queue):
    if not queue or not CONFIG.exists():
        return queue
    try:
        config = json.loads(CONFIG.read_text())
        with smtplib.SMTP('smtp.gmail.com', 587, timeout=10) as smtp:
            smtp.ehlo()
            smtp.starttls(context=ssl.create_default_context())
            smtp.ehlo()
            smtp.login(config['sender'], config['password'])
            # One digest per run, including delayed events and recoveries in order.
            smtp.send_message(build_message(queue, config['sender'], config['recipient']))
        print('Mail delivered', flush=True)
        return []
    except Exception as exc:
        # Never log server responses or credentials.
        print('Mail pending: ' + type(exc).__name__, flush=True)
        return queue
