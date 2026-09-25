from app.notifications import send_urgent_notifications


def test_push_message_is_generic(monkeypatch):
    captured = {}

    class Response:
        def raise_for_status(self):
            return None

    def post(url, **kwargs):
        captured.update(url=url, **kwargs)
        return Response()

    monkeypatch.setattr("app.notifications.httpx.post", post)
    send_urgent_notifications(["ExponentPushToken[test]"])
    message = captured["json"][0]
    assert message["title"] == "Pendiente urgente en RAPICLINICS"
    assert "paciente" not in message["body"].casefold()
    assert "data" not in message
