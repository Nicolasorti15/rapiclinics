"""Generic urgent-task push notifications without clinical content."""

import httpx


def send_urgent_notifications(tokens: list[str]):
    if not tokens:
        return
    messages = [
        {
            "to": token,
            "title": "Pendiente urgente en RAPICLINICS",
            "body": "Abre la app para revisar un pendiente urgente de tu servicio.",
            "sound": "default",
            "priority": "high",
            "channelId": "urgent-tasks",
        }
        for token in tokens
    ]
    for start in range(0, len(messages), 100):
        try:
            httpx.post(
                "https://exp.host/--/api/v2/push/send",
                json=messages[start : start + 100],
                headers={"Accept": "application/json", "Accept-Encoding": "gzip, deflate"},
                timeout=5,
            ).raise_for_status()
        except httpx.HTTPError:
            # Marking the task urgent must not fail because the provider is unavailable.
            continue
