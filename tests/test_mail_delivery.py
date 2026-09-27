import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'deploy' / 'health'))
from mail_delivery import build_message


class MailDeliveryTest(unittest.TestCase):
    def test_html_and_plain_text_with_escaped_device_name(self):
        message = build_message([{
            'time': '2026-09-27T12:40:10Z',
            'event': 'ALERT',
            'name': '<sensor_data>',
            'message': 'Saknar kontakt & mätvärde'
        }], 'sender@example.test', 'recipient@example.test')
        self.assertTrue(message.is_multipart())
        self.assertIn('14:40', message.get_body(preferencelist=('plain',)).get_content())
        html = message.get_body(preferencelist=('html',)).get_content()
        self.assertIn('&lt;sensor_data&gt;', html)
        self.assertIn('Saknar kontakt &amp; mätvärde', html)
        self.assertNotIn('<sensor_data>', html)
        self.assertEqual(message['Subject'], '[Väderstation] Larm')

    def test_recovery_has_clear_status_and_plain_text_fallback(self):
        message = build_message([{
            'time': '2026-09-27T12:40:10Z',
            'event': 'RECOVERED',
            'name': 'sensor_data',
            'message': 'Frisk igen'
        }], 'sender@example.test', 'recipient@example.test')
        self.assertEqual(message['Subject'], '[Väderstation] Status / återhämtning')
        self.assertIn('ÅTERSTÄLLT', message.get_body(preferencelist=('html',)).get_content())
        self.assertIn('Frisk igen', message.get_body(preferencelist=('plain',)).get_content())


if __name__ == '__main__':
    unittest.main()
