import unittest

from services.invoice_payload import encode_invoice_payload, parse_invoice_payload


class InvoicePayloadTest(unittest.TestCase):
    def test_roundtrip_compact(self):
        rid = "78a64c27-d6ab-474a-8a10-940727a705fc"
        raw = encode_invoice_payload(rid, payment_type="single_pdf", bonus_stars_applied=12)
        self.assertLessEqual(len(raw.encode("utf-8")), 128)
        self.assertEqual(raw, f"r={rid}&t=s&b=12")
        parsed = parse_invoice_payload(raw)
        self.assertEqual(parsed["resume_id"], rid)
        self.assertEqual(parsed["type"], "single_pdf")
        self.assertEqual(parsed["bonus_stars_applied"], 12)

    def test_adapt_type(self):
        rid = "78a64c27-d6ab-474a-8a10-940727a705fc"
        raw = encode_invoice_payload(rid, payment_type="adapt")
        self.assertIn("&t=a&", raw)
        self.assertEqual(parse_invoice_payload(raw)["type"], "adapt")

    def test_legacy_json_still_parses(self):
        legacy = (
            '{"resume_id":"78a64c27-d6ab-474a-8a10-940727a705fc",'
            '"type":"single_pdf","bonus_stars_applied":0}'
        )
        parsed = parse_invoice_payload(legacy)
        self.assertEqual(parsed["resume_id"], "78a64c27-d6ab-474a-8a10-940727a705fc")

    def test_old_json_exceeds_limit(self):
        """Document why we moved away from JSON payloads."""
        legacy = (
            '{"resume_id":"78a64c27-d6ab-474a-8a10-940727a705fc",'
            '"user_id":"aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",'
            '"type":"single_pdf","bonus_stars_applied":0}'
        )
        self.assertGreater(len(legacy.encode("utf-8")), 128)


if __name__ == "__main__":
    unittest.main()
