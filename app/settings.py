from dataclasses import dataclass
from pathlib import Path

@dataclass(frozen=True)
class Settings:
    data_dir: Path = Path("/app/data")
    templates_dir: Path = Path("/app/app/templates")
    # conforme o formulário:
    prazo_sem_passagens_dias: int = 10
    prazo_com_passagens_dias: int = 30
    prazo_relatorio_dias: int = 5

settings = Settings()
