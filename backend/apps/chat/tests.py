from django.test import SimpleTestCase

from .models import ChatMessage
from .views import _compute_confidence


class ConfidenceHeuristicTests(SimpleTestCase):
    def test_three_or_more_chunks_is_high(self):
        chunks = [{"id": "1"}, {"id": "2"}, {"id": "3"}]
        self.assertEqual(_compute_confidence(chunks), ChatMessage.Confidence.HIGH)

    def test_one_or_two_chunks_is_medium(self):
        self.assertEqual(_compute_confidence([{"id": "1"}]),
                         ChatMessage.Confidence.MEDIUM)
        self.assertEqual(_compute_confidence([{"id": "1"}, {"id": "2"}]),
                         ChatMessage.Confidence.MEDIUM)

    def test_zero_chunks_is_low(self):
        self.assertEqual(_compute_confidence([]), ChatMessage.Confidence.LOW)

