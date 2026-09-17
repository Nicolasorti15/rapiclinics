import hashlib
import json

print(json.dumps([
    {"bed": "302-B" if index == 0 else f"{302 + index}-A", "token": "demo_" + hashlib.sha256(f"rapiclinics-fixture-{index}".encode()).hexdigest()[:32]}
    for index in range(10)
], indent=2))
