from __future__ import annotations

import random
import string
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable
import os
import kagglehub
import dotenv
import pandas as pd
from pymongo import MongoClient

dotenv.load_dotenv()
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/optipharma")
DATASET_HANDLE = "mukuldeshantri/1mg-medicines-order-online-dataset"
COLLECTION_NAME = "medicine"
SAMPLE_SIZE = 500


def add_years(value: datetime, years: int) -> datetime:
    try:
        return value.replace(year=value.year + years)
    except ValueError:
        # Handles leap-day edge cases by falling back to Feb 28.
        return value.replace(month=2, day=28, year=value.year + years)


def find_csv_file(dataset_dir: str | Path) -> Path:
    dataset_path = Path(dataset_dir)
    csv_files = sorted(dataset_path.rglob("*.csv"), key=lambda file_path: file_path.stat().st_size, reverse=True)

    if not csv_files:
        raise FileNotFoundError(f"No CSV file found inside downloaded dataset directory: {dataset_path}")

    selected_csv = csv_files[0]
    print(f"[download] Found CSV file: {selected_csv}")
    return selected_csv


def clean_text(value: object) -> str:
    return str(value).strip()


def split_compounds(salt_composition: str) -> list[str]:
    return [part.strip() for part in salt_composition.split("+") if part.strip()]


def generate_batch_numbers(count: int) -> Iterable[str]:
    alphabet = string.ascii_uppercase + string.digits
    rng = random.SystemRandom()
    seen: set[str] = set()

    while len(seen) < count:
        candidate = f"AUTO-{''.join(rng.choice(alphabet) for _ in range(6))}"
        if candidate not in seen:
            seen.add(candidate)
            yield candidate


def get_database(client: MongoClient):
    try:
        database = client.get_default_database()
        if database is not None:
            return database
    except Exception:
        pass

    return client["optipharma"]


def load_and_prepare_frame(csv_path: Path) -> pd.DataFrame:
    print("[load] Reading CSV into pandas...")
    frame = pd.read_csv(csv_path)
    print(f"[load] Raw row count: {len(frame):,}")

    required_columns = ["name", "manufacturer_name", "salt_composition"]
    missing_columns = [column for column in required_columns if column not in frame.columns]
    if missing_columns:
        raise KeyError(f"Dataset is missing required columns: {missing_columns}")

    print("[clean] Dropping rows with missing required values...")
    frame = frame.dropna(subset=required_columns).copy()

    for column in required_columns:
        frame[column] = frame[column].map(clean_text)

    frame = frame[
        (frame["name"] != "")
        & (frame["manufacturer_name"] != "")
        & (frame["salt_composition"] != "")
    ].copy()

    print(f"[clean] Row count after cleaning: {len(frame):,}")

    frame = frame.head(SAMPLE_SIZE).reset_index(drop=True)
    print(f"[sample] Using top {len(frame):,} cleaned records for import.")
    return frame


def build_documents(frame: pd.DataFrame) -> list[dict]:
    print("[transform] Converting rows into MongoDB medicine documents...")
    now_utc = datetime.now(timezone.utc)
    expiry_date = add_years(now_utc, 2)
    batch_numbers = list(generate_batch_numbers(len(frame)))
    documents: list[dict] = []

    for index, row in frame.iterrows():
        compounds = split_compounds(row["salt_composition"])
        if not compounds:
            continue

        documents.append(
            {
                "batchNumber": batch_numbers[index],
                "brandName": row["name"],
                "manufacturer": row["manufacturer_name"],
                "expectedCompounds": compounds,
                "expiryDate": expiry_date,
                "referenceLogoFilename": "default_logo.png",
                "category": "imported_1mg",
                "isActive": True,
                "createdAt": now_utc,
                "updatedAt": now_utc,
            }
        )

    print(f"[transform] Prepared {len(documents):,} documents.")
    if not documents:
        raise ValueError("No valid documents were generated from the dataset.")

    return documents


def upload_documents(documents: list[dict]) -> None:
    print("[mongo] Connecting to MongoDB...")
    client = MongoClient(MONGO_URI)

    try:
        database = get_database(client)
        collection = database[COLLECTION_NAME]
        print(f"[mongo] Connected to database: {database.name}")
        print(f"[mongo] Target collection: {COLLECTION_NAME}")

        print("[mongo] Clearing existing truth-ledger medicine documents...")
        delete_result = collection.delete_many({})
        print(f"[mongo] Deleted {delete_result.deleted_count:,} existing documents.")

        print(f"[mongo] Inserting {len(documents):,} new documents...")
        insert_result = collection.insert_many(documents)
        print(f"[mongo] Inserted {len(insert_result.inserted_ids):,} documents successfully.")
    finally:
        client.close()
        print("[mongo] MongoDB connection closed.")


def main() -> None:
    print("[start] OptiPharma 1mg truth-ledger import started.")
    print(f"[download] Requesting dataset: {DATASET_HANDLE}")
    dataset_dir = kagglehub.dataset_download(DATASET_HANDLE)
    print(f"[download] Dataset downloaded to: {dataset_dir}")

    csv_path = find_csv_file(dataset_dir)
    frame = load_and_prepare_frame(csv_path)
    documents = build_documents(frame)
    upload_documents(documents)
    print("[done] Truth ledger import completed successfully.")


if __name__ == "__main__":
    main()
