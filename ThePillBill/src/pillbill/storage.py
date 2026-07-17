from __future__ import annotations

import hashlib
import json
import shutil
from pathlib import Path

from .models import PatientConfig, Regimen, regimen_from_dict, regimen_to_dict


class Storage:
    def __init__(self, root: Path | str = Path("data/patients")) -> None:
        self.root = Path(root)

    def patient_dir(self, patient_id: str) -> Path:
        return self.root / patient_id

    def init_patient(self, config: PatientConfig) -> Path:
        base = self.patient_dir(config.patient_id)
        (base / "docs").mkdir(parents=True, exist_ok=True)
        (base / "output").mkdir(parents=True, exist_ok=True)
        self.write_json(base / "patient.json", {
            "patient_id": config.patient_id,
            "timezone": config.timezone,
            "created_at": config.created_at,
        })
        return base

    def load_patient(self, patient_id: str) -> PatientConfig:
        path = self.patient_dir(patient_id) / "patient.json"
        data = self.read_json(path)
        return PatientConfig(
            patient_id=data["patient_id"],
            timezone=data["timezone"],
            created_at=data.get("created_at", ""),
        )

    def upload_documents(self, patient_id: str, files: list[Path]) -> list[Path]:
        docs_dir = self.patient_dir(patient_id) / "docs"
        docs_dir.mkdir(parents=True, exist_ok=True)
        copied: list[Path] = []
        for file in files:
            target = docs_dir / file.name
            shutil.copy2(file, target)
            copied.append(target)
        return copied

    def list_documents(self, patient_id: str) -> list[Path]:
        docs_dir = self.patient_dir(patient_id) / "docs"
        if not docs_dir.exists():
            return []
        return sorted([p for p in docs_dir.iterdir() if p.is_file()])

    def compute_docs_hash(self, patient_id: str, docs: list[Path] | None = None) -> str:
        hasher = hashlib.sha256()
        paths = docs if docs is not None else self.list_documents(patient_id)
        for path in paths:
            hasher.update(path.name.encode("utf-8"))
            hasher.update(path.read_bytes())
        return hasher.hexdigest()

    def save_regimen(self, patient_id: str, regimen: Regimen, *, verified: bool) -> Path:
        base = self.patient_dir(patient_id)
        base.mkdir(parents=True, exist_ok=True)
        filename = "regimen_verified.json" if verified else "regimen_draft.json"
        path = base / filename
        self.write_json(path, regimen_to_dict(regimen))
        return path

    def load_regimen(self, patient_id: str, *, verified: bool) -> Regimen:
        base = self.patient_dir(patient_id)
        filename = "regimen_verified.json" if verified else "regimen_draft.json"
        data = self.read_json(base / filename)
        return regimen_from_dict(data)

    def output_dir(self, patient_id: str) -> Path:
        out = self.patient_dir(patient_id) / "output"
        out.mkdir(parents=True, exist_ok=True)
        return out

    @staticmethod
    def read_json(path: Path) -> dict:
        if not path.exists():
            raise FileNotFoundError(f"Missing file: {path}")
        return json.loads(path.read_text(encoding="utf-8"))

    @staticmethod
    def write_json(path: Path, data: dict) -> None:
        path.write_text(json.dumps(data, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")
