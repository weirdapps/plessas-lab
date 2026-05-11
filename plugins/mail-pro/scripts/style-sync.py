#!/usr/bin/env python3
"""
Automated style guide sync — updates aggregate metrics from brain.db.

Runs after second-brain daily ingestion. Updates only the reliable
quantitative sections (total count, language/sentiment distributions).
Per-recipient profiles, vocabulary, and reply length stats require
Claude's contextual analysis and are updated via manual /style-sync.

Usage:
    python scripts/style-sync.py                 # Normal sync
    python scripts/style-sync.py --dry-run       # Preview without writing
    python scripts/style-sync.py --force         # Recompute even if no new data
"""

import argparse
import json
import re
import shutil
import sqlite3
import sys
from datetime import datetime
from pathlib import Path

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
# This script lives in `mail-pro` (the second-brain-dependent companion to the
# `mail` plugin) but writes to the style guide consumed by `mail`. Resolve the
# style guide relative to this script so it works from any install location:
#   plugins/mail-pro/scripts/style-sync.py → ../../mail/shared/style-guide.md
SCRIPT_DIR = Path(__file__).resolve().parent
STYLE_GUIDE = SCRIPT_DIR.parent.parent / "mail" / "shared" / "style-guide.md"

# DB path defaults to a sibling second-brain checkout but is overridable via --db.
# Teammates without second-brain installed must pass --db or this script exits.
DB_PATH = Path.home() / "SourceCode/second-brain/data/brain.db"

SYNC_STATE = Path.home() / ".claude/drafts/style-sync-state.json"
BACKUP_DIR = Path.home() / ".claude/drafts/style-guide-backups"

SENDER_FILTER = "%plessas%"

# Drift thresholds (percentage points)
DRIFT_LANG_PCT = 5
DRIFT_SENTIMENT_PCT = 5


# ---------------------------------------------------------------------------
# Database queries
# ---------------------------------------------------------------------------
def get_total_sent(conn):
    return conn.execute(
        "SELECT COUNT(*) FROM emails WHERE sender_address LIKE ?",
        (SENDER_FILTER,),
    ).fetchone()[0]


def get_date_range(conn):
    return conn.execute(
        "SELECT MIN(date_received), MAX(date_received) FROM emails WHERE sender_address LIKE ?",
        (SENDER_FILTER,),
    ).fetchone()


def get_language_distribution(conn):
    return conn.execute(
        """SELECT language, COUNT(*) as cnt
           FROM emails WHERE sender_address LIKE ?
           GROUP BY language ORDER BY cnt DESC""",
        (SENDER_FILTER,),
    ).fetchall()


def get_sentiment_distribution(conn):
    return conn.execute(
        """SELECT sentiment, COUNT(*) as cnt
           FROM emails WHERE sender_address LIKE ?
           GROUP BY sentiment ORDER BY cnt DESC""",
        (SENDER_FILTER,),
    ).fetchall()


# ---------------------------------------------------------------------------
# Style guide updaters
# ---------------------------------------------------------------------------
def update_header(text, total, months):
    """Update the corpus stats header line."""
    return re.sub(
        r"analysis of [\d,]+ sent emails across [\d.]+ months",
        f"analysis of {total:,} sent emails across {months:.1f} months",
        text,
    )


def update_daily_volume(text, total, days):
    """Update daily volume stat."""
    avg = total / days if days > 0 else 0
    return re.sub(
        r"\*\*Daily volume\*\*: ~\d+ emails/day average across \d+ days",
        f"**Daily volume**: ~{avg:.0f} emails/day average across {days} days",
        text,
    )


def update_distribution_table(text, section_header, rows, total):
    """Update a | Name | Count | % | distribution table."""
    # Find the section
    pattern = re.escape(section_header) + r".*?\n\n"
    section_match = re.search(pattern, text, re.DOTALL)
    if not section_match:
        return text

    section = text[section_match.start() : section_match.end()]

    # Find the table within (header row + separator + data rows)
    table_match = re.search(r"(\|[^\n]+\|\n\|[-| ]+\|\n)((?:\|[^\n]+\|\n)+)", section)
    if not table_match:
        return text

    header = table_match.group(1)

    # Only include canonical categories (skip LLM extraction artifacts)
    canonical = {
        "greek",
        "mixed",
        "english",
        "collaborative",
        "informational",
        "directive",
        "escalation",
        "celebratory",
    }
    new_rows = ""
    other_count = 0
    for name, count in rows:
        if (name or "").lower() in canonical:
            pct = count / total * 100 if total > 0 else 0
            display = name.capitalize() if name else "Unknown"
            new_rows += f"| {display} | {count:,} | {pct:.1f}% |\n"
        else:
            other_count += count

    new_section = section[: table_match.start()] + header + new_rows + "\n"
    remaining = section[table_match.end() :]
    new_section += remaining

    return text[: section_match.start()] + new_section + text[section_match.end() :]


# ---------------------------------------------------------------------------
# N= count updaters for sections that reference the total
# ---------------------------------------------------------------------------
def update_section_n_counts(text, total):
    """Update N=X,XXX references in section headers."""
    # "## Email Volume & Timing (N=9,048)"
    text = re.sub(
        r"(## Email Volume & Timing \(N=)[\d,]+(\))",
        rf"\g<1>{total:,}\2",
        text,
    )
    # "## Language Distribution (N=9,048)"
    text = re.sub(
        r"(## Language Distribution \(N=)[\d,]+(\))",
        rf"\g<1>{total:,}\2",
        text,
    )
    # "## Sentiment Distribution (N=9,048)"
    text = re.sub(
        r"(## Sentiment Distribution \(N=)[\d,]+(\))",
        rf"\g<1>{total:,}\2",
        text,
    )
    return text


# ---------------------------------------------------------------------------
# Drift detection
# ---------------------------------------------------------------------------
def detect_drift(old_state, new_metrics):
    """Compare new metrics against previous state."""
    alerts: list[str] = []
    old_metrics = old_state.get("metrics", {})
    if not old_metrics:
        return alerts

    # Language drift
    old_langs = old_metrics.get("language_pcts", {})
    new_langs = new_metrics.get("language_pcts", {})
    for lang in set(list(old_langs.keys()) + list(new_langs.keys())):
        old_pct = old_langs.get(lang, 0)
        new_pct = new_langs.get(lang, 0)
        if abs(new_pct - old_pct) > DRIFT_LANG_PCT:
            alerts.append(f"Language drift: {lang} {old_pct:.1f}% → {new_pct:.1f}%")

    # Sentiment drift
    old_sents = old_metrics.get("sentiment_pcts", {})
    new_sents = new_metrics.get("sentiment_pcts", {})
    for sent in set(list(old_sents.keys()) + list(new_sents.keys())):
        old_pct = old_sents.get(sent, 0)
        new_pct = new_sents.get(sent, 0)
        if abs(new_pct - old_pct) > DRIFT_SENTIMENT_PCT:
            alerts.append(f"Sentiment drift: {sent} {old_pct:.1f}% → {new_pct:.1f}%")

    return alerts


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(description="Sync style guide aggregate metrics")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
    parser.add_argument("--force", action="store_true", help="Recompute even if no new data")
    parser.add_argument("--db", type=Path, default=DB_PATH, help="Path to brain.db")
    parser.add_argument("--quiet", action="store_true", help="Minimal output (for cron)")
    args = parser.parse_args()

    if not args.db.exists():
        print(f"Error: Database not found at {args.db}", file=sys.stderr)
        sys.exit(1)
    if not STYLE_GUIDE.exists():
        print(f"Error: Style guide not found at {STYLE_GUIDE}", file=sys.stderr)
        sys.exit(1)

    # Load previous sync state
    old_state = {}
    if SYNC_STATE.exists():
        old_state = json.loads(SYNC_STATE.read_text())

    # Check for new data
    conn = sqlite3.connect(str(args.db))
    total = get_total_sent(conn)
    old_total = old_state.get("sent_total", 0)

    if total == old_total and not args.force:
        if not args.quiet:
            print(f"No new sent emails (total: {total:,}). Up to date.")
        conn.close()
        sys.exit(0)

    new_count = max(0, total - old_total)
    if not args.quiet:
        print(f"Processing {new_count} new emails (total: {total:,})")

    # ── Compute metrics ──────────────────────────────────────────────────

    date_range = get_date_range(conn)
    if date_range[0] and date_range[1]:
        # DB has mixed naive ('2018-02-26T14:49:55') and aware ('2026-05-09T...Z')
        # timestamps; strip tz to make subtraction safe — only .days matters.
        first = datetime.fromisoformat(date_range[0]).replace(tzinfo=None)
        last = datetime.fromisoformat(date_range[1]).replace(tzinfo=None)
        days = (last - first).days or 1
        months = days / 30.44
    else:
        days, months = 1, 0

    lang_dist = get_language_distribution(conn)
    sent_dist = get_sentiment_distribution(conn)

    # Only canonical categories for percentage tracking
    canonical_langs = {"greek", "mixed", "english"}
    canonical_sents = {
        "collaborative",
        "informational",
        "directive",
        "escalation",
        "celebratory",
    }
    lang_pcts = {
        lang: c / total * 100 for lang, c in lang_dist if (lang or "").lower() in canonical_langs
    }
    sent_pcts = {
        sent: c / total * 100 for sent, c in sent_dist if (sent or "").lower() in canonical_sents
    }

    conn.close()

    # ── Drift detection ──────────────────────────────────────────────────

    new_metrics = {
        "total": total,
        "language_pcts": lang_pcts,
        "sentiment_pcts": sent_pcts,
    }
    drift_alerts = detect_drift(old_state, new_metrics)

    # Preserve manually-added drift alerts
    existing_drift = old_state.get("drift_detected", [])
    manual_drift = [
        d for d in existing_drift if not d.startswith(("Language drift:", "Sentiment drift:"))
    ]
    all_drift = manual_drift + drift_alerts

    # ── Update style guide ───────────────────────────────────────────────

    guide = STYLE_GUIDE.read_text()
    original = guide

    guide = update_header(guide, total, months)
    guide = update_daily_volume(guide, total, days)
    guide = update_section_n_counts(guide, total)
    guide = update_distribution_table(guide, "## Language Distribution", lang_dist, total)
    guide = update_distribution_table(guide, "## Sentiment Distribution", sent_dist, total)

    # ── Write results ────────────────────────────────────────────────────

    changed_lines = sum(
        1 for a, b in zip(guide.splitlines(), original.splitlines(), strict=False) if a != b
    )

    if guide != original:
        if not args.quiet:
            print(f"  {changed_lines} lines updated in style guide")

        if not args.dry_run:
            BACKUP_DIR.mkdir(parents=True, exist_ok=True)
            ts = datetime.now().strftime("%Y%m%d%H%M")
            backup = BACKUP_DIR / f"style-guide-{ts}.md"
            shutil.copy2(STYLE_GUIDE, backup)
            # Keep 10 most recent backups
            for old in sorted(BACKUP_DIR.glob("style-guide-*.md"), reverse=True)[10:]:
                old.unlink()
            STYLE_GUIDE.write_text(guide)
            if not args.quiet:
                print(f"  Backup: {backup.name}")
        elif not args.quiet:
            print("  [DRY RUN] No files written.")
    elif not args.quiet:
        print("  No changes to style guide.")

    # ── Update sync state ────────────────────────────────────────────────

    now = datetime.now().astimezone().isoformat()
    new_state = {
        "last_sync": now,
        "last_sync_db_cutoff": date_range[1] if date_range else None,
        "last_sync_archive_cutoff": old_state.get("last_sync_archive_cutoff"),
        "emails_processed": old_state.get("emails_processed", 0) + new_count,
        "sync_count": old_state.get("sync_count", 0) + 1,
        "baseline_rebuild_date": old_state.get("baseline_rebuild_date"),
        "sent_total": total,
        "drift_detected": all_drift,
        "drift_resolved": old_state.get("drift_resolved", []),
        "metrics": new_metrics,
    }

    if not args.dry_run:
        SYNC_STATE.write_text(json.dumps(new_state, indent=2, ensure_ascii=False))

    # ── Report ───────────────────────────────────────────────────────────

    if not args.quiet:
        print(f"\n{'━' * 50}")
        print("STYLE SYNC COMPLETE")
        print(f"{'━' * 50}")
        print(f"Emails: {total:,} (+{new_count}) | Days: {days} | Months: {months:.1f}")
        for lang, pct in sorted(lang_pcts.items(), key=lambda x: -x[1]):
            print(f"  {lang}: {pct:.1f}%")
        if all_drift:
            print(f"\nDRIFT ALERTS ({len(all_drift)}):")
            for alert in all_drift:
                print(f"  ⚠ {alert}")
        if not args.dry_run:
            print("\nNote: Per-recipient profiles, vocabulary, and reply stats")
            print("require /style-sync for Claude-assisted updates.")
        print(f"{'━' * 50}")


if __name__ == "__main__":
    main()
