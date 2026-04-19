#!/usr/bin/env python3
"""
Convert MASSIVE dataset → Arabic Algebra training format.

Maps MASSIVE's 60 intents (18 scenarios) to our algebra system:
  - scenario  → resource domain
  - intent    → action type
  - slots     → modifiers
  - utterance → input_text (fed through encoder at training time)

This produces HONEST training labels:
  Input:  the raw utterance (Arabic or English)
  Output: what action the model SHOULD take

No hardcoded intent×pattern→action rules. The model learns this mapping
from real human data.

Usage:
  python3 training/convert-massive.py

Input:  training/massive-ar.jsonl, training/massive-en.jsonl
Output: data/corpus/massive-train.jsonl
"""

import json
import re
from pathlib import Path

TRAINING_DIR = Path(__file__).parent
DATA_DIR = Path(__file__).parent.parent / "data" / "corpus"

# ─── Parquet ID→label mappings (from HuggingFace dataset info) ──────────────

INTENT_NAMES = ["datetime_query", "iot_hue_lightchange", "transport_ticket", "takeaway_query", "qa_stock", "general_greet", "recommendation_events", "music_dislikeness", "iot_wemo_off", "cooking_recipe", "qa_currency", "transport_traffic", "general_quirky", "weather_query", "audio_volume_up", "email_addcontact", "takeaway_order", "email_querycontact", "iot_hue_lightup", "recommendation_locations", "play_audiobook", "lists_createoradd", "news_query", "alarm_query", "iot_wemo_on", "general_joke", "qa_definition", "social_query", "music_settings", "audio_volume_other", "calendar_remove", "iot_hue_lightdim", "calendar_query", "email_sendemail", "iot_cleaning", "audio_volume_down", "play_radio", "cooking_query", "datetime_convert", "qa_maths", "iot_hue_lightoff", "iot_hue_lighton", "transport_query", "music_likeness", "email_query", "play_music", "audio_volume_mute", "social_post", "alarm_set", "qa_factoid", "calendar_set", "play_game", "alarm_remove", "lists_remove", "transport_taxi", "recommendation_movies", "iot_coffee", "music_query", "play_podcasts", "lists_query"]

SCENARIO_NAMES = ["social", "transport", "calendar", "play", "news", "datetime", "recommendation", "email", "iot", "general", "audio", "lists", "qa", "cooking", "takeaway", "music", "alarm", "weather"]

def resolve_label(value, names: list) -> str:
    """Convert integer ID to string label, or pass through if already a string."""
    if isinstance(value, int):
        return names[value] if value < len(names) else str(value)
    return str(value)

# ─── MASSIVE intent → our ActionType ───────────────────────────────────────
# MASSIVE has 60 intents grouped under 18 scenarios.
# We map each to one of our 16 action types:
#   schedule, send, broadcast, assemble, locate, store, document,
#   query, execute, create, coordinate, study, request_teach,
#   resolve, evaluate, process

INTENT_TO_ACTION = {
    # alarm
    "alarm_set":        "schedule",
    "alarm_remove":     "resolve",
    "alarm_query":      "query",

    # audio
    "audio_volume_up":      "execute",
    "audio_volume_down":    "execute",
    "audio_volume_mute":    "execute",
    "audio_volume_other":   "execute",

    # calendar
    "calendar_set":     "schedule",
    "calendar_remove":  "resolve",
    "calendar_query":   "query",

    # cooking
    "cooking_recipe":   "query",
    "cooking_query":    "query",

    # datetime
    "datetime_query":       "query",
    "datetime_convert":     "evaluate",

    # email
    "email_sendemail":      "send",
    "email_query":          "query",
    "email_querycontact":   "query",
    "email_addcontact":     "create",

    # general
    "general_greet":        "process",
    "general_joke":         "query",
    "general_quirky":       "process",
    "general_confirm":      "evaluate",
    "general_dontcare":     "process",
    "general_explain":      "query",
    "general_repeat":       "query",
    "general_affirm":       "evaluate",
    "general_negate":       "resolve",
    "general_praise":       "process",
    "general_command_stop":  "resolve",

    # iot (smart home)
    "iot_hue_lightchange":  "execute",
    "iot_hue_lightoff":     "execute",
    "iot_hue_lighton":      "execute",
    "iot_hue_lightup":      "execute",
    "iot_hue_lightdim":     "execute",
    "iot_wemo_on":          "execute",
    "iot_wemo_off":         "execute",
    "iot_cleaning":         "execute",
    "iot_coffee":           "execute",

    # lists
    "lists_createoradd":    "create",
    "lists_remove":         "resolve",
    "lists_query":          "query",

    # music
    "music_likeness":       "evaluate",
    "music_dislikeness":    "evaluate",
    "music_query":          "query",
    "music_settings":       "execute",

    # news
    "news_query":       "query",

    # play
    "play_music":       "execute",
    "play_audiobook":   "execute",
    "play_radio":       "execute",
    "play_podcasts":    "execute",
    "play_game":        "execute",

    # qa
    "qa_stock":         "query",
    "qa_factoid":       "query",
    "qa_definition":    "query",
    "qa_maths":         "evaluate",
    "qa_currency":      "evaluate",

    # recommendation
    "recommendation_locations":     "query",
    "recommendation_movies":        "query",
    "recommendation_events":        "query",

    # social
    "social_post":      "send",
    "social_query":     "query",

    # takeaway
    "takeaway_order":   "execute",
    "takeaway_query":   "query",

    # transport
    "transport_query":      "query",
    "transport_ticket":     "schedule",
    "transport_traffic":    "query",
    "transport_taxi":       "schedule",

    # weather
    "weather_query":    "query",
}

# MASSIVE scenario → our resource domain
SCENARIO_TO_DOMAIN = {
    "alarm":        "time",
    "audio":        "action",
    "calendar":     "time",
    "cooking":      "food",
    "datetime":     "time",
    "email":        "communication",
    "general":      "general",
    "iot":          "action",
    "lists":        "information",
    "music":        "culture",
    "news":         "information",
    "play":         "culture",
    "qa":           "information",
    "recommendation": "seeking",
    "social":       "communication",
    "takeaway":     "food",
    "transport":    "movement",
    "weather":      "nature",
}

# ─── Slot extraction ───────────────────────────────────────────────────────

SLOT_PATTERN = re.compile(r'\[(\w+)\s*:\s*([^\]]+)\]')

# Map MASSIVE slot names → our modifier keys
SLOT_TO_MODIFIER = {
    "time":         "time",
    "date":         "time",
    "timeofday":    "time",
    "place_name":   "location",
    "business_name": "target",
    "person":       "target",
    "event_name":   "topic",
    "food_type":    "topic",
    "drink_type":   "topic",
    "song_name":    "topic",
    "artist_name":  "target",
    "playlist_name": "topic",
    "radio_name":   "topic",
    "game_name":    "topic",
    "podcast_name": "topic",
    "audiobook_name": "topic",
    "movie_name":   "topic",
    "app_name":     "target",
    "device_type":  "target",
    "house_place":  "location",
    "color_type":   "topic",
    "news_topic":   "topic",
    "email_address": "target",
    "contact":      "target",
    "list_name":    "topic",
    "ingredient":   "topic",
    "music_genre":  "topic",
    "transport_type": "method",
    "order_type":   "topic",
    "currency_name": "topic",
    "business_type": "topic",
    "weather_descriptor": "topic",
    "definition_word": "topic",
    "change_amount":  "quantity",
    "cooking_type":   "method",
    "media_type":     "topic",
    "general_frequency":  "time",
    "relation":       "target",
    "alarm_type":     "topic",
    "joke_type":      "topic",
    "movie_type":     "topic",
    "music_descriptor": "topic",
    "personal_info":  "topic",
    "email_folder":   "location",
}


def extract_slots(annot_utt: str) -> list:
    """Extract [slot : value] from annotated utterance → modifier list."""
    modifiers = []
    for match in SLOT_PATTERN.finditer(annot_utt):
        slot_name = match.group(1).strip()
        slot_value = match.group(2).strip()
        mod_key = SLOT_TO_MODIFIER.get(slot_name, "topic")
        modifiers.append(f"{mod_key}:{slot_value}")
    return modifiers


def convert_example(row: dict, idx: int) -> dict | None:
    """Convert one MASSIVE example to algebra training format."""
    intent = resolve_label(row["intent"], INTENT_NAMES)
    scenario = resolve_label(row["scenario"], SCENARIO_NAMES)

    action = INTENT_TO_ACTION.get(intent)
    if action is None:
        return None  # skip unmapped intents

    domain = SCENARIO_TO_DOMAIN.get(scenario, "general")
    modifiers = extract_slots(row.get("annot_utt", ""))
    locale = row["locale"]

    return {
        "id": f"massive-{locale}-{idx:05d}",
        "input_text": row["utt"],
        "expected_action": action,
        "domain": domain,
        "scenario": scenario,
        "intent": intent,
        "modifiers": modifiers,
        "locale": locale,
        "source": f"massive-{locale}",
        "partition": row.get("partition", "train"),
    }


def convert_file(input_path: Path) -> list:
    """Convert a full MASSIVE JSONL file."""
    results = []
    with open(input_path, encoding="utf-8") as f:
        for idx, line in enumerate(f):
            line = line.strip()
            if not line:
                continue
            row = json.loads(line)
            converted = convert_example(row, idx)
            if converted:
                results.append(converted)
    return results


def main():
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    all_examples = []

    for filename in ["massive-ar.jsonl", "massive-en.jsonl"]:
        input_path = TRAINING_DIR / filename
        if input_path.exists():
            examples = convert_file(input_path)
            all_examples.extend(examples)
            print(f"  {filename}: {len(examples):,} examples converted")
        else:
            print(f"  {filename}: NOT FOUND — run download-massive.py first")

    if not all_examples:
        print("\nNo data to convert. Download first:")
        print("  pip install datasets")
        print("  python3 training/download-massive.py")
        return

    # Write output
    out_path = DATA_DIR / "massive-train.jsonl"
    with open(out_path, "w", encoding="utf-8") as f:
        for ex in all_examples:
            f.write(json.dumps(ex, ensure_ascii=False) + "\n")

    # Stats
    actions = {}
    locales = {}
    for ex in all_examples:
        actions[ex["expected_action"]] = actions.get(ex["expected_action"], 0) + 1
        locales[ex["locale"]] = locales.get(ex["locale"], 0) + 1

    print(f"\nTotal: {len(all_examples):,} examples → {out_path}")
    print(f"\nAction distribution:")
    for action, count in sorted(actions.items(), key=lambda x: -x[1]):
        print(f"  {action:20s} {count:6,}")
    print(f"\nLocale distribution:")
    for locale, count in sorted(locales.items()):
        print(f"  {locale}: {count:,}")


if __name__ == "__main__":
    main()
