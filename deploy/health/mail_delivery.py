"""Bounded SMTP delivery; credentials are read only from a root-owned file."""
import json
import smtplib
import ssl
from pathlib import Path
from email.message import EmailMessage
from email.utils import formatdate

CONFIG = Path('/etc/weather-station-health/smtp.json')


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
            msg = EmailMessage()
            msg['From'] = 'Väderstationen <' + config['sender'] + '>'
            msg['To'] = config['recipient']
            msg['Subject'] = '[Väderstation] ' + ('Larm' if any(e['event'] == 'ALERT' for e in queue) else 'Status / återhämtning')
            msg['Date'] = formatdate(localtime=True)
            msg.set_content('\n\n'.join(f"{e['time']} · {e['event']} · {e['name']}\n{e['message']}" for e in queue))
            smtp.send_message(msg)
        print('Mail delivered', flush=True)
        return []
    except Exception as exc:
        # Never log server responses or credentials.
        print('Mail pending: ' + type(exc).__name__, flush=True)
        return queue
